import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  compiledFrameSchema,
  processingTapSchema,
  type ProcessingTap,
} from "@screenrec/composition";
import type { ProjectStore } from "./projects.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { selectSource, sourceSelectionSchema, type SourceSelection } from "./source-selection.js";
import type { AssetStore } from "./assets.js";
import type { JobQueue, JobExecution, JobOwner } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { CatalogError } from "./catalog.js";
import { submitCachedDerivative } from "./cached-derivative.js";
import {
  projectWindow,
  type CompositionWindow,
  type CompositionAssetBinding,
} from "./project-window.js";

const time = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const selectedPicture = {
  clipId: z.string().min(1),
  assetId: z.string().min(1),
  streamId: z.string().min(1),
  requestedSourceUs: time,
};
const projectReceiptSchema = z.object({
  file: z.string(),
  mediaType: z.literal("image/png"),
  profile: z.literal("h264-rec709"),
  frame: compiledFrameSchema,
  width: z.int().positive(),
  height: z.int().positive(),
  sourceWidth: z.int().positive(),
  sourceHeight: z.int().positive(),
  decodedSamples: time,
  readerOpens: time,
  bytes: z
    .int()
    .positive()
    .max(32 * 1024 * 1024),
  picture: z.discriminatedUnion("status", [
    z.object({ status: z.literal("background") }),
    z.object({ status: z.literal("unavailable"), ...selectedPicture, reason: z.string().min(1) }),
    z.object({
      status: z.literal("available"),
      ...selectedPicture,
      actualSourceUs: z.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
      sample: z.object({
        value: z.string().regex(/^-?\d+$/),
        timescale: z.int().positive(),
        originUs: z.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
      }),
    }),
  ]),
});
const optionsSchema = z.strictObject({
  atUs: time,
  maxLongEdge: z.int().min(1).max(8192),
  tap: processingTapSchema,
  implementationId: z.string().min(1),
});
export type ProjectFrameInput = {
  projectId: string;
  revisionId?: string | undefined;
  atUs: number;
  maxLongEdge?: number | undefined;
  tap?: ProcessingTap | undefined;
};
export type ProjectFrameRenderer = {
  implementationId: string;
  render(
    request: {
      window: CompositionWindow;
      assets: readonly CompositionAssetBinding[];
      output: string;
      maxLongEdge: number;
    },
    signal: AbortSignal,
  ): Promise<unknown>;
};
export type ProjectFrameArtifact = z.infer<typeof projectReceiptSchema> &
  z.infer<typeof optionsSchema> & {
    projectId: string;
    revisionId: string;
    cacheId: string;
  };

const sourceOptionsSchema = z.strictObject({
  selection: sourceSelectionSchema,
  atUs: time,
  maxLongEdge: z.int().min(1).max(8192),
  supportDigest: z.string().regex(/^[a-f0-9]{64}$/),
  implementationId: z.string().min(1),
});
const sourceReceiptSchema = projectReceiptSchema
  .omit({ profile: true, frame: true, picture: true })
  .extend({
    assetId: z.string().min(1),
    streamId: z.string().min(1),
    requestedSourceUs: time,
    actualSourceUs: z.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
    sample: z.object({
      value: z
        .string()
        .max(21)
        .regex(/^-?\d+$/),
      timescale: z.int().positive(),
      endValue: z
        .string()
        .max(21)
        .regex(/^-?\d+$/),
      endTimescale: z.int().positive(),
      originUs: z.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
    }),
  });
export type SourceFrameInput = SourceSelection & { atUs: number; maxLongEdge?: number | undefined };
export type MediaFrameInput = SourceFrameInput | ProjectFrameInput;
export type SourceFrameRenderer = {
  implementationId: string;
  render(
    request: {
      asset: CompositionAssetBinding;
      available: { startUs: number; endUs: number }[];
      atUs: number;
      maxLongEdge: number;
      output: string;
    },
    signal: AbortSignal,
  ): Promise<unknown>;
};
export type SourceFrameArtifact = z.infer<typeof sourceReceiptSchema> &
  SourceSelection & {
    atUs: number;
    maxLongEdge: number;
    supportDigest: string;
    implementationId: string;
    cacheId: string;
  };

