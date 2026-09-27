import { CompositionError } from "./errors.js";
import { z } from "zod";
import { anchorSchema, clipSchema, compositionSchema, rangeSchema } from "./schema.js";
import { validateComposition, type ValidatedComposition, type ExactRange } from "./model.js";

import { partitionClips } from "./partition.js";
import { compare, fromTime, subtract, toTime } from "./rational.js";
import { rippleTimeline } from "./ripple.js";
import { transformSelection } from "./transform.js";
import { duplicateClips } from "./duplicate.js";

type Document = ValidatedComposition["document"];
type EntityKind = "clip" | "track" | "syncGroup";
const reference = z.union([z.string().min(1), z.object({ label: z.string().min(1) }).strict()]);
const label = z.string().min(1).optional();
const ripple = z.union([
  z.literal("none"),
  z.object({ trackIds: z.array(reference).min(1) }).strict(),
]);
const placement = z.discriminatedUnion("kind", [
  anchorSchema.options[0].safeExtend({ range: rangeSchema }),
  z
    .object({ ...anchorSchema.options[1].shape, clipId: reference, sourceRange: rangeSchema })
    .strict(),
  z.object({ ...anchorSchema.options[2].shape, clipId: reference }).strict(),
]);
const placedClip = clipSchema.omit({ id: true }).extend({
  trackId: reference,
  placement,
  source: z.discriminatedUnion("kind", [
    clipSchema.shape.source.options[0].extend({ range: rangeSchema }),
    clipSchema.shape.source.options[1],
  ]),
});
export const editOperationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("insert"),
      atUs: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      durationUs: z.int().positive().max(Number.MAX_SAFE_INTEGER),
      ripple: z.object({ trackIds: z.array(reference).min(1) }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("retime"),
      clipIds: z.array(reference).min(1),
      durationUs: z.int().positive().max(Number.MAX_SAFE_INTEGER),
      scope: z.enum(["linked", "selected"]).default("linked"),
      pitch: z.enum(["preserve", "follow"]).default("preserve"),
      ripple,
    })
    .strict(),
  z
    .object({
      operation: z.literal("duplicate"),
      clipIds: z.array(reference).min(1),
      atUs: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      scope: z.enum(["linked", "selected"]).default("selected"),
      tracks: z.array(z.object({ clipId: reference, trackId: reference }).strict()).default([]),
      copyLabels: z
        .array(z.object({ clipId: reference, label: z.string().min(1) }).strict())
        .default([]),
    })
    .strict(),
  z.object({ operation: z.literal("detach"), clipIds: z.array(reference).min(1) }).strict(),
  z.object({ operation: z.literal("reanchor"), clipId: reference, placement }).strict(),
  z
    .object({
      operation: z.literal("move"),
      clipIds: z.array(reference).min(1),
      atUs: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      scope: z.enum(["linked", "selected"]).default("linked"),
      ripple: z.literal("none"),
      tracks: z.array(z.object({ clipId: reference, trackId: reference }).strict()).default([]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("trim"),
      clipId: reference,
      range: rangeSchema,
      scope: z.enum(["linked", "selected"]).default("linked"),
      ripple,
    })
    .strict(),
  z
    .object({
      operation: z.literal("remove"),
      clipIds: z.array(reference).min(1),
      ranges: z.array(rangeSchema).min(1).max(1000).optional(),
      scope: z.enum(["linked", "selected"]).default("linked"),
      ripple,
    })
    .strict(),
  z
    .object({
      operation: z.literal("split"),
      clipIds: z.array(reference).min(1),
      atUs: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      scope: z.enum(["linked", "selected"]).default("linked"),
      rightLabels: z
        .array(z.object({ clipId: reference, label: z.string().min(1) }).strict())
        .default([]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("track.add"),
      track: compositionSchema.shape.tracks.element.omit({ id: true }),
      label,
    })
    .strict(),
  z.object({ operation: z.literal("track.remove"), trackId: reference }).strict(),
  z.object({ operation: z.literal("track.reorder"), trackIds: z.array(reference) }).strict(),
  z
    .object({
      operation: z.literal("canvas.set"),
      canvas: compositionSchema.shape.canvas.partial(),
    })
    .strict(),
  z.object({ operation: z.literal("place"), clip: placedClip, label }).strict(),
  z.object({ operation: z.literal("link"), clipIds: z.array(reference).min(2), label }).strict(),
  z.object({ operation: z.literal("unlink"), clipIds: z.array(reference).min(1) }).strict(),
]);
export type EditOperation = z.infer<typeof editOperationSchema>;
export type EditChange =
  | { kind: "canvas"; value: Document["canvas"] }
  | { kind: "track"; id: string; value: Document["tracks"][number] | null }
  | { kind: "clip"; id: string; value: Document["clips"][number] | null }
  | { kind: "syncGroup"; id: string; value: Document["syncGroups"][number] | null };
