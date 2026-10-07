import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { sourceTurns } from "./native-clock.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  repo = process.argv[2];
assert(repo, "Pass repository root");
const hash = (x) => createHash("sha256").update(x).digest("hex");
const json = (x) => JSON.parse(readFileSync(x));
const p = json(join(here, "protocol.json"));
const referenceBytes = readFileSync(join(repo, p.references.path));
assert.equal(hash(referenceBytes), p.references.sha256);
const reference = JSON.parse(referenceBytes);
assert.deepEqual(p.gates, reference.gates);
for (const f of json(join(here, "operands.json")).files) {
  const data = readFileSync(join(here, f.path));
  assert.equal(data.length, f.bytes, f.path);
  assert.equal(hash(data), f.sha256, f.path);
}
assert.equal(hash(readFileSync(join(here, "worker.py"))), p.workerSha256);
assert.equal(hash(readFileSync(join(here, "native-clock.mjs"))), p.nativeClock.projectionSha256);
assert.equal(hash(readFileSync(join(here, p.interpreter.path))), p.interpreter.sha256);
assert.equal(hash(readFileSync(join(repo, p.scorer.path))), p.scorer.sha256);
for (const entry of json(join(here, "source-acquisition.json")).files) {
  const path = join(here, entry.path);
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    bytes = gunzipSync(readFileSync(path + ".gz"));
  }
  assert.equal(bytes.length, entry.bytes);
  assert.equal(hash(bytes), entry.sha256);
}
assert.equal(hash(readFileSync(join(here, "model-card.md"))), p.modelCardSha256);
const acquisition = json(join(here, "acquisition-protocol.json"));
const metadata = json(join(here, "model-metadata.json"));
assert.equal(metadata.sha, p.candidate.revision);
const artifact = metadata.siblings.find((x) => x.rfilename === acquisition.manifest.files[0].path);
assert.equal(artifact.size, acquisition.manifest.files[0].bytes);
assert.equal(artifact.lfs.sha256, p.candidate.modelSha256);
assert.equal(acquisition.manifest.files[0].sha256, p.candidate.modelSha256);
assert.equal(
  hash(gunzipSync(readFileSync(join(here, "source-LICENSE.gz")))),
  acquisition.licenseHashes["source-LICENSE"],
);
assert.equal(
  hash(readFileSync(join(here, "upstream-model-license.md"))),
  acquisition.licenseHashes["upstream-model-license.md"],
);
assert.equal(
  hash(readFileSync(join(here, "partial-model-config.yaml"))),
  acquisition.partialConfigSha256,
);
assert.equal(json(join(here, "acquisition-receipt.json")).status.state, "ready");
const { diarizationScore } = await import(pathToFileURL(join(repo, p.scorer.path)));
function evaluate(c, raw) {
  const began = performance.now();
  const turns = sourceTurns(
    raw.nativeProbabilities,
    p.candidate.onset,
    p.candidate.offset,
    raw.frameSamples,
    raw.sourceFrames,
  );
  const interpretationSeconds = (performance.now() - began) / 1000;
  const metrics = diarizationScore(c.reference, turns, raw.audioSeconds);
  const points = [
    ...new Set([
      0,
      raw.audioSeconds,
      ...c.reference.flatMap((x) => [x.start, x.end]),
      ...turns.flatMap((x) => [x.start, x.end]),
    ]),
  ].sort((a, b) => a - b);
  const active = (intervals, time) =>
    new Set(
      intervals
        .filter((x) => x.start <= time && x.end > time && x.speaker !== null)
        .map((x) => x.speaker),
    ).size;
  let referenceOverlapSeconds = 0;
  let retainedOverlapSeconds = 0;
  for (let i = 1; i < points.length; i++) {
    const midpoint = (points[i] + points[i - 1]) / 2;
    if (active(c.reference, midpoint) < 2) continue;
    const dt = points[i] - points[i - 1];
    referenceOverlapSeconds += dt;
    if (active(turns, midpoint) >= 2) retainedOverlapSeconds += dt;
  }
  const overlapRecall = referenceOverlapSeconds
    ? retainedOverlapSeconds / referenceOverlapSeconds
    : null;
  const confusionRatio = metrics.confusedSpeakerSeconds / metrics.referenceSpeakerSeconds;
  const count = new Set(turns.map((x) => x.speaker)).size;
  const requiredCount = new Set(c.reference.map((x) => x.speaker)).size;
  const gates = {
    der: metrics.der <= p.gates.everyCaseDERMaximum,
    identity: confusionRatio <= p.gates.globalIdentityConfusionRatioMaximum,
    overlap: overlapRecall === null || overlapRecall >= p.gates.overlapRecallMinimum,
    count: count === requiredCount,
    time:
      raw.inferenceSeconds + interpretationSeconds <=
      raw.audioSeconds * p.gates.inferenceWallAudioRatioMaximum,
    rss:
      raw.peakProcessRSSBytes <= p.gates.RSSBytesMaximum &&
      process.resourceUsage().maxRSS * 1024 <= p.gates.RSSBytesMaximum,
  };
  return {
    result: {
      metrics,
      referenceOverlapSeconds,
      retainedOverlapSeconds,
      overlapRecall,
      confusionRatio,
      count,
      requiredCount,
      turnsSha256: hash(JSON.stringify(turns)),
      gates,
      passed: Object.values(gates).every(Boolean),
    },
    resources: {
      inferenceSeconds: raw.inferenceSeconds,
      inferencePeakProcessRSSBytes: raw.peakProcessRSSBytes,
      interpretationSeconds,
    },
  };
}

