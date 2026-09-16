import { expect, test } from "vitest";
import {
  analyzeSceneRange,
  analyzeVisualSamples,
  compareVisualSamples,
  sceneSampleTimes,
  type VisualSample,
  type VisualSampler,
} from "./scenes.js";

function frame(
  at: number,
  paint: (x: number, y: number) => readonly number[] = () => [255, 255, 255],
): VisualSample {
  const pixels = Buffer.alloc(64 * 64 * 3);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) pixels.set(paint(x, y), (y * 64 + x) * 3);
  return {
    requestedSourceUs: at,
    actualSourceUs: at,
    distanceUs: 0,
    width: 64,
    height: 64,
    rgbBase64: pixels.toString("base64"),
  };
}
const white = frame(0);
const rows = (shift: number) => (x: number, y: number) =>
  x >= 4 && x < 60 && (y + shift) % 8 === 3 && x % 7 < 5 ? [0, 0, 0] : [255, 255, 255];

test("spatial policy detects sparse widespread page scrolling and broad color replacement", () => {
  const scroll = compareVisualSamples(frame(0, rows(0)), frame(200_000, rows(1)));
  expect(scroll.changedPixelFraction).toBeLessThan(0.3);
  expect(scroll.changedCellFraction).toBeGreaterThan(0.8);
  expect(scroll.boundary).toBe(true);
  // These colors have approximately equal Rec.709 luminance but different RGB channels.
  const color = compareVisualSamples(
    frame(0, () => [255, 0, 0]),
    frame(200_000, () => [0, 76, 0]),
  );
  expect(color.changedPixelFraction).toBe(1);
  expect(color.boundary).toBe(true);
  expect(
    compareVisualSamples(
      white,
      frame(200_000, () => [20, 20, 20]),
    ).boundary,
  ).toBe(true);
});

test("static pixels, weak noise, local caret and compact button highlight do not reset", () => {
  const fixtures = [
    frame(200_000),
    frame(200_000, (x, y) => [245 + (x % 10), 245 + (y % 10), 250]),
    frame(200_000, (x, y) => (x === 20 && y >= 20 && y < 28 ? [0, 0, 0] : [255, 255, 255])),
    frame(200_000, (x, y) =>
      x >= 20 && x < 36 && y >= 20 && y < 28 ? [40, 100, 220] : [255, 255, 255],
    ),
  ];
  for (const current of fixtures) expect(compareVisualSamples(white, current).boundary).toBe(false);
});

test("distributed text reflow resets despite a mostly white raster", () => {
  const text = frame(0, (x, y) =>
    x >= 4 && x < 48 && y % 8 === 3 && x % 6 < 3 ? [0, 0, 0] : [255, 255, 255],
  );
  const reflow = frame(200_000, (x, y) =>
    x >= 8 && x < 60 && y % 8 === 3 && x % 6 < 3 ? [0, 0, 0] : [255, 255, 255],
  );
  // Mere narrow margin movement is deliberately not enough; wrapping into changed rows is broad.
  const wrapped = frame(200_000, (x, y) =>
    x >= 8 && x < 60 && (y + Math.floor(x / 12)) % 8 === 3 && x % 6 < 3
      ? [0, 0, 0]
      : [255, 255, 255],
  );
  expect(compareVisualSamples(text, reflow).boundary).toBe(false);
  expect(compareVisualSamples(text, wrapped).boundary).toBe(true);
});

test("source anchored grid includes predecessor and endpoint within native bounds", () => {
  expect(
    sceneSampleTimes({ startUs: 450_000, endUs: 850_000 }, { startUs: 0, endUs: 2_000_000 }),
  ).toEqual([400_000, 600_000, 800_000, 850_000]);
  expect(
    sceneSampleTimes({ startUs: 400_000, endUs: 600_000 }, { startUs: 350_000, endUs: 600_000 }),
  ).toEqual([350_000, 400_000, 599_999]);
  for (let offset = 0; offset < 200_000; offset += 997) {
    const times = sceneSampleTimes(
      { startUs: offset, endUs: offset + 10_000_000 },
      { startUs: 0, endUs: 20_000_000 },
    );
    expect(times.length).toBeLessThanOrEqual(52);
    expect(times.at(-1)! - times[0]!).toBeLessThanOrEqual(10_200_000);
    expect(new Set(times).size).toBe(times.length);
  }
});

