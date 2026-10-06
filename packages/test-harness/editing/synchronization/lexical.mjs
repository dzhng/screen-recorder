import { foldWord } from "../../../core/src/word-kind.ts";

/** Lexical prerequisites only: timestamps cannot turn these candidates into a clock. */
export function lexicalCandidates(left, right, width = 5, distinct = 3) {
  function index(windows) {
    const result = new Map();
    for (const window of windows) {
      const folded = window.words.map((word) => foldWord(word.text));
      for (let at = 0; at + width <= folded.length; at++) {
        const phrase = folded.slice(at, at + width);
        if (phrase.some((word) => !word) || new Set(phrase).size < distinct) continue;
        const key = JSON.stringify(phrase);
        const occurrences = result.get(key) ?? [];
        occurrences.push({ window: window.name, originUs: window.originUs, wordIndex: at });
        result.set(key, occurrences);
      }
    }
    return result;
  }
  const a = index(left);
  const b = index(right);
  const unique = [];
  const ambiguous = [];
  for (const [key, occurrences] of a) {
    const other = b.get(key);
    if (!other) continue;
    const phrase = JSON.parse(key);
    if (occurrences.length === 1 && other.length === 1)
      unique.push({ phrase, left: occurrences[0], right: other[0] });
    else ambiguous.push({ phrase, left: occurrences, right: other });
  }
  return { unique, ambiguous };
}
