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
import { compare, fromTime } from "./rational.js";
import { isMediaClip, selectionRangeSchema, type SelectionRange } from "./schema.js";

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
  return {
    clip(clipId: string, range: SelectionRange): SourceRangeOccurrence | null {
      const value = clips.get(clipId);
      if (!value) throw new CompositionError("UNKNOWN_CLIP", `Unknown clip: ${clipId}`);
      return project(value, checked(range));
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
