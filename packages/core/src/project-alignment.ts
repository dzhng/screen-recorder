import {
  add,
  compare,
  divide,
  fromTime,
  multiply,
  subtract,
  toTime,
  type Rational,
  type SelectionRange,
  type SourceWindowOccurrence,
} from "@yap/composition";
import type { AlignmentAcoustic, AlignmentScore, AlignmentWord } from "./alignment-operands.js";

type AlignmentRow = AlignmentWord | AlignmentAcoustic | AlignmentScore;
type SourceRange = SelectionRange;
type ProjectedRange = SelectionRange;
export type ProjectedAlignmentRow = {
  row: AlignmentRow;
  occurrence: Pick<
    SourceWindowOccurrence,
    "clipId" | "assetId" | "streamId" | "trackId" | "trackRank"
  > | null;
  sourceRanges: SourceRange[];
  projectRanges: ProjectedRange[];
};

function range(row: AlignmentRow): SourceRange | null {
  if ("timing" in row) return row.timing?.sourceRange ?? null;
  return row.sourceRange;
}
function interpolate(
  value: Rational,
  source: { start: Rational; end: Rational },
  project: { start: Rational; end: Rational },
) {
  const sourceLength = subtract(source.end, source.start);
  if (sourceLength.numerator <= 0n) return project.start;
  return add(
    project.start,
    multiply(
      subtract(value, source.start),
      divide(subtract(project.end, project.start), sourceLength),
    ),
  );
}
function overlap(a: SourceRange, b: { start: Rational; end: Rational }) {
  const start = fromTime(a.startUs),
    end = fromTime(a.endUs);
  const left = compare(start, b.start) > 0 ? start : b.start;
  const right = compare(end, b.end) < 0 ? end : b.end;
  return compare(left, right) < 0 ? { start: left, end: right } : null;
}
/** Project retained source rows through exact revision occurrences without changing source timing. */
export function projectAlignmentRows(
  rows: readonly AlignmentRow[],
  occurrences: readonly SourceWindowOccurrence[],
): ProjectedAlignmentRow[] {
  const projected: ProjectedAlignmentRow[] = [];
  for (const row of rows) {
    const source = range(row);
    if (!source) continue;
    for (const occurrence of occurrences) {
      const sourceRanges: SourceRange[] = [];
      const projectRanges: ProjectedRange[] = [];
      for (const fragment of occurrence.fragments) {
        const selected = overlap(source, fragment.source);
        if (!selected) continue;
        const start = interpolate(selected.start, fragment.source, fragment.project);
        const end = interpolate(selected.end, fragment.source, fragment.project);
        sourceRanges.push({ startUs: toTime(selected.start), endUs: toTime(selected.end) });
        projectRanges.push({ startUs: toTime(start), endUs: toTime(end) });
      }
      if (projectRanges.length)
        projected.push({
          row,
          occurrence: {
            clipId: occurrence.clipId,
            assetId: occurrence.assetId,
            streamId: occurrence.streamId,
            trackId: occurrence.trackId,
            trackRank: occurrence.trackRank,
          },
          sourceRanges,
          projectRanges,
        });
    }
  }
  return projected;
}

/** Project rows measured from a prepared tap; the rendered signal has project time but no source clip. */
export function projectTapAlignmentRows(
  rows: readonly AlignmentRow[],
  projectRange: SourceRange,
): ProjectedAlignmentRow[] {
  const projected: ProjectedAlignmentRow[] = [];
  for (const row of rows) {
    const source = range(row);
    if (!source) continue;
    const selected = overlap(source, {
      start: fromTime(projectRange.startUs),
      end: fromTime(projectRange.endUs),
    });
    if (!selected) continue;
    const mapped = {
      startUs: toTime(selected.start),
      endUs: toTime(selected.end),
    };
    projected.push({ row, occurrence: null, sourceRanges: [mapped], projectRanges: [mapped] });
  }
  return projected;
}
