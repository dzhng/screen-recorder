import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, openSync, closeSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
const native =
  process.env.YAP_NATIVE ??
  new URL("../.build/debug/yap-native", import.meta.url).pathname;
const ffmpeg = process.env.YAP_FFMPEG ?? "ffmpeg";
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 30000, ...options });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function probe(path, inspectAudioStreamId, descriptors = []) {
  return JSON.parse(
    run(native, [], {
      input:
        JSON.stringify({
          id: "decoded-audio",
          operation: "media.probe",
          params: { path, ...(inspectAudioStreamId ? { inspectAudioStreamId } : {}) },
        }) + "\n",
      stdio: ["pipe", "pipe", "pipe", ...descriptors],
    }),
  );
}
test("fresh retained decoded audio preserves actual native-rate frames rather than packet capacity", () => {
  const directory = mkdtempSync(join(tmpdir(), "decoded-audio-"));
  let passed = false;
  try {
    const raw = Buffer.alloc(6000 * 2 * 4);
    for (let frame = 0; frame < 6000; frame++) {
      raw.writeFloatLE(((frame % 31) - 15) / 32, frame * 8);
      raw.writeFloatLE(((frame % 23) - 11) / 32, frame * 8 + 4);
    }
    const rawPath = join(directory, "original.f32"),
      source = join(directory, "source.mov");
    writeFileSync(rawPath, raw);
    run(ffmpeg, [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-i",
      rawPath,
      "-c:a",
      "pcm_f32le",
      "-movie_timescale",
      "48000",
      source,
    ]);
    const ordinary = probe(source);
    writeFileSync(join(directory, "ordinary.json"), JSON.stringify(ordinary));
    assert.equal(ordinary.ok, true);
    assert.equal(ordinary.data.streams[0].decodedAudioInspection, undefined);
    const held = openSync(source, "r");
    try {
      renameSync(source, join(directory, "retained.mov"));
      writeFileSync(source, "replacement must not decode");
      const fresh = probe("/dev/fd/3", "track:1", [held]);
      writeFileSync(join(directory, "fresh.json"), JSON.stringify(fresh));
      assert.equal(fresh.ok, true, JSON.stringify(fresh));
      const evidence = fresh.data.streams[0].decodedAudioInspection;
      assert.ok(evidence, "native decoded support is required");
      assert.equal(evidence.frames, 6000);
      assert.equal(evidence.sampleRate, 48000);
      assert.equal(evidence.channels, 2);
      assert.equal(evidence.pcmSha256, createHash("sha256").update(raw).digest("hex"));
      assert.deepEqual(evidence.runs, [{ startUs: 0, endUs: 125000, frames: 6000 }]);
    } finally {
      closeSync(held);
    }
    passed = true;
  } finally {
    if (passed) rmSync(directory, { recursive: true, force: true });
    else process.stderr.write(`Unverified decoded-audio operands retained at ${directory}\n`);
  }
});

test("AAC inspection observes decoder-applied priming and final trim without changing copied sound", () => {
  const directory = mkdtempSync(join(tmpdir(), "decoded-aac-"));
  let passed = false;
  try {
    const raw = Buffer.alloc(6000 * 4);
    for (let frame = 0; frame < 6000; frame++) raw.writeFloatLE(((frame % 17) - 8) / 32, frame * 4);
    const rawPath = join(directory, "original.f32"),
      source = join(directory, "source.mov"),
      copied = join(directory, "copied.mov");
    writeFileSync(rawPath, raw);
    run(ffmpeg, [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-i",
      rawPath,
      "-c:a",
      "aac",
      "-movie_timescale",
      "48000",
      source,
    ]);
    run(ffmpeg, [
      "-v",
      "error",
      "-i",
      source,
      "-map",
      "0:a:0",
      "-c:a",
      "copy",
      "-movie_timescale",
      "48000",
      copied,
    ]);
    const first = probe(source, "track:1"),
      second = probe(copied, "track:1");
    writeFileSync(join(directory, "compared.json"), JSON.stringify({ first, second }));
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(second.ok, true, JSON.stringify(second));
    const original = first.data.streams[0].decodedAudioInspection,
      output = second.data.streams[0].decodedAudioInspection;
    assert.ok(original, "decoded source facts are required");
    assert.equal(original.frames, 6000);
    assert.equal(original.trimming, "decoder-output-attachment-free");
    assert.deepEqual(original.runs, [{ startUs: 0, endUs: 125000, frames: 6000 }]);
    assert.deepEqual(output, original);
    assert.notEqual(
      original.pcmSha256,
      createHash("sha256").update(raw).digest("hex"),
      "lossy AAC is not authored PCM identity",
    );
    passed = true;
  } finally {
    if (passed) rmSync(directory, { recursive: true, force: true });
    else process.stderr.write(`Unverified decoded-audio operands retained at ${directory}\n`);
  }
});

test("decoded inspection requires the selected stream and rejects unqualified multichannel output", () => {
  const directory = mkdtempSync(join(tmpdir(), "decoded-selected-"));
  let passed = false;
  try {
    const rawPath = join(directory, "source.f32");
    writeFileSync(rawPath, Buffer.alloc(6000 * 4));
    const selected = join(directory, "selected.mov");
    run(ffmpeg, [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-i",
      rawPath,
      "-f",
      "f32le",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-i",
      rawPath,
      "-map",
      "0:a:0",
      "-map",
      "1:a:0",
      "-c:a",
      "pcm_f32le",
      "-movie_timescale",
      "7056000",
      selected,
    ]);
    const inspected = probe(selected, "track:2");
    writeFileSync(join(directory, "selected.json"), JSON.stringify(inspected));
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.data.streams[0].decodedAudioInspection, undefined);
    assert.equal(inspected.data.streams[1].decodedAudioInspection.frames, 6000);
    assert.equal(inspected.data.streams[1].decodedAudioInspection.sampleRate, 48000);
    assert.equal(probe(selected, "track:9").error.code, "UNSUPPORTED_MEDIA");
    const multichannel = join(directory, "multichannel.mov");
    run(ffmpeg, [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      "48000",
      "-ac",
      "3",
      "-i",
      rawPath,
      "-c:a",
      "pcm_f32le",
      "-movie_timescale",
      "48000",
      multichannel,
    ]);
    const refused = probe(multichannel, "track:1");
    writeFileSync(join(directory, "refused.json"), JSON.stringify(refused));
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "UNSUPPORTED_MEDIA");
    passed = true;
  } finally {
    if (passed) rmSync(directory, { recursive: true, force: true });
    else process.stderr.write(`Unverified decoded-audio operands retained at ${directory}\n`);
  }
});

test("an explicit audio selector cannot succeed on a still image", () => {
  const directory = mkdtempSync(join(tmpdir(), "decoded-image-"));
  let passed = false;
  try {
    const source = join(directory, "still.png");
    run(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=16x16",
      "-frames:v",
      "1",
      source,
    ]);
    const ordinary = probe(source);
    const selected = probe(source, "track:1");
    writeFileSync(join(directory, "operands.json"), JSON.stringify({ ordinary, selected }));
    assert.equal(ordinary.ok, true);
    assert.equal(ordinary.data.streams[0].kind, "image");
    assert.equal(selected.ok, false);
    assert.equal(selected.error.code, "UNSUPPORTED_MEDIA");
    passed = true;
  } finally {
    if (passed) rmSync(directory, { recursive: true, force: true });
    else process.stderr.write(`Unverified decoded-audio operands retained at ${directory}\n`);
  }
});
