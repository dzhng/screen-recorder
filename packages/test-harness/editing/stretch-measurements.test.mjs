import assert from "node:assert/strict";
import test from "node:test";
import { tonePitch } from "./stretch-measurements.mjs";

function tone(hz, frames) {
  const bytes = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++)
    bytes.writeFloatLE(0.2 * Math.sin((2 * Math.PI * hz * i) / 48000), i * 4);
  return bytes;
}

test("short measured tones distinguish a preserved pitch from an octave error", () => {
  const measured = tonePitch(tone(1000, 480), 1000);
  assert.equal(measured.status, "measured");
  assert.ok(measured.errorPercent < 1);
  const octave = tonePitch(tone(2000, 480), 1000);
  assert.equal(octave.status, "measured");
  assert.ok(octave.errorPercent > 99);
});

test("an unavailable estimate is explicit", () => {
  const measured = tonePitch(Buffer.alloc(480 * 4), 1000);
  assert.equal(measured.status, "unavailable");
  assert.equal(measured.crossingCount, 0);
  assert.equal("hz" in measured, false);
});