/** A demanded picture uses the movie's global schedule and shared derivative lifetime. */
export class MediaFrameInspection {
  constructor(
    private readonly owners: {
      assets: AssetStore;
      acquisitions: AcquisitionStore;
      jobs: JobQueue;
      cache: DerivedCache;
      sourceRenderer: SourceFrameRenderer;
      project?: { projects: ProjectStore; renderer: ProjectFrameRenderer };
    },
  ) {
    if (
      !owners.sourceRenderer.implementationId ||
      (owners.project && !owners.project.renderer.implementationId)
    )
      throw new Error("Picture renderer needs an implementation identity");
  }
  private get project() {
    if (!this.owners.project)
      throw new CatalogError("UNSUPPORTED_JOB", "Project pictures are unavailable");
    return this.owners.project;
  }

  private planSource(input: SourceFrameInput) {
    const source = selectSource(this.owners.assets, this.owners.acquisitions, {
      assetId: input.assetId,
      streamId: input.streamId,
      ...(input.acquisitionId === undefined ? {} : { acquisitionId: input.acquisitionId }),
    });
    if (source.stream.kind !== "video")
      throw new CatalogError("UNSUPPORTED_MEDIA", "Source pictures require timed video");
    const parsed = sourceOptionsSchema.safeParse({
      selection: source.selection,
      atUs: input.atUs,
      maxLongEdge: input.maxLongEdge ?? 1600,
      supportDigest: source.supportDigest,
      implementationId: this.owners.sourceRenderer.implementationId,
    });
    if (!parsed.success || input.atUs >= source.durationUs)
      throw new CatalogError("INVALID_RANGE", "Picture time must lie within the source duration");
    const contains = (range: { startUs: number; endUs: number }) =>
      range.startUs <= input.atUs && input.atUs < range.endUs;
    const reason = !(source.stream.available ?? [source.stream.bounds]).some(contains)
      ? "physical_gap"
      : !source.track.available.some(contains)
        ? "acquisition_excluded"
        : null;
    const asset: CompositionAssetBinding = {
      assetId: source.selection.assetId,
      streamId: source.selection.streamId,
      path: source.track.source,
      originUs: -source.track.sourceOffsetUs,
    };
    return { source, options: parsed.data, asset, reason };
  }
  private requestSource(input: SourceFrameInput) {
    const { options, reason } = this.planSource(input);
    const { assets, acquisitions, jobs, cache } = this.owners;
    const status = reason
      ? {
          state: "unavailable" as const,
          reason,
          retryable: false,
          jobId: null,
          published: null,
        }
      : submitCachedDerivative<SourceFrameArtifact>(
          jobs,
          cache,
          {
            target: { kind: "asset", assetId: options.selection.assetId },
            artifact: "frame",
            input: JSON.stringify(options),
          },
          "frame",
          (job) => {
            const owner = { kind: "job" as const, id: job.jobId };
            assets.retain(owner, [options.selection.assetId]);
            if (options.selection.acquisitionId)
              acquisitions.retain(owner, [options.selection.acquisitionId]);
          },
        );
    return {
      ...options.selection,
      atUs: options.atUs,
      maxLongEdge: options.maxLongEdge,
      supportDigest: options.supportDigest,
      implementationId: options.implementationId,
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      published: status.published
        ? { generation: status.published.generation, frame: status.published.value }
        : null,
    };
  }
  private async publish<T extends { file: string; bytes: number }>(
    owner: Extract<JobOwner, { kind: "asset" | "project" }>,
    signal: AbortSignal,
    render: (output: string) => Promise<T>,
  ) {
    signal.throwIfAborted();
    const output = this.owners.cache.reserve(owner);
    try {
      const value = await render(output.path);
      signal.throwIfAborted();
      if (value.file !== output.path)
        throw new CatalogError("INVALID_RESPONSE", "Picture receipt changed output path");
      const cached = await this.owners.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== value.bytes)
        throw new CatalogError(
          "INVALID_RESPONSE",
          "Published picture size differs from its receipt",
        );
      return JSON.stringify({ ...value, cacheId: output.id });
    } catch (error) {
      this.owners.cache.remove(output.id);
      throw error;
    }
  }
  private async executeSource({ job, signal }: JobExecution) {
    const parsed = sourceOptionsSchema.safeParse(JSON.parse(job.input));
    if (
      job.target.kind !== "asset" ||
      job.artifact !== "frame" ||
      !parsed.success ||
      parsed.data.selection.assetId !== job.target.assetId
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Picture job does not name a selected source");
    if (parsed.data.implementationId !== this.owners.sourceRenderer.implementationId)
      throw new CatalogError("NOT_READY", "Pinned picture renderer is unavailable", {}, true);
    const plan = this.planSource({ ...parsed.data.selection, ...parsed.data });
    if (plan.options.supportDigest !== parsed.data.supportDigest)
      throw new CatalogError("ARTIFACT_CHANGED", "Selected source support changed");
    if (plan.reason) throw new CatalogError("UNAVAILABLE", plan.reason);
    return this.publish({ kind: "asset", assetId: job.target.assetId }, signal, async (output) => {
      const parsedReceipt = sourceReceiptSchema.safeParse(
        await this.owners.sourceRenderer.render(
          {
            asset: plan.asset,
            available: plan.source.track.available,
            atUs: plan.options.atUs,
            maxLongEdge: plan.options.maxLongEdge,
            output,
          },
          signal,
        ),
      );
      if (!parsedReceipt.success)
        throw new CatalogError("INVALID_RESPONSE", "Malformed source picture receipt");
      const value = parsedReceipt.data,
        sample = value.sample;
      const start = BigInt(sample.value),
        end = BigInt(sample.endValue),
        scale = BigInt(sample.timescale),
        endScale = BigInt(sample.endTimescale);
      const at = BigInt(plan.options.atUs) + BigInt(plan.asset.originUs);
      const numerator = start * 1000000n,
        absolute = numerator < 0n ? -numerator : numerator;
      const rounded =
        (absolute / scale + ((absolute % scale) * 2n >= scale ? 1n : 0n)) *
        (numerator < 0n ? -1n : 1n);
      const metadata = this.owners.assets
        .get(plan.asset.assetId)
        .streams.find((stream) => stream.id === plan.asset.streamId)!;
      if (
        value.assetId !== plan.asset.assetId ||
        value.streamId !== plan.asset.streamId ||
        value.requestedSourceUs !== plan.options.atUs ||
        sample.originUs !== plan.asset.originUs ||
        rounded - BigInt(sample.originUs) !== BigInt(value.actualSourceUs) ||
        start * 1000000n > at * scale ||
        end * 1000000n <= at * endScale ||
        value.sourceWidth !== (metadata.orientedWidth ?? metadata.width) ||
        value.sourceHeight !== (metadata.orientedHeight ?? metadata.height) ||
        value.width > value.sourceWidth ||
        value.height > value.sourceHeight ||
        Math.max(value.width, value.height) > plan.options.maxLongEdge
      )
        throw new CatalogError(
          "INVALID_RESPONSE",
          "Source picture receipt changed its selection or physical clock",
        );
      return {
        ...value,
        ...plan.options.selection,
        atUs: plan.options.atUs,
        maxLongEdge: plan.options.maxLongEdge,
        supportDigest: plan.options.supportDigest,
        implementationId: plan.options.implementationId,
      };
    });
  }

  private planProject(input: ProjectFrameInput) {
    const options = optionsSchema.safeParse({
      atUs: input.atUs,
      maxLongEdge: input.maxLongEdge ?? 1600,
      tap: input.tap ?? { target: { kind: "output" }, point: { kind: "processed" } },
      implementationId: this.project.renderer.implementationId,
    });
    if (!options.success || input.atUs === Number.MAX_SAFE_INTEGER)
      throw new CatalogError("INVALID_PARAMS", "Invalid demanded picture options");
    const plan = projectWindow(
      this.project.projects,
      this.owners.assets,
      {
        projectId: input.projectId,
        revisionId: input.revisionId,
        range: { startUs: input.atUs, endUs: input.atUs + 1 },
        tap: options.data.tap,
      },
      this.project.renderer.implementationId,
      "video",
    );
    return { ...plan, options: options.data };
  }

  private requestProject(input: ProjectFrameInput) {
    const { window, options } = this.planProject(input);
    const revisionId = window.manifest.revisionId;
    const status = submitCachedDerivative<ProjectFrameArtifact>(
      this.owners.jobs,
      this.owners.cache,
      {
        target: { kind: "project", projectId: input.projectId, revisionId },
        artifact: "frame",
        input: JSON.stringify(options),
      },
      "frame",
    );
    return {
      projectId: input.projectId,
      revisionId,
      ...options,
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      published: status.published
        ? { generation: status.published.generation, frame: status.published.value }
        : null,
    };
  }

  request(input: SourceFrameInput): ReturnType<MediaFrameInspection["requestSource"]>;
  request(input: ProjectFrameInput): ReturnType<MediaFrameInspection["requestProject"]>;
  request(
    input: MediaFrameInput,
  ):
    | ReturnType<MediaFrameInspection["requestSource"]>
    | ReturnType<MediaFrameInspection["requestProject"]>;
  request(input: MediaFrameInput) {
    return "projectId" in input ? this.requestProject(input) : this.requestSource(input);
  }
  retry(input: SourceFrameInput): ReturnType<MediaFrameInspection["requestSource"]>;
  retry(input: ProjectFrameInput): ReturnType<MediaFrameInspection["requestProject"]>;
  retry(
    input: MediaFrameInput,
  ):
    | ReturnType<MediaFrameInspection["requestSource"]>
    | ReturnType<MediaFrameInspection["requestProject"]>;
  retry(input: MediaFrameInput) {
    const current = this.request(input);
    if (current.jobId) this.owners.jobs.retry(current.jobId);
    return this.request(
      "projectId" in current
        ? { ...input, projectId: current.projectId, revisionId: current.revisionId }
        : input,
    );
  }
  async execute(execution: JobExecution): Promise<string> {
    return execution.job.target.kind === "project"
      ? this.executeProject(execution)
      : this.executeSource(execution);
  }
  private async executeProject({ job, signal }: JobExecution): Promise<string> {
    const parsed = optionsSchema.safeParse(JSON.parse(job.input));
    if (job.target.kind !== "project" || job.artifact !== "frame" || !parsed.success)
      throw new CatalogError("UNSUPPORTED_JOB", "Picture job does not name a project frame");
    if (parsed.data.implementationId !== this.project.renderer.implementationId)
      throw new CatalogError("NOT_READY", "Pinned picture renderer is unavailable", {}, true);
    const plan = this.planProject({
      projectId: job.target.projectId,
      revisionId: job.target.revisionId,
      ...parsed.data,
    });
    const projectId = job.target.projectId;
    return this.publish({ kind: "project", projectId }, signal, async (output) => {
      const parsedReceipt = projectReceiptSchema.safeParse(
        await this.project.renderer.render(
          {
            window: plan.window,
            assets: plan.assets,
            output,
            maxLongEdge: plan.options.maxLongEdge,
          },
          signal,
        ),
      );
      signal.throwIfAborted();
      if (!parsedReceipt.success)
        throw new CatalogError("INVALID_RESPONSE", "Malformed picture receipt");
      const value = parsedReceipt.data;
      const expected = plan.window.frames().next().value!;
      const layer = expected.layers[0];
      const { picture } = value;
      if (
        value.file !== output ||
        !isDeepStrictEqual(value.frame, expected) ||
        value.sourceWidth !== plan.window.manifest.canvas.width ||
        value.sourceHeight !== plan.window.manifest.canvas.height ||
        value.width > value.sourceWidth ||
        value.height > value.sourceHeight ||
        Math.max(value.width, value.height) > plan.options.maxLongEdge ||
        (layer === undefined
          ? picture.status !== "background"
          : picture.status === "background" ||
            picture.clipId !== layer.clipId ||
            picture.assetId !== layer.assetId ||
            picture.streamId !== layer.streamId ||
            picture.requestedSourceUs !== layer.sourceUs ||
            (layer.availability !== "available" && picture.status === "available"))
      )
        throw new CatalogError("INVALID_RESPONSE", "Picture receipt differs from its pinned frame");
      if (
        picture.status === "available" &&
        picture.sample.originUs !==
          plan.assets.find(
            (asset) => asset.assetId === picture.assetId && asset.streamId === picture.streamId,
          )?.originUs
      )
        throw new CatalogError("INVALID_RESPONSE", "Picture receipt changed its source clock");
      return { ...value, ...plan.options, projectId, revisionId: plan.window.manifest.revisionId };
    });
  }
}
