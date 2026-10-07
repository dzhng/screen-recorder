import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const [input, directory] = process.argv.slice(2);
assert.ok(
  input && directory,
  "Usage: node derive.mjs RETURNS_OVERLAP_SILENCE_F32 EXISTING_DESTINATION",
);
const bytes = await readFile(input);
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(hash(bytes), "e97f8450c758696193a8b9a8d0468217e24fa22a2d12631a2c37fa6eb20e9068");
const cases = [
  {
    name: "speaker00-quiet",
    speaker: "bspxd:spk00",
    frames: [0, 128000],
    sourceSeconds: [94, 102],
    gainDb: -12,
    cropSha256: "c54695914b801a076581fdcb8d81a71e2eeced17dca7736b57a6bc64127b85c4",
  },
  {
    name: "speaker01",
    speaker: "bspxd:spk01",
    frames: [144000, 272000],
    sourceSeconds: [33, 41],
    gainDb: 0,
    cropSha256: "c6c9276ecce7b1a13073535c7730d01c360976c1a21db3f9cb70ec8c4688971e",
  },
];
for (const c of cases) {
  const original = bytes.subarray(c.frames[0] * 4, c.frames[1] * 4);
  assert.equal(hash(original), c.cropSha256);
  const pcm = Buffer.from(original);
  for (let i = 0; i < pcm.length; i += 4)
    pcm.writeFloatLE(pcm.readFloatLE(i) * 10 ** (c.gainDb / 20), i);
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(3, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(64000, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(32, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(pcm.length, 40);
  pcm.copy(wav, 44);
  c.path = c.name + ".wav";
  c.bytes = wav.length;
  c.sha256 = hash(wav);
  c.pcmSha256 = hash(pcm);
  await writeFile(join(resolve(directory), c.path), wav, { flag: "wx" });
}
await writeFile(
  join(resolve(directory), "manifest.json"),
  JSON.stringify(
    {
      inputSha256: hash(bytes),
      sampleRate: 16000,
      channels: 1,
      format: "Float32 WAV",
      sourceAuthority:
        "specs/done/video-editing-feedback/assets/31-speaker-replication/alternative-evidence/nemotron-feasibility/protocol.json",
      classification:
        "Real different-speaker crops with explicit quiet-speaker attenuation control; not the removed trailer mix",
      cases,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
