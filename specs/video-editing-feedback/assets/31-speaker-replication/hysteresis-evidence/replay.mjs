// Read-only retained-score experiment/replay. No inference, acquisition or tuning.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { interpret } from "./interpret.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [repo, suppliedOperands, stage = "replay", calibrationPath] = process.argv.slice(2);
assert(repo, "Pass repository root for the existing scorer");
const operands = suppliedOperands ?? join(here, "../alternative-evidence");
assert(["calibration", "confirmation", "continuity", "long", "replay"].includes(stage), "Unknown stage");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (path) => JSON.parse(readFileSync(path));
const protocol = json(join(here, "protocol.json"));
const nativeProtocolBytes = readFileSync(join(operands, "nemotron-feasibility/protocol.json"));
assert.equal(hash(nativeProtocolBytes), protocol.parent.protocolSha256);
const nativeProtocol = JSON.parse(nativeProtocolBytes);
assert.deepEqual(nativeProtocol.gates, protocol.gates, "Unchanged mandatory gates");
const scorerPath = join(repo, protocol.evaluator.path);
assert.equal(hash(readFileSync(scorerPath)), protocol.evaluator.sha256);
const { diarizationScore } = await import(pathToFileURL(scorerPath));
const operandManifest = json(join(operands, "operands.json"));
const identity = {
  protocolSha256: hash(readFileSync(join(here, "protocol.json"))),
  interpreterSha256: hash(readFileSync(join(here, "interpret.mjs"))),
  evaluatorSha256: protocol.evaluator.sha256,
};
assert.equal(identity.interpreterSha256, protocol.candidate.interpreterSha256);

function load(id) {
  let c = nativeProtocol.cases.find((c) => c.id === id);
  let base = operands;
  let manifest = operandManifest;
  let folder = "nemotron-feasibility";
  if (!c) {
    const long = json(join(here, "long-protocol.json"));
    assert.deepEqual(long.candidateIdentity, identity);
    assert.deepEqual(long.gates, protocol.gates);
    const referenceBytes = readFileSync(join(repo, long.referenceProtocol.path));
    assert.equal(hash(referenceBytes), long.referenceProtocol.sha256);
    c = JSON.parse(referenceBytes).cases.find((c) => c.id === id);
    assert(long.caseOrder.includes(id));
    base = here;
    manifest = json(join(here, "long-operands.json"));
    folder = "long-observations";
  }
  assert(c, "Case must belong to frozen native protocol");
  const readOperand = (name) => {
    const bytes = readFileSync(join(base, name));
    const entry = manifest.files.find((f) => f.path === name);
    assert(entry, "Operand must belong to frozen manifest");
    assert.equal(bytes.length, entry.bytes);
    assert.equal(hash(bytes), entry.sha256, name);
    return JSON.parse(gunzipSync(bytes));
  };
  const raw = readOperand(`${folder}/${id}.json.gz`);
  const native = readOperand(`${folder}/${id}.json.native-unverified.json.gz`);
  assert.equal(raw.pcmSha256, c.pcmSha256);
  assert.equal(raw.sourceFrames, c.frames);
  assert.equal(raw.sampleRate, 16000);
  assert.equal(raw.audioSeconds, c.frames / raw.sampleRate);
  assert.equal(raw.frameSeconds, protocol.candidate.frameSeconds);
  assert.deepEqual(raw.config, protocol.parent.recipe);
  assert.deepEqual(raw.probabilityShape, [1, raw.nativeProbabilities.length, protocol.candidate.slots]);
  assert.equal(raw.nativeProbabilities.length * raw.frameSeconds, raw.audioSeconds);
  assert.deepEqual(native.shape, raw.probabilityShape);
  assert.equal(native.dtype, "<f4");
  assert.deepEqual(native.nativeSegmentLines, [raw.nativeSegmentLines]);
  const bytes = Buffer.from(native.bytesBase64, "base64");
  assert.equal(bytes.length, raw.nativeProbabilities.length * protocol.candidate.slots * 4);
  for (let frame = 0; frame < raw.nativeProbabilities.length; frame++) {
    const row = raw.nativeProbabilities[frame];
    assert.equal(row.length, protocol.candidate.slots);
    for (let slot = 0; slot < row.length; slot++) {
      assert(Number.isFinite(row[slot]) && row[slot] >= 0 && row[slot] <= 1);
      assert.equal(bytes.readFloatLE((frame * row.length + slot) * 4), row[slot]);
    }
  }
  assert.deepEqual(interpret(raw.nativeProbabilities, 0.5, 0.5), raw.segments, "Exact native parity");
  return { c, raw };
}

