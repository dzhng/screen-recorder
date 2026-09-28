import { expect, test } from "vitest";
import {
  createCompiler,
  validateComposition,
  type Composition,
  requireWindowReady,
  executionWindowManifestSchema,
} from "./index.js";

const document: Composition = {
  canvas: {
    width: 640,
    height: 480,
    fps: { numerator: 30000, denominator: 1001 },
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
      assetId: "asset",
      streamId: "video",
      source: { kind: "range", range: { startUs: 500000, endUs: 1500000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    },
  ],
};
const assets = [
  {
    id: "asset",
    streams: [
      {
        id: "video",
        kind: "video",
        bounds: { startUs: 0, endUs: 2000000 },
        available: [{ startUs: 0, endUs: 2000000 }],
      },
    ],
  },
];

test("range frames preserve the full project phase and source clock", () => {
  const compiler = createCompiler(validateComposition(document, assets), "revision");
  const full = [...compiler.frames({ startUs: 0, endUs: 1000000 })];
  const part = [...compiler.frames({ startUs: 50001, endUs: 180000 })];
  expect(part).toEqual(full.filter((frame) => frame.atUs >= 50001 && frame.atUs < 180000));
  expect(part.map((frame) => [frame.index, frame.atUs, frame.layers[0]?.sourceUs])).toEqual([
    [2, 66733, 566733],
    [3, 100100, 600100],
    [4, 133466, 633466],
    [5, 166833, 666833],
  ]);
});

test("audio windows clip absolute sample bounds without restarting source mapping", () => {
  const input = structuredClone(document);
  input.tracks = [{ id: "a", kind: "audio", order: 0 }];
  input.clips = [
    {
      id: "voice",
      trackId: "a",
      assetId: "asset",
      streamId: "audio",
      source: { kind: "range", range: { startUs: 500000, endUs: 1500000 } },
      placement: { kind: "project", range: { startUs: 10001, endUs: 1010001 } },
    },
  ];
  const audioAssets = [
    {
      id: "asset",
      streams: [
        {
          id: "audio",
          kind: "audio",
          bounds: { startUs: 0, endUs: 2000000 },
          available: [
            { startUs: 0, endUs: 600000 },
            { startUs: 700000, endUs: 2000000 },
          ],
        },
      ],
    },
  ];
  const compiler = createCompiler(validateComposition(input, audioAssets), "revision");
  expect([...compiler.audio({ startUs: 0, endUs: 1100000 }, 48000)]).toEqual([
    {
      clipId: "voice",
      trackId: "a",
      sampleRange: { start: 480, end: 48480 },
      placement: { startUs: 10001, endUs: 1010001 },
      source: {
        kind: "range",
        assetId: "asset",
        streamId: "audio",
        range: { startUs: 500000, endUs: 1500000 },
      },
      pitch: "preserve",
      available: [
        { start: 480, end: 5280 },
        { start: 10080, end: 48480 },
      ],
    },
  ]);
  const short = [...compiler.audio({ startUs: 200001, endUs: 300001 }, 48000)][0]!;
  expect(short.sampleRange).toEqual({ start: 9600, end: 14400 });
  expect(short.placement).toEqual({ startUs: 10001, endUs: 1010001 });
  expect(short.available).toEqual([{ start: 10080, end: 14400 }]);
});

test("processing instructions apply ordered steps after each combined child result", () => {
  const input = structuredClone(document);
  input.tracks = [
    { id: "a", kind: "audio", order: 0, parentId: "inner" },
    { id: "music", kind: "audio", order: 1 },
  ];
  input.groups = [
    { id: "inner", kind: "audio", order: 0, parentId: "outer" },
    { id: "outer", kind: "audio", order: 0 },
  ];
  input.clips = [
    {
      id: "silence",
      trackId: "a",
      source: { kind: "silence" },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    },
  ];
  const gain = (id: string, multiplier: number, enabled = true) => ({
    id,
    enabled,
    processor: { type: "gain" as const, gain: multiplier },
  });
  input.processing = [
    { target: { kind: "group", id: "inner" }, steps: [gain("one", 2), gain("two", 3, false)] },
    { target: { kind: "output" }, steps: [gain("out", 0.5)] },
  ];
  const compiler = createCompiler(validateComposition(input, []), "revision");
  expect(
    compiler
      .processing({ startUs: 0, endUs: 1000000 })
      .map((node) => [node.target, node.inputs, node.steps.map((step) => [step.id, step.enabled])]),
  ).toEqual([
    [{ kind: "clip", id: "silence" }, [], []],
    [{ kind: "track", id: "a" }, [{ kind: "clip", id: "silence" }], []],
    [
      { kind: "group", id: "inner" },
      [{ kind: "track", id: "a" }],
      [
        ["one", true],
        ["two", false],
      ],
    ],
    [{ kind: "group", id: "outer" }, [{ kind: "group", id: "inner" }], []],
    [{ kind: "output" }, [{ kind: "group", id: "outer" }], [["out", true]]],
  ]);
});

test("frame membership respects gaps, holds, nested ordering and half-open cuts", () => {
  const input = structuredClone(document);
  input.canvas.fps = { numerator: 10, denominator: 1 };
  input.groups = [{ id: "top", kind: "video", order: 1 }];
  input.tracks.push({ id: "overlay", kind: "video", order: -10, parentId: "top" });
  input.clips.push({
    id: "held",
    trackId: "overlay",
    assetId: "asset",
    streamId: "video",
    source: { kind: "hold", atUs: 700000 },
    placement: { kind: "project", range: { startUs: 100000, endUs: 200000 } },
  });
  const media = structuredClone(assets);
  media[0]!.streams[0]!.available = [
    { startUs: 0, endUs: 600000 },
    { startUs: 700000, endUs: 2000000 },
  ];
  const compiler = createCompiler(validateComposition(input, media), "revision");
  expect(
    [...compiler.frames({ startUs: 100000, endUs: 300000 })].map((frame) =>
      frame.layers.map((layer) => [layer.clipId, layer.sourceUs, layer.available]),
    ),
  ).toEqual([
    [
      ["c", 600000, false],
      ["held", 700000, true],
    ],
    [["c", 700000, true]],
  ]);
  expect(compiler.processing({ startUs: 100000, endUs: 200000 }).at(-1)?.inputs).toEqual([
    { kind: "track", id: "v" },
    { kind: "group", id: "top" },
  ]);
});

test("two-hour requests are lazy and late repeated clips do not replay earlier frames", () => {
  const input = structuredClone(document);
  input.clips = Array.from({ length: 10000 }, (_, index) => ({
    ...document.clips[0]!,
    id: `repeat-${index}`,
    placement: {
      kind: "project",
      range: { startUs: index * 1000000, endUs: (index + 1) * 1000000 },
    },
  }));
  const compiler = createCompiler(validateComposition(input, assets), "revision");
  const full = compiler.frames({ startUs: 0, endUs: 7200000000 });
  expect(full.next().value?.index).toBe(0);
  full.return(undefined);
  const late = [...compiler.frames({ startUs: 7199990000, endUs: 7200010000 })];
  expect(
    late.map((frame) => [
      frame.index,
      frame.atUs,
      frame.layers[0]?.clipId,
      frame.layers[0]?.sourceUs,
    ]),
  ).toEqual([[215784, 7199992800, "repeat-7199", 1492800]]);
  expect(
    compiler.processing({ startUs: 7199500000, endUs: 7199600000 }).map((node) => node.target),
  ).toEqual([{ kind: "clip", id: "repeat-7199" }, { kind: "track", id: "v" }, { kind: "output" }]);
});

test("returned plan mutation cannot change a later plan for the same revision", () => {
  const compiler = createCompiler(validateComposition(document, assets), "revision");
  const plan = compiler.processing({ startUs: 0, endUs: 1 });
  Reflect.set(plan[0]!.steps, "0", {
    id: "injected",
    enabled: true,
    processor: { type: "gain", gain: 0 },
  });
  expect(compiler.processing({ startUs: 0, endUs: 1 })[0]!.steps).toEqual([]);
});

test("a frame outside a valid empty window needs no serializable timestamp", () => {
  const input = structuredClone(document);
  input.canvas.fps = { numerator: 1, denominator: Number.MAX_SAFE_INTEGER };
  const compiler = createCompiler(validateComposition(input, assets), "revision");
  expect([...compiler.frames({ startUs: 1, endUs: 2 })]).toEqual([]);
});

test("target taps exclude parents and later steps while preserving child processing", () => {
  const input = structuredClone(document);
  input.tracks = [{ id: "audio", kind: "audio", order: 0, parentId: "group" }];
  input.groups = [{ id: "group", kind: "audio", order: 0 }];
  input.clips = [
    {
      id: "quiet",
      trackId: "audio",
      source: { kind: "silence" },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    },
  ];
  const gain = (id: string, gain: number) => ({
    id,
    enabled: true,
    processor: { type: "gain" as const, gain },
  });
  input.processing = [
    { target: { kind: "track", id: "audio" }, steps: [gain("child", 2)] },
    { target: { kind: "group", id: "group" }, steps: [gain("first", 3), gain("second", 4)] },
    { target: { kind: "output" }, steps: [gain("parent", 5)] },
  ];
  const compiler = createCompiler(validateComposition(input, []), "revision");
  const request = {
    range: { startUs: 100001, endUs: 300009 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "group", id: "group" }, point: { kind: "after-step", stepId: "first" } },
  };
  const window = compiler.window(request);
  expect(
    window.manifest.processing.map((node) => [node.target, node.steps.map((step) => step.id)]),
  ).toEqual([
    [{ kind: "clip", id: "quiet" }, []],
    [{ kind: "track", id: "audio" }, ["child"]],
    [{ kind: "group", id: "group" }, ["first"]],
  ]);
  expect([...window.frames()]).toEqual([]);
  expect([...window.audio()].map((segment) => segment.sampleRange)).toEqual([
    { start: 4800, end: 14400 },
  ]);
  const dry = compiler.window({
    ...request,
    tap: { target: request.tap.target, point: { kind: "dry" } },
  });
  expect(dry.manifest.processing.flatMap((node) => node.steps.map((step) => step.id))).toEqual([
    "child",
  ]);
});

