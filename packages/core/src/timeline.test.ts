import { expect, test } from "vitest";
import * as timeline from "./timeline.js";

test("batch cuts union overlap and adjacency before subtraction", () => {
  const original = timeline.createOriginalRevision(20_000_000, "2026-09-15T00:00:00.000Z");
  expect(
    timeline.cutSpans(original, [
      { startUs: 10_000_000, endUs: 11_000_000 },
      { startUs: 3_000_000, endUs: 4_000_000 },
      { startUs: 10_500_000, endUs: 12_000_000 },
      { startUs: 12_000_000, endUs: 13_000_000 },
    ]),
  ).toEqual([
    { startUs: 0, endUs: 3_000_000 },
    { startUs: 4_000_000, endUs: 10_000_000 },
    { startUs: 13_000_000, endUs: 20_000_000 },
  ]);
});

test("trim and cut compose in current playback coordinates", () => {
  const original = timeline.createOriginalRevision(20_000_000, "2026-09-15T00:00:00.000Z");
  const trimmed = timeline.createRevision(
    original,
    timeline.trimSpans(original, { startUs: 2_000_000, endUs: 18_000_000 }),
    { id: "a", operation: "trim", createdAt: "now" },
  );
  const cut = timeline.createRevision(
    trimmed,
    timeline.cutSpans(trimmed, [
      { startUs: 3_000_000, endUs: 5_000_000 },
      { startUs: 9_000_000, endUs: 11_000_000 },
    ]),
    { id: "b", operation: "cut", createdAt: "now" },
  );
  expect(cut.spans).toEqual([
    { startUs: 2_000_000, endUs: 5_000_000 },
    { startUs: 7_000_000, endUs: 11_000_000 },
    { startUs: 13_000_000, endUs: 18_000_000 },
  ]);
  expect(cut.durationUs).toBe(12_000_000);
  expect(timeline.trimSpans(cut, { startUs: 2_000_000, endUs: 8_000_000 })).toEqual([
    { startUs: 4_000_000, endUs: 5_000_000 },
    { startUs: 7_000_000, endUs: 11_000_000 },
    { startUs: 13_000_000, endUs: 14_000_000 },
  ]);
  expect(timeline.trimSpans(cut, { startUs: 0, endUs: 12_000_000 })).toBe(cut.spans);
});

test("frame joins choose following kept source and reject the duration endpoint", () => {
  const original = timeline.createOriginalRevision(20, "2026-09-15T00:00:00.000Z");
  const revision = timeline.createRevision(
    original,
    [
      { startUs: 2, endUs: 5 },
      { startUs: 9, endUs: 15 },
    ],
    { id: "a", operation: "cut", createdAt: "now" },
  );
  expect(timeline.editedToSource(revision, 3)).toEqual({
    sourceUs: 9,
    span: { source: { startUs: 9, endUs: 15 }, playback: { startUs: 3, endUs: 9 } },
  });
  expect(timeline.editedToSource(revision, 8)?.sourceUs).toBe(14);
  expect(timeline.editedToSource(revision, 9)).toBeNull();
  expect(timeline.sourceToEdited(revision, 5)).toBeNull();
  expect(timeline.sourceToEdited(revision, 9)).toBe(3);
  expect(timeline.sourceToEdited(revision, 14)).toBe(8);
});

test("word text survives a middle cut as explicitly partial retained fragments", () => {
  const revision = timeline.createRevision(
    timeline.createOriginalRevision(20, "2026-09-15T00:00:00.000Z"),
    [
      { startUs: 0, endUs: 4 },
      { startUs: 6, endUs: 20 },
    ],
    { id: "a", operation: "cut", createdAt: "now" },
  );
  expect(
    timeline.projectWords(revision, [
      { id: "w", text: "hello", startUs: 3, endUs: 8, confidence: 0.9 },
      { id: "gone", text: "um", startUs: 4, endUs: 6 },
      { id: "whole", text: "yes", startUs: 8, endUs: 10 },
    ]),
  ).toEqual([
    {
      id: "w",
      text: "hello",
      startUs: 3,
      endUs: 8,
      confidence: 0.9,
      partial: true,
      fragments: [
        { source: { startUs: 3, endUs: 4 }, playback: { startUs: 3, endUs: 4 } },
        { source: { startUs: 6, endUs: 8 }, playback: { startUs: 4, endUs: 6 } },
      ],
    },
    {
      id: "whole",
      text: "yes",
      startUs: 8,
      endUs: 10,
      partial: false,
      fragments: [{ source: { startUs: 8, endUs: 10 }, playback: { startUs: 6, endUs: 8 } }],
    },
  ]);
});

