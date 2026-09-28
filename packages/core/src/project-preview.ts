import { z } from "zod";
import {
  createCompiler,
  isMediaClip,
  processingCapabilities,
  type ProcessorImplementations,
  rangeSchema,
  requireWindowReady,
  validateComposition,
} from "@screenrec/composition";
import { AssetStore, compositionAsset } from "./assets.js";
import { CatalogError } from "./catalog.js";
import { ProjectStore } from "./projects.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { submitCachedDerivative } from "./cached-derivative.js";
import { checkRenderedPreview, type RenderedMovie } from "./preview.js";

export type ProjectPreviewInput = {
  projectId: string;
  revisionId?: string | undefined;
  range?: { startUs: number; endUs: number } | undefined;
  /** Internal retained intent binding; public requests omit this field. */
  implementationId?: string | undefined;
};
export type CompositionWindow = ReturnType<ReturnType<typeof createCompiler>["window"]>;
export type CompositionAssetBinding = {
  assetId: string;
  streamId: string;
  path: string;
  originUs: number;
};
export type CompositionMovie = Omit<RenderedMovie, "audio"> & {
  audio?: { frames: number; sampleRate: number; channels: number };
};
export type ProjectMovieRenderer = {
  /** Identifies the deployed executors and supported gain implementation; changing it creates new work. */
  implementationId: string;
  render(
    request: {
      window: CompositionWindow;
      assets: readonly CompositionAssetBinding[];
      output: string;
    },
    signal: AbortSignal,
  ): Promise<CompositionMovie>;
};
export type PinnedProjectPreview = {
  projectId: string;
  revisionId: string;
  range: { startUs: number; endUs: number };
  profile: "h264-rec709";
  implementationId: string;
};
export type ProjectPreviewArtifact = CompositionMovie & PinnedProjectPreview & { cacheId: string };
const optionsSchema = z
  .object({
    range: rangeSchema,
    profile: z.literal("h264-rec709"),
    implementationId: z.string().min(1),
  })
  .strict();

/** Immutable composition admission and publication under the shared queue and disposable cache. */
export class ProjectPreviewInspection {
  private readonly processors: ProcessorImplementations;
  constructor(
    private readonly projects: ProjectStore,
    private readonly assets: AssetStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly renderer: ProjectMovieRenderer,
  ) {
    if (!renderer.implementationId)
      throw new Error("A composition renderer implementation is required");
    this.processors = { gain: renderer.implementationId };
  }

  capabilities() {
    return processingCapabilities(this.processors);
  }

  pin(input: ProjectPreviewInput): PinnedProjectPreview {
    if (input.implementationId !== undefined) this.requireImplementation(input.implementationId);
    const plan = this.plan(input);
    return {
      projectId: input.projectId,
      revisionId: plan.window.manifest.revisionId,
      range: plan.window.manifest.range,
      profile: "h264-rec709",
      implementationId: this.renderer.implementationId,
    };
  }
  request(input: ProjectPreviewInput) {
    const pinned = this.pin(input);
    const options = {
      range: pinned.range,
      profile: pinned.profile,
      implementationId: pinned.implementationId,
    };
    const status = submitCachedDerivative<ProjectPreviewArtifact>(
      this.jobs,
      this.cache,
      {
        target: {
          kind: "project",
          projectId: input.projectId,
          revisionId: pinned.revisionId,
        },
        artifact: "preview",
        input: JSON.stringify(options),
      },
      "heavy",
    );
    return {
      projectId: input.projectId,
      revisionId: pinned.revisionId,
      range: options.range,
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      published: status.published
        ? { generation: status.published.generation, preview: status.published.value }
        : null,
    };
  }

  retry(input: ProjectPreviewInput) {
    const current = this.request(input);
    if (current.jobId) this.jobs.retry(current.jobId);
    return this.request({
      projectId: current.projectId,
      revisionId: current.revisionId,
      range: current.range,
    });
  }

  private requireImplementation(implementationId: string) {
    if (implementationId !== this.renderer.implementationId)
      throw new CatalogError(
        "NOT_READY",
        "Pinned preview implementation is not available",
        { implementationId },
        true,
      );
  }

  private plan(input: ProjectPreviewInput) {
    const revision = this.projects.revision(input.projectId, input.revisionId);
    const ids = [
      ...new Set(revision.document.clips.filter(isMediaClip).map((clip) => clip.assetId)),
    ];
    const metadata = new Map(ids.map((id) => [id, this.assets.get(id)]));
    const model = validateComposition(
      revision.document,
      [...metadata.values()].map(compositionAsset),
    );
    const parsed = rangeSchema.safeParse(input.range ?? { startUs: 0, endUs: model.durationUs });
    if (!parsed.success || parsed.data.endUs > model.durationUs)
      throw new CatalogError(
        "INVALID_PARAMS",
        "Preview requires a nonempty range within the pinned project",
      );
    const window = createCompiler(model, revision.id).window({
      range: parsed.data,
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    const gainTargets = new Set(
      window.manifest.processing
        .filter((node) => node.mediaKind === "audio" || node.mediaKind === "output")
        .map((node) => JSON.stringify(node.target)),
    );
    const requirements = window.manifest.requirements.map((requirement) => ({
      ...requirement,
      implementationId:
        requirement.kind === "executor"
          ? this.renderer.implementationId
          : requirement.kind === "processor" && gainTargets.has(JSON.stringify(requirement.target))
            ? (this.processors[requirement.processor.type] ?? null)
            : null,
    }));
    const bound = { ...window, manifest: { ...window.manifest, requirements } };
    requireWindowReady(bound.manifest);
    const bindings = new Map<string, CompositionAssetBinding>();
    for (const source of bound.manifest.sources) {
      const asset = metadata.get(source.assetId)!;
      bindings.set(JSON.stringify([asset.id, source.streamId]), {
        assetId: asset.id,
        streamId: source.streamId,
        path: this.assets.path(asset.id),
        originUs: asset.originUs,
      });
    }
    return { window: bound, assets: [...bindings.values()] };
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    const options = optionsSchema.safeParse(JSON.parse(job.input));
    if (job.target.kind !== "project" || job.artifact !== "preview" || !options.success)
      throw new CatalogError("UNSUPPORTED_JOB", "Composition preview cannot execute this job");
    this.requireImplementation(options.data.implementationId);
    const plan = this.plan({
      projectId: job.target.projectId,
      revisionId: job.target.revisionId,
      range: options.data.range,
    });
    signal.throwIfAborted();
    const output = this.cache.reserve({ kind: "project", projectId: job.target.projectId });
    try {
      const movie = await this.renderer.render({ ...plan, output: output.path }, signal);
      signal.throwIfAborted();
      checkRenderedPreview(movie, {
        file: output.path,
        durationUs: options.data.range.endUs - options.data.range.startUs,
        maxLongEdge: null,
      });
      if (
        movie.width !== plan.window.manifest.canvas.width ||
        movie.height !== plan.window.manifest.canvas.height
      )
        throw new CatalogError("INVALID_RESPONSE", "Renderer changed the pinned canvas");
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== movie.bytes)
        throw new CatalogError("INVALID_RESPONSE", "Preview byte count does not match its file");
      const result: ProjectPreviewArtifact = {
        ...movie,
        ...options.data,
        projectId: job.target.projectId,
        revisionId: job.target.revisionId,
        cacheId: output.id,
      };
      return JSON.stringify(result);
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  }
}
