import assert from "node:assert/strict";
import test from "node:test";
import { patchOccupancy, occupancyCounts } from "./bins.mjs";
test("nearest documented patch centers map to physical100ms bins without neighbor-max dilation", () => {
  const rows = [[0.9], [0.1], [0.9], [0.1]];
  const result = patchOccupancy(rows, 0, 0.5, 32000, {
    sampleRate: 16000,
    patchWindowSourceSamples: 15600,
    patchHopSamples: 7680,
  });
  assert.deepEqual(
    result.map((value, index) => (value === true ? index : null)).filter((value) => value !== null),
    [0, 1, 2, 3, 4, 5, 6, 12, 13, 14, 15, 16],
  );
});

test("unknown positive bins remain misses, class negatives and abstentions retain denominators", () => {
  assert.deepEqual(occupancyCounts([0, 2], [true, true, null, false, null]), {
    tp: 1,
    fp: 1,
    fn: 1,
    tn: 2,
    unknownPositive: 1,
    unknownNegative: 1,
    positiveBins: 2,
    negativeBins: 3,
    predictedPositiveBins: 2,
    precision: 0.5,
    recall: 0.5,
  });
});
