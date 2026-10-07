import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { decodeRgba } from "./transition-reference-parity.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const width = 64;
const height = 48;
const frameBytes = width * height * 4;
const halfFrameBytes = width * height * 8;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function halfToFloat(bits) {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >>> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction ? Number.NaN : sign * Infinity;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function toByte(value) {
  assert(Number.isFinite(value), "RGBAHalf source contains a non-finite channel");
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function rgba8FromHalf(bytes, transform) {
  assert.equal(bytes.length, halfFrameBytes, "RGBAHalf frame dimensions");
  const source = Buffer.alloc(frameBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const sourceOffset = pixel * 8;
    const targetOffset = pixel * 4;
    for (let channel = 0; channel < 4; channel++)
      source[targetOffset + channel] = toByte(
        halfToFloat(view.getUint16(sourceOffset + channel * 2, true)),
      );
  }
  if (transform === "identity") return source;
  assert.equal(transform, "horizontal-flip");
  const flipped = Buffer.alloc(frameBytes);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      source.copy(
        flipped,
        (y * width + x) * 4,
        (y * width + width - 1 - x) * 4,
        (y * width + width - x) * 4,
      );
  return flipped;
}

function compareRgba(expected, candidate) {
  assert.equal(expected.length, candidate.length, "source frame dimensions");
  let differingBytes = 0;
  let differingPixels = 0;
  let maxChannelDelta = 0;
  let total = 0;
  for (let offset = 0; offset < expected.length; offset += 4) {
    let changed = false;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(expected[offset + channel] - candidate[offset + channel]);
      differingBytes += delta > 0 ? 1 : 0;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      total += delta;
      changed ||= delta > 0;
    }
    differingPixels += changed ? 1 : 0;
  }
  return {
    differingBytes,
    differingPixels,
    differingRatio: differingPixels / (width * height),
    maxChannelDelta,
    mae: total / expected.length,
  };
}

export async function runRgbaHalfProbeReplay(reportPath) {
  const absolute = resolve(reportPath);
  const reportBytes = await readFile(absolute);
  const report = JSON.parse(reportBytes);
  assert.equal(report.kind, "transition-rgba-half-source-conversion-probe");
  assert.equal(report.status, "open");
  assert.equal(report.recipe.width, width);
  assert.equal(report.recipe.height, height);
  assert.equal(report.gate.passed, false);
  assert.equal(
    report.gate.rule,
    "native-source-conditioned moving parity requires zero differing RGBA bytes",
  );
  const measurements = [];
  for (const [name, source] of Object.entries(report.sources)) {
    const sourceBytes = await readFile(resolve(root, source.path));
    assert.equal(hash(sourceBytes), source.sha256, `${name} source changed`);
    assert.equal(source.frameCount, source.frames.length);
    assert.equal(
      source.pixelFormat,
      "kCVPixelFormatType_64RGBAHalf",
      `${name} pixel format changed`,
    );
    assert.equal(source.bytesPerRow, width * 8, `${name} row stride changed`);
    assert.deepEqual(
      source.frames.map((frame) => frame.index),
      [0, 1, 2, 3],
      `${name} source must have unique frame indices`,
    );
    const decoded = await decodeRgba(resolve(root, source.path));
    assert.equal(decoded.length, source.frameCount * frameBytes, `${name} source frame count`);
    for (const frame of source.frames) {
      const bytes = await readFile(resolve(root, frame.path));
      assert.equal(bytes.length, halfFrameBytes, `${name} frame ${frame.index} dimensions`);
      assert.equal(hash(bytes), frame.sha256, `${name} frame ${frame.index} changed`);
      const native = rgba8FromHalf(bytes, source.transform);
      const ffmpeg = decoded.subarray(frame.index * frameBytes, (frame.index + 1) * frameBytes);
      const comparison = compareRgba(ffmpeg, native);
      assert.deepEqual(
        comparison,
        frame.comparison,
        `${name} frame ${frame.index} metrics changed`,
      );
      measurements.push(comparison);
    }
  }
  assert.equal(measurements.length, 8);
  return {
    kind: report.kind,
    status: report.status,
    frameCount: measurements.length,
    maxChannelDelta: Math.max(...measurements.map((row) => row.maxChannelDelta)),
    allFramesRetainResidual: measurements.every(
      (row) => row.maxChannelDelta === 1 && row.differingBytes > 0,
    ),
    reportSha256: hash(reportBytes),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reportPath = process.argv[2];
  assert(reportPath, "Usage: node transition-rgba-half-source-probe.mjs REPORT_PATH");
  console.log(JSON.stringify(await runRgbaHalfProbeReplay(reportPath), null, 2));
}
