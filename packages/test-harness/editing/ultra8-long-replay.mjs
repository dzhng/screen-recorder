import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceTurns } from "../../../specs/done/video-editing-feedback/assets/31-speaker-replication/ultra8-evidence/native-clock.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const assets = join(
  root,
  "specs/done/video-editing-feedback/assets/31-speaker-replication/ultra8-evidence",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readGzipJson = async (path) => JSON.parse(gunzipSync(await readFile(path)));

function overlap(reference, prediction, duration) {
  const points = [
    ...new Set([
      0,
      duration,
      ...reference.flatMap((value) => [value.start, value.end]),
      ...prediction.flatMap((value) => [value.start, value.end]),
    ]),
  ].sort((a, b) => a - b);
  const active = (values, at) =>
    new Set(
      values
        .filter((value) => value.start <= at && value.end > at && value.speaker !== null)
        .map((value) => value.speaker),
    ).size;
  let referenceSeconds = 0;
  let retainedSeconds = 0;
  for (let index = 1; index < points.length; index += 1) {
    const midpoint = (points[index - 1] + points[index]) / 2;
    if (active(reference, midpoint) < 2) continue;
    const seconds = points[index] - points[index - 1];
    referenceSeconds += seconds;
    if (active(prediction, midpoint) >= 2) retainedSeconds += seconds;
  }
  return {
    referenceSeconds,
    retainedSeconds,
    recall: referenceSeconds ? retainedSeconds / referenceSeconds : null,
  };
}

async function score(reference, raw) {
  const { diarizationScore } = await import(
    new URL("../speech/feasibility/score.mjs", import.meta.url)
  );
  const turns = sourceTurns(raw.nativeProbabilities, 0.5, 0.1, 1280, raw.sourceFrames);
  const metrics = diarizationScore(reference, turns, raw.audioSeconds);
  const overlapResult = overlap(reference, turns, raw.audioSeconds);
  const confusionRatio = metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds;
  const observedSpeakerCount = new Set(turns.map((value) => value.speaker)).size;
  const requiredSpeakerCount = new Set(reference.map((value) => value.speaker)).size;
  const gates = {
    der: metrics.der <= 0.2,
    identity: confusionRatio <= 0.05,
    overlap: overlapResult.recall === null || overlapResult.recall >= 0.8,
    count: observedSpeakerCount === requiredSpeakerCount,
    time: raw.inferenceSeconds <= raw.audioSeconds * 2,
    rss: raw.peakProcessRSSBytes <= 4 * 1024 * 1024 * 1024,
  };
  return {
    metrics,
    overlap: overlapResult,
    confusionRatio,
    observedSpeakerCount,
    requiredSpeakerCount,
    gates,
    passed: Object.values(gates).every(Boolean),
  };
}

