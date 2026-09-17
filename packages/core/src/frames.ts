import { join } from "node:path";
import { trailPolicy } from "./trails.js";
import { scenePolicy, type VisualSampler } from "./scenes.js";
import type { SourceTrailRead } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import { CatalogError, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import {
  DerivativeInspection,
  LibraryDerivatives,
  type DerivativeBackend,
  type DerivativeContext,
  type DerivativeSubmission,
} from "./derivative-inspection.js";
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

/** Pins edits once; backends supply target authority and job publication. */
export abstract class FrameInspection<
  Target extends object,
  Artifact extends MaterializedFrame,
> extends DerivativeInspection<Target, Target & FrameRequest, "frame", Artifact> {
  constructor(backend: DerivativeBackend<Target>) {
    super(backend, "frame");
  }
  protected abstract submit(
    context: DerivativeContext<Target>,
    options: FrameOptions,
  ): DerivativeSubmission<Artifact>;

  private prepare(input: Target & FrameRequest, context = this.backend.resolve(input)) {
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
    return this.admitFrame(this.prepare(input));
  }

  batch(input: Target & Omit<FrameRequest, "atUs"> & { atUs: number[] }) {
    if (input.atUs.length < 1 || input.atUs.length > 8)
      throw new CatalogError("INVALID_RANGE", "A frame batch requires one to eight timestamps");
    const context = this.backend.resolve(input);
    const plans = input.atUs.map((atUs) => this.prepare({ ...input, atUs }, context));
    return {
      ...context.target,
      revisionId: context.revision.id,
      items: plans.map((plan, index) => {
        const atUs = input.atUs[index]!;
        try {
          return { atUs, ok: true as const, data: this.admitFrame(plan) };
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

  private admitFrame({
    context,
    options,
  }: {
    context: DerivativeContext<Target>;
    options: FrameOptions;
  }) {
    if (options.clean) return this.status(context, this.submit(context, options));
    return this.admit(context, this.backend.source(context), (evidence) =>
      this.submit(context, { ...options, sourceEvidence: evidence }),
    );
  }
}

export class LibraryFrameInspection extends FrameInspection<
  { recordingId: string },
  FrameArtifact
> {
  private readonly library: LibraryDerivatives;
  constructor(
    private readonly store: RevisionStore,
    jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly home: string,
    private readonly decode: FrameDecoder,
    private readonly annotations: {
      processing: SourceProcessing;
      evidence: SourceTrailRead;
      sample: VisualSampler;
    },
  ) {
    const library = new LibraryDerivatives(store, jobs, cache, annotations.processing);
    super(library);
    this.library = library;
  }

  protected submit(context: DerivativeContext<{ recordingId: string }>, options: FrameOptions) {
    return this.library.submit<FrameArtifact>(
      {
        recordingId: context.recordingId,
        revisionId: context.revision.id,
        artifact,
        input: JSON.stringify(options),
      },
      "frame",
    );
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
