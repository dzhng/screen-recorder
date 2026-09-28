import { CompositionError } from "./errors.js";
import { intervalIndex } from "./interval-index.js";
import {
  intersection,
  intersectAll,
  projectTime,
  sourceTime,
  type ExactRange,
  type ValidatedComposition,
} from "./model.js";
import { compare, fromTime, type Rational } from "./rational.js";
import {
  isMediaClip,
  selectionRangeSchema,
  timeValueSchema,
  type SelectionRange,
  type TimeValue,
} from "./schema.js";

type Resolved = ValidatedComposition["clips"][number];
export type SourceRangeOccurrence = {
  clipId: string;
  assetId: string;
  streamId: string;
  trackId: string;
  trackOrder: number;
  source: ExactRange;
  completeness: "whole" | "partial";
  fragments: { source: ExactRange; project: ExactRange }[];
};
type OccurrenceIdentity = {
  clipId: string;
  assetId: string;
  streamId: string;
  acquisitionId?: string;
  trackId: string;
  trackRank: number;
};
export type SourceWindowOccurrence = OccurrenceIdentity & {
  /** The selected editorial envelope, including times where source evidence is unavailable. */
  project: ExactRange;
  fragments: { source: ExactRange; project: ExactRange }[];
  unavailable: { source: ExactRange; project: ExactRange }[];
};
export type SourcePointOccurrence = OccurrenceIdentity & { source: Rational; project: Rational };
function occurrenceIdentity(value: Resolved): OccurrenceIdentity {
  const clip = value.clip;
  if (!isMediaClip(clip)) throw new CompositionError("UNKNOWN_SOURCE", "Clip has no media source");
  return {
    clipId: clip.id,
    assetId: clip.assetId,
    streamId: clip.streamId,
    ...(clip.acquisitionId === undefined ? {} : { acquisitionId: clip.acquisitionId }),
    trackId: clip.trackId,
    trackRank: value.trackRank,
  };
}
function advancing(value: Resolved) {
  return isMediaClip(value.clip) && value.clip.source.kind === "range";
}
const exact = (range: SelectionRange): ExactRange => ({
  start: fromTime(range.startUs),
  end: fromTime(range.endUs),
});
function checked(input: SelectionRange): ExactRange {
  const parsed = selectionRangeSchema.safeParse(input);
  if (!parsed.success) throw new CompositionError("INVALID_TIME", parsed.error.message);
  return exact(parsed.data);
}
function project(value: Resolved, source: ExactRange): SourceRangeOccurrence | null {
  const clip = value.clip;
  if (!isMediaClip(clip) || clip.source.kind !== "range") return null;
  const selected = intersection(source, exact(clip.source.range));
  if (!selected) return null;
  const projected = {
    start: projectTime(value, selected.start),
    end: projectTime(value, selected.end),
  };
  const fragments = intersectAll([projected], value.available).map((project) => ({
    source: {
      start: sourceTime(value, project.start),
      end: sourceTime(value, project.end),
    },
    project,
  }));
  if (!fragments.length) return null;
  // Coverage, not the outer envelope: a hole inside a word makes it partial.
  let through = source.start;
  let whole = true;
  for (const fragment of fragments) {
    if (compare(fragment.source.start, through) !== 0) whole = false;
    through = fragment.source.end;
  }
  return {
    clipId: clip.id,
    assetId: clip.assetId,
    streamId: clip.streamId,
    trackId: clip.trackId,
    trackOrder: value.trackRank,
    source,
    completeness: whole && compare(through, source.end) === 0 ? "whole" : "partial",
    fragments,
  };
}

