import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { planFrameTrail, trailPolicy, type FrameOverlay } from "./trails.js";
import { scenePolicy, type VisualSampler } from "./scenes.js";
import type { SourceEvidenceMetadata, SourceEvidenceStore } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import { CatalogError, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { editedToSource, sourceToEdited, type TimeRange } from "./timeline.js";

export type FrameCrop = { x: number; y: number; width: number; height: number };
export type FrameInput = {
  recordingId: string;
  revisionId?: string | undefined;
  atUs: number;
  clean?: boolean | undefined;
  trailUs?: number | undefined;
  crop?: FrameCrop | undefined;
  maxLongEdge?: number | undefined;
};
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
export type FrameArtifact = NativeFrame & {
  cacheId: string;
  recordingId: string;
  sourceId: string;
  revisionId: string;
  requestedPlaybackUs: number;
  actualPlaybackUs: number;
  kept: TimeRange;
  clean: boolean;
  annotation: ReturnType<typeof summarizeAnnotation> | null;
  sourceEvidence: ReturnType<typeof summarizeSource> | null;
};
type FrameOptions = {
  policy: string;
  atUs: number;
  maxLongEdge: number;
  crop: FrameCrop | null;
  clean: boolean;
  trailUs: number;
  trailPolicy: string | null;
  scenePolicy: string | null;
  sourceEvidence: SourceEvidenceMetadata | null;
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
const artifact = "frame";
const policy = "frame-v2";

/** Pins edits once; the native decoder only sees the resulting retained source interval. */
export class FrameInspection {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly home: string,
    private readonly decode: FrameDecoder,
    private readonly annotations: {
      processing: SourceProcessing;
      evidence: SourceEvidenceStore;
      sample: VisualSampler;
    },
  ) {}

  private prepare(
    input: FrameInput,
    revision = this.store.revision(input.recordingId, input.revisionId),
  ) {
    const mapped = editedToSource(revision, input.atUs);
    if (!mapped) throw new CatalogError("INVALID_RANGE", "Frame time is outside this revision");
    const maxLongEdge = input.maxLongEdge ?? 1600;
    if (
      (input.clean !== undefined && typeof input.clean !== "boolean") ||
      (input.trailUs !== undefined &&
        (!Number.isSafeInteger(input.trailUs) ||
          input.trailUs < 0 ||
          input.trailUs > trailPolicy.maximumUs)) ||
      !Number.isSafeInteger(maxLongEdge) ||
      maxLongEdge < 1 ||
      maxLongEdge > 8192
    )
      throw new CatalogError("INVALID_RANGE", "Invalid frame options");
    const crop = input.crop;
    if (
      crop &&
      (![crop.x, crop.y, crop.width, crop.height].every(Number.isSafeInteger) ||
        crop.x < 0 ||
        crop.y < 0 ||
        crop.width < 1 ||
        crop.height < 1)
    )
      throw new CatalogError("INVALID_RANGE", "Invalid crop rectangle");
    const clean = input.clean === true;
    const options: FrameOptions = {
      policy,
      atUs: input.atUs,
      maxLongEdge,
      crop: crop ? { x: crop.x, y: crop.y, width: crop.width, height: crop.height } : null,
      clean,
      trailUs: clean ? 0 : (input.trailUs ?? trailPolicy.defaultUs),
      trailPolicy: clean ? null : trailPolicy.id,
      scenePolicy: clean ? null : scenePolicy.id,
      sourceEvidence: null,
    };
    return { recordingId: input.recordingId, revisionId: revision.id, options };
  }

  request(input: FrameInput) {
    return this.admit(this.prepare(input));
  }

  batch(input: Omit<FrameInput, "atUs"> & { atUs: number[] }) {
    if (input.atUs.length < 1 || input.atUs.length > 8)
      throw new CatalogError("INVALID_RANGE", "A frame batch requires one to eight timestamps");
    const revision = this.store.revision(input.recordingId, input.revisionId);
    const plans = input.atUs.map((atUs) => this.prepare({ ...input, atUs }, revision));
    return {
      recordingId: input.recordingId,
      revisionId: revision.id,
      items: plans.map((plan, index) => {
        const atUs = input.atUs[index]!;
        try {
          return { atUs, ok: true as const, data: this.admit(plan) };
        } catch (error) {
          const failure =
            error instanceof CatalogError
              ? error
              : new CatalogError(
                  "INTERNAL_ERROR",
                  error instanceof Error ? error.message : "Frame admission failed",
                );
          return {
            atUs,
            ok: false as const,
            error: {
              code: failure.code,
              message: failure.message,
              retryable: failure.retryable,
              details: failure.details,
            },
          };
        }
      }),
    };
  }

  private admit(plan: ReturnType<FrameInspection["prepare"]>) {
    const options = { ...plan.options };
    if (!options.clean) {
      this.annotations.processing.prepare(plan.recordingId);
      const source = this.annotations.processing.status(plan.recordingId);
      if (source.state !== "ready" || !source.published)
        return {
          recordingId: plan.recordingId,
          sourceId: source.sourceId,
          revisionId: plan.revisionId,
          state: source.state,
          reason: source.reason,
          retryable: source.retryable,
          jobId: null,
          published: null,
          dependency: { artifact: "source" as const, jobId: source.jobId },
        };
      options.sourceEvidence = source.published.evidence;
    }
    const identity = {
      recordingId: plan.recordingId,
      revisionId: plan.revisionId,
      artifact,
      input: JSON.stringify(options),
    };
    this.jobs.submit({ ...identity, lane: "frame" });
    let status = this.jobs.status(identity);
    if (status.published) {
      const frame = JSON.parse(status.published.result) as FrameArtifact;
      const read = this.cache.acquire(frame.cacheId);
      if (read) read.release();
      else {
        this.jobs.regenerate(status.jobId!, status.published.generation);
        status = this.jobs.status(identity);
      }
    }
    return {
      recordingId: identity.recordingId,
      sourceId: this.store.get(identity.recordingId).sourceId,
      revisionId: identity.revisionId,
      ...status,
      dependency: null,
      published: status.published
        ? {
            generation: status.published.generation,
            frame: JSON.parse(status.published.result) as FrameArtifact,
          }
        : null,
    };
  }

  retry(input: FrameInput) {
    const status = this.request(input);
    if (status.jobId) this.jobs.retry(status.jobId);
    return this.request({ ...input, revisionId: status.revisionId });
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    const options = JSON.parse(job.input) as FrameOptions;
    if (
      job.artifact !== artifact ||
      options.policy !== policy ||
      (!options.clean &&
        (!options.sourceEvidence ||
          options.trailPolicy !== trailPolicy.id ||
          options.scenePolicy !== scenePolicy.id))
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Frame inspector cannot execute this job");
    const revision = this.store.revision(job.recordingId, job.revisionId);
    const mapped = editedToSource(revision, options.atUs);
    if (!mapped)
      throw new CatalogError("INVALID_RANGE", "Frame time is outside the pinned revision");
    signal.throwIfAborted();
    const output = this.cache.reserve();
    try {
      const source = join(this.home, "recordings", job.recordingId, "source", "video.mov");
      const annotation = options.clean
        ? null
        : await planFrameTrail(
            {
              source,
              kept: mapped.span.source,
              requestedSourceUs: mapped.sourceUs,
              trailUs: options.trailUs,
            },
            {
              evidence: this.annotations.evidence,
              identity: options.sourceEvidence!,
              sample: this.annotations.sample,
            },
            signal,
          );
      const frame = await this.decode(
        {
          source,
          output: output.path,
          atSourceUs: mapped.sourceUs,
          kept: mapped.span.source,
          maxLongEdge: options.maxLongEdge,
          ...(options.crop ? { crop: options.crop } : {}),
          ...(annotation ? { overlay: annotation.overlay } : {}),
        },
        signal,
      );
      signal.throwIfAborted();
      if (
        !Number.isSafeInteger(frame.actualSourceUs) ||
        frame.actualSourceUs < mapped.span.source.startUs ||
        frame.actualSourceUs >= mapped.span.source.endUs
      )
        throw new CatalogError(
          "INVALID_RESPONSE",
          "Decoder returned a frame outside the retained interval",
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
      if (actualPlaybackUs === null || frame.file !== output.path)
        throw new CatalogError("INVALID_RESPONSE", "Decoder returned an unrelated frame");
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      const result: FrameArtifact = {
        ...frame,
        bytes: cached.bytes,
        cacheId: cached.id,
        recordingId: job.recordingId,
        sourceId: this.store.get(job.recordingId).sourceId,
        revisionId: revision.id,
        requestedPlaybackUs: options.atUs,
        actualPlaybackUs,
        kept: mapped.span.source,
        clean: options.clean,
        annotation: annotation ? summarizeAnnotation(annotation) : null,
        sourceEvidence: options.sourceEvidence ? summarizeSource(options.sourceEvidence) : null,
      };
      return JSON.stringify(result);
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  }
}
