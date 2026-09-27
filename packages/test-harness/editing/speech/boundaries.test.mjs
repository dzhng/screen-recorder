import assert from "node:assert/strict";
import test from "node:test";
import { scoreBoundaries } from "./boundaries.mjs";

test("independent marks, not the candidate timing, own the error and clipping direction", () => {
  const marks = [{ id: "w0", text: "uh", side: "end", reportedUs: 1_000_000, markedOffsetMs: 100 }];
  const result = scoreBoundaries(marks, [
    { text: "uh", sourceRange: { startUs: 600_000, endUs: 1_000_000 } },
  ]);
  assert.equal(result.medianErrorMs, 100);
  assert.equal(result.boundaries[0].insideSpeech, true);
  assert.equal(result.boundaries[0].referenceUs, 1_100_000);
  assert.equal(result.boundaries[0].errorMs, -100);
});

test("missing or ambiguous matches keep the gate open instead of improving its scored subset", () => {
  const marks = [
    { id: "w0", text: "return", side: "start", reportedUs: 1_000_000, markedOffsetMs: 0 },
  ];
  const word = { text: "return", sourceRange: { startUs: 1_000_000, endUs: 1_400_000 } };
  for (const words of [[], [word, word]]) {
    const result = scoreBoundaries(marks, words);
    assert.equal(result.meetsTiming, false);
    assert.equal(result.medianErrorMs, null);
    assert.equal(result.matched, 0);
  }
});

test("an unmarked edge is not fabricated from the transcript and a moved candidate worsens error", () => {
  const marks = [
    { id: "w0", text: "word", side: "start", reportedUs: 1_000_000, markedOffsetMs: 0 },
    { id: "w1", text: "unmarked", side: "end", reportedUs: 2_000_000, markedOffsetMs: null },
  ];
  const result = scoreBoundaries(marks, [
    { text: "word", sourceRange: { startUs: 1_400_000, endUs: 1_800_000 } },
  ]);
  assert.equal(result.unmarked, 1);
  assert.equal(result.marked, 1);
  assert.equal(result.medianErrorMs, 400);
  assert.equal(result.meetsTiming, false);
});
