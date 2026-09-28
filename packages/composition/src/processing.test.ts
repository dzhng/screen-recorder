import { expect, test } from "vitest";
import { applyBatch, validateComposition, getProcessing, processingCapabilities } from "./index.js";
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
  captions: [],
};
const context = { namespace: "processing", assets: [] };
const ref = (label: string) => ({ label });
test("complete stack sets preserve order and identities across configure, bypass and clear", () => {
  const first = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "narration" },
      {
        operation: "processing.set",
        target: { kind: "track", id: ref("narration") },
        steps: [
          { processor: { type: "gain", gain: 0.5 }, label: "quiet" },
          { processor: { type: "gain", gain: 2 }, label: "loud" },
        ],
      },
    ],
    context,
  );
  const target = { kind: "track", id: first.labels.narration };
  expect(first.document.processing).toEqual([
    {
      target,
      steps: [
        { id: first.labels.quiet, enabled: true, processor: { type: "gain", gain: 0.5 } },
        { id: first.labels.loud, enabled: true, processor: { type: "gain", gain: 2 } },
      ],
    },
  ]);
  const steps = [
    { id: first.labels.loud, enabled: false, processor: { type: "gain", gain: 3 } },
    { id: first.labels.quiet, enabled: true, processor: { type: "gain", gain: 0.5 } },
  ];
  const changed = applyBatch(
    first.document,
    [{ operation: "processing.set", target, steps }],
    context,
  );
  expect(changed.document.processing[0]!.steps).toEqual(steps);
  expect(changed.createdIds).toEqual([]);
  expect(
    applyBatch(changed.document, [{ operation: "processing.set", target, steps }], context).changed,
  ).toBe(false);
  expect(
    applyBatch(changed.document, [{ operation: "processing.set", target, steps: [] }], context)
      .document.processing,
  ).toEqual([]);
  expect(validateComposition(first.document, []).durationUs).toBe(0);
});

test("clip split copies independent steps and replacement padding retains or resets them", () => {
  const assets = [
    {
      id: "speech",
      streams: [
        {
          id: "a",
          kind: "audio",
          bounds: { startUs: 0, endUs: 10 },
          available: [{ startUs: 0, endUs: 10 }],
        },
      ],
    },
  ];
  const env = { namespace: "setup", assets };
  const first = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "track" },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: ref("track"),
          assetId: "speech",
          streamId: "a",
          source: { kind: "range", range: { startUs: 0, endUs: 10 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 10 } },
        },
      },
      {
        operation: "processing.set",
        target: { kind: "clip", id: ref("clip") },
        steps: [{ processor: { type: "gain", gain: 0.25 }, label: "gain" }],
      },
    ],
    env,
  );
  const split = applyBatch(
    first.document,
    [{ operation: "split", clipIds: [first.labels.clip], atUs: 4 }],
    { ...env, namespace: "split" },
  );
  expect(split.document.processing.map((s) => s.steps[0]!.processor)).toEqual([
    { type: "gain", gain: 0.25 },
    { type: "gain", gain: 0.25 },
  ]);
  expect(new Set(split.document.processing.map((s) => s.steps[0]!.id)).size).toBe(2);
  expect(split.document.processing[0]!.steps[0]!.id).toBe(first.labels.gain);
  const replacement = {
    operation: "replace",
    clipId: first.labels.clip,
    kind: "audio",
    media: {
      assetId: "speech",
      streamId: "a",
      source: { kind: "range", range: { startUs: 0, endUs: 4 } },
    },
    fit: "silence",
  };
  const padded = applyBatch(first.document, [replacement], { ...env, namespace: "pad" });
  expect(padded.document.processing.map((s) => s.steps[0]!.processor)).toEqual([
    { type: "gain", gain: 0.25 },
    { type: "gain", gain: 0.25 },
  ]);
  expect(padded.document.clips.map((c) => c.source.kind)).toEqual(["range", "silence"]);
  expect(
    applyBatch(first.document, [{ ...replacement, processing: "reset" }], {
      ...env,
      namespace: "reset",
    }).document.processing,
  ).toEqual([]);
});

test("processing rejects foreign IDs and wrong media even while bypassed without partial edits", () => {
  const first = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "video" },
      {
        operation: "processing.set",
        target: { kind: "track", id: ref("audio") },
        steps: [{ label: "gain", processor: { type: "gain", gain: 0.5 } }],
      },
    ],
    context,
  );
  const old = structuredClone(first.document);
  const gain = { processor: { type: "gain", gain: 2 }, enabled: false };
  for (const operation of [
    {
      operation: "processing.set",
      target: { kind: "output" },
      steps: [{ ...gain, id: first.labels.gain }],
    },
    {
      operation: "processing.set",
      target: { kind: "track", id: first.labels.video },
      steps: [gain],
    },
    { operation: "processing.set", target: { kind: "track", id: "absent" }, steps: [] },
    {
      operation: "processing.set",
      target: { kind: "track", id: first.labels.audio },
      steps: [
        { ...gain, id: first.labels.gain },
        { ...gain, id: first.labels.gain },
      ],
    },
  ]) {
    expect(() =>
      applyBatch(first.document, [{ operation: "canvas.set", canvas: { width: 320 } }, operation], {
        ...context,
        namespace: "rejected",
      }),
    ).toThrow();
    expect(first.document).toEqual(old);
  }
});

