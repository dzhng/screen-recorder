import { expect, test } from "vitest";
import { applyBatch, validateComposition, projectToSource, sourceToProject } from "./index.js";
const empty = {
  canvas: {
    width: 160,
    height: 96,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [],
  groups: [],
  clips: [],
  syncGroups: [],
  processing: [],
};
const context = {
  namespace: "routing",
  assets: [{ id: "image", streams: [{ id: "v", kind: "image", width: 640, height: 480 }] }],
};
const ref = (label: string) => ({ label });
test("nested routing changes visual order without changing source timing or sync links", () => {
  const setup = [
    { operation: "group.add", group: { kind: "video", order: 5 }, label: "outer" },
    {
      operation: "group.add",
      group: { kind: "video", order: 2, parentId: ref("outer") },
      label: "inner",
    },
    {
      operation: "track.add",
      track: { kind: "video", order: 0, parentId: ref("inner") },
      label: "inside",
    },
    { operation: "track.add", track: { kind: "video", order: 0 }, label: "outside" },
    ...["inside", "outside"].map((label) => ({
      operation: "place",
      label: `${label}-clip`,
      clip: {
        assetId: "image",
        streamId: "v",
        trackId: ref(label),
        source: { kind: "hold", atUs: 0 },
        placement: { kind: "project", range: { startUs: 0, endUs: 10 } },
      },
    })),
    { operation: "link", clipIds: [ref("inside-clip"), ref("outside-clip")] },
  ];
  const first = applyBatch(empty, setup, context);
  expect(applyBatch(empty, setup, context)).toEqual(first);
  const model = validateComposition(first.document, context.assets);
  expect(projectToSource(model, 5).map((c) => c.trackId)).toEqual([
    first.labels.outside,
    first.labels.inside,
  ]);
  const moved = applyBatch(
    first.document,
    [
      {
        operation: "routing.set",
        target: { kind: "track", id: first.labels.outside },
        parentId: first.labels.inner,
        order: 1,
      },
    ],
    context,
  );
  expect(moved.document.clips).toEqual(first.document.clips);
  expect(moved.document.syncGroups).toEqual(first.document.syncGroups);
  const after = validateComposition(moved.document, context.assets);
  expect(projectToSource(after, 5).map((c) => [c.trackId, c.sourceUs])).toEqual([
    [first.labels.inside, 0],
    [first.labels.outside, 0],
  ]);
  expect(
    sourceToProject(after, { assetId: "image", streamId: "v", atUs: 0 }).map((c) => c.trackId),
  ).toEqual([first.labels.inside, first.labels.outside]);
  expect(after.durationUs).toBe(10);
});

test("routing rejects cycles and incompatible parents atomically", () => {
  const first = applyBatch(
    empty,
    [
      { operation: "group.add", group: { kind: "video", order: 0 }, label: "outer" },
      {
        operation: "group.add",
        group: { kind: "video", order: 0, parentId: ref("outer") },
        label: "inner",
      },
      { operation: "group.add", group: { kind: "audio", order: 0 }, label: "audio" },
    ],
    context,
  );
  const snapshot = structuredClone(first.document);
  for (const [parentId, message] of [
    [first.labels.inner, /cycle/],
    [first.labels.audio, /kind mismatch/],
    ["absent", /Unknown processing parent/],
  ] as const) {
    expect(() =>
      applyBatch(
        first.document,
        [
          { operation: "canvas.set", canvas: { width: 320 } },
          {
            operation: "routing.set",
            target: { kind: "group", id: first.labels.outer },
            parentId,
            order: 1,
          },
        ],
        context,
      ),
    ).toThrow(message);
    expect(first.document).toEqual(snapshot);
  }
  expect(() =>
    applyBatch(
      first.document,
      [{ operation: "group.remove", groupId: first.labels.outer }],
      context,
    ),
  ).toThrow(/children/);
  const same = applyBatch(
    first.document,
    [
      {
        operation: "routing.set",
        target: { kind: "group", id: first.labels.inner },
        parentId: first.labels.outer,
        order: 0,
      },
      { operation: "group.remove", groupId: "absent" },
    ],
    context,
  );
  expect(same.changed).toBe(false);
  const removed = applyBatch(
    first.document,
    [
      { operation: "routing.set", target: { kind: "group", id: first.labels.inner }, order: 1 },
      { operation: "group.remove", groupId: first.labels.outer },
    ],
    context,
  );
  expect(removed.document.groups.find((g) => g.id === first.labels.inner)).toEqual({
    id: first.labels.inner,
    kind: "video",
    order: 1,
  });
  expect(removed.normalized[1]!.changes).toContainEqual({
    kind: "group",
    id: first.labels.outer,
    value: null,
  });
  expect(validateComposition(removed.document, context.assets).durationUs).toBe(0);
});

test("layer reorder is a complete typed sibling permutation, including groups", () => {
  const first = applyBatch(
    empty,
    [
      { operation: "group.add", group: { kind: "video", order: 0 }, label: "group" },
      {
        operation: "track.add",
        track: { kind: "video", order: 0, parentId: ref("group") },
        label: "child",
      },
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "root" },
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "sound" },
    ],
    context,
  );
  const group = { kind: "group", id: first.labels.group };
  const root = { kind: "track", id: first.labels.root };
  const reordered = applyBatch(
    first.document,
    [{ operation: "layers.reorder", targets: [root, group] }],
    context,
  );
  expect(reordered.document.groups[0]!.order).toBe(1);
  expect(reordered.document.tracks.find((t) => t.id === first.labels.root)!.order).toBe(0);
  expect(reordered.document.tracks.find((t) => t.id === first.labels.child)).toEqual(
    first.document.tracks[0],
  );
  for (const targets of [
    [root],
    [root, root],
    [root, { kind: "track", id: first.labels.child }],
    [root, { kind: "track", id: first.labels.sound }],
  ]) {
    expect(() =>
      applyBatch(first.document, [{ operation: "layers.reorder", targets }], context),
    ).toThrow(/every video sibling/);
  }
  expect(() =>
    applyBatch(
      first.document,
      [{ operation: "track.add", track: { kind: "video", order: 0 } }],
      context,
    ),
  ).toThrow(/Duplicate video layer/);
  expect(() =>
    applyBatch(
      first.document,
      [{ operation: "layers.reorder", parentId: "absent", targets: [] }],
      context,
    ),
  ).toThrow(/video group/);
});

test("deep routing is iterative and detects disconnected cycles", () => {
  const groups = Array.from({ length: 12000 }, (_, i) => ({
    id: `g${i}`,
    kind: "audio",
    order: 0,
    ...(i ? { parentId: `g${i - 1}` } : {}),
  }));
  const input = {
    ...empty,
    groups,
    tracks: [{ id: "leaf", kind: "audio", order: 0, parentId: "g11999" }],
    clips: [
      {
        id: "silence",
        trackId: "leaf",
        source: { kind: "silence" },
        placement: { kind: "project", range: { startUs: 0, endUs: 10 } },
      },
    ],
  };
  expect(validateComposition(input, []).durationUs).toBe(10);
  expect(() =>
    validateComposition(
      { ...input, groups: groups.map((g, i) => (i === 0 ? { ...g, parentId: "g11999" } : g)) },
      [],
    ),
  ).toThrow(/cycle/);
  expect(() => validateComposition({ ...empty, groups: [groups[0], groups[0]] }, [])).toThrow(
    /Duplicate processing group/,
  );
});
