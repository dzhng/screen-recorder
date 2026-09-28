import { compare, fromTime, toTime, floor, ceil, type TimeValue } from "@screenrec/composition";
import {
  initialCapture,
  CaptureSourceRead,
  type CapturePosition,
  type CaptureRow,
} from "./capture-source-read.js";
import { mergeHeads, type EvidenceKey } from "./evidence-merge.js";
import type { EvidenceManifest, EvidencePlan, EvidenceCheckpoint } from "./project-evidence.js";
import { sourceSelectionKey } from "./source-selection.js";
export type ProjectCaptureRow = CaptureRow & {
  clipId: string;
  assetId: string;
  streamId: string;
  acquisitionId?: string;
  trackId: string;
  trackRank: number;
  generation: string;
  projectAtUs: TimeValue;
};
export type ProjectCapturePosition = {
  clip: number;
  source: CapturePosition;
  head: { key: EvidenceKey; row: ProjectCaptureRow } | null;
};
export const initialProjectCapture = (): ProjectCapturePosition => ({
  clip: 0,
  source: initialCapture(),
  head: null,
});
export function mergeCapture(
  manifest: EvidenceManifest,
  plan: EvidencePlan,
  state: EvidenceCheckpoint<ProjectCapturePosition>,
  limit: number,
  reader: CaptureSourceRead,
) {
  const clips = new Map(plan.occurrences.map((clip) => [clip.clipId, clip]));
  const dependencies = new Map(
    manifest.dependencies.map((d) => [sourceSelectionKey(d.selection), d.capture!]),
  );
  const budget = { remaining: 128 };
  const fill = (index: number): boolean => {
    const position = state.tracks[index]!,
      ids = manifest.tracks[index]!.clipIds;
    while (position.clip < ids.length) {
      if (budget.remaining <= 0) return false;
      const clip = clips.get(ids[position.clip]!)!,
        context = dependencies.get(sourceSelectionKey(clip))!;
      const row = clip.fragments.length
        ? reader.next(
            context,
            {
              startUs: floor(clip.fragments[0]!.source.start),
              endUs: ceil(clip.fragments.at(-1)!.source.end),
            },
            position.source,
            budget,
          )
        : null;
      if (row === undefined) return false;
      if (row === null) {
        budget.remaining--;
        position.clip++;
        position.source = initialCapture();
        continue;
      }
      const mapped = plan.projection.point(clip.clipId, row.sourceAtUs);
      if (
        !mapped ||
        compare(mapped.project, fromTime(plan.query.range.startUs)) < 0 ||
        compare(mapped.project, fromTime(plan.query.range.endUs)) >= 0
      )
        continue;
      const projectAtUs = toTime(mapped.project);
      position.head = {
        key: {
          projectStartUs: projectAtUs,
          trackRank: clip.trackRank,
          clipId: clip.clipId,
          sourceOrdinal: row.sourceSequence,
          eventKind: row.kind,
        },
        row: {
          ...row,
          clipId: clip.clipId,
          assetId: clip.assetId,
          streamId: clip.streamId,
          ...(clip.acquisitionId === undefined ? {} : { acquisitionId: clip.acquisitionId }),
          trackId: clip.trackId,
          trackRank: clip.trackRank,
          generation: context.evidence!.generation,
          projectAtUs,
        },
      };
      return true;
    }
    position.head = null;
    return true;
  };
  const rows: ProjectCaptureRow[] = [];
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
