import assert from "node:assert/strict";

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
