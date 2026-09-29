import { deriveStatePlan } from "./processing-state.js";
import { validateProcessing } from "./processing.js";
import { resolveRouting } from "./routing.js";
import {
  assetSchema,
  acquisitionContextSchema,
  type AcquisitionContext,
  compositionSchema,
  anchorSchema,
  type Anchor,
  type Asset,
  type Clip,
  type MediaClip,
  isMediaClip,
  type Composition,
  type Range,
  type SelectionRange,
  type Stream,
} from "./schema.js";
import {
  add,
  subtract,
  multiply,
  divide,
  compare,
  rational,
  floor,
  ceil,
  type Rational,
  fromTime,
  toTime,
  toFraction,
} from "./rational.js";
import { CompositionError } from "./errors.js";
type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;
export type ExactRange = Readonly<{ start: Rational; end: Rational }>;
export type ResolvedPlacement = Readonly<{ range: ExactRange; available: readonly ExactRange[] }>;
type ResolvedClip = ResolvedPlacement & {
  anchorSupport: readonly ExactRange[];
  clip: Immutable<Clip>;
  stream: Immutable<Stream> | null;
  track: Immutable<Composition["tracks"][number]>;
  trackRank: number;
  rate: Rational | null;
};
export type ValidatedComposition = Readonly<{
  document: Immutable<Composition>;
  assets: readonly Immutable<Asset>[];
  acquisitions: readonly Immutable<AcquisitionContext>[];
  clips: readonly Immutable<ResolvedClip>[];
  durationUs: number;
}>;
function freeze<T>(value: T): Immutable<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}
function invalid(message: string): never {
  throw new CompositionError("INVALID_COMPOSITION", message);
}
const integer = (value: number) => rational(BigInt(value));
const exact = (range: Range | SelectionRange): ExactRange => ({
  start: fromTime(range.startUs),
  end: fromTime(range.endUs),
});
const length = (range: ExactRange) => subtract(range.end, range.start);
const contains = (range: ExactRange, at: Rational) =>
  compare(range.start, at) <= 0 && compare(at, range.end) < 0;
