import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sample, waveHeader } from "./audio-project-fixture.mjs";

const expectedAudioSha256 =
  "6a469e107deea5b9c1571400b2d6570416389c10d33e3831627fa0381aa04fed";
const sampleTimesUs = [100000, 500000, 900000];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Replay the retained native audio-transition receipt without starting a
 * service or recomputing a native render. The original run is the public
 * import/edit/audio.get journey; this checker protects its delivered PCM
 * artifact and independent two-source crossfade oracle.
 */
export async function replayTransitionAudio({ reportPath, audioPath }) {
  assert.ok(typeof reportPath === "string" && reportPath, "reportPath is required");
  assert.ok(typeof audioPath === "string" && audioPath, "audioPath is required");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(report.passed, true, "transition delivery did not pass");
  assert.ok(
    report.checks?.includes("native audio crossfade delivery matches the independent two-source PCM oracle"),
    "native audio transition acceptance check is missing",
  );
  assert.equal(report.recipe?.kind, "crossfade", "retained recipe changed");
  assert.equal(report.recipe?.mediaKind, "video", "retained picture control changed");
  assert.deepEqual(report.recipe?.transitionRange, { startUs: 250000, endUs: 750000 });

  const audio = report.audio;
  assert.ok(audio, "retained audio receipt is missing");
  const receipt = audio.receipt;
  assert.equal(receipt.implementationId, "native-composition-audio-v10");
  assert.equal(receipt.mediaType, "audio/wav");
  assert.equal(receipt.sampleRate, 48000);
  assert.equal(receipt.channels, 2);
  assert.equal(receipt.frames, 48000);
  assert.deepEqual(receipt.range, { startUs: 0, endUs: 1000000 });
  assert.deepEqual(audio.sourceFrames, 48000);

  const bytes = await readFile(audioPath);
  assert.equal(bytes.length, 388096, "retained WAV byte count changed");
  const audioSha256 = digest(bytes);
  assert.equal(audioSha256, expectedAudioSha256, "retained WAV bytes changed");
  const header = waveHeader(bytes, bytes.length);
  assert.equal(header.frames, 48000);
  const pcm = bytes.subarray(header.offset);
  const samples = [];
  for (const atUs of sampleTimesUs) {
    const frame = Math.floor((atUs * 48000) / 1000000);
    const offset = frame * 8;
    const actual = [pcm.readFloatLE(offset), pcm.readFloatLE(offset + 4)];
    const phase = Math.min(1, Math.max(0, (atUs - 250000) / 500000));
    const expected = [0, 1].map((channel) =>
      Math.fround(
        phase === 0 || phase === 1
          ? sample(0, frame, channel) / 32768 + sample(1, frame, channel) / 32768
          : Math.fround((sample(0, frame, channel) / 32768) * Math.fround(1 - phase)) +
              Math.fround((sample(1, frame, channel) / 32768) * Math.fround(phase)),
      ),
    );
    actual.forEach((value, channel) =>
      assert.ok(
        Math.abs(value - expected[channel]) < 1 / 32768,
        `audio sample ${atUs} channel ${channel} changed`,
      ),
    );
    assert.deepEqual(
      audio.samples?.[String(atUs)]?.expected,
      expected,
      `audio sample ${atUs} oracle changed`,
    );
    samples.push({ atUs, frame, actual, expected });
  }
  return {
    kind: "delivered-audio-transition",
    implementationId: receipt.implementationId,
    sampleFrames: samples.map(({ frame }) => frame),
    audioSha256,
    frames: header.frames,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2] && process.argv[3], "Usage: node transition-audio-replay.mjs <report.json> <audio.wav>");
  console.log(
    JSON.stringify(
      await replayTransitionAudio({ reportPath: process.argv[2], audioPath: process.argv[3] }),
    ),
  );
}
