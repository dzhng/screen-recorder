import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

for (const evidence of ["06-color", "06-rec709"]) {
  const frozen = fileURLToPath(
    new URL(`../../../specs/done/agent-editing/assets/${evidence}/`, import.meta.url),
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

  test(`${evidence}: frozen native conversion stays within four levels; explicit untagged sRGB assumption is a failing control`, () => {
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

  if (evidence === "06-rec709")
    test("Rec.709 encodes carry explicit tags and retain the reported compression failures", () => {
      for (const result of report.results.filter((row) => row.name.endsWith("-rec709"))) {
        const probe = spawnSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=color_primaries,color_transfer,color_space",
            "-of",
            "json",
            join(frozen, result.name, "bounded.mov"),
          ],
          { encoding: "utf8" },
        );
        assert.equal(probe.status, 0, probe.stderr);
        assert.deepEqual(JSON.parse(probe.stdout).streams[0], {
          color_space: "bt709",
          color_transfer: "bt709",
          color_primaries: "bt709",
        });
        const source = rgb(result.name, "source-native.png"),
          output = rgb(result.name, "roundtrip-native.png");
        assert.ok(maximumError(source, output) > 4, "Lossy whole-frame gate remains red");
        const patchesPass = result.roundtrip.selections.every(({ x, y }) => {
          const offset = (y * result.request.width + x) * 3;
          return [0, 1, 2].every(
            (channel) => Math.abs(source[offset + channel] - output[offset + channel]) <= 4,
          );
        });
        assert.equal(patchesPass, result.name !== "recorded-fixture-rec709", result.name);
      }
    });
}
