import { test, expect } from "vitest";
import { spectralLayout, spectralWindows } from "./audio-spectrum.js";
import type { RetainedRead } from "./files.js";
function fixture(samples: number[][], start = 0, rate = 48000) {
  const channels = samples[0]!.length as 1 | 2,
    bytes = Buffer.alloc(44 + samples.length * channels * 4);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * channels * 4, 28);
  bytes.writeUInt16LE(channels * 4, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  samples.forEach((row, i) =>
    row.forEach((v, c) => bytes.writeFloatLE(v, 44 + (i * channels + c) * 4)),
  );
  const reads: { position: number; bytes: number }[] = [];
  const read: RetainedRead = {
    bytes: bytes.length,
    read(buffer, position) {
      const count = Math.min(buffer.length, bytes.length - position);
      buffer.set(bytes.subarray(position, position + count));
      reads.push({ position, bytes: count });
      return count;
    },
    release() {},
  };
  return {
    read,
    reads,
    audio: {
      bytes: bytes.length,
      sampleRate: rate,
      channels,
      frames: samples.length,
      sampleRange: { start, end: start + samples.length },
    },
  };
}
function directDensity(samples: number[], rate: number, window: "hann" | "rectangular") {
  const n = samples.length,
    weights = samples.map((_, i) =>
      window === "hann" ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n) : 1,
    ),
    energy = weights.reduce((sum, v) => sum + v * v, 0);
  return Array.from({ length: n / 2 + 1 }, (_, k) => {
    let re = 0,
      im = 0;
    for (let i = 0; i < n; i++) {
      const value = Math.fround(samples[i]!) * weights[i]!;
      re += value * Math.cos((-2 * Math.PI * k * i) / n);
      im += value * Math.sin((-2 * Math.PI * k * i) / n);
    }
    return ((re * re + im * im) / (rate * energy)) * (k === 0 || k === n / 2 ? 1 : 2);
  });
}
test("planned surrounding PCM preserves every spectral column when the delivered file is ranged", async () => {
  const samples = Array.from({ length: 256 }, (_, i) => [Math.sin(i * 0.3), i === 97 ? 1 : 0.125]);
  const full = fixture(samples);
  const options = { fftFrames: 64, hopFrames: 16, sampleRange: { start: 99, end: 137 } };
  const layout = spectralLayout(full.audio, options);
  expect(layout.context).toEqual({ start: 72, end: 168 });
  const clipped = fixture(
    samples.slice(layout.context.start, layout.context.end),
    layout.context.start,
  );
  const expected = await spectralWindows(
    full.read,
    full.audio,
    options,
    new AbortController().signal,
  );
  const actual = await spectralWindows(
    clipped.read,
    clipped.audio,
    options,
    new AbortController().signal,
  );
  expect(actual.columns).toEqual(expected.columns);
  expect(actual.density).toEqual(expected.density);
  expect(actual.readFrames).toBe(expected.readFrames);
});
test.each(["hann", "rectangular"] as const)(
  "FFT matches independent direct DFT for %s without merging stereo or removing DC",
  async (window) => {
    const samples = Array.from({ length: 64 }, (_, i) => [
      0.125 + Math.sin((2 * Math.PI * 3 * i) / 32) * 0.5,
      (i === 7 ? 0.75 : 0) - 0.0625,
    ]);
    const f = fixture(samples),
      result = await spectralWindows(
        f.read,
        f.audio,
        { fftFrames: 32, hopFrames: 32, window },
        new AbortController().signal,
      );
    expect(result.columns).toEqual([
      {
        gridStart: 0,
        sampleRange: { start: 0, end: 32 },
        center: 16,
        analysis: { start: 0, end: 32 },
        available: { start: 0, end: 32 },
        partial: false,
      },
      {
        gridStart: 32,
        sampleRange: { start: 32, end: 64 },
        center: 48,
        analysis: { start: 32, end: 64 },
        available: { start: 32, end: 64 },
        partial: false,
      },
    ]);
    expect(result.frequency).toEqual({ bins: 17, binHz: 1500, firstHz: 0, lastHz: 24000 });
    for (let column = 0; column < 2; column++)
      for (let c = 0; c < 2; c++) {
        const oracle = directDensity(
          samples.slice(column * 32, (column + 1) * 32).map((row) => row[c]!),
          48000,
          window,
        );
        oracle.forEach((expected, k) =>
          expect(result.density[(column * 2 + c) * 17 + k]).toBeCloseTo(expected, 13),
        );
      }
  },
);

