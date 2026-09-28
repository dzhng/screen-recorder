import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sourceSurface,
  geometrySurface,
  background,
  opacitySurface,
  over,
  expectedRgba,
  compareGeometry,
} from "./layers-oracle.mjs";

test("authored quarter-turn points pin clockwise rotation and translation after pivot", () => {
  const source = sourceSurface({
    width: 2,
    height: 3,
    rgba: Buffer.from([
      255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 255, 255,
    ]),
  });
  const result = geometrySurface(
    source,
    {
      rect: { x: 4, y: 1, width: 2, height: 3 },
      fit: "stretch",
      rotationDeg: 90,
      pivot: { x: 0, y: 0 },
    },
    { width: 8, height: 8 },
  );
  assert.deepEqual(result.sample(3.5, 1.5), [1, 0, 0, 1]);
  assert.deepEqual(result.sample(1.5, 2.5), [0, 0, 1, 1]);
  assert.deepEqual(result.sample(4.5, 1.5), [0, 0, 0, 0]);
});
test("crop consumes the previous canvas and swapping two instances changes output", () => {
  const source = background({ width: 4, height: 3 }, [1, 1, 1, 1]),
    canvas = { width: 8, height: 8 };
  const place = { rect: { x: 4, y: 0, width: 4, height: 3 }, fit: "stretch" };
  const crop = {
    crop: { x: 4, y: 0, width: 4, height: 3 },
    rect: { x: 0, y: 0, width: 4, height: 3 },
    fit: "stretch",
  };
  // A bounded source makes out-of-domain crop transparent.
  const bounded = {
    ...source,
    sample: (x, y) => (x >= 0 && x < 4 && y >= 0 && y < 3 ? [1, 1, 1, 1] : [0, 0, 0, 0]),
  };
  const a = geometrySurface(geometrySurface(bounded, place, canvas), crop, canvas);
  const b = geometrySurface(geometrySurface(bounded, crop, canvas), place, canvas);
  assert.deepEqual(a.sample(0.5, 0.5), [1, 1, 1, 1]);
  assert.deepEqual(b.sample(0.5, 0.5), [0, 0, 0, 0]);
});
test("flattened parent opacity differs from distributing opacity to overlapping children", () => {
  const canvas = { width: 8, height: 8 },
    white = background(canvas, [1, 1, 1, 1]);
  const parent = opacitySurface(over(white, white), 0.5);
  const children = over(opacitySurface(white, 0.5), opacitySurface(white, 0.5));
  assert.deepEqual(parent.sample(2, 2), [0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(children.sample(2, 2), [0.75, 0.75, 0.75, 0.75]);
  assert.equal(expectedRgba(over(background(canvas), parent))[0], 188);
});
test("pixel oracle rejects one-pixel translation despite an unchanged flat interior", () => {
  const canvas = { width: 64, height: 48 },
    bytes = Buffer.alloc(64 * 48 * 4);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 64; x++) {
      const at = (y * 64 + x) * 4;
      bytes[at + 3] = 255;
      if (x >= 8 && x < 24 && y >= 8 && y < 40) bytes.fill(255, at, at + 3);
    }
  const expected = expectedRgba(sourceSurface({ ...canvas, rgba: bytes }));
  compareGeometry(expected, expected, 64, 48);
  const shifted = expectedRgba(
    over(
      background(canvas),
      geometrySurface(
        sourceSurface({ ...canvas, rgba: bytes }),
        { rect: { x: 1, y: 0, ...canvas }, fit: "stretch" },
        canvas,
      ),
    ),
  );
  assert.throws(() => compareGeometry(shifted, expected, 64, 48), /centroid shifted/);
});

test("output crops cannot invent background beyond the fixed canvas", () => {
  const canvas = { width: 8, height: 8 },
    surface = background(canvas);
  assert.deepEqual(surface.sample(-1, 0), [0, 0, 0, 0]);
  const cropped = geometrySurface(surface, { crop: { x: 8, y: 0, width: 8, height: 8 } }, canvas);
  assert.deepEqual(cropped.sample(2, 2), [0, 0, 0, 0]);
});
test("premultiplied sRGB inputs are unpremultiplied before linear conversion", () => {
  const alpha = 128 / 255;
  const surface = sourceSurface({ width: 1, height: 1, rgba: Buffer.from([128, 128, 128, 128]) });
  assert.deepEqual(surface.sample(0.5, 0.5), [alpha, alpha, alpha, alpha]);
  assert.deepEqual(expectedRgba(surface), Buffer.from([128, 128, 128, 128]));
});
test("losing a thin outline cannot pass merely by retaining its four corners", () => {
  const expected = Buffer.alloc(64 * 48 * 4),
    lost = Buffer.alloc(expected.length);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 64; x++) {
      const at = (y * 64 + x) * 4;
      expected[at + 3] = 255;
      lost[at + 3] = 255;
      if (
        ((x === 12 || x === 51) && y >= 12 && y <= 35) ||
        ((y === 12 || y === 35) && x >= 12 && x <= 51)
      )
        expected.fill(255, at, at + 3);
      if ((x === 12 || x === 51) && (y === 12 || y === 35)) lost.fill(255, at, at + 3);
    }
  compareGeometry(expected, expected, 64, 48);
  assert.throws(() => compareGeometry(lost, expected, 64, 48), /coverage (missing|count)/);
});

