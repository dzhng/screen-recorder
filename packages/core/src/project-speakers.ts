import {
  compare,
  fromTime,
  toTime,
  floor,
  ceil,
  sourceAvailability,
  type ExactRange,
  type SelectionRange,
  type SourceWindowOccurrence,
} from "@yap/composition";
import type {
  SpeakerEvidenceMetadata,
  SpeakerEvidenceStore,
  SpeakerObservation,
} from "./speaker-evidence.js";
import type { SpeakerProcessing } from "./speaker-processing.js";
import { sourceSelectionKey } from "./source-selection.js";
import { mergeHeads, type EvidenceKey } from "./evidence-merge.js";
import type { EvidenceManifest, EvidencePagePlan, EvidenceCheckpoint } from "./project-evidence.js";

export type ProjectSpeakerDependency = ReturnType<SpeakerProcessing["resolveMany"]>[number];
export type ProjectSpeakerRow = SpeakerObservation & {
  clipId: string;
  assetId: string;
  streamId: string;
  acquisitionId?: string;
  trackId: string;
  trackRank: number;
  generation: string;
  channel: number;
  fragments: { source: SelectionRange; project: SelectionRange }[];
  partial: boolean;
};
export type SpeakerProjectPlan = Pick<EvidencePagePlan, "query" | "projection" | "occurrence">;
type Candidate = { key: EvidenceKey; row: ProjectSpeakerRow };
export type ProjectSpeakerPosition = {
  afterSequence: number;
  done: boolean;
  head: Candidate | null;
};
export const initialProjectSpeakers = (): ProjectSpeakerPosition => ({
  afterSequence: -1,
  done: false,
  head: null,
});
const range = (value: ExactRange): SelectionRange => ({
  startUs: toTime(value.start),
  endUs: toTime(value.end),
});

/** Observation coverage and absent acoustic evidence remain separate from physical support holes. */
export function projectSpeakerCoverage(
  clip: SourceWindowOccurrence,
  evidence: readonly SpeakerEvidenceMetadata[],
  projection: EvidencePagePlan["projection"],
) {
  const observed = evidence
    .flatMap(
      (metadata) =>
        projection
          .clip(clip.clipId, metadata.source.observationRange)
          ?.fragments.flatMap((fragment) => {
            return sourceAvailability([range(fragment.project)], [range(clip.project)]).map(
              (value) => ({ start: fromTime(value.startUs), end: fromTime(value.endUs) }),
            );
          }) ?? [],
    )
    .sort((a, b) => compare(a.start, b.start));
  const merged: ExactRange[] = [];
  for (const value of observed) {
    const last = merged.at(-1);
    if (last && compare(value.start, last.end) <= 0) {
      if (compare(value.end, last.end) > 0)
        merged[merged.length - 1] = { start: last.start, end: value.end };
    } else merged.push({ ...value });
  }
  const unobserved: ExactRange[] = [];
  for (const fragment of clip.fragments) {
    let through = fragment.project.start;
    for (const observation of merged) {
      const selected = sourceAvailability([range(fragment.project)], [range(observation)])[0];
      if (!selected) continue;
      const start = fromTime(selected.startUs),
        end = fromTime(selected.endUs);
      if (compare(through, start) < 0) unobserved.push({ start: through, end: start });
      if (compare(end, through) > 0) through = end;
    }
    if (compare(through, fragment.project.end) < 0)
      unobserved.push({ start: through, end: fragment.project.end });
  }
  return { observed: merged.map(range), unobserved: unobserved.map(range) };
}

