import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import {
  resolveOutputSettings,
  resolvedOutputSettingsSchema,
  type OutputSettings,
  type OutputSettingsInput,
  rangeSchema,
} from "@screenrec/composition";
import { AssetStore } from "./assets.js";
import {
  projectWindow,
  projectCapabilities,
  type CompositionWindow,
  type CompositionAssetBinding,
  type ProjectRenderSupport,
} from "./project-window.js";
export type { CompositionWindow, CompositionAssetBinding } from "./project-window.js";
import { CatalogError } from "./catalog.js";
import { ProjectStore } from "./projects.js";
import type { Job, JobAdmission, JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { submitCachedDerivative } from "./cached-derivative.js";
import { checkRenderedPreview, type RenderedMovie } from "./preview.js";

export type ProjectPreviewInput = {
  projectId: string;
  revisionId?: string | undefined;
  range?: { startUs: number; endUs: number } | undefined;
  settings?: OutputSettingsInput | undefined;
  /** Internal retained intent binding; public requests omit this field. */
  implementationId?: string | undefined;
};
export type CompositionMovie = Omit<RenderedMovie, "audio"> & {
  settings: OutputSettings;
  encodedVideo: { profile: OutputSettings["video"]["profile"]; level: string };
  audio?: { frames: number; sampleRate: number; channels: number };
};
export type ProjectMovieRenderer = ProjectRenderSupport & {
  render(
    request: {
      model: import("@screenrec/composition").ValidatedComposition;
      window: CompositionWindow;
      assets: readonly CompositionAssetBinding[];
      output: string;
      settings: OutputSettings;
    },
    signal: AbortSignal,
  ): Promise<CompositionMovie>;
};
export type PinnedProjectPreview = {
  projectId: string;
  revisionId: string;
  range: { startUs: number; endUs: number };
  settings: OutputSettings;
  implementationId: string;
};
export type ProjectPreviewArtifact = CompositionMovie & PinnedProjectPreview & { cacheId: string };
const optionsSchema = z
  .object({
    range: rangeSchema,
    settings: resolvedOutputSettingsSchema,
    implementationId: z.string().min(1),
  })
  .strict();

/** Immutable composition admission and publication under the shared queue and disposable cache. */
export class ProjectPreviewInspection {
  constructor(
    private readonly projects: ProjectStore,
    private readonly assets: AssetStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly renderer: ProjectMovieRenderer,
  ) {
    if (!renderer.implementationId)
      throw new Error("A composition renderer implementation is required");
  }

  capabilities() {
    return projectCapabilities(this.renderer);
  }

  pin(input: ProjectPreviewInput): PinnedProjectPreview {
    if (input.implementationId !== undefined) this.requireImplementation(input.implementationId);
    const plan = this.plan(input);
    let settings: OutputSettings;
    try {
      settings = resolveOutputSettings(input.settings);
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new CatalogError(
          "INVALID_PARAMS",
          error.issues.map((issue) => issue.message).join("; "),
        );
      throw error;
    }
    const fps = plan.window.manifest.canvas.fps;
    if (
      settings.video.nonDroppableFrameRate !== null &&
      settings.video.nonDroppableFrameRate > fps.numerator / fps.denominator
    )
      throw new CatalogError(
        "INVALID_PARAMS",
        "Non-droppable frame rate exceeds composition frame rate",
      );
    return {
      projectId: input.projectId,
      revisionId: plan.window.manifest.revisionId,
      range: plan.window.manifest.range,
      settings,
      implementationId: this.renderer.implementationId,
    };
  }
  request(input: ProjectPreviewInput) {
    const pinned = this.pin(input);
    const plan = this.plan(pinned);
    const options = {
      range: pinned.range,
      settings: pinned.settings,
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
      { deferred: plan.pointerSources.length > 0 },
    );
    return {
      projectId: input.projectId,
      revisionId: pinned.revisionId,
      range: options.range,
      settings: options.settings,
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
    if (!current.published)
      for (const selection of this.plan(input).pointerSources)
        this.renderer.pointers?.retry(selection);
    if (current.jobId) this.jobs.retry(current.jobId);
    return this.request({
      projectId: current.projectId,
      revisionId: current.revisionId,
      range: current.range,
      settings: current.settings,
    });
  }

  admit(job: Job): ReturnType<JobAdmission> {
    const options = optionsSchema.parse(JSON.parse(job.input));
    this.requireImplementation(options.implementationId);
    if (job.target.kind !== "project" || job.artifact !== "preview")
      throw new CatalogError("UNSUPPORTED_JOB", "Preview admission requires a project job");
    const plan = this.plan({
      projectId: job.target.projectId,
      revisionId: job.target.revisionId,
      ...options,
    });
    return this.renderer.pointers?.admit(plan.pointerSources) ?? { state: "ready" };
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
    return projectWindow(this.projects, this.assets, input, this.renderer);
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
      const render = () =>
        this.renderer.render(
          { ...plan, settings: options.data.settings, output: output.path },
          signal,
        );
      const movie = this.renderer.pointers
        ? await this.renderer.pointers.withReady(plan.pointerSources, render)
        : await render();
      signal.throwIfAborted();
      if (
        !isDeepStrictEqual(
          resolvedOutputSettingsSchema.parse(movie.settings),
          options.data.settings,
        )
      )
        throw new CatalogError("INVALID_RESPONSE", "Renderer changed the pinned output settings");
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
