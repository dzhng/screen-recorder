import historicalPacket from "../../../specs/done/agent-editing/assets/12d-complete-sentence/manifest.json" with { type: "json" };
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// This fixed-corpus annotation packet makes no new ASR or audible-word labels.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { values } = parseArgs({ options: { native: { type: "string" }, out: { type: "string" } } });
assert.ok(values.native && values.out, "Pass --native and a fresh --out directory");
const binary = resolve(values.native),
  out = resolve(values.out);
assert.equal(
  createHash("sha256").update(readFileSync(binary)).digest("hex"),
  historicalPacket.native.sha256,
  "This historical sentence packet requires the worker pinned by its retained 12d manifest",
);
mkdirSync(out); // Refuse replacing any previous evidence packet.
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + "\n");
const source = join(root, "fixtures/narrated-workbench/narration.mov");
const sourceBytes = readFileSync(source);
assert.equal(hash(sourceBytes), "2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c");
const transcriptPath = join(root, "specs/done/agent-editing/assets/12-speech/transcript.json");
const labelPath = join(root, "specs/done/agent-editing/assets/00-baseline/speech-labels.json");
const labels = json(labelPath),
  words = json(transcriptPath).filter((w) => /^w(11[1-9]|12[0-3])$/.test(w.id));
assert.equal(
  words.map((w) => w.text).join(" "),
  "So let's do the first paragraph, uh this page is a recording fixture.",
);
const target = labels.targets.find((v) => v.id === "filler-uh-54s"),
  cut = target.sourceRange;
const context = {
  startUs: words[0].sourceRange.startUs - 250000,
  endUs: words.at(-1).sourceRange.endUs + 250000,
};
const spans = [
  { startUs: context.startUs, endUs: cut.startUs },
  { startUs: cut.endUs, endUs: context.endUs },
];
const journal = readFileSync(
  join(root, "fixtures/narrated-workbench/capture.journal.jsonl"),
  "utf8",
)
  .trim()
  .split("\n")
  .map(JSON.parse);
const samples = journal.filter((v) => v.event === "audioSamples" && v.data.role === "narration");
for (let i = 1; i < samples.length; i++)
  assert.ok(samples[i].data.startUs - samples[i - 1].data.endUs <= 2000);
const available = [{ startUs: samples[0].data.startUs, endUs: samples.at(-1).data.endUs }];
const calls = [];
function render(id, path, retained) {
  const request = {
    id,
    operation: "media.audio",
    params: {
      tracks: [{ role: "narration", source: path, sourceOffsetUs: 0, available }],
      spans: retained,
      output: join(out, id + ".wav"),
    },
  };
  save(id + "-request.json", request);
  const child = spawnSync(
    "/usr/bin/sandbox-exec",
    ["-p", "(version 1)(allow default)(deny network*)", binary],
    {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  writeFileSync(join(out, id + ".log"), child.stderr ?? "");
  assert.equal(child.status, 0, child.stderr || String(child.error));
  const response = JSON.parse(child.stdout);
  save(id + "-response.json", response);
  assert.equal(response.ok, true, JSON.stringify(response));
  const bytes = readFileSync(request.params.output);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  let pcm, dataOffset, format;
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4),
      name = bytes.toString("ascii", at, at + 4);
    assert.ok(at + 8 + size <= bytes.length);
    if (name === "fmt ")
      format = [
        bytes.readUInt16LE(at + 8),
        bytes.readUInt16LE(at + 10),
        bytes.readUInt32LE(at + 12),
        bytes.readUInt16LE(at + 22),
      ];
    if (name === "data") {
      dataOffset = at + 8;
      pcm = bytes.subarray(dataOffset, dataOffset + size);
    }
    at += 8 + size + (size % 2);
  }
  assert.deepEqual(format, [3, 1, 48000, 32]);
  assert.ok(pcm && pcm.length % 4 === 0);
  assert.equal(response.data.frames, pcm.length / 4);
  const artifact = {
    file: id + ".wav",
    sha256: hash(bytes),
    pcmSha256: hash(pcm),
    frames: pcm.length / 4,
    bytes: bytes.length,
    dataOffset,
    response: response.data,
  };
  calls.push(artifact);
  return { bytes, pcm, artifact };
}
const original = render("original", source, [context]);
const candidate = render("candidate-remove-uh", source, spans);
const frames = (us) => Math.round((us * 48000) / 1000000);
const joinFrame = frames(cut.startUs - context.startUs),
  removedFrames = frames(cut.endUs - cut.startUs),
  rampFrames = 240;
