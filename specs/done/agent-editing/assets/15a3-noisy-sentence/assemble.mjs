import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const home = await mkdtemp("/tmp/screenrec-noisy-sentence-");
const source = join(root, "specs/agent-editing/assets/15a3-protected-sentence/original.wav");
const baseline = await readFile(source),
  info = readAudioWaveFile(source);
assert.equal(hash(baseline), "b2b31731a63b3bc973a5fd11661f4b7c3f5384416949a97029c3b0a6043fb05c");
assert.deepEqual([info.sampleRate, info.channels, info.frames], [48000, 1, 129600]);
const frames = info.frames,
  rate = info.sampleRate,
  samples = frames * 2;
const clean = Buffer.alloc(samples * 4),
  noise = Buffer.alloc(samples * 4),
  mixture = Buffer.alloc(samples * 4);
const rawNoise = new Float64Array(samples),
  seeds = [20903, 20904];
function white(channel) {
  let seed = seeds[channel];
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seeds[channel] = seed >>> 0;
  return (seeds[channel] / 4294967295) * 2 - 1;
}
let cleanEnergy = 0,
  noiseEnergy = 0;
for (let f = 0; f < frames; f++) {
  const speech = baseline.readFloatLE(info.dataOffset + f * 4);
  for (let c = 0; c < 2; c++) {
    const at = f * 2 + c;
    clean.writeFloatLE(speech, at * 4);
    let value = 0.7 * Math.sin((2 * Math.PI * 60 * f) / rate + (c * Math.PI) / 2) + 0.3 * white(c);
    for (const start of [24000, 72000, 120000]) {
      const j = f - start;
      if (j >= 0 && j < 960) value += white(c) * (1 - Math.abs((2 * j) / 959 - 1));
    }
    rawNoise[at] = value;
    cleanEnergy += speech * speech;
    noiseEnergy += value * value;
  }
}
const scale = Math.sqrt(cleanEnergy / noiseEnergy) / 10 ** (10 / 20);
for (let at = 0; at < samples; at++) {
  noise.writeFloatLE(rawNoise[at] * scale, at * 4);
  mixture.writeFloatLE(clean.readFloatLE(at * 4) + noise.readFloatLE(at * 4), at * 4);
}
function levels(pcm) {
  let squares = 0,
    peak = 0;
  for (let at = 0; at < pcm.length; at += 4) {
    const value = pcm.readFloatLE(at);
    assert(Number.isFinite(value));
    squares += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  assert(peak < 1, "Unnormalized raw PCM must not clip");
  return { rms: Math.sqrt(squares / (pcm.length / 4)), peak, clippedSamples: 0 };
}
function errorRms(a, b) {
  assert.equal(a.length, b.length);
  let squares = 0;
  for (let at = 0; at < a.length; at += 4) squares += (a.readFloatLE(at) - b.readFloatLE(at)) ** 2;
  return Math.sqrt(squares / (a.length / 4));
}
async function wave(path, pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 8, 28);
  header.writeUInt16LE(8, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  await writeFile(path, Buffer.concat([header, pcm]));
}
const workerHash = "45cbe7b92819efa15a1b5d4a974cdcbd26cac6301c041bf6e5818e50f7cf5773";
assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), workerHash);
const report = {
  passed: false,
  listening: "pending",
  trace: [],
  exchanges: [],
  deliveries: {},
  text: "The sample offer says this is free.",
  textAuthority: "Inherited ASR; no independent word labels.",
  source: {
    path: "../15a3-protected-sentence/original.wav",
    sha256: hash(baseline),
    frames,
    sampleRate: rate,
  },
  workerSha256: workerHash,
  assemblerSha256: hash(await readFile(import.meta.filename)),
  noiseRecipe: {
    seed: [20903, 20904],
    generator: "xorshift32; denominator4294967295; per-channel advancing sequence",
    steady: "0.7*sin(2*pi*60*f/48000 + channel*pi/2) + 0.3*white",
    bursts: {
      startFrames: [24000, 72000, 120000],
      frames: 960,
      envelope: "1-abs(2*j/959-1)",
      amplitude: 1,
    },
    scale,
    aggregateSnrDb: 20 * Math.log10(levels(clean).rms / levels(noise).rms),
    policy:
      "Existing matched-noise10dB policy; clean samples/gain untouched. Authored noise only, not a real stereo capture.",
  },
  components: Object.fromEntries(
    Object.entries({ clean, noise, mixture }).map(([name, pcm]) => [
      name,
      { pcmSha256: hash(pcm), ...levels(pcm) },
    ]),
  ),
};
report.runtimes = {};
for (const path of [
  "apps/cli/dist/main.js",
  "apps/service/dist/project-service.js",
  "packages/core/dist/audio.js",
  "packages/composition/dist/index.js",
])
  report.runtimes[path] = hash(await readFile(join(root, path)));
