import assert from "node:assert/strict";
import test from "node:test";
import { signalSupport, tonePitch, requirePitchAcceptance } from "./stretch-measurements.mjs";

function tone(hz, frames) {
  const bytes = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++)
    bytes.writeFloatLE(0.2 * Math.sin((2 * Math.PI * hz * i) / 48000), i * 4);
  return bytes;
}
test("support includes weak signal beyond a latency-sized neighborhood", () => {
  const bytes = Buffer.alloc(9000 * 4);
  bytes.writeFloatLE(0.8, 0);
  bytes.writeFloatLE(0.00003, 5595 * 4);
  assert.deepEqual(signalSupport(bytes, { nominal: 0 }), {
    nominal: 0,
    threshold: 1e-7,
    scannedRange: { startFrame: 0, endFrame: 9000 },
    firstAboveThreshold: 0,
    lastAboveThreshold: 5595,
    aboveThresholdSamples: 2,
    peak: bytes.readFloatLE(0),
    peakFrame: 0,
    offsetFrames: 0,
  });
});
test("support includes diagnostic pre-roll and tail in their declared coordinate system", () => {
  const bytes = Buffer.alloc(10000 * 4);
  bytes.writeFloatLE(0.00003, 800 * 4);
  bytes.writeFloatLE(0.8, 9999 * 4);
  const result = signalSupport(bytes, { nominal: 7119, offset: 2880 });
  assert.deepEqual(result.scannedRange, { startFrame: -2880, endFrame: 7120 });
  assert.equal(result.firstAboveThreshold, -2080);
  assert.equal(result.lastAboveThreshold, 7119);
  assert.equal(result.offsetFrames, 0);
  assert.equal(signalSupport(Buffer.alloc(8)).peakFrame, null);
});
test("short measured tone passes the unchanged less-than-one-percent gate", () => {
  const measured = tonePitch(tone(1000, 480), 1000);
  assert.equal(measured.status, "measured");
  requirePitchAcceptance(measured, "10ms");
});
test("octave error cannot pass a pitch acceptance claim", () => {
  const measured = tonePitch(tone(2000, 480), 1000);
  assert.equal(measured.status, "measured");
  assert.throws(() => requirePitchAcceptance(measured, "octave"), /pitch error .* must be <1%/);
});
test("an unavailable estimate is explicit and cannot pass pitch acceptance", () => {
  const measured = tonePitch(Buffer.alloc(480 * 4), 1000);
  assert.equal(measured.status, "unavailable");
  assert.equal(measured.crossingCount, 0);
  assert.equal("hz" in measured, false);
  assert.throws(() => requirePitchAcceptance(measured, "silent"), /pitch estimate unavailable/);
});
