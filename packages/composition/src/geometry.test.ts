import assert from "node:assert/strict";
import { test } from "vitest";
import { compileGeometry, type PicturePrimitive } from "./geometry.js";

function point(ops: PicturePrimitive[], x: number, y: number) {
  for (const op of ops)
    if (op.kind === "affine") {
      const [a, b, c, d, tx, ty] = op.matrix;
      [x, y] = [a * x + c * y + tx, b * x + d * y + ty];
    }
  return [x, y].map((n) => Math.round(n * 1e9) / 1e9);
}
test("contain centers asymmetric source and preserves identity-sized pixels", () => {
  const contained = compileGeometry(
    { width: 100, height: 50 },
    { width: 200, height: 200 },
    { type: "geometry" },
  );
  assert.deepEqual(point(contained, 0, 50), [0, 150]);
  assert.deepEqual(point(contained, 100, 0), [200, 50]);
  assert.deepEqual(
    point(
      compileGeometry({ width: 83, height: 47 }, { width: 83, height: 47 }, { type: "geometry" }),
      17,
      31,
    ),
    [17, 31],
  );
});
test("crop then stretch then clockwise pivot rotation and placement has one position control", () => {
  const ops = compileGeometry(
    { width: 100, height: 80 },
    { width: 200, height: 200 },
    {
      type: "geometry",
      crop: { x: 10, y: 20, width: 40, height: 20 },
      rect: { x: 30, y: 40, width: 80, height: 60 },
      fit: "stretch",
      rotationDeg: 90,
      pivot: { x: 0, y: 0 },
    },
  );
  assert.deepEqual(ops[0], { kind: "clamp", x: 10.5, y: 40.5, width: 39, height: 19 });
  assert.deepEqual(point(ops, 10, 60), [30, 160]);
  assert.deepEqual(point(ops, 50, 40), [-30, 80]);
});
test("cover clips the fitted local rectangle before rotating; scale may mirror or collapse", () => {
  const ops = compileGeometry(
    { width: 100, height: 50 },
    { width: 200, height: 200 },
    {
      type: "geometry",
      rect: { x: 20, y: 30, width: 40, height: 40 },
      fit: "cover",
      rotationDeg: 90,
    },
  );
  const coverage = ops.at(-1)!;
  assert.equal(coverage.kind, "coverage");
  if (coverage.kind === "coverage")
    assert.deepEqual(
      coverage.points.map(({ x, y }) => [Math.round(x), Math.round(y)]),
      [
        [20, 170],
        [20, 130],
        [60, 130],
        [60, 170],
      ],
    );
  assert.deepEqual(point(ops, 50, 25), [40, 150]);
  const mirrored = compileGeometry(
    { width: 100, height: 100 },
    { width: 100, height: 100 },
    { type: "geometry", scale: { x: -1, y: 0 } },
  );
  assert.deepEqual(point(mirrored, 10, 20), [90, 50]);
});
