import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { promisify } from "node:util";
import { readAudioWaveFile } from "@yap/core/audio-wave";

const EXPECTED_SOURCES = ["grahamRaw", "lilyRawP1", "madisonRaw"];
const WINDOW_DURATION_US = 20_000_000;
const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const FRAMES_PER_WINDOW = (SAMPLE_RATE * WINDOW_DURATION_US) / 1_000_000;
const PICTURE_WIDTH = 320;
const PICTURE_HEIGHT = 180;
const PICTURE_PIXEL_FORMAT = "rgb24";
const PICTURE_FRAME_BYTES = PICTURE_WIDTH * PICTURE_HEIGHT * 3;
const PICTURE_SOURCE_TIMES_US = [0, 240_000_000, 1_200_000_000];
const execFileAsync = promisify(execFile);

const refuse = (code, message) => {
  throw Object.assign(new Error(message), { code });
};

const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");

const decodePictureSamples = async (path) => {
  const { stdout } = await execFileAsync(
    process.env.YAP_FFMPEG ?? "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-i",
      path,
      "-frames:v",
      "3",
      "-f",
      "rawvideo",
      "-pix_fmt",
      PICTURE_PIXEL_FORMAT,
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: PICTURE_FRAME_BYTES * 3 + 1024 },
  );
  if (stdout.length !== PICTURE_FRAME_BYTES * 3)
    refuse(
      "PICTURE_SAMPLES",
      "Retained multicam picture derivative must decode to exactly three frames",
    );
  return [0, 1, 2].map((index) =>
    stdout.subarray(index * PICTURE_FRAME_BYTES, (index + 1) * PICTURE_FRAME_BYTES),
  );
};

const contained = (root, file) => {
  const path = resolve(root, file);
  const local = relative(resolve(root), path);
  if (local.startsWith("..") || isAbsolute(local)) refuse("INPUT_PATH", "Fixture leaves its root");
  return path;
};

/**
 * Certify the retained three-source window bank as physical input coverage.
 * The bank has no shared camera clock: this verifier intentionally reports that
 * synchronization is not established even when every source has equal windows.
 */
