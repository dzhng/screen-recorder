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

test("range removal cuts linked members without closing the gap", () => {
  const first = applyBatch(input, setup, context);
  const result = applyBatch(
    first.document,
    [
      {
        operation: "remove",
        clipIds: [first.labels.video],
        ranges: [
          { startUs: 500000, endUs: 800000 },
          { startUs: 700000, endUs: 1000000 },
        ],
        ripple: "none",
      },
    ],
    { ...context, namespace: "remove" },
  );
  const picture = result.document.clips.filter((clip) => clip.trackId === first.labels.picture);
  const sound = result.document.clips.filter((clip) => clip.trackId === first.labels.sound);
  expect(picture.map((clip) => clip.source)).toEqual([
    { kind: "range", range: { startUs: 0, endUs: 500000 } },
    { kind: "range", range: { startUs: 1000000, endUs: 2000000 } },
  ]);
  expect(sound.map((clip) => clip.source)).toEqual([
    { kind: "range", range: { startUs: 200000, endUs: 500000 } },
    { kind: "range", range: { startUs: 1000000, endUs: 1800000 } },
  ]);
  const model = validateComposition(result.document, context.assets);
  expect(projectToSource(model, 750000)).toEqual([]);
  expect(projectToSource(model, 1000000).map((item) => item.sourceUs)).toEqual([1000000, 1000000]);
  expect(result.document.syncGroups.map((group) => group.clipIds)).toEqual([
    [picture[0]!.id, sound[0]!.id],
    [picture[1]!.id, sound[1]!.id],
  ]);
});

test("removal restricts attached source mappings and deletes attachments without surviving content", () => {
  const first = applyBatch(
    input,
    [
      ...setup,
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "overlays" },
      {
        operation: "place",
        label: "survivor",
        clip: {
          assetId: "source",
          streamId: "v",
          trackId: { label: "overlays" },
          source: { kind: "range", range: { startUs: 0, endUs: 10 } },
          placement: {
            kind: "content",
            clipId: { label: "video" },
            sourceRange: { startUs: 500000, endUs: 2000000 },
          },
        },
      },
      {
        operation: "place",
        label: "deleted",
        clip: {
          assetId: "source",
          streamId: "v",
          trackId: { label: "overlays" },
          source: { kind: "hold", atUs: 0 },
          placement: {
            kind: "content",
            clipId: { label: "video" },
            sourceRange: { startUs: 0, endUs: 500000 },
          },
        },
      },
    ],
    context,
  );
  const result = applyBatch(
    first.document,
    [
      {
        operation: "remove",
        clipIds: [first.labels.video],
        ranges: [{ startUs: 0, endUs: 1000000 }],
        ripple: "none",
      },
    ],
    { ...context, namespace: "remove" },
  );
  expect(result.removedAttachments).toEqual([first.labels.deleted]);
  expect(result.document.clips.find((clip) => clip.id === first.labels.survivor)).toMatchObject({
    source: { kind: "range", range: { startUs: { numerator: 10, denominator: 3 }, endUs: 10 } },
    placement: {
      kind: "content",
      clipId: first.labels.video,
      sourceRange: { startUs: 1000000, endUs: 2000000 },
    },
  });
  expect(result.document.clips.find((clip) => clip.id === first.labels.video)?.source).toEqual({
    kind: "range",
    range: { startUs: 1000000, endUs: 2000000 },
  });
});

