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
const source = join(root, "specs/agent-editing/assets/19-clean-roomtone/source-region-stereo.wav");
const sourceBytes = await readFile(source),
  sourceInfo = readAudioWaveFile(source);
const sourceHash = "4d85737651eb335162e0e217cdc33e4b10c41f8782786d1e74e9648c9b3f6c05";
assert.equal(hash(sourceBytes), sourceHash);
assert.equal(sourceInfo.sampleRate, 48000);
assert.equal(sourceInfo.channels, 2);
assert.equal(sourceInfo.frames, 24000);
const workerHash = "45cbe7b92819efa15a1b5d4a974cdcbd26cac6301c041bf6e5818e50f7cf5773";
assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), workerHash);
const report = {
  passed: false,
  listening: "pending",
  trace: [],
  exchanges: [],
  deliveries: {},
  source: { path: source, sha256: sourceHash, provenance: "../19-clean-roomtone/report.json" },
  workerSha256: workerHash,
  assemblerSha256: hash(await readFile(import.meta.filename)),
  runtime: { node: process.version, files: {} },
  scope:
    "Same retained region, longer authored equal-power overlaps. Speech-free character and seams require new independent listening; no auditory fix is claimed.",
};
for (const path of [
  "apps/cli/dist/main.js",
  "apps/service/dist/project-service.js",
  "apps/service/dist/worker.js",
  "packages/core/dist/projects.js",
  "packages/core/dist/audio.js",
  "packages/core/dist/audio-wave.js",
  "packages/test-harness/editing/source-evidence-fixture.mjs",
  "packages/test-harness/editing/source-acquisition-service.mjs",
])
  report.runtime.files[path] = hash(await readFile(join(root, path)));
const home = await mkdtemp("/tmp/screenrec-soft-roomtone-");
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
    frames: info.frames,
    sampleRate: info.sampleRate,
    channels: info.channels,
    mcpMatchesCLI: true,
  };
  return { pcm, info };
}
const key = (at, value) => ({ at, value, interpolation: "linear" });
const equalPowerKeys = (fn) =>
  Array.from({ length: 25 }, (_, i) => {
    const at = Math.round((i * 200000) / 24);
    return key(at, fn((at * Math.PI) / 400000));
  });
const entering = equalPowerKeys(Math.sin),
  leaving = equalPowerKeys(Math.cos);
