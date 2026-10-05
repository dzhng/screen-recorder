// Historical original-checkpoint replay only; no models, acquisition or writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { diarizationScore } from "../../../../packages/test-harness/speech/feasibility/score.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p)));
const hash = (p) =>
  createHash("sha256")
    .update(readFileSync(join(root, p)))
    .digest("hex");
const protocol = read("frozen-protocol.json");
const research = read("research.json");
const selection = read("../speaker-cohort/selection.json");
const audit = read("../speaker-cohort/input-audit.json");
assert.equal(hash("../speaker-cohort/selection.json"), protocol.selectionSha256);
assert.equal(hash("runner.py"), protocol.runtime.wrapperSha256);
assert.equal(hash("environment.txt"), protocol.runtime.environmentSha256);
assert.equal(hash("model-card.md"), protocol.model.cardSha256);
assert.equal(
  createHash("sha256")
    .update(gunzipSync(readFileSync(join(root, "license-page.html.gz"))))
    .digest("hex"),
  protocol.model.licensePageSha256,
);
const acquisition = read("acquisition.json");
assert.equal(acquisition.protocolSha256, hash("frozen-protocol.json"));
assert.equal(acquisition.sha256, protocol.model.sha256);
assert.equal(acquisition.bytes, protocol.model.bytes);
for (const operand of read("operands.json").files) assert.equal(hash(operand.path), operand.sha256);
const rows = [];
for (const source of selection.cases) {
  const id = source.id;
  const raw = read(id + ".json");
  const score = read(id + "-score.json");
  const attempt = read(id + "-attempt.json");
  assert.equal(raw.modelSha256, protocol.model.sha256);
  assert.equal(raw.pcmSha256, audit.cases.find((c) => c.id === id).preparedFloatSha256);
  assert.equal(score.rawSha256, hash(id + ".json"));
  assert.equal(score.protocolSha256, hash("frozen-protocol.json"));
  assert.equal(attempt.protocolSha256, score.protocolSha256);
  assert.equal(attempt.sourceSha256, raw.pcmSha256);
  assert.equal(attempt.exitCode, 0);
  assert.equal(attempt.timedOut, false);
  assert.equal(attempt.networkDenied, true);
  assert.deepEqual(
    raw.config,
    Object.fromEntries(Object.keys(raw.config).map((k) => [k, protocol.config[k]])),
  );
  assert.deepEqual(raw.postprocessing, protocol.config.postprocessing);
  assert.equal(raw.sourceFrames, 480000);
  assert.equal(raw.sampleRate, 16000);
  assert.equal(raw.audioSeconds, 30);
  assert.equal(raw.frameSeconds, 0.08);
  assert.deepEqual(raw.probabilityShape, [375, 4]);
  assert.equal(raw.nativeProbabilities.length, 375);
  assert(
    raw.nativeProbabilities.every(
      (r) => r.length === 4 && r.every((v) => Number.isFinite(v) && v >= 0 && v <= 1),
    ),
  );
  assert(raw.segments.every((s) => s.start >= 0 && s.end > s.start && s.end <= 30));
  const metrics = diarizationScore(source.reference, raw.segments, 30);
  assert.deepEqual(metrics, score.metrics);
  assert.equal(score.qualityPassed, metrics.der <= protocol.gate.der);
  assert.equal(
    score.resourcePassed,
    raw.inferenceSeconds <= raw.audioSeconds * protocol.gate.inferenceWallAudioRatio &&
      raw.peakProcessRSSBytes <= protocol.gate.peakProcessRSSBytes,
  );
  assert.equal(score.sourceSupportValid, true);
  assert.equal(
    score.passed,
    score.qualityPassed && score.resourcePassed && score.sourceSupportValid,
  );
  assert.equal(score.passed, true);
  rows.push(score);
}
assert.deepEqual(rows, research.cases);
assert.equal(rows.length, research.calls);
for (const role of ["development", "confirmation"]) {
  const phase = rows.filter((r) => r.role === role);
  assert.equal(phase.length, 3);
  const retained = research.phases[role];
  const keys = [
    "referenceSpeakerSeconds",
    "missedSpeakerSeconds",
    "falseSpeakerSeconds",
    "confusedSpeakerSeconds",
  ];
  const pooled = Object.fromEntries(
    keys.map((k) => [k, phase.reduce((s, r) => s + r.metrics[k], 0)]),
  );
  pooled.der = keys.slice(1).reduce((s, k) => s + pooled[k], 0) / pooled.referenceSpeakerSeconds;
  assert.deepEqual(pooled, retained.pooled);
  assert.equal(
    retained.everyCasePassed,
    phase.every((r) => r.passed),
  );
  assert.equal(retained.passed, retained.everyCasePassed && pooled.der <= protocol.gate.der);
  assert.equal(retained.passed, true);
}
console.log(
  JSON.stringify(
    {
      calls: rows.length,
      developmentDER: research.phases.development.pooled.der,
      confirmationDER: research.phases.confirmation.pooled.der,
      scope: "Historical bounded original recipe only; no production runtime selection",
    },
    null,
    2,
  ),
);
