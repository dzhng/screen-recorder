import { clipGraph } from "./clip-graph.js";
import {
  sourceTime,
  intersection,
  intersectAll,
  type ValidatedComposition,
  type ExactRange,
} from "./model.js";
import {
  compare,
  fromTime,
  divide,
  subtract,
  type Rational,
  toTime,
  toFraction,
} from "./rational.js";
import { isMediaClip, type Clip, type TimeValue } from "./schema.js";

type Resolved = ValidatedComposition["clips"][number];
type Piece = { clip: Readonly<Clip>; range: ExactRange };
const stored = (range: ExactRange) => ({ startUs: toTime(range.start), endUs: toTime(range.end) });
function union(ranges: readonly ExactRange[]): ExactRange[] {
  const result: ExactRange[] = [];
  for (const range of [...ranges].sort((a, b) => compare(a.start, b.start))) {
    const last = result.at(-1);
    if (last && compare(range.start, last.end) <= 0)
      result[result.length - 1] = {
        start: last.start,
        end: compare(last.end, range.end) > 0 ? last.end : range.end,
      };
    else result.push(range);
  }
  return result;
}

/** Restrict original affine mappings and rebase attachments onto their surviving parent pieces. */
export function partitionClips(
  model: ValidatedComposition,
  selected: readonly string[],
  operation: { scope: "linked" | "selected" } & (
    | { kind: "split"; atUs: TimeValue }
    | { kind: "remove"; ranges?: readonly ExactRange[] }
  ),
  allocate: (kind: "clip" | "syncGroup") => string,
) {
  const { children, expand } = clipGraph(model);
  const affected = expand(selected, operation.scope === "linked");
  const original = new Map(model.clips.map((value) => [value.clip.id, value]));
  let removals: ExactRange[] = [];
  if (operation.kind === "remove") {
    const selectedRanges = union(
      model.clips.filter((value) => affected.has(value.clip.id)).map((value) => value.range),
    );
    removals = operation.ranges
      ? intersectAll(selectedRanges, union(operation.ranges))
      : selectedRanges;
  }
  const cuts =
    operation.kind === "split"
      ? [fromTime(operation.atUs)]
      : removals.flatMap((range) => [range.start, range.end]);
  // Removal partitions linked counterparts too, but only deletes the requested scope.
  const partitioned = operation.kind === "remove" ? expand(affected, true) : affected;
  const afterCut = (at: Rational) => {
    let lo = 0,
      hi = cuts.length;
    while (lo < hi) {
      const middle = (lo + hi) >>> 1;
      if (compare(cuts[middle]!, at) <= 0) lo = middle + 1;
      else hi = middle;
    }
    return lo;
  };
  const removed = (at: Rational) => {
    let lo = 0,
      hi = removals.length;
    while (lo < hi) {
      const middle = (lo + hi) >>> 1;
      if (compare(removals[middle]!.end, at) <= 0) lo = middle + 1;
      else hi = middle;
    }
    return lo < removals.length && compare(removals[lo]!.start, at) <= 0;
  };
  const pieces = new Map<string, Piece[]>();
  const lineage: { originalId: string; clipIds: string[] }[] = [];
  // Parent-first traversal is iterative so deeply attached timelines do not consume the JS stack.
  const ready = model.clips.filter((value) => value.clip.placement.kind === "project");
  for (let index = 0; index < ready.length; index++) {
    const value: Resolved = ready[index]!;
    const anchor = value.clip.placement;
    const parent = anchor.kind === "project" ? undefined : original.get(anchor.clipId)!;
    const parents = anchor.kind === "project" ? [undefined] : pieces.get(anchor.clipId)!;
    const next: Piece[] = [];
    for (const parentPiece of parents) {
      const span = parentPiece ? intersection(value.range, parentPiece.range) : value.range;
      if (!span) continue;
      const ranges: ExactRange[] = [];
      let start = span.start;
      if (partitioned.has(value.clip.id)) {
        for (let i = afterCut(start); i < cuts.length && compare(cuts[i]!, span.end) < 0; i++) {
          ranges.push({ start, end: cuts[i]! });
          start = cuts[i]!;
        }
      }
      ranges.push({ start, end: span.end });
      for (const range of ranges) {
        if (operation.kind === "remove" && affected.has(value.clip.id) && removed(range.start))
          continue;
        const id = next.length === 0 ? value.clip.id : allocate("clip");
        const placement: Clip["placement"] =
          !parentPiece || !parent
            ? { kind: "project", range: stored(range) }
            : anchor.kind === "content"
              ? {
                  kind: "content",
                  clipId: parentPiece.clip.id,
                  sourceRange: stored({
                    start: sourceTime(parent, range.start),
                    end: sourceTime(parent, range.end),
                  }),
                }
              : {
                  kind: "clip",
                  clipId: parentPiece.clip.id,
                  start: toFraction(
                    divide(
                      subtract(range.start, parentPiece.range.start),
                      subtract(parentPiece.range.end, parentPiece.range.start),
                    ),
                  ),
                  end: toFraction(
                    divide(
                      subtract(range.end, parentPiece.range.start),
                      subtract(parentPiece.range.end, parentPiece.range.start),
                    ),
                  ),
                };
        let clip: Clip;
        if (isMediaClip(value.clip)) {
          const source =
            value.clip.source.kind === "hold"
              ? value.clip.source
              : {
                  kind: "range" as const,
                  range: stored({
                    start: sourceTime(value, range.start),
                    end: sourceTime(value, range.end),
                  }),
                };
          clip = { ...value.clip, id, source, placement };
        } else clip = { ...value.clip, id, placement };
        next.push({ clip, range });
      }
    }
    pieces.set(value.clip.id, next);
    if (
      next.length !== 1 ||
      compare(next[0]!.range.start, value.range.start) !== 0 ||
      compare(next[0]!.range.end, value.range.end) !== 0
    )
      lineage.push({ originalId: value.clip.id, clipIds: next.map((piece) => piece.clip.id) });
    for (const child of children.get(value.clip.id) ?? []) ready.push(original.get(child)!);
  }
  const syncGroups = model.document.syncGroups.flatMap((group) => {
    const changed = group.clipIds.some((id) => {
      const kept = pieces.get(id)!;
      return (
        kept.length !== 1 ||
        compare(kept[0]!.range.start, original.get(id)!.range.start) !== 0 ||
        compare(kept[0]!.range.end, original.get(id)!.range.end) !== 0
      );
    });
    if (!changed) return [group];
    if (operation.kind === "split" && operation.scope === "selected") {
      const clipIds = group.clipIds.filter((id) => pieces.get(id)!.length === 1);
      return clipIds.length >= 2 ? [{ ...group, clipIds }] : [];
    }
    const intervals = new Map<number, string[]>();
    for (const id of group.clipIds)
      for (const piece of pieces.get(id)!) {
        const bucket = afterCut(piece.range.start);
        const members = intervals.get(bucket) ?? [];
        members.push(piece.clip.id);
        intervals.set(bucket, members);
      }
    return [...intervals]
      .sort(([a], [b]) => a - b)
      .map(([, ids]) => ids)
      .filter((ids) => ids.length >= 2)
      .map((clipIds, index) => ({
        id: index === 0 ? group.id : allocate("syncGroup"),
        clipIds,
      }));
  });
  return {
    document: {
      ...model.document,
      clips: model.document.clips.flatMap((clip) =>
        pieces.get(clip.id)!.map((piece) => piece.clip),
      ),
      syncGroups,
    },
    lineage,
    removalRanges:
      operation.kind === "remove" && selected.some((id) => original.has(id))
        ? operation.ranges
          ? union(operation.ranges)
          : removals
        : [],
    removedAttachments: model.document.clips
      .filter((clip) => clip.placement.kind !== "project" && pieces.get(clip.id)!.length === 0)
      .map((clip) => clip.id),
  };
}
