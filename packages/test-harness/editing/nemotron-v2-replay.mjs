import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { diarizationScore } from "../speech/feasibility/score.mjs";

const PROTOCOL_SHA256 = "bb1db7ee30b51eb0ad57e24c4e5962a569b387e57dd8b4fa21a0c5a3abb54bd6";
const MODEL_SHA256 = "b371afce2c4958186469df33d939936b9746c89f38b10a69cfd2c61254e83329";
const WORKER_SHA256 = "431b2530551783e2a84a21064f5808d0aad55fe442687ad20217e9f77858bba6";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (bytes) => JSON.parse(bytes);

function overlap(ref, pred, duration) {
  const points = [...new Set([0, duration, ...ref.flatMap((x) => [x.start, x.end]), ...pred.flatMap((x) => [x.start, x.end])])].sort(
    (a, b) => a - b,
  );
  let total = 0;
  let retained = 0;
  for (let i = 1; i < points.length; i += 1) {
    const mid = (points[i] + points[i - 1]) / 2;
    if (new Set(ref.filter((x) => x.start <= mid && x.end > mid).map((x) => x.speaker)).size < 2) continue;
    const duration = points[i] - points[i - 1];
    total += duration;
    if (new Set(pred.filter((x) => x.start <= mid && x.end > mid).map((x) => x.speaker)).size >= 2)
      retained += duration;
  }
  return { referenceOverlapSeconds: total, retainedOverlapSeconds: retained, recall: total ? retained / total : null };
}

function decodeNative(native) {
  assert.equal(native.verified, false);
  assert.equal(native.nativeTensors.length, 1);
  const tensor = native.nativeTensors[0];
  assert.equal(tensor.dtype, "<f4");
  assert.equal(tensor.shape.length, 3);
  assert.equal(tensor.shape[0], 1);
  const bytes = Buffer.from(tensor.bytesBase64, "base64");
  assert.equal(bytes.length, tensor.shape[1] * tensor.shape[2] * 4);
  const scores = [];
  for (let row = 0; row < tensor.shape[1]; row += 1) {
    scores.push(Array.from({ length: tensor.shape[2] }, (_, column) => bytes.readFloatLE((row * tensor.shape[2] + column) * 4)));
  }
  return { scores, shape: [tensor.shape[1], tensor.shape[2]] };
}

/** Replays the v2 short-first refusal without model loading, acquisition, or inference. */
export async function replayNemotronV2(receiptPath) {
  const protocolBytes = await readFile(resolve(receiptPath));
  assert.equal(digest(protocolBytes), PROTOCOL_SHA256, "Nemotron v2 protocol identity changed");
  const protocol = readJson(protocolBytes);
  assert.equal(protocol.status, "refused-short-quality");
  assert.equal(protocol.provider.repository, "nvidia/diar_streaming_sortformer_4spk-v2");
  assert.equal(protocol.provider.artifactSha256, MODEL_SHA256);
  assert.equal(protocol.runtime.workerSha256, WORKER_SHA256);
  const assetRoot = dirname(resolve(receiptPath));
  assert.equal(digest(await readFile(join(assetRoot, "nemotron-v2-worker.py"))), WORKER_SHA256);

  const cases = [];
  for (const entry of protocol.cases) {
    const rawBytes = gunzipSync(await readFile(join(assetRoot, entry.output)));
    const nativeBytes = gunzipSync(await readFile(join(assetRoot, entry.nativeOutput)));
    assert.equal(digest(await readFile(join(assetRoot, entry.output))), entry.rawSha256);
    assert.equal(digest(await readFile(join(assetRoot, entry.nativeOutput))), entry.nativeSha256);
    const raw = readJson(rawBytes);
    const native = readJson(nativeBytes);
    const decoded = decodeNative(native);
    assert.deepEqual(decoded.scores, raw.nativeProbabilities);
    assert.deepEqual(decoded.shape, raw.probabilityShape);
    assert.deepEqual(native.nativeSegmentLines, [raw.nativeSegmentLines]);
    assert.equal(raw.pcmSha256, entry.pcmSha256);
    assert.equal(raw.sourceFrames, entry.frames);
    assert.deepEqual(raw.config, protocol.recipe);
    const metrics = diarizationScore(entry.reference, raw.segments, raw.audioSeconds);
    const overlapMetrics = overlap(entry.reference, raw.segments, raw.audioSeconds);
    const confusionRatio = metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds;
    const countMatches =
      new Set(raw.segments.map((x) => x.speaker)).size === new Set(entry.reference.map((x) => x.speaker)).size;
    const passed =
      countMatches &&
      metrics.der <= protocol.gates.everyCaseDERMaximum &&
      confusionRatio <= protocol.gates.globalIdentityConfusionRatioMaximum &&
      (overlapMetrics.recall === null || overlapMetrics.recall >= protocol.gates.overlapRecallMinimum) &&
      raw.inferenceSeconds <= raw.audioSeconds * protocol.gates.inferenceWallAudioRatioMaximum &&
      raw.peakProcessRSSBytes <= protocol.gates.RSSBytesMaximum;
    assert.deepEqual(metrics, entry.metrics);
    assert.deepEqual(overlapMetrics, entry.overlap);
    assert.equal(confusionRatio, entry.confusionRatio);
    assert.equal(countMatches, entry.countMatches);
    assert.equal(passed, entry.passed);
    cases.push({ id: entry.id, role: entry.role, passed, der: metrics.der, overlapRecall: overlapMetrics.recall });
  }
  assert.equal(protocol.qualityGate.promotion, false);
  assert.equal(protocol.qualityGate.heldOut.passed, false);
  assert.equal(cases.filter((entry) => entry.role === "calibration").every((entry) => entry.passed), true);
  assert.equal(cases.find((entry) => entry.role === "held-out")?.passed, false);
  return { status: protocol.status, promotion: protocol.qualityGate.promotion, heldOut: protocol.qualityGate.heldOut, cases };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node nemotron-v2-replay.mjs <protocol.json>");
  console.log(JSON.stringify(await replayNemotronV2(process.argv[2])));
}
