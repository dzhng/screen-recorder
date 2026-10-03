import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { evaluateAlignment } from "./evaluate.mjs";

const human = JSON.parse(
  await readFile(new URL("../12d-human-marks/human-marks.json", import.meta.url)),
);
const raw = JSON.parse(
  await readFile(
    "/Users/david/.cache/screen-recorder/verification/sentence-12h-2591aa28/evidence/raw.jsonl",
  ),
);
const original = JSON.parse(
  await readFile(
    "/Users/david/.cache/screen-recorder/verification/sentence-12h-2591aa28/evidence/evaluation.json",
  ),
);
const supplied = raw.words.map((word) => ({ type: "word", text: word.text }));
// A synthetic perfect-mark candidate tests the evaluator, never human/model quality.
const perfect = {
  duration: 7.14,
  words: raw.words.map((word) => {
    const mark = human.marks.find(
      (mark) => mark.text.toLowerCase() === word.text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""),
    );
    return {
      word: word.text,
      start: mark ? (mark.startUs - 50_518_675) / 1_000_000 : word.spokenStartSeconds,
      end: mark ? (mark.endUs - 50_518_675) / 1_000_000 : word.spokenEndSeconds,
    };
  }),
};

test("complete synthetic candidate retains every word and all six signed comparisons", () => {
  const result = evaluateAlignment(perfect, supplied, human, original);
  assert.deepEqual(result.returned, perfect);
  assert.deepEqual(result.supplied, supplied);
  assert.deepEqual(
    result.correspondence.map((word) => [
      word.supplied,
      word.returned,
      word.textEqual,
      word.spanValid,
    ]),
    supplied.map((word) => [word.text, word.text, true, true]),
  );
  assert.equal(result.meetsScopedTiming, true);
  assert.deepEqual(
    result.comparison.map((edge) => [edge.id, edge.errorMs, edge.originalErrorMs, edge.regressed]),
    original.controls.boundaries.map((edge) => [edge.id, 0, edge.errorMs, false]),
  );
  assert.equal(result.openingUm.end.errorMs, 0);
  assert.equal(result.openingUm.onsetScored, false);
  assert.equal(result.adoption, false);
});

test("good marked timing cannot hide a changed unmarked word or out-of-support span", () => {
  for (const alter of [(word) => ({ ...word, word: "thus" }), (word) => ({ ...word, end: 7.15 })]) {
    const candidate = structuredClone(perfect);
    candidate.words[1] = alter(candidate.words[1]);
    const result = evaluateAlignment(candidate, supplied, human, original);
    assert.equal(result.controls.meetsTiming, true);
    assert.equal(result.completeCorrespondence, false);
    assert.equal(result.meetsScopedTiming, false);
    assert.deepEqual(result.returned, candidate);
  }
});