test("known tones integrate to mean-square power and DC/Nyquist are not doubled", async () => {
  for (const kind of ["dc", "nyquist", "tone"] as const) {
    const samples = Array.from({ length: 64 }, (_, i) => [
      kind === "dc"
        ? 0.25
        : kind === "nyquist"
          ? i % 2
            ? -0.5
            : 0.5
          : Math.sin((2 * Math.PI * 5 * i) / 64) * 0.5,
    ]);
    const f = fixture(samples, 0, 6400),
      result = await spectralWindows(
        f.read,
        f.audio,
        { fftFrames: 64, hopFrames: 64, window: "rectangular" },
        new AbortController().signal,
      );
    const expected = kind === "dc" ? 0.0625 : 0.25 * (kind === "tone" ? 0.5 : 1);
    expect(
      [...result.density].reduce((sum, power) => sum + power, 0) * result.frequency.binHz,
    ).toBeCloseTo(expected, 8);
    const peak = [...result.density].indexOf(Math.max(...result.density));
    expect(peak).toBe(kind === "dc" ? 0 : kind === "nyquist" ? 32 : 5);
  }
});

test("impulse energy peaks in its global time cell and subset columns keep full contextual windows", async () => {
  const f = fixture(
      Array.from({ length: 128 }, (_, i) => [i === 40 ? 1 : 0]),
      0,
      48000,
    ),
    options = { fftFrames: 64, hopFrames: 16 };
  const full = await spectralWindows(f.read, f.audio, options, new AbortController().signal);
  const power = full.columns.map((_, index) =>
    [...full.density.subarray(index * 33, (index + 1) * 33)].reduce((sum, value) => sum + value, 0),
  );
  expect(power.indexOf(Math.max(...power))).toBe(2);
  expect(full.columns[2]).toEqual({
    gridStart: 32,
    sampleRange: { start: 32, end: 48 },
    center: 40,
    analysis: { start: 8, end: 72 },
    available: { start: 8, end: 72 },
    partial: false,
  });
  const subset = await spectralWindows(
    f.read,
    f.audio,
    { ...options, sampleRange: { start: 35, end: 46 } },
    new AbortController().signal,
  );
  expect(subset.density).toEqual(full.density.subarray(2 * 33, 3 * 33));
  expect(subset.columns[0]).toEqual({ ...full.columns[2], sampleRange: { start: 35, end: 46 } });
  expect(full.columns[0]).toMatchObject({
    analysis: { start: -24, end: 40 },
    available: { start: 0, end: 40 },
    partial: true,
  });
});

test("nonzero published origins use sample coordinates and explicitly zero-pad absent window support", async () => {
  const samples = Array.from({ length: 16 }, (_, i) => [i === 3 ? 0.5 : 0]);
  const f = fixture(samples, 1001);
  const result = await spectralWindows(
    f.read,
    f.audio,
    { fftFrames: 32, hopFrames: 16 },
    new AbortController().signal,
  );
  expect(result.columns).toEqual([
    {
      gridStart: 992,
      sampleRange: { start: 1001, end: 1008 },
      center: 1000,
      analysis: { start: 984, end: 1016 },
      available: { start: 1001, end: 1016 },
      partial: true,
    },
    {
      gridStart: 1008,
      sampleRange: { start: 1008, end: 1017 },
      center: 1016,
      analysis: { start: 1000, end: 1032 },
      available: { start: 1001, end: 1017 },
      partial: true,
    },
  ]);
  const padded = Array.from({ length: 32 }, (_, i) => (i === 20 ? 0.5 : 0));
  directDensity(padded, 48000, "hann").forEach((expected, bin) =>
    expect(result.density[bin]).toBeCloseTo(expected, 13),
  );
  expect(f.reads.filter((r) => r.position >= 44)).toEqual([
    { position: 44, bytes: 15 * 4 },
    { position: 44, bytes: 16 * 4 },
  ]);
});

test("cell/read-work preflight rejects excessive spectra before any file read; cancellation stops after one bounded window", async () => {
  const f = fixture(Array.from({ length: 2048 }, () => [0.25, -0.5]));
  await expect(
    spectralWindows(
      f.read,
      f.audio,
      { fftFrames: 8192, hopFrames: 1 },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  expect(f.reads).toEqual([]);
  const abort = new AbortController();
  const read: RetainedRead = {
    ...f.read,
    read(buffer, position) {
      const count = f.read.read(buffer, position);
      if (buffer.length > 64) setImmediate(() => abort.abort());
      return count;
    },
  };
  await expect(
    spectralWindows(read, f.audio, { fftFrames: 64, hopFrames: 16 }, abort.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  const samples = f.reads.filter((r) => r.position >= 44);
  expect(samples).toEqual([{ position: 44, bytes: 40 * 8 }]);
});
