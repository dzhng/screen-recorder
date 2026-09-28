import { expect, test } from "vitest";
import {
  createCompiler,
  validateComposition,
  scalarCurveSchema,
  type Composition,
  type ScalarCurve,
} from "./index.js";

const document: Composition = {
  canvas: {
    width: 64,
    height: 48,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "v", kind: "video", order: 0 }],
  groups: [],
  processing: [],
  syncGroups: [],
  captions: [],
  clips: [
    {
      id: "c",
      trackId: "v",
      assetId: "a",
      streamId: "v",
      source: { kind: "range", range: { startUs: 100, endUs: 200 } },
      placement: { kind: "project", range: { startUs: 1000, endUs: 1200 } },
    },
  ],
};
const assets = [
  {
    id: "a",
    streams: [
      {
        id: "v",
        kind: "video",
        width: 64,
        height: 48,
        bounds: { startUs: 0, endUs: 1000 },
        available: [{ startUs: 0, endUs: 1000 }],
      },
    ],
  },
];
const compiler = (input: Composition = document, inputAssets = assets) =>
  createCompiler(validateComposition(input, inputAssets), "r");
const project = { kind: "project", range: { startUs: 0, endUs: 1000 } };
const key = (
  at: number,
  value: number,
  interpolation: ScalarCurve["keys"][number]["interpolation"] = "linear",
) => ({ at, value, interpolation });

test("outgoing hold/linear segments, exact keys and clamped endpoints inside half-open activation", () => {
  const curve = compiler().curve(
    { keys: [key(100, 2, "hold"), key(200, 6), key(400, 10)] },
    project,
  );
  expect([0, 99, 100, 199, 200, 300, 400, 999, 1000].map((time) => curve.sample(time))).toEqual([
    2,
    2,
    2,
    2,
    6,
    8,
    10,
    10,
    null,
  ]);
  expect(
    compiler()
      .curve({ keys: [key(10, -3)] }, project)
      .sample(800),
  ).toBe(-3);
});

test("cubic easing inverts x rather than treating project progress as its parameter", () => {
  // x=t^3, y=3t-3t^2+t^3, so x=1/8 gives y=7/8 exactly.
  const curve = compiler().curve(
    { keys: [key(0, 0, { cubic: [0, 1, 0, 1] }), key(800, 1)] },
    project,
  );
  expect(curve.sample(100)).toBeCloseTo(7 / 8, 10);
  expect(curve.sample(0)).toBe(0);
  expect(curve.sample(800)).toBe(1);
  // x has a stationary derivative at the center; no Newton division is required.
  const stationary = compiler().curve(
    { keys: [key(0, 0, { cubic: [1, 0, 0, 1] }), key(800, 1)] },
    project,
  );
  expect(stationary.sample(400)).toBeCloseTo(0.5, 10);
  const overshoot = compiler().curve(
    { keys: [key(0, 0, { cubic: [1 / 3, 2, 2 / 3, 2] }), key(800, 1)] },
    project,
  );
  expect(overshoot.sample(400)).toBeCloseTo(1.625, 10);
});

test("restriction retains the entire original cubic and exact fractional split ownership", () => {
  const original = compiler().curve(
    { keys: [key(0, 0, { cubic: [0.2, -0.4, 0.8, 1.6] }), key(900, 2)] },
    project,
  );
  const split = { numerator: 1001, denominator: 3 };
  const left = original.restrict({ startUs: 0, endUs: split });
  const right = original.restrict({ startUs: split, endUs: 1000 });
  for (let at = 0; at < 1000; at += 7)
    expect((at < 1001 / 3 ? left : right).sample(at)).toBe(original.sample(at));
  expect(left.sample(split)).toBeNull();
  expect(right.sample(split)).toBe(original.sample(split));
  const trim = right.restrict({ startUs: 500, endUs: 850 });
  expect(trim.sample(499)).toBeNull();
  expect(trim.sample(500)).toBe(original.sample(500));
  expect(trim.sample(849)).toBe(original.sample(849));
  expect(trim.sample(850)).toBeNull();
  expect(trim.restrict({ startUs: 0, endUs: 1000 }).sample(499)).toBeNull();
});

