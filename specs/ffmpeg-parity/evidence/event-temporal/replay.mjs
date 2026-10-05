// Retained occupancy proof only. No acquisition, models, resampling or writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { patchOccupancy, occupancyCounts } from "./bins.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => JSON.parse(readFileSync(join(root, path)));
const hash = (path) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");
const protocol = read("frozen-protocol.json");
const selection = read("selection.json");
const admission = read("input-admission.json");
const manifest = read("operands.json");
assert.equal(admission.protocolSha256, hash("frozen-protocol.json"));
assert.equal(hash("selection.json"), protocol.selectionSha256);
assert.equal(hash("dataset-notice.txt"), protocol.dataset.noticeSha256);
assert.equal(hash("upstream-readme.md"), protocol.dataset.readmeSha256);
for (const operand of manifest.files) assert.equal(hash(operand.path), operand.sha256);
for (const role of ["development", "confirmation"]) {
  const report = read(role + "-report.json");
  assert.equal(report.protocolSha256, hash("frozen-protocol.json"));
  assert.equal(report.mappingSha256, hash("bins.mjs"));
  for (const [category, outcome] of Object.entries(report.outcomes)) {
    for (const curve of outcome.curve) {
      const totals = Object.fromEntries(Object.keys(curve.total).map((key) => [key, 0]));
      for (const retained of curve.perCase) {
        const source = selection.cases.find((row) => row.id === retained.id);
        assert.equal(source.role, role);
        assert.equal(hash("labels/" + source.id + ".csv"), source.metadataMemberSha256);
        assert.equal(hash("results/" + source.id + ".json"), retained.rawSha256);
        assert.equal(hash("results/" + source.id + ".json.scores.json.gz"), retained.scoresSha256);
        const raw = read("results/" + source.id + ".json");
        assert.equal(raw.modelSha256, protocol.provider.modelSha256);
        assert.equal(
          raw.pcmSha256,
          admission.cases.find((row) => row.id === source.id).preparedSha256,
        );
        const attempt = read("results/" + source.id + "-attempt.json");
        assert.equal(attempt.exitCode, 0);
        assert.equal(attempt.networkDenied, true);
        assert(
          raw.inferenceSeconds <= raw.audioSeconds * protocol.gate.inferenceWallAudioRatio &&
            raw.peakProcessRSSBytes <= protocol.gate.peakProcessRSSBytes,
        );
        const scores = JSON.parse(
          gunzipSync(readFileSync(join(root, "results/" + source.id + ".json.scores.json.gz"))),
        );
        const prediction = patchOccupancy(
          scores,
          protocol.categories[category].providerClassIndex,
          curve.threshold,
          320000,
          protocol.patchMapping,
        );
        assert.deepEqual(prediction, retained.prediction);
        assert.deepEqual(source.referenceOccupancy[category], retained.reference);
        const counts = occupancyCounts(retained.reference, prediction);
        assert.deepEqual(counts, retained.counts);
        for (const key of Object.keys(totals)) totals[key] += counts[key];
      }
      assert.deepEqual(totals, curve.total);
      assert.equal(
        curve.precision,
        totals.tp + totals.fp ? totals.tp / (totals.tp + totals.fp) : null,
      );
      assert.equal(
        curve.recall,
        totals.tp + totals.fn ? totals.tp / (totals.tp + totals.fn) : null,
      );
      assert.equal(
        curve.passed,
        curve.precision !== null &&
          curve.recall !== null &&
          curve.precision >= protocol.gate.precision &&
          curve.recall >= protocol.gate.recall,
      );
    }
  }
}
const decision = read("threshold-decision.json");
assert.equal(decision.developmentReportSha256, hash("development-report.json"));
assert.equal(decision.protocolSha256, hash("frozen-protocol.json"));
assert.equal(decision.mappingSha256, hash("bins.mjs"));
assert.deepEqual(decision.selectedThresholds, { Clapping: 0.5 });
const confirmation = read("confirmation-report.json");
assert.deepEqual(Object.keys(confirmation.outcomes), ["Clapping"]);
assert.equal(
  confirmation.outcomes.Clapping.curve[0].threshold,
  decision.selectedThresholds.Clapping,
);
assert.equal(confirmation.outcomes.Clapping.passed, false);
console.log(
  JSON.stringify(
    {
      scope: "100ms namedcategoryoccupancy replay only",
      calls: 6,
      categorySelected: null,
      Laughter: "Failed development",
      Clapping: "Failed frozen confirmation",
      Applause: "Unsupported",
      Gasp: "Unsupported",
    },
    null,
    2,
  ),
);
