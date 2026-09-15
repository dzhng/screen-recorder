import assert from "node:assert/strict";
import {
  createOriginalRevision,
  createRevision,
  trimSpans,
  cutSpans,
  editedToSource,
  projectEvents,
  projectWords,
  renderPlan,
  trailBounds,
} from "@screenrec/core";

// Synthetic 20-second source; expected intervals are stated independently below.
const original = createOriginalRevision(20_000_000, "2026-09-15T00:00:00.000Z");
const trimmed = createRevision(
  original,
  trimSpans(original, { startUs: 2_000_000, endUs: 18_000_000 }),
  { id: "lab-trim", operation: "trim", createdAt: "2026-09-15T00:00:00.000Z" },
);
const edited = createRevision(
  trimmed,
  cutSpans(trimmed, [
    { startUs: 3_000_000, endUs: 4_000_000 },
    { startUs: 3_500_000, endUs: 5_000_000 },
    { startUs: 9_000_000, endUs: 10_000_000 },
    { startUs: 10_000_000, endUs: 11_000_000 },
  ]),
  { id: "lab-cut", operation: "cut", createdAt: "2026-09-15T00:00:01.000Z" },
);
const expectedSpans = [
  { startUs: 2_000_000, endUs: 5_000_000 },
  { startUs: 7_000_000, endUs: 11_000_000 },
  { startUs: 13_000_000, endUs: 18_000_000 },
];
assert.deepEqual(edited.spans, expectedSpans);
assert.equal(edited.durationUs, 12_000_000);
assert.equal(editedToSource(edited, 3_000_000)?.sourceUs, 7_000_000);
assert.equal(editedToSource(edited, 7_000_000)?.sourceUs, 13_000_000);
assert.equal(editedToSource(edited, 12_000_000), null);
const events = projectEvents(edited, [
  { kind: "pause", atSourceUs: 5_000_000, elapsedPauseUs: 30_000_000 },
  { kind: "pause", atSourceUs: 6_000_000, elapsedPauseUs: 10_000_000 },
]);
assert.deepEqual(
  events.map((group) => ({ atUs: group.atUs, kinds: group.events.map((event) => event.kind) })),
  [
    { atUs: 0, kinds: ["cut"] },
    { atUs: 3_000_000, kinds: ["pause", "cut"] },
    { atUs: 7_000_000, kinds: ["cut"] },
    { atUs: 12_000_000, kinds: ["cut"] },
  ],
);
const words = projectWords(edited, [
  { id: "phrase", text: "free", startUs: 4_000_000, endUs: 8_000_000 },
]);
assert.deepEqual(words[0]?.fragments, [
  {
    source: { startUs: 4_000_000, endUs: 5_000_000 },
    playback: { startUs: 2_000_000, endUs: 3_000_000 },
  },
  {
    source: { startUs: 7_000_000, endUs: 8_000_000 },
    playback: { startUs: 3_000_000, endUs: 4_000_000 },
  },
]);
assert.equal(words[0]?.partial, true);
const trail = trailBounds(edited, 3_500_000, []);
assert.deepEqual(trail, {
  source: { startUs: 7_000_000, endUs: 7_500_000 },
  playback: { startUs: 3_000_000, endUs: 3_500_000 },
  cutoffReason: "cut",
});
const restored = createRevision(edited, original.spans, {
  id: "lab-restore",
  operation: "restore",
  createdAt: "2026-09-15T00:00:02.000Z",
});
assert.deepEqual(restored.spans, [{ startUs: 0, endUs: 20_000_000 }]);
assert.notEqual(restored.id, original.id);
assert.throws(() => cutSpans(edited, [{ startUs: 0, endUs: 12_000_000 }]));
console.log(
  JSON.stringify(
    {
      fixture: "synthetic 20-second labeled timeline",
      passed: true,
      expectedSpans,
      revision: edited,
      renderPlan: renderPlan(edited),
      events,
      words,
      trail,
      restored,
    },
    null,
    2,
  ),
);
