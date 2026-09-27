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

test("linked split partitions unequal AV and attached media without changing sample mapping", () => {
  const first = applyBatch(
    input,
    [
      ...setup,
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "overlayTrack" },
      {
        operation: "place",
        label: "overlay",
        clip: {
          assetId: "source",
          streamId: "v",
          trackId: { label: "overlayTrack" },
          source: { kind: "range", range: { startUs: 0, endUs: 10 } },
          placement: {
            kind: "content",
            clipId: { label: "video" },
            sourceRange: { startUs: 0, endUs: 6 },
          },
        },
      },
    ],
    context,
  );
  const result = applyBatch(
    first.document,
    [{ operation: "split", clipIds: [first.labels.video], atUs: 2 }],
    { ...context, namespace: "split" },
  );
  const overlayParts = result.document.clips.filter(
    (clip) => clip.trackId === first.labels.overlayTrack,
  );
  expect(overlayParts.map((clip) => clip.source)).toEqual([
    { kind: "range", range: { startUs: 0, endUs: { numerator: 10, denominator: 3 } } },
    { kind: "range", range: { startUs: { numerator: 10, denominator: 3 }, endUs: 10 } },
  ]);
  expect(result.splitLineage).toEqual(
    expect.arrayContaining([
      { originalId: first.labels.overlay, clipIds: overlayParts.map((clip) => clip.id) },
    ]),
  );
  const old = validateComposition(first.document, context.assets);
  const model = validateComposition(result.document, context.assets);
  for (const at of [0, 1, 2, 3, 5, 6, 199999, 200000, 1799999, 1999999]) {
    const samples = (m: typeof model) =>
      projectToSource(m, at).map(({ trackId, sourceUs, available }) => ({
        trackId,
        sourceUs,
        available,
      }));
    expect(samples(model)).toEqual(samples(old));
  }
  const videoParts = result.document.clips.filter((clip) => clip.trackId === first.labels.picture);
  expect(result.document.syncGroups).toEqual([
    { id: first.labels.av, clipIds: [videoParts[1]!.id, first.labels.audio] },
  ]);
  expect(first.document.clips).toHaveLength(3);
});

test("splitting a held parent rebases normalized attachments and preserves nested content", () => {
  const document = {
    ...input,
    tracks: [
      { id: "base", kind: "video", order: 0 },
      { id: "overlay", kind: "video", order: 1 },
      { id: "nested", kind: "video", order: 2 },
    ],
    clips: [
      {
        id: "parent",
        assetId: "source",
        streamId: "v",
        trackId: "base",
        source: { kind: "hold", atUs: 0 },
        placement: { kind: "project", range: { startUs: 0, endUs: 12 } },
      },
      {
        id: "child",
        assetId: "source",
        streamId: "v",
        trackId: "overlay",
        source: { kind: "range", range: { startUs: 0, endUs: 12 } },
        placement: {
          kind: "clip",
          clipId: "parent",
          start: { numerator: 1, denominator: 3 },
          end: { numerator: 5, denominator: 6 },
        },
      },
      {
        id: "grandchild",
        assetId: "source",
        streamId: "v",
        trackId: "nested",
        source: { kind: "range", range: { startUs: 10, endUs: 20 } },
        placement: { kind: "content", clipId: "child", sourceRange: { startUs: 2, endUs: 8 } },
      },
    ],
  };
  const result = applyBatch(
    document,
    [{ operation: "split", clipIds: ["parent"], atUs: 6 }],
    context,
  );
  const children = result.document.clips.filter((clip) => clip.trackId === "overlay");
  const parents = result.document.clips.filter((clip) => clip.trackId === "base");
  expect(children.map((clip) => clip.placement)).toEqual([
    {
      kind: "clip",
      clipId: "parent",
      start: { numerator: 2, denominator: 3 },
      end: { numerator: 1, denominator: 1 },
    },
    {
      kind: "clip",
      clipId: parents[1]!.id,
      start: { numerator: 0, denominator: 1 },
      end: { numerator: 2, denominator: 3 },
    },
  ]);
  const before = validateComposition(document, context.assets);
  const after = validateComposition(result.document, context.assets);
  for (let at = 0; at < 12; at++) {
    const samples = (m: typeof before) =>
      projectToSource(m, at).map(({ trackId, sourceUs }) => ({ trackId, sourceUs }));
    expect(samples(after)).toEqual(samples(before));
  }
  expect(result.splitLineage.map((entry) => entry.originalId)).toEqual([
    "parent",
    "child",
    "grandchild",
  ]);
});