export type EditBatchResult = {
  document: Document;
  changed: boolean;
  createdIds: { kind: EntityKind; id: string }[];
  labels: Record<string, string>;
  normalized: { operationIndex: number; changes: EditChange[] }[];
  clipLineage: { originalId: string; clipIds: string[] }[];
  removedAttachments: string[];
  touchedFixedAnchors: { kind: "clip"; id: string }[];
  linkChanges: Extract<EditChange, { kind: "syncGroup" }>[];
};
function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new CompositionError("INVALID_EDIT", message, details);
}
function difference<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
): { id: string; value: T | null }[] {
  const previous = new Map(before.map((value) => [value.id, JSON.stringify(value)]));
  const result: { id: string; value: T | null }[] = [];
  for (const value of after) {
    if (previous.get(value.id) !== JSON.stringify(value)) result.push({ id: value.id, value });
    previous.delete(value.id);
  }
  for (const id of previous.keys()) result.push({ id, value: null });
  return result;
}
function changes(before: Document, after: Document): EditChange[] {
  const result: EditChange[] = [
    ...difference(before.tracks, after.tracks).map((change) => ({
      kind: "track" as const,
      ...change,
    })),
    ...difference(before.clips, after.clips).map((change) => ({
      kind: "clip" as const,
      ...change,
    })),
    ...difference(before.syncGroups, after.syncGroups).map((change) => ({
      kind: "syncGroup" as const,
      ...change,
    })),
  ];
  if (JSON.stringify(before.canvas) !== JSON.stringify(after.canvas))
    result.unshift({ kind: "canvas", value: after.canvas });
  return result;
}

