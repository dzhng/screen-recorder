import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  mkdtemp,
  mkdir,
  open,
  readFile,
  readlink,
  rm,
  rename,
  symlink,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
const binary = process.env.YAP_NATIVE ?? resolve(import.meta.dirname, "../.build/debug/yap-native");
const identity = (s) => ({ dev: String(s.dev), ino: String(s.ino) });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "yap-publication-"));
  await mkdir(join(root, "stage"), { mode: 0o700 });
  await mkdir(join(root, "output"), { mode: 0o755 });
  await writeFile(join(root, "source"), "known complete output");
  const stage = await open(
    join(root, "stage"),
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK | 0x20,
  );
  const destination = await open(join(root, "output"), constants.O_RDONLY | constants.O_DIRECTORY);
  const source = await open(join(root, "source"), constants.O_RDONLY);
  t.after(async () => {
    await Promise.all([stage.close(), destination.close(), source.close()]);
    await rm(root, { recursive: true, force: true });
  });
  const params = {
    stage: identity(await stage.stat({ bigint: true })),
    destination: identity(await destination.stat({ bigint: true })),
  };
  async function call(operation, extra = {}, environment = {}) {
    const child = spawn(binary, [], {
      stdio: ["pipe", "pipe", "inherit", stage.fd, destination.fd, source.fd],
      env: { ...process.env, ...environment },
    });
    let output = "";
    child.stdout.on("data", (b) => (output += b));
    child.stdin.end(
      JSON.stringify({
        id: "test",
        operation: "publication." + operation,
        params: {
          ...(operation === "usage" ? { stage: params.stage } : params),
          ...(operation === "prepare" ? { replacement: null } : {}),
          ...extra,
        },
      }) + "\n",
    );
    const code = await new Promise((yes, no) => {
      child.on("error", no);
      child.on("close", yes);
    });
    return output ? JSON.parse(output) : { processExit: code };
  }
  return { root, call, params, stage, destination, source };
}
test("complete prepared bytes publish exclusively and reconcile before acknowledgement", async (t) => {
  const f = await fixture(t);
  const prepared = await f.call("prepare", {
    leaf: "export.mp4",
    maxBytes: 1024,
  });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const receipt = prepared.data.receipt;
  assert.equal(receipt.sha256, createHash("sha256").update("known complete output").digest("hex"));
  assert.equal(receipt.bytes, Buffer.byteLength("known complete output"));
  t.diagnostic(JSON.stringify({ prepared: receipt }));
  assert.equal((await f.call("commit")).data.state, "committed");
  assert.equal(await readFile(join(f.root, "output/export.mp4"), "utf8"), "known complete output");
  assert.equal((await f.call("reconcile")).data.state, "committed");
  assert.deepEqual(
    identity(await stat(join(f.root, "output/export.mp4"), { bigint: true })),
    receipt.file,
  );
  assert.equal((await f.call("commit")).data.state, "committed");
  assert.equal((await f.call("acknowledge")).data.removed, true);
  assert.equal((await f.call("acknowledge")).data.removed, true);
  assert.equal(await readFile(join(f.root, "output/export.mp4"), "utf8"), "known complete output");
});

