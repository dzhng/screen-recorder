import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readAudioWaveFile } from "@yap/core/audio-wave";

const EXPECTED_SOURCES = ["grahamRaw", "lilyRawP1", "madisonRaw"];
const WINDOW_DURATION_US = 20_000_000;
const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const FRAMES_PER_WINDOW = (SAMPLE_RATE * WINDOW_DURATION_US) / 1_000_000;

const refuse = (code, message) => {
  throw Object.assign(new Error(message), { code });
};

const hashFile = async (path) => {
  const digest = createHash("sha256");
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest("hex");
};

const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");

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