export async function runUltra8LongReplay({ assetsDirectory } = {}) {
  const assetRoot = assetsDirectory === undefined ? assets : resolve(assetsDirectory);
  const protocolPath = join(assetRoot, "long-protocol.json");
  const protocolBytes = await readFile(protocolPath);
  const protocol = JSON.parse(protocolBytes);
  assert.equal(protocol.kind, "ultra8-long-continuity-audit");
  assert.equal(protocol.status, "exploratory");
  assert.equal(protocol.frozenBeforeInference, false);
  assert.equal(protocol.promotion, false);
  assert.equal(
    hash(await readFile(join(assetRoot, "worker.py"))),
    protocol.candidate.workerSha256,
    "speaker worker changed",
  );
  assert.equal(
    hash(await readFile(join(assetRoot, "native-clock.mjs"))),
    protocol.candidate.nativeClockSha256,
    "native clock projection changed",
  );
  const referencePath = resolve(assetRoot, protocol.reference.path);
  const referenceBytes = await readFile(referencePath);
  assert.equal(hash(referenceBytes), protocol.reference.sha256, "long reference changed");
  const reference = JSON.parse(referenceBytes);
  assert.equal(reference.gates.everyCaseDERMaximum, protocol.gates.everyCaseDERMaximum);
  assert.equal(
    reference.gates.inferenceWallAudioRatioMaximum,
    protocol.gates.inferenceWallAudioRatioMaximum,
  );
  assert.equal(reference.gates.RSSBytesMaximum, protocol.gates.rssBytesMaximum);
  assert.equal(
    reference.gates.globalIdentityConfusionRatioMaximum,
    protocol.gates.globalIdentityConfusionRatioMaximum,
  );
  assert.equal(reference.gates.overlapRecallMinimum, protocol.gates.overlapRecallMinimum);
  const manifest = await readJson(join(assetRoot, protocol.observations.manifest));
  for (const entry of manifest.files) {
    const bytes = await readFile(join(assetRoot, entry.path));
    assert.equal(bytes.length, entry.bytes, `${entry.path}: byte count changed`);
    assert.equal(hash(bytes), entry.sha256, `${entry.path}: retained operand changed`);
  }
  const retained = await readJson(join(assetRoot, protocol.results));
  assert.equal(retained.kind, protocol.kind);
  assert.equal(retained.status, protocol.status);
  assert.equal(retained.protocolSha256, hash(protocolBytes));
  assert.equal(retained.referenceProtocolSha256, protocol.reference.sha256);
  assert.equal(retained.promotion, false);
  assert.deepEqual(
    retained.cases.map((value) => value.id),
    protocol.caseOrder,
    "mandatory case order changed",
  );
  const cases = [];
  for (const id of protocol.caseOrder) {
    const referenceCase = reference.cases.find((value) => value.id === id);
    assert(referenceCase, `${id}: missing long reference`);
    const rawPath = join(assetRoot, protocol.observations.directory, `${id}.json.gz`);
    const nativePath = join(
      assetRoot,
      protocol.observations.directory,
      `${id}.json.native-unverified.json.gz`,
    );
    const rawBytes = gunzipSync(await readFile(rawPath));
    const nativeBytes = gunzipSync(await readFile(nativePath));
    const raw = JSON.parse(rawBytes);
    const native = JSON.parse(nativeBytes);
    assert.equal(raw.id, id);
    assert.equal(raw.sourceFrames, referenceCase.frames);
    assert.equal(raw.pcmSha256, referenceCase.pcmSha256);
    assert.equal(raw.sampleRate, protocol.candidate.sampleRate);
    assert.equal(raw.frameSamples, protocol.candidate.frameSamples);
    assert.deepEqual(raw.config, protocol.candidate.recipe);
    assert.deepEqual(native.shape, raw.probabilityShape);
    assert.equal(native.dtype, "<f4");
    assert.deepEqual(native.nativeSegmentLines, [raw.nativeSegmentLines]);
    const tensorBytes = Buffer.from(native.bytesBase64, "base64");
    assert.equal(tensorBytes.length, raw.nativeProbabilities.length * 8 * 4);
    for (let frame = 0; frame < raw.nativeProbabilities.length; frame += 1)
      for (let slot = 0; slot < 8; slot += 1)
        assert.equal(
          tensorBytes.readFloatLE((frame * 8 + slot) * 4),
          raw.nativeProbabilities[frame][slot],
          `${id}: native score changed`,
        );
    const request = await readJson(
      join(assetRoot, protocol.observations.directory, `${id}.request.json`),
    );
    assert.equal(request.operation, "speaker.continuityLab");
    assert.equal(request.params.model, `/tmp/yap-speaker-hysteresis-20261006/ultra8-admission/model-library/models/ultra8-checkpoint-research/08c94f3d289e426288b15a580f7ce47b93b99bf2/checkpoint/ultra_diar_streaming_sortformer_8spk_v1.nemo`);
    assert.deepEqual(request.params.cases.map((value) => value.id), [id]);
    const transport = await readJson(
      join(assetRoot, protocol.observations.directory, `${id}.transport.json`),
    );
    assert.equal(transport.exitCode, 0);
    assert.equal(transport.networkDenied, true);
    const actual = { id, ...(await score(referenceCase.reference, raw)) };
    const saved = retained.cases.find((value) => value.id === id);
    assert(saved, `${id}: missing saved result`);
    assert.deepEqual(
      {
        id,
        metrics: actual.metrics,
        overlap: actual.overlap,
        confusionRatio: actual.confusionRatio,
        observedSpeakerCount: actual.observedSpeakerCount,
        requiredSpeakerCount: actual.requiredSpeakerCount,
        gates: actual.gates,
        passed: actual.passed,
      },
      {
        id,
        metrics: saved.metrics,
        overlap: saved.overlap,
        confusionRatio: saved.confusionRatio,
        observedSpeakerCount: saved.observedSpeakerCount,
        requiredSpeakerCount: saved.requiredSpeakerCount,
        gates: saved.gates,
        passed: saved.passed,
      },
      `${id}: replay differs from retained result`,
    );
    cases.push({
      id,
      passed: actual.passed,
      der: actual.metrics.der,
      overlapRecall: actual.overlap.recall,
      confusionRatio: actual.confusionRatio,
      observedSpeakerCount: actual.observedSpeakerCount,
      requiredSpeakerCount: actual.requiredSpeakerCount,
    });
  }
  return {
    kind: protocol.kind,
    status: protocol.status,
    cases,
    promotion: protocol.promotion,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await runUltra8LongReplay(), null, 2));
