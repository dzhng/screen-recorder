import assert from "node:assert/strict";
import { applyBatch, validateComposition, projectToSource } from "../../composition/dist/index.js";

if (process.argv.slice(2).join(" ") !== "--case routing") {
  console.error("Usage: node packages/test-harness/editing/processors.mjs --case routing");
  process.exitCode = 1;
} else {
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
    effects: [],
    captions: [],
  };
  const context = {
    namespace: "routing-probe",
    assets: [{ id: "still", streams: [{ id: "v", kind: "image" }] }],
  };
  const label = (name) => ({ label: name });
  const setup = [
    { operation: "group.add", group: { kind: "video", order: 0 }, label: "outer" },
    {
      operation: "group.add",
      group: { kind: "video", order: 0, parentId: label("outer") },
      label: "inner",
    },
    {
      operation: "track.add",
      track: { kind: "video", order: 0, parentId: label("inner") },
      label: "inside",
    },
    { operation: "track.add", track: { kind: "video", order: 1 }, label: "outside" },
    ...["inside", "outside"].map((name) => ({
      operation: "place",
      label: `${name}-clip`,
      clip: {
        assetId: "still",
        streamId: "v",
        trackId: label(name),
        source: { kind: "hold", atUs: 0 },
        placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
      },
    })),
    { operation: "link", clipIds: [label("inside-clip"), label("outside-clip")] },
  ];
  const first = applyBatch(empty, setup, context);
  assert.deepEqual(applyBatch(empty, setup, context), first);
  const snapshot = structuredClone(first.document);
  const result = applyBatch(
    first.document,
    [
      {
        operation: "routing.set",
        target: { kind: "track", id: first.labels.outside },
        parentId: first.labels.inner,
        order: 1,
      },
      {
        operation: "layers.reorder",
        parentId: first.labels.inner,
        targets: [
          { kind: "track", id: first.labels.outside },
          { kind: "track", id: first.labels.inside },
        ],
      },
    ],
    context,
  );
  assert.deepEqual(result.document.clips, first.document.clips);
  assert.deepEqual(result.document.syncGroups, first.document.syncGroups);
  const model = validateComposition(result.document, context.assets);
  const observed = projectToSource(model, 500000).map((c) => [c.clipId, c.sourceUs]);
  assert.deepEqual(observed, [
    [first.labels["outside-clip"], 0],
    [first.labels["inside-clip"], 0],
  ]);
  assert.equal(model.durationUs, 1000000);
  assert.throws(
    () =>
      applyBatch(
        first.document,
        [
          { operation: "canvas.set", canvas: { width: 320 } },
          {
            operation: "routing.set",
            target: { kind: "group", id: first.labels.outer },
            parentId: first.labels.inner,
            order: 1,
          },
        ],
        context,
      ),
    /cycle/,
  );
  assert.deepEqual(first.document, snapshot);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        case: "routing",
        durationUs: model.durationUs,
        observed,
        checks: [
          "deterministic replay",
          "nested grouping",
          "combined sibling order",
          "unchanged clip timing and sync links",
          "cycle rejection and batch immutability",
        ],
        nativeProcessingClaimed: false,
      },
      null,
      2,
    ),
  );
}
