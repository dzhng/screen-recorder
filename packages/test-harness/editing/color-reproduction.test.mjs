import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frozen = fileURLToPath(
  new URL("../../../specs/agent-editing/assets/06-color/", import.meta.url),
);
const report = JSON.parse(readFileSync(join(frozen, "report.json"), "utf8"));
const rgb = (name, file) => {
  const result = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      join(frozen, name, file),
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
};
const maximumError = (a, b) => {
  assert.equal(a.length, b.length);
  let maximum = 0;
  for (let i = 0; i < a.length; i++) maximum = Math.max(maximum, Math.abs(a[i] - b[i]));
  return maximum;
};

test("frozen native conversion stays within four levels; explicit untagged sRGB assumption is a failing control", () => {
  for (const output of report.outputs) {
    const digest = createHash("sha256")
      .update(readFileSync(join(frozen, output.path)))
      .digest("hex");
    assert.equal(digest, output.sha256, output.path);
  }
  for (const result of report.results) {
    const reference = rgb(result.name, "source-native.png");
    assert.ok(maximumError(reference, rgb(result.name, "pre-encode.png")) <= 4, result.name);
    if (result.name === "synthetic-untagged" || result.name === "recorded-fixture") {
      assert.ok(
        maximumError(reference, rgb(result.name, "source-assume-srgb.png")) > 4,
        "Explicit profile replacement must fail the unchanged appearance gate",
      );
    }
  }
});
