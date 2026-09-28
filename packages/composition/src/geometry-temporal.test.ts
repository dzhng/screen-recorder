import { expect, test } from "vitest";
import { applyBatch, createCompiler, validateComposition, type Composition } from "./index.js";
const fraction = (numerator: number, denominator = 1) => ({ numerator, denominator });
const curve = (first: number, last: number) => ({
  keys: [
    { at: fraction(0), value: first, interpolation: "linear" as const },
    { at: fraction(1), value: last, interpolation: "linear" as const },
  ],
});
const assets = [
  {
    id: "a",
    streams: [
      {
        id: "v",
        kind: "video",
        width: 64,
        height: 48,
        bounds: { startUs: 0, endUs: 3000000 },
        available: [{ startUs: 0, endUs: 3000000 }],
      },
    ],
  },
];
const document: Composition = {
  canvas: { width: 64, height: 48, fps: { numerator: 8, denominator: 1 }, background: "#000000ff" },
  tracks: [{ id: "v", kind: "video", order: 0 }],
  groups: [],
  syncGroups: [],
  captions: [],
  clips: [
    {
      id: "c",
      trackId: "v",
      assetId: "a",
      streamId: "v",
      source: { kind: "range", range: { startUs: 500000, endUs: 1500000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    },
  ],
  processing: [
    {
      target: { kind: "clip", id: "c" },
      steps: [
        {
          id: "zoom",
          enabled: true,
          processor: {
            type: "geometry",
            scale: { x: curve(0.5, 1.5), y: curve(1.5, 0.5) },
            pivot: { x: 0.25, y: 0.75 },
          },
        },
      ],
    },
  ],
};
const compile = (doc: unknown) => createCompiler(validateComposition(doc, assets), "r");
const operations = (doc: unknown, startUs = 0, endUs = 1000000) =>
  [...compile(doc).frames({ startUs, endUs })].map((frame) =>
    frame.visual.flatMap((node) => node.operations),
  );
const edit = (doc: unknown, ops: unknown[], namespace = "edit") =>
  applyBatch(doc, ops, { assets, namespace }).document;

test("independent scale slots compile exactly to existing static matrices at each picture", () => {
  const animated = operations(document);
  for (let i = 0; i < 8; i++) {
    const fixed = structuredClone(document),
      processor = fixed.processing[0]!.steps[0]!.processor;
    if (processor.type !== "geometry") throw Error("fixture");
    const t = i / 8;
    processor.scale = { x: (1 - t) * 0.5 + t * 1.5, y: (1 - t) * 1.5 + t * 0.5 };
    expect(animated[i]).toEqual(operations(fixed, i * 125000, i * 125000 + 1)[0]);
  }
});

test("split, nested trim and padding retain the same complete scale functions", () => {
  const split = edit(document, [{ operation: "split", clipIds: ["c"], atUs: 375001 }]);
  expect(operations(split)).toEqual(operations(document));
  const right = split.clips.find((clip) => clip.id !== "c")!;
  const trimmed = edit(
    split,
    [
      {
        operation: "trim",
        clipId: right.id,
        range: { startUs: 500000, endUs: 900000 },
        ripple: "none",
      },
    ],
    "trim",
  );
  expect(operations(trimmed, 500000, 900000)).toEqual(operations(document, 500000, 900000));
  const padded = edit(document, [
    {
      operation: "replace",
      clipId: "c",
      kind: "video",
      fit: "hold",
      media: {
        assetId: "a",
        streamId: "v",
        source: { kind: "range", range: { startUs: 1700000, endUs: 2075001 } },
      },
    },
  ]);
  expect(operations(padded)).toEqual(operations(document));
});

test("moved and retimed zooms keep the same normalized trajectory", () => {
  const moved = edit(document, [
    { operation: "move", clipIds: ["c"], atUs: 2000000, ripple: "none" },
  ]);
  expect(operations(moved, 2000000, 3000000)).toEqual(operations(document));
  const slowed = edit(document, [
    { operation: "retime", clipIds: ["c"], durationUs: 2000000, ripple: "none" },
  ]);
  expect(operations(slowed, 0, 2000000).filter((_, i) => i % 2 === 0)).toEqual(
    operations(document),
  );
  const duplicate = edit(document, [{ operation: "duplicate", clipIds: ["c"], atUs: 2000000 }]);
  expect(operations(duplicate, 2000000, 3000000)).toEqual(operations(document));
});

test("windowed geometry is dry outside activation and publishes all scalar key boundaries", () => {
  const doc = structuredClone(document);
  doc.processing[0]!.steps[0]!.window = {
    kind: "clip",
    clipId: "c",
    start: fraction(1, 4),
    end: fraction(3, 4),
  };
  const dry = structuredClone(document);
  dry.processing = [];
  const rendered = operations(doc);
  expect(rendered[0]).toEqual(operations(dry)[0]);
  expect(rendered[4]).toEqual(operations(document)[4]);
  expect(rendered[6]).toEqual(operations(dry)[6]);
  expect(compile(doc).processingBoundaries()).toEqual([250000, 750000]);
  const split = edit(doc, [{ operation: "split", clipIds: ["c"], atUs: 375001 }]);
  expect(operations(split)).toEqual(rendered);
  const fixed = structuredClone(doc);
  fixed.processing[0]!.steps[0]!.processor = { type: "geometry", scale: { x: 2, y: 2 } };
  expect(operations(fixed)[0]).toEqual(operations(dry)[0]);
});

test("negative scales mirror and a zero crossing emits the established degenerate matrix", () => {
  const doc = structuredClone(document);
  doc.processing[0]!.steps[0]!.processor = { type: "geometry", scale: { x: curve(-1, 1), y: 1 } };
  const frames = operations(doc);
  const determinants = frames.map((row) =>
    row
      .filter((op) => op.kind === "affine")
      .map((op) => op.matrix[0] * op.matrix[3] - op.matrix[1] * op.matrix[2]),
  );
  expect(determinants[0]!.some((value) => value < 0)).toBe(true);
  expect(determinants[4]!.some((value) => value === 0)).toBe(true);
  expect(
    frames.every((row) =>
      row.filter((op) => op.kind === "affine").every((op) => op.matrix.every(Number.isFinite)),
    ),
  ).toBe(true);
});

test("scale curves reject non-finite full-curve extrema and preserve matrix precision refusal", () => {
  const invalid = structuredClone(document);
  invalid.processing[0]!.steps[0]!.processor = {
    type: "geometry",
    scale: {
      x: {
        keys: [
          {
            at: fraction(0),
            value: 1,
            interpolation: { cubic: [0, Number.MAX_VALUE, 1, Number.MAX_VALUE] },
          },
          { at: fraction(1), value: 3, interpolation: "linear" },
        ],
      },
      y: 1,
    },
  };
  expect(() => validateComposition(invalid, assets)).toThrow(/parameter bounds/);
  const oversized = structuredClone(document);
  oversized.processing[0]!.steps[0]!.processor = {
    type: "geometry",
    scale: { x: curve(1, 1e18), y: 1 },
  };
  expect(() => operations(oversized)).toThrow(/geometry|precision|safe/i);
});

test("each scalar slot contributes key boundaries and retains its required time domain", () => {
  const doc = structuredClone(document);
  const x = curve(1, 2),
    y = curve(2, 1);
  x.keys.splice(1, 0, { at: fraction(1, 2), value: 1.2, interpolation: "linear" });
  y.keys.splice(1, 0, { at: fraction(1, 4), value: 1.8, interpolation: "linear" });
  doc.processing[0]!.steps[0]!.processor = { type: "geometry", scale: { x, y } };
  expect(compile(doc).processingBoundaries()).toEqual([0, 250000, 500000, 1000000]);
  doc.processing[0]!.steps[0]!.window = { kind: "project", range: { startUs: 0, endUs: 1000000 } };
  expect(() => validateComposition(doc, assets)).toThrow(/clock/);
});

test("output geometry uses project-time curves after the flattened child picture", () => {
  const doc = structuredClone(document);
  doc.processing = [
    {
      target: { kind: "output" },
      steps: [
        {
          id: "zoom",
          enabled: true,
          processor: {
            type: "geometry",
            scale: {
              x: {
                keys: [
                  { at: 0, value: 1, interpolation: "linear" },
                  { at: 1000000, value: 2, interpolation: "linear" },
                ],
              },
              y: 1,
            },
          },
        },
      ],
    },
  ];
  const fixed = structuredClone(doc);
  fixed.processing[0]!.steps[0]!.processor = { type: "geometry", scale: { x: 1.5, y: 1 } };
  expect(operations(doc, 500000, 500001)).toEqual(operations(fixed, 500000, 500001));
});