export async function verifyMulticamCorpus(directory) {
  const manifestPath = contained(directory, "manifest.json");
  const identityPath = contained(directory, "manifest.identity.json");
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  const identity = JSON.parse(await readFile(identityPath));
  if (identity.manifestSha256 !== hashBytes(manifestBytes))
    refuse("MANIFEST_CHANGED", "Frozen multicam manifest identity changed");

  const sourceNames = Object.keys(manifest.sources ?? {}).sort();
  if (sourceNames.join("\0") !== EXPECTED_SOURCES.join("\0"))
    refuse("SOURCE_COVERAGE", "Retained multicam bank must contain exactly three source recordings");
  for (const name of EXPECTED_SOURCES) {
    const source = manifest.sources[name];
    if (!/^[a-f0-9]{64}$/.test(source.sha256) || !source.path)
      refuse("SOURCE_IDENTITY", `${name}: source path and hash are required`);
    const streams = source.probe?.streams ?? [];
    const kinds = new Set(streams.filter((stream) => stream.decodable !== false).map((stream) => stream.kind));
    if (!kinds.has("video") || !kinds.has("audio"))
      refuse("SOURCE_SUPPORT", `${name}: retained source must have decodable video and audio streams`);
  }

  const cases = manifest.cases;
  if (!Array.isArray(cases) || cases.length !== EXPECTED_SOURCES.length * 3)
    refuse("CASE_COVERAGE", "Retained multicam bank must contain three windows per source");
  const seen = new Set();
  const bySource = new Map(EXPECTED_SOURCES.map((source) => [source, []]));
  for (const entry of cases) {
    if (!bySource.has(entry.source)) refuse("CASE_SOURCE", `${entry.name}: unknown source`);
    if (seen.has(entry.name)) refuse("CASE_COVERAGE", `${entry.name}: duplicate retained window`);
    seen.add(entry.name);
    const startUs = Number(entry.range?.startUs);
    const endUs = Number(entry.range?.endUs);
    if (!Number.isSafeInteger(startUs) || !Number.isSafeInteger(endUs) || endUs - startUs !== WINDOW_DURATION_US)
      refuse("CASE_CLOCK", `${entry.name}: retained window must be an exact 20-second range`);
    bySource.get(entry.source).push({ startUs, endUs, entry });
    const file = contained(directory, entry.path);
    const stat = await lstat(file).catch(() => null);
    if (!stat?.isFile()) refuse("INPUT_MISSING", `${entry.name}: retained WAV is missing`);
    const bytes = await readFile(file);
    if (bytes.length !== entry.bytes || hashBytes(bytes) !== entry.sha256)
      refuse("INPUT_CHANGED", `${entry.name}: retained WAV bytes differ`);
    const audio = readAudioWaveFile(file);
    if (audio.sampleRate !== SAMPLE_RATE || audio.channels !== CHANNELS || audio.frames !== FRAMES_PER_WINDOW)
      refuse("SAMPLES_CHANGED", `${entry.name}: retained PCM dimensions differ`);
    const pcm = bytes.subarray(audio.dataOffset, audio.dataOffset + audio.dataBytes);
    if (hashBytes(pcm) !== entry.pcmSha256)
      refuse("SAMPLES_CHANGED", `${entry.name}: retained PCM bytes differ`);
  }
  for (const [source, windows] of bySource) {
    if (windows.length !== 3) refuse("CASE_COVERAGE", `${source}: exactly three retained windows are required`);
    windows.sort((a, b) => a.startUs - b.startUs);
    for (let index = 1; index < windows.length; index++)
      if (windows[index - 1].endUs > windows[index].startUs)
        refuse("CASE_CLOCK", `${source}: retained windows overlap`);
  }
  const pictureManifestBytes = await readFile(contained(directory, "picture-manifest.json"));
  const pictureIdentity = JSON.parse(
    await readFile(contained(directory, "picture-manifest.identity.json")),
  );
  if (pictureIdentity.manifestSha256 !== hashBytes(pictureManifestBytes))
    refuse("PICTURE_MANIFEST_CHANGED", "Frozen multicam picture manifest identity changed");
  const pictureManifest = JSON.parse(pictureManifestBytes);
  const pictureSources = Object.keys(pictureManifest?.sources ?? {}).sort();
  if (
    pictureManifest?.version !== 1 ||
    pictureSources.join("\0") !== EXPECTED_SOURCES.join("\0")
  )
    refuse(
      "PICTURE_COVERAGE",
      "Retained multicam picture samples must cover exactly three sources",
    );
  let pictureCount = 0;
  for (const source of EXPECTED_SOURCES) {
    const entry = pictureManifest.sources[source];
    if (
      entry.width !== PICTURE_WIDTH ||
      entry.height !== PICTURE_HEIGHT ||
      entry.pixelFormat !== PICTURE_PIXEL_FORMAT ||
      !Array.isArray(entry.samples) ||
      entry.samples.length !== PICTURE_SOURCE_TIMES_US.length ||
      !entry.path ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      refuse("PICTURE_COVERAGE", `${source}: malformed retained picture samples`);
    for (const [index, sample] of entry.samples.entries()) {
      if (
        sample.frameIndex !== index ||
        sample.sourceAtUs !== PICTURE_SOURCE_TIMES_US[index] ||
        sample.bytes !== PICTURE_FRAME_BYTES ||
        !/^[a-f0-9]{64}$/.test(sample.sha256)
      )
        refuse("PICTURE_COVERAGE", `${source}: malformed picture sample ${index}`);
    }
    const file = contained(directory, entry.path);
    const stat = await lstat(file).catch(() => null);
    if (!stat?.isFile())
      refuse("PICTURE_MISSING", `${source}: retained picture derivative is missing`);
    const bytes = await readFile(file);
    if (bytes.length !== entry.bytes || hashBytes(bytes) !== entry.sha256)
      refuse("PICTURE_CHANGED", `${source}: retained picture derivative bytes differ`);
    const decoded = await decodePictureSamples(file);
    for (const [index, frame] of decoded.entries())
      if (hashBytes(frame) !== entry.samples[index].sha256)
        refuse("PICTURE_CHANGED", `${source}: decoded picture sample ${index} differs`);
    pictureCount += decoded.length;
  }
  return {
    ok: true,
    sourceIdentity: "manifest-bound",
    synchronization: "not-established",
    coverage: {
      sources: EXPECTED_SOURCES,
      windowsPerSource: 3,
      totalWindows: cases.length,
      durationUs: WINDOW_DURATION_US,
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      framesPerWindow: FRAMES_PER_WINDOW,
    },
    picture: {
      sources: EXPECTED_SOURCES,
      samplesPerSource: PICTURE_SOURCE_TIMES_US.length,
      totalSamples: pictureCount,
      width: PICTURE_WIDTH,
      height: PICTURE_HEIGHT,
      pixelFormat: PICTURE_PIXEL_FORMAT,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { fixtures: { type: "string" }, help: { type: "boolean" } },
    });
    if (values.help) {
      console.log("node packages/test-harness/editing/multicam-corpus.mjs verify --fixtures DIRECTORY");
    } else if (positionals.length !== 1 || positionals[0] !== "verify" || !values.fixtures) {
      refuse("USAGE", "Read --help");
    } else {
      console.log(JSON.stringify(await verifyMulticamCorpus(values.fixtures)));
    }
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: { code: error.code ?? "INVALID_CORPUS", message: error.message } }));
    process.exitCode = 1;
  }
}
