import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { JourneyService, hash, poll, root, run } from "../../../../packages/test-harness/editing/source-evidence-fixture.mjs";
import { readAudioWaveFile } from "../../../../packages/core/dist/audio-wave.js";

const { values } = parseArgs({ options: { out: { type: "string" }, ffmpeg: { type: "string" } } });
assert(values.out && values.ffmpeg && process.env.SCREENREC_NATIVE);
const out = resolve(values.out);
await mkdir(out);
const home = await mkdtemp("/tmp/screenrec-protected-stereo-");
const packet = join(root, "specs/agent-editing/assets/15a3-protected-sentence");
const originalBytes = await readFile(join(packet, "original.wav"));
const previousCandidate = await readFile(join(packet, "candidate.wav"));
assert.equal(hash(originalBytes), "b2b31731a63b3bc973a5fd11661f4b7c3f5384416949a97029c3b0a6043fb05c");
assert.equal(hash(previousCandidate), "f3479c98cd2dbee88da1b4781ef0d5ea51f34d2b1beed7da56931f204d6d4eb6");
const monoInfo = readAudioWaveFile(join(packet, "original.wav"));
assert.equal(monoInfo.frames, 129600);
assert.equal(monoInfo.sampleRate, 48000);
assert.equal(monoInfo.channels, 1);
const original = originalBytes.subarray(monoInfo.dataOffset, monoInfo.dataOffset + monoInfo.dataBytes);
const stereo = Buffer.alloc(original.length * 2);
for (let frame = 0; frame < monoInfo.frames; frame++) {
  original.copy(stereo, frame * 8, frame * 4, frame * 4 + 4);
  stereo.writeFloatLE(Math.fround(original.readFloatLE(frame * 4) * 0.5), frame * 8 + 4);
}
const report = { passed: false, listening: "pending", trace: [], exchanges: [], receipts: {},
  scenario: "Authored channel-relation control, not naturally recorded spatial audio. Left is the frozen sentence; right is exactly half its Float32 amplitude.",
  sourceOriginalSha256: hash(originalBytes), previousMonoCandidateSha256: hash(previousCandidate),
  initialManifestSha256: hash(await readFile(join(packet, "manifest.json"))),
  assemblerSha256: hash(await readFile(import.meta.filename)),
  workerSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  ffmpegSha256: hash(await readFile(values.ffmpeg)), sampleRate: 48000, frames: monoInfo.frames, channels: 2,
  processing: "One whole-output RNNoise stage; no gain, normalization, retime, fades or other processing.",
};
assert.equal(report.workerSha256, "45cbe7b92819efa15a1b5d4a974cdcbd26cac6301c041bf6e5818e50f7cf5773");
const range = { startUs: 0, endUs: 2700000 };
const service = new JourneyService(home, report), call = service.call.bind(service);
async function audio(selection, name) {
  const ready = await poll(() => call("audio.get", selection), (value) => value.state === "ready", name);
  const path = join(out, name + ".wav");
  await call("audio.get", selection, { output: path });
  const bytes = await readFile(path), info = readAudioWaveFile(path);
  assert.equal(info.frames, monoInfo.frames);
  assert.equal(info.sampleRate, 48000);
  assert.equal(info.channels, 2);
  const mcp = await service.mcp.callTool({ name: "audio.get", arguments: selection });
  assert.equal(mcp.structuredContent.ok, true);
  assert.deepEqual(Buffer.from(mcp.content.find((value) => value.type === "audio").data, "base64"), bytes);
  const pcm = bytes.subarray(info.dataOffset, info.dataOffset + info.dataBytes);
  report.receipts[name] = { selection, ready, mcp: mcp.structuredContent, sha256: hash(bytes), pcmSha256: hash(pcm), mcpMatchesCLI: true };
  return pcm;
}
try {
  const raw = join(home, "authored-stereo.f32"), source = join(out, "original-stereo.wav");
  await writeFile(raw, stereo);
  report.encodingArgs = ["-v", "error", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", raw, "-c:a", "pcm_f32le", source];
  await run(values.ffmpeg, report.encodingArgs, { timeout: 30000 });
  const encoded = await readFile(source), header = readAudioWaveFile(source);
  assert.deepEqual(encoded.subarray(header.dataOffset, header.dataOffset + header.dataBytes), stereo);
  report.authoredSource = { sha256: hash(encoded), pcmSha256: hash(stereo), leftGain: 1, rightGain: 0.5, everyFrameMatchesDeclaredGain: true };
  await service.start();
  const capability = (await call("processing.capabilities", {})).find((value) => value.type === "rnnoise");
  assert.equal(capability.execution, true);
  assert.equal(capability.implementationId, "rnnoise-70f1d256-d6021b7697677c4d2274c912975e143765552b0e6f25500aa660fdb4a9849be5-f480-s32768-flush2-delay960-independent-channels-v2");
  report.implementationId = capability.implementationId;
  const pending = await call("asset.import", { path: source, requestId: randomUUID() });
  await poll(() => call("job.get", { jobId: pending.jobId }), (value) => value.state === "ready", "authored source import");
  const asset = await call("asset.get", { assetId: hash(encoded) }), stream = asset.streams.find((value) => value.kind === "audio");
  assert.equal(asset.originUs, 0);
  assert.deepEqual(await audio({ assetId: asset.id, streamId: stream.id, range }, "source-stereo-delivery"), stereo);
  const made = await call("project.create", { requestId: randomUUID(), canvas: { width: 16, height: 16, fps: { numerator: 30, denominator: 1 }, background: "#000000ff" } });
  const projectId = made.project.projectId;
  const placed = await call("edit.apply", { projectId, expectedRevisionId: made.revision.id, requestId: randomUUID(), operations: [
    { operation: "track.add", label: "voice", track: { kind: "audio", order: 0 } },
    { operation: "place", clip: { trackId: { label: "voice" }, assetId: asset.id, streamId: stream.id,
      source: { kind: "range", range }, placement: { kind: "project", range } } },
  ] }, { transport: "mcp" });
  assert.deepEqual(await audio({ projectId, revisionId: placed.revision.id, range }, "dry-stereo"), stereo);
  report.sourceAndDryExact = true;
  const changed = await call("edit.apply", { projectId, expectedRevisionId: placed.revision.id, requestId: randomUUID(), operations: [
    { operation: "processing.set", target: { kind: "output" }, steps: [{ processor: { type: "rnnoise" } }] },
  ] }, { transport: "mcp" });
  report.processingReceipt = await call("processing.get", { projectId, revisionId: changed.revision.id, target: { kind: "output" } });
  const candidate = await audio({ projectId, revisionId: changed.revision.id, range }, "candidate-stereo");
  assert(!candidate.equals(stereo));
  const previousInfo = readAudioWaveFile(join(packet, "candidate.wav"));
  const previousPCM = previousCandidate.subarray(previousInfo.dataOffset, previousInfo.dataOffset + previousInfo.dataBytes);
  const lanes = [], left = Buffer.alloc(original.length), previousLeft = Buffer.alloc(original.length);
  for (let channel = 0; channel < 2; channel++) {
    let inputEnergy = 0, outputEnergy = 0, cross = 0;
    for (let frame = 0; frame < monoInfo.frames; frame++) {
      const at = frame * 8 + channel * 4, input = stereo.readFloatLE(at), output = candidate.readFloatLE(at);
      inputEnergy += input * input; outputEnergy += output * output; cross += input * output;
      if (channel === 0) {
        candidate.copy(left, frame * 4, at, at + 4);
        previousPCM.copy(previousLeft, frame * 4, at, at + 4);
      }
    }
    const fittedGain = cross / inputEnergy;
    lanes.push({ inputRms: Math.sqrt(inputEnergy / monoInfo.frames), outputRms: Math.sqrt(outputEnergy / monoInfo.frames), rmsGain: Math.sqrt(outputEnergy / inputEnergy), fittedGain,
      residualRmsAfterFittedGain: Math.sqrt(Math.max(0, outputEnergy - 2 * fittedGain * cross + fittedGain * fittedGain * inputEnergy) / monoInfo.frames) });
  }
  assert.deepEqual(left, previousLeft, "Left must preserve the frozen mono recipe result");
  report.channelMeasurements = { lanes, inputRightToLeftRms: lanes[1].inputRms / lanes[0].inputRms, outputRightToLeftRms: lanes[1].outputRms / lanes[0].outputRms,
    authority: "Whole-file numeric energy and fitted-gain residuals only; no perceived channel balance, spatial fidelity or speech-quality verdict." };
  report.leftMatchesFrozenMonoCandidateExact = true;
  assert.equal(hash(await readFile(join(packet, "original.wav"))), report.sourceOriginalSha256);
  assert.equal(hash(await readFile(join(packet, "candidate.wav"))), report.previousMonoCandidateSha256);
  assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), report.workerSha256);
  report.passed = true;
} finally {
  await service.stop();
  await writeFile(join(out, "stereo-receipts.json.gz"), gzipSync(JSON.stringify(report), { level: 9 }));
  const { trace, exchanges, receipts, processingReceipt, ...summary } = report;
  await writeFile(join(out, "stereo-manifest.json"), JSON.stringify({ ...summary, receipts: Object.fromEntries(Object.entries(receipts).map(([name, { ready, mcp, ...receipt }]) => [name, receipt])) }, null, 2) + "\n");
  await rm(home, { recursive: true, force: true });
}
