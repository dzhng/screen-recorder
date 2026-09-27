import { clipGraph } from "./clip-graph.js";
import { CompositionError } from "./errors.js";
import { sourceTime, type ValidatedComposition } from "./model.js";
import { add, compare, divide, fromTime, subtract, toFraction, toTime } from "./rational.js";
import type { Clip } from "./schema.js";

/** Translate an occurrence selection once, retaining each attachment's anchor kind. */
export function moveClips(
  model: ValidatedComposition,
  selected: readonly string[],
  atUs: number,
  scope: "linked" | "selected",
  allocate: (kind: "syncGroup") => string,
  tracks: readonly { clipId: string; trackId: string }[],
) {
  const affected = clipGraph(model).expand(selected, scope === "linked");
  const { clips, delta } = relocateClips(model, affected, atUs, tracks, false);
  const syncGroups =
    scope === "linked" || delta.numerator === 0n
      ? model.document.syncGroups
      : model.document.syncGroups.flatMap((group) => {
          if (
            group.clipIds.every((id) => affected.has(id)) ||
            group.clipIds.every((id) => !affected.has(id))
          )
            return [group];
          const stationary = group.clipIds.filter((id) => !affected.has(id));
          const moving = group.clipIds.filter((id) => affected.has(id));
          return [stationary, moving]
            .filter((ids) => ids.length >= 2)
            .map((clipIds, index) => ({
              id: index === 0 ? group.id : allocate("syncGroup"),
              clipIds,
            }));
        });
  return { ...model.document, clips, syncGroups };
}

/** Shared exact relocation for existing occurrences and copies. */
export function relocateClips(
  model: ValidatedComposition,
  affected: ReadonlySet<string>,
  atUs: number,
  tracks: readonly { clipId: string; trackId: string }[],
  detachRoots: boolean,
) {
  const destinations = new Map<string, string>();
  for (const entry of tracks) {
    if (!affected.has(entry.clipId) || destinations.has(entry.clipId))
      throw new CompositionError(
        "INVALID_EDIT",
        "Move track destinations must name affected clips without duplicates",
        { clipId: entry.clipId },
      );
    destinations.set(entry.clipId, entry.trackId);
  }
  const original = new Map(model.clips.map((value) => [value.clip.id, value]));
  const values = model.clips.filter((value) => affected.has(value.clip.id));
  const start = values.reduce(
    (at, value) => (compare(value.range.start, at) < 0 ? value.range.start : at),
    values[0]!.range.start,
  );
  const delta = subtract(fromTime(atUs), start);
  const clips = model.document.clips.map((originalClip) => {
    const clip = destinations.has(originalClip.id)
      ? { ...originalClip, trackId: destinations.get(originalClip.id)! }
      : originalClip;
    if (!affected.has(clip.id)) return clip;
    const anchor = clip.placement;
    if (delta.numerator === 0n && !detachRoots) return clip;
    if (anchor.kind !== "project" && affected.has(anchor.clipId)) return clip;
    const value = original.get(clip.id)!;
    const range = { start: add(value.range.start, delta), end: add(value.range.end, delta) };
    let placement: Clip["placement"];
    if (anchor.kind === "project" || detachRoots) {
      placement = {
        kind: "project",
        range: { startUs: toTime(range.start), endUs: toTime(range.end) },
      };
    } else {
      const parent = original.get(anchor.clipId)!;
      if (compare(range.start, parent.range.start) < 0 || compare(range.end, parent.range.end) > 0)
        throw new CompositionError(
          "INVALID_EDIT",
          "Moved attachment leaves its parent interval; explicitly reanchor it first",
          { clipId: clip.id, parentClipId: anchor.clipId },
        );
      placement =
        anchor.kind === "content"
          ? {
              ...anchor,
              sourceRange: {
                startUs: toTime(sourceTime(parent, range.start)),
                endUs: toTime(sourceTime(parent, range.end)),
              },
            }
          : {
              ...anchor,
              start: toFraction(
                divide(
                  subtract(range.start, parent.range.start),
                  subtract(parent.range.end, parent.range.start),
                ),
              ),
              end: toFraction(
                divide(
                  subtract(range.end, parent.range.start),
                  subtract(parent.range.end, parent.range.start),
                ),
              ),
            };
    }
    return { ...clip, placement };
  });
  return { clips, delta };
}
