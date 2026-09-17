import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const executable =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));
function request(lines) {
  const result = spawnSync(executable, [], {
    input: `${lines.join("\n")}\n`,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split("\n").map(JSON.parse);
}

test("ping round-trips its request ID through the native process", () => {
  assert.deepEqual(request(['{"id":"ping-1","operation":"system.ping","params":{}}']), [
    { id: "ping-1", ok: true, data: { platform: "macos" } },
  ]);
});

test("invalid requests return structured errors without poisoning the next line", () => {
  const lines = [
    "{",
    '{"id":"unknown","operation":"no.such.operation","params":{}}',
    '{"id":"extra","operation":"system.ping","params":{"extra":1}}',
    '{"id":"envelope","operation":"system.ping","params":{},"extra":1}',
    '{"id":"array","operation":"system.ping","params":[]}',
    '{"id":"next","operation":"system.ping","params":{}}',
  ];
  const responses = request(lines);
  for (const [index, id] of [null, "unknown", "extra", "envelope", "array"].entries()) {
    assert.equal(responses[index].id, id);
    assert.equal(responses[index].ok, false);
    assert.equal(
      responses[index].error.code,
      index === 1 ? "UNKNOWN_OPERATION" : "INVALID_REQUEST",
    );
    assert.equal(responses[index].error.retryable, false);
    assert.equal(typeof responses[index].error.message, "string");
    assert.deepEqual(responses[index].error.details, {});
  }
  assert.deepEqual(responses[5], { id: "next", ok: true, data: { platform: "macos" } });
});

test("a changed directory identity reports the same final failure through every operation family", () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "wire-identity-")));
  const directory = openSync(home, "r");
  try {
    const stale = { dev: "1", ino: "1" };
    const run = (operation, params) => {
      const result = spawnSync(executable, [], {
        input: JSON.stringify({ id: operation, operation, params }) + "\n",
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe", directory],
        timeout: 5000,
      });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout).error;
    };
    const failures = [
      run("storage.removeRecordingDirectory", {
        home,
        expectedHome: stale,
        recordingId: "00000000-0000-4000-8000-000000000000",
      }),
      run("archive.cleanup", { identity: stale }),
      run("packageWorkspace.remove", {
        parent: stale,
        name: "00000000-0000-4000-8000-000000000000",
        identity: stale,
      }),
    ];
    for (const failure of failures) {
      assert.equal(failure.code, "INVALID_STORAGE");
      assert.equal(failure.retryable, false, JSON.stringify(failure));
    }
  } finally {
    closeSync(directory);
    rmSync(home, { recursive: true, force: true });
  }
});