test("pauses touching retained edges coalesce with cut markers in source order", () => {
  const revision = timeline.createRevision(
    timeline.createOriginalRevision(20, "2026-09-15T00:00:00.000Z"),
    [
      { startUs: 2, endUs: 5 },
      { startUs: 9, endUs: 15 },
    ],
    { id: "a", operation: "cut", createdAt: "now" },
  );
  expect(
    timeline.projectEvents(revision, [
      { kind: "pause", atSourceUs: 9, elapsedPauseUs: 50 },
      { kind: "pause", atSourceUs: 7, elapsedPauseUs: 100 },
      { kind: "pause", atSourceUs: 5, elapsedPauseUs: 20 },
      { kind: "pause", atSourceUs: 2, elapsedPauseUs: 30 },
      { kind: "pause", atSourceUs: 15, elapsedPauseUs: 40 },
    ]),
  ).toEqual([
    {
      atUs: 0,
      events: [
        { kind: "cut", atSourceUs: 0, removedSourceSpans: [{ startUs: 0, endUs: 2 }] },
        { kind: "pause", atSourceUs: 2, elapsedPauseUs: 30 },
      ],
    },
    {
      atUs: 3,
      events: [
        { kind: "pause", atSourceUs: 5, elapsedPauseUs: 20 },
        { kind: "cut", atSourceUs: 5, removedSourceSpans: [{ startUs: 5, endUs: 9 }] },
        { kind: "pause", atSourceUs: 9, elapsedPauseUs: 50 },
      ],
    },
    {
      atUs: 9,
      events: [
        { kind: "pause", atSourceUs: 15, elapsedPauseUs: 40 },
        { kind: "cut", atSourceUs: 15, removedSourceSpans: [{ startUs: 15, endUs: 20 }] },
      ],
    },
  ]);
});

test("trail cannot bridge deleted source and later pause or scene boundaries win", () => {
  const revision = timeline.createRevision(
    timeline.createOriginalRevision(20_000_000, "2026-09-15T00:00:00.000Z"),
    [
      { startUs: 0, endUs: 5_000_000 },
      { startUs: 9_000_000, endUs: 20_000_000 },
    ],
    { id: "a", operation: "cut", createdAt: "now" },
  );
  expect(timeline.trailBounds(revision, 5_500_000, [], 2_000_000)).toEqual({
    source: { startUs: 9_000_000, endUs: 9_500_000 },
    playback: { startUs: 5_000_000, endUs: 5_500_000 },
    cutoffReason: "cut",
  });
  expect(
    timeline.trailBounds(
      revision,
      5_500_000,
      [
        { kind: "pause", atSourceUs: 9_100_000, elapsedPauseUs: 7_000_000 },
        { kind: "scene", atSourceUs: 9_300_000 },
      ],
      2_000_000,
    ),
  ).toEqual({
    source: { startUs: 9_300_000, endUs: 9_500_000 },
    playback: { startUs: 5_300_000, endUs: 5_500_000 },
    cutoffReason: "scene",
  });
  expect(timeline.trailBounds(revision, 5_000_000, [], 0)).toEqual({
    source: { startUs: 9_000_000, endUs: 9_000_000 },
    playback: { startUs: 5_000_000, endUs: 5_000_000 },
    cutoffReason: "requested",
  });
});

test("invalid batch rejects atomically including fractional times and total removal", () => {
  const revision = timeline.createOriginalRevision(20, "2026-09-15T00:00:00.000Z");
  for (const ranges of [
    [],
    [{ startUs: 0, endUs: 0 }],
    [{ startUs: -1, endUs: 2 }],
    [{ startUs: 3, endUs: 2 }],
    [{ startUs: 1, endUs: 21 }],
    [{ startUs: 0.5, endUs: 2 }],
    [{ startUs: 0, endUs: NaN }],
    [
      { startUs: 0, endUs: 10 },
      { startUs: 10, endUs: 20 },
    ],
    [
      { startUs: 1, endUs: 2 },
      { startUs: 4, endUs: 21 },
    ],
  ]) {
    expect(() => timeline.cutSpans(revision, ranges)).toThrow(timeline.TimelineError);
  }
  expect(revision.spans).toEqual([{ startUs: 0, endUs: 20 }]);
  expect(() => timeline.trimSpans(revision, { startUs: 20, endUs: 20 })).toThrow(
    timeline.TimelineError,
  );
});

test("adjacent restored spans are continuous for cursor trails and copied immutably", () => {
  const spans = [
    { startUs: 0, endUs: 5_000_000 },
    { startUs: 5_000_000, endUs: 10_000_000 },
  ];
  const revision = timeline.createRevision(
    timeline.createOriginalRevision(20_000_000, "2026-09-15T00:00:00.000Z"),
    spans,
    {
      id: "restored",
      operation: "restore",
      createdAt: "now",
    },
  );
  spans[0]!.endUs = 1;
  expect(timeline.trailBounds(revision, 5_500_000, [])).toEqual({
    source: { startUs: 3_500_000, endUs: 5_500_000 },
    playback: { startUs: 3_500_000, endUs: 5_500_000 },
    cutoffReason: "requested",
  });
  expect(() => {
    (revision.spans[0] as { endUs: number }).endUs = 2;
  }).toThrow();
});

test("safe-integer microseconds stay exact near the numeric endpoint", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const revision = timeline.createRevision(
    timeline.createOriginalRevision(max, "2026-09-15T00:00:00.000Z"),
    [
      { startUs: 0, endUs: max - 100 },
      { startUs: max - 50, endUs: max },
    ],
    { id: "large", operation: "cut", createdAt: "now" },
  );
  expect(timeline.editedToSource(revision, max - 51)?.sourceUs).toBe(max - 1);
  expect(timeline.sourceToEdited(revision, max - 1)).toBe(max - 51);
  expect(timeline.trimSpans(revision, { startUs: max - 52, endUs: max - 50 })).toEqual([
    { startUs: max - 2, endUs: max },
  ]);
});
