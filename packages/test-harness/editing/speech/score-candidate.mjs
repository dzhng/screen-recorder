// Research-only adapter: shared scorer owns matching, completeness and thresholds.
import { readFileSync } from "node:fs";
import { scoreBoundaries } from "./boundaries.mjs";
const [candidatePath, marksPath, labelsPath] = process.argv.slice(2);
if (!candidatePath || !marksPath || !labelsPath)
  throw new Error("Pass candidate result.json, frozen marks.json and speech-labels.json");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const candidate = read(candidatePath);
const labels = read(labelsPath);
const originUs = labels.narrationFileOriginUs;
if (!Number.isSafeInteger(originUs)) throw new Error("Missing frozen source clock origin");
const words = candidate.words.map(({ word, start, end }) => {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end > candidate.duration)
    throw new Error("Candidate contains an invalid or unplaced word range");
  return { text: word, sourceRange: {
    startUs: originUs + Math.round(start * 1_000_000),
    endUs: originUs + Math.round(end * 1_000_000),
  } };
});
const score = scoreBoundaries(read(marksPath).boundaries, words);
// Avoid redistributing the research-restricted generated transcript.
const boundaries = score.boundaries.map(({ id, side, state, errorMs, insideSpeech }) =>
  ({ id, side, state, errorMs, ...(insideSpeech === undefined ? {} : { insideSpeech }) }));
console.log(JSON.stringify({ ...score, boundaries, wordCount: words.length,
  fullFillerPrecision: null, fullFillerRecall: null,
  editorialRepetitionIntent: "unverified", listening: "not performed" }, null, 2));