test("thin landmark density and every color channel are checked", () => {
  const expected = Buffer.alloc(64 * 48 * 4),
    sparse = Buffer.alloc(expected.length),
    red = Buffer.alloc(expected.length);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 64; x++) {
      const at = (y * 64 + x) * 4;
      expected[at + 3] = sparse[at + 3] = red[at + 3] = 255;
      if (
        ((x === 12 || x === 51) && y >= 12 && y <= 35) ||
        ((y === 12 || y === 35) && x >= 12 && x <= 51)
      ) {
        expected.fill(255, at, at + 3);
        red[at] = 255;
        if ((x + y) % 2 === 0) sparse.fill(255, at, at + 3);
      }
    }
  assert.throws(() => compareGeometry(sparse, expected, 64, 48), /coverage count/);
  assert.throws(() => compareGeometry(red, expected, 64, 48), /added or lost a landmark/);
});
test("uniform canvas border pixels cannot disappear behind the interpolation allowance", () => {
  const expected = Buffer.alloc(64 * 48 * 4, 255),
    borderless = Buffer.from(expected);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 64; x++)
      if (x === 0 || x === 63 || y === 0 || y === 47)
        borderless.fill(0, (y * 64 + x) * 4, (y * 64 + x + 1) * 4);
  assert.throws(() => compareGeometry(borderless, expected, 64, 48), /Interior pixel/);
});

test("opaque full-domain crop keeps full alpha when destination pixel footprints are inside", () => {
  const source = sourceSurface({
    width: 2,
    height: 2,
    rgba: Buffer.alloc(16, 255),
    encodedProfile: "srgb",
  });
  const canvas = { width: 16, height: 16 };
  const image = geometrySurface(source, { crop: { x: 0, y: 0, width: 2, height: 2 } }, canvas);
  assert.deepEqual(image.sample(0.5, 0.5), [1, 1, 1, 1]);
  assert.deepEqual(image.sample(15.5, 15.5), [1, 1, 1, 1]);
  const shifted = geometrySurface(
    source,
    { rect: { x: 0.25, y: 0.25, width: 16, height: 16 } },
    canvas,
  );
  assert.deepEqual(shifted.sample(0.5, 0.5), [0.5625, 0.5625, 0.5625, 0.5625]);
});

test("crop clamps encoded sampling before outside poison can enter a scaled pixel", () => {
  const bytes = Buffer.from([255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
  const source = sourceSurface({
    width: 4,
    height: 1,
    rgba: bytes,
    encodedProfile: "corevideo709",
  });
  const canvas = { width: 16, height: 8 };
  const picture = expectedRgba(
    geometrySurface(source, { crop: { x: 1, y: 0, width: 2, height: 1 } }, canvas),
  );
  for (let i = 0; i < picture.length; i += 4)
    assert.deepEqual([...picture.subarray(i, i + 4)], [0, 0, 0, 255]);
});
