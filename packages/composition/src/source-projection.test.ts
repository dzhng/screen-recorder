import { expect, test } from "vitest";
import {
  validateComposition,
  applyBatch,
  createSourceRangeProjection,
  sourceToProject,
  CompositionError,
  type Asset,
  type Clip,
  type MediaClip,
  type Composition,
  type Rational,
} from "./index.js";

const range = (startUs: number, endUs: number) => ({ startUs, endUs });
function asset(id = "source", endUs = 20): Asset {
  return {
    id,
    streams: [
      {
        id: "video",
        kind: "video",
        bounds: range(0, endUs),
        available: [range(0, endUs)],
      },
      {
        id: "audio",
        kind: "audio",
        bounds: range(2, endUs),
        available: [range(2, endUs)],
      },
      { id: "still", kind: "image" },
    ],
  };
}
function clip(id: string, startUs = 0, endUs = 10): MediaClip {
  return {
    id,
    assetId: "source",
    streamId: "video",
    trackId: "picture",
    source: { kind: "range", range: range(0, 10) },
    placement: { kind: "project", range: range(startUs, endUs) },
  };
}
function document(clips: Clip[] = []): Composition {
  return {
    canvas: {
      width: 161,
      height: 97,
      fps: { numerator: 30000, denominator: 1001 },
      background: "#112233ff",
    },
    tracks: [
      { id: "picture", kind: "video", order: 0 },
      { id: "overlay", kind: "video", order: 1 },
      { id: "sound", kind: "audio", order: 0 },
    ],
    clips,
    syncGroups: [],
    processing: [],
    groups: [],
    captions: [],
  };
}
const r = (numerator: bigint, denominator = 1n): Rational => ({
  numerator,
  denominator,
});

test("range projection retains exact rational occurrences and editorial completeness", () => {
  const a = clip("a", 0, 7),
    b = clip("b", 20, 27);
  const projection = createSourceRangeProjection(validateComposition(document([b, a]), [asset()]));
  expect(
    projection.all({
      assetId: "source",
      streamId: "video",
      range: range(1, 4),
    }),
  ).toEqual(
    [
      ["a", r(7n, 10n), r(14n, 5n)],
      ["b", r(207n, 10n), r(114n, 5n)],
    ].map(([clipId, start, end]) => ({
      clipId,
      assetId: "source",
      streamId: "video",
      trackId: "picture",
      trackOrder: 0,
      source: { start: r(1n), end: r(4n) },
      completeness: "whole",
      fragments: [{ source: { start: r(1n), end: r(4n) }, project: { start, end } }],
    })),
  );
});

test("range completeness sees internal stream and ancestor holes, not just endpoints", () => {
  const input = asset();
  input.streams[0] = {
    id: "video",
    kind: "video",
    bounds: range(0, 20),
    available: [range(0, 4), range(6, 20)],
  };
  const parent = clip("parent");
  const child = clip("child");
  child.streamId = "audio";
  child.source = { kind: "range", range: range(2, 12) };
  child.trackId = "sound";
  child.placement = {
    kind: "content",
    clipId: "parent",
    sourceRange: range(0, 10),
  };
  const projection = createSourceRangeProjection(
    validateComposition(document([parent, child]), [input]),
  );
  expect(projection.clip("parent", range(2, 8))).toMatchObject({
    completeness: "partial",
    fragments: [
      {
        source: { start: r(2n), end: r(4n) },
        project: { start: r(2n), end: r(4n) },
      },
      {
        source: { start: r(6n), end: r(8n) },
        project: { start: r(6n), end: r(8n) },
      },
    ],
  });
  expect(projection.clip("child", range(4, 10))).toMatchObject({
    completeness: "partial",
    fragments: [
      {
        source: { start: r(4n), end: r(6n) },
        project: { start: r(2n), end: r(4n) },
      },
      {
        source: { start: r(8n), end: r(10n) },
        project: { start: r(6n), end: r(8n) },
      },
    ],
  });
  expect(projection.clip("parent", range(4, 6))).toBeNull();
  expect(projection.clip("parent", range(0, 2))?.completeness).toBe("whole");
});

