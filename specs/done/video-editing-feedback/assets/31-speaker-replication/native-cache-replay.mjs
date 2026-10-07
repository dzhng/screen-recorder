// Frozen native-state comparison; labels enter only the existing quality scorer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { interpret } from "./hysteresis-evidence/interpret.mjs";

const [repo, suppliedParent, here, requestedCase] = process.argv.slice(2);
assert(here, "Pass the configuration evidence folder");
assert(repo, "Pass repository root, hydrated parent operands, and optional case ID");
const parentRoot = suppliedParent ?? join(here, "../alternative-evidence");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const json = (path) => JSON.parse(readFileSync(path));
const p = json(join(here, "protocol.json"));
const referenceBytes = readFileSync(join(repo, p.references.path));
assert.equal(hash(referenceBytes), p.references.sha256);
const reference = JSON.parse(referenceBytes);
assert.deepEqual(p.gates, reference.gates);
assert.equal(hash(readFileSync(join(here, p.interpreter.path))), p.interpreter.sha256);
assert.equal(hash(readFileSync(join(here, "worker.py"))), p.workerSha256);
assert.equal(hash(readFileSync(join(repo, p.scorer.path))), p.scorer.sha256);
const { diarizationScore } = await import(pathToFileURL(join(repo, p.scorer.path)));

function operandBytes(base, expected) {
  const bytes = readFileSync(join(base, expected.path));
  assert.equal(bytes.length, expected.bytes, `Retained operand integrity: ${expected.path}`);
  assert.equal(hash(bytes), expected.sha256, `Retained operand integrity: ${expected.path}`);
  return bytes;
}

function load(base, folder, id, recipe) {
  const manifest = json(join(base, "operands.json"));
  const read = (name) => {
    const expected = manifest.files.find((x) => x.path === name);
    assert(expected);
    return JSON.parse(gunzipSync(operandBytes(base, expected)));
  };
  const raw = read(`${folder}/${id}.json.gz`);
  const native = read(`${folder}/${id}.json.native-unverified.json.gz`);
  const c = reference.cases.find((x) => x.id === id);
  assert.equal(raw.sourceFrames, c.frames);
  assert.equal(raw.pcmSha256, c.pcmSha256);
  assert.equal(raw.sampleRate, 16000);
  assert.equal(raw.audioSeconds, raw.sourceFrames / 16000);
  assert.equal(raw.frameSeconds, 0.01);
  assert.deepEqual(raw.config, recipe);
  assert.deepEqual(raw.probabilityShape, [1, raw.audioSeconds * 100, 8]);
  assert.deepEqual(native.shape, raw.probabilityShape);
  assert.equal(native.dtype, "<f4");
  assert.deepEqual(native.nativeSegmentLines, [raw.nativeSegmentLines]);
  const bytes = Buffer.from(native.bytesBase64, "base64");
  assert.equal(bytes.length, raw.audioSeconds * 100 * 8 * 4);
  assert.equal(raw.nativeProbabilities.length, raw.audioSeconds * 100);
  for (let frame = 0; frame < raw.nativeProbabilities.length; frame++) {
    assert.equal(raw.nativeProbabilities[frame].length, 8);
    for (let slot = 0; slot < 8; slot++) {
      const value = raw.nativeProbabilities[frame][slot];
      assert(Number.isFinite(value) && value >= 0 && value <= 1);
      assert.equal(value, bytes.readFloatLE((frame * 8 + slot) * 4));
    }
  }
  assert.deepEqual(interpret(raw.nativeProbabilities, 0.5, 0.5), raw.segments);
  return { raw, bytes };
}

