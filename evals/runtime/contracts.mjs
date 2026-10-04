import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { failedJobFixture } from "./fixture.mjs";

export async function contracts() {
  const outcomes = [];
  async function call(args, input) {
    const child = spawn("screenrec", args, {
      env: { ...process.env, SCREENREC_APP: "/does/not/exist.app" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (b) => (stdout += b));
    child.stderr.on("data", (b) => (stderr += b));
    if (input !== undefined) child.stdin.end(input);
    const exit = await new Promise((resolve, reject) => {
      child.once("close", resolve);
      child.once("error", reject);
    });
    const result = { exit, stdout, stderr, reply: JSON.parse(stdout) };
    outcomes.push({ args, ...result });
    return result;
  }
  try {
    let r = await call(["capture.status", "--help"]);
    assert.equal(r.exit, 0);
    assert.equal(r.reply.operations[0].name, "capture.status");
    r = await call(["made.up.operation", "--socket", "/sandbox/missing.sock"]);
    assert.notEqual(r.exit, 0);
    assert.equal(r.reply.error.code, "UNKNOWN_OPERATION");
    r = await call(["job.get", "--socket", "/sandbox/missing.sock", "--params", "-"], '{"jobId":');
    assert.notEqual(r.exit, 0);
    assert.equal(r.reply.ok, false);
    r = await call(["job.get", "--socket", "/sandbox/missing.sock", "--params", "-"], "{}");
    assert.notEqual(r.exit, 0);
    assert.equal(r.reply.error.code, "INVALID_PARAMS");
    r = await call(
      ["job.get", "--socket", "/sandbox/missing.sock", "--params", "-"],
      '{"jobId":"audit-job"}',
    );
    assert.notEqual(r.exit, 0);
    assert.match(r.reply.error.code, /CONNECTION/);
    const close = await failedJobFixture();
    try {
      r = await call(
        ["job.get", "--socket", "/sandbox/service.sock", "--params", "-"],
        '{"jobId":"audit-job"}',
      );
      assert.equal(r.exit, 0);
      assert.equal(r.reply.ok, true);
      assert.equal(r.reply.data.state, "failed");
    } finally {
      await close();
    }
  } catch (error) {
    return { error: error.message, outcomes };
  }
  return { passed: outcomes.length, outcomes };
}