test("window identity pins source mapping, rendition and unresolved retiming across short previews", () => {
  const input = structuredClone(document);
  input.tracks = [{ id: "a", kind: "audio", order: 0 }];
  input.clips = [
    {
      id: "speech",
      trackId: "a",
      assetId: "source",
      streamId: "audio",
      source: { kind: "range", range: { startUs: 500000, endUs: 1500000 } },
      placement: { kind: "project", range: { startUs: 10001, endUs: 710001 } },
    },
  ];
  const media = [
    {
      id: "source",
      streams: [
        {
          id: "audio",
          kind: "audio",
          bounds: { startUs: 0, endUs: 2000000 },
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    },
  ];
  const model = validateComposition(input, media);
  const compiler = createCompiler(model, "pinned-revision");
  const request = {
    range: { startUs: 200001, endUs: 300001 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "clip", id: "speech" }, point: { kind: "dry" } },
  };
  const first = compiler.window(request);
  expect(first.manifest.revisionId).toBe("pinned-revision");
  expect(first.manifest.sources).toEqual([
    {
      clipId: "speech",
      assetId: "source",
      streamId: "audio",
      source: input.clips[0]!.source,
      placement: { startUs: 10001, endUs: 710001 },
      pitch: "preserve",
    },
  ]);
  expect(first.manifest.requirements).toEqual([
    { kind: "executor", mediaKind: "audio", implementationId: null },
    {
      kind: "retime",
      clipId: "speech",
      sampleCount: 33600,
      pitch: "preserve",
      implementationId: null,
    },
  ]);
  const later = compiler.window({ ...request, range: { startUs: 300001, endUs: 400001 } });
  expect(later.manifest.requirements).toEqual(first.manifest.requirements);
  expect(later.manifest.sources).toEqual(first.manifest.sources);
  expect(later.manifest).not.toEqual(first.manifest);
  expect(
    compiler.window({ tap: request.tap, rendition: request.rendition, range: request.range })
      .manifest,
  ).toEqual(first.manifest);
  expect(createCompiler(model, "other-revision").window(request).manifest).not.toEqual(
    first.manifest,
  );
  expect(() => requireWindowReady(first.manifest)).toThrowError(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  expect(executionWindowManifestSchema.parse(JSON.parse(JSON.stringify(first.manifest)))).toEqual(
    first.manifest,
  );
  request.range.startUs = 0;
  expect([...first.audio()][0]!.sampleRange).toEqual({ start: 9600, end: 14400 });
});

test("a visual target tap excludes siblings from schedules and rejects foreign step identities", () => {
  const input = structuredClone(document);
  input.tracks.push({ id: "other", kind: "video", order: 1 });
  input.clips.push({ ...input.clips[0]!, id: "other-clip", trackId: "other" });
  const compiler = createCompiler(validateComposition(input, assets), "revision");
  const request = {
    range: { startUs: 100001, endUs: 200001 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "track", id: "other" }, point: { kind: "processed" } },
  };
  const window = compiler.window(request);
  expect([...window.frames()].map((frame) => frame.layers.map((layer) => layer.clipId))).toEqual([
    ["other-clip"],
    ["other-clip"],
    ["other-clip"],
  ]);
  expect([...window.audio()]).toEqual([]);
  expect(window.manifest.sources.map((source) => source.clipId)).toEqual(["other-clip"]);
  expect(() =>
    compiler.window({
      ...request,
      tap: { target: request.tap.target, point: { kind: "after-step", stepId: "absent" } },
    }),
  ).toThrow("Unknown step");
  expect(() =>
    compiler.window({
      ...request,
      tap: { target: { kind: "group", id: "absent" }, point: { kind: "dry" } },
    }),
  ).toThrow("Unknown processing tap target");
  expect(() =>
    compiler.window({ ...request, rendition: { sampleRate: 44100, channels: 2 } }),
  ).toThrow();
});

test("a target tap does not read unrelated availability while iterating its schedules", () => {
  const input = structuredClone(document);
  input.tracks = [
    { id: "chosen", kind: "audio", order: 0 },
    { id: "unrelated", kind: "audio", order: 1 },
  ];
  input.clips = ["chosen", "unrelated"].map((id) => ({
    id,
    trackId: id,
    source: { kind: "silence" },
    placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
  }));
  const model = validateComposition(input, []);
  let unrelatedReads = 0;
  // Observe metadata work without a wall-clock threshold or changing its immutable values.
  const measured = Object.freeze({
    ...model,
    clips: Object.freeze(
      model.clips.map((value) =>
        value.clip.id !== "unrelated"
          ? value
          : Object.freeze({
              ...value,
              get available() {
                unrelatedReads++;
                return value.available;
              },
            }),
      ),
    ),
  });
  const compiler = createCompiler(measured, "revision");
  const window = compiler.window({
    range: { startUs: 0, endUs: 1000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "clip", id: "chosen" }, point: { kind: "processed" } },
  });
  unrelatedReads = 0;
  expect([...window.audio()].map((segment) => [segment.clipId, segment.sampleRange])).toEqual([
    ["chosen", { start: 0, end: 48000 }],
  ]);
  expect(unrelatedReads).toBe(0);
});
