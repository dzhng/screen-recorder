import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { verifyMulticamCorpus } from "../multicam-corpus.mjs";

const SOURCE_PAIRS = [
  "grahamRaw:madisonRaw",
  "grahamRaw:lilyRawP1",
  "madisonRaw:lilyRawP1",
];
const WINDOW_STARTS_US = [0, 240_000_000, 1_200_000_000];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const refuse = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

/**
 * Replay the frozen unlike-microphone estimator result. This compares the
 * retained numerical result with its original run and certifies that every
 * real comparison remains refused. It never estimates a clock or promotes a
 * synchronization receipt.
 */
export async function verifyRealSynchronizationReplay(assetsDirectory, fixturesDirectory) {
  const originalPath = resolve(assetsDirectory, "original-comparisons.json");
  const originalBytes = await readFile(originalPath);
  const original = JSON.parse(originalBytes);
  const exact = await readJson(resolve(assetsDirectory, "exact-replay.json"));
  if (exact.referenceSha256 !== hash(originalBytes) || exact.exactComparisonParity !== true || exact.clockDeclared !== false)
    refuse("REFERENCE_CHANGED", "Frozen synchronization reference identity or refusal scope changed");
  const retainedPath = resolve(assetsDirectory, "retained-comparisons.json");
  const retainedBytes = await readFile(retainedPath);
  const retained = JSON.parse(retainedBytes);
  if (!Array.isArray(original) || !Array.isArray(retained) || original.length !== 9 || retained.length !== 9)
    refuse("COMPARISON_COVERAGE", "Frozen synchronization replay requires nine comparisons");
  await verifyMulticamCorpus(fixturesDirectory);
  const seen = new Set();
  let accepted = 0;
  for (const [index, actual] of retained.entries()) {
    const expected = original[index];
    if (!expected) refuse("COMPARISON_ORDER", `Comparison ${index} is missing its original result`);
    const stripRuntime = (value) => {
      const copy = structuredClone(value);
      delete copy.elapsedSeconds;
      return copy;
    };
    if (JSON.stringify(stripRuntime(actual)) !== JSON.stringify(stripRuntime(expected)))
      refuse("RESULT_CHANGED", `Comparison ${index} differs from the frozen estimator result`);
    const pair = `${actual.left}:${actual.right}`;
    if (!SOURCE_PAIRS.includes(pair)) refuse("SOURCE_PAIR", `Comparison ${index} has an unknown source pair`);
    const startUs = Number(actual.rangeSeconds?.[0]) * 1_000_000;
    const endUs = Number(actual.rangeSeconds?.[1]) * 1_000_000;
    if (!WINDOW_STARTS_US.includes(startUs) || endUs - startUs !== 20_000_000)
      refuse("RANGE_CHANGED", `Comparison ${index} has an unsupported source window`);
    const key = `${pair}:${startUs}`;
    if (seen.has(key)) refuse("COMPARISON_COVERAGE", `Comparison ${index} duplicates ${key}`);
    seen.add(key);
    if (actual.result?.state === "constant-offset") accepted += 1;
    if (actual.result?.state !== "unsuitable" || actual.result?.offsetFrames !== null)
      refuse("PROMOTION", `Comparison ${index} must remain refused without an offset`);
    if (!Array.isArray(actual.result.anchors) || actual.result.anchors.length !== 3)
      refuse("ANCHOR_COVERAGE", `Comparison ${index} must retain three anchor observations`);
    if (actual.result.anchors.some((anchor) => anchor.selectedFrames !== null))
      refuse("PROMOTION", `Comparison ${index} contains an admitted anchor in a refused result`);
  }
  if (seen.size !== 9 || accepted !== 0)
    refuse("COMPARISON_COVERAGE", "Frozen real synchronization comparisons are incomplete or promoted");
  return {
    ok: true,
    retainedSha256: hash(retainedBytes),
    coverage: {
      comparisons: retained.length,
      sourcePairs: SOURCE_PAIRS,
      accepted,
      refused: retained.length - accepted,
    },
    verdict: "no-synchronization-promotion",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { assets: { type: "string" }, fixtures: { type: "string" }, help: { type: "boolean" } },
    });
    if (values.help) {
      console.log("node packages/test-harness/editing/synchronization/real-replay.mjs verify --assets DIRECTORY --fixtures DIRECTORY");
    } else if (positionals.length !== 1 || positionals[0] !== "verify" || !values.assets || !values.fixtures) {
      refuse("USAGE", "Read --help");
    } else {
      console.log(JSON.stringify(await verifyRealSynchronizationReplay(values.assets, values.fixtures)));
    }
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: { code: error.code ?? "INVALID_REPLAY", message: error.message } }));
    process.exitCode = 1;
  }
}
