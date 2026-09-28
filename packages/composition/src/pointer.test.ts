import { expect, test } from "vitest";
import {
  applyBatch,
  createCompiler,
  validateComposition,
  processingCapabilities,
  compiledFrameSchema,
} from "./index.js";
const bounds = { startUs: 0, endUs: 2_000_000 };
const assets = [
  {
    id: "source",
    streams: [{ id: "v", kind: "video", width: 100, height: 80, bounds, available: [bounds] }],
  },
];
const acquisitions = [
  { id: "capture", bindings: [{ assetId: "source", streamId: "v", available: [bounds] }] },
];
const env = { namespace: "pointer", assets, acquisitions };
const document = {
  canvas: {
    width: 100,
    height: 80,
    fps: { numerator: 10, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "video", kind: "video", order: 0 }],
  groups: [],
  clips: [
    {
      id: "clip",
      trackId: "video",
      assetId: "source",
      streamId: "v",
      acquisitionId: "capture",
      source: { kind: "range", range: bounds },
      placement: { kind: "project", range: bounds },
    },
  ],
  syncGroups: [],
  processing: [],
  captions: [],
};
const pointer = { type: "pointer", trailUs: 2_000_000 };
const set = (steps: unknown[]) =>
  applyBatch(
    document,
    [{ operation: "processing.set", target: { kind: "clip", id: "clip" }, steps }],
    env,
  );
const frame = (input: unknown, atUs = 0) =>
  [
    ...createCompiler(validateComposition(input, assets, acquisitions), "pointer").frames({
      startUs: atUs,
      endUs: atUs + 1,
    }),
  ][0]!;
test("source pointer inserts at its ordered position without claiming execution", () => {
  const edited = set([{ label: "pointer", processor: pointer }]);
  expect(frame(edited.document).visual[0]!.operations[0]).toEqual({
    kind: "pointer",
    stepId: edited.labels.pointer,
    trailUs: 2_000_000,
    geometryPrefix: [],
  });
  expect(frame(set([{ enabled: false, processor: pointer }]).document).visual).toEqual(
    frame(document).visual,
  );
  expect(processingCapabilities().find((c) => c.type === "pointer")).toMatchObject({
    mediaKind: "video",
    targets: ["clip"],
    requiresAcquisition: true,
    execution: false,
    implementationId: null,
  });
});

test("pointer geometry prefixes retain order and raster boundaries while excluding earlier paint", () => {
  const edited = set([
    { processor: { type: "opacity", opacity: 0.25 } },
    { label: "first", processor: pointer },
    { processor: { type: "geometry", crop: { x: 5, y: 10, width: 40, height: 30 } } },
    { processor: { type: "opacity", opacity: 0.5 } },
    { label: "middle", processor: { ...pointer, trailUs: 0 } },
    { processor: { type: "geometry", rotationDeg: 90 } },
    { label: "last", processor: pointer },
    { processor: { type: "opacity", opacity: 0.75 } },
  ]);
  const value = frame(edited.document),
    operations = value.visual[0]!.operations;
  expect(operations.filter((p) => p.kind === "pointer")).toEqual([
    { kind: "pointer", stepId: edited.labels.first, trailUs: 2_000_000, geometryPrefix: [] },
    { kind: "pointer", stepId: edited.labels.middle, trailUs: 0, geometryPrefix: [2, 3, 4, 5] },
    {
      kind: "pointer",
      stepId: edited.labels.last,
      trailUs: 2_000_000,
      geometryPrefix: [2, 3, 4, 5, 8, 9, 10, 11, 12],
    },
  ]);
  expect(operations[8]).toEqual({ kind: "rasterize", width: 100, height: 80 });
  expect(operations.at(-1)).toEqual({ kind: "opacity", opacity: 0.75 });
  expect(compiledFrameSchema.parse(value)).toEqual(value);
  const clean = {
    ...edited.document,
    processing: edited.document.processing.map((stack) => ({
      ...stack,
      steps: stack.steps.filter((s) => s.processor.type !== "pointer"),
    })),
  };
  expect(operations.filter((p) => p.kind !== "pointer")).toEqual(
    frame(clean).visual[0]!.operations,
  );
  for (const prefix of [
    [2, 3, 4, 5, 8, 9, 10, 11, 14],
    [2, 3, 4, 5, 8, 9, 10, 11, 7],
    [2, 3, 4, 5, 8, 9, 10, 11],
    [2, 3, 4, 5, 8, 9, 10, 12, 11],
    [2, 3, 4, 5, 8, 9, 10, 11, 11],
  ]) {
    const invalid = structuredClone(value);
    const operation = invalid.visual[0]!.operations[13]!;
    if (operation.kind !== "pointer") throw new Error("Missing pointer fixture");
    operation.geometryPrefix = prefix;
    expect(() => compiledFrameSchema.parse(invalid)).toThrow(/complete preceding geometry/);
  }
  const compiler = createCompiler(
    validateComposition(edited.document, assets, acquisitions),
    "taps",
  );
  const tap = (point: unknown) =>
    compiler.videoWindow({
      range: { startUs: 0, endUs: 1 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "clip", id: "clip" }, point },
    });
  const after = tap({ kind: "after-step", stepId: edited.labels.middle });
  expect([...after.frames()][0]!.visual[0]!.operations).toEqual(operations.slice(0, 8));
  expect(
    after.manifest.requirements.filter((r) => r.kind === "processor").map((r) => r.processor.type),
  ).toContain("pointer");
  expect(
    [...tap({ kind: "dry" }).frames()][0]!.visual[0]!.operations.some((p) => p.kind === "pointer"),
  ).toBe(false);
});