test("reconciliation distinguishes same bytes in another inode from changes in the committed inode", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("prepare", { leaf: "export.mp4", maxBytes: 1024 })).ok, true);
  assert.equal((await f.call("commit")).data.state, "committed");
  await writeFile(join(f.root, "output/export.mp4"), "changed output bytes!");
  assert.equal((await f.call("reconcile")).data.state, "modified");
  await rm(join(f.root, "output/export.mp4"));
  await writeFile(join(f.root, "output/export.mp4"), "known complete output");
  assert.equal((await f.call("reconcile")).data.state, "replaced");
  assert.equal((await f.call("acknowledge")).ok, false);
  assert.equal((await f.call("discard")).ok, true);
  assert.equal(await readFile(join(f.root, "output/export.mp4"), "utf8"), "known complete output");
});
test("existing destination and symlink leaves are never replaced or followed", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, "sentinel"), "sentinel");
  await symlink(join(f.root, "sentinel"), join(f.root, "output/export.mp4"));
  assert.equal((await f.call("prepare", { leaf: "export.mp4", maxBytes: 1024 })).ok, true);
  assert.equal((await f.call("commit")).data.state, "replaced");
  assert.equal(await readFile(join(f.root, "sentinel"), "utf8"), "sentinel");
  await rm(join(f.root, "output/export.mp4"));
  await writeFile(join(f.root, "output/export.mp4"), "existing output");
  assert.equal((await f.call("commit")).data.state, "replaced");
  assert.equal(await readFile(join(f.root, "output/export.mp4"), "utf8"), "existing output");
});
test("retained output and source descriptors survive controlled path replacement", async (t) => {
  const f = await fixture(t);
  await rename(join(f.root, "source"), join(f.root, "original-source"));
  await writeFile(join(f.root, "source"), "replacement source");
  assert.equal((await f.call("prepare", { leaf: "export.mp4", maxBytes: 1024 })).ok, true);
  await rename(join(f.root, "output"), join(f.root, "original-output"));
  await mkdir(join(f.root, "output"));
  await writeFile(join(f.root, "output/export.mp4"), "sentinel");
  assert.equal((await f.call("commit")).data.state, "committed");
  assert.equal(
    await readFile(join(f.root, "original-output/export.mp4"), "utf8"),
    "known complete output",
  );
  assert.equal(await readFile(join(f.root, "output/export.mp4"), "utf8"), "sentinel");
});
test("preparation budget failure leaves destination absent", async (t) => {
  const f = await fixture(t);
  const result = await f.call("prepare", { leaf: "export.mp4", maxBytes: 2 });
  assert.equal(result.error.code, "LIMIT_EXCEEDED");
  await assert.rejects(readFile(join(f.root, "output/export.mp4")), {
    code: "ENOENT",
  });
  assert.equal((await f.call("discard")).ok, true);
});

test("private cleanup stays on its inherited directory after staging path replacement", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("prepare", { leaf: "export.mp4", maxBytes: 1024 })).ok, true);
  await rename(join(f.root, "stage"), join(f.root, "original-stage"));
  await mkdir(join(f.root, "stage"), { mode: 0o700 });
  await writeFile(join(f.root, "stage/payload"), "sentinel");
  assert.equal((await f.call("commit")).data.state, "committed");
  assert.equal((await f.call("acknowledge")).data.removed, true);
  assert.equal(await readFile(join(f.root, "stage/payload"), "utf8"), "sentinel");
  assert.equal(await readFile(join(f.root, "output/export.mp4"), "utf8"), "known complete output");
});

test("pinned unchanged victim is atomically exchanged and retained until acknowledgement", async (t) => {
  const f = await fixture(t);
  const old = "previous good output";
  const destination = join(f.root, "output/export.mp4");
  await writeFile(destination, old);
  const replacement = {
    file: identity(await stat(destination, { bigint: true })),
    bytes: Buffer.byteLength(old),
    sha256: createHash("sha256").update(old).digest("hex"),
  };
  const prepared = await f.call("prepare", { leaf: "export.mp4", maxBytes: 1024, replacement });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(await readFile(destination, "utf8"), old);
  assert.equal((await f.call("commit")).data.state, "committed");
  assert.equal(await readFile(destination, "utf8"), "known complete output");
  assert.equal(await readFile(join(f.root, "stage/swap"), "utf8"), old);
  assert.equal((await f.call("reconcile")).data.state, "committed");
  const receiptBytes = (await readFile(join(f.root, "stage/prepared.json"))).length;
  const usage = await f.call("usage", { committed: true });
  assert.equal(usage.ok, true, JSON.stringify(usage));
  assert.equal(usage.data.bytes, Buffer.byteLength(old) + receiptBytes);
  assert.deepEqual(identity(await stat(destination, { bigint: true })), prepared.data.receipt.file);
  assert.equal((await f.call("acknowledge")).data.removed, true);
  await assert.rejects(readFile(join(f.root, "stage/swap")), { code: "ENOENT" });
  assert.equal(await readFile(destination, "utf8"), "known complete output");
});

