import assert from "node:assert/strict";

/** Entire admitted output, including diagnostic pre-roll/tail when offset is supplied. */
export function signalSupport(bytes, { nominal = null, offset = 0, threshold = 1e-7 } = {}) {
  let first = null,
    last = null,
    aboveThreshold = 0,
    peak = 0,
    peakFrame = null;
  for (let i = 0; i < bytes.length / 4; i++) {
    const value = Math.abs(bytes.readFloatLE(i * 4));
    assert.ok(Number.isFinite(value), "Nonfinite signal sample");
    if (value > threshold) {
      first ??= i - offset;
      last = i - offset;
      aboveThreshold++;
    }
    if (value > peak) {
      peak = value;
      peakFrame = i - offset;
    }
  }
  return {
    nominal,
    threshold,
    scannedRange: { startFrame: -offset || 0, endFrame: bytes.length / 4 - offset },
    firstAboveThreshold: first,
    lastAboveThreshold: last,
    aboveThresholdSamples: aboveThreshold,
    peak,
    peakFrame,
    offsetFrames: nominal === null || peakFrame === null ? null : peakFrame - nominal,
  };
}

/** Zero-crossing estimate on the middle half; unavailable is never an implicit pass. */
export function tonePitch(bytes, expectedHz, minimumCrossings = 3) {
  const crossings = [];
  const first = Math.floor((bytes.length / 4) * 0.25) + 1;
  const end = Math.floor((bytes.length / 4) * 0.75);
  for (let i = first; i < end; i++) {
    const previous = bytes.readFloatLE((i - 1) * 4),
      value = bytes.readFloatLE(i * 4);
    assert.ok(Number.isFinite(previous) && Number.isFinite(value), "Nonfinite tone sample");
    if (previous <= 0 && value > 0) crossings.push(i - 1 - previous / (value - previous));
  }
  const evidence = {
    expectedHz,
    crossingCount: crossings.length,
    minimumCrossings,
    measuredRange: { startFrame: first, endFrame: end },
  };
  if (crossings.length < minimumCrossings)
    return { ...evidence, status: "unavailable", reason: "Insufficient positive zero crossings" };
  const hz = ((crossings.length - 1) * 48000) / (crossings.at(-1) - crossings[0]);
  return { ...evidence, status: "measured", hz, errorPercent: Math.abs(hz / expectedHz - 1) * 100 };
}

export function requirePitchAcceptance(measurement, label) {
  assert.equal(
    measurement.status,
    "measured",
    `${label}: pitch estimate unavailable (${measurement.crossingCount} crossings)`,
  );
  assert.ok(
    measurement.errorPercent < 1,
    `${label}: pitch error ${measurement.errorPercent}% must be <1%`,
  );
}
