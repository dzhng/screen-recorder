import { clipGraph } from "./clip-graph.js";
import { CompositionError } from "./errors.js";
import { validateSourceSelection, type ValidatedComposition } from "./model.js";
import { add, compare, fromTime, subtract, toTime } from "./rational.js";
import type { Clip } from "./schema.js";

export function replaceClip(
  model: ValidatedComposition,
  clipId: string,
  kind: "audio" | "video",
  media: Pick<Clip, "assetId" | "streamId" | "source">,
  fit: "exact" | "trim" | "stretch" | "ripple",
  pitch?: "preserve" | "follow",
) {
  const target = model.clips.find((value) => value.clip.id === clipId)!;
  if (target.track.kind !== kind)
    throw new CompositionError("INVALID_EDIT", "Replacement kind does not match the target", {
      clipId,
      kind,
    });
  if (pitch !== undefined && kind !== "audio")
    throw new CompositionError("INVALID_EDIT", "Pitch policy requires audio", { clipId });
  const stream = model.assets
    .find((asset) => asset.id === media.assetId)
    ?.streams.find((value) => value.id === media.streamId);
  if (!stream)
    throw new CompositionError("INVALID_EDIT", "Unknown replacement source", {
      assetId: media.assetId,
      streamId: media.streamId,
    });
  validateSourceSelection(media.source, stream, clipId);
  const duration = subtract(target.range.end, target.range.start);
  let source = media.source;
  if (source.kind === "range") {
    const supplied = subtract(fromTime(source.range.endUs), fromTime(source.range.startUs));
    if (
      (fit === "exact" && compare(supplied, duration) !== 0) ||
      (fit === "trim" && compare(supplied, duration) < 0)
    )
      throw new CompositionError(
        "INVALID_EDIT",
        "Replacement duration does not fit the target interval",
        { clipId, fit },
      );
    if (fit === "trim")
      source = {
        kind: "range",
        range: {
          startUs: source.range.startUs,
          endUs: toTime(add(fromTime(source.range.startUs), duration)),
        },
      };
  }
  const replacement = {
    ...target.clip,
    ...media,
    source,
    ...(kind === "audio" && (pitch !== undefined || fit === "stretch")
      ? { pitch: pitch ?? "preserve" }
      : {}),
  };
  const changedSource =
    target.clip.assetId !== media.assetId ||
    target.clip.streamId !== media.streamId ||
    JSON.stringify(target.clip.source) !== JSON.stringify(source);
  const removed = changedSource ? clipGraph(model).expand([clipId], false) : new Set<string>();
  removed.delete(clipId);
  return {
    document: {
      ...model.document,
      clips: model.document.clips
        .filter((clip) => !removed.has(clip.id))
        .map((clip) => (clip.id === clipId ? replacement : clip)),
      syncGroups: model.document.syncGroups
        .map((group) => ({ ...group, clipIds: group.clipIds.filter((id) => !removed.has(id)) }))
        .filter((group) => group.clipIds.length >= 2),
    },
    removedAttachments: [...removed],
  };
}