async function replacementFixture(t) {
  const f = await fixture(t);
  const old = "previous good output";
  const path = join(f.root, "output/export.mp4");
  await writeFile(path, old);
  const replacement = {
    file: identity(await stat(path, { bigint: true })),
    bytes: Buffer.byteLength(old),
    sha256: createHash("sha256").update(old).digest("hex"),
  };
  const prepared = await f.call("prepare", { leaf: "export.mp4", maxBytes: 1024, replacement });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const library = join(f.root, "swap-fault.dylib");
  await promisify(execFile)("/usr/bin/clang", [
    "-dynamiclib",
    resolve(import.meta.dirname, "fixtures/publication-swap-interpose.c"),
    "-o",
    library,
  ]);
  return {
    ...f,
    path,
    old,
    replacement,
    receipt: prepared.data.receipt,
    fault: (mode) => ({ DYLD_INSERT_LIBRARIES: library, YAP_SWAP_FAULT: mode }),
  };
}

test("noncooperating replacement race retains unexpected displaced bytes and refuses cleanup", async (t) => {
  const f = await replacementFixture(t);
  const result = await f.call("commit", {}, f.fault("foreign"));
  assert.equal(result.data.state, "conflicted", JSON.stringify(result));
  assert.equal(await readFile(f.path, "utf8"), "known complete output");
  const displaced = join(f.root, "stage/swap");
  assert.equal(await readFile(displaced, "utf8"), "foreign raced bytes");
  assert.equal((await f.call("reconcile")).data.state, "conflicted");
  assert.equal((await f.call("acknowledge")).ok, false);
  const discarded = await f.call("discard");
  assert.equal(discarded.ok, false, JSON.stringify(discarded));
  assert.equal(discarded.error.code, "PUBLICATION_CONFLICT");
  assert.equal(await readFile(displaced, "utf8"), "foreign raced bytes");
  await writeFile(f.path, "a later successor");
  assert.equal((await f.call("commit")).data.state, "conflicted");
  assert.equal(await readFile(f.path, "utf8"), "a later successor");
});

test("same-inode same-length race still requires the pinned victim digest", async (t) => {
  const f = await replacementFixture(t);
  const result = await f.call("commit", {}, f.fault("modified"));
  assert.equal(result.data.state, "conflicted", JSON.stringify(result));
  const displaced = join(f.root, "stage/swap");
  assert.deepEqual(identity(await stat(displaced, { bigint: true })), f.replacement.file);
  assert.equal((await stat(displaced)).size, f.replacement.bytes);
  assert.equal(await readFile(displaced, "utf8"), "foreign raced bytes!");
  assert.equal((await f.call("discard")).error.code, "PUBLICATION_CONFLICT");
});

for (const mode of ["before", "after"])
  test(`actual native death ${mode} atomic swap recovers the same prepared publication`, async (t) => {
    const f = await replacementFixture(t);
    assert.deepEqual(await f.call("commit", {}, f.fault(mode)), { processExit: 86 });
    assert.equal(
      await readFile(f.path, "utf8"),
      mode === "before" ? f.old : "known complete output",
    );
    const observed = await f.call("reconcile");
    assert.equal(observed.data.state, mode === "before" ? "prepared" : "committed");
    assert.deepEqual(observed.data.receipt, f.receipt);
    assert.equal((await f.call("commit")).data.state, "committed");
    assert.equal(await readFile(join(f.root, "stage/swap"), "utf8"), f.old);
    assert.equal(await readFile(f.path, "utf8"), "known complete output");
    assert.equal((await f.call("acknowledge")).data.removed, true);
    assert.equal(await readFile(f.path, "utf8"), "known complete output");
  });

