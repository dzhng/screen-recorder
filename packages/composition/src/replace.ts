import { remapClipProcessing } from "./processing.js";
import { clipGraph } from "./clip-graph.js";
import { CompositionError } from "./errors.js";
import { placementForRange, validateSourceSelection, type ValidatedComposition } from "./model.js";
import { add, ceil, compare, fromTime, subtract, toTime, type Rational } from "./rational.js";
import { isMediaClip, type Clip, type MediaClip } from "./schema.js";

export function replaceClip(
  model: ValidatedComposition,
  clipId: string,
  kind: "audio" | "video",
  media: Pick<MediaClip, "assetId" | "streamId" | "acquisitionId" | "source">,
  fit: "exact" | "trim" | "stretch" | "ripple" | "hold" | "silence",
  allocate: (kind: "clip" | "syncGroup" | "processingStep", copiedFrom?: string) => string,
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
  const pads = fit === "hold" || fit === "silence";
  if (
    pads &&
    (media.source.kind !== "range" || (fit === "hold" ? kind !== "video" : kind !== "audio"))
  )
    throw new CompositionError(
      "INVALID_EDIT",
      "Padding needs a video range for hold or an audio range for silence",
      { clipId, fit },
    );
  const duration = subtract(target.range.end, target.range.start);
  let padding: { at: Rational; holdAtUs: number } | null = null;
  let source = media.source;
  if (source.kind === "range") {
    const supplied = subtract(fromTime(source.range.endUs), fromTime(source.range.startUs));
    if (
      (fit === "exact" && compare(supplied, duration) !== 0) ||
      (fit === "trim" && compare(supplied, duration) < 0) ||
      (pads && compare(supplied, duration) > 0)
    )
      throw new CompositionError(
        "INVALID_EDIT",
        "Replacement duration does not fit the target interval",
        { clipId, fit },
      );
    if (pads && compare(supplied, duration) < 0)
      padding = {
        at: add(target.range.start, supplied),
        holdAtUs: ceil(fromTime(source.range.endUs)) - 1,
      };
    if (fit === "trim")
      source = {
        kind: "range",
        range: {
          startUs: source.range.startUs,
          endUs: toTime(add(fromTime(source.range.startUs), duration)),
        },
      };
  }
  const replacement: MediaClip = {
    id: target.clip.id,
    trackId: target.clip.trackId,
    placement: target.clip.placement,
    ...media,
    source,
    ...(isMediaClip(target.clip) && target.clip.pitch !== undefined
      ? { pitch: target.clip.pitch }
      : {}),
    ...(kind === "audio" && (pitch !== undefined || fit === "stretch")
      ? { pitch: pitch ?? "preserve" }
      : {}),
  };
  const changedSource =
    !isMediaClip(target.clip) ||
    target.clip.assetId !== media.assetId ||
    target.clip.streamId !== media.streamId ||
    target.clip.acquisitionId !== media.acquisitionId ||
    JSON.stringify(target.clip.source) !== JSON.stringify(source);
  if (changedSource || padding) {
    const sourceSteps = model.document.processing
      .filter((stack) => stack.target.kind === "clip" && stack.target.id === clipId)
      .flatMap((stack) => stack.steps.filter((step) => step.window?.kind === "content"));
    if (sourceSteps.length)
      throw new CompositionError(
        "INVALID_EDIT",
        "Replacement requires repair or reset of source-domain processing",
        { clipId, stepIds: sourceSteps.map((step) => step.id) },
      );
  }
  const removed =
    changedSource || padding ? clipGraph(model).expand([clipId], false) : new Set<string>();
  removed.delete(clipId);
  const document = {
    ...model.document,
    clips: model.document.clips
      .filter((clip) => !removed.has(clip.id))
      .map((clip) => (clip.id === clipId ? replacement : clip)),
    syncGroups: model.document.syncGroups.map((group) => ({
      ...group,
      clipIds: group.clipIds.filter((id) => !removed.has(id)),
    })),
  };
  if (!padding)
    return {
      document: {
        ...document,
        processing: remapClipProcessing(model.document, document.clips, [], allocate),
        syncGroups: document.syncGroups.filter((group) => group.clipIds.length >= 2),
      },
      removedAttachments: [...removed],
      lineage: [],
    };
  const anchor = target.clip.placement;
  const parent =
    anchor.kind === "project"
      ? undefined
      : model.clips.find((value) => value.clip.id === anchor.clipId);
  const prefix = {
    ...replacement,
    placement: placementForRange(
      target.clip,
      { start: target.range.start, end: padding.at },
      parent,
    ),
  };
  const tailId = allocate("clip");
  const tailPlacement = placementForRange(
    target.clip,
    { start: padding.at, end: target.range.end },
    parent,
  );
  const tail: Clip =
    fit === "silence"
      ? {
          id: tailId,
          trackId: target.clip.trackId,
          source: { kind: "silence" },
          placement: tailPlacement,
        }
      : {
          ...replacement,
          id: tailId,
          source: { kind: "hold", atUs: padding.holdAtUs },
          placement: tailPlacement,
        };
  let grouped = false;
  const syncGroups = document.syncGroups.map((group) => {
    if (!group.clipIds.includes(clipId)) return group;
    grouped = true;
    return { ...group, clipIds: [...group.clipIds, tailId] };
  });
  if (!grouped) syncGroups.push({ id: allocate("syncGroup"), clipIds: [clipId, tailId] });
  const clips = document.clips.flatMap((clip) => (clip.id === clipId ? [prefix, tail] : [clip]));
  const lineage = [{ originalId: clipId, clipIds: [clipId, tailId] }];
  return {
    document: {
      ...document,
      clips,
      processing: remapClipProcessing(
        model.document,
        clips,
        lineage,
        allocate,
        new Map([
          [
            clipId,
            { original: target.range, retained: { start: target.range.start, end: padding.at } },
          ],
          [
            tailId,
            { original: target.range, retained: { start: padding.at, end: target.range.end } },
          ],
        ]),
      ),
      syncGroups: syncGroups.filter((group) => group.clipIds.length >= 2),
    },
    removedAttachments: [...removed],
    lineage,
  };
}
