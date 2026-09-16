import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "./library.js";
import { planFrameTrail, type FrameOverlay } from "./trails.js";
import type { VisualSampler } from "./scenes.js";
import type { SourceEvidenceMetadata, SourceEvidenceStore } from "./evidence.js";
import {
  editedToSource,
  sourceToEdited,
  type TimeRange,
  type TimelineRevision,
} from "./timeline.js";

export const framePolicy = "frame-v3";

export type FrameCrop = { x: number; y: number; width: number; height: number };
export type NativeFrame = {
  file: string;
  mediaType: string;
  requestedSourceUs: number;
  actualSourceUs: number;
  distanceUs: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  crop?: FrameCrop | null;
  bytes: number;
  overlay?: {
    trailPoints: number;
    trailStartUs?: number | null;
    trailEndUs?: number | null;
    pointerSourceUs?: number | null;
  } | null;
};
export type FrameDecoder = (
  request: {
    source: string;
    output: string;
    atSourceUs: number;
    kept: TimeRange;
    crop?: FrameCrop | undefined;
    maxLongEdge: number;
    overlay?: FrameOverlay;
  },
  signal: AbortSignal,
) => Promise<NativeFrame>;
export type MaterializedFrame = NativeFrame & {
  recordingId: string;
  sourceId: string;
  revisionId: string;
  requestedPlaybackUs: number;
  actualPlaybackUs: number;
  kept: TimeRange;
  clean: boolean;
  annotation: ReturnType<typeof summarizeAnnotation> | null;
  sourceEvidence: ReturnType<typeof summarizeSource> | null;
  selectionEndUs?: number;
};
export type FrameRenderOptions = {
  atUs: number;
  maxLongEdge: number;
  crop: FrameCrop | null;
  clean: boolean;
  trailUs: number;
  sourceEvidence: SourceEvidenceMetadata | null;
};
export type FrameMaterializationInput = FrameRenderOptions & {
  recordingId: string;
  sourceId: string;
  revision: TimelineRevision;
  source: string;
  output: string;
  /** Before-event images exclude samples at or after this source-time ceiling. */
  selectionEndUs?: number;
};

