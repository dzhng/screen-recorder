export const wordKindPolicy = "word-kind-v1";
export function foldWord(text) {
  return text.toLowerCase().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, "");
}
const fillers = new Set(["um", "umm", "uh", "uhm", "er", "erm", "ah"]);
const vocalizations = new Set(["hmm", "mm", "mhm", "mm-hmm", "uh-huh", "huh"]);
export function wordKind(text) {
  const folded = foldWord(text);
  return fillers.has(folded) ? "filler" : vocalizations.has(folded) ? "vocalization" : "speech";
}