test("scope and acquisition incompatibility rejects even disabled pointer edits atomically", () => {
  const input = { ...document, groups: [{ id: "group", kind: "video", order: 1 }] };
  const original = structuredClone(input);
  for (const target of [
    { kind: "track", id: "video" },
    { kind: "group", id: "group" },
    { kind: "output" },
  ])
    for (const enabled of [true, false])
      expect(() =>
        applyBatch(
          input,
          [
            { operation: "canvas.set", canvas: { width: 120 } },
            { operation: "processing.set", target, steps: [{ enabled, processor: pointer }] },
          ],
          env,
        ),
      ).toThrow(/target scope/);
  expect(input).toEqual(original);
  const bare = {
    ...document,
    clips: document.clips.map((clip) => ({ ...clip, acquisitionId: undefined })),
  };
  for (const enabled of [true, false])
    expect(() =>
      applyBatch(
        bare,
        [
          { operation: "canvas.set", canvas: { width: 120 } },
          {
            operation: "processing.set",
            target: { kind: "clip", id: "clip" },
            steps: [{ enabled, processor: pointer }],
          },
        ],
        env,
      ),
    ).toThrow(/explicit clip acquisition/);
  expect(bare.canvas.width).toBe(100);
  for (const trailUs of [-1, 0.5, 10_000_001, undefined])
    expect(() => set([{ processor: { type: "pointer", trailUs } }])).toThrow();
  expect(
    set([{ processor: { type: "pointer", trailUs: 10_000_000 } }]).document.processing[0]!.steps[0]!
      .processor,
  ).toEqual({ type: "pointer", trailUs: 10_000_000 });
});

test("replacement preserves pointer settings only with explicit replacement acquisition", () => {
  for (const enabled of [true, false]) {
    const edited = set([{ enabled, processor: pointer }]);
    const original = structuredClone(edited.document);
    const replace = {
      operation: "replace",
      clipId: "clip",
      kind: "video",
      media: { assetId: "source", streamId: "v", source: { kind: "range", range: bounds } },
      fit: "exact",
    };
    expect(() =>
      applyBatch(
        edited.document,
        [{ operation: "canvas.set", canvas: { width: 120 } }, replace],
        env,
      ),
    ).toThrow(/explicit clip acquisition/);
    expect(edited.document).toEqual(original);
    const reset = applyBatch(edited.document, [{ ...replace, processing: "reset" }], env);
    expect(reset.document.processing).toEqual([]);
    expect(reset.document.clips[0]).not.toHaveProperty("acquisitionId");
    const preserved = applyBatch(
      edited.document,
      [{ ...replace, media: { ...replace.media, acquisitionId: "capture" } }],
      env,
    );
    expect(preserved.document.processing).toEqual(edited.document.processing);
  }
});

test("split trim move and duplicate preserve immutable source authority and trail settings", () => {
  const edited = set([{ label: "pointer", processor: pointer }]);
  for (const operations of [
    [{ operation: "split", clipIds: ["clip"], atUs: 500_000 }],
    [
      {
        operation: "trim",
        clipId: "clip",
        range: { startUs: 500_000, endUs: 1_500_000 },
        ripple: "none",
      },
    ],
    [{ operation: "move", clipIds: ["clip"], atUs: 3_000_000, ripple: "none" }],
    [{ operation: "duplicate", clipIds: ["clip"], atUs: 3_000_000 }],
  ]) {
    const result = applyBatch(edited.document, operations, { ...env, namespace: "edit" });
    for (const clip of result.document.clips) {
      expect(clip).toMatchObject({ assetId: "source", streamId: "v", acquisitionId: "capture" });
      const stack = result.document.processing.find(
        (s) => s.target.kind === "clip" && s.target.id === clip.id,
      )!;
      expect(stack.steps[0]!.processor).toEqual(pointer);
      const start = clip.placement.kind === "project" ? clip.placement.range.startUs : 0;
      if (typeof start !== "number") throw new Error("Expected integer fixture placement");
      const compiled = frame(result.document, start);
      const node = compiled.visual.find(
        (n) => n.target.kind === "clip" && n.target.id === clip.id,
      )!;
      expect(node.operations[0]).toEqual({
        kind: "pointer",
        stepId: stack.steps[0]!.id,
        trailUs: 2_000_000,
        geometryPrefix: [],
      });
    }
  }
});
