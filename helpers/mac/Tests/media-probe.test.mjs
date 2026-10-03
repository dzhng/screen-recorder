import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const executable =
  process.env.SCREENREC_NATIVE ??
  new URL("../.build/debug/screenrec-native", import.meta.url).pathname;
const corpus = new URL("../../../specs/done/agent-editing/assets/00-corpus/", import.meta.url);
function probe(name, extra = {}) {
  const result = spawnSync(executable, [], {
    input:
      JSON.stringify({
        id: "probe",
        operation: "media.probe",
        params: { path: new URL(name, corpus).pathname, ...extra },
      }) + "\n",
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
test("probe preserves actual video timing and independent PCM metadata", () => {
  const video = probe("a.mov");
  assert.equal(video.ok, true, JSON.stringify(video));
  const stream = video.data.streams.find((s) => s.kind === "video");
  assert.equal(stream.width, 160);
  assert.equal(stream.height, 96);
  assert.equal(stream.samples.count, 8);
  assert.equal(stream.samples.firstPtsUs, 0);
  assert.equal(stream.samples.lastPtsUs, 1750000);
  assert.equal(stream.samples.minDurationUs, 250000);
  assert.equal(stream.samples.maxDurationUs, 250000);
  assert.equal(stream.decodable, true);
  const audio = probe("a-audio.wav");
  assert.equal(audio.ok, true, JSON.stringify(audio));
  const pcm = audio.data.streams.find((s) => s.kind === "audio");
  assert.equal(pcm.sampleRate, 48000);
  assert.equal(pcm.channels, 1);
  assert.equal(pcm.endUs - pcm.startUs, 2000000);
});
test("probe reports orientation without baking it into source pixels", () => {
  const result = probe("orientation.mov");
  assert.equal(result.ok, true, JSON.stringify(result));
  const stream = result.data.streams.find((s) => s.kind === "video");
  assert.equal(stream.width, 160);
  assert.equal(stream.height, 96);
  assert.equal(stream.orientedWidth, 96);
  assert.equal(stream.orientedHeight, 160);
  assert.equal(stream.transform.length, 6);
});
test("probe rejects unknown parameters and unreadable input", () => {
  assert.equal(probe("a.mov", { unknown: true }).error.code, "INVALID_REQUEST");
  assert.equal(probe("missing.mov").ok, false);
});

test("probe keeps variable packet timing distinct from acquisition availability", () => {
  const result = probe("timestamp-gap.mov");
  assert.equal(result.ok, true, JSON.stringify(result));
  const stream = result.data.streams.find((s) => s.kind === "video");
  assert.equal(stream.samples.count, 6);
  assert.equal(stream.samples.minDurationUs, 250000);
  assert.equal(stream.samples.maxDurationUs, 750000);
  assert.equal(stream.samples.lastPtsUs, 1750000);
  assert.equal(stream.segments.filter((s) => s.empty).length, 0);
});
test("probe keeps still-image alpha and odd dimensions without inventing a duration", () => {
  const result = probe("still-alpha.png");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.data.streams, [
    {
      id: "image:0",
      kind: "image",
      codec: "public.png",
      decodable: true,
      width: 47,
      height: 31,
      orientedWidth: 47,
      orientedHeight: 31,
      orientation: 1,
      hasAlpha: true,
    },
  ]);
});

test("probe normalizes one shared asset clock while retaining stream offsets", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-probe-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "offset.mov");
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-itsoffset",
      "0.25",
      "-i",
      new URL("a-audio.wav", corpus).pathname,
      "-i",
      new URL("video-only.mov", corpus).pathname,
      "-map",
      "1:v:0",
      "-map",
      "0:a:0",
      "-c",
      "copy",
      path,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(encoded.status, 0, encoded.stderr);
  const result = probe(pathToFileURL(path).href);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.originUs, 0);
  const video = result.data.streams.find((s) => s.kind === "video");
  const audio = result.data.streams.find((s) => s.kind === "audio");
  assert.equal(video.startUs, 0);
  assert.equal(video.endUs, 2000000);
  assert.equal(audio.startUs, 250000);
  assert.equal(audio.endUs, 2250000);
  assert.deepEqual(
    audio.segments.filter((s) => !s.empty).map((s) => [s.startUs, s.endUs]),
    [[250000, 2250000]],
  );
});

test("probe maps B-frame edit lists and excludes stream-copy preroll", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-probe-edits-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, "bframes.mp4"),
    trimmed = join(directory, "trimmed.mp4");
  for (const args of [
    ["-f", "lavfi", "-i", "testsrc2=size=160x96:rate=24:duration=3", "-c:v", "libx264", source],
    ["-ss", "0.75", "-i", source, "-t", "1", "-c", "copy", trimmed],
  ]) {
    const encoded = spawnSync("ffmpeg", ["-nostdin", "-v", "error", ...args], {
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(encoded.status, 0, encoded.stderr);
  }
  const original = probe(pathToFileURL(source).href);
  assert.equal(original.ok, true, JSON.stringify(original));
  const video = original.data.streams[0];
  assert.equal(video.samples.firstPtsUs, 0);
  assert.equal(video.samples.lastPtsUs, 2958333);
  assert.equal(video.samples.count, 72);
  assert.deepEqual(video.segments[0].mediaStartUs, { numerator: 250000, denominator: 3 });
  const cut = probe(pathToFileURL(trimmed).href);
  assert.equal(cut.ok, true, JSON.stringify(cut));
  const clipped = cut.data.streams[0];
  assert.equal(clipped.samples.firstPtsUs, 0);
  assert.equal(clipped.samples.count, 26);
  assert.equal(clipped.samples.lastPtsUs, 1125000);
  assert.equal(clipped.endUs, 1166000);
});
