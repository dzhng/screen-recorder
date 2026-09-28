import { sourceTime, intersection, type ValidatedComposition, type ExactRange } from "./model.js";
import { compare, fromTime, toTime, type Rational } from "./rational.js";
import { isMediaClip, type SelectionRange, type Range } from "./schema.js";

type Run = {
  assetId: string;
  streamId: string;
  pitch: "preserve" | "follow";
  rate: Rational;
  project: ExactRange;
  source: ExactRange;
};

/** Current retained support owns filter input; clip IDs and post-resampling gains do not. */
export function audioContexts(model: ValidatedComposition) {
  const active = new Map<string, Run>();
  const owners = new Map<string, Run[]>();
  for (const value of model.clips) {
    if (value.track.kind !== "audio") continue;
    const clip = value.clip;
    const runs: Run[] = [];
    owners.set(clip.id, runs);
    if (!isMediaClip(clip) || clip.source.kind !== "range") continue;
    for (const project of value.available) {
      const source = {
        start: sourceTime(value, project.start),
        end: sourceTime(value, project.end),
      };
      let run = active.get(clip.trackId);
      const pitch = clip.pitch ?? "preserve";
      if (
        run &&
        run.assetId === clip.assetId &&
        run.streamId === clip.streamId &&
        run.pitch === pitch &&
        compare(run.rate, value.rate!) === 0 &&
        compare(run.project.end, project.start) === 0 &&
        compare(run.source.end, source.start) === 0
      ) {
        run.project = { start: run.project.start, end: project.end };
        run.source = { start: run.source.start, end: source.end };
      } else {
        run = {
          assetId: clip.assetId,
          streamId: clip.streamId,
          pitch,
          rate: value.rate!,
          project,
          source,
        };
        active.set(clip.trackId, run);
      }
      if (runs.at(-1) !== run) runs.push(run);
    }
  }
  const serialized = new Map<Run, SelectionRange>();
  const contexts = new Map(
    [...owners].map(([id, runs]) => [
      id,
      Object.freeze(
        runs.map((run) => {
          let range = serialized.get(run);
          if (!range) {
            range = Object.freeze({
              startUs: Object.freeze(toTime(run.source.start)),
              endUs: Object.freeze(toTime(run.source.end)),
            });
            serialized.set(run, range);
          }
          return range;
        }),
      ),
    ]),
  );
  return (
    value: ValidatedComposition["clips"][number],
    range: Range,
  ): readonly SelectionRange[] => {
    const ranges = contexts.get(value.clip.id) ?? [];
    if (ranges.length === 0) return Object.freeze([]);
    const kept = intersection(value.range, {
      start: fromTime(range.startUs),
      end: fromTime(range.endUs),
    });
    if (!kept) return Object.freeze([]);
    const start = sourceTime(value, kept.start),
      end = sourceTime(value, kept.end);
    let first = 0,
      after = ranges.length;
    while (first < after) {
      const middle = Math.floor((first + after) / 2);
      if (compare(fromTime(ranges[middle]!.endUs), start) <= 0) first = middle + 1;
      else after = middle;
    }
    after = first;
    while (after < ranges.length && compare(fromTime(ranges[after]!.startUs), end) < 0) after++;
    return Object.freeze(ranges.slice(first, after));
  };
}
