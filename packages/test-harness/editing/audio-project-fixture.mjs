import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";

export function sample(source, frame, channel, rate = 48000, poison = false) {
  if (poison && frame >= rate * 0.4 && frame < rate * 0.6) return channel ? -30000 : 30000;
  const phase = frame % rate;
  const base = source === 0 ? [4096, -8192] : [-2048, 1024];
  const marker = source === 0 ? [12000, -4000] : [-14000, 15000];
  return phase === 13 || phase === Math.floor(rate / 2) || phase === rate - 1
    ? marker[channel]
    : base[channel];
}
export function sourcePeriod(source, rate = 48000, poison = false) {
  const bytes = Buffer.alloc(rate * 8);
  for (let frame = 0; frame < rate; frame++)
    for (let c = 0; c < 2; c++)
      bytes.writeFloatLE(sample(source, frame, c, rate, poison) / 32768, frame * 8 + c * 4);
  return bytes;
}
export function projectPeriod() {
  const bytes = Buffer.alloc(48000 * 8);
  for (let frame = 0; frame < 48000; frame++)
    for (let c = 0; c < 2; c++) {
      const a = sample(0, frame, c) / 32768,
        b = sample(1, frame + 12000, c) / 32768;
      const mixed = Math.fround(Math.fround(a * 0.5) + Math.fround(b * 0.25));
      bytes.writeFloatLE(Math.fround(mixed * 2), frame * 8 + c * 4);
    }
  return bytes;
}
export function periodicBytes(period, start, frames) {
  assert.ok(frames <= 128000, "Only bounded excerpts may be assembled");
  const bytes = Buffer.alloc(frames * 8),
    count = period.length / 8;
  for (let at = 0; at < frames;) {
    const from = (start + at) % count,
      take = Math.min(frames - at, count - from);
    period.copy(bytes, at * 8, from * 8, (from + take) * 8);
    at += take;
  }
  return bytes;
}
export function periodicHash(period, seconds) {
  const hash = createHash("sha256");
  for (let i = 0; i < seconds; i++) hash.update(period);
  return hash.digest("hex");
}
export async function digest(path, options = {}) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path, { highWaterMark: 65536, ...options }))
    hash.update(chunk);
  return hash.digest("hex");
}
export async function writeSourceWave(
  path,
  { source, rate = 48000, seconds = 61, poison = false },
) {
  const frames = rate * seconds,
    header = Buffer.alloc(44),
    block = Buffer.alloc(4096 * 4);
  header.write("RIFF");
  header.writeUInt32LE(36 + frames * 4, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(frames * 4, 40);
  const file = await open(path, "wx");
  async function write(bytes) {
    for (let at = 0; at < bytes.length;) {
      const { bytesWritten } = await file.write(bytes, at, bytes.length - at);
      assert.ok(bytesWritten > 0);
      at += bytesWritten;
    }
  }
  try {
    await write(header);
    for (let start = 0; start < frames; start += 4096) {
      const count = Math.min(4096, frames - start);
      for (let f = 0; f < count; f++)
        for (let c = 0; c < 2; c++)
          block.writeInt16LE(sample(source, start + f, c, rate, poison), f * 4 + c * 2);
      await write(block.subarray(0, count * 4));
    }
  } finally {
    await file.close();
  }
}
export async function decodedHash(path) {
  const child = spawn(
    "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-i",
      path,
      "-map",
      "0:a:0",
      "-c:a",
      "pcm_f32le",
      "-f",
      "f32le",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const closed = once(child, "close");
  let error = "",
    bytes = 0;
  child.stderr.on("data", (value) => {
    error += value;
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 30000);
  const hash = createHash("sha256");
  try {
    for await (const block of child.stdout) {
      hash.update(block);
      bytes += block.length;
    }
    const [code, signal] = await closed;
    assert.equal(signal, null, "Independent decoder deadline");
    assert.equal(code, 0, error);
    return { sha256: hash.digest("hex"), frames: bytes / 8 };
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null) child.kill("SIGKILL");
    await closed;
  }
}
export function waveHeader(bytes, totalBytes, rate = 48000) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  assert.equal(bytes.readUInt32LE(4) + 8, totalBytes);
  let format = false;
  for (let at = 12; at + 8 <= bytes.length;) {
    const name = bytes.toString("ascii", at, at + 4),
      size = bytes.readUInt32LE(at + 4);
    at += 8;
    if (name === "fmt ") {
      assert.ok(size >= 16 && at + size <= bytes.length);
      assert.equal(bytes.readUInt16LE(at), 3);
      assert.equal(bytes.readUInt16LE(at + 2), 2);
      assert.equal(bytes.readUInt32LE(at + 4), rate);
      assert.equal(bytes.readUInt32LE(at + 8), rate * 8);
      assert.equal(bytes.readUInt16LE(at + 12), 8);
      assert.equal(bytes.readUInt16LE(at + 14), 32);
      format = true;
    }
    if (name === "data") {
      assert.ok(format);
      assert.equal(size % 8, 0);
      assert.equal(at + size, totalBytes);
      return { offset: at, bytes: size, frames: size / 8 };
    }
    at += size + (size % 2);
  }
  assert.fail("WAV data header exceeds bounded header read");
}
