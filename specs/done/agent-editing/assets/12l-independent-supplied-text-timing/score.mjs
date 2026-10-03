import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  evaluate,
  evaluateLexical,
  alignWords,
  normalizeWord,
} from "../../../../packages/test-harness/speech/evaluate.mjs";

const out =
  "/Users/david/.codex/artifacts/screen-recorder/speech-corpora/l2-arctic-alignment-timing-12l";
const prior =
  "/Users/david/.codex/artifacts/screen-recorder/speech-corpora/l2-arctic-word-timing-12k-reference-continuation";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const pin = async (path) => {
  const bytes = await readFile(path);
  return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
};
const report = {
  scope: "Private complete manual-edge scoring; no corpus redistribution",
  producer: await pin(new URL(import.meta.url).pathname),
};
try {
  const execution = await read(join(out, "report.json"));
  assert(execution.preserved && !execution.error);
  const candidate = await read(join(out, "candidate/result.json"));
  const supplied = await read(join(out, "supplied-text.json"));
  assert.equal(candidate.duration, execution.clock.outputDurationSeconds);
  assert.equal(candidate.words.length, supplied.length);
  let last = -1;
  const prediction = candidate.words.map((word, index) => {
    assert.equal(normalizeWord(word.word), normalizeWord(supplied[index].text));
    assert(Number.isFinite(word.start) && Number.isFinite(word.end));
    assert(
      word.start >= 0 &&
        word.start >= last &&
        word.end >= word.start &&
        word.end <= candidate.duration,
    );
    last = word.start;
    return { text: word.word, start: word.start, end: word.end };
  });
  // Human intervals are read only after the immutable alignment result exists.
  const dataset = await read(join(prior, "reference.json"));
  const baseline = await read(join(prior, "report.json"));
  const baselineRun = await read(join(prior, "normalized-run.json"));
  report.reference = await pin(join(prior, "reference.json"));
  report.baseline = await pin(join(prior, "report.json"));
  const preparationPin = execution.before.protected.find((item) =>
    item.path.endsWith("/evidence/report.json"),
  );
  const preparation = await read(preparationPin.path);
  const run = {
    clipId: dataset.clips[0].id,
    audioSha256: dataset.clips[0].audioSha256,
    engine: "qwen3-forced-aligner",
    modelRevision: preparation.model.revision,
    runtimeRevision: `torch${preparation.runtime.versions.torch}/transformers${preparation.runtime.versions.transformers}`,
    binarySha256: preparation.runtime.interpreter.sha256,
    network: "sandbox-deny-network",
    words: prediction,
  };
  report.completeOrderedCorrespondence = true;
  report.actualCandidate = candidate;
  report.normalizedRun = run;
  report.evaluation = evaluate(dataset, [run]);
  report.lexical = evaluateLexical(dataset.clips[0].words, prediction);
  const matches = alignWords(
    dataset.clips[0].words,
    prediction,
    (a, b) => Math.abs(a.start - b.start) + Math.abs(a.end - b.end),
  );
  report.edges = matches.reverse().flatMap(([i, j]) =>
    ["start", "end"].map((side) => {
      const reference = dataset.clips[0].words[i];
      const original = baselineRun.words[i];
      assert.equal(normalizeWord(original.text), normalizeWord(reference.text));
      const candidateErrorSeconds = prediction[j][side] - reference[side];
      const originalErrorSeconds = original[side] - reference[side];
      return {
        referenceWordIndex: i,
        text: reference.text,
        side,
        referenceSeconds: reference[side],
        candidateSeconds: prediction[j][side],
        originalSeconds: original[side],
        candidateErrorSeconds,
        originalErrorSeconds,
        signedDifferenceSeconds: candidateErrorSeconds - originalErrorSeconds,
        absoluteErrorChangeSeconds:
          Math.abs(candidateErrorSeconds) - Math.abs(originalErrorSeconds),
        regressed: Math.abs(candidateErrorSeconds) > Math.abs(originalErrorSeconds),
      };
    }),
  );
  assert.equal(report.edges.length, 10);
  assert.equal(report.edges.length, report.evaluation.boundaries.samples);
  report.maximumErrorSeconds = Math.max(
    ...report.edges.map((edge) => Math.abs(edge.candidateErrorSeconds)),
  );
  report.individualRegressions = report.edges.filter((edge) => edge.regressed);
  report.baselineSummary = { ...baseline.evaluation.boundaries, max: baseline.boundaryMaxSeconds };
  report.scopedTimingMeets =
    report.completeOrderedCorrespondence && report.evaluation.failures.length === 0;
  report.status = "Complete fixed-case characterization; full evaluator verdict retained";
} catch (error) {
  report.status = "Saved candidate qualification failed; no retry or span adjustment";
  report.error = String(error);
}
await writeFile(join(out, "scoring.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    status: report.status,
    error: report.error ?? null,
    lexical: report.lexical,
    boundaries: report.evaluation?.boundaries,
    max: report.maximumErrorSeconds,
    regressions: report.individualRegressions?.length,
    evaluation: report.evaluation?.status,
  }),
);
process.exitCode = report.error ? 1 : 0;
