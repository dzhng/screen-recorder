import assert from "node:assert/strict";
import test from "node:test";
import { blendPixel } from "./blend-reference.mjs";

test("partial-alpha multiply includes uncovered source and backdrop in premultiplied linear light", () => {
  // Source straight .8 at alpha .5, backdrop straight .4 at alpha .75.
  const result = blendPixel([0.4, 0.4, 0.4, 0.5], [0.3, 0.3, 0.3, 0.75], "multiply");
  for (const channel of result.slice(0, 3)) assert.ok(Math.abs(channel - 0.37) < 1e-12);
  assert.equal(result[3], 0.875);
});

test("soft-light keeps source/backdrop order and both branches of its light response", () => {
  blendPixel([0.25, 0.75, 0.75, 1], [0.2, 0.2, 0.64, 1], "soft-light").forEach((value, i) =>
    assert.ok(Math.abs(value - [0.12, 0.324, 0.72, 1][i]) < 1e-12),
  );
  assert.notDeepEqual(
    blendPixel([0.2, 0.2, 0.64, 1], [0.25, 0.75, 0.75, 1], "soft-light"),
    [0.12, 0.324, 0.72, 1],
  );
});

test("transparent source is identity and screen/multiply neutral patches stay neutral", () => {
  const below = [0.2, 0.3, 0.4, 0.5];
  for (const mode of ["normal", "multiply", "screen", "soft-light"])
    assert.deepEqual(blendPixel([0, 0, 0, 0], below, mode), below);
  assert.deepEqual(blendPixel([1, 1, 1, 1], [0.2, 0.3, 0.4, 1], "multiply"), [0.2, 0.3, 0.4, 1]);
  assert.deepEqual(blendPixel([0, 0, 0, 1], [0.2, 0.3, 0.4, 1], "screen"), [0.2, 0.3, 0.4, 1]);
});