test("selected removal preserves counterpart samples and unaffected links", () => {
  const first = applyBatch(input, setup, context);
  const result = applyBatch(
    first.document,
    [
      {
        operation: "remove",
        clipIds: [first.labels.audio],
        scope: "selected",
        ranges: [{ startUs: 500000, endUs: 1000000 }],
        ripple: "none",
      },
    ],
    { ...context, namespace: "independent" },
  );
  const video = result.document.clips.filter((clip) => clip.trackId === first.labels.picture);
  const audio = result.document.clips.filter((clip) => clip.trackId === first.labels.sound);
  expect(result.document.syncGroups.map((group) => group.clipIds)).toEqual([
    [video[0]!.id, audio[0]!.id],
    [video[2]!.id, audio[1]!.id],
  ]);
  const model = validateComposition(result.document, context.assets);
  expect(projectToSource(model, 750000)).toMatchObject([
    { clipId: video[1]!.id, sourceUs: 750000 },
  ]);
  expect(projectToSource(model, 499999).map((item) => item.sourceUs)).toEqual([499999, 499999]);
  expect(projectToSource(model, 1000000).map((item) => item.sourceUs)).toEqual([1000000, 1000000]);
  const absent = applyBatch(
    first.document,
    [
      {
        operation: "remove",
        clipIds: [first.labels.audio],
        scope: "selected",
        ranges: [{ startUs: 1800000, endUs: 2000000 }],
        ripple: "none",
      },
    ],
    context,
  );
  expect(absent.changed).toBe(false);
  expect(absent.createdIds).toEqual([]);
});

test("whole linked removal leaves an editable empty project and repeated removal is a no-op", () => {
  const first = applyBatch(input, setup, context);
  const command = [{ operation: "remove", clipIds: [first.labels.video], ripple: "none" }];
  const result = applyBatch(first.document, command, { ...context, namespace: "empty" });
  expect(result.document.clips).toEqual([]);
  expect(result.document.syncGroups).toEqual([]);
  expect(result.document.tracks).toEqual(first.document.tracks);
  expect(validateComposition(result.document, context.assets).durationUs).toBe(0);
  expect(applyBatch(result.document, command, context).changed).toBe(false);
});

test("trim keeps the requested project interval and applies only its removed windows to linked members", () => {
  const first = applyBatch(input, setup, context);
  const shorterVideo = {
    ...first.document,
    clips: first.document.clips.map((clip) =>
      clip.id === first.labels.video
        ? {
            ...clip,
            source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
            placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
          }
        : clip,
    ),
  };
  const result = applyBatch(
    shorterVideo,
    [
      {
        operation: "trim",
        clipId: first.labels.video,
        range: { startUs: 400000, endUs: 800000 },
        ripple: "none",
      },
    ],
    { ...context, namespace: "trim" },
  );
  expect(result.document.clips.find((clip) => clip.id === first.labels.video)?.source).toEqual({
    kind: "range",
    range: { startUs: 400000, endUs: 800000 },
  });
  expect(
    result.document.clips
      .filter((clip) => clip.trackId === first.labels.sound)
      .map((clip) => clip.source),
  ).toEqual([
    { kind: "range", range: { startUs: 400000, endUs: 800000 } },
    { kind: "range", range: { startUs: 1000000, endUs: 1800000 } },
  ]);
  expect(result.document.syncGroups).toEqual([
    { id: first.labels.av, clipIds: [first.labels.video, first.labels.audio] },
  ]);
  expect(() =>
    applyBatch(
      first.document,
      [
        {
          operation: "trim",
          clipId: first.labels.video,
          range: { startUs: 0, endUs: 3000000 },
          ripple: "none",
        },
      ],
      context,
    ),
  ).toThrow(/within the clip/);
});

test("fresh allocation cannot reuse an identity deleted earlier in the same batch", () => {
  const document = { ...input, tracks: [{ id: "track:reused:0", kind: "video", order: 0 }] };
  expect(() =>
    applyBatch(
      document,
      [
        { operation: "track.remove", trackId: "track:reused:0" },
        { operation: "track.add", track: { kind: "video", order: 0 } },
      ],
      { ...context, namespace: "reused" },
    ),
  ).toThrow(/collides/);
});

