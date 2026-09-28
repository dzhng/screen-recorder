import { expect, test } from "vitest";
import {
  applyBatch,
  createCompiler,
  validateComposition,
  type Composition,
  type ScalarCurve,
} from "./index.js";
const fraction = (numerator: number, denominator = 1) => ({ numerator, denominator });
const curve = (first: number, last: number): { keys: ScalarCurve["keys"][number][] } => ({
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

test("animated position and rotation share timing while retaining independent values", () => {
  const doc = structuredClone(document);
  doc.processing[0]!.steps[0]!.processor = {
    type: "geometry",
    rect: { x: curve(-8, 16), y: curve(12, -4), width: 48, height: 32 },
    rotationDeg: curve(-45, 135),
    scale: { x: curve(0.5, 1.5), y: 1 },
  };
  const rendered = operations(doc);
  for (let i = 0; i < 8; i++) {
    const t = i / 8,
      fixed = structuredClone(doc);
    fixed.processing[0]!.steps[0]!.processor = {
      type: "geometry",
      rect: { x: (1 - t) * -8 + t * 16, y: (1 - t) * 12 + t * -4, width: 48, height: 32 },
      rotationDeg: (1 - t) * -45 + t * 135,
      scale: { x: (1 - t) * 0.5 + t * 1.5, y: 1 },
    };
    expect(rendered[i]).toEqual(operations(fixed, i * 125000, i * 125000 + 1)[0]);
  }
  expect(operations(edit(doc, [{ operation: "split", clipIds: ["c"], atUs: 375001 }]))).toEqual(
    rendered,
  );
});

test("position-only windows, curve boundaries and edits use the original normalized clock", () => {
  const doc = structuredClone(document),
    x = curve(-8, 8);
  x.keys.splice(1, 0, { at: fraction(1, 4), value: 3, interpolation: "hold" });
  doc.processing[0]!.steps[0]!.processor = {
    type: "geometry",
    rect: { x, y: curve(4, -4), width: 64, height: 48 },
    rotationDeg: curve(-30, 30),
  };
  expect(compile(doc).processingBoundaries()).toEqual([0, 250000, 1000000]);
  const before = operations(doc);
  const moved = edit(doc, [{ operation: "move", clipIds: ["c"], atUs: 2000000, ripple: "none" }]);
  expect(operations(moved, 2000000, 3000000)).toEqual(before);
  const split = edit(doc, [{ operation: "split", clipIds: ["c"], atUs: 375001 }]);
  expect(operations(split)).toEqual(before);
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
    "trim-pose",
  );
  expect(operations(trimmed, 500000, 900000)).toEqual(operations(doc, 500000, 900000));
  const slowed = edit(doc, [
    { operation: "retime", clipIds: ["c"], durationUs: 2000000, ripple: "none" },
  ]);
  expect(operations(slowed, 0, 2000000).filter((_, i) => i % 2 === 0)).toEqual(before);
  doc.processing[0]!.steps[0]!.window = {
    kind: "clip",
    clipId: "c",
    start: fraction(1, 4),
    end: fraction(3, 4),
  };
  const dry = structuredClone(doc);
  dry.processing = [];
  expect(operations(doc)[0]).toEqual(operations(dry)[0]);
  expect(operations(doc)[4]).toEqual(before[4]);
  expect(operations(doc)[6]).toEqual(operations(dry)[6]);
});

test.each(["x", "y", "rotationDeg"])(
  "%s curve validates the entire function before execution",
  (slot) => {
    const doc = structuredClone(document);
    const overflow = {
      keys: [
        {
          at: fraction(0),
          value: 1,
          interpolation: {
            cubic: [0, Number.MAX_VALUE, 1, Number.MAX_VALUE] as [number, number, number, number],
          },
        },
        { at: fraction(1), value: 3, interpolation: "linear" as const },
      ],
    };
    doc.processing[0]!.steps[0]!.processor =
      slot === "rotationDeg"
        ? { type: "geometry", rotationDeg: overflow }
        : { type: "geometry", rect: { x: 0, y: 0, width: 64, height: 48, [slot]: overflow } };
    expect(() => validateComposition(doc, assets)).toThrow(/parameter bounds/);
  },
);

test("animated top-left pivot follows authored x/y and clockwise angle in raster coordinates", () => {
  const doc = structuredClone(document);
  doc.processing[0]!.steps[0]!.processor = {
    type: "geometry",
    rect: { x: curve(4, 12), y: curve(6, 14), width: 64, height: 48 },
    rotationDeg: curve(0, 180),
    pivot: { x: 0, y: 0 },
  };
  for (let i = 0; i < 8; i++) {
    const row = operations(doc, i * 125000, i * 125000 + 1)[0]!;
    for (const distance of [0, 8]) {
      let x = distance,
        y = 48;
      for (const op of row)
        if (op.kind === "affine") {
          const [a, b, c, d, tx, ty] = op.matrix;
          [x, y] = [a * x + c * y + tx, b * x + d * y + ty];
        }
      const t = i / 8,
        angle = t * Math.PI;
      expect(x).toBeCloseTo(4 + 8 * t + distance * Math.cos(angle), 10);
      expect(y).toBeCloseTo(48 - (6 + 8 * t + distance * Math.sin(angle)), 10);
    }
  }
});
