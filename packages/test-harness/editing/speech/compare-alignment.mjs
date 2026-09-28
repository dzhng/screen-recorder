// Full-word comparison for the frozen text-only alignment trial; timing gates stay in the shared scorer.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
const root = new URL("../../../../", import.meta.url).pathname;
const folder = resolve(process.argv[2]);
const outputFolder = resolve(process.argv[3] ?? folder);
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const contract = read(join(folder, "contract.json"));
const controlPath = join(folder, contract.control);
assert.equal(hash(controlPath), contract.controlSha256);
const originalPath = join(root, "specs/agent-editing/assets/12-speech/transcript.json");
assert.equal(hash(originalPath), contract.baselineTranscriptSha256);
assert.equal(hash(join(folder, "supplied-transcript.json")), contract.candidateTranscriptSha256);
const marksPath = join(root, "specs/recording-for-ai/assets/speech/boundaries/marks.json");
const labelsPath = join(root, "specs/agent-editing/assets/00-baseline/speech-labels.json");
assert.equal(hash(marksPath), contract.marksSha256);
assert.equal(hash(labelsPath), contract.labelsSha256);
const original = read(originalPath).filter((row) => row.type === "word");
const supplied = read(join(folder, "supplied-transcript.json")).filter(
  (row) => row.type === "word",
);
const insertion = original.findIndex((word) => word.id === contract.insertion.beforeWordId);
assert.ok(insertion >= 0);
assert.equal(supplied[insertion].text, contract.insertion.word);
assert.deepEqual(
  supplied.filter((_, index) => index !== insertion),
  original,
);
const control = read(controlPath).words;
const candidate = read(join(outputFolder, "result.json")).words;
assert.equal(control.length, contract.requiredOriginalWords);
assert.equal(candidate.length, control.length + 1);
assert.equal(candidate[insertion].word, contract.insertion.word);
const retained = candidate.filter((_, index) => index !== insertion);
assert.deepEqual(
  retained.map((word) => word.word),
  control.map((word) => word.word),
  "Original supplied-word sequence must survive the insertion",
);
const origin = read(labelsPath).narrationFileOriginUs;
const range = (word) => ({
  startUs: origin + Math.round(word.start * 1e6),
  endUs: origin + Math.round(word.end * 1e6),
});
const prior = read(join(folder, "../12-alignment/score.json"));
const score = read(join(outputFolder, "score.json"));
const markedEdges = score.boundaries.map((edge, index) => {
  const before = prior.boundaries[index];
  assert.equal(edge.id, before.id);
  assert.equal(edge.side, before.side);
  assert.equal(edge.state, "matched");
  return {
    id: edge.id,
    side: edge.side,
    controlErrorMs: before.errorMs,
    candidateErrorMs: edge.errorMs,
  };
});
const words = original.map((word, index) => {
  const before = range(control[index]),
    after = range(retained[index]);
  return {
    id: word.id,
    text: word.text,
    control: before,
    candidate: after,
    deltaMs: {
      start: (after.startUs - before.startUs) / 1000,
      end: (after.endUs - before.endUs) / 1000,
    },
    independentEdges: markedEdges.filter((edge) => edge.id === word.id),
  };
});
const changed = words.filter((word) => word.deltaMs.start || word.deltaMs.end);
console.log(
  JSON.stringify(
    {
      inputCondition: contract.insertion,
      completeOriginalWordSequence: true,
      originalWordCount: words.length,
      insertedWord: {
        text: candidate[insertion].word,
        sourceRange: range(candidate[insertion]),
        authority: "supplied hypothesis; not independently labeled",
      },
      changedWords: changed,
      unchangedWordCount: words.length - changed.length,
      markedEdges,
      context: {
        authority: "ASR-proposed neighbors; independent protected-word labels remain unavailable",
        words: words.slice(insertion - 3, insertion + 6),
      },
      fullComparison: words,
    },
    null,
    2,
  ),
);
