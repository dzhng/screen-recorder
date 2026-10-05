// Historical score replay: no models, acquisition or writes.
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
const research = read("research.json");
assert.equal(hash("frozen-protocol.json"), research.protocolSha256);
assert.equal(hash(protocol.selection), protocol.selectionSha256);
assert.equal(hash(protocol.parent), protocol.parentSha256);
assert.equal(hash(protocol.sourceClockProtocol), protocol.sourceClockProtocolSha256);
assert.equal(hash(protocol.provider.wrapper), protocol.provider.wrapperSha256);
const selection = read(protocol.selection);
const audit = read("../speaker-cohort/input-audit.json");
const reports = [];
for (const attempt of research.attempts) {
  assert.equal(hash(attempt.raw), attempt.rawSha256);
  const raw = read(attempt.raw);
  const command = read(attempt.attempt);
  assert.equal(command.exitCode, 0);
  assert.equal(command.networkDenied, true);
  assert.equal(command.protocolSha256, research.protocolSha256);
  assert.equal(command.binarySha256, protocol.provider.binarySha256);
  const recipe = protocol.recipes.find((row) => row.id === attempt.recipe);
  const source = audit.cases.find((row) => row.id === attempt.id);
  assert.equal(command.sourcePreparedSha256, source.preparedFloatSha256);
  assert.deepEqual(raw.config, { ...recipe.config, exclusiveSegments: false });
  if (attempt.recipe === "control") {
    assert.deepEqual(raw.segments, read("../speaker-cohort/results/community-bspxd.json").segments);
    continue;
  }
  const retained = read(attempt.raw.replace(".json", "-score.json"));
  assert.equal(retained.rawSha256, attempt.rawSha256);
  assert.equal(retained.protocolSha256, research.protocolSha256);
  assert.equal(retained.sourcePreparedSha256, source.preparedFloatSha256);
  assert.equal(retained.role, "development");
  const dimensions = {
    sourceFrameCount: source.frames,
    sampleRate: source.sampleRate,
    windowSamples: 160000,
    stepSamples: Math.round(160000 * recipe.config.segmentationStepRatio),
    outputFramesPerWindow: 589,
  };
  assert.deepEqual(retained.dimensions, dimensions);
  const mapping = mapPaddedSource(raw.segments, dimensions);
  assert.deepEqual(mapping, retained.mapping);
  assert.deepEqual(
    diarizationScore(
      selection.cases.find((row) => row.id === attempt.id).reference,
      mapping.segments,
      mapping.sourceEnd,
    ),
    retained.metrics,
  );
  assert.equal(retained.qualityPassed, retained.metrics.der <= protocol.gate.der);
  assert.equal(
    retained.resourcePassed,
    raw.inferenceSeconds <= raw.audioSeconds * protocol.gate.inferenceWallAudioRatio &&
      raw.peakProcessRSSBytes <= protocol.gate.peakProcessRSSBytes,
  );
  assert.equal(
    retained.passed,
    retained.qualityPassed && retained.resourcePassed && retained.sourceSupportValid,
  );
  reports.push(retained);
}
for (const recipe of protocol.recipes.filter((row) => row.id !== "control")) {
  const scores = reports.filter((row) => row.recipe === recipe.id);
  assert.equal(scores.length, 3);
  assert.equal(
    scores.every((row) => row.passed),
    false,
  );
}
assert.equal(
  reports.some((row) => row.role === "confirmation"),
  false,
);
assert.equal(read("results/development-decision.json").selectedRecipe, null);
console.log(
  JSON.stringify(
    {
      scope: "Retained evidence replay; no runtime/model validation or inference",
      modelCalls: research.attempts.length,
      recipeSelected: null,
      confirmation: "Untouched",
    },
    null,
    2,
  ),
);
