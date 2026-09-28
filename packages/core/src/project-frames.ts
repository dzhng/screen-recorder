import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  compiledFrameSchema,
  processingTapSchema,
  type ProcessingTap,
} from "@screenrec/composition";
import type { ProjectStore } from "./projects.js";
import type { AssetStore } from "./assets.js";
import type { JobQueue, JobExecution } from "./jobs.js";
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
const receiptSchema = z.object({
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
export type ProjectFrameArtifact = z.infer<typeof receiptSchema> &
  z.infer<typeof optionsSchema> & {
    projectId: string;
    revisionId: string;
    cacheId: string;
  };

/** A demanded picture uses the movie's global schedule and shared derivative lifetime. */
export class ProjectFrameInspection {
  constructor(
    private readonly projects: ProjectStore,
    private readonly assets: AssetStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly renderer: ProjectFrameRenderer,
  ) {
    if (!renderer.implementationId)
      throw new Error("Picture renderer needs an implementation identity");
  }

  private plan(input: ProjectFrameInput) {
    const options = optionsSchema.safeParse({
      atUs: input.atUs,
      maxLongEdge: input.maxLongEdge ?? 1600,
      tap: input.tap ?? { target: { kind: "output" }, point: { kind: "processed" } },
      implementationId: this.renderer.implementationId,
    });
    if (!options.success || input.atUs === Number.MAX_SAFE_INTEGER)
      throw new CatalogError("INVALID_PARAMS", "Invalid demanded picture options");
    const plan = projectWindow(
      this.projects,
      this.assets,
      {
        projectId: input.projectId,
        revisionId: input.revisionId,
        range: { startUs: input.atUs, endUs: input.atUs + 1 },
        tap: options.data.tap,
      },
      this.renderer.implementationId,
      "video",
    );
    return { ...plan, options: options.data };
  }

  request(input: ProjectFrameInput) {
    const { window, options } = this.plan(input);
    const revisionId = window.manifest.revisionId;
    const status = submitCachedDerivative<ProjectFrameArtifact>(
      this.jobs,
      this.cache,
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

  retry(input: ProjectFrameInput) {
    const current = this.request(input);
    if (current.jobId) this.jobs.retry(current.jobId);
    return this.request({ ...input, revisionId: current.revisionId });
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    const parsed = optionsSchema.safeParse(JSON.parse(job.input));
    if (job.target.kind !== "project" || job.artifact !== "frame" || !parsed.success)
      throw new CatalogError("UNSUPPORTED_JOB", "Picture job does not name a project frame");
    if (parsed.data.implementationId !== this.renderer.implementationId)
      throw new CatalogError("NOT_READY", "Pinned picture renderer is unavailable", {}, true);
    const plan = this.plan({
      projectId: job.target.projectId,
      revisionId: job.target.revisionId,
      ...parsed.data,
    });
    signal.throwIfAborted();
    const output = this.cache.reserve({ kind: "project", projectId: job.target.projectId });
    try {
      const parsedReceipt = receiptSchema.safeParse(
        await this.renderer.render(
          {
            window: plan.window,
            assets: plan.assets,
            output: output.path,
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
        value.file !== output.path ||
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
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== value.bytes)
        throw new CatalogError(
          "INVALID_RESPONSE",
          "Published picture size differs from its receipt",
        );
      return JSON.stringify({
        ...value,
        ...plan.options,
        projectId: job.target.projectId,
        revisionId: job.target.revisionId,
        cacheId: output.id,
      } satisfies ProjectFrameArtifact);
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  }
}
