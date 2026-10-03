import assert from "node:assert/strict";
import test from "node:test";
import { authoredDryBlocks } from "./denoise-routing.mjs";
import { longRoutingPlacements } from "./routing-topology.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { compareWavePCM } from "./denoise-pcm.mjs";

test("authored long routing PCM resets source clocks and preserves the simultaneous tail", () => {
  const placements = longRoutingPlacements(3, 5, 2);
  const period = Buffer.alloc(48000 * 8);
  for (let i = 0; i < 48000; i++) {
    period.writeFloatLE(i / 65536, i * 8);
    period.writeFloatLE(-i / 65536, i * 8 + 4);
  }
  const actual = Buffer.concat([...authoredDryBlocks(period, placements, 2, 144000)]);
  const samples = [
    [31998, 31998 / 131072], [31999, 0],
    [63998, 31999 / 131072], [63999, 0],
    [95998, 31999 / 131072], [95999, 32000 / 131072],
    [96001, 1 / 65536], [143999, 47999 / 65536],
  ];
  for (const [frame, expected] of samples) {
    assert.equal(actual.readFloatLE(frame * 8), expected, `left frame ${frame}`);
    assert.equal(actual.readFloatLE(frame * 8 + 4), -expected || 0, `right frame ${frame}`);
  }
  const missing = Buffer.concat([...authoredDryBlocks(period, placements.slice(0, -1), 2, 144000)]);
  assert.notEqual(missing.readUInt32LE(96001 * 8), actual.readUInt32LE(96001 * 8));
  assert.equal(actual.length, 144000 * 8);
});

test("streamed learned comparison applies exact compensation and rejects a wrong final channel", async t => {
  const home = await mkdtemp("/tmp/sr-denoise-oracle-");
  t.after(() => rm(home, { recursive: true, force: true }));
  const pcm = Buffer.alloc(24);
  [0.25, -0.5, 1, -2, 3, -4].forEach((v, i) => pcm.writeFloatLE(v, i * 4));
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(3, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(384000, 28);
  wav.writeUInt16LE(8, 32); wav.writeUInt16LE(32, 34); wav.write("data", 36);
  wav.writeUInt32LE(pcm.length, 40); pcm.copy(wav, 44);
  const file = join(home, "actual.wav"), paths = [join(home, "left.f32"), join(home, "right.f32")];
  await writeFile(file, wav);
  for (let c = 0; c < 2; c++) {
    const lane = Buffer.alloc(963 * 4);
    for (let i = 0; i < 3; i++) pcm.copy(lane, (960 + i) * 4, i * 8 + c * 4, i * 8 + c * 4 + 4);
    await writeFile(paths[c], lane);
  }
  assert.match(await compareWavePCM(file, 3, paths), /^[a-f0-9]{64}$/);
  await assert.rejects(compareWavePCM(file, 4, paths), /3 !== 4/);
  // Same length and valid WAV; only the last channel differs from the fixed reference.
  wav.writeFloatLE(5, 44 + 20); await writeFile(file, wav);
  await assert.rejects(compareWavePCM(file, 3, paths), error => {
    assert.match(error.message, /"firstDifferentFrame":2,"channel":1/);
    assert(error.message.length < 1000);
    return true;
  });
  pcm.copy(wav, 44); await writeFile(file, wav);
  await writeFile(paths[1], Buffer.alloc(962 * 4));
  await assert.rejects(compareWavePCM(file, 3, paths), /8 !== 12/);
});
