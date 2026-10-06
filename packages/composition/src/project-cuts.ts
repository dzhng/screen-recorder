import { CompositionError } from "./errors.js";
import { sourceTime, type ValidatedComposition } from "./model.js";
import { compare, fromTime, toTime, type Rational } from "./rational.js";
import {
  isMediaClip,
  selectionRangeSchema,
  timeValueSchema,
  type SelectionRange,
  type TimeValue,
  type TextSource,
} from "./schema.js";

type Resolved = ValidatedComposition["clips"][number];
export type ProjectCutSide = { clipId: string } & (
  | { kind: "silence" }
  | { kind: "text"; text: TextSource }
  | {
      kind: "range" | "hold";
      assetId: string;
      streamId: string;
      acquisitionId?: string;
      sourceAtUs: TimeValue;
      rate: TimeValue;
    }
);
export type ProjectCut = {
  kind: "cut";
  projectAtUs: TimeValue;
  trackId: string;
  trackRank: number;
  mediaKind: "audio" | "video";
  before: ProjectCutSide | null;
  after: ProjectCutSide | null;
};
function side(value: Resolved | undefined, at: Rational): ProjectCutSide | null {
  if (!value) return null;
  const clip = value.clip;
  if (clip.source.kind === "text") return { clipId: clip.id, kind: "text", text: clip.source };
  if (!isMediaClip(clip)) return { clipId: clip.id, kind: "silence" };
  return {
    clipId: clip.id,
    kind: clip.source.kind,
    assetId: clip.assetId,
    streamId: clip.streamId,
    ...(clip.acquisitionId === undefined ? {} : { acquisitionId: clip.acquisitionId }),
    sourceAtUs: toTime(sourceTime(value, at)),
    rate: toTime(value.rate ?? fromTime(0)),
  };
}
function continuous(a: ProjectCutSide | null, b: ProjectCutSide | null) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "silence" || b.kind === "silence") return true;
  if (a.kind === "text" || b.kind === "text")
    return (
      a.kind === "text" && b.kind === "text" && JSON.stringify(a.text) === JSON.stringify(b.text)
    );
  return (
    a.assetId === b.assetId &&
    a.streamId === b.streamId &&
    a.acquisitionId === b.acquisitionId &&
    compare(fromTime(a.sourceAtUs), fromTime(b.sourceAtUs)) === 0 &&
    compare(fromTime(a.rate), fromTime(b.rate)) === 0
  );
}
/** Exact editorial transitions. Support gaps and renderer sampling do not author cuts. */
export function createProjectCuts(model: ValidatedComposition) {
  const byTrack = new Map(
    model.document.tracks.map((track) => [track.id, { track, clips: [] as Resolved[] }]),
  );
  let terminal = fromTime(0);
  for (const value of model.clips) {
    byTrack.get(value.track.id)!.clips.push(value);
    if (compare(value.range.end, terminal) > 0) terminal = value.range.end;
  }
  const tracks = new Map<string, ProjectCut[]>();
  for (const [id, { clips: values }] of byTrack) {
    const rows: ProjectCut[] = [];
    const add = (at: Rational, before?: Resolved, after?: Resolved) => {
      if (compare(at, fromTime(0)) === 0 || compare(at, terminal) === 0) return;
      const left = side(before, at),
        right = side(after, at);
      if (continuous(left, right)) return;
      const owner = (after ?? before)!;
      rows.push({
        kind: "cut",
        projectAtUs: toTime(at),
        trackId: id,
        trackRank: owner.trackRank,
        mediaKind: owner.track.kind,
        before: left,
        after: right,
      });
    };
    for (let i = 0; i < values.length; i++) {
      const value = values[i]!,
        previous = values[i - 1],
        next = values[i + 1];
      const touching = previous && compare(previous.range.end, value.range.start) === 0;
      add(value.range.start, touching ? previous : undefined, value);
      if (!next || compare(value.range.end, next.range.start) !== 0) add(value.range.end, value);
    }
    tracks.set(id, rows);
  }
  return {
    /** An explicit review point is not an authored cut or evidence of available media. */
    boundary(input: { trackId: string; projectAtUs: TimeValue }) {
      const parsed = timeValueSchema.safeParse(input.projectAtUs);
      if (!parsed.success) throw new CompositionError("INVALID_TIME", parsed.error.message);
      const at = fromTime(parsed.data);
      if (compare(at, fromTime(0)) < 0 || compare(at, terminal) > 0)
        throw new CompositionError("INVALID_TIME", "Boundary is outside the exact project extent");
      const selected = byTrack.get(input.trackId);
      if (!selected)
        throw new CompositionError("INVALID_COMPOSITION", `Unknown track: ${input.trackId}`);
      const { track, clips: values } = selected;
      let lo = 0,
        hi = values.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (compare(values[mid]!.range.start, at) < 0) lo = mid + 1;
        else hi = mid;
      }
      const left = values[lo - 1],
        right = values[lo];
      const before = left && compare(at, left.range.end) <= 0 ? left : undefined;
      const after =
        right && compare(right.range.start, at) === 0
          ? right
          : left && compare(at, left.range.end) < 0
            ? left
            : undefined;
      return {
        projectAtUs: toTime(at),
        trackId: track.id,
        mediaKind: track.kind,
        before: side(before, at),
        after: side(after, at),
      };
    },
    window(input: { range: SelectionRange; trackIds?: readonly string[] }): ProjectCut[] {
      const parsed = selectionRangeSchema.safeParse(input.range);
      if (!parsed.success) throw new CompositionError("INVALID_TIME", parsed.error.message);
      const start = fromTime(parsed.data.startUs),
        end = fromTime(parsed.data.endUs);
      const selected: ProjectCut[] = [];
      for (const id of new Set(input.trackIds ?? tracks.keys())) {
        const rows = tracks.get(id);
        if (!rows) throw new CompositionError("INVALID_COMPOSITION", `Unknown track: ${id}`);
        let lo = 0,
          hi = rows.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (compare(fromTime(rows[mid]!.projectAtUs), start) < 0) lo = mid + 1;
          else hi = mid;
        }
        for (let i = lo; i < rows.length && compare(fromTime(rows[i]!.projectAtUs), end) < 0; i++)
          selected.push(rows[i]!);
      }
      return selected.sort(
        (a, b) =>
          compare(fromTime(a.projectAtUs), fromTime(b.projectAtUs)) || a.trackRank - b.trackRank,
      );
    },
  };
}