assert.equal(original.pcm.length / 4, frames(context.endUs - context.startUs));
assert.equal(candidate.pcm.length / 4, original.pcm.length / 4 - removedFrames);
function retainedEqual(pcm) {
  assert.ok(
    pcm
      .subarray(0, (joinFrame - rampFrames) * 4)
      .equals(original.pcm.subarray(0, (joinFrame - rampFrames) * 4)),
    "left retained PCM differs",
  );
  assert.ok(
    pcm
      .subarray((joinFrame + rampFrames) * 4)
      .equals(original.pcm.subarray((joinFrame + removedFrames + rampFrames) * 4)),
    "right retained PCM differs",
  );
}
retainedEqual(candidate.pcm);
const damaged = Buffer.from(candidate.pcm);
damaged[1000] ^= 1;
assert.throws(() => retainedEqual(damaged), /left retained PCM differs/);
// Use the installed packet inspector only for this pinned uncompressed fixture.
// Fragmented MOV stores intervening headers, so payload is reconstructed from
// packet positions and proved equal before any source-byte mutation.
const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_streams",
    "-show_packets",
    "-show_entries",
    "stream=codec_name,sample_rate,channels:packet=pts,size,pos",
    "-of",
    "json",
    source,
  ],
  { encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
);
assert.equal(probe.status, 0, probe.stderr || String(probe.error));
const packetInfo = JSON.parse(probe.stdout);
assert.equal(packetInfo.streams.length, 1);
assert.equal(packetInfo.streams[0].codec_name, "pcm_f32le");
assert.equal(packetInfo.streams[0].sample_rate, "48000");
assert.equal(packetInfo.streams[0].channels, 1);
let logical = 0;
const packets = packetInfo.packets.map((packet) => {
  const start = Number(packet.pos),
    size = Number(packet.size);
  assert.ok(
    Number.isSafeInteger(start) &&
      Number.isSafeInteger(size) &&
      start >= 0 &&
      size > 0 &&
      size % 4 === 0 &&
      start + size <= sourceBytes.length,
  );
  const row = { start, size, logical };
  logical += size;
  return row;
});
const payload = Buffer.concat(packets.map((p) => sourceBytes.subarray(p.start, p.start + p.size)));
const payloadOffset = payload.indexOf(original.pcm);
assert.ok(
  payloadOffset >= 0 && payloadOffset % 4 === 0,
  "original excerpt must match complete packet PCM exactly",
);
assert.equal(payload.indexOf(original.pcm, payloadOffset + 1), -1, "payload match must be unique");
const poison = Buffer.from(sourceBytes),
  poisonStart = payloadOffset + joinFrame * 4,
  poisonEnd = poisonStart + removedFrames * 4,
  changedSourceBytes = [];
