import assert from "node:assert/strict";
import { compositionAsset, mediaProbeSchema } from "../../core/dist/assets.js";
import {
  applyBatch,
  createCompiler,
  validateComposition,
  requireWindowReady,
  executionWindowManifestSchema,
  compiledFrameSchema,
  compiledAudioSchema,
} from "../../composition/dist/index.js";

if (process.argv.slice(2).join(" ") !== "--fixture phase-offset")
  throw new Error("Usage: compiler.mjs --fixture phase-offset");
const document = {
  canvas: {
    width: 640,
    height: 480,
    fps: { numerator: 30000, denominator: 1001 },
    background: "#000000ff",
  },
  tracks: [
    { id: "video", kind: "video", order: 0 },
    { id: "audio", kind: "audio", order: 0, parentId: "voice" },
  ],
  groups: [{ id: "voice", kind: "audio", order: 1 }],
  clips: ["video", "audio"].map((kind) => ({
    id: kind,
    trackId: kind,
    assetId: "source",
    streamId: kind,
    source: { kind: "range", range: { startUs: 500000, endUs: 1500000 } },
    placement: { kind: "project", range: { startUs: 0, endUs: 700000 } },
  })),
  processing: [
    {
      target: { kind: "group", id: "voice" },
      steps: [{ id: "level", enabled: true, processor: { type: "gain", gain: 0.5 } }],
    },
  ],
  syncGroups: [],
};
const assets = [
  {
    id: "source",
    streams: ["video", "audio"].map((kind) => ({
      id: kind,
      kind,
      ...(kind === "video" ? { width: 640, height: 480 } : {}),
      bounds: { startUs: 0, endUs: 2000000 },
      available: [{ startUs: 0, endUs: 2000000 }],
    })),
  },
];
const model = validateComposition(document, assets);
const compiler = createCompiler(model, "revision");
const full = [...compiler.frames({ startUs: 0, endUs: 700000 })];
let comparisons = 0;
for (const startUs of [0, 1, 33366, 33367, 100001, 401234]) {
  const range = { startUs, endUs: Math.min(700000, startUs + 199999) };
  const short = [...compiler.frames(range)];
  assert.deepEqual(
    short,
    full
      .filter(
        (frame) =>
          frame.visibleRange.endUs > range.startUs && frame.visibleRange.startUs < range.endUs,
      )
      .map((frame) => ({
        ...frame,
        visibleRange: {
          startUs: Math.max(range.startUs, frame.visibleRange.startUs),
          endUs: Math.min(range.endUs, frame.visibleRange.endUs),
        },
      })),
  );
  for (const frame of short) {
    const time = Number((BigInt(frame.index) * 1001000000n) / 30000n);
    assert.equal(frame.sampleAtUs, time);
    assert.equal(frame.layers[0].sourceUs, 500000 + Math.floor((time * 10) / 7));
    comparisons++;
  }
}
const split = applyBatch(
  document,
  [{ operation: "split", clipIds: ["video", "audio"], atUs: 123457, scope: "selected" }],
  { assets, namespace: "compiler-probe" },
);
const after = createCompiler(validateComposition(split.document, assets), "split-revision");
assert.deepEqual(
  [...after.frames({ startUs: 0, endUs: 700000 })].map((frame) => [
    frame.sampleAtUs,
    frame.layers[0].sourceUs,
  ]),
  full.map((frame) => [frame.sampleAtUs, frame.layers[0].sourceUs]),
);
const originalAudioContext = [{ startUs: 500000, endUs: 1500000 }];
assert.deepEqual(
  [...after.audio({ startUs: 0, endUs: 700000 })].map((segment) =>
    segment.context.map((part) => part.source),
  ),
  [originalAudioContext, originalAudioContext],
);
assert.deepEqual(
  [...after.audio({ startUs: 600001, endUs: 650001 })][0].context.map((part) => part.source),
  originalAudioContext,
);
const removed = applyBatch(
  document,
  [
    {
      operation: "remove",
      clipIds: ["audio"],
      ranges: [{ startUs: 140000, endUs: 210000 }],
      scope: "selected",
      ripple: "none",
    },
  ],
  { assets, namespace: "remove-context" },
);
assert.deepEqual(
  [
    ...createCompiler(validateComposition(removed.document, assets), "removed").audio({
      startUs: 0,
      endUs: 700000,
    }),
  ].map((segment) => segment.context.map((part) => part.source)),
  [[{ startUs: 500000, endUs: 700000 }], [{ startUs: 800000, endUs: 1500000 }]],
);
for (const sampleRate of [44100, 48000]) {
  const segments = [...after.audio({ startUs: 50001, endUs: 650009 }, sampleRate)];
  assert.equal(segments[0].sampleRange.start, Math.floor((50001 * sampleRate) / 1000000));
  assert.equal(segments.at(-1).sampleRange.end, Math.floor((650009 * sampleRate) / 1000000));
  assert.equal(segments[0].sampleRange.end, segments[1].sampleRange.start);
  assert.deepEqual(
    segments.map((part) => part.context[0].sampleRange),
    [
      { start: 0, end: sampleRate === 48000 ? 33600 : 30870 },
      { start: 0, end: sampleRate === 48000 ? 33600 : 30870 },
    ],
  );
}
assert.deepEqual(compiler.processing({ startUs: 1, endUs: 2 }).at(-1).inputs, [
  { kind: "track", id: "video" },
]);
assert.deepEqual(compiler.processing({ startUs: 1, endUs: 30 }).at(-1).inputs, [
  { kind: "track", id: "video" },
  { kind: "group", id: "voice" },
]);
const request = {
  range: { startUs: 100001, endUs: 400009 },
  rendition: { sampleRate: 48000, channels: 2 },
  tap: { target: { kind: "group", id: "voice" }, point: { kind: "dry" } },
};
const dry = compiler.window(request);
assert.deepEqual(
  dry.manifest.processing.flatMap((node) => node.steps),
  [],
);
assert.deepEqual([...dry.frames()], []);
assert.equal(dry.manifest.requirements.find((item) => item.kind === "retime").sampleCount, 33600);
assert.deepEqual(
  dry.manifest.sources.map((item) => [item.assetId, item.streamId]),
  [["source", "audio"]],
);
const wet = compiler.window({
  ...request,
  tap: { ...request.tap, point: { kind: "after-step", stepId: "level" } },
});
assert.deepEqual(
  wet.manifest.processing.at(-1).steps.map((step) => step.id),
  ["level"],
);
assert.deepEqual([...wet.audio()], [...dry.audio()]);
assert.throws(
  () => requireWindowReady(wet.manifest),
  (error) => error.code === "NOT_READY",
);
assert.deepEqual(
  executionWindowManifestSchema.parse(JSON.parse(JSON.stringify(wet.manifest))),
  wet.manifest,
);
for (const frame of full)
  assert.deepEqual(compiledFrameSchema.parse(JSON.parse(JSON.stringify(frame))), frame);
