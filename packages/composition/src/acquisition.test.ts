import { expect, test } from "vitest";
import {
  validateComposition,
  createSourceRangeProjection,
  createCompiler,
  applyBatch,
  type Asset,
  type Composition,
  type MediaClip,
} from "./index.js";
const range = (startUs: number, endUs: number) => ({ startUs, endUs });
const assets: Asset[] = [
  {
    id: "bytes",
    streams: [
      { id: "audio", kind: "audio", bounds: range(0, 2000000), available: [range(0, 2000000)] },
      { id: "video", kind: "video", bounds: range(0, 2000000), available: [range(0, 2000000)] },
    ],
  },
];
const acquisitions = [
  {
    id: "a",
    bindings: ["audio", "video"].map((streamId) => ({
      assetId: "bytes",
      streamId,
      available: [range(0, 900000), range(1100000, 2000000)],
    })),
  },
  {
    id: "b",
    bindings: ["audio", "video"].map((streamId) => ({
      assetId: "bytes",
      streamId,
      available: [range(0, 2000000)],
    })),
  },
];
function clip(id: string, acquisitionId?: string, streamId = "audio", startUs = 0): MediaClip {
  return {
    id,
    assetId: "bytes",
    streamId,
    trackId: streamId,
    ...(acquisitionId === undefined ? {} : { acquisitionId }),
    source: { kind: "range", range: range(0, 2000000) },
    placement: { kind: "project", range: range(startUs, startUs + 2000000) },
  };
}
function document(clips: MediaClip[]): Composition {
  return {
    canvas: {
      width: 160,
      height: 90,
      fps: { numerator: 10, denominator: 1 },
      background: "#000000ff",
    },
    tracks: [
      { id: "audio", kind: "audio", order: 0 },
      { id: "video", kind: "video", order: 0 },
    ],
    clips,
    syncGroups: [],
    processing: [],
    groups: [],
    captions: [],
  };
}

test("same bytes retain different acquisition support without changing physical-only occurrences", () => {
  const model = validateComposition(
    document([
      clip("masked", "a"),
      clip("full", "b", "audio", 2000000),
      clip("physical", undefined, "audio", 4000000),
    ]),
    assets,
    acquisitions,
  );
  const occurrences = createSourceRangeProjection(model).all({
    assetId: "bytes",
    streamId: "audio",
    range: range(800000, 1200000),
  });
  expect(
    occurrences.map((row) => [
      row.clipId,
      row.completeness,
      row.fragments.map((part) => part.source),
    ]),
  ).toEqual([
    [
      "masked",
      "partial",
      [
        {
          start: { numerator: 800000n, denominator: 1n },
          end: { numerator: 900000n, denominator: 1n },
        },
        {
          start: { numerator: 1100000n, denominator: 1n },
          end: { numerator: 1200000n, denominator: 1n },
        },
      ],
    ],
    ...["full", "physical"].map((id) => [
      id,
      "whole",
      [
        {
          start: { numerator: 800000n, denominator: 1n },
          end: { numerator: 1200000n, denominator: 1n },
        },
      ],
    ]),
  ]);
});

test("compiled PCM contexts and frame support use the same acquisition hole", () => {
  const model = validateComposition(
    document([
      clip("audio-a", "a"),
      clip("audio-b", "b", "audio", 2000000),
      clip("audio-physical", undefined, "audio", 4000000),
      clip("video-a", "a", "video"),
      clip("video-b", "b", "video", 2000000),
    ]),
    assets,
    acquisitions,
  );
  const compiler = createCompiler(model, "revision");
  const audio = [...compiler.audio(range(0, 6000000))];
  expect(audio.map((row) => [row.clipId, row.available, row.context])).toEqual([
    [
      "audio-a",
      [
        { start: 0, end: 43200 },
        { start: 52800, end: 96000 },
      ],
      [
        { source: range(0, 900000), sampleRange: { start: 0, end: 43200 } },
        { source: range(1100000, 2000000), sampleRange: { start: 52800, end: 96000 } },
      ],
    ],
    [
      "audio-b",
      [{ start: 96000, end: 192000 }],
      [{ source: range(0, 2000000), sampleRange: { start: 96000, end: 192000 } }],
    ],
    [
      "audio-physical",
      [{ start: 192000, end: 288000 }],
      [{ source: range(0, 2000000), sampleRange: { start: 192000, end: 288000 } }],
    ],
  ]);
  expect(
    [...compiler.frames(range(800000, 1200000))].map((frame) =>
      frame.layers.map((layer) => [layer.sourceUs, layer.availability]),
    ),
  ).toEqual([
    [[800000, "available"]],
    [[900000, "source-unavailable"]],
    [[1000000, "source-unavailable"]],
    [[1100000, "available"]],
  ]);
  expect(
    [...compiler.frames(range(2900000, 3100000))].map((frame) => frame.layers[0]?.availability),
  ).toEqual(["available", "available"]);
});