function summarizeSource(source: SourceEvidenceMetadata) {
  const receipt = source.receipt;
  return {
    recordingId: source.recordingId,
    sourceId: source.sourceId,
    generation: source.generation,
    integrity: {
      finished: receipt.finished,
      incompleteTail: receipt.incompleteTail,
      invalidAtSequence: receipt.invalidAtSequence ?? null,
      lastSequence: receipt.lastSequence,
      openPauseHostUs: receipt.openPauseHostUs ?? null,
    },
  };
}
function summarizeAnnotation(plan: Awaited<ReturnType<typeof planFrameTrail>>) {
  const summarizeScene = (scene: typeof plan.scene) => ({
    policy: scene.policy,
    range: scene.range,
    coverage: scene.coverage,
    comparisons: scene.comparisons,
    boundaries: scene.boundaries,
    futureComparison: scene.futureComparison,
    referenceSourceUs: scene.reference.actualSourceUs,
  });
  const pointer = plan.pointerObservation;
  return {
    policy: plan.policy,
    trailUs: plan.overlay.trailUs,
    agedFromUs: plan.agedFromUs,
    requestedSourceUs: plan.requestedSourceUs,
    actualSourceUs: plan.actualSourceUs,
    evidenceRange: plan.evidenceRange,
    interval: plan.interval,
    cutoffs: plan.cutoffs,
    pointerObservation: pointer
      ? {
          sourceUs: pointer.sourceUs,
          x: pointer.x ?? null,
          y: pointer.y ?? null,
          eligibility: pointer.eligibility,
          geometryEpoch: pointer.geometryEpoch,
          sequence: pointer.sequence,
        }
      : null,
    trailPoints: plan.overlay.trail.reduce((count, run) => count + run.length, 0),
    trailRuns: plan.overlay.trail.length,
    pointer: plan.overlay.pointer,
    geometry: {
      requestedEpoch: plan.geometry.requested.epoch,
      selectedEpoch: plan.geometry.selected.epoch,
    },
    scene: summarizeScene(plan.scene),
    stalePointerScene: plan.stalePointerScene ? summarizeScene(plan.stalePointerScene) : null,
    stalePointerComparison: plan.stalePointerComparison,
  };
}
/** Renders to the caller's destination; that caller owns publication and failure cleanup. */
export async function materializeFrame(
  input: FrameMaterializationInput,
  dependencies: { decode: FrameDecoder; evidence: SourceEvidenceStore; sample: VisualSampler },
  signal: AbortSignal,
): Promise<MaterializedFrame> {
  const { revision, source, output } = input;
  const mapped = editedToSource(revision, input.atUs);
  if (!mapped) throw new CatalogError("INVALID_RANGE", "Frame time is outside the pinned revision");
  const selectionEndUs = input.selectionEndUs ?? mapped.span.source.endUs;
  if (
    !Number.isSafeInteger(selectionEndUs) ||
    selectionEndUs <= mapped.sourceUs ||
    selectionEndUs > mapped.span.source.endUs
  )
    throw new CatalogError(
      "INVALID_RANGE",
      "Frame selection ceiling must contain the request within its retained span",
    );
  const selection = { ...mapped.span.source, endUs: selectionEndUs };
  if (!input.clean && !input.sourceEvidence)
    throw new CatalogError("UNAVAILABLE", "Annotated frames require pinned source evidence");
  signal.throwIfAborted();
  const annotation = input.clean
    ? null
    : await planFrameTrail(
        {
          source,
          kept: selection,
          requestedSourceUs: mapped.sourceUs,
          trailUs: input.trailUs,
        },
        {
          evidence: dependencies.evidence,
          identity: input.sourceEvidence!,
          sample: dependencies.sample,
        },
        signal,
      );
  const frame = await dependencies.decode(
    {
      source,
      output,
      atSourceUs: mapped.sourceUs,
      kept: selection,
      maxLongEdge: input.maxLongEdge,
      ...(input.crop ? { crop: input.crop } : {}),
      ...(annotation ? { overlay: annotation.overlay } : {}),
    },
    signal,
  );
  signal.throwIfAborted();
  if (
    !Number.isSafeInteger(frame.actualSourceUs) ||
    frame.actualSourceUs < mapped.span.source.startUs ||
    frame.actualSourceUs >= selection.endUs
  )
    throw new CatalogError(
      "INVALID_RESPONSE",
      "Decoder returned a frame outside the allowed selection interval",
    );
  if (annotation) {
    const runs = annotation.overlay.trail;
    const receipt: NonNullable<NativeFrame["overlay"]> = {
      trailPoints: runs.reduce((count, run) => count + run.length, 0),
      trailStartUs: runs[0]?.[0]?.atSourceUs ?? null,
      trailEndUs: runs.at(-1)?.at(-1)?.atSourceUs ?? null,
      pointerSourceUs: annotation.overlay.pointer?.atSourceUs ?? null,
    };
    if (
      frame.actualSourceUs !== annotation.actualSourceUs ||
      frame.requestedSourceUs !== mapped.sourceUs ||
      frame.sourceWidth !== annotation.scene.sourceWidth ||
      frame.sourceHeight !== annotation.scene.sourceHeight ||
      !isDeepStrictEqual(
        frame.overlay && {
          trailPoints: frame.overlay.trailPoints,
          trailStartUs: frame.overlay.trailStartUs ?? null,
          trailEndUs: frame.overlay.trailEndUs ?? null,
          pointerSourceUs: frame.overlay.pointerSourceUs ?? null,
        },
        receipt,
      )
    )
      throw new CatalogError(
        "INVALID_RESPONSE",
        "Decoded image or overlay does not match its evidence plan",
      );
  } else if (frame.overlay != null) {
    throw new CatalogError(
      "INVALID_RESPONSE",
      "Clean frame unexpectedly contains a cursor overlay",
    );
  }
  const actualPlaybackUs = sourceToEdited(revision, frame.actualSourceUs);
  if (actualPlaybackUs === null || frame.file !== output)
    throw new CatalogError("INVALID_RESPONSE", "Decoder returned an unrelated frame");
  return {
    ...frame,
    recordingId: input.recordingId,
    sourceId: input.sourceId,
    revisionId: revision.id,
    requestedPlaybackUs: input.atUs,
    actualPlaybackUs,
    kept: mapped.span.source,
    ...(input.selectionEndUs === undefined ? {} : { selectionEndUs }),
    clean: input.clean,
    annotation: annotation ? summarizeAnnotation(annotation) : null,
    sourceEvidence: input.sourceEvidence ? summarizeSource(input.sourceEvidence) : null,
  };
}