test("selected split unlinks its fragments while linked split preserves both AV halves", () => {
  const first = applyBatch(input, setup, context);
  const selected = applyBatch(
    first.document,
    [{ operation: "split", clipIds: [first.labels.video], atUs: 1000000, scope: "selected" }],
    { ...context, namespace: "selected" },
  );
  expect(selected.document.syncGroups).toEqual([]);
  expect(selected.document.clips.find((clip) => clip.id === first.labels.audio)).toEqual(
    first.document.clips.find((clip) => clip.id === first.labels.audio),
  );
  const linked = applyBatch(
    first.document,
    [{ operation: "split", clipIds: [first.labels.video], atUs: 1000000 }],
    { ...context, namespace: "linked" },
  );
  const video = linked.document.clips.filter((clip) => clip.trackId === first.labels.picture);
  const audio = linked.document.clips.filter((clip) => clip.trackId === first.labels.sound);
  expect(linked.document.syncGroups).toEqual([
    { id: first.labels.av, clipIds: [video[0]!.id, audio[0]!.id] },
    {
      id: linked.createdIds.find((entry) => entry.kind === "syncGroup")!.id,
      clipIds: [video[1]!.id, audio[1]!.id],
    },
  ]);
  const repeat = applyBatch(
    linked.document,
    [{ operation: "split", clipIds: [video[0]!.id], atUs: 1000000 }],
    { ...context, namespace: "again" },
  );
  expect(repeat.changed).toBe(false);
  expect(repeat.createdIds).toEqual([]);
  expect(repeat.splitLineage).toEqual([]);
});

test("selected members absent at a split keep their synchronization", () => {
  const ids = ["a", "b", "c"];
  const document = {
    ...input,
    tracks: ids.map((id, order) => ({ id, kind: "video", order })),
    clips: ids.map((id) => ({
      id,
      assetId: "source",
      streamId: "v",
      trackId: id,
      source: { kind: "range", range: { startUs: 0, endUs: id === "b" ? 10 : 5 } },
      placement: { kind: "project", range: { startUs: 0, endUs: id === "b" ? 10 : 5 } },
    })),
    syncGroups: [{ id: "group", clipIds: ids }],
  };
  const result = applyBatch(
    document,
    [{ operation: "split", clipIds: ["a", "b"], atUs: 7, scope: "selected" }],
    context,
  );
  expect(result.document.syncGroups).toEqual([{ id: "group", clipIds: ["a", "c"] }]);
  expect(result.splitLineage).toEqual([
    { originalId: "b", clipIds: ["b", result.createdIds[0]!.id] },
  ]);
});

test("a batch can address new split children by labels without guessing identities", () => {
  const first = applyBatch(input, setup, context);
  const result = applyBatch(
    first.document,
    [
      {
        operation: "split",
        clipIds: [first.labels.video],
        atUs: 1000000,
        rightLabels: [
          { clipId: first.labels.video, label: "rightVideo" },
          { clipId: first.labels.audio, label: "rightAudio" },
        ],
      },
      { operation: "unlink", clipIds: [{ label: "rightAudio" }] },
    ],
    { ...context, namespace: "named-split" },
  );
  expect(result.labels.rightVideo).toBe(
    result.splitLineage.find((entry) => entry.originalId === first.labels.video)!.clipIds[1],
  );
  expect(result.labels.rightAudio).toBe(
    result.splitLineage.find((entry) => entry.originalId === first.labels.audio)!.clipIds[1],
  );
  expect(result.document.syncGroups).toEqual([
    { id: first.labels.av, clipIds: [first.labels.video, first.labels.audio] },
  ]);
});
