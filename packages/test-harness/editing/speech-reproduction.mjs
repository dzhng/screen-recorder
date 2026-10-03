import historicalPacket from "../../../specs/done/agent-editing/assets/12d-complete-sentence/manifest.json" with { type: "json" };
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Models } from "../../core/dist/models.js";
import { scoreBoundaries } from "./speech/boundaries.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { values } = parseArgs({
  options: {
    corpus: { type: "string" },
    prepare: { type: "boolean" },
    "model-home": { type: "string", default: "/tmp/screenrec-speech-reproduction" },
    native: { type: "string" },
    out: { type: "string" },
  },
});
if (values.corpus !== "real-narration") throw new Error("Use --corpus real-narration");
const home = resolve(values["model-home"]);
mkdirSync(home, { recursive: true });
const owner = new Models(home);
const models = owner.transcription("parakeet");
if (values.prepare) {
  await owner.prepare("parakeet", AbortSignal.timeout(300000));
  console.log(
    JSON.stringify({ state: models.status(), pins: models.pins, modelDigest: models.modelDigest }),
  );
  process.exit(0);
}
const historicalAudio = process.env.SCREENREC_BASELINE_NATIVE;
if (
  !historicalAudio ||
  createHash("sha256").update(readFileSync(historicalAudio)).digest("hex") !==
    historicalPacket.native.sha256
)
  throw new Error(
    "Historical audition clips require SCREENREC_BASELINE_NATIVE pinned by the retained 12d manifest",
  );
const modelRequest = await models.nativeRequest(); // No preparation or network fallback on an ordinary run.
const binary = values.native ?? process.env.SCREENREC_NATIVE;
if (!binary) throw new Error("Pass --native or SCREENREC_NATIVE for the existing project worker");
const output = resolve(values.out ?? mkdtempSync("/tmp/screenrec-speech-evidence-"));
mkdirSync(output, { recursive: true });
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const save = (name, value) =>
  writeFileSync(join(output, name), JSON.stringify(value, null, 2) + "\n");
