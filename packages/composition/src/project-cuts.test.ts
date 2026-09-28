import { expect, test } from "vitest";
import {
  createProjectCuts,
  validateComposition,
  type Asset,
  type Clip,
  type Composition,
} from "./index.js";
const range = (startUs: number, endUs: number) => ({ startUs, endUs });
const asset: Asset = {
  id: "source",
  streams: [
    { id: "video", kind: "video", bounds: range(0, 30), available: [range(0, 30)] },
    { id: "audio", kind: "audio", bounds: range(0, 30), available: [range(0, 30)] },
    { id: "image", kind: "image" },
  ],
};
const clip = (
  id: string,
  start: number,
  end: number,
  from = start,
  to = end,
  trackId = "video",
): Clip => ({
  id,
  trackId,
  assetId: "source",
  streamId: trackId === "audio" ? "audio" : "video",
  placement: { kind: "project", range: range(start, end) },
  source: { kind: "range", range: range(from, to) },
});
const doc = (clips: Clip[]): Composition => ({
  canvas: {
    width: 100,
    height: 100,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [
    { id: "video", kind: "video", order: 0 },
    { id: "overlay", kind: "video", order: 1 },
    { id: "audio", kind: "audio", order: 0 },
  ],
  groups: [],
  clips,
  processing: [],
  captions: [],
  syncGroups: [],
});
const cuts = (clips: Clip[], input = asset) =>
  createProjectCuts(validateComposition(doc(clips), [input]));
const simplify = (rows: ReturnType<ReturnType<typeof createProjectCuts>["window"]>) =>
  rows.map((r) => [r.projectAtUs, r.trackId, r.before?.clipId ?? null, r.after?.clipId ?? null]);
test("editorial replacement and overlap retain separate audio/video transitions without pure split cuts", () => {
  const index = cuts([
    clip("a", 0, 4),
    clip("b", 4, 6, 10, 12),
    clip("c", 6, 10),
    clip("sound-left", 0, 5, 0, 5, "audio"),
    clip("sound-right", 5, 10, 5, 10, "audio"),
    clip("over", 2, 8, 0, 6, "overlay"),
  ]);
  expect(simplify(index.window({ range: range(0, 10) }))).toEqual([
    [2, "overlay", null, "over"],
    [4, "video", "a", "b"],
    [6, "video", "b", "c"],
    [8, "overlay", "over", null],
  ]);
  expect(simplify(index.window({ range: range(4, 6), trackIds: ["video"] }))).toEqual([
    [4, "video", "a", "b"],
  ]);
  expect(index.window({ range: range(7, 8), trackIds: ["video"] })).toEqual([]);
});

test("fractional splits preserve exact mappings and fractional terminal boundaries are excluded", () => {
  const left = clip("left", 0, 2, 0, 3),
    right = clip("right", 2, 6, 3, 10);
  left.source = { kind: "range", range: { startUs: 0, endUs: { numerator: 10, denominator: 3 } } };
  right.source = {
    kind: "range",
    range: { startUs: { numerator: 10, denominator: 3 }, endUs: 10 },
  };
  expect(cuts([left, right]).window({ range: range(0, 6) })).toEqual([]);
  right.source = { kind: "range", range: { startUs: { numerator: 10, denominator: 3 }, endUs: 9 } };
  expect(cuts([left, right]).window({ range: range(0, 6) })[0]).toMatchObject({
    projectAtUs: 2,
    before: {
      sourceAtUs: { numerator: 10, denominator: 3 },
      rate: { numerator: 5, denominator: 3 },
    },
    after: {
      sourceAtUs: { numerator: 10, denominator: 3 },
      rate: { numerator: 17, denominator: 12 },
    },
  });
  left.placement = {
    kind: "project",
    range: { startUs: 0, endUs: { numerator: 7, denominator: 3 } },
  };
  right.placement = {
    kind: "project",
    range: { startUs: { numerator: 7, denominator: 3 }, endUs: { numerator: 17, denominator: 3 } },
  };
  expect(simplify(cuts([left, right]).window({ range: range(0, 6) }))).toEqual([
    [{ numerator: 7, denominator: 3 }, "video", "left", "right"],
  ]);
});

test("support holes never author cuts, while editorial gaps and seams inside holes remain exact", () => {
  const sparse: Asset = {
    ...asset,
    streams: [
      { id: "video", kind: "video", bounds: range(0, 30), available: [range(0, 2), range(8, 30)] },
    ],
  };
  expect(cuts([clip("whole", 0, 10)], sparse).window({ range: range(0, 10) })).toEqual([]);
  expect(
    simplify(
      cuts([clip("a", 0, 4), clip("b", 4, 6, 5, 7), clip("c", 8, 10)], sparse).window({
        range: range(0, 10),
      }),
    ),
  ).toEqual([
    [4, "video", "a", "b"],
    [6, "video", "b", null],
    [8, "video", null, "c"],
  ]);
});

test("identical holds and silence split invariant; changing kinds and bindings are transitions", () => {
  const hold = (id: string, start: number, end: number): Clip => ({
    id,
    trackId: "video",
    assetId: "source",
    streamId: "image",
    source: { kind: "hold", atUs: 0 },
    placement: { kind: "project", range: range(start, end) },
  });
  const silence = (id: string, start: number, end: number): Clip => ({
    id,
    trackId: "audio",
    source: { kind: "silence" },
    placement: { kind: "project", range: range(start, end) },
  });
  const rows = cuts([
    hold("h1", 0, 3),
    hold("h2", 3, 6),
    clip("moving", 6, 10),
    silence("s1", 1, 4),
    silence("s2", 4, 8),
    clip("sound", 8, 10, 0, 2, "audio"),
  ]).window({ range: range(0, 10) });
  expect(simplify(rows)).toEqual([
    [1, "audio", null, "s1"],
    [6, "video", "h2", "moving"],
    [8, "audio", "s2", "sound"],
  ]);
});
