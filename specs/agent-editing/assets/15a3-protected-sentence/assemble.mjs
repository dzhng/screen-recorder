import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { JourneyService, hash, poll, root } from "../../../../packages/test-harness/editing/source-evidence-fixture.mjs";
import { readAudioWaveFile } from "../../../../packages/core/dist/audio-wave.js";

const { values } = parseArgs({ options: { out: { type: "string" } } });
assert(values.out && process.env.SCREENREC_NATIVE);
const out = resolve(values.out);
await mkdir(out);
const home = await mkdtemp("/tmp/screenrec-protected-sentence-");
const source = join(root, "fixtures/narrated-workbench/narration.mov");
const sourceSha256 = "2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c";
const workerSha256 = "45cbe7b92819efa15a1b5d4a974cdcbd26cac6301c041bf6e5818e50f7cf5773";
assert.equal(hash(await readFile(source)), sourceSha256);
assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), workerSha256);
const transcriptPath = join(root, "specs/recording-for-ai/assets/speech/boundaries/transcript.json");
const rows = JSON.parse(await readFile(transcriptPath, "utf8"));
const words = rows.filter((row) => row.type === "word" && row.ordinal >= 160 && row.ordinal <= 166);
assert.equal(words.map((word) => word.text).join(" "), "the sample offer says this is free.");
// File-aligned endpoints keep source floor extraction and project sampling on the same frames.
const sourceRange = { startUs: 72008675, endUs: 74708675 };
const originUs = 48675;
const range = { startUs: 0, endUs: sourceRange.endUs - sourceRange.startUs };
const report = {
  passed: false, listening: "pending", trace: [], exchanges: [], receipts: {},
  source: "fixtures/narrated-workbench/narration.mov", sourceSha256, workerSha256,
  assemblerSha256: hash(await readFile(import.meta.filename)),
  sourceOriginUs: originUs, sourceRange,
  text: "The sample offer says this is free.",
  textAuthority: "Inherited ASR only; no independent word boundaries or listening pass.",
  annotation: { sha256: hash(await readFile(transcriptPath)), words,
    preceding: rows.find((row) => row.ordinal === 159), following: rows.find((row) => row.ordinal === 167),
    leadingMarginUs: words[0].sourceRange.startUs - sourceRange.startUs,
    trailingMarginUs: sourceRange.endUs - words.at(-1).sourceRange.endUs },
  processing: "Whole-output RNNoise only; no gain, retime, normalization, fades, voice generation or ambience fill.",
  runtimes: {},
};
for (const path of ["apps/cli/dist/main.js", "apps/service/dist/project-service.js", "packages/core/dist/audio.js", "packages/composition/dist/index.js"])
  report.runtimes[path] = hash(await readFile(join(root, path)));
