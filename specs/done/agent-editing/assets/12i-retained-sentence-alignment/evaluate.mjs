import { scoreBoundaries } from "../../../../packages/test-harness/editing/speech/boundaries.mjs";

const normalized = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** Compare the supplied-text candidate; reference marks never enter alignment. */
export function evaluateAlignment(candidate, supplied, human, original) {
  const correspondence = candidate.words.map((word, index) => ({
    index,
    supplied: supplied[index]?.text ?? null,
    returned: word.word,
    start: word.start,
    end: word.end,
    textEqual:
      typeof word.word === "string" &&
      supplied[index] !== undefined &&
      normalized(word.word) === normalized(supplied[index].text),
    spanValid:
      Number.isFinite(word.start) &&
      Number.isFinite(word.end) &&
      word.start >= 0 &&
      word.end >= word.start &&
      word.end <= 7.14,
  }));
  const completeCorrespondence =
    candidate.duration === 7.14 &&
    candidate.words.length === supplied.length &&
    correspondence.every((word) => word.textEqual && word.spanValid);
  const words = candidate.words.map((word) => ({
    text: typeof word.word === "string" ? word.word : "",
    sourceRange: {
      startUs: 50_518_675 + Math.round(word.start * 1_000_000),
      endUs: 50_518_675 + Math.round(word.end * 1_000_000),
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
  const comparison = controls.boundaries.map((edge) => {
    const previous = original.controls.boundaries.find((prior) => prior.id === edge.id);
    return {
      ...edge,
      originalErrorMs: previous.errorMs,
      absoluteErrorChangeMs:
        edge.errorMs === null ? null : Math.abs(edge.errorMs) - Math.abs(previous.errorMs),
      regressed: edge.errorMs !== null && Math.abs(edge.errorMs) > Math.abs(previous.errorMs),
    };
  });
  const opening = human.marks.find((mark) => mark.id === "opening-um");
  const umEnd = scoreBoundaries(
    [
      {
        id: "opening-um-end",
        text: "um",
        side: "end",
        reportedUs: opening.endUs,
        markedOffsetMs: 0,
      },
    ],
    words,
  ).boundaries[0];
  return {
    scope: "One supplied-text sentence timing diagnostic; not recognition or quality acceptance",
    supplied,
    returned: candidate,
    correspondence,
    completeCorrespondence,
    words,
    controls,
    comparison,
    individualRegressions: comparison.filter((edge) => edge.regressed),
    originalSummary: {
      medianErrorMs: original.controls.medianErrorMs,
      p95ErrorMs: original.controls.p95ErrorMs,
      worstErrorMs: original.controls.worstErrorMs,
    },
    openingUm: {
      end: umEnd,
      originalErrorMs: original.openingUm.end.errorMs,
      absoluteErrorChangeMs:
        umEnd.errorMs === null
          ? null
          : Math.abs(umEnd.errorMs) - Math.abs(original.openingUm.end.errorMs),
      regressed:
        umEnd.errorMs !== null &&
        Math.abs(umEnd.errorMs) > Math.abs(original.openingUm.end.errorMs),
      onsetScored: false,
      onsetAuthority: "Clip-censored; no independent onset value",
    },
    meetsScopedTiming: completeCorrespondence && controls.meetsTiming,
    adoption: false,
  };
}
