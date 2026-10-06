import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  blendPixel,
  compareBlendRaster,
  verifyBlendMovieSupport,
  selectBlendCases,
  verifyBlendReferenceIdentity,
} from "./blend-reference.mjs";

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

test("raster verification refuses a delivered channel outside the declared arithmetic limit", () => {
  const expected = Buffer.from([20, 80, 140, 255, 40, 60, 90, 255]);
  const actual = Buffer.from(expected);
  actual[2] += 3;
  assert.throws(
    () => compareBlendRaster(actual, expected, { width: 2, height: 1, limit: 2 }),
    /maximum 3 exceeds 2/,
  );
  actual[2] -= 2;
  assert.equal(compareBlendRaster(actual, expected, { width: 2, height: 1, limit: 2 }).maximum, 1);
});

test("raster verification cannot certify only the matching prefix of an oversized image", () => {
  const expected = Buffer.from([20, 80, 140, 255]);
  assert.throws(
    () =>
      compareBlendRaster(Buffer.concat([expected, Buffer.from([0, 0, 0, 255])]), expected, {
        width: 1,
        height: 1,
        limit: 2,
      }),
    /raster size/,
  );
});

test("movie verification refuses wrong terminal support even when both requested pictures exist", () => {
  const clock = (value) => ({ value: String(value), timescale: 1000000 });
  const support = {
    segments: [{ ordinal: 0, empty: false, targetStart: clock(0), targetDuration: clock(200000) }],
    samples: [
      { segment: 0, start: clock(0), end: clock(100000) },
      { segment: 0, start: clock(100000), end: clock(200000) },
    ],
  };
  verifyBlendMovieSupport(support);
  const bad = structuredClone(support);
  bad.segments[0].targetDuration = clock(250000);
  bad.samples[1].end = clock(250000);
  assert.throws(() => verifyBlendMovieSupport(bad), /duration|end/);
});

test("default blend verification refuses omitted or duplicated retained cases", async () => {
  const { cases } = JSON.parse(
    await readFile(
      new URL(
        "../../../specs/video-editing-feedback/assets/24-blend-sheet/report.json",
        import.meta.url,
      ),
    ),
  );
  assert.throws(() => selectBlendCases(cases.slice(1)), /complete/);
  assert.throws(() => selectBlendCases([...cases.slice(0, -1), cases[0]]), /complete/);
  assert.equal(selectBlendCases(cases, "multiply")[0].scenario, "multiply");
});

test("regenerated blend references must keep their frozen independent identity", async () => {
  const { cases } = JSON.parse(
    await readFile(
      new URL(
        "../../../specs/video-editing-feedback/assets/24-blend-sheet/report.json",
        import.meta.url,
      ),
    ),
  );
  const item = cases.find((item) => item.scenario === "multiply");
  verifyBlendReferenceIdentity(item.scenario, item.artifacts["reference.png"], cases);
  assert.throws(
    () => verifyBlendReferenceIdentity(item.scenario, "0".repeat(64), cases),
    /independent reference identity/,
  );
});