test("every small retimed removal preserves all surviving project samples", () => {
  for (let source = 1; source <= 5; source++)
    for (let duration = 2; duration <= 8; duration++)
      for (let startUs = 0; startUs < duration; startUs++)
        for (let endUs = startUs + 1; endUs <= duration; endUs++) {
          const document = {
            ...input,
            tracks: [{ id: "track", kind: "video", order: 0 }],
            clips: [
              {
                id: "clip",
                assetId: "source",
                streamId: "v",
                trackId: "track",
                source: { kind: "range", range: { startUs: 0, endUs: source } },
                placement: { kind: "project", range: { startUs: 0, endUs: duration } },
              },
            ],
          };
          const result = applyBatch(
            document,
            [
              {
                operation: "remove",
                clipIds: ["clip"],
                ranges: [{ startUs, endUs }],
                ripple: "none",
              },
            ],
            context,
          );
          const model = validateComposition(result.document, context.assets);
          for (let at = 0; at < duration; at++) {
            const samples = projectToSource(model, at).map((item) => item.sourceUs);
            expect(samples).toEqual(
              at >= startUs && at < endUs ? [] : [Math.floor((at * source) / duration)],
            );
          }
        }
});

test("explicit ripple shifts roots once and their attached overlays follow once", () => {
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
          source: { kind: "hold", atUs: 123 },
          placement: {
            kind: "content",
            clipId: { label: "video" },
            sourceRange: { startUs: 1000000, endUs: 2000000 },
          },
        },
      },
    ],
    context,
  );
  const command = {
    operation: "remove",
    clipIds: [first.labels.video],
    ranges: [{ startUs: 500000, endUs: 1000000 }],
    ripple: { trackIds: [first.labels.picture, first.labels.sound, first.labels.overlayTrack] },
  };
  const result = applyBatch(first.document, [command], { ...context, namespace: "ripple" });
  const model = validateComposition(result.document, context.assets);
  expect(model.durationUs).toBe(1500000);
  expect(
    projectToSource(model, 500000).map(({ trackId, sourceUs }) => ({ trackId, sourceUs })),
  ).toEqual([
    { trackId: first.labels.picture, sourceUs: 1000000 },
    { trackId: first.labels.sound, sourceUs: 1000000 },
    { trackId: first.labels.overlayTrack, sourceUs: 123 },
  ]);
  expect(() =>
    applyBatch(
      first.document,
      [{ ...command, ripple: { trackIds: [first.labels.overlayTrack] } }],
      { ...context, namespace: "child-ripple" },
    ),
  ).toThrow(/root/);
  expect(() =>
    applyBatch(first.document, [{ ...command, ripple: { trackIds: [first.labels.picture] } }], {
      ...context,
      namespace: "omitted-link",
    }),
  ).toThrow(/synchronization/);
});

test("ripple reports fixed project overlays and refuses unaddressed crossing content", () => {
  const first = applyBatch(
    input,
    [
      ...setup,
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "fixedTrack" },
      {
        operation: "place",
        label: "fixed",
        clip: {
          assetId: "source",
          streamId: "v",
          trackId: { label: "fixedTrack" },
          source: { kind: "hold", atUs: 7 },
          placement: { kind: "project", range: { startUs: 600000, endUs: 1600000 } },
        },
      },
    ],
    context,
  );
  const command = {
    operation: "remove",
    clipIds: [first.labels.video],
    ranges: [{ startUs: 500000, endUs: 1000000 }],
    ripple: { trackIds: [first.labels.picture, first.labels.sound] },
  };
  const result = applyBatch(first.document, [command], { ...context, namespace: "fixed" });
  expect(result.document.clips.find((clip) => clip.id === first.labels.fixed)).toEqual(
    first.document.clips.find((clip) => clip.id === first.labels.fixed),
  );
  expect(result.touchedFixedAnchors).toEqual([{ kind: "clip", id: first.labels.fixed }]);
  expect(() =>
    applyBatch(
      first.document,
      [{ ...command, ripple: { trackIds: [...command.ripple.trackIds, first.labels.fixedTrack] } }],
      { ...context, namespace: "crossing" },
    ),
  ).toThrow(/unremoved content/);
  const explicit = applyBatch(
    first.document,
    [
      {
        ...command,
        clipIds: [first.labels.video, first.labels.fixed],
        ripple: { trackIds: [...command.ripple.trackIds, first.labels.fixedTrack] },
      },
    ],
    { ...context, namespace: "explicit" },
  );
  expect(explicit.document.clips.find((clip) => clip.id === first.labels.fixed)?.placement).toEqual(
    { kind: "project", range: { startUs: 500000, endUs: 1100000 } },
  );
});