/** The same independent merge streams serve managed and immutable portable reads. */
export function projectSpeakerTracks(
  occurrences: readonly SourceWindowOccurrence[],
  dependencies: EvidenceManifest["dependencies"],
  plan: Pick<SpeakerProjectPlan, "query" | "projection">,
): EvidenceManifest["tracks"] {
  const bySource = new Map(dependencies.map((d) => [sourceSelectionKey(d.selection), d.speaker!]));
  return occurrences
    .flatMap((clip) => {
      const lowerBound = toTime(
        plan.projection.inverse(clip.clipId, { startUs: 0, endUs: plan.query.range.endUs })!.project
          .start,
      );
      return bySource
        .get(sourceSelectionKey(clip))!
        .evidence.flatMap((metadata) =>
          plan.projection
            .clip(clip.clipId, metadata.source.observationRange)
            ?.fragments.some(
              (fragment) =>
                compare(fragment.project.end, fromTime(plan.query.range.startUs)) > 0 &&
                compare(fragment.project.start, fromTime(plan.query.range.endUs)) < 0,
            )
            ? [{ clipIds: [clip.clipId], lowerBound, speakerGeneration: metadata.generation }]
            : [],
        );
    })
    .sort((a, b) => compare(fromTime(a.lowerBound), fromTime(b.lowerBound)));
}

/** Each clip×generation is an independent merge stream; overlapping observations never unify anonymous slots. */
export function mergeSpeakers(
  manifest: EvidenceManifest,
  plan: SpeakerProjectPlan,
  state: EvidenceCheckpoint<ProjectSpeakerPosition>,
  limit: number,
  records: Pick<SpeakerEvidenceStore, "intervalPage">,
) {
  const dependencies = new Map(
    manifest.dependencies.map((d) => [sourceSelectionKey(d.selection), d.speaker!]),
  );
  let budget = 128;
  const fill = (index: number): boolean => {
    const position = state.tracks[index]!;
    const track = manifest.tracks[index]!;
    const clip = plan.occurrence(track.clipIds[0]!);
    const metadata = dependencies
      .get(sourceSelectionKey(clip))!
      .evidence.find((v) => v.generation === track.speakerGeneration)!;
    if (!clip.fragments.length) position.done = true;
    while (!position.done) {
      if (budget-- <= 0) return false;
      const page = records.intervalPage({
        identity: metadata,
        afterSequence: position.afterSequence,
        limit: 1,
        range: {
          startUs: floor(clip.fragments[0]!.source.start),
          endUs: ceil(clip.fragments.at(-1)!.source.end),
        },
      });
      position.done = page.nextSequence === null;
      position.afterSequence = page.nextSequence ?? position.afterSequence;
      const row = page.intervals[0];
      if (!row) continue;
      const projected = plan.projection.clip(clip.clipId, row.sourceRange);
      if (
        !projected?.fragments.some(
          ({ project }) =>
            compare(project.end, fromTime(plan.query.range.startUs)) > 0 &&
            compare(project.start, fromTime(plan.query.range.endUs)) < 0,
        )
      )
        continue;
      const projectedRow: ProjectSpeakerRow = {
        ...row,
        clipId: clip.clipId,
        assetId: clip.assetId,
        streamId: clip.streamId,
        ...(clip.acquisitionId === undefined ? {} : { acquisitionId: clip.acquisitionId }),
        trackId: clip.trackId,
        trackRank: clip.trackRank,
        generation: metadata.generation,
        channel: metadata.source.channel,
        fragments: projected.fragments.map((fragment) => ({
          source: range(fragment.source),
          project: range(fragment.project),
        })),
        partial: projected.completeness === "partial",
      };
      position.head = {
        row: projectedRow,
        key: {
          projectStartUs: projectedRow.fragments[0]!.project.startUs,
          trackRank: clip.trackRank,
          clipId: clip.clipId,
          // Cropping can collapse distinct starts; chronological sequence stays monotone.
          sourceOrdinal: page.nextSequence ?? metadata.intervalCount - 1,
          eventKind: `speaker:${metadata.generation}`,
        },
      };
      return true;
    }
    position.head = null;
    return true;
  };
  const rows: ProjectSpeakerRow[] = [];
  mergeHeads(
    state,
    manifest.tracks,
    limit,
    fill,
    (index) => state.tracks[index]!.head?.key,
    (index) => {
      rows.push(state.tracks[index]!.head!.row);
      state.tracks[index]!.head = null;
    },
  );
  return rows;
}
