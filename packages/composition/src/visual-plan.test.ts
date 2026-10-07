import { expect, test } from "vitest";
import { createCompiler, validateComposition, type Composition } from "./index.js";
const document: Composition = {
  canvas: {
    width: 100,
    height: 80,
    fps: { numerator: 10, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [
    { id: "a", kind: "video", order: 0, parentId: "inner" },
    { id: "b", kind: "video", order: 1, parentId: "inner" },
  ],
  groups: [
    { id: "inner", kind: "video", order: 0, parentId: "outer" },
    { id: "outer", kind: "video", order: 0 },
  ],
  clips: ["a", "b"].map((id) => ({
    id,
    trackId: id,
    assetId: "source",
    streamId: "v",
    source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
    placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
  })),
  syncGroups: [],
  processing: [
    {
      target: { kind: "clip", id: "a" },
      steps: [{ id: "clip-half", enabled: true, processor: { type: "opacity", opacity: 0.5 } }],
    },
    {
      target: { kind: "group", id: "inner" },
      steps: [{ id: "group-half", enabled: true, processor: { type: "opacity", opacity: 0.5 } }],
    },
    {
      target: { kind: "output" },
      steps: [{ id: "output-half", enabled: true, processor: { type: "opacity", opacity: 0.5 } }],
    },
  ],
};
const assets = [
  {
    id: "source",
    streams: [
      {
        id: "v",
        kind: "video",
        width: 40,
        height: 20,
        bounds: { startUs: 0, endUs: 1000000 },
        available: [{ startUs: 0, endUs: 1000000 }],
      },
    ],
  },
];
const compiler = (value = document) =>
  createCompiler(validateComposition(value, assets), "geometry-revision");
test("nested opacity remains on flattened parents and a dry group tap excludes its own and later processing", () => {
  const full = [...compiler().frames({ startUs: 0, endUs: 1 })][0]!;
  expect(full.layers.map((layer) => [layer.clipId, layer.width, layer.height])).toEqual([
    ["a", 40, 20],
    ["b", 40, 20],
  ]);
  expect(full.visual.map((node) => node.target)).toEqual([
    { kind: "clip", id: "a" },
    { kind: "track", id: "a" },
    { kind: "clip", id: "b" },
    { kind: "track", id: "b" },
    { kind: "group", id: "inner" },
    { kind: "group", id: "outer" },
    { kind: "output" },
  ]);
  expect(full.visual[4]).toEqual({
    target: { kind: "group", id: "inner" },
    inputs: [
      { kind: "track", id: "a" },
      { kind: "track", id: "b" },
    ],
    operations: [{ kind: "opacity", opacity: 0.5 }],
  });
  expect(full.visual[0]!.operations[0]).toEqual({ kind: "opacity", opacity: 0.5 });
  expect(full.visual[2]!.operations.some((operation) => operation.kind === "opacity")).toBe(false);
  const dry = compiler().videoWindow({
    range: { startUs: 0, endUs: 1 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "group", id: "inner" }, point: { kind: "dry" } },
  });
  const nodes = [...dry.frames()][0]!.visual;
  expect(nodes.at(-1)).toEqual({ ...full.visual[4], operations: [] });
  expect(nodes.length).toBe(5);
});

test("blend processing is retained as an explicit layer-combination operation", () => {
  const value = structuredClone(document);
  value.processing = [
    {
      target: { kind: "group", id: "inner" },
      steps: [{ id: "multiply", enabled: true, processor: { type: "blend", mode: "multiply" } }],
    },
  ];
  const frame = [...compiler(value).frames({ startUs: 0, endUs: 1 })][0]!;
  expect(
    frame.visual.find((node) => node.target.kind === "group" && node.target.id === "inner")
      ?.operations,
  ).toEqual([{ kind: "blend", mode: "multiply" }]);
});

test("a second geometry crops the fixed canvas domain; disabled steps do not alter primitives", () => {
  const value = structuredClone(document);
  value.processing = [
    {
      target: { kind: "clip", id: "a" },
      steps: [
        { id: "first", enabled: true, processor: { type: "geometry" } },
        { id: "bypass", enabled: false, processor: { type: "opacity", opacity: 0 } },
        {
          id: "second",
          enabled: true,
          processor: { type: "geometry", crop: { x: 5, y: 10, width: 20, height: 15 } },
        },
      ],
    },
  ];
  const operations = [...compiler(value).frames({ startUs: 0, endUs: 1 })][0]!.visual[0]!
    .operations;
  expect(operations.filter((operation) => operation.kind === "clamp")).toEqual([
    { kind: "clamp", x: 0.5, y: 0.5, width: 39, height: 19 },
    { kind: "clamp", x: 5.5, y: 55.5, width: 19, height: 14 },
  ]);
  expect(operations.filter((operation) => operation.kind === "rasterize")).toHaveLength(1);
  expect(operations.some((operation) => operation.kind === "opacity")).toBe(false);
});

test("bounded motion blur emits a fixed sample recipe and bypasses identity settings", () => {
  const value = structuredClone(document);
  value.processing[0]!.steps.push({
    id: "animated-geometry",
    enabled: true,
    processor: {
      type: "geometry",
      scale: {
        x: {
          keys: [
            { at: { numerator: 0, denominator: 1 }, value: 1, interpolation: "linear" },
            { at: { numerator: 1, denominator: 1 }, value: 1.5, interpolation: "linear" },
          ],
        },
        y: {
          keys: [
            { at: { numerator: 0, denominator: 1 }, value: 1, interpolation: "linear" },
            { at: { numerator: 1, denominator: 1 }, value: 1.5, interpolation: "linear" },
          ],
        },
      },
    },
  });
  value.processing[0]!.steps.push({
    id: "blur",
    enabled: true,
    processor: { type: "motion-blur", samples: 4, shutter: 0.5 },
  });
  const frame = createCompiler(validateComposition(value, assets), "blur")
    .frames({ startUs: 0, endUs: 1 })
    .next().value!;
  expect(
    frame.visual[0]!.operations.find((operation: any) => operation.kind === "motion-blur"),
  ).toEqual({
    kind: "motion-blur",
    samples: 4,
    shutter: 0.5,
  });
  const bypass = structuredClone(document);
  bypass.processing[0]!.steps.push({
    id: "blur",
    enabled: true,
    processor: { type: "motion-blur", samples: 1, shutter: 0 },
  });
  const bypassFrame = createCompiler(validateComposition(bypass, assets), "blur-bypass")
    .frames({ startUs: 0, endUs: 1 })
    .next().value!;
  expect(
    bypassFrame.visual[0]!.operations.some((operation: any) => operation.kind === "motion-blur"),
  ).toBe(false);
});