test("ripple collapses the requested union including empty project time", () => {
  const document = {
    ...input,
    tracks: [{ id: "track", kind: "video", order: 0 }],
    clips: [
      {
        id: "head",
        assetId: "source",
        streamId: "v",
        trackId: "track",
        source: { kind: "range", range: { startUs: 0, endUs: 500000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 500000 } },
      },
      {
        id: "tail",
        assetId: "source",
        streamId: "v",
        trackId: "track",
        source: { kind: "range", range: { startUs: 1000000, endUs: 2000000 } },
        placement: { kind: "project", range: { startUs: 1000000, endUs: 2000000 } },
      },
    ],
  };
  const result = applyBatch(
    document,
    [
      {
        operation: "remove",
        clipIds: ["head"],
        ranges: [
          { startUs: 500000, endUs: 800000 },
          { startUs: 700000, endUs: 1000000 },
        ],
        ripple: { trackIds: ["track"] },
      },
    ],
    context,
  );
  expect(result.document.clips.find((clip) => clip.id === "head")).toEqual(document.clips[0]);
  expect(result.document.clips.find((clip) => clip.id === "tail")).toMatchObject({
    source: document.clips[1]!.source,
    placement: { kind: "project", range: { startUs: 500000, endUs: 1500000 } },
  });
  expect(result.createdIds).toEqual([]);
  expect(result.splitLineage).toEqual([]);
});

test("removing an absent occurrence cannot ripple unrelated content", () => {
  const first = applyBatch(input, setup, context);
  const result = applyBatch(
    first.document,
    [
      {
        operation: "remove",
        clipIds: ["already-removed"],
        ranges: [{ startUs: 0, endUs: 500000 }],
        ripple: { trackIds: [first.labels.picture, first.labels.sound] },
      },
    ],
    { ...context, namespace: "absent-ripple" },
  );
  expect(result.changed).toBe(false);
  expect(result.document).toEqual(first.document);
});

test("retimed ripple preserves each surviving sample at its collapsed project position", () => {
  for (let source = 1; source <= 5; source++)
    for (let duration = 2; duration <= 8; duration++)
      for (let startUs = 0; startUs < duration; startUs++)
        for (let endUs = startUs + 1; endUs <= duration; endUs++) {
          const document = {
            ...input,
            tracks: [{ id: "track", kind: "video", order: 0 }],
            clips: [
              {
                id: "clip",
                assetId: "source",
                streamId: "v",
                trackId: "track",
                source: { kind: "range", range: { startUs: 0, endUs: source } },
                placement: { kind: "project", range: { startUs: 0, endUs: duration } },
              },
            ],
          };
          const result = applyBatch(
            document,
            [
              {
                operation: "remove",
                clipIds: ["clip"],
                ranges: [{ startUs, endUs }],
                ripple: { trackIds: ["track"] },
              },
            ],
            context,
          );
          const model = validateComposition(result.document, context.assets);
          expect(model.durationUs).toBe(duration - endUs + startUs);
          for (let at = 0; at < model.durationUs; at++) {
            const originalAt = at < startUs ? at : at + endUs - startUs;
            expect(projectToSource(model, at).map((item) => item.sourceUs)).toEqual([
              Math.floor((originalAt * source) / duration),
            ]);
          }
        }
});