test("acquisition support intersects physical holes and propagates through exact ancestor mapping", () => {
  const parent = clip("parent", "a", "video");
  parent.placement = { kind: "project", range: range(0, 3) };
  const child = clip("child", "b");
  child.placement = { kind: "content", clipId: "parent", sourceRange: range(0, 2000000) };
  const physical = structuredClone(assets);
  physical[0]!.streams[0] = {
    id: "audio",
    kind: "audio",
    bounds: range(0, 2000000),
    available: [range(0, 1200000), range(1400000, 2000000)],
  };
  const model = validateComposition(document([parent, child]), physical, acquisitions);
  const value = createSourceRangeProjection(model).clip("child", range(800000, 1500000))!;
  expect(value.completeness).toBe("partial");
  expect(value.fragments.map((part) => part.project)).toEqual([
    { start: { numerator: 6n, denominator: 5n }, end: { numerator: 27n, denominator: 20n } },
    { start: { numerator: 33n, denominator: 20n }, end: { numerator: 9n, denominator: 5n } },
    { start: { numerator: 21n, denominator: 10n }, end: { numerator: 9n, denominator: 4n } },
  ]);
});

test("edits preserve acquisition bindings and deterministic receipts across every revalidation", () => {
  const original = document([clip("original", "a")]);
  const operations = [
    {
      operation: "split",
      clipIds: ["original"],
      atUs: 1000000,
      rightLabels: [{ clipId: "original", label: "right" }],
    },
    {
      operation: "trim",
      clipId: { label: "right" },
      range: range(1000000, 1800000),
      ripple: "none",
    },
    {
      operation: "duplicate",
      clipIds: ["original"],
      atUs: 2000000,
      copyLabels: [{ clipId: "original", label: "copy" }],
    },
    { operation: "move", clipIds: [{ label: "copy" }], atUs: 3000000, ripple: "none" },
    { operation: "retime", clipIds: [{ label: "copy" }], durationUs: 500000, ripple: "none" },
  ];
  const input = { assets, acquisitions, namespace: "request" };
  const edited = applyBatch(original, operations, input);
  expect(applyBatch(original, operations, input)).toEqual(edited);
  expect(edited.document.clips.map((row) => "acquisitionId" in row && row.acquisitionId)).toEqual([
    "a",
    "a",
    "a",
  ]);
  const projection = createSourceRangeProjection(
    validateComposition(edited.document, assets, acquisitions),
  );
  expect(
    projection.all({ assetId: "bytes", streamId: "audio", range: range(900000, 1100000) }),
  ).toEqual([]);
  expect(original.clips).toEqual([clip("original", "a")]);
});

test("replacement selects a complete source binding independently of processing keep or reset", () => {
  const original = document([clip("original", "a")]);
  original.processing = [
    {
      target: { kind: "clip", id: "original" },
      steps: [{ id: "gain", enabled: true, processor: { type: "gain", gain: 0.5 } }],
    },
  ];
  for (const processing of ["keep", "reset"]) {
    for (const acquisitionId of [undefined, "b"]) {
      const source = clip("replacement", acquisitionId);
      const result = applyBatch(
        original,
        [
          {
            operation: "replace",
            clipId: "original",
            kind: "audio",
            media: {
              assetId: source.assetId,
              streamId: source.streamId,
              source: source.source,
              ...(acquisitionId ? { acquisitionId } : {}),
            },
            processing,
          },
        ],
        { assets, acquisitions, namespace: "replace" },
      );
      expect(result).toStrictEqual(JSON.parse(JSON.stringify(result)));
      expect(result.document.clips[0]).toMatchObject({
        assetId: "bytes",
        streamId: "audio",
        ...(acquisitionId ? { acquisitionId } : {}),
      });
      expect(result.document.processing).toEqual(processing === "keep" ? original.processing : []);
      expect(
        createSourceRangeProjection(
          validateComposition(result.document, assets, acquisitions),
        ).clip("original", range(800000, 1200000))?.completeness,
      ).toBe("whole");
    }
  }
});

