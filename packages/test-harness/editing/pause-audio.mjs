import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { JourneyService, hash, poll } from "./source-evidence-fixture.mjs";
import { readAudioWaveFile } from "../../core/dist/audio-wave.js";

const { values } = parseArgs({ options: { out: { type: "string" } } });
assert(values.out && process.env.SCREENREC_NATIVE);
const out = resolve(values.out),
  home = await realpath(await mkdtemp("/tmp/sr-pause-"));
await mkdir(out);
const report = {
  passed: false,
  trace: [],
  checks: {},
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
};
const service = new JourneyService(home, report),
  call = service.call.bind(service);
const rate = 48000,
  stride = 8,
  frames = rate * 3;
const sourcePCM = Buffer.alloc(frames * stride);
// The first quarter second contains only authored ambience, never inferred silence.
for (let f = 0; f < frames; f++) {
  const t = f / rate;
  const ambience = 0.015 * Math.sin(2 * Math.PI * 60 * t) + 0.007 * Math.sin(2 * Math.PI * 172 * t);
  const voice =
    f < rate / 4
      ? 0
      : 0.18 *
        (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t)) *
        (Math.sin(2 * Math.PI * 180 * t) + 0.3 * Math.sin(2 * Math.PI * 540 * t));
  for (let c = 0; c < 2; c++)
    sourcePCM.writeFloatLE(ambience + voice * (c ? 0.8 : 1), f * stride + c * 4);
}
const header = Buffer.alloc(44);
header.write("RIFF");
header.writeUInt32LE(36 + sourcePCM.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(3, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * stride, 28);
header.writeUInt16LE(stride, 32);
header.writeUInt16LE(32, 34);
header.write("data", 36);
header.writeUInt32LE(sourcePCM.length, 40);
const sourcePath = join(out, "source.wav");
await writeFile(sourcePath, Buffer.concat([header, sourcePCM]));
let projectId, revisionId;
async function edit(requestId, operations, transport = "cli") {
  const result = await call(
    "edit.apply",
    { projectId, expectedRevisionId: revisionId, requestId, operations },
    { transport },
  );
  revisionId = result.revision.id;
  return result;
}
async function audio(name, selection = { projectId, revisionId }) {
  await poll(
    () => call("audio.get", selection),
    (v) => v.state === "ready",
    name,
  );
  const path = join(out, `${name}.wav`);
  await call("audio.get", selection, { output: path });
  const info = readAudioWaveFile(path),
    bytes = await readFile(path);
  assert.equal(info.sampleRate, rate);
  assert.equal(info.channels, 2);
  return bytes.subarray(info.dataOffset, info.dataOffset + info.dataBytes);
}
function retained(actual, original) {
  assert.equal(actual.length, original.length + (rate / 2) * stride);
  assert.deepEqual(
    actual.subarray(0, rate * 1.5 * stride),
    original.subarray(0, rate * 1.5 * stride),
  );
  assert.deepEqual(actual.subarray(rate * 2 * stride), original.subarray(rate * 1.5 * stride));
}
try {
  await service.start();
  const imported = await call("asset.import", { requestId: "source", path: sourcePath });
  const job = await poll(
    () => call("job.get", { jobId: imported.jobId }),
    (v) => v.state === "ready",
    "import",
  );
  const asset = await call("asset.get", { assetId: job.result.assetId });
  const made = await call("project.create", {
    requestId: "pause",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  projectId = made.project.projectId;
  revisionId = made.revision.id;
  const placed = await edit("place", [
    { operation: "track.add", label: "narration", track: { kind: "audio", order: 0 } },
    {
      operation: "place",
      clip: {
        trackId: { label: "narration" },
        assetId: asset.id,
        streamId: asset.streams[0].id,
        source: { kind: "range", range: { startUs: 0, endUs: 3000000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 3000000 } },
        pitch: "preserve",
      },
    },
  ]);
  const baselineRevision = revisionId,
    baseline = await audio("baseline");
  assert.deepEqual(baseline, sourcePCM);
  const gap = await edit(
    "insert-pause",
    [
      {
        operation: "insert",
        atUs: 1500000,
        durationUs: 500000,
        ripple: { trackIds: [placed.edit.labels.narration] },
      },
    ],
    "mcp",
  );
  const gapRevision = revisionId,
    silent = await audio("gap");
  retained(silent, baseline);
  assert.deepEqual(
    silent.subarray(rate * 1.5 * stride, rate * 2 * stride),
    Buffer.alloc((rate / 2) * stride),
  );
  assert.deepEqual(gap.revision.document.processing, []);
  assert.equal(gap.revision.document.tracks.length, 1);
  report.checks.gap = {
    noImplicitFillOrProcessing: true,
    exactRetainedPCM: true,
    mapping: [
      { sourceUs: [0, 1500000], projectUs: [0, 1500000] },
      { sourceUs: [1500000, 3000000], projectUs: [2000000, 3500000] },
    ],
    resamplingJoinInfluenceFrames: 0,
    protectedJoinGuardFrames: 0,
  };
  const selection = {
    assetId: asset.id,
    streamId: asset.streams[0].id,
    range: { startUs: 0, endUs: 250000 },
    rendition: { sampleRate: rate, channels: 2 },
  };
  const extraction = await poll(
    () => call("audio.extract", selection),
    (v) => v.state === "ready",
    "retained ambience",
  );
  assert.deepEqual(await call("audio.extract", selection, { transport: "mcp" }), extraction);
  const excerpt = extraction.published.excerpt;
  assert.deepEqual(
    await audio("ambience", { assetId: excerpt.assetId, streamId: excerpt.streamId }),
    sourcePCM.subarray(0, (rate / 4) * stride),
  );
  report.extraction = excerpt;
  const occurrences = [
    { startUs: 1500000, endUs: 1750000 },
    { startUs: 1700000, endUs: 1950000 },
    { startUs: 1900000, endUs: 2000000 },
  ];
  const room = await edit("room-occurrences", [
    ...occurrences.map((_, i) => ({
      operation: "track.add",
      label: `roomTrack${i}`,
      track: { kind: "audio", order: i + 1 },
    })),
    ...occurrences.map((range, i) => ({
      operation: "place",
      label: `room${i}`,
      clip: {
        trackId: { label: `roomTrack${i}` },
        assetId: excerpt.assetId,
        streamId: excerpt.streamId,
        source: { kind: "range", range: { startUs: 0, endUs: range.endUs - range.startUs } },
        placement: { kind: "project", range },
        pitch: "preserve",
      },
    })),
  ]);
  const fades = occurrences.flatMap((range, i) => [
    {
      i,
      range: { startUs: range.startUs, endUs: range.startUs + (i === 0 ? 10000 : 50000) },
      from: 0,
      to: 1,
    },
    {
      i,
      range: { startUs: range.endUs - (i === 2 ? 10000 : 50000), endUs: range.endUs },
      from: 1,
      to: 0,
    },
  ]);
  await edit(
    "explicit-gain-fades",
    [
      ...occurrences.map((_, i) => ({
        operation: "processing.set",
        target: { kind: "clip", id: room.edit.labels[`room${i}`] },
        steps: [{ processor: { type: "gain", gain: 0.5 } }],
      })),
      ...fades.map(({ i, ...fade }) => ({
        operation: "fade",
        target: { kind: "clip", id: room.edit.labels[`room${i}`] },
        mediaKind: "audio",
        window: { kind: "project", range: fade.range },
        from: fade.from,
        to: fade.to,
      })),
    ],
    "mcp",
  );
  const filled = await audio("filled");
  retained(filled, baseline);
  let maxError = 0,
    energy = 0;
  for (let f = rate * 1.5; f < rate * 2; f++) {
    const us = (f / rate) * 1000000;
    let expected = 0;
    for (const [i, range] of occurrences.entries()) {
      if (us < range.startUs || us >= range.endUs) continue;
      let gain = 0.5;
      for (const fade of fades.filter((v) => v.i === i))
        if (us >= fade.range.startUs && us < fade.range.endUs)
          gain *=
            fade.from +
            ((fade.to - fade.from) * (us - fade.range.startUs)) /
              (fade.range.endUs - fade.range.startUs);
      expected +=
        sourcePCM.readFloatLE((f - Math.round((range.startUs * rate) / 1000000)) * stride) * gain;
    }
    for (let c = 0; c < 2; c++)
      maxError = Math.max(maxError, Math.abs(filled.readFloatLE(f * stride + c * 4) - expected));
    energy += expected * expected;
  }
  assert(energy > 0.1);
  assert(maxError < 1e-7, `Explicit room mix PCM error ${maxError}`);
  report.checks.room = {
    occurrences,
    gain: 0.5,
    authoredFades: fades,
    maxSampleError: maxError,
    exactRetainedPCM: true,
    resamplingJoinInfluenceFrames: 0,
    speechAbsentByFixtureConstruction: true,
  };
  report.revisions = { baselineRevision, gapRevision, filledRevision: revisionId };
  const preview = await poll(
    () => call("preview.get", { projectId, revisionId }),
    (v) => v.state === "ready",
    "render",
  );
  await call("preview.get", { projectId, revisionId }, { output: join(out, "filled.mp4") });
  assert.equal(preview.published.preview.durationUs, 3500000);
  const exported = await call("export.create", {
    projectId,
    kind: "video",
    exportId: randomUUID(),
    directory: out,
    leaf: "export.mp4",
  });
  assert.equal(exported.snapshot.revisionId, revisionId);
  const published = await poll(
    () => call("export.status", { exportId: exported.exportId }, { transport: "mcp" }),
    (v) => v.state === "committed",
    "export",
  );
  assert.deepEqual(await readFile(published.output), await readFile(join(out, "filled.mp4")));
  report.export = published.receipt;
  for (let n = 0; n < 2; n++)
    revisionId = (
      await call("edit.undo", {
        projectId,
        expectedRevisionId: revisionId,
        requestId: `undo-room-${n}`,
      })
    ).id;
  assert.deepEqual(await audio("undo-room"), silent);
  revisionId = (
    await call("edit.undo", { projectId, expectedRevisionId: revisionId, requestId: "undo-gap" })
  ).id;
  assert.deepEqual(await audio("undo-gap"), baseline);
  assert.equal(hash(await readFile(sourcePath)), asset.id);
  report.checks.undoAndRender = {
    roomUndoExact: true,
    gapUndoExact: true,
    immutableSource: true,
    movieDurationUs: 3500000,
    exportMatchesPreview: true,
  };
  report.limits =
    "Synthetic mechanical journey only. Real voice listening, independent picture scope and selected RNNoise pause branch remain unverified. No policy preference selected.";
  report.passed = true;
} finally {
  await service.stop();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "service.log"), service.logs.join(""));
  await rm(home, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, out }));