test("move preserves linked offsets and selected move leaves the other stream in place", () => {
  const first = applyBatch(input, setup, context);
  const linked = applyBatch(
    first.document,
    [{ operation: "move", clipIds: [first.labels.audio], atUs: 3000000, ripple: "none" }],
    { ...context, namespace: "move" },
  );
  expect(linked.document.clips.map((clip) => clip.placement)).toEqual([
    { kind: "project", range: { startUs: 3000000, endUs: 5000000 } },
    { kind: "project", range: { startUs: 3200000, endUs: 4800000 } },
  ]);
  expect(linked.document.clips.map((clip) => clip.source)).toEqual(
    first.document.clips.map((clip) => clip.source),
  );
  expect(linked.document.syncGroups).toEqual(first.document.syncGroups);
  const selected = applyBatch(
    first.document,
    [
      {
        operation: "move",
        clipIds: [first.labels.audio],
        atUs: 3000000,
        scope: "selected",
        ripple: "none",
      },
    ],
    context,
  );
  expect(selected.document.clips[0]).toEqual(first.document.clips[0]);
  expect(selected.document.clips[1]!.placement).toEqual({
    kind: "project",
    range: { startUs: 3000000, endUs: 4600000 },
  });
  expect(selected.document.syncGroups).toEqual([]);
});

test("moving attached media preserves exact mapping and moves descendants only once", () => {
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
        source: { kind: "range", range: { startUs: 0, endUs: 20 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 12 } },
      },
      {
        id: "child",
        assetId: "source",
        streamId: "v",
        trackId: "overlay",
        source: { kind: "range", range: { startUs: 0, endUs: 10 } },
        placement: { kind: "content", clipId: "parent", sourceRange: { startUs: 5, endUs: 10 } },
      },
      {
        id: "nested",
        assetId: "source",
        streamId: "v",
        trackId: "nested",
        source: { kind: "hold", atUs: 0 },
        placement: {
          kind: "clip",
          clipId: "child",
          start: { numerator: 0, denominator: 1 },
          end: { numerator: 1, denominator: 1 },
        },
      },
    ],
  };
  const before = validateComposition(document, context.assets);
  const shifted = applyBatch(
    document,
    [{ operation: "move", clipIds: ["parent", "child"], atUs: 7, ripple: "none" }],
    context,
  );
  const after = validateComposition(shifted.document, context.assets);
  for (let at = 0; at < 12; at++)
    expect(projectToSource(after, at + 7)).toEqual(projectToSource(before, at));
  expect(shifted.document.clips.slice(1)).toEqual(before.document.clips.slice(1));
  const child = applyBatch(
    document,
    [{ operation: "move", clipIds: ["child"], atUs: 4, ripple: "none" }],
    context,
  );
  expect(child.document.clips[0]).toEqual(before.document.clips[0]);
  expect(child.document.clips[1]!.placement).toEqual({
    kind: "content",
    clipId: "parent",
    sourceRange: {
      startUs: { numerator: 20, denominator: 3 },
      endUs: { numerator: 35, denominator: 3 },
    },
  });
  expect(child.document.clips[2]).toEqual(before.document.clips[2]);
  expect(() =>
    applyBatch(
      document,
      [{ operation: "move", clipIds: ["child"], atUs: 10, ripple: "none" }],
      context,
    ),
  ).toThrow(/leaves its parent/);
  expect(
    applyBatch(
      document,
      [{ operation: "move", clipIds: ["child"], atUs: 3, scope: "selected", ripple: "none" }],
      context,
    ).changed,
  ).toBe(false);
});

test("selected move retains synchronization inside moving and stationary subsets", () => {
  const document = {
    ...input,
    tracks: [0, 1, 2, 3].map((order) => ({ id: `t${order}`, kind: "video", order })),
    clips: [0, 1, 2, 3].map((i) => ({
      id: `c${i}`,
      assetId: "source",
      streamId: "v",
      trackId: `t${i}`,
      source: { kind: "hold", atUs: 0 },
      placement: { kind: "project", range: { startUs: i, endUs: 10 + i } },
    })),
    syncGroups: [{ id: "group", clipIds: ["c0", "c1", "c2", "c3"] }],
  };
  const result = applyBatch(
    document,
    [{ operation: "move", clipIds: ["c0", "c1"], atUs: 20, scope: "selected", ripple: "none" }],
    context,
  );
  expect(result.document.syncGroups.map((group) => group.clipIds)).toEqual([
    ["c2", "c3"],
    ["c0", "c1"],
  ]);
  expect(result.document.syncGroups[0]!.id).toBe("group");
  expect(result.createdIds).toEqual([{ kind: "syncGroup", id: result.document.syncGroups[1]!.id }]);
});

