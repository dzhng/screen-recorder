import assert from "node:assert/strict";

// AAC changes samples near transients; stable tone projections measure actual mixer gain.
export function toneLevel(samples, hz, startFrame, endFrame, rate = 48000) {
  assert.ok(endFrame <= samples.length && startFrame < endFrame);
  let sine = 0,
    cosine = 0;
  for (let i = startFrame; i < endFrame; i++) {
    sine += samples[i] * Math.sin((2 * Math.PI * hz * i) / rate);
    cosine += samples[i] * Math.cos((2 * Math.PI * hz * i) / rate);
  }
  return (2 * Math.hypot(sine, cosine)) / (endFrame - startFrame);
}
export function assertTone(samples, hz, expected, second = 0) {
  const actual = toneLevel(samples, hz, second * 48000 + 4800, second * 48000 + 19200);
  assert.ok(
    Math.abs(actual - expected) <= Math.max(0.002, expected * 0.03),
    `Tone ${hz}Hz: ${actual}, expected ${expected} (3% or .002 AAC tolerance)`,
  );
  return actual;
}
export function assertImpulse(samples, atFrame, minimumPeak = 0.25) {
  const radius = 144; // Search 3 ms for AAC transient spreading; movement is separately capped.
  let peak = 0,
    frame = -1;
  for (let i = atFrame - radius; i <= atFrame + radius; i++) {
    if (Math.abs(samples[i]) > peak) {
      peak = Math.abs(samples[i]);
      frame = i;
    }
  }
  assert.ok(
    peak > minimumPeak && Math.abs(frame - atFrame) <= 2,
    `Impulse ${atFrame}: peak ${peak} at ${frame}`,
  );
  return { expectedFrame: atFrame, frame, peak };
}
export function rmsDifference(a, b, start = 0, end = Math.min(a.length, b.length)) {
  assert.ok(end > start && end <= a.length && end <= b.length);
  let sum = 0;
  for (let i = start; i < end; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / (end - start));
}

/** These corpus tracks are mono; the declared stereo rendition must duplicate both channels. */
export function duplicatedMono(interleaved) {
  assert.ok(interleaved.length > 0 && interleaved.length % 2 === 0);
  const left = new Float32Array(interleaved.length / 2);
  let squared = 0;
  for (let i = 0; i < left.length; i++) {
    left[i] = interleaved[2 * i];
    squared += (left[i] - interleaved[2 * i + 1]) ** 2;
  }
  const difference = Math.sqrt(squared / left.length);
  assert.ok(difference < 1e-6, `Mono-to-stereo channel RMS mismatch ${difference}`);
  return { left, difference };
}