for (const segment of after.audio({ startUs: 50001, endUs: 650009 }))
  assert.deepEqual(compiledAudioSchema.parse(JSON.parse(JSON.stringify(segment))), segment);

// The real admission-to-composition projection carries presentation time, not source sample indices.
const probed = [44100, 48000].map((sampleRate, index) => ({
  id: index === 0 ? "a" : "b",
  bytes: 1,
  createdAt: "2026-09-27T00:00:00Z",
  fileName: `fixture-${index}.mov`,
  ...mediaProbeSchema.parse({
    originUs: 0,
    streams: ["video", "audio"].map((kind) => ({
      id: kind,
      kind,
      codec: kind === "video" ? "h264" : "pcm",
      decodable: true,
      startUs: 0,
      endUs: 2000000,
      segments: [{ startUs: 0, endUs: 2000000, empty: false }],
      ...(kind === "audio"
        ? { sampleRate, channels: 1 }
        : { orientedWidth: 640, orientedHeight: 480 }),
    })),
  }),
}));
const admitted = probed.map(compositionAsset);
const ordered = {
  canvas: { ...document.canvas, fps: { numerator: 10, denominator: 1 } },
  tracks: [
    { id: "v", kind: "video", order: 0 },
    { id: "a", kind: "audio", order: 0, parentId: "inner" },
  ],
  groups: [
    { id: "inner", kind: "audio", order: 0, parentId: "outer" },
    { id: "outer", kind: "audio", order: 1 },
  ],
  clips: [
    ["vb", "v", "b", "video", 0, 200000, 1000000],
    ["va", "v", "a", "video", 200000, 400000, 500000],
    ["aa", "a", "a", "audio", 0, 100000, 500000],
    ["ab", "a", "b", "audio", 100000, 400000, 1000000],
  ].map(([id, trackId, assetId, streamId, startUs, endUs, sourceStart]) => ({
    id,
    trackId,
    assetId,
    streamId,
    source: {
      kind: "range",
      range: { startUs: sourceStart, endUs: sourceStart + endUs - startUs },
    },
    placement: { kind: "project", range: { startUs, endUs } },
  })),
  processing: [
    {
      target: { kind: "group", id: "inner" },
      steps: [{ id: "group-gain", enabled: true, processor: { type: "gain", gain: 0.5 } }],
    },
  ],
  syncGroups: [],
};
const reordered = createCompiler(validateComposition(ordered, admitted), "reordered-av");
const total = reordered.window({
  range: { startUs: 0, endUs: 400000 },
  rendition: request.rendition,
  tap: { target: { kind: "output" }, point: { kind: "processed" } },
});
assert.deepEqual(
  [...total.frames()].map((frame) => [
    frame.sampleAtUs,
    frame.layers[0].assetId,
    frame.layers[0].sourceUs,
  ]),
  [
    [0, "b", 1000000],
    [100000, "b", 1100000],
    [200000, "a", 500000],
    [300000, "a", 600000],
  ],
);
assert.deepEqual(
  [...total.audio()].map((segment) => [segment.source.assetId, segment.sampleRange]),
  [
    ["a", { start: 0, end: 4800 }],
    ["b", { start: 4800, end: 19200 }],
  ],
);
const bounded = reordered.window({
  range: { startUs: 150001, endUs: 250001 },
  rendition: request.rendition,
  tap: { target: { kind: "output" }, point: { kind: "processed" } },
});
assert.deepEqual(
  [...bounded.frames()].map((frame) => [
    frame.sampleAtUs,
    frame.visibleRange,
    frame.layers[0].assetId,
  ]),
  [
    [100000, { startUs: 150001, endUs: 200000 }, "b"],
    [200000, { startUs: 200000, endUs: 250001 }, "a"],
  ],
);
assert.deepEqual(
  [...bounded.audio()].map((segment) => [segment.source.assetId, segment.sampleRange]),
  [["b", { start: 7200, end: 12000 }]],
);
const retained = (target) => !(target.kind === "clip" && target.id === "aa");
assert.deepEqual(
  bounded.manifest.processing,
  total.manifest.processing
    .filter((node) => retained(node.target))
    .map((node) => ({ ...node, inputs: node.inputs.filter(retained) })),
);
for (const frame of bounded.frames()) compiledFrameSchema.parse(JSON.parse(JSON.stringify(frame)));
for (const segment of bounded.audio())
  compiledAudioSchema.parse(JSON.parse(JSON.stringify(segment)));