export function intersection(a: ExactRange, b: ExactRange): ExactRange | null {
  const start = compare(a.start, b.start) < 0 ? b.start : a.start;
  const end = compare(a.end, b.end) < 0 ? a.end : b.end;
  return compare(start, end) < 0 ? { start, end } : null;
}
export function intersectAll(a: readonly ExactRange[], b: readonly ExactRange[]): ExactRange[] {
  const result: ExactRange[] = [];
  let left = 0,
    right = 0;
  while (left < a.length && right < b.length) {
    const x = a[left]!,
      y = b[right]!;
    const overlap = intersection(x, y);
    if (overlap) result.push(overlap);
    if (compare(x.end, y.end) <= 0) left++;
    else right++;
  }
  return result;
}
/** Integer source-clock support shared by composition and direct source inspection. */
export function sourceAvailability(
  physical: readonly Range[],
  acquisition?: readonly Range[],
): Range[] {
  if (acquisition === undefined) return physical.map((range) => ({ ...range }));
  return intersectAll(physical.map(exact), acquisition.map(exact)).map((range) => ({
    startUs: floor(range.start),
    endUs: floor(range.end),
  }));
}
function unique<T extends { id: string }>(values: readonly T[], kind: string): Map<string, T> {
  const entries = new Map<string, T>();
  for (const value of values) {
    if (entries.has(value.id)) invalid(`Duplicate ${kind} ID: ${value.id}`);
    entries.set(value.id, value);
  }
  return entries;
}
type SourceClock = Pick<ResolvedClip, "clip" | "range" | "rate">;
export function sourceTime(clip: SourceClock, project: Rational): Rational {
  if (clip.clip.source.kind === "hold") return integer(clip.clip.source.atUs);
  if (clip.clip.source.kind !== "range") invalid(`Clip has no source clock: ${clip.clip.id}`);
  return add(
    fromTime(clip.clip.source.range.startUs),
    multiply(subtract(project, clip.range.start), clip.rate!),
  );
}
export function projectTime(clip: SourceClock, source: Rational): Rational {
  if (clip.clip.source.kind !== "range")
    invalid(`Clip has no invertible source clock: ${clip.clip.id}`);
  return add(
    clip.range.start,
    divide(subtract(source, fromTime(clip.clip.source.range.startUs)), clip.rate!),
  );
}
function placement(anchor: Anchor, resolved: ReadonlyMap<string, ResolvedClip>): ResolvedPlacement {
  if (anchor.kind === "project") {
    const range = exact(anchor.range);
    return { range, available: [range] };
  }
  const parent = resolved.get(anchor.clipId);
  if (!parent) invalid(`Unresolved anchor parent: ${anchor.clipId}`);
  let range: ExactRange;
  if (anchor.kind === "content") {
    if (parent.clip.source.kind !== "range")
      invalid(`Use a normalized clip anchor for content without a source clock: ${anchor.clipId}`);
    const source = parent.clip.source.range;
    if (
      compare(fromTime(anchor.sourceRange.startUs), fromTime(source.startUs)) < 0 ||
      compare(fromTime(anchor.sourceRange.endUs), fromTime(source.endUs)) > 0
    )
      invalid(`Content anchor exceeds selected parent source: ${anchor.clipId}`);
    range = {
      start: projectTime(parent, fromTime(anchor.sourceRange.startUs)),
      end: projectTime(parent, fromTime(anchor.sourceRange.endUs)),
    };
  } else {
    range = {
      start: add(
        parent.range.start,
        multiply(
          length(parent.range),
          rational(BigInt(anchor.start.numerator), BigInt(anchor.start.denominator)),
        ),
      ),
      end: add(
        parent.range.start,
        multiply(
          length(parent.range),
          rational(BigInt(anchor.end.numerator), BigInt(anchor.end.denominator)),
        ),
      ),
    };
  }
  return { range, available: intersectAll([range], parent.available) };
}

/** Restrict placement while retaining its project, source or normalized anchor domain. */
export function placementForRange(
  clip: Immutable<Clip>,
  range: ExactRange,
  parent?: SourceClock,
): Anchor {
  const anchor = clip.placement;
  if (anchor.kind === "project")
    return { kind: "project", range: { startUs: toTime(range.start), endUs: toTime(range.end) } };
  if (!parent) invalid(`Unresolved anchor parent: ${anchor.clipId}`);
  if (compare(range.start, parent.range.start) < 0 || compare(range.end, parent.range.end) > 0)
    throw new CompositionError(
      "INVALID_EDIT",
      "Requested interval leaves its parent interval; detach or reanchor first",
      { clipId: clip.id, parentClipId: parent.clip.id },
    );
  if (anchor.kind === "content")
    return {
      kind: "content",
      clipId: parent.clip.id,
      sourceRange: {
        startUs: toTime(sourceTime(parent, range.start)),
        endUs: toTime(sourceTime(parent, range.end)),
      },
    };
  return {
    kind: "clip",
    clipId: parent.clip.id,
    start: toFraction(divide(subtract(range.start, parent.range.start), length(parent.range))),
    end: toFraction(divide(subtract(range.end, parent.range.start), length(parent.range))),
  };
}

export function validateSourceSelection(
  source: MediaClip["source"],
  stream: Immutable<Stream>,
  clipId: string,
) {
  if (source.kind === "hold") {
    if (stream.kind === "audio") invalid(`Audio cannot be held: ${clipId}`);
    if (
      stream.kind === "image"
        ? source.atUs !== 0
        : !contains(exact(stream.bounds), integer(source.atUs))
    )
      invalid(`Hold exceeds source bounds: ${clipId}`);
  } else {
    if (stream.kind === "image") invalid(`Still images require a hold source: ${clipId}`);
    if (
      compare(fromTime(source.range.startUs), integer(stream.bounds.startUs)) < 0 ||
      compare(fromTime(source.range.endUs), integer(stream.bounds.endUs)) > 0
    )
      invalid(`Selected range exceeds source bounds: ${clipId}`);
  }
}