test("content curves follow the existing source clock through movement and retiming", () => {
  const definition = { keys: [key(100, 0), key(200, 10)] };
  const anchor = { kind: "content", clipId: "c", sourceRange: { startUs: 100, endUs: 200 } };
  const original = compiler().curve(definition, anchor);
  expect(original.sample(1050)).toBe(2.5);
  const moved = structuredClone(document);
  moved.clips[0]!.placement = { kind: "project", range: { startUs: 3000, endUs: 3400 } };
  const curve = compiler(moved).curve(definition, anchor);
  expect(curve.sample(3100)).toBe(original.sample(1050));
  expect(curve.sample(3300)).toBe(7.5);
  expect(curve.sample(1050)).toBeNull();
  const fixed = compiler(moved).curve({ keys: [key(0, 0), key(1000, 1)] }, project);
  expect(fixed.sample(500)).toBe(0.5);
});

test("normalized clip keys work for held pictures and resolve the parent rather than anchor subrange", () => {
  const held = structuredClone(document);
  held.clips[0]!.source = { kind: "hold", atUs: 150 };
  const definition = {
    keys: [
      { ...key(0, 0), at: { numerator: 0, denominator: 1 } },
      { ...key(1, 10), at: { numerator: 1, denominator: 1 } },
    ],
  };
  const anchor = {
    kind: "clip",
    clipId: "c",
    start: { numerator: 1, denominator: 4 },
    end: { numerator: 3, denominator: 4 },
  };
  const curve = compiler(held).curve(definition, anchor);
  expect(curve.sample(1049)).toBeNull();
  expect(curve.sample(1050)).toBe(2.5);
  expect(curve.sample(1100)).toBe(5);
  expect(curve.sample(1150)).toBeNull();
  const still = structuredClone(held);
  still.clips[0]!.source = { kind: "hold", atUs: 0 };
  const imageCurve = createCompiler(
    validateComposition(still, [
      {
        id: "a",
        streams: [{ id: "v", kind: "image", width: 64, height: 48 }],
      },
    ]),
    "image",
  ).curve(definition, anchor);
  expect(imageCurve.sample(1050)).toBe(2.5);
  expect(imageCurve.sample(1100)).toBe(5);
  expect(imageCurve.sample(1150)).toBeNull();
  expect(() =>
    compiler(held).curve(
      { keys: [key(150, 1)] },
      { kind: "content", clipId: "c", sourceRange: { startUs: 100, endUs: 200 } },
    ),
  ).toThrow(/source clock/);
});

test("curve activation retains source-availability gaps and original interpolation across them", () => {
  const missing = structuredClone(assets);
  missing[0]!.streams[0]!.available = [
    { startUs: 0, endUs: 140 },
    { startUs: 160, endUs: 1000 },
  ];
  const curve = compiler(document, missing).curve(
    { keys: [key(100, 0), key(200, 10)] },
    { kind: "content", clipId: "c", sourceRange: { startUs: 100, endUs: 200 } },
  );
  expect(curve.sample(1070)).toBe(3.5);
  expect(curve.sample(1080)).toBeNull();
  expect(curve.sample(1119)).toBeNull();
  expect(curve.sample(1120)).toBe(6);
});

test("key domains reject mixed/fractional integer times and noncanonical clip fractions", () => {
  for (const kind of ["project", "content"] as const) {
    for (const at of [0.5, { numerator: 1, denominator: 2 }, NaN, -1])
      expect(scalarCurveSchema(kind).safeParse({ keys: [{ ...key(0, 1), at }] }).success).toBe(
        false,
      );
  }
  for (const at of [
    0,
    { numerator: 2, denominator: 4 },
    { numerator: 2, denominator: 1 },
    { numerator: 1, denominator: 0 },
  ])
    expect(scalarCurveSchema("clip").safeParse({ keys: [{ ...key(0, 1), at }] }).success).toBe(
      false,
    );
  for (const keys of [
    [],
    [key(1, 1), key(1, 2)],
    [key(2, 1), key(1, 2)],
    [key(0, Infinity)],
    [key(0, 1, { cubic: [-0.1, 0, 1, 1] })],
  ])
    expect(scalarCurveSchema("project").safeParse({ keys }).success).toBe(false);
});

test("exact key search preserves adjacent safe-integer times before floating interpolation", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const curve = compiler().curve(
    { keys: [key(max - 3, 0), key(max - 1, 1)] },
    { kind: "project", range: { startUs: max - 4, endUs: max } },
  );
  expect(curve.sample(max - 2)).toBe(0.5);
  expect(curve.sample(max - 1)).toBe(1);
});
