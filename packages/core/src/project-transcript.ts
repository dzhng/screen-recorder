import {
  compare,
  toTime,
  fromTime,
  floor,
  ceil,
  type ExactRange,
  type SelectionRange,
  type SourceWindowOccurrence,
} from "@screenrec/composition";
import {
  SourceTranscriptRead,
  transcriptSearchTerms,
  type SourceTranscriptRow,
} from "./transcript-read.js";
import type { TranscriptMetadata, TranscriptRecords } from "./transcript.js";
import { foldWord } from "./word-kind.js";
import { mergeHeads, compareKey, type EvidenceKey } from "./evidence-merge.js";
import type { EvidenceManifest, EvidencePlan, EvidenceCheckpoint } from "./project-evidence.js";
import { sourceSelectionKey as selectionKey } from "./source-selection.js";
const scanBudget = 128;
const range = (value: ExactRange): SelectionRange => ({
  startUs: toTime(value.start),
  endUs: toTime(value.end),
});
export type ProjectTranscriptRow = {
  clipId: string;
  assetId: string;
  streamId: string;
  acquisitionId?: string;
  trackId: string;
  trackRank: number;
  generation: string | null;
  sourceRange: SelectionRange;
  fragments: { source: SelectionRange; project: SelectionRange }[];
  partial: boolean;
} & (
  | Omit<Extract<SourceTranscriptRow, { type: "word" }>, "sourceRange" | "partial">
  | Omit<Extract<SourceTranscriptRow, { type: "gap" }>, "sourceRange" | "partial">
);

type ProjectTranscriptWord = Extract<ProjectTranscriptRow, { type: "word" }>;
export type ProjectTranscriptMatch = {
  trackId: string;
  trackRank: number;
  words: ProjectTranscriptWord[];
  projectRange: SelectionRange;
};
type MatchCandidate = { key: EvidenceKey; entry: ProjectTranscriptMatch };
type Candidate = { key: EvidenceKey; row: ProjectTranscriptRow };
export type TranscriptPosition = {
  clip: number;
  gap: number;
  cursor: unknown;
  done: boolean;
  pending: Candidate | null;
  head: Candidate | null;
  headKind: "source" | "gap" | null;
  suffix: { key: EvidenceKey; row: ProjectTranscriptWord }[];
  match: MatchCandidate | null;
};
export function initialTranscript(): TranscriptPosition {
  return {
    clip: 0,
    gap: 0,
    cursor: null,
    done: false,
    pending: null,
    head: null,
    headKind: null,
    suffix: [],
    match: null,
  };
}

