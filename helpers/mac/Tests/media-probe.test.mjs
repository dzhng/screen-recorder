import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  assert.equal(stream.samples.firstTimeUs, 0);
  assert.equal(stream.samples.lastTimeUs, 1750000);
  assert.equal(stream.samples.lastDurationUs, 250000);
  assert.equal(stream.samples.minDurationUs, 250000);
  assert.equal(stream.samples.maxDurationUs, 250000);
  assert.equal(stream.decodable, true);
  assert.equal(stream.hasAlpha, false);
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
  assert.equal(video.samples.firstTimeUs, 0);
  assert.deepEqual(video.samples.lastTimeUs, { numerator: 8875000, denominator: 3 });
  assert.deepEqual(video.samples.lastDurationUs, { numerator: 125000, denominator: 3 });
  assert.equal(video.samples.count, 72);
  assert.deepEqual(video.segments[0].mediaStartUs, { numerator: 250000, denominator: 3 });
  const cut = probe(pathToFileURL(trimmed).href);
  assert.equal(cut.ok, true, JSON.stringify(cut));
  const clipped = cut.data.streams[0];
  assert.equal(clipped.samples.firstPtsUs, 0);
  assert.equal(clipped.samples.count, 26);
  assert.equal(clipped.samples.lastPtsUs, 1125000);
  assert.deepEqual(clipped.samples.lastDurationUs, { numerator: 125000, denominator: 3 });
  assert.deepEqual(clipped.endUs, { numerator: 3500000, denominator: 3 });
});

test("probe distinguishes absent range metadata from a declared video color profile", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-probe-color-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "pq.mov");
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=gray:size=48x32:rate=30",
      "-frames:v",
      "1",
      "-vf",
      "format=yuv444p10le,setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc:range=limited",
      "-c:v",
      "prores_ks",
      "-profile:v",
      "4",
      "-alpha_bits",
      "0",
      path,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(encoded.status, 0, encoded.stderr);
  const result = probe(pathToFileURL(path).href);
  assert.equal(result.ok, true, JSON.stringify(result));
  const video = result.data.streams.find((s) => s.kind === "video");
  assert.equal(video.hasAlpha, false);
  assert.deepEqual(video.colorFormats, [
    {
      colorPrimaries: "ITU_R_2020",
      transferFunction: "SMPTE_ST_2084_PQ",
      ycbcrMatrix: "ITU_R_2020",
      fullRange: null,
      bitsPerComponent: 12,
      interpretationExtensions: [],
      invalidColorDeclarations: [],
    },
  ]);
});

test("probe reports alpha on timed ProRes pictures", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-probe-alpha-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "alpha.mov");
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=red@0.5:size=48x32:rate=30,format=yuva444p10le",
      "-frames:v",
      "1",
      "-c:v",
      "prores_ks",
      "-profile:v",
      "4",
      "-alpha_bits",
      "16",
      path,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(encoded.status, 0, encoded.stderr);
  const result = probe(pathToFileURL(path).href);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.streams.find((s) => s.kind === "video").hasAlpha, true);
});

test("probe timing digest detects interior changes hidden by summaries", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-probe-timing-"));
  const operandsPath = join(directory, "operands.json");
  let passed = false;
  t.after(() => {
    if (!passed && existsSync(operandsPath)) {
      const diagnostic = mkdtempSync(join(tmpdir(), "screenrec-probe-timing-failure-"));
      copyFileSync(operandsPath, join(diagnostic, "operands.json"));
      t.diagnostic(`Unverified timing operands retained at ${diagnostic}/operands.json`);
    }
    rmSync(directory, { recursive: true, force: true });
  });
  const variants = [];
  for (const [name, middle, offset] of [
    ["source", 3000, 0],
    ["changed", 6000, 0],
    ["translated", 3000, 6000],
  ]) {
    const path = join(directory, name + ".mov");
    const encoded = spawnSync(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-copyts",
        "-f",
        "lavfi",
        "-i",
        "color=gray:size=48x32:rate=30",
        "-frames:v",
        "4",
        "-vf",
        `settb=1/12000,setpts=if(eq(N\\,0)\\,0\\,if(eq(N\\,1)\\,${middle}\\,if(eq(N\\,2)\\,9000\\,18000)))+${offset}`,
        "-fps_mode",
        "passthrough",
        "-enc_time_base:v",
        "filter",
        "-c:v",
        "prores_ks",
        "-profile:v",
        "4",
        "-alpha_bits",
        "0",
        "-video_track_timescale",
        "12000",
        "-movie_timescale",
        "12000",
        path,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(encoded.status, 0, encoded.stderr);
    const result = probe(pathToFileURL(path).href);
    assert.equal(result.ok, true, JSON.stringify(result));
    variants.push(result.data);
    writeFileSync(operandsPath, JSON.stringify(variants, null, 2));
  }
  const [sourceAsset, changedAsset, translatedAsset] = variants;
  const [source, changed, translated] = variants.map((media) =>
    media.streams.find((s) => s.kind === "video"),
  );
  assert.equal(sourceAsset.originUs, 0);
  assert.equal(changedAsset.originUs, 0);
  assert.equal(translatedAsset.originUs, 500000);
  const { presentedTimingSha256: sourceDigest, ...sourceSummary } = source.samples;
  const { presentedTimingSha256: changedDigest, ...changedSummary } = changed.samples;
  assert.deepEqual(sourceSummary, changedSummary);
  assert.deepEqual(source.segments, changed.segments);
  assert.match(sourceDigest, /^[a-f0-9]{64}$/);
  assert.notEqual(sourceDigest, changedDigest);
  assert.equal(sourceDigest, translated.samples.presentedTimingSha256);
  passed = true;
});
