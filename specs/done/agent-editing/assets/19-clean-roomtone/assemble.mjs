import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import {
  JourneyService,
  hash,
  poll,
  root,
} from "../../../../packages/test-harness/editing/source-evidence-fixture.mjs";
import { readAudioWaveFile } from "../../../../packages/core/dist/audio-wave.js";

const { values } = parseArgs({ options: { out: { type: "string" } } });
assert(values.out && process.env.SCREENREC_NATIVE);
const out = resolve(values.out);
await mkdir(out);
const source = join(root, "specs/agent-editing/assets/18-voice-roomtone/pause.wav");
const sourceBytes = await readFile(source),
  sourceInfo = readAudioWaveFile(source);
assert.equal(hash(sourceBytes), "00b967c105e8acb9bbcf867439cdaf4301bf2d906801d9d1dbb2529f32b79658");
assert.equal(sourceInfo.sampleRate, 24000);
assert.equal(sourceInfo.channels, 1);
const range = { startUs: 300000, endUs: 800000 };
const report = {
  passed: false,
  listening: "pending",
  trace: [],
  exchanges: [],
  deliveries: {},
  source: {
    path: source,
    sha256: hash(sourceBytes),
    range,
    originalTimelineRangeUs: [66500000, 67000000],
    sourceOriginUs: 48675,
  },
  workerSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  assemblerSha256: hash(await readFile(import.meta.filename)),
  scope:
    "Earlier real-pause candidate and explicit public loop. Speech-free quality and loop naturalness require listening. Diagnostic gain does not change the accepted voice contexts or set a product default.",
};
const home = await mkdtemp("/tmp/screenrec-clean-roomtone-");
const service = new JourneyService(home, report),
  call = service.call.bind(service);