// The oracle reads the admitted public keys, never the native scalar compiler.
function evaluate(keys, us) {
  const right = keys.findIndex((v) => v.at > us);
  if (right === 0) return keys[0].value;
  if (right === -1) return keys.at(-1).value;
  const a = keys[right - 1],
    b = keys[right];
  return a.value + ((b.value - a.value) * (us - a.at)) / (b.at - a.at);
}
try {
  await service.start();
  const imported = await call("asset.import", { requestId: "retained-roomtone", path: source });
  const job = await poll(
    () => call("job.get", { jobId: imported.jobId }),
    (v) => v.state === "ready",
    "roomtone import",
  );
  const asset = await call("asset.get", { assetId: job.result.assetId });
  const streamId = asset.streams.find((v) => v.kind === "audio").id;
  const dry = await audio({ assetId: asset.id, streamId }, "source-dry");
  assert.deepEqual(
    dry.pcm,
    sourceBytes.subarray(sourceInfo.dataOffset, sourceInfo.dataOffset + sourceInfo.dataBytes),
  );
  const made = await call("project.create", {
    requestId: "soft-roomtone-loop",
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
  const occurrences = Array.from({ length: 20 }, (_, i) => ({
    startUs: i * 300000,
    endUs: Math.min(i * 300000 + 500000, 6000000),
  }));
  const placed = await edit(
    "place-retained-regions",
    occurrences.flatMap((placement, i) => [
      { operation: "track.add", label: `track${i}`, track: { kind: "audio", order: i } },
      {
        operation: "place",
        label: `region${i}`,
        clip: {
          trackId: { label: `track${i}` },
          assetId: asset.id,
          streamId,
          source: {
            kind: "range",
            range: { startUs: 0, endUs: placement.endUs - placement.startUs },
          },
          placement: { kind: "project", range: placement },
        },
      },
    ]),
  );
  const curves = occurrences.map((placement, i) => {
    const durationUs = placement.endUs - placement.startUs;
    const inKeys = i === 0 ? [key(0, 0), key(10000, 1)] : entering;
    const outKeys =
      i === 19
        ? [key(durationUs - 10000, 1), key(durationUs, 0)]
        : leaving.map((v) => ({ ...v, at: v.at + durationUs - 200000 }));
    return { keys: [...inKeys, ...outKeys] };
  });
  await edit(
    "equal-power-overlap-curves",
    curves.map((gain, i) => ({
      operation: "processing.set",
      target: { kind: "clip", id: placed.edit.labels[`region${i}`] },
      steps: [
        {
          processor: { type: "gain", gain },
          window: {
            kind: "content",
            clipId: placed.edit.labels[`region${i}`],
            sourceRange: { startUs: 0, endUs: occurrences[i].endUs - occurrences[i].startUs },
          },
        },
      ],
    })),
  );
  const admitted = [];
  for (let i = 0; i < occurrences.length; i++) {
    const result = await call("processing.get", {
      projectId,
      revisionId,
      target: { kind: "clip", id: placed.edit.labels[`region${i}`] },
    });
    assert.deepEqual(result.steps[0].processor.gain, curves[i]);
    admitted.push(result.steps[0].processor.gain.keys);
  }
  const loop = await audio({ projectId, revisionId }, "loop");
  assert.equal(loop.info.frames, 288000);
  assert.equal(loop.info.sampleRate, 48000);
  assert.equal(loop.info.channels, 2);
  let maxSampleError = 0,
    maxGainSquareError = 0;
  for (let f = 0; f < 288000; f++) {
    const us = (f * 1000000) / 48000;
    const active = occurrences.flatMap((p, i) =>
      us >= p.startUs && us < p.endUs
        ? [
            {
              i,
              sourceFrame: f - (p.startUs * 48000) / 1000000,
              gain: evaluate(admitted[i], us - p.startUs),
            },
          ]
        : [],
    );
    if (active.length === 2)
      maxGainSquareError = Math.max(
        maxGainSquareError,
        Math.abs(active.reduce((sum, v) => sum + v.gain ** 2, 0) - 1),
      );
    for (let c = 0; c < 2; c++) {
      const expected = active.reduce(
        (sum, v) => sum + dry.pcm.readFloatLE(v.sourceFrame * 8 + c * 4) * v.gain,
        0,
      );
      maxSampleError = Math.max(
        maxSampleError,
        Math.abs(loop.pcm.readFloatLE(f * 8 + c * 4) - expected),
      );
    }
  }
  const gainSquareBound = Math.sin((Math.PI * 8334) / 800000) ** 2 + 1e-12;
  assert(maxGainSquareError <= gainSquareBound);
  assert(maxSampleError <= 1e-7, `Complete PCM mismatch ${maxSampleError}`);
  const gain = 10 ** (24 / 20);
  await edit("monitor-plus24db", [
    {
      operation: "processing.set",
      target: { kind: "output" },
      steps: [{ processor: { type: "gain", gain } }],
    },
  ]);
  const monitor = await audio({ projectId, revisionId }, "loop-monitor-plus24db");
  assert.deepEqual(monitor.info, loop.info);
  let maxGainError = 0,
    peak = 0;
  for (let at = 0; at < monitor.pcm.length; at += 4) {
    peak = Math.max(peak, Math.abs(monitor.pcm.readFloatLE(at)));
    maxGainError = Math.max(
      maxGainError,
      Math.abs(monitor.pcm.readFloatLE(at) - Math.fround(loop.pcm.readFloatLE(at) * gain)),
    );
  }
  assert(peak < 1);
  assert(maxGainError <= 1e-7);
  revisionId = (
    await call("edit.undo", {
      projectId,
      expectedRevisionId: revisionId,
      requestId: "undo-monitor",
    })
  ).id;
  assert.deepEqual((await audio({ projectId, revisionId }, "loop-undo-gain")).pcm, loop.pcm);
  assert.deepEqual(
    (await call("processing.get", { projectId, revisionId, target: { kind: "output" } })).steps,
    [],
  );
  await rm(join(out, "loop-undo-gain.wav"));
  assert.equal(hash(await readFile(source)), sourceHash);
  assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), workerHash);
  report.checks = {
    drySourcePCMExact: true,
    immutableSource: true,
    immutableWorker: true,
    occurrences,
    admittedCurves: admitted,
    maxSampleError,
    gainSquareBound,
    maxGainSquareError,
    diagnosticGainDb: 24,
    diagnosticPeak: peak,
    maxGainError,
    undoGainExact: true,
    speechFree: "pending listening",
    loopSeams: "pending listening",
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
console.log(
  JSON.stringify({ passed: report.passed, maxSampleError: report.checks?.maxSampleError, out }),
);
