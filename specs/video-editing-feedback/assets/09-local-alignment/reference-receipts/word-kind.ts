export const wordKindPolicy = "word-kind-v1";
export type WordKind = "speech" | "filler" | "vocalization";

/** Classification and literal search compare this form, so a query matches whatever a kind names. */
export function foldWord(text: string): string {
  return text.toLowerCase().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, "");
}

const fillers = new Set(["um", "umm", "uh", "uhm", "er", "erm", "ah"]);
const vocalizations = new Set(["hmm", "mm", "mhm", "mm-hmm", "uh-huh", "huh"]);

/** A fixed rule over the emitted text; it never infers a filler the engine did not write. */
export function wordKind(text: string): WordKind {
  const folded = foldWord(text);
  return fillers.has(folded) ? "filler" : vocalizations.has(folded) ? "vocalization" : "speech";
}