async function audio(selection, name) {
  await poll(
    () => call("audio.get", selection),
    (v) => v.state === "ready",
    name,
  );
  const path = join(out, `${name}.wav`);
  await call("audio.get", selection, { output: path });
  const bytes = await readFile(path),
    info = readAudioWaveFile(path);
  const reply = await service.mcp.callTool({ name: "audio.get", arguments: selection });
  report.exchanges.push({
    request: { operation: "audio.get", params: selection, transport: "mcp" },
    response: reply,
  });
  assert.equal(reply.structuredContent.ok, true);
  assert.deepEqual(
    Buffer.from(reply.content.find((v) => v.type === "audio").data, "base64"),
    bytes,
  );
  const pcm = bytes.subarray(info.dataOffset, info.dataOffset + info.dataBytes);
  report.deliveries[name] = {
    sha256: hash(bytes),
    pcmSha256: hash(pcm),
    sampleRate: info.sampleRate,
    channels: info.channels,
    frames: info.frames,
    mcpMatchesCLI: true,
  };
  return { pcm, info };
}
try {
  await service.start();
  const imported = await call("asset.import", { requestId: "pause-source", path: source });
  const job = await poll(
    () => call("job.get", { jobId: imported.jobId }),
    (v) => v.state === "ready",
    "pause import",
  );
  const asset = await call("asset.get", { assetId: job.result.assetId });
  const selection = {
    assetId: asset.id,
    streamId: asset.streams.find((v) => v.kind === "audio").id,
    range,
    rendition: { sampleRate: 24000, channels: 1 },
  };
  const extracted = await poll(
    () => call("audio.extract", selection),
    (v) => v.state === "ready",
    "earlier pause",
  );
  assert.deepEqual(await call("audio.extract", selection, { transport: "mcp" }), extracted);
  const excerpt = extracted.published.excerpt;
  report.extraction = extracted;
  const selected = await audio(
    { assetId: excerpt.assetId, streamId: excerpt.streamId },
    "source-region",
  );
  assert.equal(selected.info.sampleRate, 24000);
  assert.equal(selected.info.channels, 1);
  assert.deepEqual(
    selected.pcm,
    sourceBytes.subarray(sourceInfo.dataOffset + 7200 * 4, sourceInfo.dataOffset + 19200 * 4),
  );
  const conversionSelection = {
    assetId: excerpt.assetId,
    streamId: excerpt.streamId,
    rendition: { sampleRate: 48000, channels: 2 },
  };
  const converted = await poll(
    () => call("audio.extract", conversionSelection),
    (v) => v.state === "ready",
    "explicit loop rendition",
  );
  assert.deepEqual(
    await call("audio.extract", conversionSelection, { transport: "mcp" }),
    converted,
  );
  report.conversion = converted;
  const loopExcerpt = converted.published.excerpt;
  const rendered = await audio(
    { assetId: loopExcerpt.assetId, streamId: loopExcerpt.streamId },
    "source-region-stereo",
  );
  assert.equal(rendered.info.sampleRate, 48000);
  assert.equal(rendered.info.channels, 2);
  assert.equal(rendered.info.frames, 24000);
  const made = await call("project.create", {
    requestId: "room-loop",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = made.project.projectId;
  let revisionId = made.revision.id;
  async function edit(requestId, operations) {
    const result = await call(
      "edit.apply",
      { projectId, expectedRevisionId: revisionId, requestId, operations },
      { transport: "mcp" },
    );
    revisionId = result.revision.id;
    return result;
  }
  const occurrences = Array.from({ length: 14 }, (_, i) => ({
    startUs: i * 450000,
    endUs: Math.min(i * 450000 + 500000, 6000000),
  }));
  const placed = await edit(
    "loop-occurrences",
    occurrences.flatMap((placement, i) => [
      { operation: "track.add", label: `roomTrack${i}`, track: { kind: "audio", order: i } },
      {
        operation: "place",
        label: `room${i}`,
        clip: {
          trackId: { label: `roomTrack${i}` },
          assetId: loopExcerpt.assetId,
          streamId: loopExcerpt.streamId,
          source: {
            kind: "range",
            range: { startUs: 0, endUs: placement.endUs - placement.startUs },
          },
          placement: { kind: "project", range: placement },
          pitch: "preserve",
        },
      },
    ]),
  );
  const fades = occurrences.flatMap((placement, i) => [
    {
      i,
      range: { startUs: placement.startUs, endUs: placement.startUs + (i === 0 ? 10000 : 50000) },
      from: 0,
      to: 1,
    },
    {
      i,
      range: { startUs: placement.endUs - (i === 13 ? 10000 : 50000), endUs: placement.endUs },
      from: 1,
      to: 0,
    },
  ]);
  await edit(
    "loop-overlap-fades",
    fades.map(({ i, ...fade }) => ({
      operation: "fade",
      target: { kind: "clip", id: placed.edit.labels[`room${i}`] },
      mediaKind: "audio",
      window: { kind: "project", range: fade.range },
      from: fade.from,
      to: fade.to,
    })),
  );
  const loop = await audio({ projectId, revisionId }, "loop");
  assert.equal(loop.info.frames, 288000);
  assert.equal(loop.info.sampleRate, 48000);
  assert.equal(loop.info.channels, 2);
  let maxSampleError = 0;
  for (let f = 0; f < loop.info.frames; f++) {
    const us = (f * 1000000) / 48000;
    for (let c = 0; c < 2; c++) {
      let expected = 0;
      for (const [i, placement] of occurrences.entries()) {
        if (us < placement.startUs || us >= placement.endUs) continue;
        let gain = 1;
        for (const fade of fades.filter((v) => v.i === i))
          if (us >= fade.range.startUs && us < fade.range.endUs)
            gain *=
              fade.from +
              ((fade.to - fade.from) * (us - fade.range.startUs)) /
                (fade.range.endUs - fade.range.startUs);
        expected +=
          rendered.pcm.readFloatLE((f - (placement.startUs * 48000) / 1000000) * 8 + c * 4) * gain;
      }
      maxSampleError = Math.max(
        maxSampleError,
        Math.abs(loop.pcm.readFloatLE(f * 8 + c * 4) - expected),
      );
    }
  }
  assert(maxSampleError < 1e-7, `Public loop PCM mismatch ${maxSampleError}`);
  const gain = 10 ** (24 / 20);
  await edit("diagnostic-listening-gain", [
    {
      operation: "processing.set",
      target: { kind: "output" },
      steps: [{ processor: { type: "gain", gain } }],
    },
  ]);
  const monitor = await audio({ projectId, revisionId }, "loop-monitor-plus24db");
  let peak = 0,
    maxGainError = 0;
  assert.equal(monitor.pcm.length, loop.pcm.length);
  for (let at = 0; at < monitor.pcm.length; at += 4) {
    peak = Math.max(peak, Math.abs(monitor.pcm.readFloatLE(at)));
    maxGainError = Math.max(
      maxGainError,
      Math.abs(monitor.pcm.readFloatLE(at) - Math.fround(loop.pcm.readFloatLE(at) * gain)),
    );
  }
  assert(peak < 1);
  assert(maxGainError < 1e-7);
  revisionId = (
    await call("edit.undo", {
      projectId,
      expectedRevisionId: revisionId,
      requestId: "undo-diagnostic-gain",
    })
  ).id;
  assert.deepEqual((await audio({ projectId, revisionId }, "loop-undo-gain")).pcm, loop.pcm);
  assert.equal(hash(await readFile(source)), report.source.sha256);
  report.checks = {
    selectedSourcePCMExact: true,
    immutableSource: true,
    occurrences,
    fades,
    maxSampleError,
    diagnosticGainDb: 24,
    diagnosticPeak: peak,
    maxGainError,
    undoGainExact: true,
    speechFree: "pending independent listening",
    loopNaturalness: "pending independent listening",
  };
  report.passed = true;
} finally {
  await service.stop();
  const { exchanges, ...summary } = report;
  await writeFile(join(out, "exchanges.json.gz"), gzipSync(JSON.stringify(exchanges, null, 2)));
  await writeFile(join(out, "report.json"), JSON.stringify(summary, null, 2) + "\n");
  await writeFile(join(out, "service.log"), service.logs.join(""));
  await rm(home, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, out }));
