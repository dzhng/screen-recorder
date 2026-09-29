import { resolveComposition, type ValidatedComposition } from "./model.js";
import { partitionClips } from "./partition.js";
import { add, compare, fromTime, subtract } from "./rational.js";
import { requireRippleTargets, rippleTimeline, splitRippleBoundary } from "./ripple.js";
import { transformSelection } from "./transform.js";

export function rippleMove(
  model: ValidatedComposition,
  transformed: ReturnType<typeof transformSelection>,
  atUs: number,
  tracks: readonly string[],
  allocate: (kind: "clip" | "syncGroup" | "processingStep", copiedFrom?: string) => string,
) {
  // Validate even an identity move's explicit track list.
  rippleTimeline(model, { kind: "remove", ranges: [] }, tracks);
  if (
    compare(transformed.before.start, transformed.after.start) === 0 &&
    transformed.document.clips.every(
      (clip, index) => clip.trackId === model.document.clips[index]!.trackId,
    )
  )
    return { document: transformed.document, lineage: [], touchedFixedAnchors: [] };
  const named = new Set(tracks);
  requireRippleTargets(model.document.clips, transformed.affected, named);
  requireRippleTargets(transformed.document.clips, transformed.affected, named);
  if (compare(transformed.before.start, transformed.after.start) === 0)
    return { document: transformed.document, lineage: [], touchedFixedAnchors: [] };
  const linked = resolveComposition(
    { ...model.document, syncGroups: transformed.document.syncGroups },
    model.assets,
    model.acquisitions,
  );
  const removed = partitionClips(
    linked,
    [...transformed.affected],
    { kind: "remove", scope: "selected" },
    allocate,
  );
  // Map the final insertion boundary back through the collapsed source windows.
  let originalAt = fromTime(atUs);
  for (const range of removed.removalRanges) {
    if (compare(range.start, originalAt) > 0) break;
    originalAt = add(originalAt, subtract(range.end, range.start));
  }
  const stationary = resolveComposition(removed.document, model.assets, model.acquisitions);
  const partitioned = splitRippleBoundary(stationary, originalAt, named, allocate);
  const shifted = rippleTimeline(
    resolveComposition(partitioned.document, model.assets, model.acquisitions),
    {
      kind: "move",
      ranges: removed.removalRanges,
      at: fromTime(atUs),
      duration: subtract(transformed.before.end, transformed.before.start),
    },
    tracks,
  );
  const moved = transformed.document.clips.filter((clip) => transformed.affected.has(clip.id));
  const groups = transformed.document.syncGroups.filter((group) =>
    group.clipIds.every((id) => transformed.affected.has(id)),
  );
  const restoreOrder = <T extends { id: string }>(original: readonly T[], values: T[]) => {
    const positions = new Map(original.map((value, index) => [value.id, index]));
    return values.sort(
      (a, b) => (positions.get(a.id) ?? original.length) - (positions.get(b.id) ?? original.length),
    );
  };
  return {
    document: {
      ...shifted.document,
      processing: [
        ...shifted.document.processing,
        ...transformed.document.processing.filter(
          (stack) => stack.target.kind === "clip" && transformed.affected.has(stack.target.id),
        ),
      ],
      clips: restoreOrder(model.document.clips, [...shifted.document.clips, ...moved]),
      syncGroups: restoreOrder(model.document.syncGroups, [
        ...shifted.document.syncGroups,
        ...groups,
      ]),
    },
    lineage: partitioned.lineage,
    touchedFixedAnchors: shifted.touchedFixedAnchors,
  };
}
