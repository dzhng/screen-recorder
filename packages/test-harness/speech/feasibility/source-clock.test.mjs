import assert from "node:assert/strict";
import test from "node:test";
import { mapPaddedSource } from "./source-clock.mjs";

test("keeps original endpoints inside support and accounts for only zero-padded tail", () => {
  const raw = [
    { speaker: "A", start: 0.125, end: 2.75 },
    { speaker: "B", start: 2.5, end: 3.5 },
    { speaker: "C", start: 3.25, end: 3.75 },
  ];
  const actual = mapPaddedSource(raw, {
    sourceFrameCount: 3,
    sampleRate: 1,
    windowSamples: 2,
    stepSamples: 2,
    outputFramesPerWindow: 2,
  });
  assert.deepEqual(actual.segments, [raw[0], { speaker: "B", start: 2.5, end: 3 }]);
  assert.deepEqual(actual.excludedPadding, [
    { index: 1, speaker: "B", start: 3, end: 3.5 },
    { index: 2, speaker: "C", start: 3.25, end: 3.75 },
  ]);
  assert.deepEqual(raw, [
    { speaker: "A", start: 0.125, end: 2.75 },
    { speaker: "B", start: 2.5, end: 3.5 },
    { speaker: "C", start: 3.25, end: 3.75 },
  ]);
});

test("rejects intervals outside the proved padded analysis extent rather than concealing them", () => {
  const proof = {
    sourceFrameCount: 3,
    sampleRate: 1,
    windowSamples: 2,
    stepSamples: 2,
    outputFramesPerWindow: 2,
  };
  for (const segment of [
    { speaker: "A", start: 2, end: 4.01 },
    { speaker: "A", start: -0.1, end: 1 },
    { speaker: "A", start: 1, end: Infinity },
    { speaker: "A", start: 2, end: 1 },
  ]) {
    assert.throws(() => mapPaddedSource([segment], proof), /outside proven analysis support/);
  }
});
