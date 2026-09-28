import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

/** A JSON envelope cannot turn a crashed or timed-out CLI process into success. */
export async function cliReply(args) {
  let stdout,
    code = 0;
  try {
    ({ stdout } = await run(process.execPath, args, { timeout: 30000, maxBuffer: 8 * 1024 ** 2 }));
  } catch (failure) {
    assert.ok(
      !failure.signal && !failure.killed && Number.isInteger(failure.code),
      `CLI terminated abnormally: ${failure.message}`,
    );
    assert.ok(failure.stdout, `CLI exited without a response: ${failure.message}`);
    stdout = failure.stdout;
    code = failure.code;
  }
  const response = JSON.parse(stdout);
  assert.equal(typeof response.ok, "boolean");
  assert.equal(code, response.ok ? 0 : 1, "CLI exit status contradicts its response");
  return response;
}