/** Identity namespace is supplied by the transaction owner and reused on replay. */
export function applyBatch(
  input: unknown,
  operations: unknown,
  identityContext: { assets: unknown; namespace: string },
): EditBatchResult {
  if (
    typeof identityContext.namespace !== "string" ||
    !identityContext.namespace ||
    identityContext.namespace.length > 256
  )
    invalid("Expected a nonempty identity namespace up to 256 characters");
  const parsed = z.array(editOperationSchema).max(1000).safeParse(operations);
  if (!parsed.success) invalid(parsed.error.message);
  let model = validateComposition(input, identityContext.assets);
  const initial = model.document;
  const identities = {
    clip: new Set(initial.clips.map((value) => value.id)),
    track: new Set(initial.tracks.map((value) => value.id)),
    syncGroup: new Set(initial.syncGroups.map((value) => value.id)),
  };
  const createdIds: EditBatchResult["createdIds"] = [];
  const bindings = new Map<string, { kind: EntityKind; id: string }>();
  const normalized: EditBatchResult["normalized"] = [];
  const clipLineage: EditBatchResult["clipLineage"] = [];
  const removedAttachments: string[] = [];
  const touchedFixedAnchors = new Map<string, { kind: "clip"; id: string }>();
  let ordinal = 0;
  const resolve = (value: z.infer<typeof reference>, kind: EntityKind): string => {
    if (typeof value === "string") return value;
    const bound = bindings.get(value.label);
    if (!bound || bound.kind !== kind)
      invalid("Operation label does not name the requested entity kind", {
        label: value.label,
        kind,
      });
    return bound.id;
  };
  const bind = (name: string | undefined, kind: EntityKind, id: string) => {
    if (name === undefined) return;
    if (bindings.has(name)) invalid("Operation label was already bound", { label: name });
    bindings.set(name, { kind, id });
  };
  const allocate = (kind: EntityKind): string => {
    const id = `${kind}:${identityContext.namespace}:${ordinal++}`;
    if (identities[kind].has(id))
      invalid("Identity namespace collides with an existing entity", { kind, id });
    identities[kind].add(id);
    createdIds.push({ kind, id });
    return id;
  };
  const clips = (refs: z.infer<typeof reference>[], allowMissing = false) => {
    const ids = refs.map((value) => resolve(value, "clip"));
    if (new Set(ids).size !== ids.length) invalid("Repeated clip reference");
    const known = new Set(model.document.clips.map((clip) => clip.id));
    for (const id of ids)
      if (!allowMissing && !known.has(id)) invalid("Unknown clip", { clipId: id });
    return ids;
  };
  for (const [operationIndex, operation] of parsed.data.entries()) {
    const before = model.document;
    let next: Document;
    try {
      switch (operation.operation) {
        case "insert": {
          const tracks = operation.ripple.trackIds.map((id) => resolve(id, "track"));
          const named = new Set(tracks);
          const at = fromTime(operation.atUs);
          const crossing = model.clips
            .filter(
              (value) =>
                value.clip.placement.kind === "project" &&
                named.has(value.clip.trackId) &&
                compare(value.range.start, at) < 0 &&
                compare(value.range.end, at) > 0,
            )
            .map((value) => value.clip.id);
          const partitioned = partitionClips(
            model,
            crossing,
            { kind: "split", atUs: operation.atUs, scope: "linked" },
            allocate,
          );
          const result = rippleTimeline(
            validateComposition(partitioned.document, model.assets),
            { kind: "insert", atUs: operation.atUs, durationUs: operation.durationUs },
            tracks,
          );
          next = result.document;
          clipLineage.push(...partitioned.lineage);
          for (const anchor of result.touchedFixedAnchors)
            touchedFixedAnchors.set(anchor.id, anchor);
          break;
        }
        case "retime": {
          const transformed = transformSelection(
            model,
            clips(operation.clipIds),
            { durationUs: operation.durationUs, pitch: operation.pitch },
            operation.scope,
            allocate,
            [],
          );
          if (operation.ripple === "none") next = transformed.document;
          else {
            const result = rippleTimeline(
              validateComposition(
                { ...before, syncGroups: transformed.document.syncGroups },
                model.assets,
              ),
              {
                kind: "resize",
                at: transformed.before.end,
                delta: subtract(transformed.after.end, transformed.before.end),
                targets: transformed.affected,
              },
              operation.ripple.trackIds.map((id) => resolve(id, "track")),
            );
            const selected = new Map(
              transformed.document.clips
                .filter((clip) => transformed.affected.has(clip.id))
                .map((clip) => [clip.id, clip]),
            );
            next = {
              ...result.document,
              clips: result.document.clips.map((clip) => selected.get(clip.id) ?? clip),
            };
            for (const anchor of result.touchedFixedAnchors)
              touchedFixedAnchors.set(anchor.id, anchor);
          }
          break;
        }
        case "duplicate": {
          const result = duplicateClips(
            model,
            clips(operation.clipIds),
            operation.atUs,
            operation.scope,
            operation.tracks.map((entry) => ({
              clipId: resolve(entry.clipId, "clip"),
              trackId: resolve(entry.trackId, "track"),
            })),
            allocate,
          );
          const copies = new Map(
            result.lineage.map((entry) => [entry.originalId, entry.clipIds[0]!]),
          );
          for (const entry of operation.copyLabels) {
            const originalId = resolve(entry.clipId, "clip");
            const id = copies.get(originalId);
            if (!id) invalid("Copy label target was not duplicated", { clipId: originalId });
            bind(entry.label, "clip", id);
          }
          next = result.document;
          clipLineage.push(...result.lineage);
          break;
        }
        case "reanchor": {
          const id = clips([operation.clipId])[0]!;
          const anchor = operation.placement;
          const resolvedAnchor =
            anchor.kind === "project"
              ? anchor
              : { ...anchor, clipId: resolve(anchor.clipId, "clip") };
          next = {
            ...before,
            clips: before.clips.map((clip) =>
              clip.id === id ? { ...clip, placement: resolvedAnchor } : clip,
            ),
          };
          const candidate = validateComposition(next, model.assets);
          const oldRange = model.clips.find((value) => value.clip.id === id)!.range;
          const newRange = candidate.clips.find((value) => value.clip.id === id)!.range;
          if (
            compare(oldRange.start, newRange.start) !== 0 ||
            compare(oldRange.end, newRange.end) !== 0
          )
            invalid(
              "Reanchor must preserve the current project interval; move or retime explicitly first",
              { clipId: id },
            );
          break;
        }
        case "detach": {
          const ids = new Set(clips(operation.clipIds));
          const resolved = new Map(model.clips.map((value) => [value.clip.id, value.range]));
          next = {
            ...before,
            clips: before.clips.map((clip) => {
              if (!ids.has(clip.id) || clip.placement.kind === "project") return clip;
              const range = resolved.get(clip.id)!;
              return {
                ...clip,
                placement: {
                  kind: "project" as const,
                  range: { startUs: toTime(range.start), endUs: toTime(range.end) },
                },
              };
            }),
          };
          break;
        }
        case "move": {
          next = transformSelection(
            model,
            clips(operation.clipIds),
            { atUs: operation.atUs },
            operation.scope,
            allocate,
            operation.tracks.map((entry) => ({
              clipId: resolve(entry.clipId, "clip"),
              trackId: resolve(entry.trackId, "track"),
            })),
          ).document;
          break;
        }
        case "remove":
        case "trim": {
          const ids =
            operation.operation === "remove"
              ? clips(operation.clipIds, true)
              : clips([operation.clipId]);
          let ranges: ExactRange[] | undefined;
          if (operation.operation === "remove") {
            ranges = operation.ranges?.map((range) => ({
              start: fromTime(range.startUs),
              end: fromTime(range.endUs),
            }));
          } else {
            const target = model.clips.find((value) => value.clip.id === ids[0])!.range;
            const keep = {
              start: fromTime(operation.range.startUs),
              end: fromTime(operation.range.endUs),
            };
            if (compare(keep.start, target.start) < 0 || compare(keep.end, target.end) > 0)
              invalid("Trim range must stay within the clip's resolved interval", {
                clipId: ids[0],
              });
            ranges = [];
            if (compare(target.start, keep.start) < 0)
              ranges.push({ start: target.start, end: keep.start });
            if (compare(keep.end, target.end) < 0)
              ranges.push({ start: keep.end, end: target.end });
          }
          const result = partitionClips(
            model,
            ids,
            { kind: "remove", scope: operation.scope, ...(ranges ? { ranges } : {}) },
            allocate,
          );
          if (operation.ripple === "none") next = result.document;
          else {
            const shifted = rippleTimeline(
              validateComposition(result.document, model.assets),
              { kind: "remove", ranges: result.removalRanges },
              operation.ripple.trackIds.map((id) => resolve(id, "track")),
            );
            next = shifted.document;
            for (const anchor of shifted.touchedFixedAnchors)
              touchedFixedAnchors.set(anchor.id, anchor);
          }
          clipLineage.push(...result.lineage);
          removedAttachments.push(...result.removedAttachments);
          break;
        }
        case "split": {
          const result = partitionClips(
            model,
            clips(operation.clipIds),
            { kind: "split", atUs: operation.atUs, scope: operation.scope },
            allocate,
          );
          for (const entry of operation.rightLabels) {
            const originalId = resolve(entry.clipId, "clip");
            const right = result.lineage.find((item) => item.originalId === originalId)?.clipIds[1];
            if (!right)
              invalid("Label target did not split at the requested time", {
                clipId: originalId,
                atUs: operation.atUs,
              });
            bind(entry.label, "clip", right);
          }
          next = result.document;
          clipLineage.push(...result.lineage);
          break;
        }
        case "track.add": {
          const id = allocate("track");
          bind(operation.label, "track", id);
          next = { ...before, tracks: [...before.tracks, { ...operation.track, id }] };
          break;
        }
        case "track.remove": {
          const id = resolve(operation.trackId, "track");
          const occupants = before.clips
            .filter((clip) => clip.trackId === id)
            .map((clip) => clip.id);
          if (occupants.length)
            invalid("Remove or move the track's clips explicitly first", {
              trackId: id,
              clipIds: occupants,
            });
          next = { ...before, tracks: before.tracks.filter((track) => track.id !== id) };
          break;
        }
        case "track.reorder": {
          const ids = operation.trackIds.map((value) => resolve(value, "track"));
          const visual = before.tracks.filter((track) => track.kind === "video");
          if (
            ids.length !== visual.length ||
            new Set(ids).size !== ids.length ||
            visual.some((track) => !ids.includes(track.id))
          )
            invalid("Reorder must name every video track exactly once");
          const order = new Map(ids.map((id, index) => [id, index]));
          next = {
            ...before,
            tracks: before.tracks.map((track) =>
              track.kind === "video" ? { ...track, order: order.get(track.id)! } : track,
            ),
          };
          break;
        }
        case "canvas.set": {
          const supplied = Object.fromEntries(
            Object.entries(operation.canvas).filter(([, value]) => value !== undefined),
          );
          next = { ...before, canvas: { ...before.canvas, ...supplied } };
          break;
        }
        case "place": {
          const id = allocate("clip");
          bind(operation.label, "clip", id);
          const anchor = operation.clip.placement;
          const clip = {
            ...operation.clip,
            id,
            trackId: resolve(operation.clip.trackId, "track"),
            placement:
              anchor.kind === "project"
                ? anchor
                : { ...anchor, clipId: resolve(anchor.clipId, "clip") },
          };
          next = { ...before, clips: [...before.clips, clip] };
          break;
        }
        case "link": {
          const ids = clips(operation.clipIds);
          const existing = before.syncGroups.find(
            (group) =>
              group.clipIds.length === ids.length && group.clipIds.every((id) => ids.includes(id)),
          );
          if (existing) {
            bind(operation.label, "syncGroup", existing.id);
            next = before;
            break;
          }
          const conflicts = before.syncGroups
            .filter((group) => group.clipIds.some((id) => ids.includes(id)))
            .map((group) => group.id);
          if (conflicts.length)
            invalid("Unlink conflicting groups explicitly before linking this selection", {
              groupIds: conflicts,
            });
          const id = allocate("syncGroup");
          bind(operation.label, "syncGroup", id);
          next = { ...before, syncGroups: [...before.syncGroups, { id, clipIds: ids }] };
          break;
        }
        case "unlink": {
          const ids = new Set(clips(operation.clipIds));
          next = {
            ...before,
            syncGroups: before.syncGroups.flatMap((group) => {
              const clipIds = group.clipIds.filter((id) => !ids.has(id));
              return clipIds.length >= 2 ? [{ ...group, clipIds }] : [];
            }),
          };
          break;
        }
      }
      model = validateComposition(next, model.assets);
      normalized.push({ operationIndex, changes: changes(before, model.document) });
    } catch (error) {
      if (error instanceof CompositionError)
        invalid(error.message, { ...error.details, operationIndex, cause: error.code });
      throw error;
    }
  }
  return {
    document: model.document,
    changed: changes(initial, model.document).length > 0,
    createdIds,
    labels: Object.fromEntries([...bindings].map(([name, value]) => [name, value.id])),
    normalized,
    clipLineage,
    removedAttachments,
    touchedFixedAnchors: [...touchedFixedAnchors.values()],
    linkChanges: normalized.flatMap((step) =>
      step.changes.filter(
        (change): change is Extract<EditChange, { kind: "syncGroup" }> =>
          change.kind === "syncGroup",
      ),
    ),
  };
}
