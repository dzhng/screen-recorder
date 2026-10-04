import { describe, expect, test } from "vitest";
import {
  validateComposition,
  resolvePlacement,
  projectToSource,
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
        width: 640,
        height: 480,
        bounds: range(0, endUs),
        available: [range(0, endUs)],
      },
      { id: "audio", kind: "audio", bounds: range(2, endUs), available: [range(2, endUs)] },
      { id: "still", kind: "image", width: 640, height: 480 },
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
  };
}
const r = (numerator: bigint, denominator = 1n): Rational => ({ numerator, denominator });

test("empty editing state supports arbitrary canvas geometry and no occurrences", () => {
  const model = validateComposition(document(), []);
  expect(model.durationUs).toBe(0);
  expect(projectToSource(model, 0)).toEqual([]);
  expect(() => resolvePlacement(model, "missing")).toThrow("Unknown clip");
});
test("repeated and reordered sources preserve occurrence IDs and half-open joins", () => {
  const first = clip("first", 0, 5);
  first.source = { kind: "range", range: range(10, 15) };
  const second = clip("second", 5, 15);
  const third = clip("third", 15, 25);
  const model = validateComposition(document([first, second, third]), [asset()]);
  expect(projectToSource(model, 4)).toMatchObject([{ clipId: "first", sourceUs: 14 }]);
  expect(projectToSource(model, 5)).toMatchObject([{ clipId: "second", sourceUs: 0 }]);
  expect(projectToSource(model, 15)).toMatchObject([{ clipId: "third", sourceUs: 0 }]);
  expect(projectToSource(model, 25)).toEqual([]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "video", atUs: 3 }).map((value) => [
      value.clipId,
      value.firstProjectUs,
    ]),
  ).toEqual([
    ["second", 8],
    ["third", 18],
  ]);
});
test("linked AV keeps unequal source offsets, placements and durations", () => {
  const picture = clip("v", 0, 10);
  const sound: Clip = {
    ...clip("a", 2, 8),
    streamId: "audio",
    trackId: "sound",
    source: { kind: "range", range: range(2, 8) },
  };
  const input = document([picture, sound]);
  input.syncGroups = [{ id: "sync", clipIds: ["v", "a"] }];
  const model = validateComposition(input, [asset()]);
  expect(projectToSource(model, 1).map((value) => value.clipId)).toEqual(["v"]);
  expect(projectToSource(model, 3).map((value) => [value.clipId, value.sourceUs])).toEqual([
    ["v", 3],
    ["a", 3],
  ]);
  expect(projectToSource(model, 8).map((value) => value.clipId)).toEqual(["v"]);
});
test("2/3 playback rate uses exact division and the following microsecond wins", () => {
  const slow = clip("slow", 0, 9);
  slow.source = { kind: "range", range: range(0, 6) };
  const model = validateComposition(document([slow]), [asset()]);
  expect(model.clips[0]!.rate).toEqual(r(2n, 3n));
  expect(
    Array.from({ length: 10 }, (_, at) => projectToSource(model, at)[0]?.sourceUs ?? null),
  ).toEqual([0, 0, 1, 2, 2, 3, 4, 4, 5, null]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "video", atUs: 1 })[0],
  ).toMatchObject({ project: { start: r(3n, 2n), end: r(3n) }, firstProjectUs: 2 });
});
test("integer point mappings round-trip through inverse microsecond bins for many rational rates", () => {
  for (let sourceDuration = 1; sourceDuration <= 17; sourceDuration++)
    for (let duration = 1; duration <= 19; duration++) {
      const item = clip("test", 7, 7 + duration);
      item.source = { kind: "range", range: range(1, 1 + sourceDuration) };
      const model = validateComposition(document([item]), [asset()]);
      for (let at = 7; at < 7 + duration; at++) {
        const mapped = projectToSource(model, at)[0]!;
        expect(mapped.sourceUs).toBe(
          1 + Number((BigInt(at - 7) * BigInt(sourceDuration)) / BigInt(duration)),
        );
        const back = sourceToProject(model, {
          assetId: mapped.assetId,
          streamId: mapped.streamId,
          atUs: mapped.sourceUs,
        })[0]!;
        expect(BigInt(at) * back.project.start.denominator >= back.project.start.numerator).toBe(
          true,
        );
        expect(BigInt(at) * back.project.end.denominator < back.project.end.numerator).toBe(true);
      }
    }
});
test("fast playback reports source bins with no integer project sample without inventing one", () => {
  const model = validateComposition(document([clip("fast", 0, 2)]), [asset()]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "video", atUs: 1 })[0],
  ).toMatchObject({ firstProjectUs: null, project: { start: r(1n, 5n), end: r(2n, 5n) } });
});
test("reverse results sort by mapped occurrence time rather than the containing clip start", () => {
  const slow = clip("slow", 0, 1000);
  const fast = { ...clip("fast", 10, 20), trackId: "overlay" };
  const model = validateComposition(document([slow, fast]), [asset()]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "video", atUs: 9 }).map((item) => [
      item.clipId,
      item.firstProjectUs,
    ]),
  ).toEqual([
    ["fast", 19],
    ["slow", 900],
  ]);
});
test("large integer inputs use exact intermediates beyond Number precision", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const item = clip("large", 0, max);
  item.source = { kind: "range", range: range(0, max - 1) };
  const model = validateComposition(document([item]), [asset("source", max)]);
  expect(projectToSource(model, max - 1)[0]!.sourceUs).toBe(max - 2);
  expect(model.durationUs).toBe(max);
  expect(() => validateComposition(document([clip("overflow", 0, max + 1)]), [asset()])).toThrow(
    CompositionError,
  );
  expect(() => projectToSource(model, max + 1)).toThrow(CompositionError);
});
test("source gaps produce disjoint attachment availability without shortening placement", () => {
  const source = asset();
  source.streams[0] = {
    id: "video",
    kind: "video",
    width: 640,
    height: 480,
    bounds: range(0, 20),
    available: [range(0, 4), range(6, 20)],
  };
  const overlay: Clip = {
    ...clip("child"),
    streamId: "still",
    trackId: "overlay",
    source: { kind: "hold", atUs: 0 },
    placement: { kind: "content", clipId: "parent", sourceRange: range(2, 8) },
  };
  const model = validateComposition(document([overlay, clip("parent")]), [source]);
  expect(resolvePlacement(model, "child")).toEqual({
    range: { start: r(2n), end: r(8n) },
    available: [
      { start: r(2n), end: r(4n) },
      { start: r(6n), end: r(8n) },
    ],
  });
  expect(projectToSource(model, 5).map((value) => [value.clipId, value.available])).toEqual([
    ["parent", false],
    ["child", false],
  ]);
  expect(projectToSource(model, 6).map((value) => [value.clipId, value.available])).toEqual([
    ["parent", true],
    ["child", true],
  ]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "video", atUs: 5 })[0]!.available,
  ).toEqual([]);
});
test("held still anchors retain nested fractional timing without intermediate rounding", () => {
  const held: Clip = {
    ...clip("held", 0, 3),
    streamId: "still",
    source: { kind: "hold", atUs: 0 },
  };
  const child: Clip = {
    ...held,
    id: "child",
    trackId: "overlay",
    placement: {
      kind: "clip",
      clipId: "held",
      start: { numerator: 1, denominator: 2 },
      end: { numerator: 1, denominator: 1 },
    },
  };
  const nested: Clip = {
    ...held,
    id: "nested",
    trackId: "third",
    placement: {
      kind: "clip",
      clipId: "child",
      start: { numerator: 1, denominator: 3 },
      end: { numerator: 1, denominator: 1 },
    },
  };
  const input = document([nested, child, held]);
  input.tracks.push({ id: "third", kind: "video", order: 2 });
  const model = validateComposition(input, [asset()]);
  expect(resolvePlacement(model, "child").range).toEqual({ start: r(3n, 2n), end: r(3n) });
  expect(resolvePlacement(model, "nested").range).toEqual({ start: r(2n), end: r(3n) });
  expect(projectToSource(model, 1).map((value) => value.clipId)).toEqual(["held"]);
  expect(projectToSource(model, 2).map((value) => value.clipId)).toEqual([
    "held",
    "child",
    "nested",
  ]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "still", atUs: 0 }).map(
      (value) => value.firstProjectUs,
    ),
  ).toEqual([0, 2, 2]);
});
test("video holds return the whole project interval; audio holds and source-anchored holds fail", () => {
  const held: Clip = { ...clip("held"), source: { kind: "hold", atUs: 4 } };
  const model = validateComposition(document([held]), [asset()]);
  expect(projectToSource(model, 9)[0]!.sourceUs).toBe(4);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "video", atUs: 4 })[0]!.project,
  ).toEqual({ start: r(0n), end: r(10n) });
  expect(() =>
    validateComposition(document([{ ...held, streamId: "audio", trackId: "sound" }]), [asset()]),
  ).toThrow("Audio cannot be held");
  expect(() =>
    resolvePlacement(model, { kind: "content", clipId: "held", sourceRange: range(4, 5) }),
  ).toThrow("normalized clip anchor");
});
test("validated data is an immutable snapshot even when callers edit their original objects", () => {
  const input = document([clip("one")]),
    assets = [asset()];
  const model = validateComposition(input, assets);
  input.clips[0]!.source = { kind: "range", range: range(10, 20) };
  assets[0]!.streams.splice(0);
  expect(projectToSource(model, 1)[0]!.sourceUs).toBe(1);
  expect(() => Reflect.set(model.document.canvas, "width", 900)).not.toThrow();
  expect(model.document.canvas.width).toBe(161);
  expect(Object.isFrozen(model.clips[0]!.available)).toBe(true);
  expect(Object.isFrozen(model.clips[0]!.range.start)).toBe(true);
});
describe("semantic validation rejects documents that could silently change meaning", () => {
  test("overlap, missing streams and duplicate IDs", () => {
    expect(() =>
      validateComposition(document([clip("one"), clip("two", 9, 20)]), [asset()]),
    ).toThrow("Overlapping clips");
    expect(() =>
      validateComposition(document([clip("one"), clip("one", 10, 20)]), [asset()]),
    ).toThrow("Duplicate clip");
    expect(() => validateComposition(document([clip("one")]), [])).toThrow("Unknown source");
    expect(() =>
      validateComposition(document([{ ...clip("one"), streamId: "audio" }]), [asset()]),
    ).toThrow("kind mismatch");
  });
  test("cycles, unknown parents and out-of-range anchors", () => {
    const a = clip("a"),
      b = { ...clip("b"), trackId: "overlay" };
    a.placement = { kind: "content", clipId: "b", sourceRange: range(0, 10) };
    b.placement = { kind: "content", clipId: "a", sourceRange: range(0, 10) };
    expect(() => validateComposition(document([a, b]), [asset()])).toThrow("cycle");
    expect(() => validateComposition(document([a]), [asset()])).toThrow("Unknown anchor parent");
    b.placement = { kind: "project", range: range(0, 10) };
    a.placement = { kind: "content", clipId: "b", sourceRange: range(0, 11) };
    expect(() => validateComposition(document([a, b]), [asset()])).toThrow(
      "exceeds selected parent",
    );
  });
  test("ambiguous groups and unimplemented effects", () => {
    const input = document([clip("one"), clip("two", 10, 20)]);
    input.syncGroups = [
      { id: "s", clipIds: ["one", "two"] },
      { id: "t", clipIds: ["one", "two"] },
    ];
    expect(() => validateComposition(input, [asset()])).toThrow("multiple synchronization");
    expect(() =>
      validateComposition(
        {
          ...document(),
          processing: [
            {
              target: { kind: "output" },
              steps: [{ id: "bad", enabled: true, processor: { type: "arbitrary" } }],
            },
          ],
        },
        [],
      ),
    ).toThrow(CompositionError);
    expect(() => validateComposition({ ...document(), compatibilitySpans: [] }, [])).toThrow(
      CompositionError,
    );
  });
  test("overlapping availability, unreduced fractions and invalid query times", () => {
    const source = asset();
    source.streams[0] = {
      id: "video",
      kind: "video",
      width: 640,
      height: 480,
      bounds: range(0, 20),
      available: [range(0, 10), range(9, 20)],
    };
    expect(() => validateComposition(document(), [source])).toThrow("Invalid source availability");
    const input = document();
    input.canvas.fps = { numerator: 60, denominator: 2 };
    expect(() => validateComposition(input, [])).toThrow("reduced fraction");
    const model = validateComposition(document(), []);
    for (const at of [-1, 0.5, NaN, Infinity])
      expect(() => projectToSource(model, at)).toThrow(CompositionError);
    expect(() => sourceToProject(model, { assetId: "x", streamId: "y", atUs: 0 })).toThrow(
      "Unknown source",
    );
  });
});