test("move can change explicit destination tracks without changing link or source identity", () => {
  const first = applyBatch(
    input,
    [...setup, { operation: "track.add", track: { kind: "video", order: 1 }, label: "upper" }],
    context,
  );
  const operation = {
    operation: "move",
    clipIds: [first.labels.video],
    atUs: 0,
    ripple: "none",
    scope: "selected",
    tracks: [{ clipId: first.labels.video, trackId: first.labels.upper }],
  };
  const result = applyBatch(first.document, [operation], context);
  expect(result.document.clips[0]).toEqual({
    ...first.document.clips[0],
    trackId: first.labels.upper,
  });
  expect(result.document.clips[1]).toEqual(first.document.clips[1]);
  expect(result.document.syncGroups).toEqual(first.document.syncGroups);
  expect(applyBatch(result.document, [operation], context).changed).toBe(false);
  expect(() =>
    applyBatch(
      first.document,
      [{ ...operation, tracks: [{ clipId: first.labels.audio, trackId: first.labels.sound }] }],
      context,
    ),
  ).toThrow(/affected clips/);
  expect(() =>
    applyBatch(
      first.document,
      [{ ...operation, tracks: [operation.tracks[0], operation.tracks[0]] }],
      context,
    ),
  ).toThrow(/duplicates/);
  expect(() =>
    applyBatch(
      first.document,
      [{ ...operation, tracks: [{ clipId: first.labels.video, trackId: first.labels.sound }] }],
      context,
    ),
  ).toThrow(CompositionError);
});

test("detach freezes exact placement and reanchor changes dependency without moving samples", () => {
  const document = {
    ...input,
    tracks: [
      { id: "base", kind: "video", order: 0 },
      { id: "overlay", kind: "video", order: 1 },
    ],
    clips: [
      {
        id: "parent",
        assetId: "source",
        streamId: "v",
        trackId: "base",
        source: { kind: "range", range: { startUs: 0, endUs: 9 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 10 } },
      },
      {
        id: "child",
        assetId: "source",
        streamId: "v",
        trackId: "overlay",
        source: { kind: "range", range: { startUs: 10, endUs: 20 } },
        placement: { kind: "content", clipId: "parent", sourceRange: { startUs: 1, endUs: 4 } },
      },
    ],
  };
  const detached = applyBatch(document, [{ operation: "detach", clipIds: ["child"] }], context);
  expect(detached.document.clips[1]!.placement).toEqual({
    kind: "project",
    range: { startUs: { numerator: 10, denominator: 9 }, endUs: { numerator: 40, denominator: 9 } },
  });
  expect(
    applyBatch(detached.document, [{ operation: "detach", clipIds: ["child"] }], context).changed,
  ).toBe(false);
  const attached = applyBatch(
    detached.document,
    [{ operation: "reanchor", clipId: "child", placement: document.clips[1]!.placement }],
    context,
  );
  expect(attached.document).toEqual(validateComposition(document, context.assets).document);
  const moved = applyBatch(
    detached.document,
    [{ operation: "move", clipIds: ["parent"], atUs: 20, ripple: "none" }],
    context,
  );
  expect(moved.document.clips[1]).toEqual(detached.document.clips[1]);
  expect(() =>
    applyBatch(
      document,
      [
        {
          operation: "reanchor",
          clipId: "child",
          placement: { kind: "content", clipId: "parent", sourceRange: { startUs: 2, endUs: 5 } },
        },
      ],
      context,
    ),
  ).toThrow(/preserve the current project interval/);
  expect(() =>
    applyBatch(
      document,
      [
        {
          operation: "reanchor",
          clipId: "parent",
          placement: {
            kind: "clip",
            clipId: "child",
            start: { numerator: 0, denominator: 1 },
            end: { numerator: 1, denominator: 1 },
          },
        },
      ],
      context,
    ),
  ).toThrow(CompositionError);
});
