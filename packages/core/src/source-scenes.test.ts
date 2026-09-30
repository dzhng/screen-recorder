import { toTime } from "@screenrec/composition";
import { expect, test } from "vitest";
import {
  SelectedSourceSceneAnalysis,
  sceneSampleSourceTime,
  validateSceneSampleClock,
  sourceSceneSampleTimes,
  type SourceVisualPoint,
  type SourceVisualSampler,
} from "./source-scenes.js";
const asset = { assetId: "asset", streamId: "track:2", path: "/fixture.mov", originUs: 1250000 };
const clock = (at: number) => ({
  value: String(at + asset.originUs),
  timescale: 1000000,
  endValue: String(at + asset.originUs + 200000),
  endTimescale: 1000000,
});
const available = (at: number, continuous: boolean, channel = 0): SourceVisualPoint => ({
  requestedSourceUs: at,
  status: "available",
  actualSourceUs: at,
  sample: clock(at),
  width: 1,
  height: 1,
  rgbBase64: Buffer.from([channel, channel, channel]).toString("base64"),
  continuousFromPrevious: continuous,
});
function analysis(durationUs: number, point: (at: number, index: number) => SourceVisualPoint) {
  const sampler: SourceVisualSampler = async (r) => ({
    assetId: asset.assetId,
    streamId: asset.streamId,
    originUs: asset.originUs,
    sourceWidth: 64,
    sourceHeight: 48,
    samples: r.atSourceUs.map(point),
    decodedSamples: r.atSourceUs.length,
    readerOpens: 1,
  });
  return new SelectedSourceSceneAnalysis(
    { asset, available: [{ startUs: 0, endUs: durationUs }] },
    durationUs,
    sampler,
  );
}
test("sub-grid gaps reset comparison and stillness even with available endpoints", async () => {
  const a = analysis(800001, (at, i) =>
    available(at, i > 0 && at !== 400000, at >= 400000 ? 255 : 0),
  );
  const r = await a.analyze({ startUs: 0, endUs: 800000 }, new AbortController().signal);
  expect(r.comparisons.map((p) => [p.actualSourceUs, p.boundary])).toEqual([
    [200000, false],
    [600000, false],
    [800000, false],
  ]);
  expect(r.coverage[2]).toMatchObject({ status: "available", stillnessRunStartUs: 400000 });
  expect(r.coverage[4]).toMatchObject({ stillnessRunStartUs: 400000 });
});
test("explicit empty edits interrupt comparisons; overlapping chunks preserve retained clocks", async () => {
  const a = analysis(800001, (at, i) =>
    at === 200000
      ? {
          requestedSourceUs: at,
          status: "unavailable",
          reason: "empty_edit",
          continuousFromPrevious: false,
        }
      : available(at, i > 0 && at !== 400000),
  );
  const first = await a.analyze({ startUs: 0, endUs: 400000 }, new AbortController().signal);
  const second = await a.analyze({ startUs: 400000, endUs: 800000 }, new AbortController().signal);
  expect(first.comparisons).toEqual([]);
  expect(first.coverage[1]).toEqual({
    requestedSourceUs: 200000,
    status: "unavailable",
    reason: "empty_edit",
    continuousFromPrevious: false,
  });
  expect(second.coverage[0]).toEqual(first.coverage.at(-1));
  expect(second.comparisons.map((p) => p.actualSourceUs)).toEqual([600000, 800000]);
  expect(second.coverage.at(-1)).toMatchObject({ stillnessRunStartUs: 400000 });
});
test("exact physical timestamps distinguish samples rounding to the same microsecond", async () => {
  // Zero origin makes two starts at 0 and .1us both round to zero while the second holds 200ms.
  const sampler: SourceVisualSampler = async (r) => ({
    assetId: asset.assetId,
    streamId: asset.streamId,
    originUs: 0,
    sourceWidth: 64,
    sourceHeight: 48,
    decodedSamples: 2,
    readerOpens: 1,
    samples: r.atSourceUs.map((at, i) => ({
      ...available(at, i > 0, i * 255),
      actualSourceUs: 0,
      sample: {
        value: String(i),
        timescale: 10000000,
        endValue: "4000000",
        endTimescale: 10000000,
      },
    })),
  });
  const exact = new SelectedSourceSceneAnalysis(
    { asset: { ...asset, originUs: 0 }, available: [{ startUs: 0, endUs: 200001 }] },
    200001,
    sampler,
  );
  const r = await exact.analyze({ startUs: 0, endUs: 200000 }, new AbortController().signal);
  expect(r.comparisons).toMatchObject([
    { previous: { value: "0" }, current: { value: "1" }, actualSourceUs: 0, boundary: true },
  ]);
});

