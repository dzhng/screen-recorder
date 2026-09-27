import { CompositionError } from "./errors.js";
import type { ExactRange, ValidatedComposition } from "./model.js";
import { add, compare, fromTime, rational, subtract, toTime, type Rational } from "./rational.js";

/** Open or collapse project time on named roots; attachments inherit one displacement. */
export function rippleTimeline(
  model: ValidatedComposition,
  operation:
    | { kind: "remove"; ranges: readonly ExactRange[] }
    | { kind: "insert"; atUs: number; durationUs: number },
  trackIds: readonly string[],
) {
  // A zero-width insertion boundary makes the same seek include roots beginning exactly there.
  const ranges =
    operation.kind === "remove"
      ? operation.ranges
      : [{ start: fromTime(operation.atUs), end: fromTime(operation.atUs) }];
  const tracks = new Set(trackIds);
  const knownTracks = new Set(model.document.tracks.map((track) => track.id));
  if (tracks.size !== trackIds.length || trackIds.some((id) => !knownTracks.has(id)))
    throw new CompositionError(
      "INVALID_EDIT",
      "Ripple must name existing tracks without duplicates",
      { trackIds },
    );
  if (!ranges.length) return { document: model.document, touchedFixedAnchors: [] };
  const clips = new Map(model.clips.map((value) => [value.clip.id, value]));
  const roots = new Map<string, string>();
  for (const value of model.clips) {
    const chain: string[] = [];
    let current = value;
    while (!roots.has(current.clip.id) && current.clip.placement.kind !== "project") {
      chain.push(current.clip.id);
      current = clips.get(current.clip.placement.clipId)!;
    }
    const root = roots.get(current.clip.id) ?? current.clip.id;
    roots.set(current.clip.id, root);
    for (const id of chain) roots.set(id, root);
  }
  const orphaned = model.clips.filter(
    (value) =>
      tracks.has(value.clip.trackId) &&
      value.clip.placement.kind !== "project" &&
      compare(value.range.end, ranges[0]!.start) > 0 &&
      !tracks.has(clips.get(roots.get(value.clip.id)!)!.clip.trackId),
  );
  if (orphaned.length)
    throw new CompositionError("INVALID_EDIT", "Ripple of an attachment requires its root track", {
      attachments: orphaned.map((value) => ({
        clipId: value.clip.id,
        rootClipId: roots.get(value.clip.id),
        rootTrackId: clips.get(roots.get(value.clip.id)!)!.clip.trackId,
      })),
    });
  const prefix = [rational(0n)];
  for (const range of ranges)
    prefix.push(
      add(
        prefix.at(-1)!,
        operation.kind === "insert"
          ? fromTime(operation.durationUs)
          : subtract(range.end, range.start),
      ),
    );
  const firstAfter = (at: Rational) => {
    let lo = 0,
      hi = ranges.length;
    while (lo < hi) {
      const middle = (lo + hi) >>> 1;
      if (compare(ranges[middle]!.end, at) <= 0) lo = middle + 1;
      else hi = middle;
    }
    return lo;
  };
  const displacements = new Map<string, Rational>();
  const conflicts: string[] = [];
  const touchedFixedAnchors: { kind: "clip"; id: string }[] = [];
  for (const value of model.clips) {
    if (value.clip.placement.kind !== "project") continue;
    let displacement = rational(0n);
    if (tracks.has(value.clip.trackId)) {
      const index = firstAfter(value.range.start);
      if (index < ranges.length && compare(ranges[index]!.start, value.range.end) < 0)
        conflicts.push(value.clip.id);
      else
        displacement =
          operation.kind === "insert" ? prefix[index]! : subtract(rational(0n), prefix[index]!);
    } else if (compare(value.range.end, ranges[0]!.start) > 0) {
      touchedFixedAnchors.push({ kind: "clip", id: value.clip.id });
    }
    displacements.set(value.clip.id, displacement);
  }
  if (conflicts.length)
    throw new CompositionError(
      "INVALID_EDIT",
      operation.kind === "remove"
        ? "Ripple intersects unremoved content; address those clips explicitly"
        : "Insertion intersects unsplit content",
      {
        clipIds: conflicts,
        trackIds: [...new Set(conflicts.map((id) => clips.get(id)!.clip.trackId))],
      },
    );
  for (const group of model.document.syncGroups) {
    const first = displacements.get(roots.get(group.clipIds[0]!)!)!;
    if (group.clipIds.some((id) => compare(displacements.get(roots.get(id)!)!, first) !== 0))
      throw new CompositionError("INVALID_EDIT", "Ripple track scope would break synchronization", {
        groupId: group.id,
        clipIds: group.clipIds,
        requiredRootTrackIds: [
          ...new Set(group.clipIds.map((id) => clips.get(roots.get(id)!)!.clip.trackId)),
        ],
      });
  }
  const document = {
    ...model.document,
    clips: model.document.clips.map((clip) => {
      if (clip.placement.kind !== "project") return clip;
      const displacement = displacements.get(clip.id)!;
      if (displacement.numerator === 0n) return clip;
      const range = clips.get(clip.id)!.range;
      return {
        ...clip,
        placement: {
          kind: "project" as const,
          range: {
            startUs: toTime(add(range.start, displacement)),
            endUs: toTime(add(range.end, displacement)),
          },
        },
      };
    }),
  };
  return { document, touchedFixedAnchors };
}
