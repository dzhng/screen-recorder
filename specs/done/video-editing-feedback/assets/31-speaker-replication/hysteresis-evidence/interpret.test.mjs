import assert from "node:assert/strict";
import { test } from "node:test";
import { interpret } from "./interpret.mjs";

test("hysteresis retains only established turns through weak scores and strict equality", () => {
  const matrix = [
    [0.5, 0.2],
    [0.6, 0.2],
    [0.3, 0.2],
    [0.1, 0.2],
    [0.09, 0.2],
    [0.5, 0.2],
    [0.6, 0.2],
    [0.2, 0.2],
  ];
  assert.deepEqual(interpret(matrix, 0.5, 0.1), [
    { speaker: "speaker_0", start: 0.01, end: 0.04 },
    { speaker: "speaker_0", start: 0.06, end: 0.08 },
  ]);
});
