import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseArgs } from "node:util";

const run = promisify(execFile);
function refuse(code, message) {
  throw Object.assign(new Error(message), { code });
}

async function sha256(file) {
  const digest = createHash("sha256");
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest("hex");
}

async function probe(ffprobe, file, frames = false) {
  const args = ["-v", "error", "-show_streams"];
  if (frames) args.push("-show_frames");
  args.push("-of", "json", file);
  return JSON.parse((await run(ffprobe, args, { maxBuffer: 16 * 1024 * 1024 })).stdout);
}

async function decode(ffmpeg, file, pixelFormat, size) {
  const { stdout } = await run(
    ffmpeg,
    [
      "-v",
      "error",
      "-i",
      file,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      pixelFormat,
      "pipe:1",
    ],
    { maxBuffer: Math.max(size * 8, 1024 * 1024), encoding: "buffer" },
  );
  return stdout;
}

function equal(actual, expected, code, message) {
  if (actual !== expected) refuse(code, `${message}: expected ${expected}, got ${actual}`);
}

function deepEqual(actual, expected, code, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    refuse(code, `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function verify({ controls, referenceRoot, ffmpeg, ffprobe }) {
  if (!isAbsolute(ffmpeg) || !isAbsolute(ffprobe))
    refuse("USAGE", "--ffmpeg and --ffprobe must be absolute");
  const manifest = JSON.parse(await readFile(join(controls, "manifest.json"), "utf8"));
  const referenceManifest = await readFile(join(referenceRoot, manifest.reference.manifest));
  const expected = await readFile(join(referenceRoot, manifest.reference.expected));
  equal(
    createHash("sha256").update(referenceManifest).digest("hex"),
    manifest.reference.manifestSha256,
    "REFERENCE_CHANGED",
    "canonical manifest changed",
  );
  equal(
    createHash("sha256").update(expected).digest("hex"),
    manifest.reference.expectedSha256,
    "REFERENCE_CHANGED",
    "canonical oracle changed",
  );
  const media = new Map();
  let mediaBytes = 0;
  for (const item of manifest.media) {
    if (media.has(item.file)) refuse("CONTROL_CHANGED", `duplicate media ${item.file}`);
    const file = join(referenceRoot, item.file);
    const stat = await lstat(file).catch(() => null);
    if (!stat?.isFile()) refuse("INPUT_MISSING", `missing canonical media ${item.file}`);
    equal(stat.size, item.bytes, "MEDIA_CHANGED", `${item.file} byte size`);
    equal(await sha256(file), item.sha256, "MEDIA_CHANGED", `${item.file} hash`);
    media.set(item.file, file);
    mediaBytes += stat.size;
  }
  const audioChecks = manifest.media.filter((item) => item.sampleRate);
  for (const item of audioChecks) {
    const file = media.get(item.file);
    const wave = await readFile(file);
    equal(wave.toString("ascii", 0, 4), "RIFF", "MEDIA_CHANGED", `${item.file} WAV header`);
    equal(wave.readUInt32LE(24), item.sampleRate, "MEDIA_CHANGED", `${item.file} sample rate`);
    equal(wave.readUInt32LE(40) / 2, item.samples, "MEDIA_CHANGED", `${item.file} sample count`);
    const impulses = [];
    for (let sample = 0; sample < item.samples; sample++)
      if (wave.readInt16LE(44 + sample * 2) > 20000) impulses.push(sample);
    deepEqual(impulses, item.impulses, "MEDIA_CHANGED", `${item.file} impulse landmarks`);
  }
  const rotated = manifest.media.find((item) => item.id === "rotated-picture");
  const rotatedProbe = await probe(ffprobe, media.get(rotated.file));
  const rotatedStream = rotatedProbe.streams.find((stream) => stream.codec_type === "video");
  deepEqual(
    [rotatedStream.width, rotatedStream.height, rotatedStream.r_frame_rate],
    [160, 96, "4/1"],
    "MEDIA_CHANGED",
    "rotated stream",
  );
  equal(
    rotatedStream.side_data_list?.find((entry) => entry.rotation)?.rotation,
    90,
    "MEDIA_CHANGED",
    "display rotation",
  );
  const alpha = manifest.media.find((item) => item.id === "alpha-patches");
  const alphaRgba = await decode(
    ffmpeg,
    media.get(alpha.file),
    "rgba",
    alpha.dimensions.width * alpha.dimensions.height * 4,
  );
  equal(
    alphaRgba.length,
    alpha.dimensions.width * alpha.dimensions.height * 4,
    "MEDIA_CHANGED",
    "alpha raster size",
  );
  equal(alphaRgba[3], alpha.alpha.transparent[2] ?? 0, "MEDIA_CHANGED", "transparent patch");
  equal(
    alphaRgba[(alpha.alpha.partial[1] * alpha.dimensions.width + alpha.alpha.partial[0]) * 4 + 3],
    alpha.alpha.partial[2],
    "MEDIA_CHANGED",
    "partial-alpha patch",
  );
  equal(
    alphaRgba[(alpha.alpha.opaque[1] * alpha.dimensions.width + alpha.alpha.opaque[0]) * 4 + 3],
    alpha.alpha.opaque[2],
    "MEDIA_CHANGED",
    "opaque patch",
  );
  const odd = manifest.media.find((item) => item.id === "odd-canvas");
  const oddProbe = await probe(ffprobe, media.get(odd.file));
  deepEqual(
    [oddProbe.streams[0]?.width, oddProbe.streams[0]?.height],
    [odd.dimensions.width, odd.dimensions.height],
    "MEDIA_CHANGED",
    "odd canvas dimensions",
  );
  const edge = manifest.media.find((item) => item.id === "edge-bars");
  const edgeProbe = await probe(ffprobe, media.get(edge.file));
  deepEqual(
    edgeProbe.streams.filter((stream) => stream.codec_type).map((stream) => stream.codec_type),
    ["video", "audio"],
    "MEDIA_CHANGED",
    "edge control streams",
  );
  const edgeRgb = await decode(ffmpeg, media.get(edge.file), "rgb24", 160 * 96 * 3);
  for (const marker of edge.markers) {
    const offset = (marker.y * 160 + marker.x) * 3;
    const actual = [...edgeRgb.subarray(offset, offset + 3)];
    if (actual.some((value, channel) => Math.abs(value - marker.rgb[channel]) > 4))
      refuse(
        "MEDIA_CHANGED",
        `edge marker ${marker.x},${marker.y}: expected ${marker.rgb}, got ${actual}`,
      );
  }
  const videoOnly = manifest.media.find((item) => item.id === "video-without-audio");
  const videoOnlyProbe = await probe(ffprobe, media.get(videoOnly.file));
  deepEqual(
    videoOnlyProbe.streams.map((stream) => stream.codec_type),
    videoOnly.streamTypes,
    "MEDIA_CHANGED",
    "video-only control streams",
  );
  const gap = manifest.media.find((item) => item.id === "transition-gap");
  const gapProbe = await probe(ffprobe, media.get(gap.file), true);
  const frames = gapProbe.frames.filter((frame) => frame.media_type === "video");
  deepEqual(
    frames.map((frame) => Math.round(Number(frame.best_effort_timestamp_time) * 1e6)),
    gap.ptsUs,
    "MEDIA_CHANGED",
    "transition-gap PTS",
  );
  deepEqual(
    frames.map((frame) => Math.round(Number(frame.duration_time) * 1e6)),
    gap.durationsUs,
    "MEDIA_CHANGED",
    "transition-gap durations",
  );
  const expectedIds = [
    "rational-24fps-boundaries",
    "offset-and-drift",
    "unrelated-audio",
    "rotated-asymmetric-picture",
    "flat-and-transparent-patches",
    "clipping-edge-bars",
    "wrong-supplied-text",
    "blank-detection",
    "transition-gap",
  ];
  deepEqual(
    manifest.controls.map((control) => control.id),
    expectedIds,
    "CONTROL_CHANGED",
    "control order",
  );
  const rational = manifest.controls.find((control) => control.id === "rational-24fps-boundaries");
  deepEqual(
    rational.frameDurationUs,
    { numerator: 125000, denominator: 3 },
    "CONTROL_CHANGED",
    "rational frame duration",
  );
  deepEqual(
    rational.boundaries,
    [
      { atUs: 0, frame: 0 },
      { atUs: 41666, frame: 0 },
      { atUs: 41667, frame: 1 },
      { atUs: 124999, frame: 2 },
      { atUs: 125000, frame: 3 },
      { atUs: 249999, frame: 5 },
      { atUs: 250000, frame: 6 },
    ],
    "CONTROL_CHANGED",
    "rational boundary oracle",
  );
  const offset = manifest.controls.find((control) => control.id === "offset-and-drift");
  deepEqual(
    offset.anchors,
    [
      { sourceUs: 0, projectUs: 125000 },
      { sourceUs: 20000000, projectUs: 20250000 },
      { sourceUs: 40000000, projectUs: 40250000 },
    ],
    "CONTROL_CHANGED",
    "offset/drift anchors",
  );
  deepEqual(
    offset.expected,
    { offsetUs: 125000, driftUsPerSecond: 6250 },
    "CONTROL_CHANGED",
    "offset/drift oracle",
  );
  const wrongText = manifest.controls.find((control) => control.id === "wrong-supplied-text");
  deepEqual(
    [wrongText.suppliedText, wrongText.observedText, wrongText.expected],
    ["blue", "blew", "unmatched"],
    "CONTROL_CHANGED",
    "wrong-text oracle",
  );
  const blank = manifest.controls.find((control) => control.id === "blank-detection");
  deepEqual(
    [blank.samples, blank.threshold, blank.expected],
    [[0, 0, 0, 0, 0, 0], 0, "blank"],
    "CONTROL_CHANGED",
    "blank oracle",
  );
  const transition = manifest.controls.find((control) => control.id === "transition-gap");
  deepEqual(
    transition.expected,
    { gap: { startUs: 500000, endUs: 1000000 } },
    "CONTROL_CHANGED",
    "transition-gap oracle",
  );
  return { ok: true, controls: expectedIds, mediaBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        controls: { type: "string" },
        "reference-root": { type: "string" },
        ffmpeg: { type: "string" },
        ffprobe: { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "node packages/test-harness/editing/corpus-controls.mjs verify --controls DIRECTORY --reference-root DIRECTORY --ffmpeg ABSOLUTE_EXECUTABLE --ffprobe ABSOLUTE_EXECUTABLE",
      );
    } else {
      if (
        positionals.length !== 1 ||
        positionals[0] !== "verify" ||
        !values.controls ||
        !values["reference-root"] ||
        !values.ffmpeg ||
        !values.ffprobe
      )
        refuse("USAGE", "Read --help");
      console.log(
        JSON.stringify(
          await verify({
            controls: values.controls,
            referenceRoot: values["reference-root"],
            ffmpeg: values.ffmpeg,
            ffprobe: values.ffprobe,
          }),
        ),
      );
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        error: { code: error.code ?? "INVALID_CONTROLS", message: error.message },
      }),
    );
    process.exitCode = 1;
  }
}

export { verify };
