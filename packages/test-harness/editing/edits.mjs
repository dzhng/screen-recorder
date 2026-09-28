import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyBatch,
  validateComposition,
  projectToSource,
  sourceToProject,
  CompositionError,
} from "../../composition/dist/index.js";
if (process.argv.slice(2).join(" ") !== "--fixture linked-replacement") {
  console.error("Usage: node packages/test-harness/editing/edits.mjs --fixture linked-replacement");
  process.exitCode = 1;
} else {
  const oracle = JSON.parse(await readFile(new URL("./expected.json", import.meta.url), "utf8"));
  const assets = Object.entries(oracle.clips).map(([id, clip]) => ({
    id,
    streams: ["video", "audio"].map((kind) => ({
      id: kind,
      kind,
      bounds: { startUs: 0, endUs: clip.durationUs },
      available: [{ startUs: 0, endUs: clip.durationUs }],
    })),
  }));
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
  const run = (document, operations, namespace) =>
    applyBatch(document, operations, { assets, namespace });
  const setup = [
    { operation: "track.add", track: { kind: "video", order: 0 }, label: "picture" },
    { operation: "track.add", track: { kind: "audio", order: 0 }, label: "sound" },
    { operation: "track.add", track: { kind: "video", order: 1 }, label: "overlay" },
    {
      operation: "place",
      label: "video",
      clip: {
        assetId: "a",
        streamId: "video",
        trackId: { label: "picture" },
        source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 2000000 } },
      },
    },
    {
      operation: "place",
      label: "audio",
      clip: {
        assetId: "a",
        streamId: "audio",
        trackId: { label: "sound" },
        source: { kind: "range", range: { startUs: 200000, endUs: 1800000 } },
        placement: { kind: "project", range: { startUs: 200000, endUs: 1800000 } },
      },
    },
    { operation: "link", clipIds: [{ label: "video" }, { label: "audio" }], label: "av" },
    {
      operation: "place",
      label: "overlayClip",
      clip: {
        assetId: "b",
        streamId: "video",
        trackId: { label: "overlay" },
        source: { kind: "hold", atUs: 0 },
        placement: {
          kind: "content",
          clipId: { label: "video" },
          sourceRange: { startUs: 500000, endUs: 1500000 },
        },
      },
    },
    {
      operation: "place",
      label: "stationary",
      clip: {
        assetId: "b",
        streamId: "video",
        trackId: { label: "picture" },
        source: { kind: "hold", atUs: 0 },
        placement: { kind: "project", range: { startUs: 2250000, endUs: 2500000 } },
      },
    },
  ];
  const first = run(empty, setup, "setup");
  assert.deepEqual(run(empty, setup, "setup"), first);
  const before = structuredClone(first.document);
  const split = run(
    first.document,
    [
      {
        operation: "split",
        clipIds: [first.labels.video],
        atUs: 1000000,
        rightLabels: [
          { clipId: first.labels.video, label: "rightVideo" },
          { clipId: first.labels.audio, label: "rightAudio" },
          { clipId: first.labels.overlayClip, label: "rightOverlay" },
        ],
      },
    ],
    "split",
  );
  const replaced = run(
    split.document,
    [
      {
        operation: "replace",
        clipId: split.labels.rightAudio,
        kind: "audio",
        media: {
          assetId: "b",
          streamId: "audio",
          source: { kind: "range", range: { startUs: 0, endUs: 800000 } },
        },
      },
    ],
    "replace",
  );
  assert.deepEqual(
    replaced.document.clips.find((c) => c.id === split.labels.rightVideo),
    split.document.clips.find((c) => c.id === split.labels.rightVideo),
  );
  const moved = run(
    replaced.document,
    [
      {
        operation: "move",
        clipIds: [split.labels.rightVideo],
        atUs: 2000000,
        ripple: { trackIds: [first.labels.picture, first.labels.sound, first.labels.overlay] },
      },
    ],
    "move",
  );
  const model = validateComposition(moved.document, assets);
  const roles = new Map([
    [first.labels.picture, "video"],
    [first.labels.sound, "audio"],
    [first.labels.overlay, "overlay"],
  ]);
  const membership = (model, atUs) =>
    projectToSource(model, atUs)
      .map((row) => [roles.get(row.trackId), row.assetId, row.sourceUs, row.available])
      .sort((a, b) => a[0].localeCompare(b[0]));
  const expected = [
    [100000, [["video", "a", 100000, true]]],
    [
      750000,
      [
        ["audio", "a", 750000, true],
        ["overlay", "b", 0, true],
        ["video", "a", 750000, true],
      ],
    ],
    [1375000, [["video", "b", 0, true]]],
    [1500000, []],
    [
      2250000,
      [
        ["audio", "b", 250000, true],
        ["overlay", "b", 0, true],
        ["video", "a", 1250000, true],
      ],
    ],
    [2900000, [["video", "a", 1900000, true]]],
  ];
  for (const [atUs, rows] of expected) assert.deepEqual(membership(model, atUs), rows);
  assert.equal(model.durationUs, 3000000);
  const copied = run(
    moved.document,
    [
      {
        operation: "duplicate",
        clipIds: [split.labels.rightVideo],
        atUs: 4000000,
        copyLabels: [
          { clipId: split.labels.rightVideo, label: "copy" },
          { clipId: split.labels.rightOverlay, label: "copyOverlay" },
        ],
      },
    ],
    "copy",
  );
  const copyModel = validateComposition(copied.document, assets);
  assert.deepEqual(membership(copyModel, 4250000), [
    ["overlay", "b", 0, true],
    ["video", "a", 1250000, true],
  ]);
  assert.deepEqual(
    sourceToProject(copyModel, { assetId: "a", streamId: "video", atUs: 1250000 }).map(
      (row) => row.firstProjectUs,
    ),
    [2250000, 4250000],
  );
  const removed = run(
    copied.document,
    [{ operation: "remove", clipIds: [copied.labels.copy], scope: "selected", ripple: "none" }],
    "remove-copy",
  );
  assert.deepEqual(removed.document, moved.document);
  assert.deepEqual(removed.removedAttachments, [copied.labels.copyOverlay]);
  const snapshot = structuredClone(moved.document);
  assert.throws(
    () =>
      run(
        moved.document,
        [
          { operation: "canvas.set", canvas: { width: 320 } },
          { operation: "duplicate", clipIds: [split.labels.rightVideo], atUs: 4000000 },
          {
            operation: "replace",
            clipId: split.labels.rightAudio,
            kind: "audio",
            media: {
              assetId: "b",
              streamId: "audio",
              source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
            },
          },
          { operation: "canvas.set", canvas: { height: 320 } },
        ],
        "failed-batch",
      ),
    (error) => error instanceof CompositionError && error.details.operationIndex === 2,
  );
  assert.deepEqual(moved.document, snapshot);
  assert.deepEqual(first.document, before);
  const deleted = run(
    moved.document,
    [
      {
        operation: "remove",
        clipIds: [first.labels.video, split.labels.rightVideo, first.labels.stationary],
        ripple: "none",
      },
    ],
    "delete-all",
  );
  assert.deepEqual(deleted.document.clips, []);
  assert.deepEqual(deleted.document.syncGroups, []);
  assert.equal(validateComposition(deleted.document, assets).durationUs, 0);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        fixture: "linked-replacement",
        durationUs: model.durationUs,
        checks: [
          "deterministic labels and identities",
          "linked split through attachment",
          "audio replacement preserves video",
          "explicit ripple move preserves unequal offsets",
          "selected duplication copies attachment without audio",
          "one-to-many source-to-project mapping",
          "attachment removal",
          "operation-three rollback",
          "input immutability",
          "full deletion to empty project",
        ],
        memberships: expected.map(([atUs, occurrences]) => ({ atUs, occurrences })),
      },
      null,
      2,
    ),
  );
}