test("recovery and repeated commit never overwrite a foreign successor after swap", async (t) => {
  const f = await replacementFixture(t);
  assert.equal((await f.call("commit", {}, f.fault("successor"))).data.state, "replaced");
  assert.equal(await readFile(f.path, "utf8"), "foreign successor");
  assert.equal(await readFile(join(f.root, "stage/swap"), "utf8"), f.old);
  assert.equal((await f.call("reconcile")).data.state, "replaced");
  assert.equal((await f.call("commit")).data.state, "replaced");
  assert.equal(await readFile(f.path, "utf8"), "foreign successor");
  assert.equal(await readFile(join(f.root, "stage/swap"), "utf8"), f.old);
});

test("symlink raced at the kernel swap boundary is retained in conflict without following it", async (t) => {
  const f = await replacementFixture(t);
  const sentinel = join(f.root, "sentinel");
  await writeFile(sentinel, "untouched sentinel");
  assert.equal((await f.call("commit", {}, f.fault("symlink"))).data.state, "conflicted");
  assert.equal(await readFile(sentinel, "utf8"), "untouched sentinel");
  assert.equal(await readFile(f.path, "utf8"), "known complete output");
  const displaced = join(f.root, "stage/swap");
  assert.equal(await readlink(displaced), "../sentinel");
  assert.equal((await f.call("commit")).data.state, "conflicted");
  assert.equal((await f.call("discard")).error.code, "PUBLICATION_CONFLICT");
  assert.equal(await readlink(displaced), "../sentinel");
  assert.equal(await readFile(sentinel, "utf8"), "untouched sentinel");
  const measured = await f.call("usage", { committed: false });
  assert.equal(measured.ok, true, JSON.stringify(measured));
  const receiptBytes = (await readFile(join(f.root, "stage/prepared.json"))).length;
  assert.equal(measured.data.bytes, receiptBytes + Buffer.byteLength("../sentinel"));
});

test("changed victim and symlink present before commit are strictly refused", async (t) => {
  const f = await replacementFixture(t);
  await writeFile(f.path, "changed before commit");
  assert.equal((await f.call("commit")).data.state, "replaced");
  assert.equal(await readFile(f.path, "utf8"), "changed before commit");
  await assert.rejects(stat(join(f.root, "stage/swap")), { code: "ENOENT" });
  const sentinel = join(f.root, "sentinel");
  await writeFile(sentinel, "untouched sentinel");
  await rm(f.path);
  await symlink("../sentinel", f.path);
  assert.equal((await f.call("commit")).data.state, "replaced");
  assert.equal(await readlink(f.path), "../sentinel");
  assert.equal(await readFile(sentinel, "utf8"), "untouched sentinel");
  await assert.rejects(stat(join(f.root, "stage/swap")), { code: "ENOENT" });
});

test("confirmed replacement survives interrupted cleanup without republishing", async (t) => {
  const f = await replacementFixture(t);
  assert.equal((await f.call("commit")).data.state, "committed");
  const before = identity(await stat(f.path, { bigint: true }));
  await rm(join(f.root, "stage/swap"));
  await rm(join(f.root, "stage/payload"));
  await rm(join(f.root, "stage/prepared.json"));
  assert.equal((await f.call("reconcile")).data.state, "committed");
  assert.equal((await f.call("commit")).data.state, "committed");
  assert.equal((await f.call("acknowledge")).data.removed, true);
  await assert.rejects(readFile(join(f.root, "stage/committed.json")), { code: "ENOENT" });
  assert.deepEqual(identity(await stat(f.path, { bigint: true })), before);
  assert.equal(await readFile(f.path, "utf8"), "known complete output");
});
