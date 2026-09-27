import { expect, test } from "vitest";
import { applyBatch, CompositionError, validateComposition, projectToSource } from "./index.js";
const input = {
  canvas: {
    width: 160,
    height: 96,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [],
  clips: [],
  syncGroups: [],
  effects: [],
  captions: [],
};
const context = {
  namespace: "transaction",
  assets: [
    {
      id: "source",
      streams: [
        {
          id: "v",
          kind: "video",
          bounds: { startUs: 0, endUs: 2000000 },
          available: [{ startUs: 0, endUs: 2000000 }],
        },
        {
          id: "a",
          kind: "audio",
          bounds: { startUs: 200000, endUs: 1800000 },
          available: [{ startUs: 200000, endUs: 1800000 }],
        },
      ],
    },
  ],
};
const setup = [
  { operation: "track.add", track: { kind: "video", order: 0 }, label: "picture" },
  {
    operation: "place",
    label: "video",
    clip: {
      assetId: "source",
      streamId: "v",
      trackId: { label: "picture" },
      source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 2000000 } },
    },
  },
  { operation: "track.add", track: { kind: "audio", order: 0 }, label: "sound" },
  {
    operation: "place",
    label: "audio",
    clip: {
      assetId: "source",
      streamId: "a",
      trackId: { label: "sound" },
      source: { kind: "range", range: { startUs: 200000, endUs: 1800000 } },
      placement: { kind: "project", range: { startUs: 200000, endUs: 1800000 } },
    },
  },
  { operation: "link", clipIds: [{ label: "video" }, { label: "audio" }], label: "av" },
];
test("one pure batch binds deterministic identities and links unequal AV without moving either", () => {
  const before = structuredClone({ input, context, setup });
  const result = applyBatch(input, setup, context);
  expect(applyBatch(input, setup, context)).toEqual(result);
  expect({ input, context, setup }).toEqual(before);
  expect(result.document.syncGroups).toEqual([
    { id: result.labels.av, clipIds: [result.labels.video, result.labels.audio] },
  ]);
  const model = validateComposition(result.document, context.assets);
  expect(projectToSource(model, 100000)).toMatchObject([
    { clipId: result.labels.video, sourceUs: 100000 },
  ]);
  expect(projectToSource(model, 250000)).toMatchObject([
    { clipId: result.labels.video, sourceUs: 250000 },
    { clipId: result.labels.audio, sourceUs: 250000 },
  ]);
  expect(result.createdIds.map((value) => value.kind)).toEqual([
    "track",
    "clip",
    "track",
    "clip",
    "syncGroup",
  ]);
  expect(result.linkChanges).toEqual([
    { kind: "syncGroup", id: result.labels.av, value: result.document.syncGroups[0] },
  ]);
});
test("failure in operation three leaves the caller's document unchanged", () => {
  const original = structuredClone(input);
  const operations = [
    ...setup.slice(0, 2),
    { operation: "track.remove", trackId: { label: "picture" } },
    { operation: "canvas.set", canvas: { width: 1080, height: 1920 } },
  ];
  expect(() => applyBatch(input, operations, context)).toThrow(CompositionError);
  try {
    applyBatch(input, operations, context);
  } catch (error) {
    expect(error).toMatchObject({ code: "INVALID_EDIT", details: { operationIndex: 2 } });
  }
  expect(input).toEqual(original);
  expect(applyBatch(input, [], context).document).toEqual(original);
});
test("link is idempotent and unlink removes only selected membership", () => {
  const first = applyBatch(input, setup, context);
  const same = applyBatch(
    first.document,
    [{ operation: "link", clipIds: [first.labels.audio, first.labels.video] }],
    context,
  );
  expect(same.changed).toBe(false);
  expect(same.createdIds).toEqual([]);
  const unlinked = applyBatch(
    first.document,
    [{ operation: "unlink", clipIds: [first.labels.audio] }],
    context,
  );
  expect(unlinked.document.syncGroups).toEqual([]);
  expect(unlinked.document.clips).toEqual(first.document.clips);
});
test("canvas and layer order changes preserve all clip timing", () => {
  const first = applyBatch(input, setup, context);
  const result = applyBatch(
    first.document,
    [
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "overlay" },
      { operation: "track.reorder", trackIds: [{ label: "overlay" }, first.labels.picture] },
      { operation: "canvas.set", canvas: { width: 1080, height: 1920 } },
    ],
    { ...context, namespace: "layout" },
  );
  expect(result.document.canvas).toEqual({ ...input.canvas, width: 1080, height: 1920 });
  expect(result.document.clips).toEqual(first.document.clips);
  expect(result.document.tracks.find((track) => track.id === first.labels.picture)?.order).toBe(1);
  expect(result.document.tracks.find((track) => track.id === result.labels.overlay)?.order).toBe(0);
});
test("net no-op and prototype-shaped labels keep a truthful result", () => {
  const result = applyBatch(
    input,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "__proto__" },
      { operation: "track.remove", trackId: { label: "__proto__" } },
    ],
    context,
  );
  expect(result.document).toEqual(input);
  expect(result.changed).toBe(false);
  expect(Object.hasOwn(result.labels, "__proto__")).toBe(true);
  expect(JSON.parse(JSON.stringify(result.labels)).__proto__).toBe(result.createdIds[0]?.id);
});
