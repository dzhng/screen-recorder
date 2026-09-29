import { expect, test } from "vitest";
import { validateComposition, type Composition } from "./index.js";

const range = (startUs: number, endUs: number) => ({ startUs, endUs });
const assets = [
  {
    id: "asset",
    streams: [
      {
        id: "v",
        kind: "video",
        width: 16,
        height: 16,
        bounds: range(0, 60),
        available: [range(0, 10), range(20, 30), range(40, 60)],
      },
    ],
  },
];
const base: Composition = {
  canvas: {
    width: 16,
    height: 16,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "v", kind: "video", order: 0 }],
  groups: [],
  processing: [],
  syncGroups: [],
  clips: [],
};

test("source support keeps fractional endpoints and distinct acquisition masks on repeated media", () => {
  const clips = [undefined, "a", "b"].map((acquisitionId, i) => ({
    id: `c${i}`,
    trackId: "v",
    assetId: "asset",
    streamId: "v",
    ...(acquisitionId ? { acquisitionId } : {}),
    source: {
      kind: "range" as const,
      range: {
        startUs: { numerator: 19, denominator: 2 },
        endUs: { numerator: 81, denominator: 2 },
      },
    },
    placement: { kind: "project" as const, range: range(i * 31, (i + 1) * 31) },
  }));
  const acquisitions = [
    {
      id: "a",
      bindings: [{ assetId: "asset", streamId: "v", available: [range(5, 25), range(45, 55)] }],
    },
    { id: "b", bindings: [{ assetId: "asset", streamId: "v", available: [range(25, 50)] }] },
  ];
  const model = validateComposition({ ...base, clips }, assets, acquisitions);
  const value = (n: number, d = 1) => ({ numerator: BigInt(n), denominator: BigInt(d) });
  expect(model.clips.map((clip) => clip.available)).toEqual([
    [
      { start: value(0), end: value(1, 2) },
      { start: value(21, 2), end: value(41, 2) },
      { start: value(61, 2), end: value(31) },
    ],
    [
      { start: value(31), end: value(63, 2) },
      { start: value(83, 2), end: value(93, 2) },
    ],
    [
      { start: value(155, 2), end: value(165, 2) },
      { start: value(185, 2), end: value(93) },
    ],
  ]);
});

test("holds treat gap and occupied endpoints as half-open on repeated media", () => {
  const points = [0, 9, 10, 19, 20, 29, 30, 39, 40, 59];
  const clips = points.map((atUs, i) => ({
    id: `c${i}`,
    trackId: "v",
    assetId: "asset",
    streamId: "v",
    source: { kind: "hold" as const, atUs },
    placement: { kind: "project" as const, range: range(i, i + 1) },
  }));
  expect(
    validateComposition({ ...base, clips }, assets).clips.map((clip) => clip.available.length > 0),
  ).toEqual([true, true, false, false, true, true, false, false, true, true]);
  const touching = [
    {
      ...assets[0],
      streams: [{ ...assets[0]!.streams[0], available: [range(0, 10), range(10, 30)] }],
    },
  ];
  expect(validateComposition({ ...base, clips: [clips[2]] }, touching).clips[0]!.available).toEqual(
    [{ start: { numerator: 2n, denominator: 1n }, end: { numerator: 3n, denominator: 1n } }],
  );
});
