import assert from "node:assert/strict";
import test from "node:test";
import { dialogueProposals } from "../skills/yap/scripts/dialogue-proposals.mjs";
const evidence = (clipId, integratedLufs, truePeakDbtp) => ({
  kind: "loudness",
  domain: "project",
  projectId: "project",
  revisionId: "revision",
  tap: { target: { kind: "clip", id: clipId }, point: { kind: "processed" } },
  range: { startUs: 0, endUs: 8000000 },
  sampleRange: { start: 0, end: 384000 },
  sampleRate: 48000,
  channels: 2,
  unavailable: [{ clipId, ranges: [] }],
  audio: { jobId: `audio-${clipId}`, generation: 1 },
  generation: 1,
  signalRecipe: {
    sha256: "a".repeat(64),
    preparedResourceId: null,
    processingSha256: "b".repeat(64),
  },
  implementationId: "meter",
  truePeak: true,
  channelInterpretation: "native",
  scope: "excerpt",
  measurement: {
    integratedLufs,
    truePeakDbtp,
    integratedReason: null,
    rangeReason: null,
    loudnessRangeLu: 3,
    samplePeakDbfs: truePeakDbtp - 0.1,
    algorithm: "meter",
    version: "1",
  },
});
const request = () => ({
  projectId: "project",
  revisionId: "revision",
  targetIntegratedLufs: -20,
  gainBounds: { minimumDb: -12, maximumDb: 12 },
  truePeakCeilingDbtp: -2,
  peakPolicy: "refuse",
  minimumDurationUs: 400000,
  clips: [
    { clipId: "quiet", evidence: evidence("quiet", -25, -12) },
    { clipId: "loud", evidence: evidence("loud", -17, -4) },
  ],
});
test("explicit occurrence matching proposes independent gains and preserves exact evidence pins", () => {
  const input = request(),
    before = structuredClone(input);
  const result = dialogueProposals(input);
  assert.equal(result.proposals[0].gainDb, 5);
  assert.equal(result.proposals[1].gainDb, -3);
  assert.equal(result.proposals[0].gainStep.processor.gain, 10 ** (5 / 20));
  assert.equal(result.proposals[1].gainStep.processor.gain, 10 ** (-3 / 20));
  assert.equal(result.proposals[0].predictedIntegratedLufs, -20);
  assert.equal(result.proposals[1].predictedIntegratedLufs, -20);
  assert.deepEqual(result.proposals[0].pin.range, input.clips[0].evidence.range);
  assert.deepEqual(result.proposals[0].pin.audio, input.clips[0].evidence.audio);
  assert.deepEqual(input, before);
});
test("silent, short and missing-support selections report exceptions without gain drafts", () => {
  const input = request();
  input.clips = [
    { clipId: "silent", evidence: evidence("silent", null, -Infinity) },
    { clipId: "short", evidence: evidence("short", -25, -12) },
    { clipId: "gap", evidence: evidence("gap", -25, -12) },
  ];
  input.clips[0].evidence.measurement.integratedReason = "below-gate";
  input.clips[0].evidence.measurement.truePeakDbtp = null;
  input.clips[1].evidence.sampleRange.end = 4800;
  input.clips[1].evidence.range.endUs = 100000;
  input.clips[2].evidence.unavailable = [{ clipId: "gap", ranges: [{ start: 0, end: 200 }] }];
  const result = dialogueProposals(input);
  assert.deepEqual(
    result.proposals.map((p) => p.reason),
    ["UNMEASURABLE", "TOO_SHORT", "MISSING_SUPPORT"],
  );
  for (const p of result.proposals) {
    assert.equal(p.status, "refused");
    assert.equal(p.gainStep, null);
    assert.equal(p.gainDb, null);
  }
  assert.equal(result.proposals[0].before.integratedReason, "below-gate");
});
test("explicit bounds refuse and peak policy caps gain truthfully without a hidden limiter", () => {
  const input = request();
  input.clips[0].evidence.measurement.truePeakDbtp = -3;
  let quiet = dialogueProposals(input).proposals[0];
  assert.equal(quiet.reason, "PEAK_CEILING");
  assert.equal(quiet.gainStep, null);
  input.peakPolicy = "cap-gain";
  quiet = dialogueProposals(input).proposals[0];
  assert.equal(quiet.status, "constrained");
  assert.equal(quiet.gainDb, 1);
  assert.equal(quiet.predictedTruePeakDbtp, -2);
  assert.equal(quiet.predictedIntegratedLufs, -24);
  assert.equal(quiet.targetMet, false);
  assert.deepEqual(quiet.gainStep, {
    enabled: true,
    processor: { type: "gain", gain: 10 ** (1 / 20) },
  });
  input.clips[0].evidence.measurement.truePeakDbtp = -12;
  input.gainBounds.maximumDb = 3;
  quiet = dialogueProposals(input).proposals[0];
  assert.equal(quiet.reason, "GAIN_BOUNDS");
  assert.equal(quiet.gainStep, null);
});
test("foreign revisions, dry taps and duplicate occurrences cannot become edit proposals", () => {
  for (const mutate of [
    (r) => {
      r.clips[0].evidence.revisionId = "stale";
    },
    (r) => {
      r.clips[0].evidence.tap.point.kind = "dry";
    },
    (r) => {
      r.clips[0].evidence.tap.target.id = "other-occurrence";
    },
    (r) => {
      r.clips[0].evidence.truePeak = false;
    },
    (r) => {
      r.clips.push(structuredClone(r.clips[0]));
    },
    (r) => {
      r.peakPolicy = "normalize";
    },
    (r) => {
      r.gainBounds.maximumDb = Infinity;
    },
    (r) => {
      delete r.clips[0].evidence.audio;
    },
  ]) {
    const input = request();
    mutate(input);
    assert.throws(
      () => dialogueProposals(input),
      (e) => e.code === "INVALID_REQUEST",
    );
  }
});
test("retimed and repeated source occurrences preserve their independent measurement grids", () => {
  const input = request();
  const repeated = structuredClone(input.clips[0]);
  repeated.clipId = "quiet-again";
  repeated.evidence.tap.target.id = repeated.clipId;
  repeated.evidence.audio.jobId = "audio-quiet-again";
  repeated.evidence.range = {
    startUs: { numerator: 1000000, denominator: 3 },
    endUs: { numerator: 13000000, denominator: 3 },
  };
  repeated.evidence.sampleRate = 44100;
  repeated.evidence.sampleRange = { start: 14700, end: 191100 };
  input.clips.push(repeated);
  const result = dialogueProposals(input);
  assert.equal(result.proposals[2].gainDb, 5);
  assert.deepEqual(result.proposals[2].pin.range, repeated.evidence.range);
  assert.deepEqual(result.proposals[2].pin.sampleRange, repeated.evidence.sampleRange);
  assert.equal(result.proposals[2].pin.sampleRate, 44100);
  assert.notEqual(result.proposals[2].pin.audio.jobId, result.proposals[0].pin.audio.jobId);
});
test("standalone helper exposes structured refusals and never emits unbounded gain drafts", async () => {
  const { spawnSync } = await import("node:child_process");
  const input = request();
  input.targetIntegratedLufs = 10000;
  input.gainBounds.maximumDb = 10050;
  input.truePeakCeilingDbtp = 10050;
  const result = spawnSync(process.execPath, ["skills/yap/scripts/dialogue-proposals.mjs"], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.proposals[0].reason, "GAIN_UNREPRESENTABLE");
  assert.equal(response.proposals[0].gainStep, null);
  input.peakPolicy = "automatic";
  const invalid = spawnSync(process.execPath, ["skills/yap/scripts/dialogue-proposals.mjs"], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stderr).error.code, "INVALID_REQUEST");
});
test("new gain drafts omit engine-owned step IDs for ordinary processing.set admission", () => {
  const input = request();
  const response = dialogueProposals(input);
  assert.deepEqual(response.proposals[0].gainStep, {
    enabled: true,
    processor: { type: "gain", gain: 10 ** (5 / 20) },
  });
});