/** Build once per immutable revision. Named reads never traverse unrelated occurrences. */
export function createSourceRangeProjection(model: ValidatedComposition) {
  const clips = new Map(model.clips.map((value) => [value.clip.id, value]));
  type Entry = { value: Resolved; range: ExactRange };
  const streams = new Map<string, Map<string, Entry[]>>();
  for (const asset of model.assets)
    streams.set(asset.id, new Map(asset.streams.map((stream) => [stream.id, []])));
  for (const value of model.clips) {
    const clip = value.clip;
    if (isMediaClip(clip) && clip.source.kind === "range")
      streams
        .get(clip.assetId)!
        .get(clip.streamId)!
        .push({ value, range: exact(clip.source.range) });
  }
  const indexes = new Map(
    [...streams].map(([asset, members]) => [
      asset,
      new Map(
        [...members].map(([stream, entries]) => [
          stream,
          intervalIndex(entries, (entry) => entry.range),
        ]),
      ),
    ]),
  );
  const timed = model.clips.filter(advancing);
  const projectIndex = intervalIndex(timed, (value) => value.range);
  const tracks = new Map(model.document.tracks.map((track) => [track.id, [] as Resolved[]]));
  for (const value of timed) tracks.get(value.clip.trackId)!.push(value);
  const trackIndexes = new Map(
    [...tracks].map(([id, values]) => [id, intervalIndex(values, (value) => value.range)]),
  );
  const support = new Map(
    timed.map((value) => [value.clip.id, intervalIndex(value.available, (range) => range)]),
  );
  function named(clipId: string) {
    const value = clips.get(clipId);
    if (!value) throw new CompositionError("UNKNOWN_CLIP", `Unknown clip: ${clipId}`);
    return value;
  }
  function inverse(value: Resolved, window: ExactRange): SourceWindowOccurrence | null {
    if (!advancing(value)) return null;
    const project = intersection(value.range, window);
    if (!project) return null;
    const fragments = support.get(value.clip.id)!(project.start, project.end)
      .map((available) => intersection(available, project)!)
      .sort((a, b) => compare(a.start, b.start))
      .map((project) => ({
        project,
        source: { start: sourceTime(value, project.start), end: sourceTime(value, project.end) },
      }));
    const unavailable: SourceWindowOccurrence["unavailable"] = [];
    let through = project.start;
    for (const next of [
      ...fragments.map((fragment) => fragment.project),
      { start: project.end, end: project.end },
    ]) {
      if (compare(through, next.start) < 0)
        unavailable.push({
          project: { start: through, end: next.start },
          source: { start: sourceTime(value, through), end: sourceTime(value, next.start) },
        });
      through = next.end;
    }
    return { ...occurrenceIdentity(value), project, fragments, unavailable };
  }
  function point(clipId: string, atUs: TimeValue, endpoint: boolean): SourcePointOccurrence | null {
    const value = named(clipId);
    const parsed = timeValueSchema.safeParse(atUs);
    if (!parsed.success) throw new CompositionError("INVALID_TIME", parsed.error.message);
    if (!advancing(value)) return null;
    const source = fromTime(parsed.data),
      project = projectTime(value, source);
    const available = support.get(clipId)!;
    if (!(endpoint ? available.before(project) : available(project)).length) return null;
    return { ...occurrenceIdentity(value), source, project };
  }
  return {
    window(input: {
      range: SelectionRange;
      trackIds?: readonly string[];
    }): SourceWindowOccurrence[] {
      const window = checked(input.range);
      const candidates =
        input.trackIds === undefined
          ? projectIndex(window.start, window.end)
          : [...new Set(input.trackIds)].flatMap((id) => {
              const query = trackIndexes.get(id);
              if (!query) throw new CompositionError("INVALID_COMPOSITION", `Unknown track: ${id}`);
              return query(window.start, window.end);
            });
      return candidates
        .map((value) => inverse(value, window)!)
        .sort(
          (a, b) =>
            compare(a.project.start, b.project.start) ||
            a.trackRank - b.trackRank ||
            (a.clipId < b.clipId ? -1 : a.clipId > b.clipId ? 1 : 0),
        );
    },
    inverse(clipId: string, range: SelectionRange): SourceWindowOccurrence | null {
      return inverse(named(clipId), checked(range));
    },
    point(clipId: string, atUs: TimeValue): SourcePointOccurrence | null {
      return point(clipId, atUs, false);
    },
    /** Closing boundary of retained support; ordinary sample points remain half-open. */
    endpoint(clipId: string, atUs: TimeValue): SourcePointOccurrence | null {
      return point(clipId, atUs, true);
    },
    clip(clipId: string, range: SelectionRange): SourceRangeOccurrence | null {
      return project(named(clipId), checked(range));
    },
    all(input: {
      assetId: string;
      streamId: string;
      range: SelectionRange;
    }): SourceRangeOccurrence[] {
      const query = indexes.get(input.assetId)?.get(input.streamId);
      if (!query)
        throw new CompositionError(
          "UNKNOWN_SOURCE",
          `Unknown source: ${input.assetId}/${input.streamId}`,
        );
      const source = checked(input.range);
      return query(source.start, source.end)
        .flatMap((value) => {
          const occurrence = project(value.value, source);
          return occurrence ? [occurrence] : [];
        })
        .sort(
          (a, b) =>
            compare(a.fragments[0]!.project.start, b.fragments[0]!.project.start) ||
            a.trackOrder - b.trackOrder ||
            (a.clipId < b.clipId ? -1 : a.clipId > b.clipId ? 1 : 0),
        );
    },
  };
}