for (const packet of packets) {
  const start = Math.max(poisonStart, packet.logical),
    end = Math.min(poisonEnd, packet.logical + packet.size);
  if (end <= start) continue;
  const fileStart = packet.start + start - packet.logical,
    fileEnd = packet.start + end - packet.logical;
  for (let at = fileStart; at < fileEnd; at += 4)
    poison.writeFloatLE(((start - poisonStart + at - fileStart) / 4) % 2 ? -0.875 : 0.875, at);
  changedSourceBytes.push([fileStart, fileEnd]);
}
assert.equal(
  changedSourceBytes.reduce((n, [a, b]) => n + b - a, 0),
  removedFrames * 4,
);
let previous = 0;
for (const [start, end] of changedSourceBytes) {
  assert.ok(start >= previous);
  assert.ok(poison.subarray(previous, start).equals(sourceBytes.subarray(previous, start)));
  previous = end;
}
assert.ok(poison.subarray(previous).equals(sourceBytes.subarray(previous)));
save("source-packets.json", packetInfo);
const poisonPath = join(out, "poison-source.mov");
writeFileSync(poisonPath, poison);
try {
  const poisonedOriginal = render("poison-original-control", poisonPath, [context]);
  assert.ok(!poisonedOriginal.pcm.equals(original.pcm), "positive control must expose poison");
  assert.ok(
    poisonedOriginal.pcm.subarray(0, joinFrame * 4).equals(original.pcm.subarray(0, joinFrame * 4)),
  );
  assert.ok(
    poisonedOriginal.pcm
      .subarray((joinFrame + removedFrames) * 4)
      .equals(original.pcm.subarray((joinFrame + removedFrames) * 4)),
  );
  const poisonedCandidate = render("poison-candidate-control", poisonPath, spans);
  assert.ok(poisonedCandidate.pcm.equals(candidate.pcm), "excluded source changed candidate PCM");
} finally {
  rmSync(poisonPath);
}
assert.equal(hash(readFileSync(source)), hash(sourceBytes), "source fixture changed");
save("annotations.json", {
  textAuthority: "Frozen ASR proposal; no fresh transcription or independent audition",
  originalText: "So let’s do the first paragraph, uh, this page is a recording fixture.",
  candidateText: "So let’s do the first paragraph, this page is a recording fixture.",
  punctuation: "Commas around uh are presentation only; spoken word tokens below remain unchanged.",
  words,
  target,
  protectedNeighbors: [
    { wordId: "w116", text: "paragraph", independentRange: null },
    { wordId: "w118", text: "this", independentRange: null },
  ],
  independentFillerInventory: null,
  independentRepetitionIntent: null,
  joinListening: "UNVERIFIED",
  audibleSentenceCompleteness:
    "UNVERIFIED; all w111–w123 proposed word ranges are included with 250ms outer guards",
});
save("manifest.json", {
  scope:
    "Complete proposed sentence context and explicit filler candidate, not cleanup quality acceptance",
  source: {
    path: "fixtures/narrated-workbench/narration.mov",
    sha256: hash(sourceBytes),
    trackOriginUsFromInheritedLabels: labels.narrationFileOriginUs,
    available,
  },
  native: { path: binary, sha256: hash(readFileSync(binary)) },
  harnessSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  transcriptSha256: hash(readFileSync(transcriptPath)),
  labelsSha256: hash(readFileSync(labelPath)),
  context,
  contextPolicy:
    "250ms before w111 and after w123; ASR-derived selection, not independent boundaries",
  cut,
  mapping: [
    { source: spans[0], outputFrames: [0, joinFrame] },
    { source: spans[1], outputFrames: [joinFrame, candidate.pcm.length / 4] },
  ],
  sampleRate: 48000,
  channels: 1,
  removedFrames,
  joinFrame,
  nativeJoinRampFramesPerSide: rampFrames,
  exactRetainedOutsideRamps: true,
  checkerMutationRejected: true,
  poison: {
    sourceSha256: hash(poison),
    payloadOffset,
    changedSourceBytes,
    positiveControlChangedOnlyRemovedFrames: true,
    candidatePcmExactlyUnchanged: true,
    sourceCopyRemovedAfterVerification: true,
  },
  artifacts: calls,
  network: "OS sandbox denies network for every native invocation",
  playback: "not performed",
  selectedSpeechEngine: null,
  remaining: labels.missing,
});
console.log(
  JSON.stringify({
    out,
    passed: true,
    originalFrames: original.pcm.length / 4,
    candidateFrames: candidate.pcm.length / 4,
  }),
);
