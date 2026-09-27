import {
  CompositionError,
  sourceTime,
  type ValidatedComposition,
  type ExactRange,
} from "./model.js";
import { compare, fromTime, divide, subtract, type Rational } from "./rational.js";
import type { Clip, Fraction, TimeValue } from "./schema.js";

type Resolved = ValidatedComposition["clips"][number];
type Piece = { clip: Readonly<Clip>; range: ExactRange };
function fraction(value: Rational): Fraction {
  if (
    value.numerator < 0n ||
    value.numerator > BigInt(Number.MAX_SAFE_INTEGER) ||
    value.denominator > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new CompositionError(
      "INVALID_EDIT",
      "Exact edit boundary exceeds serializable precision",
    );
  return { numerator: Number(value.numerator), denominator: Number(value.denominator) };
}
function time(value: Rational): TimeValue {
  const result = fraction(value);
  return result.denominator === 1 ? result.numerator : result;
}
const stored = (range: ExactRange) => ({ startUs: time(range.start), endUs: time(range.end) });
function overlap(a: ExactRange, b: ExactRange): ExactRange | null {
  const start = compare(a.start, b.start) > 0 ? a.start : b.start;
  const end = compare(a.end, b.end) < 0 ? a.end : b.end;
  return compare(start, end) < 0 ? { start, end } : null;
}

/** Restrict original affine mappings and rebase attachments onto their surviving parent pieces. */
export function splitClips(
  model: ValidatedComposition,
  selected: readonly string[],
  atUs: number,
  scope: "linked" | "selected",
  allocate: (kind: "clip" | "syncGroup") => string,
) {
  const at = fromTime(atUs);
  const affected = new Set(selected);
  const children = new Map<string, string[]>();
  const groups = new Map<string, readonly string[]>();
  for (const value of model.clips) {
    const anchor = value.clip.placement;
    if (anchor.kind !== "project") {
      const siblings = children.get(anchor.clipId) ?? [];
      siblings.push(value.clip.id);
      children.set(anchor.clipId, siblings);
    }
  }
  for (const group of model.document.syncGroups)
    for (const id of group.clipIds) groups.set(id, group.clipIds);
  const expandedGroups = new Set<readonly string[]>();
  const pending = [...affected];
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index]!;
    const group = scope === "linked" ? groups.get(id) : undefined;
    const related = [...(children.get(id) ?? [])];
    if (group && !expandedGroups.has(group)) {
      expandedGroups.add(group);
      for (const member of group) related.push(member);
    }
    for (const child of related)
      if (!affected.has(child)) {
        affected.add(child);
        pending.push(child);
      }
  }
  const original = new Map(model.clips.map((value) => [value.clip.id, value]));
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
      const span = parentPiece ? overlap(value.range, parentPiece.range) : value.range;
      if (!span) continue;
      const ranges =
        affected.has(value.clip.id) && compare(span.start, at) < 0 && compare(at, span.end) < 0
          ? [
              { start: span.start, end: at },
              { start: at, end: span.end },
            ]
          : [span];
      for (const range of ranges) {
        const id = next.length === 0 ? value.clip.id : allocate("clip");
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
                  start: fraction(
                    divide(
                      subtract(range.start, parentPiece.range.start),
                      subtract(parentPiece.range.end, parentPiece.range.start),
                    ),
                  ),
                  end: fraction(
                    divide(
                      subtract(range.end, parentPiece.range.start),
                      subtract(parentPiece.range.end, parentPiece.range.start),
                    ),
                  ),
                };
        next.push({ clip: { ...value.clip, id, source, placement }, range });
      }
    }
    pieces.set(value.clip.id, next);
    if (next.length > 1)
      lineage.push({ originalId: value.clip.id, clipIds: next.map((piece) => piece.clip.id) });
    for (const child of children.get(value.clip.id) ?? []) ready.push(original.get(child)!);
  }
  const syncGroups = model.document.syncGroups.flatMap((group) => {
    const changed = group.clipIds.some((id) => pieces.get(id)!.length > 1);
    if (!changed) return [group];
    if (scope === "selected") {
      const clipIds = group.clipIds.filter((id) => pieces.get(id)!.length === 1);
      return clipIds.length >= 2 ? [{ ...group, clipIds }] : [];
    }
    const before: string[] = [],
      after: string[] = [];
    for (const id of group.clipIds)
      for (const piece of pieces.get(id)!) {
        (compare(piece.range.end, at) <= 0 ? before : after).push(piece.clip.id);
      }
    return [before, after]
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
  };
}
