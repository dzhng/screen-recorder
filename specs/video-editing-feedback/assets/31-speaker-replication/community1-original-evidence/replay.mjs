// Replay native operands and unchanged mandatory gates; never infer or acquire.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = process.argv[2];
assert(repo, "Pass repository root");
const hash = (x) => createHash("sha256").update(x).digest("hex");
const json = (path) => JSON.parse(readFileSync(path));
for (const f of json(join(here, "operands.json")).files) {
  const bytes = readFileSync(join(here, f.path));
  assert.equal(bytes.length, f.bytes, f.path);
  assert.equal(hash(bytes), f.sha256, f.path);
}
const p = json(join(here, "protocol.json"));
const referencePath = join(repo, p.references.path.slice(p.references.path.indexOf("/specs/") + 1));
const referenceBytes = readFileSync(referencePath);
assert.equal(hash(referenceBytes), p.references.sha256);
const reference = JSON.parse(referenceBytes);
assert.deepEqual(p.gates, reference.gates);
assert.equal(hash(readFileSync(join(here, "worker.py"))), p.candidate.workerSha256);
assert.equal(
  hash(readFileSync(join(here, "dependency-inventory.json"))),
  p.runtime.dependencyInventorySha256,
);
const acquisition = json(join(here, "acquisition-protocol.json"));
assert.equal(
  hash(gunzipSync(readFileSync(join(here, "model-card.md.gz")))),
  acquisition.modelCardSha256,
);
const upstream = json(join(here, "upstream-metadata.json")),
  redistribution = json(join(here, "redistribution-metadata.json"));
assert.equal(upstream.sha, acquisition.upstream.revision);
assert.equal(redistribution.sha, acquisition.manifest.revision);
for (const f of acquisition.manifest.files) {
  const a = upstream.siblings.find((x) => x.rfilename === f.path),
    b = redistribution.siblings.find((x) => x.rfilename === f.path);
  assert.deepEqual(a, b);
  assert.equal(a.size, f.bytes);
  if (a.lfs) assert.equal(a.lfs.sha256, f.sha256);
}
const scorer = json(join(here, "../context-evidence/protocol.json")).scorer;
const scorerPath = join(repo, scorer.path);
assert.equal(hash(readFileSync(scorerPath)), scorer.sha256);
const { diarizationScore } = await import(pathToFileURL(scorerPath));
const refusal = json(join(here, "observations/bspxd30/stdout.json"));
assert.equal(refusal.ok, false);
assert.match(refusal.error.message, /Expecting property name/);
const transport = json(join(here, "observations/bspxd30/transport.json"));
assert.equal(transport.exitCode, 0);
assert.equal(transport.networkDenied, true);
const rawBytes = gunzipSync(
  readFileSync(join(here, "observations/bspxd30-repair1/bspxd30.json.gz")),
);
assert.deepEqual(
  rawBytes,
  gunzipSync(
    readFileSync(join(here, "observations/bspxd30-repair1/bspxd30.json.native-unverified.json.gz")),
  ),
);
const raw = JSON.parse(rawBytes),
  c = reference.cases.find((x) => x.id === raw.id);
assert.equal(raw.id, p.caseOrder[0]);
assert.equal(raw.sourceFrames, c.frames);
assert.equal(raw.pcmSha256, c.pcmSha256);
assert.equal(raw.sampleRate, 16000);
assert.equal(raw.audioSeconds, c.frames / 16000);
assert.deepEqual(raw.nativeConfig, {
  segmentation: { min_duration_off: 0 },
  clustering: { threshold: 0.6, Fa: 0.07, Fb: 0.8 },
});
const arrayBytes = (operand) => {
  assert(operand.shape.every((x) => Number.isInteger(x) && x >= 0));
  const width = { "<f4": 4, "<f8": 8, "|u1": 1 }[operand.dtype];
  assert(width, operand.dtype);
  const bytes = Buffer.from(operand.bytesBase64, "base64");
  assert.equal(bytes.length, operand.shape.reduce((a, b) => a * b, 1) * width);
  return bytes;
};
assert(raw.nativeForwardScores.length > 0);
for (const f of raw.nativeForwardScores) arrayBytes(f.output);
for (const x of raw.nativeHookOperands) arrayBytes(x.array);
arrayBytes(raw.speakerEmbeddings);
assert(raw.nativeHookOperands.some((x) => x.step === "segmentation"));
assert(raw.nativeHookOperands.some((x) => x.step === "embeddings"));
assert(raw.nativeHookOperands.some((x) => x.step === "discrete_diarization"));
for (const x of raw.segments)
  assert(
    Number.isFinite(x.start) &&
      Number.isFinite(x.end) &&
      0 <= x.start &&
      x.start < x.end &&
      x.end <= raw.audioSeconds,
  );
const metrics = diarizationScore(c.reference, raw.segments, raw.audioSeconds);
const points = [
  ...new Set([
    0,
    raw.audioSeconds,
    ...c.reference.flatMap((x) => [x.start, x.end]),
    ...raw.segments.flatMap((x) => [x.start, x.end]),
  ]),
].sort((a, b) => a - b);
const active = (intervals, t) =>
  new Set(
    intervals.filter((x) => x.start <= t && x.end > t && x.speaker !== null).map((x) => x.speaker),
  ).size;
let referenceOverlapSeconds = 0,
  retainedOverlapSeconds = 0;
for (let i = 1; i < points.length; i++) {
  const t = (points[i] + points[i - 1]) / 2;
  if (active(c.reference, t) < 2) continue;
  const dt = points[i] - points[i - 1];
  referenceOverlapSeconds += dt;
  if (active(raw.segments, t) >= 2) retainedOverlapSeconds += dt;
}
const overlapRecall = referenceOverlapSeconds
    ? retainedOverlapSeconds / referenceOverlapSeconds
    : null,
  confusionRatio = metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds;
const count = new Set(raw.segments.map((x) => x.speaker)).size,
  requiredCount = new Set(c.reference.map((x) => x.speaker)).size;
const gates = {
  der: metrics.der <= p.gates.everyCaseDERMaximum,
  identity: confusionRatio <= p.gates.globalIdentityConfusionRatioMaximum,
  overlap: overlapRecall === null || overlapRecall >= p.gates.overlapRecallMinimum,
  count: count === requiredCount,
  time: raw.inferenceSeconds <= raw.audioSeconds * p.gates.inferenceWallAudioRatioMaximum,
  rss: raw.peakProcessRSSBytes <= p.gates.RSSBytesMaximum,
};
const score = {
  id: raw.id,
  metrics,
  referenceOverlapSeconds,
  retainedOverlapSeconds,
  overlapRecall,
  confusionRatio,
  count,
  requiredCount,
  gates,
  passed: Object.values(gates).every(Boolean),
  inferenceSeconds: raw.inferenceSeconds,
  peakProcessRSSBytes: raw.peakProcessRSSBytes,
};
assert.deepEqual(score, json(join(here, "observations/bspxd30-repair1/score.json")));
const retained = json(join(here, "research-result.json"));
assert.deepEqual(retained.cases, [score]);
assert.equal(score.passed, false);
assert.equal(retained.promotion, false);
assert.equal(retained.nativeCalls, 1);
assert.equal(retained.preImportRefusals, 1);
assert.equal(retained.retries, 1);
console.log(
  JSON.stringify(
    {
      verified: true,
      coverage: "first short case only; mandatory stop after failure",
      promoted: false,
      passed: false,
      score,
    },
    null,
    2,
  ),
);