test("invalid ranges fail before native work", async () => {
  let calls = 0;
  const sample: VisualSampler = async () => {
    calls++;
    throw new Error("must not run");
  };
  for (const range of [
    { startUs: 0, endUs: 10_000_001 },
    { startUs: -1, endUs: 3 },
    { startUs: 4, endUs: 4 },
  ]) {
    await expect(
      analyzeSceneRange(
        { source: "/video", kept: { startUs: 0, endUs: 20_000_000 }, range },
        sample,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RANGE" });
  }
  expect(calls).toBe(0);
});

test("held frames collapse comparisons without losing distances or covered request times", async () => {
  const result = await analyzeSceneRange(
    {
      source: "/video",
      kept: { startUs: 0, endUs: 2_000_000 },
      range: { startUs: 0, endUs: 600_000 },
    },
    async ({ atSourceUs }) => ({
      sourceWidth: 64,
      sourceHeight: 64,
      samples: atSourceUs.map((at) => ({ ...white, requestedSourceUs: at, distanceUs: at })),
    }),
    new AbortController().signal,
  );
  expect(result.comparisons).toEqual([]);
  expect(result.boundaries).toEqual([]);
  expect(result.coverage.map((sample) => sample.distanceUs)).toEqual([
    0, 200_000, 400_000, 600_000,
  ]);
});

test("boundaries use actual later PTS and future samples do not claim a reset in the requested range", async () => {
  const result = await analyzeSceneRange(
    {
      source: "/video",
      kept: { startUs: 0, endUs: 1_000_000 },
      range: { startUs: 0, endUs: 200_000 },
    },
    async () => ({
      sourceWidth: 64,
      sourceHeight: 64,
      samples: [
        white,
        { ...frame(300_000, () => [0, 0, 0]), requestedSourceUs: 200_000, distanceUs: 100_000 },
      ],
    }),
    new AbortController().signal,
  );
  expect(result.comparisons[0]).toMatchObject({ actualSourceUs: 300_000, boundary: true });
  expect(result.boundaries).toEqual([]);
  expect(result.coverage[1]?.distanceUs).toBe(100_000);
});

test("global chunk predecessor produces identical pair metrics to whole batch", () => {
  const samples = [white, frame(200_000), frame(400_000, rows(0)), frame(600_000, rows(1))];
  const first = analyzeVisualSamples(samples.slice(0, 2));
  const second = analyzeVisualSamples(samples.slice(2), first.lastSample);
  expect([...first.comparisons, ...second.comparisons]).toEqual(
    analyzeVisualSamples(samples).comparisons,
  );
});

test("invalid and inconsistent observation evidence fails explicitly", () => {
  for (const next of [
    { ...frame(200_000), actualSourceUs: -1 },
    { ...frame(200_000), distanceUs: 1 },
    { ...frame(200_000), width: 65 },
    { ...frame(200_000), rgbBase64: "bad" },
    { ...frame(200_000), rgbBase64: "!".repeat(16_384) },
    {
      ...frame(200_000),
      actualSourceUs: 0,
      distanceUs: 200_000,
      rgbBase64: frame(0, () => [0, 0, 0]).rgbBase64,
    },
  ])
    expect(() => analyzeVisualSamples([white, next])).toThrow();
  expect(() => analyzeVisualSamples([frame(200_000), white])).toThrow();
});

test("sampler cancellation and errors propagate, partial/escaped batches never become verified coverage", async () => {
  const request = {
    source: "/video",
    kept: { startUs: 0, endUs: 1_000_000 },
    range: { startUs: 0, endUs: 200_000 },
  };
  const controller = new AbortController();
  const error = new Error("decode failed");
  await expect(
    analyzeSceneRange(
      request,
      async (_request, signal) => {
        expect(signal).toBe(controller.signal);
        throw error;
      },
      controller.signal,
    ),
  ).rejects.toBe(error);
  for (const samples of [[white], [white, frame(1_000_000)]]) {
    await expect(
      analyzeSceneRange(
        request,
        async () => ({ sourceWidth: 64, sourceHeight: 64, samples }),
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
  }
  await expect(
    analyzeSceneRange(
      request,
      async ({ atSourceUs }) => {
        controller.abort(error);
        return { sourceWidth: 64, sourceHeight: 64, samples: atSourceUs.map((at) => frame(at)) };
      },
      controller.signal,
    ),
  ).rejects.toBe(error);
});
