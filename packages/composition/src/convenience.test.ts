import { expect, test } from "vitest";
import { applyBatch, createCompiler, validateComposition } from "./index.js";
import { sampleScalarSamples } from "./scalar-program.js";

const empty = {
  canvas: { width: 64, height: 48, fps: { numerator: 8, denominator: 1 }, background: "#000000ff" },
  tracks: [],
  groups: [],
  clips: [],
  syncGroups: [],
  processing: [],
};
const context = { assets: [], namespace: "macro" };

test("fade appends an inspectable gain transition and preserves the existing stack", () => {
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      {
        operation: "place",
        clip: {
          trackId: { label: "audio" },
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
        label: "clip",
      },
      {
        operation: "processing.set",
        target: { kind: "clip", id: { label: "clip" } },
        steps: [{ label: "prior", processor: { type: "gain", gain: 0.5 } }],
      },
      {
        operation: "fade",
        target: { kind: "clip", id: { label: "clip" } },
        mediaKind: "audio",
        from: 0,
        to: 1,
        window: {
          kind: "clip",
          clipId: { label: "clip" },
          start: { numerator: 1, denominator: 4 },
          end: { numerator: 3, denominator: 4 },
        },
        label: "fade",
      },
    ],
    context,
  );
  const steps = result.document.processing[0]!.steps;
  expect(steps[0]).toEqual({
    id: result.labels.prior,
    enabled: true,
    processor: { type: "gain", gain: 0.5 },
  });
  expect(steps[1]).toEqual({
    id: result.labels.fade,
    enabled: true,
    window: {
      kind: "clip",
      clipId: result.labels.clip,
      start: { numerator: 1, denominator: 4 },
      end: { numerator: 3, denominator: 4 },
    },
    processor: {
      type: "gain",
      gain: {
        keys: [
          { at: { numerator: 1, denominator: 4 }, value: 0, interpolation: "linear" },
          { at: { numerator: 3, denominator: 4 }, value: 1, interpolation: "hold" },
        ],
      },
    },
  });
  expect(result.normalized[3]!.changes).toEqual([
    { kind: "processing", target: { kind: "clip", id: result.labels.clip }, steps },
  ]);
  const compiler = createCompiler(validateComposition(result.document, []), "r");
  const gain = compiler
    .window({
      range: { startUs: 0, endUs: 1000000 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    })
    .processing()[0]!.steps[1]!.processor;
  if (gain.type !== "gain" || typeof gain.gain === "number") throw Error("Expected gain program");
  expect(gain.active).toEqual([{ start: 12000, end: 36000 }]);
  expect(sampleScalarSamples(gain.gain, 24000)).toBe(0.5);
});

test("zoom retains explicit geometry and expands to the same ordinary picture trajectory", () => {
  const assets = [{ id: "image", streams: [{ id: "s", kind: "image", width: 80, height: 60 }] }];
  const ctx = { assets, namespace: "zoom" };
  const first = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "video" },
      {
        operation: "place",
        clip: {
          assetId: "image",
          streamId: "s",
          trackId: { label: "video" },
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
        label: "image",
      },
    ],
    ctx,
  );
  const target = { kind: "clip", id: first.labels.image };
  const window = {
    kind: "content",
    clipId: first.labels.image,
    sourceRange: { startUs: 0, endUs: 1000000 },
  };
  expect(() =>
    applyBatch(first.document, [{ operation: "zoom", target, from: 1, to: 2, window }], ctx),
  ).toThrow();
  const anchor = {
    kind: "clip",
    clipId: first.labels.image,
    start: { numerator: 0, denominator: 1 },
    end: { numerator: 1, denominator: 1 },
  };
  const geometry = {
    crop: { x: 10, y: 5, width: 50, height: 40 },
    rect: { x: 3, y: 4, width: 48, height: 32 },
    pivot: { x: 0, y: 1 },
    rotationDeg: 15,
    fit: "cover",
  };
  const macro = applyBatch(
    first.document,
    [{ operation: "zoom", target, from: 0.5, to: 1.5, window: anchor, geometry }],
    ctx,
  ).document;
  for (let i = 0; i < 8; i++) {
    const scale = 0.5 + i / 8;
    const direct = applyBatch(
      first.document,
      [
        {
          operation: "processing.set",
          target,
          steps: [{ processor: { type: "geometry", ...geometry, scale: { x: scale, y: scale } } }],
        },
      ],
      ctx,
    ).document;
    const pictures = (doc: unknown) =>
      [
        ...createCompiler(validateComposition(doc, assets), "r").frames({
          startUs: i * 125000,
          endUs: i * 125000 + 1,
        }),
      ].map((frame) => frame.visual.flatMap((node) => node.operations));
    expect(pictures(macro)).toEqual(pictures(direct));
  }
});

test("invalid conveniences fail the entire batch without replacing earlier steps", () => {
  const first = applyBatch(
    empty,
    [{ operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" }],
    context,
  );
  const target = { kind: "track", id: first.labels.audio };
  const window = { kind: "project", range: { startUs: 0, endUs: 1000000 } };
  const valid = { operation: "fade", target, mediaKind: "audio", from: 0, to: 1, window };
  for (const invalid of [
    { ...valid, mediaKind: "video" },
    { ...valid, from: -1 },
    { ...valid, interpolation: { cubic: [0.3, -8, 0.7, 8] } },
    { ...valid, window: { kind: "project", range: { startUs: 1, endUs: 1 } } },
    {
      ...valid,
      window: {
        kind: "project",
        range: { startUs: { numerator: 1, denominator: 3 }, endUs: 1000000 },
      },
    },
    { operation: "zoom", target, from: 1, to: 2, window },
  ]) {
    expect(() => applyBatch(first.document, [valid, invalid], context)).toThrow();
    expect(first.document.processing).toEqual([]);
  }
});

test("content fade keys stay in source time and output fades explicitly select their medium", () => {
  const assets = [
    {
      id: "source",
      streams: [
        {
          id: "a",
          kind: "audio",
          bounds: { startUs: 0, endUs: 2000000 },
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    },
  ];
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: { label: "audio" },
          assetId: "source",
          streamId: "a",
          source: { kind: "range", range: { startUs: 1000000, endUs: 2000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
      {
        operation: "fade",
        target: { kind: "clip", id: { label: "clip" } },
        mediaKind: "audio",
        from: 1,
        to: 0,
        window: {
          kind: "content",
          clipId: { label: "clip" },
          sourceRange: { startUs: 1000000, endUs: 2000000 },
        },
      },
      {
        operation: "fade",
        target: { kind: "output" },
        mediaKind: "video",
        from: 0,
        to: 1,
        window: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
      },
    ],
    { assets, namespace: "content" },
  );
  const clip = result.document.processing.find((s) => s.target.kind === "clip")!;
  expect(clip.steps[0]!.processor).toEqual({
    type: "gain",
    gain: {
      keys: [
        { at: 1000000, value: 1, interpolation: "linear" },
        { at: 2000000, value: 0, interpolation: "hold" },
      ],
    },
  });
  const output = result.document.processing.find((s) => s.target.kind === "output")!;
  expect(output.steps[0]!.processor.type).toBe("opacity");
});
