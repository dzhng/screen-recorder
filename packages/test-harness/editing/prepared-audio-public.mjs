import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { JourneyService, hash, poll, run } from "./source-evidence-fixture.mjs";
import { writeSourceWave, sourcePeriod } from "./audio-project-fixture.mjs";

const { values } = parseArgs({ options: { out: { type: "string" } } });
assert(values.out && process.env.SCREENREC_NATIVE);
const out = resolve(values.out),
  home = await mkdtemp("/tmp/sr-prepared-public-");
await mkdir(out);
const report = {
  passed: false,
  trace: [],
  checks: {},
  receipts: [],
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  scope:
    "public full-output unit-rate/gain preparation; no stretch, denoise or speech-quality claim",
};
const service = new JourneyService(home, report),
  call = service.call.bind(service);
const period = sourcePeriod(0);
async function prepare(selection) {
  const result = await poll(
    () => call("audio.prepare", selection),
    (value) => value.state === "ready",
    "prepared audio",
  );
  assert.deepEqual(await call("audio.prepare", selection, { transport: "mcp" }), result);
  assert.deepEqual(await call("audio.prepare", selection), result);
  report.receipts.push(result);
  return result;
}
async function inspect(prepared, gain, name) {
  const audio = prepared.published.audio;
  const asset = await call("asset.get", { assetId: audio.assetId });
  const stream = asset.streams.find((value) => value.kind === "audio");
  assert(stream);
  assert.equal(audio.frames, 48000);
  assert.deepEqual(audio.sampleRange, { start: 0, end: 48000 });
  const startUs = name === "historical-after-restart" ? 750000 : 0;
  const selection = {
    assetId: asset.id,
    streamId: stream.id,
    range: { startUs, endUs: 1000000 },
  };
  await poll(
    () => call("audio.get", selection),
    (value) => value.state === "ready",
    "prepared asset audio",
  );
  const path = join(out, name + ".wav");
  await call("audio.get", selection, { output: path });
  const decoded = await run("ffmpeg", ["-v", "error", "-i", path, "-f", "f32le", "-"], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024,
  });
  const expected = Buffer.from(period.subarray(((startUs * 48000) / 1000000) * 8));
  for (let at = 0; at < expected.length; at += 4)
    expected.writeFloatLE(Math.fround(expected.readFloatLE(at) * gain), at);
  assert.deepEqual(decoded.stdout, expected);
  const wave = await poll(
    () => call("waveform.get", { ...selection, bucketFrames: 6000 }),
    (value) => value.state === "ready",
    "prepared waveform",
  );
  assert(wave.published);
  report.checks[name] = {
    exactPCM: true,
    frames: expected.length / 8,
    waveformReady: true,
    assetId: asset.id,
  };
}
try {
  await service.start();
  const source = join(home, "source.wav");
  await writeSourceWave(source, { source: 0, seconds: 1 });
  const imported = await call("asset.import", { requestId: "source", path: source });
  const job = await poll(
    () => call("job.get", { jobId: imported.jobId }),
    (value) => value.state === "ready",
    "import",
  );
  const sourceAsset = await call("asset.get", { assetId: job.result.assetId });
  const made = await call("project.create", {
    requestId: "project",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = made.project.projectId;
  const placed = await call("edit.apply", {
    projectId,
    expectedRevisionId: made.revision.id,
    requestId: "place",
    operations: [
      { operation: "track.add", label: "audio", track: { kind: "audio", order: 0 } },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: { label: "audio" },
          assetId: sourceAsset.id,
          streamId: sourceAsset.streams[0].id,
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
          pitch: "preserve",
        },
      },
    ],
  });
  const original = { projectId, revisionId: placed.revision.id };
  const first = await prepare(original);
  await inspect(first, 1, "original");
  const gained = await call("edit.apply", {
    projectId,
    expectedRevisionId: original.revisionId,
    requestId: "gain",
    operations: [
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [
          {
            enabled: true,
            window: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
            processor: { type: "gain", gain: 0.5 },
          },
        ],
      },
    ],
  });
  const selection = { projectId, revisionId: gained.revision.id };
  const blocked = await service.arm("media.mixCompositionAudio");
  const pending = await call("audio.prepare", selection);
  await blocked();
  await call("job.cancel", { jobId: pending.jobId });
  const canceled = await call("job.get", { jobId: pending.jobId });
  assert.equal(canceled.state, "canceled");
  assert.equal(canceled.result, null);
  await call("audio.prepare", selection);
  assert.deepEqual(await call("job.get", { jobId: pending.jobId }), canceled);
  await call("job.retry", { jobId: pending.jobId });
  const second = await prepare(selection);
  assert.equal(second.jobId, pending.jobId);
  assert.notEqual(second.published.audio.assetId, first.published.audio.assetId);
  await inspect(second, 0.5, "gain");
  assert.deepEqual(await call("revision.get", selection), { projectId, revision: gained.revision });
  assert.equal((await call("project.get", { projectId })).currentRevisionId, selection.revisionId);
  assert.deepEqual(await prepare(original), first);
  await service.stop();
  await service.start();
  assert.deepEqual(await prepare(selection), second);
  assert.deepEqual(await prepare(original), first);
  await inspect(first, 1, "historical-after-restart");
  const unavailable = await call("edit.apply", {
    projectId,
    expectedRevisionId: selection.revisionId,
    requestId: "retime",
    operations: [
      {
        operation: "retime",
        clipIds: [placed.edit.labels.clip],
        durationUs: 500000,
        scope: "selected",
        ripple: "none",
      },
    ],
  });
  const refusal = await call(
    "audio.prepare",
    { projectId, revisionId: unavailable.revision.id },
    { error: true },
  );
  assert.equal(refusal.code, "NOT_READY");
  report.checks.lifecycle = {
    repeatCLIAndMCP: true,
    canceledReplyNotPublished: true,
    noImplicitRetry: true,
    explicitRetry: true,
    exactHistoricalRestart: true,
    unchangedRevisionAndHead: true,
    unresolvedRetimeRefused: true,
  };
  report.passed = true;
} finally {
  await service.stop();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await rm(home, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, out }));