function overlap(reference, prediction, duration) {
  const points = [...new Set([0, duration, ...reference.flatMap((x) => [x.start, x.end]), ...prediction.flatMap((x) => [x.start, x.end])])].sort((a, b) => a - b);
  const active = (intervals, time) => new Set(intervals.filter((x) => x.start <= time && x.end > time && x.speaker !== null).map((x) => x.speaker)).size;
  let referenceSeconds = 0;
  let retainedSeconds = 0;
  for (let i = 1; i < points.length; i++) {
    const midpoint = (points[i] + points[i - 1]) / 2;
    if (active(reference, midpoint) < 2) continue;
    const dt = points[i] - points[i - 1];
    referenceSeconds += dt;
    if (active(prediction, midpoint) >= 2) retainedSeconds += dt;
  }
  return { referenceSeconds, retainedSeconds, recall: referenceSeconds ? retainedSeconds / referenceSeconds : null };
}

function evaluate(c, raw, onset, offset) {
  const began = performance.now();
  const segments = interpret(raw.nativeProbabilities, onset, offset);
  const interpretationSeconds = (performance.now() - began) / 1000;
  const metrics = diarizationScore(c.reference, segments, raw.audioSeconds);
  const ov = overlap(c.reference, segments, raw.audioSeconds);
  const confusionRatio = metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds;
  const observedSpeakerCount = new Set(segments.map((x) => x.speaker)).size;
  const requiredSpeakerCount = new Set(c.reference.map((x) => x.speaker)).size;
  const gates = {
    der: metrics.der <= protocol.gates.everyCaseDERMaximum,
    identity: confusionRatio <= protocol.gates.globalIdentityConfusionRatioMaximum,
    overlap: ov.recall === null || ov.recall >= protocol.gates.overlapRecallMinimum,
    count: observedSpeakerCount === requiredSpeakerCount,
    time: raw.inferenceSeconds + interpretationSeconds <= raw.audioSeconds * protocol.gates.inferenceWallAudioRatioMaximum,
    rss: raw.peakProcessRSSBytes <= protocol.gates.RSSBytesMaximum && process.resourceUsage().maxRSS * 1024 <= protocol.gates.RSSBytesMaximum,
  };
  return {
    result: { id: c.id, onset, offset, segments, metrics, overlap: ov, confusionRatio, observedSpeakerCount, requiredSpeakerCount, gates, passed: Object.values(gates).every(Boolean) },
    resources: { id: c.id, onset, offset, inheritedInferenceSeconds: raw.inferenceSeconds, inheritedInferencePeakProcessRSSBytes: raw.peakProcessRSSBytes, interpretationSeconds },
  };
}

function run(ids) {
  const cases = [];
  const resources = [];
  const identitySwapControls = [];
  const repetitionDiagnostics = [];
  for (const id of ids) {
    const { c, raw } = load(id);
    const parent = evaluate(c, raw, protocol.parent.onset, protocol.parent.offset);
    const candidate = evaluate(c, raw, protocol.candidate.onset, protocol.candidate.offset);
    cases.push({ parent: parent.result, candidate: candidate.result });
    resources.push(parent.resources, candidate.resources);
    if (id === "bspxd-unedited336") {
      const split = raw.audioSeconds / 2;
      const swapped = candidate.result.segments.flatMap((segment) => {
        const pieces = segment.start < split && segment.end > split
          ? [{ ...segment, end: split }, { ...segment, start: split }]
          : [segment];
        return pieces.map((piece) => piece.start < split ? piece : {
          ...piece,
          speaker: piece.speaker === "speaker_0" ? "speaker_1" : piece.speaker === "speaker_1" ? "speaker_0" : piece.speaker,
        });
      });
      const metrics = diarizationScore(c.reference, swapped, raw.audioSeconds);
      const confusionRatio = metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds;
      assert(confusionRatio > protocol.gates.globalIdentityConfusionRatioMaximum, "Global identity gate must detect planted halfway swap");
      assert.deepEqual(overlap(c.reference, swapped, raw.audioSeconds), candidate.result.overlap, "Control changes identity, never simultaneous support");
      identitySwapControls.push({ id, splitSeconds: split, swappedAfterSplit: ["speaker_0", "speaker_1"], metrics, confusionRatio, identityGatePassed: false });
    }
    if (id === "four-speaker600") {
      for (let start = 0; start < raw.audioSeconds; start += 30) {
        const clip = (intervals) => intervals
          .filter((x) => x.start < start + 30 && x.end > start)
          .map((x) => ({ ...x, start: Math.max(x.start, start) - start, end: Math.min(x.end, start + 30) - start }));
        repetitionDiagnostics.push({
          startSeconds: start,
          parent: overlap(clip(c.reference), clip(parent.result.segments), 30),
          candidate: overlap(clip(c.reference), clip(candidate.result.segments), 30),
        });
      }
    }
  }
  return { identity, passed: cases.every((x) => x.candidate.passed), cases, identitySwapControls, repetitionDiagnostics, resources, evaluatorPeakProcessRSSBytes: process.resourceUsage().maxRSS * 1024 };
}

