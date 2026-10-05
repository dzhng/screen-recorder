// One frozen research attempt; writes fresh score, never mutates raw output.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { diarizationScore } from "../../../../../packages/test-harness/speech/feasibility/score.mjs";
import { mapPaddedSource } from "../../../../../packages/test-harness/speech/feasibility/source-clock.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => JSON.parse(readFileSync(join(root, path)));
const [recipeId, id] = process.argv.slice(2);
const protocol = read("frozen-protocol.json");
const recipe = protocol.recipes.find((row) => row.id === recipeId);
const selected = read("../speaker-cohort/selection.json").cases.find((row) => row.id === id);
const source = read("../speaker-cohort/input-audit.json").cases.find((row) => row.id === id);
const prefix = `results/${recipeId}-${id}`;
const bytes = readFileSync(join(root, prefix + ".json"));
const raw = JSON.parse(bytes);
assert.deepEqual(raw.config, { ...recipe.config, exclusiveSegments: false });
assert.equal(raw.audioSeconds, source.frames / source.sampleRate);
assert.equal(raw.sampleRate, source.sampleRate);
const dimensions = {
  sourceFrameCount: source.frames,
  sampleRate: source.sampleRate,
  windowSamples: 160000,
  stepSamples: Math.round(160000 * recipe.config.segmentationStepRatio),
  outputFramesPerWindow: 589,
};
const nativeLog = readFileSync(join(root, prefix + ".log"), "utf8");
assert(
  nativeLog.includes(
    `chunkSize=${dimensions.windowSamples}, stepSize=${dimensions.stepSamples}, totalSamples=${dimensions.sourceFrameCount}`,
  ),
);
assert(nativeLog.includes("weights[1×589]"));
const mapping = mapPaddedSource(raw.segments, dimensions);
const metrics = diarizationScore(selected.reference, mapping.segments, mapping.sourceEnd);
const qualityPassed = metrics.der <= protocol.gate.der;
const resourcePassed =
  raw.inferenceSeconds <= raw.audioSeconds * protocol.gate.inferenceWallAudioRatio &&
  raw.peakProcessRSSBytes <= protocol.gate.peakProcessRSSBytes;
const score = {
  recipe: recipeId,
  id,
  role: selected.role,
  protocolSha256: createHash("sha256")
    .update(readFileSync(join(root, "frozen-protocol.json")))
    .digest("hex"),
  rawSha256: createHash("sha256").update(bytes).digest("hex"),
  sourcePreparedSha256: source.preparedFloatSha256,
  dimensions,
  mapping,
  metrics,
  qualityPassed,
  resourcePassed,
  sourceSupportValid: true,
  passed: qualityPassed && resourcePassed,
};
writeFileSync(join(root, prefix + "-score.json"), JSON.stringify(score, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    recipe: recipeId,
    id,
    der: metrics.der,
    miss: metrics.missedSpeakerSeconds,
    false: metrics.falseSpeakerSeconds,
    confusion: metrics.confusedSpeakerSeconds,
    passed: score.passed,
  }),
);