test("fractional source boundaries preserve a retimed split and inverse bins", () => {
  const whole = validateComposition(document([clip("whole", 0, 6)]), [asset()]);
  const boundary = { numerator: 10, denominator: 3 };
  const split = validateComposition(
    {
      ...document(),
      clips: [
        {
          ...clip("left", 0, 2),
          source: { kind: "range", range: { startUs: 0, endUs: boundary } },
        },
        {
          ...clip("right", 2, 6),
          source: { kind: "range", range: { startUs: boundary, endUs: 10 } },
        },
      ],
    },
    [asset()],
  );
  for (let atUs = 0; atUs < 6; atUs++) {
    expect(projectToSource(split, atUs).map(({ sourceUs }) => sourceUs)).toEqual(
      projectToSource(whole, atUs).map(({ sourceUs }) => sourceUs),
    );
  }
  const occurrences = sourceToProject(split, { assetId: "source", streamId: "video", atUs: 3 });
  expect(occurrences.map(({ clipId, firstProjectUs }) => [clipId, firstProjectUs])).toEqual([
    ["left", null],
    ["right", 2],
  ]);
});

test("fractional project bounds retain phase and reject noncanonical times", () => {
  const selected = clip("fractional");
  const input = {
    ...document(),
    clips: [
      {
        ...selected,
        placement: {
          kind: "project",
          range: {
            startUs: { numerator: 1, denominator: 3 },
            endUs: { numerator: 11, denominator: 3 },
          },
        },
      },
    ],
  };
  const model = validateComposition(input, [asset()]);
  expect(model.durationUs).toBe(4);
  expect(projectToSource(model, 0)).toEqual([]);
  expect(projectToSource(model, 1)).toMatchObject([{ sourceUs: 2 }]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "video", atUs: 2 })[0]?.firstProjectUs,
  ).toBe(1);
  input.clips[0]!.placement.range.startUs = { numerator: 1, denominator: 1 };
  expect(() => validateComposition(input, [asset()])).toThrow("Use an integer");
});

