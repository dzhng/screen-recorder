import assert from "node:assert/strict";

// Independent W3C Compositing and Blending Level 1 (§10.3) arithmetic.
// Operands/results are premultiplied linear-sRGB. No product renderer is imported.
export function blendPixel(source, backdrop, mode) {
  const sa = source[3],
    ba = backdrop[3];
  function channel(s, b) {
    switch (mode) {
      case "normal":
        return s;
      case "multiply":
        return b * s;
      case "screen":
        return b + s - b * s;
      case "soft-light": {
        const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
        return s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (d - b);
      }
      default:
        throw new Error(`Unknown reference blend mode ${mode}`);
    }
  }
  return source
    .slice(0, 3)
    .map(
      (s, i) =>
        (1 - sa) * backdrop[i] +
        (1 - ba) * s +
        sa * ba * channel(sa ? s / sa : 0, ba ? backdrop[i] / ba : 0),
    )
    .concat(sa + ba * (1 - sa));
}

export function compareBlendRaster(actual, expected, { width, height, limit, interior = false }) {
  assert.equal(
    actual.length,
    width * height * 4,
    "Actual raster size must match the authored canvas",
  );
  assert.equal(
    expected.length,
    actual.length,
    "Reference raster size must match the authored canvas",
  );
  let maximum = 0,
    sum = 0,
    count = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      // Codec comparisons exclude 2px around authored patch boundaries, where 4:2:0 mixes unlike colors.
      if (interior && (x % 16 < 2 || x % 16 > 13 || y % 16 < 2 || y % 16 > 13)) continue;
      for (let c = 0; c < 4; c++) {
        const at = (y * width + x) * 4 + c,
          error = Math.abs(actual[at] - expected[at]);
        maximum = Math.max(maximum, error);
        sum += error;
        count++;
      }
    }
  assert.ok(maximum <= limit, `RGBA maximum ${maximum} exceeds ${limit}`);
  assert.ok(count > 0, "Raster mask must cover at least one sample");
  return { maximum, mae: sum / count, samples: count, limit, interior };
}

// Independent observer reports native rational clocks; never compare rounded timestamps.
export function verifyBlendMovieSupport({ segments, samples }) {
  function at(clock, expectedUs, label) {
    assert.ok(Number.isInteger(clock.timescale) && clock.timescale > 0, `${label} timescale`);
    assert.equal(
      BigInt(clock.value) * 1000000n,
      BigInt(expectedUs) * BigInt(clock.timescale),
      label,
    );
  }
  assert.equal(segments.length, 1, "Exactly one authored support segment");
  assert.equal(segments[0].empty, false, "Authored support cannot be empty");
  at(segments[0].targetStart, 0, "segment start");
  at(segments[0].targetDuration, 200000, "segment duration");
  assert.equal(samples.length, 2, "Exactly two 10fps sample spans");
  samples.forEach((sample, i) => {
    assert.equal(sample.segment, segments[0].ordinal, "Sample belongs to authored support");
    at(sample.start, i * 100000, "sample start");
    at(sample.end, (i + 1) * 100000, "sample end");
  });
}