/** Snapshot admitted stream metadata and authoring data; no media or catalog access. */
export function resolveComposition(
  input: unknown,
  assetInput: unknown,
  acquisitionInput: unknown = [],
): ValidatedComposition {
  const documentResult = compositionSchema.safeParse(input);
  const assetResult = assetSchema.array().safeParse(assetInput);
  if (!documentResult.success) invalid(documentResult.error.message);
  if (!assetResult.success) invalid(assetResult.error.message);
  const acquisitionResult = acquisitionContextSchema.array().safeParse(acquisitionInput);
  if (!acquisitionResult.success) invalid(acquisitionResult.error.message);
  const document = documentResult.data,
    assets = assetResult.data,
    acquisitions = acquisitionResult.data;
  const contexts = new Map<string, Map<string, Map<string, Range[]>>>();
  for (const context of unique(acquisitions, "acquisition").values()) {
    const bindings = new Map<string, Map<string, Range[]>>();
    contexts.set(context.id, bindings);
    for (const binding of context.bindings) {
      let streams = bindings.get(binding.assetId);
      if (!streams) bindings.set(binding.assetId, (streams = new Map()));
      if (streams.has(binding.streamId))
        invalid(
          `Duplicate acquisition binding: ${context.id}/${binding.assetId}/${binding.streamId}`,
        );
      let through = 0;
      for (const range of binding.available) {
        if (range.startUs < through) invalid(`Invalid acquisition availability: ${context.id}`);
        through = range.endUs;
      }
      streams.set(binding.streamId, binding.available);
    }
  }
  const assetMap = unique(assets, "asset"),
    tracks = unique(document.tracks, "track"),
    clips = unique(document.clips, "clip");
  const streams = new Map<string, Map<string, Stream>>();
  for (const asset of assetMap.values()) {
    streams.set(asset.id, unique(asset.streams, "stream"));
    for (const stream of asset.streams)
      if (stream.kind !== "image") {
        let through = stream.bounds.startUs;
        for (const range of stream.available) {
          if (range.startUs < through || range.endUs > stream.bounds.endUs)
            invalid(`Invalid source availability: ${asset.id}/${stream.id}`);
          through = range.endUs;
        }
      }
  }
  const trackRanks = new Map(resolveRouting(document).map((id, rank) => [id, rank]));
  const grouped = new Set<string>();
  for (const group of unique(document.syncGroups, "sync group").values())
    for (const id of group.clipIds) {
      if (!clips.has(id)) invalid(`Unknown synchronized clip: ${id}`);
      if (grouped.has(id)) invalid(`Clip belongs to multiple synchronization entries: ${id}`);
      grouped.add(id);
    }
  const ready: Clip[] = [],
    children = new Map<string, Clip[]>();
  for (const clip of clips.values()) {
    if (clip.placement.kind === "project") ready.push(clip);
    else {
      const parent = clip.placement.clipId;
      if (!clips.has(parent)) invalid(`Unknown anchor parent: ${parent}`);
      const dependents = children.get(parent) ?? [];
      dependents.push(clip);
      children.set(parent, dependents);
    }
  }
  const resolved = new Map<string, ResolvedClip>();
  for (let next = 0; next < ready.length; next++) {
    const clip = ready[next]!;
    const track = tracks.get(clip.trackId);
    if (!track) invalid(`Unknown track: ${clip.trackId}`);
    let stream: Stream | null = null;
    let acquisition: Range[] | undefined;
    if (isMediaClip(clip)) {
      const found = streams.get(clip.assetId)?.get(clip.streamId);
      if (!found) invalid(`Unknown source: ${clip.assetId}/${clip.streamId}`);
      stream = found;
      if (clip.acquisitionId !== undefined) {
        acquisition = contexts.get(clip.acquisitionId)?.get(clip.assetId)?.get(clip.streamId);
        if (acquisition === undefined)
          invalid(
            `Unknown acquisition binding: ${clip.acquisitionId}/${clip.assetId}/${clip.streamId}`,
          );
      }
      if ((stream.kind === "audio" ? "audio" : "video") !== track.kind)
        invalid(`Stream/track kind mismatch: ${clip.id}`);
      if (clip.pitch !== undefined && stream.kind !== "audio")
        invalid(`Pitch policy requires audio: ${clip.id}`);
      validateSourceSelection(clip.source, stream, clip.id);
    } else if (clip.source.kind === "text") {
      if (track.kind !== "video") invalid(`Text requires a video track: ${clip.id}`);
      if (
        !assetMap
          .get(clip.source.font.assetId)
          ?.fontFaces?.includes(clip.source.font.postScriptName)
      )
        invalid(
          `Unknown exact font face: ${clip.source.font.assetId}/${clip.source.font.postScriptName}`,
        );
    } else if (track.kind !== "audio") invalid(`Silence requires an audio track: ${clip.id}`);
    const anchor = placement(clip.placement, resolved);
    const rate =
      clip.source.kind === "range"
        ? divide(length(exact(clip.source.range)), length(anchor.range))
        : null;
    const result: ResolvedClip = {
      ...anchor,
      anchorSupport: anchor.available,
      clip,
      track,
      trackRank: trackRanks.get(track.id)!,
      stream,
      rate,
    };
    let available: ExactRange[] = [anchor.range];
    if (stream && isMediaClip(clip) && (stream.kind !== "image" || acquisition)) {
      const support = (
        stream.kind === "image" ? acquisition! : sourceAvailability(stream.available, acquisition)
      ).map(exact);
      if (clip.source.kind === "hold") {
        const at = integer(clip.source.atUs);
        available = support.some((range) => contains(range, at)) ? [anchor.range] : [];
      } else {
        const selected = exact(clip.source.range);
        available = support.flatMap((range) => {
          const kept = intersection(range, selected);
          return kept
            ? [{ start: projectTime(result, kept.start), end: projectTime(result, kept.end) }]
            : [];
        });
      }
    }
    resolved.set(clip.id, { ...result, available: intersectAll(anchor.available, available) });
    for (const child of children.get(clip.id) ?? []) ready.push(child);
  }
  if (resolved.size !== clips.size) invalid("Anchor dependency cycle");
  const ordered = [...resolved.values()].sort(
    (a, b) =>
      compare(a.range.start, b.range.start) ||
      a.trackRank - b.trackRank ||
      (a.clip.id < b.clip.id ? -1 : a.clip.id > b.clip.id ? 1 : 0),
  );
  const last = new Map<string, ResolvedClip>();
  let durationUs = 0;
  for (const clip of ordered) {
    const previous = last.get(clip.track.id);
    if (previous && compare(previous.range.end, clip.range.start) > 0)
      invalid(`Overlapping clips on track: ${clip.track.id}`);
    last.set(clip.track.id, clip);
    durationUs = Math.max(durationUs, ceil(clip.range.end));
  }
  validateProcessing(document);
  return freeze({ document, assets, acquisitions, clips: ordered, durationUs });
}