test("receipt identity, clock, gap and overlapping evidence cannot change silently", async () => {
  for (const fault of ["stream", "origin", "membership", "rgb", "gap"]) {
    const sampler: SourceVisualSampler = async (r) => {
      const result = {
        assetId: asset.assetId,
        streamId: asset.streamId,
        originUs: asset.originUs,
        sourceWidth: 64,
        sourceHeight: 48,
        decodedSamples: 2,
        readerOpens: 1,
        samples: r.atSourceUs.map((at, i) => available(at, i > 0)),
      };
      if (fault === "stream") result.streamId = "track:1";
      if (fault === "origin") result.originUs = 0;
      const point = result.samples[0]!;
      if (point.status === "available") {
        if (fault === "membership") point.sample.endValue = point.sample.value;
        if (fault === "rgb") point.rgbBase64 = "";
      }
      if (fault === "gap")
        result.samples[0] = {
          requestedSourceUs: 0,
          status: "unavailable",
          reason: "outside_support",
          continuousFromPrevious: false,
        };
      return result;
    };
    const a = new SelectedSourceSceneAnalysis(
      { asset, available: [{ startUs: 0, endUs: 600001 }] },
      600001,
      sampler,
    );
    await expect(
      a.analyze({ startUs: 0, endUs: 400000 }, new AbortController().signal),
    ).rejects.toThrow();
  }
  let changed = false;
  const a = analysis(600001, (at, i) => available(at, i > 0, changed ? 255 : 0));
  await a.analyze({ startUs: 0, endUs: 400000 }, new AbortController().signal);
  changed = true;
  await expect(
    a.analyze({ startUs: 400000, endUs: 600000 }, new AbortController().signal),
  ).rejects.toThrow("Overlapping");
});

test("cancellation after sampling does not advance the analysis generation", async () => {
  const controller = new AbortController();
  let cancel = true;
  const sampler: SourceVisualSampler = async (r) => {
    if (cancel) controller.abort(new Error("stop"));
    return {
      assetId: asset.assetId,
      streamId: asset.streamId,
      originUs: asset.originUs,
      sourceWidth: 64,
      sourceHeight: 48,
      decodedSamples: 2,
      readerOpens: 1,
      samples: r.atSourceUs.map((at, i) => available(at, i > 0)),
    };
  };
  const a = new SelectedSourceSceneAnalysis(
    { asset, available: [{ startUs: 0, endUs: 200001 }] },
    200001,
    sampler,
  );
  await expect(a.analyze({ startUs: 0, endUs: 200000 }, controller.signal)).rejects.toThrow("stop");
  cancel = false;
  const result = await a.analyze({ startUs: 0, endUs: 200000 }, new AbortController().signal);
  expect(result.comparisons.map((p) => p.actualSourceUs)).toEqual([200000]);
});

test("identical pixels cannot extend a stillness run through missing footage", async () => {
  const a = analysis(800001, (at, i) => available(at, i > 0 && at !== 400000));
  const result = await a.analyze({ startUs: 0, endUs: 800000 }, new AbortController().signal);
  expect(result.coverage[1]).toMatchObject({ stillnessRunStartUs: 0 });
  expect(result.coverage.at(-1)).toMatchObject({ stillnessRunStartUs: 400000 });
});

