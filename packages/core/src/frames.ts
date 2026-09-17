import { join } from "node:path";
import { trailPolicy } from "./trails.js";
import { scenePolicy, type VisualSampler } from "./scenes.js";
import type { SourceTrailRead, SourceEvidenceMetadata } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import { CatalogError, type RevisionStore } from "./library.js";
import type { ArtifactStatus, JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { editedToSource, type TimelineRevision } from "./timeline.js";
import {
  materializeFrame,
  framePolicy as policy,
  type FrameCrop,
  type FrameDecoder,
  type FrameRenderOptions,
  type MaterializedFrame,
} from "./frame-materialization.js";

export type FrameRequest = {
  revisionId?: string | undefined;
  atUs: number;
  clean?: boolean | undefined;
  trailUs?: number | undefined;
  crop?: FrameCrop | undefined;
  maxLongEdge?: number | undefined;
};
export type FrameInput = { recordingId: string } & FrameRequest;
export type FrameArtifact = MaterializedFrame & { cacheId: string };
export type FrameOptions = FrameRenderOptions & {
  policy: string;
  trailPolicy: string | null;
  scenePolicy: string | null;
};
const artifact = "frame";

export type FrameContext<Target> = {
  target: Target;
  recordingId: string;
  sourceId: string;
  revision: TimelineRevision;
};
export type FrameSourceState = {
  state: string;
  reason: string | null;
  retryable: boolean;
  jobId: string | null;
  evidence: SourceEvidenceMetadata | null;
};
export type FrameSubmission<Artifact extends MaterializedFrame> = Omit<
  ArtifactStatus,
  "published"
> & {
  published: { generation: number; frame: Artifact } | null;
};
export type FrameOutput<Artifact extends MaterializedFrame> = {
  file: string;
  publish(frame: MaterializedFrame): Promise<Artifact>;
  discard(cause: unknown): Promise<void>;
};
export type FrameRenderContext<Artifact extends MaterializedFrame> = {
  recordingId: string;
  sourceId: string;
  revision: TimelineRevision;
  source: string;
  output: FrameOutput<Artifact>;
};
export type FrameDependencies = {
  decode: FrameDecoder;
  evidence: SourceTrailRead;
  sample: VisualSampler;
};

function validateFramePolicy(options: FrameOptions): void {
  if (
    options.policy !== policy ||
    (!options.clean &&
      (!options.sourceEvidence ||
        options.trailPolicy !== trailPolicy.id ||
        options.scenePolicy !== scenePolicy.id))
  )
    throw new CatalogError("UNSUPPORTED_JOB", "Frame inspector cannot execute this job");
}

/** Output ownership stays with the backend; render policy and failure cleanup have one entry point. */
export async function renderFrame<Artifact extends MaterializedFrame>(
  options: FrameOptions,
  context: FrameRenderContext<Artifact>,
  dependencies: FrameDependencies,
  signal: AbortSignal,
): Promise<Artifact> {
  try {
    validateFramePolicy(options);
    signal.throwIfAborted();
    const frame = await materializeFrame(
      {
        ...options,
        recordingId: context.recordingId,
        sourceId: context.sourceId,
        revision: context.revision,
        source: context.source,
        output: context.output.file,
      },
      dependencies,
      signal,
    );
    const result = await context.output.publish(frame);
    signal.throwIfAborted();
    return result;
  } catch (error) {
    await context.output.discard(error);
    throw error;
  }
}

/** Pins edits once; backends supply target authority, dependencies, and job publication. */
export abstract class FrameInspection<Target extends object, Artifact extends MaterializedFrame> {
  protected abstract resolve(
    input: Target & { revisionId?: string | undefined },
  ): FrameContext<Target>;
  protected abstract source(context: FrameContext<Target>): FrameSourceState;
  protected abstract submit(
    context: FrameContext<Target>,
    options: FrameOptions,
  ): FrameSubmission<Artifact>;
  protected abstract retryJob(jobId: string): void;

  private prepare(input: Target & FrameRequest, context = this.resolve(input)) {
    const mapped = editedToSource(context.revision, input.atUs);
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
    return { context, options };
  }

  request(input: Target & FrameRequest) {
    return this.admit(this.prepare(input));
  }

  batch(input: Target & Omit<FrameRequest, "atUs"> & { atUs: number[] }) {
    if (input.atUs.length < 1 || input.atUs.length > 8)
      throw new CatalogError("INVALID_RANGE", "A frame batch requires one to eight timestamps");
    const context = this.resolve(input);
    const plans = input.atUs.map((atUs) => this.prepare({ ...input, atUs }, context));
    return {
      ...context.target,
      revisionId: context.revision.id,
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

  private admit(plan: { context: FrameContext<Target>; options: FrameOptions }) {
    const { context } = plan;
    const options = { ...plan.options };
    if (!options.clean) {
      const source = this.source(context);
      if (source.state !== "ready" || !source.evidence)
        return {
          ...context.target,
          sourceId: context.sourceId,
          revisionId: context.revision.id,
          state: source.state,
          reason: source.reason,
          retryable: source.retryable,
          jobId: null,
          published: null,
          dependency: { artifact: "source" as const, jobId: source.jobId },
        };
      options.sourceEvidence = source.evidence;
    }
    return {
      ...context.target,
      sourceId: context.sourceId,
      revisionId: context.revision.id,
      ...this.submit(context, options),
      dependency: null,
    };
  }

  retry(input: Target & FrameRequest) {
    const status = this.request(input);
    if (status.jobId) this.retryJob(status.jobId);
    return this.request({ ...input, revisionId: status.revisionId });
  }
}

export class LibraryFrameInspection extends FrameInspection<
  { recordingId: string },
  FrameArtifact
> {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly home: string,
    private readonly decode: FrameDecoder,
    private readonly annotations: {
      processing: SourceProcessing;
      evidence: SourceTrailRead;
      sample: VisualSampler;
    },
  ) {
    super();
  }

  protected resolve(input: { recordingId: string; revisionId?: string | undefined }) {
    return {
      target: { recordingId: input.recordingId },
      recordingId: input.recordingId,
      revision: this.store.revision(input.recordingId, input.revisionId),
      sourceId: this.store.get(input.recordingId).sourceId,
    };
  }
  protected source(context: FrameContext<{ recordingId: string }>): FrameSourceState {
    this.annotations.processing.prepare(context.recordingId);
    const status = this.annotations.processing.status(context.recordingId);
    return {
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      evidence: status.published?.evidence ?? null,
    };
  }
  protected retryJob(jobId: string) {
    this.jobs.retry(jobId);
  }
  protected submit(
    context: FrameContext<{ recordingId: string }>,
    options: FrameOptions,
  ): FrameSubmission<FrameArtifact> {
    const identity = {
      recordingId: context.recordingId,
      revisionId: context.revision.id,
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
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            frame: JSON.parse(status.published.result) as FrameArtifact,
          }
        : null,
    };
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    const options = JSON.parse(job.input) as FrameOptions;
    if (job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Frame inspector cannot execute this job");
    validateFramePolicy(options);
    const revision = this.store.revision(job.recordingId, job.revisionId);
    signal.throwIfAborted();
    const sourceId = this.store.get(job.recordingId).sourceId;
    const output = this.cache.reserve(job.recordingId);
    return JSON.stringify(
      await renderFrame(
        options,
        {
          recordingId: job.recordingId,
          sourceId,
          revision,
          source: join(this.home, "recordings", job.recordingId, "source", "video.mov"),
          output: {
            file: output.path,
            publish: async (frame) => {
              const cached = await this.cache.publish(output.id);
              return { ...frame, bytes: cached.bytes, cacheId: cached.id };
            },
            discard: async () => {
              this.cache.remove(output.id);
            },
          },
        },
        {
          decode: this.decode,
          evidence: this.annotations.evidence,
          sample: this.annotations.sample,
        },
        signal,
      ),
    );
  }
}