test("split coverage keeps fractional source boundaries without promoting child words", () => {
  const original = document([clip("a", 0, 7)]),
    assets = [asset()];
  const before = createSourceRangeProjection(validateComposition(original, assets));
  const split = applyBatch(original, [{ operation: "split", clipIds: ["a"], atUs: 2 }], {
    assets,
    namespace: "split",
  });
  const after = createSourceRangeProjection(validateComposition(split.document, assets));
  expect(before.clip("a", range(1, 4))?.fragments).toEqual([
    {
      source: { start: r(1n), end: r(4n) },
      project: { start: r(7n, 10n), end: r(14n, 5n) },
    },
  ]);
  const rows = after.all({
    assetId: "source",
    streamId: "video",
    range: range(1, 4),
  });
  expect(rows.map((row) => row.completeness)).toEqual(["partial", "partial"]);
  expect(rows.flatMap((row) => row.fragments)).toEqual([
    {
      source: { start: r(1n), end: r(20n, 7n) },
      project: { start: r(7n, 10n), end: r(2n) },
    },
    {
      source: { start: r(20n, 7n), end: r(4n) },
      project: { start: r(2n), end: r(14n, 5n) },
    },
  ]);
  expect(
    after.clip("a", { startUs: 1, endUs: { numerator: 20, denominator: 7 } })?.completeness,
  ).toBe("whole");
});

test("range lookup excludes touching boundaries, holds and silence and sorts tied occurrences", () => {
  const a = clip("z", 5, 15),
    overlay = clip("a", 5, 15);
  overlay.trackId = "overlay";
  const held = clip("held", 20, 30);
  held.source = { kind: "hold", atUs: 3 };
  const silent: Clip = {
    id: "silent",
    trackId: "sound",
    source: { kind: "silence" },
    placement: { kind: "project", range: range(0, 10) },
  };
  const model = validateComposition(document([overlay, a, held, silent]), [asset()]);
  const projection = createSourceRangeProjection(model);
  expect(
    projection
      .all({ assetId: "source", streamId: "video", range: range(3, 4) })
      .map((row) => row.clipId),
  ).toEqual(["z", "a"]);
  expect(
    projection.all({
      assetId: "source",
      streamId: "video",
      range: range(10, 11),
    }),
  ).toEqual([]);
  expect(projection.clip("held", range(3, 4))).toBeNull();
  expect(projection.clip("silent", range(3, 4))).toBeNull();
  expect(
    sourceToProject(model, {
      assetId: "source",
      streamId: "video",
      atUs: 3,
    }).find((row) => row.clipId === "held")?.project,
  ).toEqual({ start: r(20n), end: r(30n) });
  expect(() => projection.clip("absent", range(0, 1))).toThrow("Unknown clip");
  expect(() =>
    projection.all({
      assetId: "source",
      streamId: "absent",
      range: range(0, 1),
    }),
  ).toThrow("Unknown source");
  expect(() => projection.clip("z", range(1, 1))).toThrow(CompositionError);
});

test("repeated named range reads do not revisit the revision's unrelated clips", () => {
  const clips = Array.from({ length: 1024 }, (_, n) => clip(`c${n}`, n * 10, n * 10 + 10));
  const model = validateComposition(document(clips), [asset()]);
  let reads = 0;
  const observed = new Proxy(model.clips, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) reads++;
      return Reflect.get(target, property, receiver);
    },
  });
  const projection = createSourceRangeProjection({ ...model, clips: observed });
  reads = 0;
  for (let n = 0; n < 100; n++) {
    expect(projection.clip("c1000", range(2, 3))?.fragments).toEqual([
      {
        source: { start: r(2n), end: r(3n) },
        project: { start: r(10002n), end: r(10003n) },
      },
    ]);
  }
  expect(reads).toBe(0);
});

test("source range selection bounds work to overlapping intervals", async () => {
  const { intervalIndex } = await import("./interval-index.js");
  const rows = Array.from({ length: 4096 }, (_, n) => ({
    id: n,
    range: { start: r(BigInt(n * 10)), end: r(BigInt(n * 10 + 5)) },
  }));
  let reads = 0;
  const query = intervalIndex(rows, (row) => {
    reads++;
    return row.range;
  });
  reads = 0;
  expect(query(r(40001n), r(40004n))).toEqual([rows[4000]]);
  expect(reads).toBeLessThan(64);
});
