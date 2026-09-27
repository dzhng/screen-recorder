import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

try {
  assert.equal(process.argv[2], "--out");
  assert.equal(process.argv.length, 4);
  const directory = resolve(process.argv[3]);
  const report = JSON.parse(await readFile(join(directory, "report.json"), "utf8"));
  for (const output of report.outputs) {
    const digest = createHash("sha256")
      .update(await readFile(join(directory, output.path)))
      .digest("hex");
    assert.equal(digest, output.sha256, `Hash mismatch: ${output.path}`);
  }
  for (const name of [
    "av-replacement",
    "nonzero-preview",
    "audio-replacement",
    "held-frame",
    "subframe-source",
    "vfr-held-tail",
    "empty-edit",
    "empty-edit-preview",
    "unavailable-acquisition",
  ]) {
    const result = report.results.find((entry) => entry.name === name);
    assert.ok(result, `Missing evidence: ${name}`);
    assert.equal(result.methods.bounded.temporalPassed, true, `${name}: temporal gate failed`);
    if (result.methods.bounded.audio) {
      assert.equal(result.methods.bounded.audio.passed, true, `${name}: encoded PCM changed`);
      assert.equal(result.methods.bounded.mixPCM.passed, true, `${name}: mixed PCM changed`);
      assert.ok(
        result.methods.bounded.impulses.every((impulse) => impulse.passed),
        `${name}: impulse timing changed`,
      );
    }
  }
  assert.equal(
    report.results.find((entry) => entry.name === "av-replacement").methods.bounded
      .sourceColorPassed,
    true,
    "Declared fixture color failed",
  );
  console.log(
    JSON.stringify({
      status: "verified",
      mechanism: "bounded reader / CI / writer",
      productionColorPolicy: "untagged-input policy remains open",
      outputs: report.outputs.length,
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