const fixture = join(root, "fixtures/narrated-workbench");
const source = join(fixture, "narration.mov");
const baselineFolder = join(root, "specs/recording-for-ai/assets/speech/boundaries");
const marks = json(join(baselineFolder, "marks.json"));
const labelsPath = join(root, "specs/done/agent-editing/assets/00-baseline/speech-labels.json");
const labels = json(labelsPath);
const baseline = json(join(baselineFolder, "transcript.json")).filter((w) => w.type === "word");
const journal = readFileSync(join(fixture, "capture.journal.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse);
const samples = journal.filter(
  (row) => row.event === "audioSamples" && row.data.role === "narration",
);
for (let i = 1; i < samples.length; i++)
  if (samples[i].data.startUs - samples[i - 1].data.endUs > 2000)
    throw new Error("Fixture has an acquisition gap; continuous narration probe is not applicable");
const track = {
  source,
  sourceOffsetUs: 0,
  available: [{ startUs: samples[0].data.startUs, endUs: samples.at(-1).data.endUs }],
};
const calls = [];
function invoke(id, operation, params, executable = binary) {
  const request = { id, operation, params };
  save(id + "-request.json", request);
  const start = performance.now();
  const result = spawnSync(
    "/usr/bin/sandbox-exec",
    ["-p", "(version 1)(allow default)(deny network*)", resolve(executable)],
    {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  writeFileSync(join(output, id + ".log"), result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Native worker exited ${result.status}`);
  const response = JSON.parse(result.stdout);
  save(id + "-response.json", response);
  if (!response.ok) throw new Error(JSON.stringify(response));
  calls.push({ id, elapsedSeconds: (performance.now() - start) / 1000, response });
  return response.data;
}
const rawPath = join(output, "raw.jsonl");
invoke("transcript", "speech.transcribe", { models: modelRequest, track, output: rawPath });
const segments = readFileSync(rawPath, "utf8").trim().split("\n").map(JSON.parse);
const words = segments
  .flatMap((s) => s.words)
  .map((word, index) => ({
    id: `w${index}`,
    type: "word",
    text: word.text,
    sourceRange: word.source,
    partial: false,
  }));
save("transcript.json", words);
const timing = scoreBoundaries(marks.boundaries, words);
const inherited = scoreBoundaries(marks.boundaries, baseline);
const sameWords =
  words.length === baseline.length &&
  words.every(
    (w, i) =>
      w.text === baseline[i].text &&
      w.sourceRange.startUs === baseline[i].sourceRange.startUs &&
      w.sourceRange.endUs === baseline[i].sourceRange.endUs,
  );
const clips = [];
for (const [id, window] of [
  ["filler-uh-54s", { startUs: 51_500_000, endUs: 57_800_000 }],
  ["repetition-candidate-second-return", { startUs: 97_500_000, endUs: 107_000_000 }],
]) {
  const target = labels.targets.find((t) => t.id === id);
  const cut = target.sourceRange;
  for (const [variant, spans] of [
    ["original", [window]],
    [
      "candidate-cut",
      [
        { startUs: window.startUs, endUs: cut.startUs },
        { startUs: cut.endUs, endUs: window.endUs },
      ],
    ],
  ]) {
    const name = id + "-" + variant;
    invoke(
      name,
      "media.audio",
      {
        tracks: [{ role: "narration", ...track }],
        spans,
        output: join(output, name + ".wav"),
      },
      historicalAudio,
    );
    clips.push({
      id: name,
      file: name + ".wav",
      historicalWorkerSha256: historicalPacket.native.sha256,
      sha256: hash(join(output, name + ".wav")),
      spans,
      targetProvenance: target,
      acceptance:
        "Listening and protected-word verification open; this demonstrates the requested span operation only.",
    });
  }
}
const reviewLabels = {
  source: labels.source,
  sourceSha256: hash(source),
  inheritedLabels: labels,
  independentMarksSha256: hash(join(baselineFolder, "marks.json")),
  textAuthority:
    "Inherited labels retain their original provenance. Fresh ASR is a candidate observation, never an annotation.",
  protectedNeighbors: [
    {
      target: "filler-uh-54s",
      left: { text: "paragraph", range: null },
      right: { text: "this", range: null },
      authority: "ASR-proposed words; independent audible labels and ranges missing",
    },
    {
      target: "repetition-candidate-second-return",
      left: { text: null, range: null },
      right: { text: null, range: null },
      authority: "Independent labels and removal intent missing",
    },
  ],
};
save("review-labels.json", reviewLabels);
const report = {
  scope: "Local baseline reproduction and incomplete label packet, not cleanup acceptance",
  sourceSha256: hash(source),
  nativeSha256: hash(resolve(binary)),
  nativePath: resolve(binary),
  harnessSha256: hash(fileURLToPath(import.meta.url)),
  models: { pins: models.pins, digest: models.modelDigest, files: modelRequest.files },
  network: "OS sandbox deny network for all native calls",
  inheritedTiming: inherited,
  currentTiming: timing,
  wordCount: words.length,
  identicalToInheritedWordTimings: sameWords,
  observedFillers: words.filter((w) => /^(um|uh)[.,!?]?$/i.test(w.text)),
  fillerPrecision: null,
  fillerRecall: null,
  reason: "Complete independent audible target inventory and false-positive review do not exist.",
  repetition: {
    candidate: labels.targets.find((t) => t.kind === "candidate-repetition"),
    observed: words.filter(
      (w) => w.sourceRange.startUs >= 98_000_000 && w.sourceRange.endUs <= 105_000_000,
    ),
    removalIntent: "unverified",
  },
  pacing: {
    authority: "ASR word placements only; cannot establish desired pacing or pause removal intent",
  },
  cleanupAcceptance: "incomplete",
  listening: "not performed",
  independentVisualReview: "not performed",
  calls,
  clips,
  missing: labels.missing,
  baselineFiles: {
    marks: hash(join(baselineFolder, "marks.json")),
    transcript: hash(join(baselineFolder, "transcript.json")),
    labels: hash(labelsPath),
  },
};
save("manifest.json", report);
console.log(
  JSON.stringify(
    {
      output,
      marked: timing.marked,
      matched: timing.matched,
      medianErrorMs: timing.medianErrorMs,
      p95ErrorMs: timing.p95ErrorMs,
      meetsTiming: timing.meetsTiming,
      cleanupAcceptance: report.cleanupAcceptance,
    },
    null,
    2,
  ),
);
