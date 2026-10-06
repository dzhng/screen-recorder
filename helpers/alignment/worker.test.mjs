import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const worker = fileURLToPath(new URL("worker.py", import.meta.url));
test("invalid alignment input refuses before optional inference imports or output allocation", () => {
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", worker], {
    input: JSON.stringify({
      operation: "alignment.observe",
      params: {
        model: "/missing.nemo",
        modelSha256: "a".repeat(64),
        pcm: "/missing.f32",
        pcmSha256: "b".repeat(64),
        frames: 400001,
        sampleRate: 16000,
        text: "blue seven blue",
        output: "/missing-output.json",
      },
    }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "UNSUPPORTED_ALIGNMENT_WINDOW");
  assert.equal(response.error.retryable, false);
  assert.doesNotMatch(result.stderr, /(?:ModuleNotFoundError|torch|nemo)/);
});
