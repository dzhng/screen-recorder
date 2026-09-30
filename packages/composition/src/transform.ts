import type { TimeValue } from "./schema.js";
import { clipGraph } from "./clip-graph.js";
import { CompositionError } from "./errors.js";
import { placementForRange, type ValidatedComposition } from "./model.js";
import {
  add,
  compare,
  divide,
  fromTime,
  multiply,
  rational,
  subtract,
  toTime,
} from "./rational.js";
import { isMediaClip, type Clip } from "./schema.js";

/** Apply a shared project-time transform, retaining each attachment's anchor kind. */
export function transformSelection(
  model: ValidatedComposition,
  selected: readonly string[],
  timing: { atUs?: number; durationUs?: TimeValue; pitch?: "preserve" | "follow" },
  scope: "linked" | "selected",
  allocate: (kind: "syncGroup") => string,
  tracks: readonly { clipId: string; trackId: string }[],
) {
  const affected = clipGraph(model).expand(selected, scope === "linked");
  const { clips, changedTiming, before, after } = transformClips(
    model,
    affected,
    timing,
    tracks,
    false,
  );
  const syncGroups =
    scope === "linked" || !changedTiming
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
  return { document: { ...model.document, clips, syncGroups }, affected, before, after };
}

/** Shared exact placement algebra for moves, retiming and copies. */
export function transformClips(
  model: ValidatedComposition,
  affected: ReadonlySet<string>,
  timing: { atUs?: number; durationUs?: TimeValue; pitch?: "preserve" | "follow" },
  tracks: readonly { clipId: string; trackId: string }[],
  detachRoots: boolean,
) {
  const destinations = new Map<string, string>();
  for (const entry of tracks) {
    if (!affected.has(entry.clipId) || destinations.has(entry.clipId))
      throw new CompositionError(
        "INVALID_EDIT",
        "Track destinations must name affected clips without duplicates",
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
  const end = values.reduce(
    (at, value) => (compare(value.range.end, at) > 0 ? value.range.end : at),
    values[0]!.range.end,
  );
  const destination = timing.atUs === undefined ? start : fromTime(timing.atUs);
  const scale =
    timing.durationUs === undefined
      ? rational(1n)
      : divide(fromTime(timing.durationUs), subtract(end, start));
  const changedTiming = compare(destination, start) !== 0 || compare(scale, rational(1n)) !== 0;
  const projectTime = (at: typeof start) => add(destination, multiply(subtract(at, start), scale));
  const clips = model.document.clips.map((originalClip) => {
    let clip = destinations.has(originalClip.id)
      ? { ...originalClip, trackId: destinations.get(originalClip.id)! }
      : originalClip;
    if (!affected.has(clip.id)) return clip;
    if (
      timing.pitch !== undefined &&
      isMediaClip(clip) &&
      original.get(clip.id)!.track.kind === "audio"
    )
      clip = { ...clip, pitch: timing.pitch };
    const anchor = clip.placement;
    if (!changedTiming && !detachRoots) return clip;
    if (anchor.kind !== "project" && affected.has(anchor.clipId)) return clip;
    const value = original.get(clip.id)!;
    const range = { start: projectTime(value.range.start), end: projectTime(value.range.end) };
    let placement: Clip["placement"];
    if (anchor.kind === "project" || detachRoots) {
      placement = {
        kind: "project",
        range: { startUs: toTime(range.start), endUs: toTime(range.end) },
      };
    } else {
      const parent = original.get(anchor.clipId)!;
      placement = placementForRange(clip, range, parent);
    }
    return { ...clip, placement };
  });
  return {
    clips,
    changedTiming,
    before: { start, end },
    after: { start: destination, end: projectTime(end) },
  };
}