const retained = json(join(here, "results.json"));
const failed = retained.cases.findIndex((x) => !x.result.passed);
assert.deepEqual(
  retained.cases.map((x) => x.id),
  failed < 0 ? p.caseOrder : p.caseOrder.slice(0, failed + 1),
  "Mandatory case order and stop rule",
);
assert.equal(retained.nativeCalls, retained.cases.length);
assert.equal(retained.retries, 0);
assert.equal(retained.promotion, false);
const ids = retained.cases.map((x) => x.id);
const suffixes = [
  "json.gz",
  "json.native-unverified.json.gz",
  "request.json",
  "stdout.json",
  "transport.json",
  "stderr.log.gz",
];
assert.deepEqual(
  json(join(here, "operands.json"))
    .files.filter((x) => x.path.startsWith("observations/"))
    .map((x) => x.path)
    .sort(),
  ids.flatMap((id) => suffixes.map((s) => `observations/${id}.${s}`)).sort(),
);
let wall = 0;
const cases = [];
for (const saved of retained.cases) {
  const id = saved.id,
    c = reference.cases.find((x) => x.id === id);
  const raw = JSON.parse(gunzipSync(readFileSync(join(here, `observations/${id}.json.gz`))));
  const native = JSON.parse(
    gunzipSync(readFileSync(join(here, `observations/${id}.json.native-unverified.json.gz`))),
  );
  assert.equal(raw.id, id);
  assert.equal(raw.sourceFrames, c.frames);
  assert.equal(raw.pcmSha256, c.pcmSha256);
  assert.equal(raw.sampleRate, 16000);
  assert.equal(raw.audioSeconds, c.frames / 16000);
  assert.equal(raw.frameSamples, 1280);
  assert.equal(raw.frameSeconds, 0.08);
  assert.equal(raw.asyncStreaming, false);
  assert.deepEqual(raw.config, p.candidate.recipe);
  const rows = Math.ceil(c.frames / 1280);
  assert.deepEqual(raw.probabilityShape, [1, rows, 8]);
  assert.deepEqual(native.shape, raw.probabilityShape);
  assert.equal(native.dtype, "<f4");
  assert.deepEqual(native.nativeSegmentLines, [raw.nativeSegmentLines]);
  const bytes = Buffer.from(native.bytesBase64, "base64");
  assert.equal(bytes.length, rows * 8 * 4);
  assert.equal(raw.nativeProbabilities.length, rows);
  for (let i = 0; i < rows; i++) {
    assert.equal(raw.nativeProbabilities[i].length, 8);
    for (let j = 0; j < 8; j++) {
      const v = raw.nativeProbabilities[i][j];
      assert(Number.isFinite(v) && v >= 0 && v <= 1);
      assert.equal(v, bytes.readFloatLE((i * 8 + j) * 4));
    }
  }
  const decoded = raw.nativeSegmentLines.map((line) => {
    const [start, end, speaker] = line.split(" ");
    return { speaker, start: Number(start), end: Number(end) };
  });
  assert.deepEqual(decoded, raw.segments);
  for (const turn of raw.segments)
    assert(0 <= turn.start && turn.start < turn.end && turn.end <= raw.audioSeconds);
  const report = evaluate(c, raw);
  assert.deepEqual(report.result, saved.result);
  assert.equal(report.resources.inferenceSeconds, saved.resources.inferenceSeconds);
  assert.equal(
    report.resources.inferencePeakProcessRSSBytes,
    saved.resources.inferencePeakProcessRSSBytes,
  );
  const t = json(join(here, `observations/${id}.transport.json`));
  assert.equal(t.exitCode, 0);
  assert.equal(t.networkDenied, true);
  assert(!t.timedOut);
  wall += t.wallSeconds;
  const stdout = json(join(here, `observations/${id}.stdout.json`));
  assert.equal(stdout.ok, true);
  assert.equal(stdout.data.cases[0].inferenceSeconds, raw.inferenceSeconds);
  assert.equal(stdout.data.cases[0].peakProcessRSSBytes, raw.peakProcessRSSBytes);
  const request = json(join(here, `observations/${id}.request.json`));
  assert.deepEqual(Object.keys(request.params).sort(), ["cases", "model"]);
  assert.deepEqual(Object.keys(request.params.cases[0]).sort(), [
    "frames",
    "id",
    "output",
    "pcm",
    "pcmSha256",
  ]);
  assert.equal(request.params.model, p.modelPath);
  assert.equal(request.params.cases[0].pcmSha256, c.pcmSha256);
  cases.push({ id, ...report });
}
assert.equal(wall, retained.transportWallSeconds);
console.log(
  JSON.stringify(
    { verified: true, promoted: false, passed: cases.every((x) => x.result.passed), cases },
    null,
    2,
  ),
);