/** Admission validates state-domain meaning without applying editor repairs. */
export function validateComposition(
  input: unknown,
  assetInput: unknown,
  acquisitionInput: unknown = [],
): ValidatedComposition {
  const model = resolveComposition(input, assetInput, acquisitionInput);
  deriveStatePlan(model);
  return model;
}

// The frozen revision owns these resolved objects; this index adds no alternate timing state.
const clipLookups = new WeakMap<
  ValidatedComposition,
  ReadonlyMap<string, ValidatedComposition["clips"][number]>
>();
function clipLookup(model: ValidatedComposition) {
  let lookup = clipLookups.get(model);
  if (!lookup) {
    lookup = new Map(model.clips.map((clip) => [clip.clip.id, clip]));
    clipLookups.set(model, lookup);
  }
  return lookup;
}
export function resolvedClip(model: ValidatedComposition, id: string) {
  const clip = clipLookup(model).get(id);
  if (!clip) throw new CompositionError("UNKNOWN_CLIP", `Unknown clip: ${id}`);
  return clip;
}

/** Exact envelope plus source-available fragments; neither closes acquisition gaps. */
export function resolvePlacement(
  model: ValidatedComposition,
  target: string | Anchor,
): ResolvedPlacement {
  if (typeof target === "string") {
    const found = resolvedClip(model, target);
    return { range: found.range, available: found.available };
  }
  const parsed = anchorSchema.safeParse(target);
  if (!parsed.success) invalid(parsed.error.message);
  return freeze(placement(parsed.data, clipLookup(model)));
}
function checkTime(atUs: number): Rational {
  if (!Number.isSafeInteger(atUs) || atUs < 0)
    throw new CompositionError("INVALID_TIME", "Expected nonnegative safe-integer microseconds");
  return integer(atUs);
}
export type SourceOccurrence = Readonly<{
  clipId: string;
  assetId: string;
  streamId: string;
  trackId: string;
  sourceUs: number;
  available: boolean;
}>;
export function projectToSource(model: ValidatedComposition, atUs: number): SourceOccurrence[] {
  const at = checkTime(atUs);
  return model.clips.flatMap((value) => {
    const clip = value.clip;
    if (!isMediaClip(clip) || !contains(value.range, at)) return [];
    return [
      {
        clipId: clip.id,
        assetId: clip.assetId,
        streamId: clip.streamId,
        trackId: clip.trackId,
        sourceUs: floor(sourceTime(value, at)),
        available: value.available.some((range) => contains(range, at)),
      },
    ];
  });
}
export type ProjectOccurrence = Readonly<{
  clipId: string;
  trackId: string;
  trackOrder: number;
  project: ExactRange;
  available: readonly ExactRange[];
  firstProjectUs: number | null;
}>;
/** All occurrences of a source microsecond bin, including a held bin's entire interval. */
export function sourceToProject(
  model: ValidatedComposition,
  query: { assetId: string; streamId: string; atUs: number },
): ProjectOccurrence[] {
  const at = checkTime(query.atUs);
  const asset = model.assets.find((item) => item.id === query.assetId);
  if (!asset?.streams.some((stream) => stream.id === query.streamId))
    throw new CompositionError(
      "UNKNOWN_SOURCE",
      `Unknown source: ${query.assetId}/${query.streamId}`,
    );
  const occurrences = model.clips.flatMap((clip) => {
    if (
      !isMediaClip(clip.clip) ||
      clip.clip.assetId !== query.assetId ||
      clip.clip.streamId !== query.streamId
    )
      return [];
    const source = clip.clip.source;
    let project: ExactRange;
    if (source.kind === "hold") {
      if (source.atUs !== query.atUs) return [];
      project = clip.range;
    } else {
      const selected = intersection(exact(source.range), {
        start: at,
        end: rational(BigInt(query.atUs) + 1n),
      });
      if (!selected) return [];
      project = { start: projectTime(clip, selected.start), end: projectTime(clip, selected.end) };
    }
    const first = ceil(project.start);
    return [
      {
        clipId: clip.clip.id,
        trackId: clip.clip.trackId,
        trackOrder: clip.trackRank,
        project,
        available: intersectAll([project], clip.available),
        firstProjectUs: contains(project, integer(first)) ? first : null,
      },
    ];
  });
  return occurrences.sort(
    (a, b) =>
      compare(a.project.start, b.project.start) ||
      a.trackOrder - b.trackOrder ||
      (a.clipId < b.clipId ? -1 : a.clipId > b.clipId ? 1 : 0),
  );
}
