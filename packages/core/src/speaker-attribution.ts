import { compare, fromTime, type SelectionRange } from "@yap/composition";

export type SpeakerTurn = {
  slot: number;
  sourceRange: SelectionRange;
};

export type SpeakerAttribution =
  | { state: "attributed"; slot: number; displayName?: string }
  | { state: "overlap"; slots: number[] }
  | { state: "unknown" };

export type AttributableTranscriptWord = {
  id: string;
  sourceRange: SelectionRange;
};

export type SpeakerAttributionOptions = {
  labels?: ReadonlyMap<number, string>;
};

/**
 * Join transcript words to retained acoustic turns without guessing.
 * A word is attributable only when one turn wholly covers its source range.
 * Crossing a turn boundary, falling in an observation gap, or meeting multiple
 * turns stays explicit as unknown/overlap evidence.
 */
export function attributeTranscriptWords<T extends AttributableTranscriptWord>(
  words: readonly T[],
  turns: readonly SpeakerTurn[],
  options: SpeakerAttributionOptions = {},
): (T & { speaker: SpeakerAttribution })[] {
  return words.map((word) => {
    const matches = turns
      .filter((turn) => whollyCovered(word.sourceRange, turn.sourceRange))
      .map((turn) => turn.slot)
      .filter((slot, index, slots) => slots.indexOf(slot) === index)
      .sort((a, b) => a - b);
    const speaker: SpeakerAttribution =
      matches.length === 1
        ? {
            state: "attributed",
            slot: matches[0]!,
            ...(options.labels?.has(matches[0]!)
              ? { displayName: options.labels.get(matches[0]!)! }
              : {}),
          }
        : matches.length > 1
          ? { state: "overlap", slots: matches }
          : { state: "unknown" };
    return { ...word, speaker };
  });
}

function whollyCovered(word: SelectionRange, turn: SelectionRange): boolean {
  const wordStart = fromTime(word.startUs);
  const wordEnd = fromTime(word.endUs);
  const turnStart = fromTime(turn.startUs);
  const turnEnd = fromTime(turn.endUs);
  return compare(wordStart, wordEnd) === 0
    ? compare(turnStart, wordStart) <= 0 && compare(wordStart, turnEnd) < 0
    : compare(turnStart, wordStart) <= 0 && compare(wordEnd, turnEnd) <= 0;
}
