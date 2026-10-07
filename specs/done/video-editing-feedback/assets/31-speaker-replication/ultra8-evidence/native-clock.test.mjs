import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceTurns } from "./native-clock.mjs";
test("fixed onset/offset interpretation preserves native80ms sample-clock boundaries", () => {
  assert.deepEqual(sourceTurns([[0.5], [0.8], [0.1], [0.09]], 0.5, 0.1, 1280, 5120), [
    { speaker: "speaker_0", start: 0.08, end: 0.24 },
  ]);
});

test("native activity beyond physical source support refuses instead of clipping", () => {
  assert.throws(
    () => sourceTurns([[0.8], [0.8]], 0.5, 0.1, 1280, 1600),
    /exceeds physical source support/,
  );
});
