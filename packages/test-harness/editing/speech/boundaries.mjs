const token = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** Match only a unique same-word edge near a frozen mark; omissions/ambiguity cannot earn a pass. */
export function scoreBoundaries(marks, words) {
  const boundaries = marks
    .filter((mark) => typeof mark.markedOffsetMs === "number")
    .map((mark) => {
      const referenceUs = mark.reportedUs + mark.markedOffsetMs * 1000;
      const key = mark.side === "start" ? "startUs" : "endUs";
      const candidates = words.filter(
        (word) =>
          token(word.text) === token(mark.text) &&
          Math.abs(word.sourceRange[key] - referenceUs) <= 1_500_000,
      );
      if (candidates.length !== 1)
        return {
          ...mark,
          referenceUs,
          state: candidates.length ? "ambiguous" : "missing",
          errorMs: null,
        };
      const reportedUs = candidates[0].sourceRange[key];
      const errorMs = (reportedUs - referenceUs) / 1000;
      return {
        ...mark,
        referenceUs,
        candidateUs: reportedUs,
        state: "matched",
        errorMs,
        insideSpeech: mark.side === "start" ? errorMs > 0 : errorMs < 0,
      };
    });
  const errors = boundaries
    .filter((b) => b.state === "matched")
    .map((b) => Math.abs(b.errorMs))
    .sort((a, b) => a - b);
  const quantile = (p) => {
    if (!errors.length) return null;
    const at = p * (errors.length - 1),
      low = Math.floor(at),
      high = Math.ceil(at);
    return Math.round((errors[low] + (errors[high] - errors[low]) * (at - low)) * 10) / 10;
  };
  const complete = errors.length === boundaries.length && boundaries.length > 0;
  const medianErrorMs = quantile(0.5),
    p95ErrorMs = quantile(0.95);
  return {
    marked: boundaries.length,
    matched: errors.length,
    unmarked: marks.length - boundaries.length,
    medianErrorMs,
    p95ErrorMs,
    worstErrorMs: errors.at(-1) ?? null,
    meetsTiming: complete && medianErrorMs <= 100 && p95ErrorMs <= 250,
    interpretation: "Only inherited visually marked edges; not a complete word/filler evaluation.",
    boundaries,
  };
}