test("unknown or mismatched contexts reject a whole batch without changing its inputs", () => {
  const original = document([clip("original", "a")]);
  const snapshot = structuredClone(original);
  for (const acquisitionId of ["missing", "wrong-stream"]) {
    const contexts = [
      ...acquisitions,
      {
        id: "wrong-stream",
        bindings: [{ assetId: "bytes", streamId: "video", available: [range(0, 2000000)] }],
      },
    ];
    expect(() =>
      applyBatch(
        original,
        [
          { operation: "move", clipIds: ["original"], atUs: 2000000, ripple: "none" },
          {
            operation: "replace",
            clipId: "original",
            kind: "audio",
            media: {
              assetId: "bytes",
              streamId: "audio",
              acquisitionId,
              source: { kind: "range", range: range(0, 2000000) },
            },
          },
        ],
        { assets, acquisitions: contexts, namespace: "rejected" },
      ),
    ).toThrow(/Unknown acquisition binding/);
    expect(original).toEqual(snapshot);
    expect(validateComposition(original, assets, contexts).document).toEqual(snapshot);
  }
});

test("context metadata snapshots remain detached and reject ambiguous or overlapping bindings", () => {
  const contexts = structuredClone(acquisitions);
  const model = validateComposition(document([clip("original", "a")]), assets, contexts);
  contexts[0]!.bindings[0]!.available = [range(0, 2000000)];
  expect(createSourceRangeProjection(model).clip("original", range(900000, 1100000))).toBeNull();
  const binding = acquisitions[0]!.bindings[0]!;
  for (const invalid of [
    [acquisitions[0], acquisitions[0]],
    [{ id: "a", bindings: [binding, binding] }],
    [
      {
        id: "a",
        bindings: [{ ...binding, available: [range(0, 1000000), range(900000, 2000000)] }],
      },
    ],
  ])
    expect(() => validateComposition(document([clip("original", "a")]), assets, invalid)).toThrow(
      /Duplicate|Invalid acquisition/,
    );
  const modelWithEmptySupport = validateComposition(document([clip("original", "empty")]), assets, [
    { id: "empty", bindings: [{ ...binding, available: [] }] },
  ]);
  expect(
    createSourceRangeProjection(modelWithEmptySupport).clip("original", range(0, 2000000)),
  ).toBeNull();
});

test.each([
  [
    { operation: "insert", atUs: 500000, durationUs: 250000, ripple: { trackIds: ["audio"] } },
    [
      { start: 0n, end: 500000n },
      { start: 750000n, end: 2250000n },
      { start: 3250000n, end: 5250000n },
    ],
  ],
  [
    { operation: "move", clipIds: ["original"], atUs: 3000000, ripple: { trackIds: ["audio"] } },
    [
      { start: 1000000n, end: 3000000n },
      { start: 3000000n, end: 5000000n },
    ],
  ],
  [
    {
      operation: "retime",
      clipIds: ["original"],
      durationUs: 1000000,
      ripple: { trackIds: ["audio"] },
    },
    [
      { start: 0n, end: 1000000n },
      { start: 2000000n, end: 4000000n },
    ],
  ],
])("ripple helper retains acquisition contexts for %j", (operation, ranges) => {
  const original = document([clip("original", "a"), clip("later", "b", "audio", 3000000)]);
  const result = applyBatch(original, [operation], { assets, acquisitions, namespace: "ripple" });
  const model = validateComposition(result.document, assets, acquisitions);
  expect(
    model.clips.map((row) => ({ start: row.range.start.numerator, end: row.range.end.numerator })),
  ).toEqual(ranges);
  expect(
    createSourceRangeProjection(model)
      .all({ assetId: "bytes", streamId: "audio", range: range(900000, 1100000) })
      .map((row) => row.clipId),
  ).toEqual(["later"]);
});
