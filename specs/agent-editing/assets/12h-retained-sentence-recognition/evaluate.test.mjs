import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateSentence } from "./evaluate.mjs";

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const human = await json("../12d-human-marks/human-marks.json");
const inherited = (await json("../12-speech/transcript.json")).slice(111, 124);
const frozen = JSON.parse(
  (await readFile(new URL("../12-speech/raw.jsonl", import.meta.url), "utf8")).trim(),
);
const sentence = {
  result: frozen.result,
  words: frozen.words.slice(111, 124).map((word) => ({
    ...word,
    source: { startUs: word.source.startUs - 50_518_675, endUs: word.source.endUs - 50_518_675 },
  })),
};

test("saved recognizer omission fails recovery while exact human edge errors retain their source clock", () => {
  const result = evaluateSentence(sentence, human, inherited);
  assert.equal(result.openingUm.recognized, false);
  assert.equal(result.openingUm.end.state, "missing");
  assert.equal(result.openingUm.onsetScored, false);
  assert.equal(result.inheritedSequence.preserved, true);
  assert.deepEqual(
    result.controls.boundaries.map(({ id, candidateUs, errorMs }) => ({
      id,
      candidateUs,
      errorMs,
    })),
    [
      { id: "w117-start", candidateUs: 54128675, errorMs: 15 },
      { id: "w117-end", candidateUs: 54448675, errorMs: -60 },
      { id: "w116-start", candidateUs: 52288675, errorMs: -140 },
      { id: "w116-end", candidateUs: 53088675, errorMs: 159 },
      { id: "w118-start", candidateUs: 55088675, errorMs: -170 },
      { id: "w118-end", candidateUs: 55408675, errorMs: 41 },
    ],
  );
  assert.equal(result.meetsScopedCase, false);
});

test("synthetic exact um witness can pass, but uh cannot stand in for the missing word", () => {
  for (const text of ["um", "uh"]) {
    const result = evaluateSentence(
      {
        result: { text: `${text}, ${sentence.result.text}` },
        words: [{ text, source: { startUs: 0, endUs: 313000 } }, ...sentence.words],
      },
      human,
      inherited,
    );
    assert.equal(result.openingUm.recognized, text === "um");
    assert.equal(result.meetsScopedCase, text === "um");
  }
});

test("a missing protected word remains a failed complete-value regression", () => {
  const result = evaluateSentence(
    {
      result: { text: `um, ${sentence.result.text}` },
      words: [
        { text: "um", source: { startUs: 0, endUs: 313000 } },
        ...sentence.words.filter((word) => word.text !== "this"),
      ],
    },
    human,
    inherited,
  );
  assert.equal(result.protectedAndMiddlePresence.this, false);
  assert.equal(result.inheritedSequence.preserved, false);
  assert.equal(result.controls.boundaries.find((x) => x.id === "w118-start").state, "missing");
  assert.equal(result.meetsScopedCase, false);
});
