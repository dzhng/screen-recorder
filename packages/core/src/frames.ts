import { join } from "node:path";
import { trailPolicy } from "./trails.js";
import { scenePolicy, type VisualSampler } from "./scenes.js";
import type { SourceEvidenceStore } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import { CatalogError, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { editedToSource } from "./timeline.js";
import {
  materializeFrame,
  framePolicy as policy,
  type FrameCrop,
  type FrameDecoder,
  type FrameRenderOptions,
  type MaterializedFrame,
} from "./frame-materialization.js";

export type FrameInput = {
  recordingId: string;
  revisionId?: string | undefined;
  atUs: number;
  clean?: boolean | undefined;
  trailUs?: number | undefined;
  crop?: FrameCrop | undefined;
  maxLongEdge?: number | undefined;
};
export type FrameArtifact = MaterializedFrame & { cacheId: string };
type FrameOptions = FrameRenderOptions & {
  policy: string;
  trailPolicy: string | null;
  scenePolicy: string | null;
};
const artifact = "frame";

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
    signal.throwIfAborted();
    const output = this.cache.reserve(job.recordingId);
    try {
      const frame = await materializeFrame(
        {
          ...options,
          recordingId: job.recordingId,
          sourceId: this.store.get(job.recordingId).sourceId,
          revision,
          source: join(this.home, "recordings", job.recordingId, "source", "video.mov"),
          output: output.path,
        },
        {
          decode: this.decode,
          evidence: this.annotations.evidence,
          sample: this.annotations.sample,
        },
        signal,
      );
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      const result: FrameArtifact = { ...frame, bytes: cached.bytes, cacheId: cached.id };
      return JSON.stringify(result);
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  }
}