let output;
if (stage === "calibration") {
  output = run(protocol.calibrationCases);
} else if (stage === "confirmation") {
  assert(calibrationPath, "Pass frozen successful calibration result before confirmation");
  const calibration = json(calibrationPath);
  assert.deepEqual(calibration.identity, identity, "Candidate changed after calibration");
  assert(calibration.passed, "No confirmation follows a failed calibration");
  const reproduced = run(protocol.calibrationCases);
  assert.deepEqual(reproduced.cases, calibration.cases);
  output = run(protocol.confirmationCases);
} else if (stage === "continuity") {
  const short = json(join(here, "results.json"));
  for (const prior of [short.calibration, short.confirmation]) {
    assert.deepEqual(prior.identity, identity, "Candidate changed after short gates");
    assert(prior.passed, "Continuity requires every short gate passing");
  }
  output = run(protocol.regressionIfShortPasses);
} else if (stage === "long") {
  const short = json(join(here, "results.json"));
  for (const prior of [short.calibration, short.confirmation, short.continuity]) {
    assert.deepEqual(prior.identity, identity);
    assert(prior.passed, "Long expansion requires every preceding gate passing");
  }
  const long = json(join(here, "long-protocol.json"));
  const index = long.caseOrder.indexOf(calibrationPath);
  assert(index >= 0, "Supply one preregistered long case ID");
  if (index > 0) {
    const prior = json(join(here, "long-results.json"));
    for (const id of long.caseOrder.slice(0, index)) {
      const result = prior.cases.find((x) => x.candidate.id === id);
      assert(result?.candidate.passed, "No expansion follows a failed long gate");
    }
  }
  output = run([calibrationPath]);
} else {
  const retained = json(join(here, "results.json"));
  const calibration = run(protocol.calibrationCases);
  assert.deepEqual(calibration.identity, retained.calibration.identity);
  assert.deepEqual(calibration.cases, retained.calibration.cases);
  assert.equal(calibration.passed, retained.calibration.passed);
  const confirmation = calibration.passed ? run(protocol.confirmationCases) : null;
  assert.deepEqual(confirmation?.cases ?? null, retained.confirmation?.cases ?? null);
  assert.equal(confirmation?.passed ?? null, retained.confirmation?.passed ?? null);
  const continuity = confirmation?.passed ? run(protocol.regressionIfShortPasses) : null;
  assert.deepEqual(continuity?.cases ?? null, retained.continuity?.cases ?? null);
  assert.equal(continuity?.passed ?? null, retained.continuity?.passed ?? null);
  const long = json(join(here, "long-results.json"));
  const longReplay = run(long.cases.map((x) => x.candidate.id));
  assert.deepEqual(longReplay.identity, long.identity);
  assert.deepEqual(longReplay.cases, long.cases);
  assert.deepEqual(longReplay.identitySwapControls, long.identitySwapControls);
  assert.deepEqual(longReplay.repetitionDiagnostics, long.repetitionDiagnostics);
  assert.equal(longReplay.passed, long.passed);
  output = { verified: true, slice31Complete: false, promoted: false, calibration: calibration.cases, confirmation: confirmation?.cases ?? null, continuity: continuity?.cases ?? null, long: longReplay.cases };
}
console.log(JSON.stringify(output, null, 2));
