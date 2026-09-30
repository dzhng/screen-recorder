import assert from "node:assert/strict";
import test from "node:test";
import { buildAnnotationRecord, secondsToSourceUs } from "./annotation-time.mjs";

const binding = {
  clipSha256: "synthetic-clip",
  sourceSha256: "synthetic-source",
  packetSha256: "synthetic-packet",
  sourceRange: { startUs: 50518675, endUs: 57658675 },
  sourceOriginUs: 48675,
  sampleRate: 48000,
  frames: 342720,
};

test("clip positions retain the acquired source clock without adding its origin twice", () => {
  assert.equal(secondsToSourceUs(0, binding), 50518675);
  assert.equal(secondsToSourceUs(3.61, binding), 54128675);
  assert.equal(secondsToSourceUs(7.14, binding), 57658675);
  assert.throws(() => secondsToSourceUs(-0.001, binding));
  assert.throws(() => secondsToSourceUs(7.141, binding));
});

test("confirmed filler marks remain local to the clip and reject a changed source", () => {
  const context = { binding, targets: [{ id: "w117", text: "uh" }] };
  const submitted = {
    binding,
    confirmed: true,
    notes: "synthetic test only",
    marks: [{ id: "w117", startSeconds: 3.61, endSeconds: 4.03 }],
  };
  const record = buildAnnotationRecord(context, submitted);
  assert.deepEqual(record.independentAnnotations.independentFillerInventory, {
    scope: binding.sourceRange,
    complete: false,
    targets: [
      {
        id: "filler-uh-54s",
        kind: "filler",
        text: "uh",
        sourceRange: { startUs: 54128675, endUs: 54548675 },
      },
    ],
  });
  assert.equal(record.independentAnnotations.independentSentenceRange, null);
  assert.throws(
    () =>
      buildAnnotationRecord(context, {
        ...submitted,
        binding: { ...binding, clipSha256: "different-clip" },
      }),
    /different source packet/,
  );
});

test("unconfirmed and partial marks never become independent labels", () => {
  const context = { binding, targets: [{ id: "w116", text: "paragraph" }] };
  const submitted = {
    binding,
    confirmed: false,
    notes: "synthetic test positions",
    marks: [{ id: "w116", startSeconds: 1, endSeconds: null }],
  };
  const draft = buildAnnotationRecord(context, submitted);
  assert.equal(draft.marks[0].startUs, 51518675);
  assert.equal(draft.marks[0].endUs, null);
  assert.equal(draft.independentAnnotations, null);
  const confirmed = buildAnnotationRecord(context, { ...submitted, confirmed: true });
  assert.equal(confirmed.independentAnnotations.protectedNeighbors[0].independentRange, null);
  assert.equal(confirmed.independentAnnotations.independentFillerInventory, null);
  assert.equal(confirmed.independentAnnotations.independentRepetitionIntent, null);
});

test("unknown export fields cannot silently change what a listener submits", () => {
  const context = { binding, targets: [{ id: "w117", text: "uh" }] };
  assert.throws(
    () =>
      buildAnnotationRecord(context, {
        binding,
        confirmed: false,
        notes: "synthetic test only",
        marks: [],
        independentAnnotations: { invented: true },
      }),
    /Unknown field/,
  );
});