const service = new JourneyService(home, report), call = service.call.bind(service);
async function audio(selection, name, frames, channels) {
  const ready = await poll(() => call("audio.get", selection), (value) => value.state === "ready", name);
  const path = join(out, name + ".wav");
  await call("audio.get", selection, { output: path });
  const bytes = await readFile(path), info = readAudioWaveFile(path);
  assert.equal(info.sampleRate, 48000);
  assert.equal(info.frames, frames);
  assert.equal(info.channels, channels);
  const mcp = await service.mcp.callTool({ name: "audio.get", arguments: selection });
  assert.equal(mcp.structuredContent.ok, true);
  assert.deepEqual(Buffer.from(mcp.content.find((value) => value.type === "audio").data, "base64"), bytes);
  const pcm = bytes.subarray(info.dataOffset, info.dataOffset + info.dataBytes);
  report.receipts[name] = { selection, ready, mcp: mcp.structuredContent, sha256: hash(bytes),
    pcmSha256: hash(pcm), frames, channels, sampleRate: 48000, mcpMatchesCLI: true };
  return pcm;
}
try {
  await service.start();
  const capability = (await call("processing.capabilities", {})).find((value) => value.type === "rnnoise");
  assert.equal(capability.execution, true);
  assert.equal(capability.implementationId, "rnnoise-70f1d256-d6021b7697677c4d2274c912975e143765552b0e6f25500aa660fdb4a9849be5-f480-s32768-flush2-delay960-independent-channels-v2");
  report.rnnoiseCapability = { type: capability.type, execution: capability.execution, implementationId: capability.implementationId };
  const admission = await call("asset.import", { path: source, requestId: randomUUID() });
  await poll(() => call("job.get", { jobId: admission.jobId }), (value) => value.state === "ready", "source import");
  const asset = await call("asset.get", { assetId: sourceSha256 });
  const stream = asset.streams.find((value) => value.kind === "audio");
  report.asset = asset;
  // Imported assets normalize their common media origin; annotation clocks retain it.
  assert.equal(asset.originUs, originUs);
  const importedRange = { startUs: sourceRange.startUs - originUs, endUs: sourceRange.endUs - originUs };
  report.importedRange = importedRange;
  const frames = 129600;
  const original = await audio({ assetId: asset.id, streamId: stream.id, range: importedRange }, "original", frames, 1);
  const made = await call("project.create", { requestId: randomUUID(), canvas: {
    width: 16, height: 16, fps: { numerator: 30, denominator: 1 }, background: "#000000ff" } });
  const projectId = made.project.projectId;
  const placed = await call("edit.apply", { projectId, expectedRevisionId: made.revision.id, requestId: randomUUID(), operations: [
    { operation: "track.add", label: "voice", track: { kind: "audio", order: 0 } },
    { operation: "place", clip: { trackId: { label: "voice" }, assetId: asset.id, streamId: stream.id,
      source: { kind: "range", range: importedRange }, placement: { kind: "project", range } } },
  ] }, { transport: "mcp" });
  const dry = await audio({ projectId, revisionId: placed.revision.id, range }, "dry", frames, 2);
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < 2; channel++)
      assert(original.subarray(frame * 4, frame * 4 + 4).equals(dry.subarray(frame * 8 + channel * 4, frame * 8 + channel * 4 + 4)), "Dry delivery must preserve every source sample in both channels");
  report.dryStereoDuplicationExact = true;
  report.edgeLevels = Object.fromEntries(["leading", "trailing"].map((edge) => {
    const first = edge === "leading" ? 0 : frames - 2400;
    let energy = 0, peak = 0;
    for (let i = first; i < first + 2400; i++) {
      const value = original.readFloatLE(i * 4);
      energy += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    return [edge, { frames: 2400, rmsDbFS: 20 * Math.log10(Math.sqrt(energy / 2400)), peakDbFS: 20 * Math.log10(peak),
      authority: "Numerical edge level only; it cannot prove silence or word boundaries." }];
  }));
  const changed = await call("edit.apply", { projectId, expectedRevisionId: placed.revision.id, requestId: randomUUID(), operations: [
    { operation: "processing.set", target: { kind: "output" }, steps: [{ processor: { type: "rnnoise" } }] },
  ] }, { transport: "mcp" });
  report.processingReceipt = await call("processing.get", { projectId, revisionId: changed.revision.id, target: { kind: "output" } });
  const candidate = await audio({ projectId, revisionId: changed.revision.id, range }, "candidate", frames, 2);
  assert(!candidate.equals(dry), "Candidate must differ from dry audio");
  report.changedPCM = true;
  report.passed = true;
  assert.equal(hash(await readFile(source)), sourceSha256);
  assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), workerSha256);
} finally {
  await service.stop();
  await writeFile(join(out, "receipts.json.gz"), gzipSync(JSON.stringify(report), { level: 9 }));
  const { trace, exchanges, asset, receipts, processingReceipt, ...summary } = report;
  await writeFile(join(out, "manifest.json"), JSON.stringify({ ...summary, receipts: Object.fromEntries(Object.entries(receipts).map(([name, { ready, mcp, ...receipt }]) => [name, receipt])) }, null, 2) + "\n");
  await rm(home, { recursive: true, force: true });
}
