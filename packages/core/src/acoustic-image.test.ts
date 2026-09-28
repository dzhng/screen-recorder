import { test, expect } from "vitest";
import { acousticImageRequest, type AcousticMetadata } from "./acoustic-image.js";
import type { spectralWindows } from "./audio-spectrum.js";

test("spectral columns mark missing surrounding support without declaring the displayed audio absent", () => {
  const sampleRange = { start: 512, end: 1024 };
  const data: Awaited<ReturnType<typeof spectralWindows>> = {
    sampleRate: 48000,
    channels: 1,
    sampleRange,
    fftFrames: 1024,
    hopFrames: 256,
    window: "hann",
    windowEnergy: 384,
    frequency: { bins: 513, binHz: 46.875, firstHz: 0, lastHz: 24000 },
    units: "full-scale-squared/Hz",
    layout: "column-channel-frequency",
    density: new Float64Array(1026),
    readFrames: 2048,
    columns: [512, 768].map((start) => ({
      gridStart: start,
      sampleRange: { start, end: start + 256 },
      center: start + 128,
      analysis: { start: start - 384, end: start + 640 },
      available: { start: start - 384, end: start + 640 },
      partial: false,
    })),
  };
  const common = {
    range: { startUs: 10667, endUs: 21334 },
    timeOriginUs: 0,
    sampleRange,
    sampleRate: 48000,
    channels: 1 as const,
    layout: "mono" as const,
    implementationId: "pcm",
    audio: { jobId: "pcm", generation: 1 },
    context: { range: { startUs: 0, endUs: 40000 }, sampleRange: { start: 0, end: 1920 } },
  };
  const source: AcousticMetadata = {
    ...common,
    domain: "source",
    assetId: "asset",
    streamId: "audio",
    supportDigest: "mask",
    unavailable: [],
    context: { ...common.context, unavailable: [{ startUs: 5334, endUs: 8000 }] },
  };
  const project: AcousticMetadata = {
    ...common,
    domain: "project",
    projectId: "project",
    revisionId: "revision",
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
    unavailable: [],
    context: {
      ...common.context,
      unavailable: [{ clipId: "one-missing-input", ranges: [{ start: 256, end: 384 }] }],
    },
  };
  for (const metadata of [source, project]) {
    const result = acousticImageRequest(metadata, { kind: "spectrum", data }, "/tmp/image.png");
    expect(result.columns.map((c) => c.partial)).toEqual([true, false]);
    expect(result.unavailable).toEqual([]);
    expect(result.columns[0]!.values[0]).toEqual(Array(513).fill(0));
  }
});
