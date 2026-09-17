import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { provisionPackageWorkspace } from "../dist/package-workspace.js";
import { mediaWorker } from "../dist/worker.js";
const binary = process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native");
const worker = mediaWorker({ SCREENREC_NATIVE: binary });
async function fixture(t) {
  const root = await realpath(await mkdtemp("/tmp/screenrec-workspace-"));
  const directory = join(root, "parent");
  await mkdir(directory, { mode: 0o700 });
  const handle = await open(directory);
  t.after(async () => {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, parent: { directory, handle } };
}
test("owned workspace creates private child and removes only its contents", async (t) => {
  const f = await fixture(t);
  const owner = await provisionPackageWorkspace(f.parent, worker);
  const info = await owner.handle.stat({ bigint: true });
  assert.equal(info.mode & 0o777n, 0o700n);
  assert.equal(info.ino.toString(), owner.identity.ino);
  await mkdir(join(owner.directory, "nested"));
  await writeFile(join(owner.directory, "nested/data"), "owned");
  await writeFile(join(f.parent.directory, "sentinel"), "foreign");
  await owner.remove();
  await owner.remove();
  assert.deepEqual(await readdir(f.parent.directory), ["sentinel"]);
  assert.equal(await readFile(join(f.parent.directory, "sentinel"), "utf8"), "foreign");
});
test("removal follows retained parent after ancestor replacement", async (t) => {
  const f = await fixture(t);
  const owner = await provisionPackageWorkspace(f.parent, worker);
  await writeFile(join(owner.directory, "owned"), "owned");
  const original = join(f.root, "original");
  await rename(f.parent.directory, original);
  await mkdir(f.parent.directory, { mode: 0o700 });
  await mkdir(join(f.parent.directory, owner.name));
  await writeFile(join(f.parent.directory, owner.name, "sentinel"), "foreign");
  await owner.remove();
  assert.deepEqual(await readdir(original), []);
  assert.equal(await readFile(join(f.parent.directory, owner.name, "sentinel"), "utf8"), "foreign");
});
test("foreign child directory and symlink are never cleaned", async (t) => {
  const f = await fixture(t);
  const owner = await provisionPackageWorkspace(f.parent, worker);
  const original = join(f.parent.directory, "original");
  await rename(owner.directory, original);
  await mkdir(owner.directory, { mode: 0o700 });
  await writeFile(join(owner.directory, "sentinel"), "foreign");
  await assert.rejects(owner.remove(), /identity changed/);
  assert.equal(await readFile(join(owner.directory, "sentinel"), "utf8"), "foreign");
  await rm(owner.directory, { recursive: true });
  const target = join(f.root, "target");
  await mkdir(target);
  await writeFile(join(target, "sentinel"), "outside");
  await symlink(target, owner.directory);
  await assert.rejects(owner.remove(), /ownership may be lost/);
  assert.equal(await readFile(join(target, "sentinel"), "utf8"), "outside");
  await rm(owner.directory);
  await symlink(join(f.root, "absent-target"), owner.directory);
  await assert.rejects(owner.remove(), /ownership may be lost/);
  await rm(owner.directory);
  await rename(original, owner.directory);
  await owner.remove();
});
test("surviving inherited child blocks removal, then explicit retry succeeds", async (t) => {
  const f = await fixture(t);
  const owner = await provisionPackageWorkspace(f.parent, worker);
  await writeFile(join(owner.directory, "data"), "held");
  const child = spawn(
    process.execPath,
    ["-e", "process.stdout.write('ready\\n');setInterval(()=>{},1000)"],
    {
      stdio: ["ignore", "pipe", "inherit", owner.handle.fd],
    },
  );
  const reaped = once(child, "close");
  t.after(async () => {
    child.kill("SIGKILL");
    await reaped;
  });
  await once(child.stdout, "data");
  const first = owner.remove();
  assert.equal(owner.remove(), first);
  await assert.rejects(first, /owned exclusively/);
  assert.equal(owner.handle.fd, -1);
  assert.equal(await readFile(join(owner.directory, "data"), "utf8"), "held");
  child.kill("SIGKILL");
  await reaped;
  await owner.remove();
  assert.deepEqual(await readdir(f.parent.directory), []);
});
test("failed locator admission cleans created identity through original parent", async (t) => {
  const f = await fixture(t);
  const original = join(f.root, "original");
  let name;
  const movedWorker = async (operation, params, options) => {
    const reply = await worker(operation, params, options);
    if (operation === "packageWorkspace.create" && reply.ok) {
      name = params.name;
      await rename(f.parent.directory, original);
      await mkdir(f.parent.directory, { mode: 0o700 });
      await mkdir(join(f.parent.directory, name), { mode: 0o700 });
      await writeFile(join(f.parent.directory, name, "sentinel"), "foreign");
    }
    return reply;
  };
  await assert.rejects(
    provisionPackageWorkspace(f.parent, movedWorker),
    /locator identity changed/,
  );
  assert.deepEqual(await readdir(original), []);
  assert.equal(await readFile(join(f.parent.directory, name, "sentinel"), "utf8"), "foreign");
});
test("cancellation after mkdir drains receipt and cleans the owned child", async (t) => {
  const f = await fixture(t);
  const abort = new AbortController();
  const cancelWorker = async (operation, params, options) => {
    const reply = await worker(operation, params, options);
    if (operation === "packageWorkspace.create") abort.abort();
    return reply;
  };
  await assert.rejects(
    provisionPackageWorkspace(f.parent, cancelWorker, { signal: abort.signal }),
    { code: "CANCELED" },
  );
  assert.deepEqual(await readdir(f.parent.directory), []);
});
test("failed admission cleanup retains identity when a foreign child replaces its entry", async (t) => {
  const f = await fixture(t);
  let created;
  const displaced = join(f.parent.directory, "displaced");
  const movedWorker = async (operation, params, options) => {
    const reply = await worker(operation, params, options);
    if (operation === "packageWorkspace.create" && reply.ok) {
      created = reply.data;
      await rename(join(f.parent.directory, created.name), displaced);
      await writeFile(join(displaced, "data"), "retained");
      await mkdir(join(f.parent.directory, created.name), { mode: 0o700 });
      await writeFile(join(f.parent.directory, created.name, "sentinel"), "foreign");
    }
    return reply;
  };
  await assert.rejects(provisionPackageWorkspace(f.parent, movedWorker), (error) => {
    assert.equal(error.code, "INVALID_STORAGE");
    assert.equal(error.details.name, created.name);
    assert.deepEqual(error.details.identity, created.identity);
    return true;
  });
  assert.equal(await readFile(join(displaced, "data"), "utf8"), "retained");
  assert.equal(
    await readFile(join(f.parent.directory, created.name, "sentinel"), "utf8"),
    "foreign",
  );
  await rm(join(f.parent.directory, created.name), { recursive: true });
  await rename(displaced, join(f.parent.directory, created.name));
  const info = await f.parent.handle.stat({ bigint: true });
  const removed = await worker(
    "packageWorkspace.remove",
    {
      parent: { dev: info.dev.toString(), ino: info.ino.toString() },
      ...created,
    },
    { descriptors: [f.parent.handle.fd] },
  );
  assert.equal(removed.ok, true);
  assert.deepEqual(await readdir(f.parent.directory), []);
});
test("lost response after actual rmdir retries truthfully through retained parent", async (t) => {
  const f = await fixture(t);
  let loseReply = true;
  const lossyWorker = async (operation, params, options) => {
    const reply = await worker(operation, params, options);
    if (operation === "packageWorkspace.remove" && reply.ok && loseReply) {
      loseReply = false;
      return {
        ok: false,
        error: {
          code: "LOST_REPLY",
          message: "Lost reply after native removal",
          retryable: true,
          details: {},
        },
      };
    }
    return reply;
  };
  const owner = await provisionPackageWorkspace(f.parent, lossyWorker);
  await writeFile(join(owner.directory, "data"), "owned");
  const original = join(f.root, "original");
  await rename(f.parent.directory, original);
  await mkdir(f.parent.directory, { mode: 0o700 });
  await mkdir(join(f.parent.directory, owner.name));
  await writeFile(join(f.parent.directory, owner.name, "sentinel"), "foreign");
  await assert.rejects(owner.remove(), { code: "LOST_REPLY" });
  assert.deepEqual(await readdir(original), []);
  await owner.remove();
  await owner.remove();
  assert.equal(await readFile(join(f.parent.directory, owner.name, "sentinel"), "utf8"), "foreign");
});
