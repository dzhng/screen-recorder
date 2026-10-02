import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateAlignment } from "./evaluate.mjs";

const namespace = process.argv[2];
assert(
  namespace?.startsWith("/"),
  "Pass the retained namespace; verifier never launches a producer",
);
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const prep = await json(join(namespace, "evidence/report.json"));
const report = await json(join(namespace, "case/report.json"));
const candidate = await json(join(namespace, "candidate/result.json"));
const manifest = await json(join(namespace, "candidate/manifest.json"));
const supplied = await json(join(namespace, "input/supplied-text.json"));
const raw = await json(
  "/Users/david/.cache/screen-recorder/verification/sentence-12h-2591aa28/evidence/raw.jsonl",
);
const original = await json(
  "/Users/david/.cache/screen-recorder/verification/sentence-12h-2591aa28/evidence/evaluation.json",
);
const human = await json(new URL("../12d-human-marks/human-marks.json", import.meta.url));

assert.equal(report.conversionAttempts, 1);
assert.equal(report.alignmentAttempts, 1);
assert.deepEqual(
  report.children.map((child) => [
    child.name,
    child.exitCode,
    child.signal,
    child.deadlineExceeded,
  ]),
  [
    ["conversion", 0, null, false],
    ["alignment", 0, null, false],
  ],
);
assert.equal(report.preserved, true);
assert.deepEqual(report.before, report.after);
assert.deepEqual(
  report.modelBefore,
  prep.model.files.map((file) => ({ ...file, path: join(namespace, "model", file.path) })),
);
assert.deepEqual(report.modelBefore, report.modelAfter);
assert.deepEqual(report.modelBefore, report.modelPreLoad);
assert.deepEqual(report.runtimeBefore, report.runtimeAfter);
assert.deepEqual(report.runtimeBefore, report.runtimePreLoad);
assert.deepEqual(
  supplied,
  raw.words.map((word) => ({ type: "word", text: word.text })),
);
assert.equal(manifest.audioSha256, report.converted.file.sha256);
assert.equal(manifest.transcriptSha256, prep.suppliedText.sha256);
assert.equal(manifest.suppliedTextSha256, prep.suppliedText.joinedTextSha256);
assert.equal(manifest.runnerSha256, prep.runner.sha256);
assert.deepEqual(manifest.runtime, prep.runtime.versions);
assert.deepEqual(manifest.settings, { device: "mps", dtype: "float16", language: "English" });
assert.deepEqual(manifest.modelFiles, [], "Preserve the actually received incomplete inventory");
assert.match(report.error.traceback, /candidate_manifest\['modelFiles'\]/);
const resources = {
  kernelPeakResidentBytes: report.children.find((child) => child.name === "alignment")
    .peakResidentBytes,
  runnerPeakResidentBytes: manifest.peakResidentBytes,
  ceilingBytes: 4 * 1024 ** 3,
};
resources.meets =
  Math.max(resources.kernelPeakResidentBytes, resources.runnerPeakResidentBytes) <=
  resources.ceilingBytes;
const evaluation = evaluateAlignment(candidate, supplied, human, original);
const bytes = await readFile(fileURLToPath(import.meta.url));
const verification = {
  scope:
    "Post-run saved evidence qualification; original failed producer and runner receipt untouched",
  verifier: {
    path: fileURLToPath(import.meta.url),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  },
  originalProducerState: report.state,
  originalProducerError: report.error,
  receivedRunnerModelInventory: manifest.modelFiles,
  modelAuthority:
    "Existing pre/pre-load/post-load complete model byte pins, not a filled runner receipt",
  originalAndPreparedBytesPreserved: report.preserved,
  resources,
  evaluation,
  savedNumericalCaseMeetsCriteria: resources.meets && evaluation.meetsScopedTiming,
  originalProducerPassed: false,
  adoption: false,
};
console.log(JSON.stringify(verification, null, 2));
assert.equal(evaluation.completeCorrespondence, true);
assert.equal(resources.meets, true);
