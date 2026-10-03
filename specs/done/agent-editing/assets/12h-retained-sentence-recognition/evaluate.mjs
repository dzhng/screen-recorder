import { scoreBoundaries } from "../../../../packages/test-harness/editing/speech/boundaries.mjs";

const normalized = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** The existing human sentence marks own truth; inherited words are a regression diagnostic. */
export function evaluateSentence(segment, human, inherited) {
  const words = segment.words.map((word) => ({
    text: word.text,
    sourceRange: {
      startUs: word.source.startUs + 50_518_675,
      endUs: word.source.endUs + 50_518_675,
    },
  }));
  const marks = human.marks
    .filter((mark) => ["w116", "w117", "w118"].includes(mark.id))
    .flatMap((mark) =>
      ["start", "end"].map((side) => ({
        id: `${mark.id}-${side}`,
        wordId: mark.id,
        text: mark.text,
        side,
        reportedUs: mark[`${side}Us`],
        markedOffsetMs: 0,
      })),
    );
  const controls = scoreBoundaries(marks, words);
  controls.interpretation =
    "Six existing independent sentence edges; workbench is outside this case.";
  const umEnd = scoreBoundaries(
    [{ id: "opening-um-end", text: "um", side: "end", reportedUs: 50_831_675, markedOffsetMs: 0 }],
    words,
  ).boundaries[0];
  const firstSo = words.findIndex((word) => normalized(word.text) === "so");
  const targetUms = words.filter(
    (word, index) =>
      normalized(word.text) === "um" &&
      index < firstSo &&
      word.sourceRange.startUs < 50_831_675 &&
      word.sourceRange.endUs > 50_518_675,
  );
  const rawHasUm = /\bum\b/i.test(segment.result.text);
  const observed = words.map((word) => normalized(word.text));
  const expected = inherited.map((word) => normalized(word.text));
  const withoutOpeningUm = observed.filter(
    (_, index) => !(index < firstSo && observed[index] === "um"),
  );
  const inheritedSequencePreserved = JSON.stringify(withoutOpeningUm) === JSON.stringify(expected);
  const presence = Object.fromEntries(
    ["paragraph", "this", "uh"].map((text) => [text, observed.includes(text)]),
  );
  return {
    words,
    openingUm: {
      recognized: rawHasUm && targetUms.length === 1,
      rawHasUm,
      targetUms,
      end: umEnd,
      onsetScored: false,
    },
    protectedAndMiddlePresence: presence,
    controls,
    inheritedSequence: {
      expected,
      observed,
      withoutOpeningUm,
      preserved: inheritedSequencePreserved,
      authority: "Baseline output regression diagnostic; not independent spelling truth",
    },
    meetsScopedCase:
      rawHasUm &&
      targetUms.length === 1 &&
      Object.values(presence).every(Boolean) &&
      controls.meetsTiming &&
      inheritedSequencePreserved,
    adoption: false,
  };
}
