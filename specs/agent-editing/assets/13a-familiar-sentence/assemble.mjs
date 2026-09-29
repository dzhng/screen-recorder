import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { waveHeader } from "../../../../packages/test-harness/editing/audio-project-fixture.mjs";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
assert.equal(process.argv.length, 3, "Choose one fresh output directory");
const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: false });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourceRoot = join(root, "specs/agent-editing/assets/12c-familiar-sentence");
const sourceManifest = JSON.parse(readFileSync(join(sourceRoot, "manifest.json")));
const source = readFileSync(join(sourceRoot, "original.wav"));
assert.equal(hash(source), sourceManifest.files.find((f) => f.path === "original.wav").sha256);
const worker = join(root, "helpers/stretch/.build/release/StretchParity");
const parity = JSON.parse(
  readFileSync(
    join(root, "specs/agent-editing/assets/13b-native-stretch-parity/root-verification.json"),
  ),
);
assert.equal(hash(readFileSync(worker)), parity.workerSha256);
const header = waveHeader(source, source.length);
const frames = header.bytes / 8;
const selected = Buffer.alloc(frames * 4);
for (let i = 0; i < frames; i++) {
  const left = source.subarray(header.offset + i * 8, header.offset + i * 8 + 4);
  assert.deepEqual(left, source.subarray(header.offset + i * 8 + 4, header.offset + i * 8 + 8));
  left.copy(selected, i * 4);
}
writeFileSync(join(out, "selected.f32"), selected);
const manifest = {
  text: "Okay, so this is the recorder workbench.",
  textAuthority: sourceManifest.source.textAuthority,
  sourceSha256: hash(source),
  selectedPcmSha256: hash(selected),
  workerSha256: parity.workerSha256,
  policy:
    "Frozen mono48k selected-only exact recipe; unity gain; no added fade, trimming or context",
  listening: "UNVERIFIED; no whole-word timing annotation or naturalness verdict",
  publicRetimeEnabled: false,
  files: [],
};
for (const [name, numerator, denominator] of [
  ["original", 1, 1],
  ["slower-0.8x", 4, 5],
  ["slower-0.9x", 9, 10],
  ["faster-1.25x", 5, 4],
]) {
  const wanted = Math.floor((frames * denominator) / numerator);
  const output = join(out, name + ".f32");
  const stdout = execFileSync(
    worker,
    [join(out, "selected.f32"), output, "0", String(frames), String(wanted), "48000"],
    { encoding: "utf8", timeout: 60000 },
  );
  assert.equal(JSON.parse(stdout).frames, wanted);
  const pcm = readFileSync(output);
  assert.equal(pcm.length, wanted * 4);
  for (let i = 0; i < wanted; i++) assert(Number.isFinite(pcm.readFloatLE(i * 4)));
  if (numerator === denominator) assert.deepEqual(pcm, selected);
  const wav = Buffer.alloc(44);
  wav.write("RIFF");
  wav.writeUInt32LE(pcm.length + 36, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(3, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(192000, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(32, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(pcm.length, 40);
  const bytes = Buffer.concat([wav, pcm]);
  writeFileSync(join(out, name + ".wav"), bytes);
  manifest.files.push({
    path: name + ".wav",
    rate: { numerator, denominator },
    frames: wanted,
    bytes: bytes.length,
    sha256: hash(bytes),
    pcmSha256: hash(pcm),
  });
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(
  JSON.stringify({
    frames,
    outputs: manifest.files.map((f) => ({ path: f.path, frames: f.frames })),
    listening: manifest.listening,
  }),
);
