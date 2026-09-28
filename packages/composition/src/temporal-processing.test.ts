import { expect, test } from "vitest";
import {
  applyBatch,
  createCompiler,
  validateComposition,
  type Composition,
  type ProcessingStep,
} from "./index.js";
const fraction = (numerator: number, denominator = 1) => ({ numerator, denominator });
const curve = {
  keys: [
    {
      at: fraction(0),
      value: 0.1,
      interpolation: { cubic: [0.2, 0, 0.8, 1] as [number, number, number, number] },
    },
    { at: fraction(1), value: 0.9, interpolation: "linear" as const },
  ],
};
const assets = [
  {
    id: "asset",
    streams: [
      {
        id: "video",
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
  canvas: {
    width: 64,
    height: 48,
    fps: { numerator: 10, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "v", kind: "video", order: 0 }],
  groups: [],
  syncGroups: [],
  captions: [],
  clips: [
    {
      id: "c",
      trackId: "v",
      assetId: "asset",
      streamId: "video",
      source: { kind: "range", range: { startUs: 500000, endUs: 1500000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    },
  ],
  processing: [
    {
      target: { kind: "clip", id: "c" },
      steps: [{ id: "opacity", enabled: true, processor: { type: "opacity", opacity: curve } }],
    },
  ],
};
const compile = (doc: unknown) => createCompiler(validateComposition(doc, assets), "revision");
const edit = (doc: unknown, ops: unknown[], namespace = "edit") =>
  applyBatch(doc, ops, { assets, namespace }).document;
const opacity = (doc: unknown, startUs = 0, endUs = 1000000) =>
  [...compile(doc).frames({ startUs, endUs })].map((frame) => ({
    at: frame.sampleAtUs,
    values: frame.visual.flatMap((node) =>
      node.operations.filter((op) => op.kind === "opacity").map((op) => op.opacity),
    ),
  }));

test("actual split and nested trim retain complete normalized curves and windows", () => {
  const original = structuredClone(document);
  original.processing[0]!.steps[0]!.window = {
    kind: "clip",
    clipId: "c",
    start: fraction(1, 4),
    end: fraction(3, 4),
  };
  const split = edit(original, [{ operation: "split", clipIds: ["c"], atUs: 350001 }]);
  expect(opacity(split)).toEqual(opacity(original));
  const right = split.clips.find((clip) => clip.id !== "c")!;
  const trim = edit(
    split,
    [
      {
        operation: "trim",
        ripple: "none",
        clipId: right.id,
        range: { startUs: 400000, endUs: 900000 },
      },
    ],
    "trim",
  );
  expect(opacity(trim, 400000, 900000)).toEqual(opacity(original, 400000, 900000));
  expect(split.processing[1]!.steps[0]!.evaluationRange).toEqual({
    start: fraction(350001, 1000000),
    end: fraction(1),
  });
  expect(split.processing[1]!.steps[0]!.window).toEqual({
    ...original.processing[0]!.steps[0]!.window,
    clipId: right.id,
  });
});

test("move/retime follows clip time while project windows remain fixed", () => {
  const moved = edit(document, [
    { operation: "move", ripple: "none", clipIds: ["c"], atUs: 2000000 },
  ]);
  expect(opacity(moved, 2000000, 3000000).map((row) => row.values)).toEqual(
    opacity(document).map((row) => row.values),
  );
  const slowed = edit(document, [
    { operation: "retime", ripple: "none", clipIds: ["c"], durationUs: 2000000 },
  ]);
  expect(
    opacity(slowed, 0, 2000000)
      .filter((_, i) => i % 2 === 0)
      .map((row) => row.values),
  ).toEqual(opacity(document).map((row) => row.values));
  const fixed = structuredClone(document);
  fixed.processing[0]!.steps = [
    {
      id: "opacity",
      enabled: true,
      processor: { type: "opacity", opacity: 0.4 },
      window: { kind: "project", range: { startUs: 200000, endUs: 500000 } },
    },
  ];
  expect(
    opacity(
      edit(fixed, [{ operation: "move", ripple: "none", clipIds: ["c"], atUs: 2000000 }]),
      2000000,
      3000000,
    ).every((row) => row.values.length === 0),
  ).toBe(true);
});

test("replacement padding preserves normalized animation and source windows require repair/reset", () => {
  const replacement = {
    operation: "replace",
    clipId: "c",
    kind: "video",
    media: {
      assetId: "asset",
      streamId: "video",
      source: { kind: "range", range: { startUs: 1700000, endUs: 2050001 } },
    },
    fit: "hold",
  };
  expect(opacity(edit(document, [replacement]))).toEqual(opacity(document));
  const source = structuredClone(document);
  source.processing[0]!.steps = [
    {
      id: "opacity",
      enabled: true,
      processor: {
        type: "opacity",
        opacity: {
          keys: [
            { at: 500000, value: 0.2, interpolation: "linear" },
            { at: 1500000, value: 0.8, interpolation: "linear" },
          ],
        },
      },
      window: { kind: "content", clipId: "c", sourceRange: { startUs: 600000, endUs: 1400000 } },
    },
  ];
  const split = edit(source, [{ operation: "split", clipIds: ["c"], atUs: 500000 }]);
  expect(opacity(split)).toEqual(opacity(source));
  expect(() => edit(source, [replacement])).toThrow(/repair or reset/);
  expect(edit(source, [{ ...replacement, processing: "reset" }]).processing).toEqual([]);
});

test("duplicates remap local windows and preserve the full function", () => {
  const original = structuredClone(document);
  original.processing[0]!.steps[0]!.window = {
    kind: "clip",
    clipId: "c",
    start: fraction(1, 4),
    end: fraction(3, 4),
  };
  const copy = edit(original, [{ operation: "duplicate", clipIds: ["c"], atUs: 2000000 }]);
  expect(opacity(copy, 2000000, 3000000).map((row) => row.values)).toEqual(
    opacity(original).map((row) => row.values),
  );
  expect(copy.processing[1]!.steps[0]!.id).not.toBe("opacity");
});

test("sub-frame activation/key boundaries and taps come from the same programs", () => {
  const doc = structuredClone(document);
  doc.processing[0]!.steps = [
    {
      id: "opacity",
      enabled: true,
      processor: {
        type: "opacity",
        opacity: {
          keys: [
            { at: 10001, value: 0.2, interpolation: "linear" },
            { at: 19999, value: 0.8, interpolation: "linear" },
          ],
        },
      },
      window: { kind: "project", range: { startUs: 10000, endUs: 20000 } },
    },
  ];
  expect(compile(doc).processingBoundaries()).toEqual([10000, 10001, 19999, 20000]);
  expect(
    compile(doc).processingBoundaries({
      target: { kind: "clip", id: "c" },
      point: { kind: "dry" },
    }),
  ).toEqual([]);
  expect(opacity(doc).every((row) => row.values.length === 0)).toBe(true);
  doc.processing[0]!.steps[0]!.enabled = false;
  expect(compile(doc).processingBoundaries()).toEqual([]);
});

test("whole-stack get/set preserves timing and rejects wrong clocks, unsupported timing and opacity overshoot", () => {
  const step = {
    ...document.processing[0]!.steps[0]!,
    window: { kind: "clip" as const, clipId: "c", start: fraction(0), end: fraction(1) },
    evaluationRange: { start: fraction(1, 2), end: fraction(1) },
  };
  const configured = edit(document, [
    { operation: "processing.set", target: { kind: "clip", id: "c" }, steps: [step] },
  ]);
  expect(configured.processing[0]!.steps[0]).toEqual(step);
  const bad: ProcessingStep[] = [
    { ...step, window: { ...step.window, clipId: "missing" } },
    { ...step, processor: { type: "gain", gain: 1 } },
    {
      ...step,
      processor: {
        type: "opacity",
        opacity: { keys: [{ at: 0, value: 0.2, interpolation: "linear" }] },
      },
    },
    {
      ...step,
      processor: {
        type: "opacity",
        opacity: {
          keys: [
            { at: fraction(0), value: 0, interpolation: { cubic: [0, 2, 1, 2] } },
            { at: fraction(1), value: 1, interpolation: "linear" },
          ],
        },
      },
    },
  ];
  for (const value of bad)
    expect(() =>
      edit(document, [
        { operation: "processing.set", target: { kind: "clip", id: "c" }, steps: [value] },
      ]),
    ).toThrow();
});

test("range frames sample the same global instants and preserve opacity order", () => {
  const doc = structuredClone(document);
  doc.processing.push({
    target: { kind: "output" },
    steps: [
      {
        id: "out",
        enabled: true,
        processor: {
          type: "opacity",
          opacity: {
            keys: [
              { at: 0, value: 1, interpolation: "linear" },
              { at: 1000000, value: 0.5, interpolation: "linear" },
            ],
          },
        },
      },
    ],
  });
  const full = opacity(doc);
  expect(opacity(doc, 150001, 480001)).toEqual(
    full.filter((row) => row.at >= 100000 && row.at < 480001),
  );
  expect(full[5]!.values).toEqual([0.5, 0.75]);
});

test("same-batch labels resolve in clip-local windows", () => {
  const copied = edit(document, [
    {
      operation: "duplicate",
      clipIds: ["c"],
      atUs: 2000000,
      copyLabels: [{ clipId: "c", label: "copy" }],
    },
    {
      operation: "processing.set",
      target: { kind: "clip", id: { label: "copy" } },
      steps: [
        {
          processor: { type: "opacity", opacity: 0.4 },
          window: { kind: "clip", clipId: { label: "copy" }, start: fraction(0), end: fraction(1) },
        },
      ],
    },
  ]);
  expect(opacity(copied, 2000000, 3000000).every((row) => row.values[0] === 0.4)).toBe(true);
});

test("opacity validates curve extrema without forbidding harmless easing overshoot", () => {
  const overshoot = structuredClone(document);
  overshoot.processing[0]!.steps[0]!.processor = {
    type: "opacity",
    opacity: {
      keys: [
        { at: fraction(0), value: 0.45, interpolation: { cubic: [0, -1, 1, 2] } },
        { at: fraction(1), value: 0.55, interpolation: "linear" },
      ],
    },
  };
  expect(opacity(overshoot).every((row) => row.values[0]! >= 0 && row.values[0]! <= 1)).toBe(true);
  const invalid = structuredClone(document);
  invalid.processing[0]!.steps[0]!.evaluationRange = { start: fraction(0), end: fraction(1, 0) };
  expect(() => validateComposition(invalid, assets)).toThrow();
});