assert.deepEqual(
  probed.map((asset) =>
    compositionAsset({
      ...asset,
      streams: asset.streams.map((stream) =>
        stream.kind === "audio" ? { ...stream, sampleRate: 96000 } : stream,
      ),
    }),
  ),
  admitted,
);
const anchored = structuredClone(ordered);
anchored.tracks.push({ id: "attached", kind: "video", order: 2 });
anchored.clips.push({
  id: "child",
  trackId: "attached",
  assetId: "b",
  streamId: "video",
  source: { kind: "range", range: { startUs: 1000000, endUs: 1200000 } },
  placement: { kind: "content", clipId: "vb", sourceRange: { startUs: 1000000, endUs: 1200000 } },
});
const gapped = structuredClone(admitted);
gapped[1].streams.find((stream) => stream.kind === "video").available = [
  { startUs: 0, endUs: 1100000 },
  { startUs: 1200000, endUs: 2000000 },
];
const provenance = createCompiler(validateComposition(anchored, gapped), "availability-provenance");
const observed = [...provenance.frames({ startUs: 100001, endUs: 199999 })];
assert.deepEqual(
  observed[0].layers.map((layer) => [layer.clipId, layer.availability]),
  [
    ["vb", "source-unavailable"],
    ["child", "anchor-unavailable"],
  ],
);
compiledFrameSchema.parse(JSON.parse(JSON.stringify(observed[0])));
console.log(
  JSON.stringify(
    {
      fixture: "phase-offset",
      scope: "pure composition schedules; no service or native execution",
      comparisons,
      splitPreserved: true,
      outputSampleRates: [44100, 48000],
      nestedProcessing: true,
      targetTaps: true,
      strictManifest: true,
      strictStreamRecords: true,
      leadingPicturePreserved: true,
      availabilityProvenance: true,
      retainedResamplingContext: true,
      independentReorderedAV: true,
      nestedWindowRestriction: true,
      sourceRateMetadata: [44100, 48000],
      resampling: "not executed; slice 08",
      nativeReadiness: "unresolved; NOT_READY",
    },
    null,
    2,
  ),
);