const service = new JourneyService(join(home, "service"), report),
  call = service.call.bind(service);
async function deliver(selection, name) {
  await poll(
    () => call("audio.get", selection),
    (value) => value.state === "ready",
    name,
  );
  const path = join(out, name + ".wav");
  await call("audio.get", selection, { output: path });
  const bytes = await readFile(path),
    dimensions = readAudioWaveFile(path);
  assert.deepEqual(
    [dimensions.sampleRate, dimensions.channels, dimensions.frames],
    [rate, 2, frames],
  );
  const pcm = bytes.subarray(dimensions.dataOffset, dimensions.dataOffset + dimensions.dataBytes);
  const mcp = await service.mcp.callTool({ name: "audio.get", arguments: selection });
  report.exchanges.push({
    request: { operation: "audio.get", params: selection, transport: "mcp" },
    response: mcp,
  });
  assert.equal(mcp.structuredContent.ok, true);
  assert.deepEqual(
    Buffer.from(mcp.content.find((block) => block.type === "audio").data, "base64"),
    bytes,
  );
  report.deliveries[name] = {
    sha256: hash(bytes),
    pcmSha256: hash(pcm),
    frames,
    sampleRate: rate,
    channels: 2,
    mcpMatchesCLI: true,
    ...levels(pcm),
  };
  return pcm;
}
try {
  await service.start();
  const capability = (await call("processing.capabilities", {})).find(
    (value) => value.type === "rnnoise",
  );
  assert.equal(capability.execution, true);
  assert.equal(
    capability.implementationId,
    "rnnoise-70f1d256-d6021b7697677c4d2274c912975e143765552b0e6f25500aa660fdb4a9849be5-f480-s32768-flush2-delay960-independent-channels-v2",
  );
  report.implementationId = capability.implementationId;
  const processed = {};
  for (const [name, input] of Object.entries({ mixture, noise })) {
    const path = join(home, name + ".wav");
    await wave(path, input);
    const imported = await call("asset.import", { path, requestId: randomUUID() });
    const job = await poll(
      () => call("job.get", { jobId: imported.jobId }),
      (value) => value.state === "ready",
      name + " import",
    );
    const asset = await call("asset.get", { assetId: job.result.assetId });
    assert.deepEqual(
      await deliver({ assetId: asset.id, streamId: asset.streams[0].id }, name + "-source"),
      input,
    );
    const made = await call("project.create", {
      requestId: randomUUID(),
      canvas: {
        width: 16,
        height: 16,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
    });
    const projectId = made.project.projectId,
      range = { startUs: 0, endUs: 2700000 };
    const placed = await call(
      "edit.apply",
      {
        projectId,
        expectedRevisionId: made.revision.id,
        requestId: randomUUID(),
        operations: [
          { operation: "track.add", label: "sentence", track: { kind: "audio", order: 0 } },
          {
            operation: "place",
            clip: {
              trackId: { label: "sentence" },
              assetId: asset.id,
              streamId: asset.streams[0].id,
              source: { kind: "range", range },
              placement: { kind: "project", range },
            },
          },
        ],
      },
      { transport: "mcp" },
    );
    assert.deepEqual(
      await deliver({ projectId, revisionId: placed.revision.id }, name + "-dry"),
      input,
    );
    const changed = await call(
      "edit.apply",
      {
        projectId,
        expectedRevisionId: placed.revision.id,
        requestId: randomUUID(),
        operations: [
          {
            operation: "processing.set",
            target: { kind: "output" },
            steps: [{ processor: { type: "rnnoise" } }],
          },
        ],
      },
      { transport: "mcp" },
    );
    processed[name] = await deliver(
      { projectId, revisionId: changed.revision.id },
      name + "-processed",
    );
  }
  const cleanPath = join(root, "specs/agent-editing/assets/15a3-protected-sentence/candidate.wav");
  const cleanBytes = await readFile(cleanPath),
    cleanInfo = readAudioWaveFile(cleanPath);
  const cleanManifest = JSON.parse(
    await readFile(
      join(root, "specs/agent-editing/assets/15a3-protected-sentence/manifest.json"),
      "utf8",
    ),
  );
  assert.equal(hash(cleanBytes), cleanManifest.receipts.candidate.sha256);
  assert.equal(cleanManifest.receipts.original.sha256, report.source.sha256);
  assert.equal(cleanManifest.workerSha256, workerHash);
  assert.equal(cleanManifest.rnnoiseCapability.implementationId, capability.implementationId);
  assert.deepEqual([cleanInfo.sampleRate, cleanInfo.channels, cleanInfo.frames], [rate, 2, frames]);
  const cleanProcessed = cleanBytes.subarray(
    cleanInfo.dataOffset,
    cleanInfo.dataOffset + cleanInfo.dataBytes,
  );
  report.metrics = {
    reusedCleanProcessed: {
      path: "../15a3-protected-sentence/candidate.wav",
      sha256: hash(cleanBytes),
    },
    noiseOnlyAttenuationDb: 20 * Math.log10(levels(processed.noise).rms / levels(noise).rms),
    cleanReferenceOnlyErrorRms: errorRms(cleanProcessed, clean),
    mixtureErrorRelativeToInputNoiseDb:
      20 * Math.log10(errorRms(processed.mixture, clean) / levels(noise).rms),
    outputSensitivityRelativeToInputNoiseDb:
      20 * Math.log10(errorRms(processed.mixture, cleanProcessed) / levels(noise).rms),
    interpretation:
      "Noise-only attenuation is not residual noise in speech. Clean-reference change and mixture error include original ambience/speech changes; neither proves word retention or perceived noise reduction.",
  };
  const gain = levels(clean).rms / levels(processed.mixture).rms;
  const matched = Buffer.alloc(processed.mixture.length);
  for (let at = 0; at < matched.length; at += 4)
    matched.writeFloatLE(processed.mixture.readFloatLE(at) * gain, at);
  const matchedPath = join(out, "mixture-processed-matched.wav");
  await wave(matchedPath, matched);
  report.loudnessMatched = {
    path: "mixture-processed-matched.wav",
    sha256: hash(await readFile(matchedPath)),
    pcmSha256: hash(matched),
    frames,
    sampleRate: rate,
    channels: 2,
    ...levels(matched),
    gain,
    gainDb: 20 * Math.log10(gain),
    targetRms: levels(clean).rms,
    authority:
      "Offline diagnostic Float32 gain only, matching underlying clean sentence RMS, not noisy mixture RMS. No product normalization or processing default. Raw candidate remains unchanged; this copy has no CLI/MCP delivery claim.",
  };
  await writeFile(join(out, "noise-component.f32.gz"), gzipSync(noise));
  await writeFile(join(out, "noise-processed.f32.gz"), gzipSync(processed.noise));
  assert.equal(hash(await readFile(source)), report.source.sha256);
  assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), workerHash);
  report.passed = true;
} finally {
  await service.stop();
  await writeFile(join(out, "receipts.json.gz"), gzipSync(JSON.stringify(report), { level: 9 }));
  const summary = { ...report };
  delete summary.trace;
  delete summary.exchanges;
  await writeFile(join(out, "manifest.json"), JSON.stringify(summary, null, 2) + "\n");
  await rm(home, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: report.passed, out, metrics: report.metrics }));