test("malformed fractional endpoints always report typed invalid composition", () => {
  for (const endUs of [
    { numerator: 1, denominator: 0 },
    { numerator: 1, denominator: -1 },
    { numerator: 1.5, denominator: 2 },
    { numerator: 1, denominator: Infinity },
    { numerator: Number.MAX_SAFE_INTEGER + 1, denominator: 3 },
  ]) {
    const input = {
      ...document(),
      clips: [
        {
          ...clip("invalid"),
          source: { kind: "range", range: { startUs: 0, endUs } },
        },
      ],
    };
    expect(() => validateComposition(input, [asset()])).toThrow(CompositionError);
    try {
      validateComposition(input, [asset()]);
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_COMPOSITION" });
    }
  }
});

test("authored silence stays distinct from acquisition gaps and accepts only normalized attachments", () => {
  const source = asset();
  source.streams[1] = {
    id: "audio",
    kind: "audio",
    bounds: range(2, 20),
    available: [range(2, 3), range(4, 20)],
  };
  const sound: MediaClip = {
    ...clip("sound", 0, 4),
    streamId: "audio",
    trackId: "sound",
    source: { kind: "range", range: range(2, 6) },
  };
  const silence: Clip = {
    id: "silence",
    trackId: "sound",
    source: { kind: "silence" },
    placement: { kind: "project", range: range(4, 8) },
  };
  const model = validateComposition(document([sound, silence]), [source]);
  expect(projectToSource(model, 1)).toMatchObject([
    { clipId: "sound", sourceUs: 3, available: false },
  ]);
  expect(projectToSource(model, 5)).toEqual([]);
  expect(model.clips.find((value) => value.clip.id === "silence")!.available).toEqual([
    { start: r(4n), end: r(8n) },
  ]);
  expect(
    sourceToProject(model, { assetId: "source", streamId: "audio", atUs: 5 }).map(
      (value) => value.clipId,
    ),
  ).toEqual(["sound"]);
  expect(() =>
    resolvePlacement(model, { kind: "content", clipId: "silence", sourceRange: range(0, 1) }),
  ).toThrow("normalized clip anchor");
  expect(
    resolvePlacement(model, {
      kind: "clip",
      clipId: "silence",
      start: { numerator: 1, denominator: 4 },
      end: { numerator: 3, denominator: 4 },
    }),
  ).toEqual({ range: { start: r(5n), end: r(7n) }, available: [{ start: r(5n), end: r(7n) }] });
  expect(() => validateComposition(document([{ ...silence, trackId: "picture" }]), [])).toThrow(
    "Silence requires an audio track",
  );
  for (const invalid of [
    { ...silence, assetId: "fake" },
    { ...silence, pitch: "preserve" },
  ])
    expect(() => validateComposition({ ...document(), clips: [invalid] }, [])).toThrow(
      CompositionError,
    );
});
