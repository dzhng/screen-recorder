import { expect, test } from "vitest";
import { attributeTranscriptWords } from "./speaker-attribution.js";

test("attributes only words wholly covered by exactly one speaker turn", () => {
  expect(
    attributeTranscriptWords(
      [
        { id: "w0", sourceRange: { startUs: 100, endUs: 200 } },
        { id: "w1", sourceRange: { startUs: 200, endUs: 300 } },
        { id: "w2", sourceRange: { startUs: 300, endUs: 400 } },
      ],
      [
        { slot: 0, sourceRange: { startUs: 0, endUs: 200 } },
        { slot: 1, sourceRange: { startUs: 220, endUs: 400 } },
        { slot: 2, sourceRange: { startUs: 250, endUs: 400 } },
      ],
    ),
  ).toEqual([
    {
      id: "w0",
      sourceRange: { startUs: 100, endUs: 200 },
      speaker: { state: "attributed", slot: 0 },
    },
    { id: "w1", sourceRange: { startUs: 200, endUs: 300 }, speaker: { state: "unknown" } },
    {
      id: "w2",
      sourceRange: { startUs: 300, endUs: 400 },
      speaker: { state: "overlap", slots: [1, 2] },
    },
  ]);
});

test("display names decorate only uniquely attributed words", () => {
  expect(
    attributeTranscriptWords(
      [{ id: "w0", sourceRange: { startUs: 0, endUs: 10 } }],
      [{ slot: 2, sourceRange: { startUs: 0, endUs: 10 } }],
      { labels: new Map([[2, "Grace"]]) },
    ),
  ).toEqual([
    {
      id: "w0",
      sourceRange: { startUs: 0, endUs: 10 },
      speaker: { state: "attributed", slot: 2, displayName: "Grace" },
    },
  ]);
});

test("a partial competing turn prevents confident attribution for the whole word", () => {
  const words = [
    { id: "overlapping", sourceRange: { startUs: 100, endUs: 300 } },
    { id: "after", sourceRange: { startUs: 300, endUs: 400 } },
  ];
  expect(
    attributeTranscriptWords(
      words,
      [
        { slot: 0, sourceRange: { startUs: 0, endUs: 400 } },
        { slot: 1, sourceRange: { startUs: 200, endUs: 300 } },
      ],
      { labels: new Map([[0, "Ada"], [1, "Grace"]]) },
    ),
  ).toEqual([
    { ...words[0], speaker: { state: "overlap", slots: [0, 1] } },
    { ...words[1], speaker: { state: "attributed", slot: 0, displayName: "Ada" } },
  ]);
});
