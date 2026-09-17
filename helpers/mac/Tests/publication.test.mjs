import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  mkdtemp,
  mkdir,
  open,
  readFile,
  rm,
  rename,
  symlink,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
const binary =
  process.env.SCREENREC_NATIVE ?? resolve(import.meta.dirname, "../.build/debug/screenrec-native");
const identity = (s) => ({ dev: String(s.dev), ino: String(s.ino) });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "screenrec-publication-"));
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
  async function call(operation, extra = {}) {
    const child = spawn(binary, [], {
      stdio: ["pipe", "pipe", "inherit", stage.fd, destination.fd, source.fd],
    });
    let output = "";
    child.stdout.on("data", (b) => (output += b));
    child.stdin.end(
      JSON.stringify({
        id: "test",
        operation: "publication." + operation,
        params: { ...params, ...extra },
      }) + "\n",
    );
    await new Promise((yes, no) => {
      child.on("error", no);
      child.on("close", yes);
    });
    return JSON.parse(output);
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
