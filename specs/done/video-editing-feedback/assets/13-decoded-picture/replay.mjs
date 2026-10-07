import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  verifyPictureSample,
  verifyPicturePixels,
} from "../../../../packages/test-harness/editing/decoded-picture-proof.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const selections = JSON.parse(await readFile(join(root, "accepted-samples.json"))).selections;
const args = process.argv.slice(2);
if (args[0] === "--help") {
  console.log(
    "node replay.mjs [--case graham|madison|lily|chart|rotated]\nRead-only retained clock/profile/metric and representative-file integrity replay; no decoding, inference or publication. Reproduce unretained sampled pixels with the durable picture runner.",
  );
  process.exit(0);
}
const selected = args.length
  ? args[0] === "--case" && args.length === 2 && selections.some((r) => r.cases.includes(args[1]))
    ? args[1]
    : null
  : undefined;
assert.notEqual(selected, null, "Unknown case; use --help");
let samples = 0;
for (const selection of selections) {
  const bytes = await readFile(join(root, selection.report));
  assert.equal(sha(bytes), selection.sha256);
  const report = JSON.parse(bytes);
  for (const id of selection.cases.filter((id) => !selected || selected === id)) {
    const row = report.cases.find((c) => c.id === id);
    assert(row);
    assert.equal(row.coverage.failed, 0);
    assert.equal(row.coverage.available, row.frames.length);
    assert.deepEqual(
      row.samples.map((s) => s.index),
      row.frames,
    );
    for (const sample of row.samples) {
      verifyPictureSample(sample, row.fps);
      verifyPicturePixels(sample.referencePixels);
      for (const kind of ["source", "project"]) {
        verifyPicturePixels(sample[kind].pixels);
        assert(sample[kind].difference.mae <= 1 && sample[kind].difference.maxDelta <= 2);
      }
      samples++;
    }
  }
}
assert.equal(samples, selected ? 4 : 20);
for (const shot of JSON.parse(await readFile(join(root, "shots.json")))) {
  const bytes = await readFile(join(root, shot.file));
  assert.equal(bytes.length, shot.bytes);
  assert.equal(sha(bytes), shot.sha256);
}
console.log(
  JSON.stringify({
    passed: true,
    retainedSamples: samples,
    physicalClocks: true,
    frozenProfiles: true,
    retainedMetricChecks: true,
    representativeFiles: true,
    newPixelMeasurements: false,
  }),
);