test("non-grid chunk endpoints retain their own continuity predecessor", async () => {
  const sampler: SourceVisualSampler = async (r) => ({
    assetId: asset.assetId,
    streamId: asset.streamId,
    originUs: 0,
    sourceWidth: 64,
    sourceHeight: 48,
    decodedSamples: r.atSourceUs.length,
    readerOpens: 1,
    samples: r.atSourceUs.map((at, i) => {
      const start = at < 250000 ? 0 : at < 350000 ? 275000 : at < 450000 ? 350000 : 450000;
      const end = at < 250000 ? 250000 : at < 350000 ? 350000 : at < 450000 ? 450000 : 1000000;
      return {
        ...available(at, i > 0 && !(r.atSourceUs[i - 1]! < 275000 && at >= 250000)),
        actualSourceUs: start,
        sample: {
          value: String(start),
          timescale: 1000000,
          endValue: String(end),
          endTimescale: 1000000,
        },
      };
    }),
  });
  const a = new SelectedSourceSceneAnalysis(
    { asset: { ...asset, originUs: 0 }, available: [{ startUs: 0, endUs: 1000000 }] },
    1000000,
    sampler,
  );
  await a.analyze({ startUs: 0, endUs: 300000 }, new AbortController().signal);
  const next = await a.analyze({ startUs: 300000, endUs: 500000 }, new AbortController().signal);
  expect(next.comparisons.map((p) => p.actualSourceUs)).toEqual([350000, 450000]);
  expect(next.coverage.at(-1)).toMatchObject({ stillnessRunStartUs: 300000 });
});

test("a rejected later observation leaves the entire chunk retryable", async () => {
  let bad = false;
  const a = analysis(1000001, (at, i) =>
    bad && at === 800000
      ? { ...available(at, i > 0), width: 2, rgbBase64: Buffer.alloc(6).toString("base64") }
      : available(at, i > 0),
  );
  await a.analyze({ startUs: 0, endUs: 400000 }, new AbortController().signal);
  bad = true;
  await expect(
    a.analyze({ startUs: 400000, endUs: 1000000 }, new AbortController().signal),
  ).rejects.toThrow("matching raster dimensions");
  bad = false;
  const next = await a.analyze({ startUs: 400000, endUs: 1000000 }, new AbortController().signal);
  expect(next.comparisons.map((p) => p.actualSourceUs)).toEqual([600000, 800000, 1000000]);
  expect(next.coverage.at(-1)).toMatchObject({ stillnessRunStartUs: 0 });
});

test("touching availability spans preserve continuous comparison and stillness", async () => {
  const sampler: SourceVisualSampler = async (r) => ({
    assetId: asset.assetId,
    streamId: asset.streamId,
    originUs: asset.originUs,
    sourceWidth: 64,
    sourceHeight: 48,
    decodedSamples: 2,
    readerOpens: 1,
    samples: r.atSourceUs.map((at, i) => available(at, i > 0)),
  });
  const a = new SelectedSourceSceneAnalysis(
    {
      asset,
      available: [
        { startUs: 0, endUs: 100000 },
        { startUs: 100000, endUs: 200001 },
      ],
    },
    200001,
    sampler,
  );
  const result = await a.analyze({ startUs: 0, endUs: 200000 }, new AbortController().signal);
  expect(result.comparisons.map((p) => p.actualSourceUs)).toEqual([200000]);
  expect(result.coverage.at(-1)).toMatchObject({ stillnessRunStartUs: 0 });
});

test("long physical timestamps reduce before safe public fraction conversion", () => {
  expect(
    toTime(
      sceneSampleSourceTime(
        {
          value: "1000000000000000",
          timescale: 1000000000,
          endValue: "1000000000000001",
          endTimescale: 1000000000,
        },
        0,
      ),
    ),
  ).toBe(1000000000000);
});

test("physical frame membership subtracts the shared fractional origin before label projection", () => {
  const sample = { value: "3", timescale: 5000000, endValue: "8", endTimescale: 5000000 };
  const origin = { numerator: 2, denominator: 5 };
  expect(toTime(sceneSampleSourceTime(sample, origin))).toEqual({ numerator: 1, denominator: 5 });
  expect(() => validateSceneSampleClock(sample, 1, 0, origin)).not.toThrow();
  expect(() => validateSceneSampleClock(sample, 1, 1, origin)).toThrow(/contain/);
  expect(() => validateSceneSampleClock(sample, 0, 0, origin)).toThrow(/contain/);
  expect(() => validateSceneSampleClock(sample, 2, 0, origin)).toThrow(/contain/);
  const negative = { value: "1", timescale: 3000000, endValue: "4", endTimescale: 3000000 };
  expect(() =>
    validateSceneSampleClock(negative, 0, -1, { numerator: 5, denominator: 6 }),
  ).not.toThrow();
  expect(
    sourceSceneSampleTimes({ startUs: 0, endUs: 200001 }, { numerator: 400001, denominator: 2 }),
  ).toEqual([0, 200000]);
});