test("duplicate, ripple movement and deletion preserve target-owned stacks without inheritance", () => {
  const first = applyBatch(
    empty,
    [
      { operation: "group.add", group: { kind: "audio", order: 0 }, label: "group" },
      {
        operation: "track.add",
        track: { kind: "audio", order: 0, parentId: ref("group") },
        label: "track",
      },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: ref("track"),
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 0, endUs: 10 } },
        },
      },
      ...["clip", "track", "group"].map((kind) => ({
        operation: "processing.set",
        target: { kind, id: ref(kind) },
        steps: [{ processor: { type: "gain", gain: 0.5 } }],
      })),
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [{ processor: { type: "gain", gain: 2 } }],
      },
    ],
    context,
  );
  const copied = applyBatch(
    first.document,
    [
      {
        operation: "duplicate",
        clipIds: [first.labels.clip],
        atUs: 20,
        copyLabels: [{ clipId: first.labels.clip, label: "copy" }],
      },
    ],
    { ...context, namespace: "copy" },
  );
  const copyModel = validateComposition(copied.document, []);
  const originalSteps = getProcessing(copyModel, { kind: "clip", id: first.labels.clip });
  const copySteps = getProcessing(copyModel, { kind: "clip", id: copied.labels.copy });
  expect(copySteps.map((s) => s.processor)).toEqual(originalSteps.map((s) => s.processor));
  expect(copySteps[0]!.id).not.toBe(originalSteps[0]!.id);
  expect(copied.processingLineage).toContainEqual({
    originalId: originalSteps[0]!.id,
    stepId: copySteps[0]!.id,
  });
  const moved = applyBatch(
    copied.document,
    [
      {
        operation: "move",
        clipIds: [first.labels.clip],
        atUs: 30,
        ripple: { trackIds: [first.labels.track] },
      },
    ],
    { ...context, namespace: "move" },
  );
  expect(
    getProcessing(validateComposition(moved.document, []), { kind: "clip", id: first.labels.clip }),
  ).toEqual(originalSteps);
  const cleared = applyBatch(
    moved.document,
    [
      { operation: "remove", clipIds: [first.labels.clip, copied.labels.copy], ripple: "none" },
      { operation: "track.remove", trackId: first.labels.track },
      { operation: "group.remove", groupId: first.labels.group },
    ],
    { ...context, namespace: "remove" },
  );
  expect(cleared.document.processing).toEqual([
    first.document.processing.find((s) => s.target.kind === "output"),
  ]);
  const fresh = applyBatch(
    first.document,
    [
      {
        operation: "place",
        label: "fresh",
        clip: {
          trackId: first.labels.track,
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 20, endUs: 30 } },
        },
      },
    ],
    { ...context, namespace: "fresh" },
  );
  expect(
    getProcessing(validateComposition(fresh.document, []), {
      kind: "clip",
      id: fresh.labels.fresh,
    }),
  ).toEqual([]);
  expect(processingCapabilities()).toMatchObject([
    { type: "gain", mediaKind: "audio", execution: false },
  ]);
});

test("fractional splits and insert boundaries copy gain; replacing a parent removes only descendant stacks", () => {
  const assets = [
    {
      id: "speech",
      streams: [
        {
          id: "a",
          kind: "audio",
          bounds: { startUs: 0, endUs: 20 },
          available: [{ startUs: 0, endUs: 20 }],
        },
      ],
    },
  ];
  const env = { ...context, assets };
  const first = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "track" },
      { operation: "track.add", track: { kind: "audio", order: 1 }, label: "attached" },
      {
        operation: "place",
        label: "parent",
        clip: {
          trackId: ref("track"),
          assetId: "speech",
          streamId: "a",
          source: { kind: "range", range: { startUs: 0, endUs: 10 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 6 } },
        },
      },
      {
        operation: "place",
        label: "child",
        clip: {
          trackId: ref("attached"),
          source: { kind: "silence" },
          placement: {
            kind: "clip",
            clipId: ref("parent"),
            start: { numerator: 0, denominator: 1 },
            end: { numerator: 1, denominator: 1 },
          },
        },
      },
      ...["parent", "child"].map((label) => ({
        operation: "processing.set",
        target: { kind: "clip", id: ref(label) },
        steps: [{ processor: { type: "gain", gain: 0.75 } }],
      })),
    ],
    env,
  );
  const inserted = applyBatch(
    first.document,
    [
      {
        operation: "insert",
        atUs: 2,
        durationUs: 1,
        ripple: { trackIds: [first.labels.track, first.labels.attached] },
      },
    ],
    { ...env, namespace: "insert" },
  );
  expect(inserted.document.processing.map((s) => s.steps[0]!.processor.gain)).toEqual([
    0.75, 0.75, 0.75, 0.75,
  ]);
  expect(inserted.document.clips.find((c) => c.id === first.labels.parent)!.source).toEqual({
    kind: "range",
    range: { startUs: 0, endUs: { numerator: 10, denominator: 3 } },
  });
  const replacement = applyBatch(
    first.document,
    [
      {
        operation: "replace",
        clipId: first.labels.parent,
        kind: "audio",
        media: {
          assetId: "speech",
          streamId: "a",
          source: { kind: "range", range: { startUs: 10, endUs: 16 } },
        },
        fit: "ripple",
        ripple: { trackIds: [first.labels.track, first.labels.attached] },
      },
    ],
    { ...env, namespace: "replace" },
  );
  expect(replacement.document.processing).toEqual(
    first.document.processing.filter(
      (s) => s.target.kind === "clip" && s.target.id === first.labels.parent,
    ),
  );
  expect(replacement.document.clips.map((c) => c.id)).toEqual([first.labels.parent]);
});