function evaluate(c, raw) {
  const began = performance.now();
  const turns = interpret(raw.nativeProbabilities, p.candidate.onset, p.candidate.offset);
  const interpretationSeconds = (performance.now() - began) / 1000;
  const metrics = diarizationScore(c.reference, turns, raw.audioSeconds);
  const points = [...new Set([0, raw.audioSeconds, ...c.reference.flatMap((x) => [x.start, x.end]), ...turns.flatMap((x) => [x.start, x.end])])].sort((a, b) => a - b);
  const active = (intervals, time) => new Set(intervals.filter((x) => x.start <= time && x.end > time && x.speaker !== null).map((x) => x.speaker)).size;
  let referenceOverlapSeconds = 0;
  let retainedOverlapSeconds = 0;
  for (let i = 1; i < points.length; i++) {
    const midpoint = (points[i] + points[i - 1]) / 2;
    if (active(c.reference, midpoint) < 2) continue;
    const dt = points[i] - points[i - 1];
    referenceOverlapSeconds += dt;
    if (active(turns, midpoint) >= 2) retainedOverlapSeconds += dt;
  }
  const overlapRecall = referenceOverlapSeconds ? retainedOverlapSeconds / referenceOverlapSeconds : null;
  const confusionRatio = metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds;
  const count = new Set(turns.map((x) => x.speaker)).size;
  const requiredCount = new Set(c.reference.map((x) => x.speaker)).size;
  const gates = {
    der: metrics.der <= p.gates.everyCaseDERMaximum,
    identity: confusionRatio <= p.gates.globalIdentityConfusionRatioMaximum,
    overlap: overlapRecall === null || overlapRecall >= p.gates.overlapRecallMinimum,
    count: count === requiredCount,
    time: raw.inferenceSeconds + interpretationSeconds <= raw.audioSeconds * p.gates.inferenceWallAudioRatioMaximum,
    rss: raw.peakProcessRSSBytes <= p.gates.RSSBytesMaximum && process.resourceUsage().maxRSS * 1024 <= p.gates.RSSBytesMaximum,
  };
  return {
    result: { metrics, referenceOverlapSeconds, retainedOverlapSeconds, overlapRecall, confusionRatio, count, requiredCount, turnsSha256: hash(JSON.stringify(turns)), gates, passed: Object.values(gates).every(Boolean) },
    resources: { inferenceSeconds: raw.inferenceSeconds, inferencePeakProcessRSSBytes: raw.peakProcessRSSBytes, interpretationSeconds },
  };
}

const retained = requestedCase ? null : json(join(here, "results.json"));
if (retained) {
  const failedIndex = retained.cases.findIndex((x) => !x.candidate.passed);
  const requiredIds = failedIndex < 0 ? p.caseOrder : p.caseOrder.slice(0, failedIndex + 1);
  assert.deepEqual(retained.cases.map((x) => x.id), requiredIds, "Required protocol case coverage and stop-at-first-failure order");
}
const ids = requestedCase ? [requestedCase] : retained.cases.map((x) => x.id);
const manifest = json(join(here, "operands.json"));
const receiptSuffixes = ["json.gz", "json.native-unverified.json.gz", "request.json", "stderr.log.gz", "stdout.json", "transport.json"];
const bundleIds = retained ? ids : p.caseOrder.filter((id) => manifest.files.some((x) => x.path === `observations/${id}.json.gz`));
assert.deepEqual(manifest.files.map((x) => x.path).sort(), bundleIds.flatMap((id) => receiptSuffixes.map((suffix) => `observations/${id}.${suffix}`)).sort(), "Complete retained observation and receipt manifest");
for (const entry of manifest.files) operandBytes(here, entry);
const cases = [];
const resources = [];
for (const id of ids) {
  assert(p.caseOrder.includes(id));
  const c = reference.cases.find((x) => x.id === id);
  const parent = load(parentRoot, "nemotron-feasibility", id, reference.recipe);
  const candidate = load(here, "observations", id, p.candidate.recipe);
  assert.equal(candidate.raw.asyncStreaming, p.candidate.asyncStreaming);
  const a = evaluate(c, parent.raw), b = evaluate(c, candidate.raw);
  let maximumAbsoluteScoreChange = 0;
  for (let index = 0; index < parent.bytes.length; index += 4)
    maximumAbsoluteScoreChange = Math.max(maximumAbsoluteScoreChange, Math.abs(parent.bytes.readFloatLE(index) - candidate.bytes.readFloatLE(index)));
  cases.push({ id, parent: a.result, candidate: b.result, exactRawFloat32Parity: parent.bytes.equals(candidate.bytes), maximumAbsoluteScoreChange, exactInterpretedTurnParity: a.result.turnsSha256 === b.result.turnsSha256 });
  resources.push({ id, parent: a.resources, candidate: b.resources });
}
if (retained) {
  assert.deepEqual(cases, retained.cases);
  const deterministic = (entries) => entries.map(({ id, parent, candidate }) => ({
    id,
    parent: { inferenceSeconds: parent.inferenceSeconds, inferencePeakProcessRSSBytes: parent.inferencePeakProcessRSSBytes },
    candidate: { inferenceSeconds: candidate.inferenceSeconds, inferencePeakProcessRSSBytes: candidate.inferencePeakProcessRSSBytes },
  }));
  assert.deepEqual(deterministic(resources), deterministic(retained.resources), "Retained deterministic resource measurements");
}
console.log(JSON.stringify({ verified: true, promoted: false, passed: cases.every((x) => x.candidate.passed), cases, resources }, null, 2));
