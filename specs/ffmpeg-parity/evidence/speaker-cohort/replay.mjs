// Historical score replay only; no acquisition, model execution or writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { diarizationScore } from "../../../../packages/test-harness/speech/feasibility/score.mjs";
import { mapPaddedSource } from "../../../../packages/test-harness/speech/feasibility/source-clock.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => JSON.parse(readFileSync(join(root, path)));
const hash = (path) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");
const protocol = read("frozen-protocol.json");
const clock = read("clock-protocol.json");
const selection = read("selection.json");
assert.equal(clock.parentProtocolSha256, hash("frozen-protocol.json"));
assert.equal(read("admission.json").selectionSha256, hash("selection.json"));
const research = read("research.json");
const records = [];
for (const [provider, id] of [
  ["community", "bspxd"],
  ["sortformer", "bspxd"],
  ["sortformer", "ccokr"],
  ["sortformer", "cmfyw"],
]) {
  const source = selection.cases.find((row) => row.id === id);
  assert.equal(source.role, "development");
  const path = `results/${provider}-${id}`;
  assert.equal(
    hash(path + ".json"),
    research.attempts.find((row) => row.provider === provider && row.case === id).rawSha256,
  );
  const raw = read(path + ".json");
  const attempt = read(path + "-attempt.json");
  assert.equal(attempt.exitCode, 0);
  assert.equal(attempt.networkDenied, true);
  assert.equal(raw.audioSeconds, source.durationSeconds);
  if (provider === "community") {
    assert.throws(
      () => diarizationScore(source.reference, raw.segments, source.durationSeconds),
      /Invalid interval/,
    );
    const retained = read(path + "-mapped-score.json");
    assert.equal(retained.clockProtocolSha256, hash("clock-protocol.json"));
    assert.equal(retained.rawSha256, hash(path + ".json"));
    const mapping = mapPaddedSource(raw.segments, clock.observedExecution);
    assert.deepEqual(mapping, retained.mapping);
    assert.deepEqual(
      diarizationScore(source.reference, mapping.segments, mapping.sourceEnd),
      retained.metrics,
    );
    records.push(retained);
  } else {
    const retained = read(path + "-score.json");
    assert.deepEqual(
      diarizationScore(source.reference, raw.segments, source.durationSeconds),
      retained.metrics,
    );
    records.push(retained);
  }
}
for (const row of records) {
  assert.equal(row.passed, row.qualityPassed && row.resourcePassed && row.sourceSupportValid);
  assert.equal(row.qualityPassed, row.metrics.der <= protocol.gate.der);
  const raw = read(`results/${row.provider}-${row.id}.json`);
  assert.equal(
    row.resourcePassed,
    raw.inferenceSeconds <= raw.audioSeconds * protocol.gate.inferenceWallAudioRatio &&
      raw.peakProcessRSSBytes <= protocol.gate.peakProcessRSSBytes,
  );
}
assert.equal(records.find((row) => row.provider === "community").passed, false);
assert.equal(records.find((row) => row.id === "cmfyw").passed, false);
console.log(
  JSON.stringify(
    {
      scope: "Retained raw evidence replay only, no inference or product quality claim",
      records: records.map(({ provider, id, metrics, passed }) => ({
        provider,
        id,
        der: metrics.der,
        passed,
      })),
      confirmation: "Untouched and unscored",
      providerSelected: null,
    },
    null,
    2,
  ),
);