export function mergeTranscript(
  manifest: EvidenceManifest,
  plan: EvidencePlan,
  state: EvidenceCheckpoint<TranscriptPosition>,
  limit: number,
  records: TranscriptRecords,
) {
  const occurrences = new Map(plan.occurrences.map((clip) => [clip.clipId, clip]));
  const dependencies = new Map(
    manifest.dependencies.map((dependency) => [selectionKey(dependency.selection), dependency]),
  );
  let budget = scanBudget;
  const common = (clip: SourceWindowOccurrence, transcript: TranscriptMetadata | null) => ({
    clipId: clip.clipId,
    assetId: clip.assetId,
    streamId: clip.streamId,
    ...(clip.acquisitionId === undefined ? {} : { acquisitionId: clip.acquisitionId }),
    trackId: clip.trackId,
    trackRank: clip.trackRank,
    generation: transcript?.generation ?? null,
  });
  const candidate = (row: ProjectTranscriptRow, ordinal: number): Candidate => ({
    row,
    key: {
      projectStartUs: row.fragments[0]!.project.startUs,
      trackRank: row.trackRank,
      clipId: row.clipId,
      sourceOrdinal: ordinal,
      eventKind: row.type,
    },
  });
  const project = (
    clip: SourceWindowOccurrence,
    transcript: TranscriptMetadata,
    row: SourceTranscriptRow,
  ): Candidate | null => {
    const instant = row.type === "word" && row.instant;
    const point = instant ? plan.projection.point(clip.clipId, row.sourceRange.startUs) : null;
    const projected = instant ? null : plan.projection.clip(clip.clipId, row.sourceRange);
    const fragments = point
      ? [
          {
            source: { start: point.source, end: point.source },
            project: { start: point.project, end: point.project },
          },
        ]
      : projected?.fragments;
    if (
      !fragments?.some(({ project: fragment }) =>
        instant
          ? compare(fragment.start, fromTime(plan.query.range.startUs)) >= 0 &&
            compare(fragment.start, fromTime(plan.query.range.endUs)) < 0
          : compare(fragment.end, fromTime(plan.query.range.startUs)) > 0 &&
            compare(fragment.start, fromTime(plan.query.range.endUs)) < 0,
      )
    )
      return null;
    return candidate(
      {
        ...row,
        ...common(clip, transcript),
        partial: projected?.completeness === "partial",
        fragments: fragments.map((fragment) => ({
          source: range(fragment.source),
          project: range(fragment.project),
        })),
      },
      row.type === "word" ? row.ordinal : -1,
    );
  };
  const fill = (index: number): boolean => {
    const track = state.tracks[index]!,
      clips = manifest.tracks[index]!.clipIds;
    while (track.clip < clips.length) {
      const clip = occurrences.get(clips[track.clip]!)!;
      const transcript = dependencies.get(selectionKey(clip))!.transcript;
      if (!track.pending && !track.done) {
        if (budget-- <= 0) return false;
        if (!transcript || !clip.fragments.length) track.done = true;
        else {
          const first = clip.fragments[0]!.source,
            last = clip.fragments.at(-1)!.source;
          const page = new SourceTranscriptRead(records, transcript).page({
            range: { startUs: floor(first.start), endUs: ceil(last.end) },
            ...(track.cursor === null ? {} : { cursor: track.cursor }),
            limit: 1,
          });
          track.cursor = page.nextCursor;
          track.done = page.nextCursor === null;
          const row = page.rows[0];
          if (row) track.pending = project(clip, transcript, row);
          if (!track.pending && !track.done) continue;
        }
      }
      const gap = clip.unavailable[track.gap];
      const gapCandidate = gap
        ? candidate(
            {
              ...common(clip, transcript),
              type: "gap",
              reason: "not_acquired",
              sourceRange: range(gap.source),
              partial: false,
              fragments: [{ source: range(gap.source), project: range(gap.project) }],
            },
            -1,
          )
        : null;
      if (gapCandidate || track.pending) {
        const gapFirst =
          gapCandidate && (!track.pending || compareKey(gapCandidate.key, track.pending.key) < 0);
        track.head = gapFirst ? gapCandidate : track.pending;
        track.headKind = gapFirst ? "gap" : "source";
        return true;
      }
      if (budget-- <= 0) return false;
      const nextClip = clips[track.clip + 1];
      if (nextClip && compare(clip.project.end, occurrences.get(nextClip)!.project.start) !== 0)
        track.suffix = [];
      track.clip++;
      track.gap = 0;
      track.cursor = null;
      track.done = false;
      track.pending = null;
    }
    track.head = null;
    track.headKind = null;
    return true;
  };
  const terms =
    manifest.query.text === undefined ? null : transcriptSearchTerms(manifest.query.text);
  const consume = (track: TranscriptPosition) => {
    if (track.headKind === "gap") track.gap++;
    else track.pending = null;
    track.head = null;
    track.headKind = null;
  };
  const fillNext = (index: number): boolean => {
    if (!terms) return fill(index);
    const track = state.tracks[index]!;
    for (;;) {
      if (budget <= 0) return false;
      if (!fill(index)) return false;
      const head = track.head;
      if (!head) return true;
      budget--;
      consume(track);
      if (head.row.type !== "word" || head.row.partial) {
        track.suffix = [];
        continue;
      }
      track.suffix.push({ key: head.key, row: head.row });
      if (track.suffix.length > terms.length) track.suffix.shift();
      if (
        track.suffix.length !== terms.length ||
        track.suffix.some((value, i) => foldWord(value.row.text) !== terms[i])
      )
        continue;
      const words = track.suffix.map(({ row }) => row);
      track.match = {
        key: track.suffix[0]!.key,
        entry: {
          trackId: head.row.trackId,
          trackRank: head.row.trackRank,
          words,
          projectRange: {
            startUs: words[0]!.fragments[0]!.project.startUs,
            endUs: words.at(-1)!.fragments.at(-1)!.project.endUs,
          },
        },
      };
      return true;
    }
  };
  const key = (index: number) =>
    terms ? state.tracks[index]!.match?.key : state.tracks[index]!.head?.key;
  const rows: ProjectTranscriptRow[] = [];
  const entries: ProjectTranscriptMatch[] = [];
  mergeHeads(state, manifest.tracks, limit, fillNext, key, (index) => {
    const track = state.tracks[index]!;
    if (terms) {
      entries.push(track.match!.entry);
      track.match = null;
    } else {
      rows.push(track.head!.row);
      consume(track);
    }
  });
  return { rows, entries };
}
