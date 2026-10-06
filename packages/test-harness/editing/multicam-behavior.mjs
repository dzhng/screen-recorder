import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readAudioWaveFile } from "@yap/core/audio-wave";
import { verifyMulticamCorpus } from "./multicam-corpus.mjs";

const SOURCES = ["grahamRaw", "lilyRawP1", "madisonRaw"];
const SAMPLE_TIMES_US = [0, 240_000_000, 1_200_000_000];

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const refuse = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
const within = (root, path) => {
  const candidate = resolve(root, path);
  const local = relative(resolve(root), candidate);
  if (local.startsWith("..") || isAbsolute(local)) refuse("INPUT_PATH", "Fixture leaves its root");
  return candidate;
};

/**
 * Replay a caller-authored multicam source schedule over the retained physical
 * windows and picture samples. This certifies source selection and identity
 * preservation only; it never infers a shared clock, speaker or camera choice.
 */
export async function verifyMulticamBehavior(fixturesDirectory, recipePath, identityPath) {
  const corpus = await verifyMulticamCorpus(fixturesDirectory);
  const recipeBytes = await readFile(recipePath);
  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  if (identity.recipeSha256 !== hash(recipeBytes))
    refuse("RECIPE_CHANGED", "Frozen multicam behavior recipe identity changed");
  const recipe = JSON.parse(recipeBytes);
  if (recipe.version !== 1 || recipe.policy !== "caller-authored-source-choice")
    refuse("RECIPE_POLICY", "Multicam behavior recipe must use the caller-authored source policy");
  if (!Array.isArray(recipe.selections) || recipe.selections.length !== 9)
    refuse("SELECTION_COVERAGE", "Multicam behavior recipe must select all nine retained windows");

  const manifest = JSON.parse(await readFile(within(fixturesDirectory, "manifest.json"), "utf8"));
  const pictures = JSON.parse(
    await readFile(within(fixturesDirectory, "picture-manifest.json"), "utf8"),
  );
  const cases = new Map(
    manifest.cases.map((entry) => [`${entry.source}:${entry.range.startUs}`, entry]),
  );
  const seen = new Set();
  const perSource = new Map(SOURCES.map((source) => [source, 0]));
  const selections = [];
  for (const [index, selection] of recipe.selections.entries()) {
    const source = selection.source;
    const pictureSource = selection.pictureSource;
    const pictureSampleIndex = selection.pictureSampleIndex;
    const startUs = Number(selection.audioWindowStartUs);
    if (!SOURCES.includes(source) || pictureSource !== source)
      refuse("PICTURE_SELECTION", `Selection ${index} is not bound to one source`);
    if (!Number.isSafeInteger(startUs) || !SAMPLE_TIMES_US.includes(startUs))
      refuse("AUDIO_SELECTION", `Selection ${index} has an unsupported audio window`);
    if (!Number.isInteger(pictureSampleIndex) || pictureSampleIndex < 0 || pictureSampleIndex > 2)
      refuse("PICTURE_SELECTION", `Selection ${index} has an unsupported picture sample`);
    const key = `${source}:${startUs}`;
    if (seen.has(key)) refuse("SELECTION_COVERAGE", `Selection ${index} duplicates ${key}`);
    seen.add(key);
    const audio = cases.get(key);
    const picture = pictures.sources[source];
    if (!audio || !picture) refuse("SELECTION_COVERAGE", `Selection ${index} has no retained evidence`);
    if (picture.samples[pictureSampleIndex].sourceAtUs !== startUs)
      refuse("PICTURE_SELECTION", `Selection ${index} crosses audio and picture source clocks`);
    const audioFile = within(fixturesDirectory, audio.path);
    const stat = await lstat(audioFile).catch(() => null);
    if (!stat?.isFile()) refuse("INPUT_MISSING", `Selection ${index} audio window is missing`);
    const bytes = await readFile(audioFile);
    const info = readAudioWaveFile(audioFile);
    const pcm = bytes.subarray(info.dataOffset, info.dataOffset + info.dataBytes);
    if (hash(pcm) !== audio.pcmSha256) refuse("INPUT_CHANGED", `Selection ${index} audio window changed`);
    selections.push({
      sequenceIndex: index,
      source,
      audioWindowStartUs: startUs,
      audioPcmSha256: audio.pcmSha256,
      pictureSampleIndex,
      pictureSha256: picture.samples[pictureSampleIndex].sha256,
      sourceSha256: manifest.sources[source].sha256,
    });
    perSource.set(source, perSource.get(source) + 1);
  }
  if (seen.size !== 9 || [...perSource.values()].some((count) => count !== 3))
    refuse("SELECTION_COVERAGE", "Multicam behavior must select each source's three retained windows once");
  return {
    ok: true,
    sourceIdentity: corpus.sourceIdentity,
    synchronization: "not-established",
    cameraChoice: "caller-authored",
    sources: SOURCES,
    selectionCount: selections.length,
    selections,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        fixtures: { type: "string" },
        recipe: { type: "string" },
        identity: { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "node packages/test-harness/editing/multicam-behavior.mjs verify --fixtures DIRECTORY --recipe FILE --identity FILE",
      );
    } else if (
      positionals.length !== 1 ||
      positionals[0] !== "verify" ||
      !values.fixtures ||
      !values.recipe ||
      !values.identity
    ) {
      refuse("USAGE", "Read --help");
    } else {
      console.log(JSON.stringify(await verifyMulticamBehavior(values.fixtures, values.recipe, values.identity)));
    }
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: { code: error.code ?? "INVALID_RECIPE", message: error.message } }));
    process.exitCode = 1;
  }
}
