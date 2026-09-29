import { validateAudioWave } from "./audio-wave.js";
import { openedFile, retainedFileRead } from "./files.js";
import { constants, openSync, fstatSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { rangeSchema, processingTapSchema, type ProcessingTap } from "@screenrec/composition";
import type { ProjectStore } from "./projects.js";
import {
  projectWindow,
  type CompositionWindow,
  type CompositionAssetBinding,
} from "./project-window.js";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { CatalogError } from "./catalog.js";
import { submitCachedDerivative } from "./cached-derivative.js";
import { selectSource, sourceSelectionSchema, type SourceSelection } from "./source-selection.js";
import type { TimeRange } from "./timeline.js";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const receiptSchema = z.object({
  file: z.string(),
  mediaType: z.literal("audio/wav"),
  bytes: integer.positive(),
  sampleRate: integer.min(1).max(192000),
  channels: z.union([z.literal(1), z.literal(2)]),
  layout: z.enum(["mono", "stereo"]),
  range: rangeSchema,
  sampleRange: z.object({ start: integer, end: integer }),
  frames: integer,
  decodedFrames: integer,
  unavailable: z.array(rangeSchema),
});
export type SourceAudioResult = z.infer<typeof receiptSchema>;
export type SourceAudioInput = SourceSelection & { range?: TimeRange | undefined };
export type SourceAudioRenderer = {
  implementationId: string;
  render(
    request: { source: ReturnType<typeof selectSource>["track"]; range: TimeRange; output: string },
    signal: AbortSignal,
  ): Promise<unknown>;
};
export type SourceAudioArtifact = SourceAudioResult &
  SourceSelection & {
    cacheId: string;
    supportDigest: string;
    implementationId: string;
  };
const optionsSchema = z.strictObject({
  selection: sourceSelectionSchema,
  range: rangeSchema,
  supportDigest: z.string(),
  implementationId: z.string().min(1),
});
const projectOptionsSchema = z.strictObject({
  range: rangeSchema,
  tap: processingTapSchema,
  implementationId: z.string().min(1),
});
const sampleRangeSchema = z
  .object({ start: integer, end: integer })
  .refine((value) => value.end >= value.start);
export const projectAudioReceiptSchema = z.object({
  file: z.string(),
  bytes: integer.positive(),
  sampleRate: z.literal(48000),
  channels: z.literal(2),
  frames: integer,
  peak: z.number().finite().nonnegative(),
  clippedSamples: integer,
  maximumBlockFrames: integer.positive(),
  peakResidentBytes: integer,
  decoderContext: z.object({
    policy: z.literal("bounded-current-retained-run"),
    sampleRate: z.literal(48000),
    maximumPrerollFrames: integer,
    maximumTailFrames: integer,
  }),
  unavailable: z.array(z.object({ clipId: z.string(), ranges: z.array(sampleRangeSchema) })),
});
export type ProjectAudioInput = {
  projectId: string;
  revisionId?: string | undefined;
  range?: TimeRange | undefined;
  tap?: ProcessingTap | undefined;
};
export type ProjectAudioRenderer = {
  implementationId: string;
  render(
    request: {
      window: CompositionWindow;
      assets: readonly CompositionAssetBinding[];
      output: string;
    },
    signal: AbortSignal,
  ): Promise<unknown>;
};
export type ProjectAudioArtifact = z.infer<typeof projectAudioReceiptSchema> & {
  projectId: string;
  revisionId: string;
  range: TimeRange;
  tap: ProcessingTap;
  implementationId: string;
  sampleRange: { start: number; end: number };
  mediaType: "audio/wav";
  layout: "stereo";
  cacheId: string;
};
export type MediaAudioInput = SourceAudioInput | ProjectAudioInput;
const artifact = "audio";
function invalid(message: string): never {
  throw new CatalogError("INVALID_RESPONSE", message);
}
const sample = (us: number, rate: number) => Number((BigInt(us) * BigInt(rate)) / 1_000_000n);
function unavailable(range: TimeRange, support: readonly TimeRange[]) {
  const gaps: TimeRange[] = [];
  let at = range.startUs;
  for (const part of support) {
    if (part.endUs <= at) continue;
    if (part.startUs >= range.endUs) break;
    if (part.startUs > at) gaps.push({ startUs: at, endUs: part.startUs });
    at = Math.min(range.endUs, part.endUs);
  }
  if (at < range.endUs) gaps.push({ startUs: at, endUs: range.endUs });
  return gaps;
}

/** Source and project PCM share admission, cache publication and WAV validation. */
export class MediaAudioInspection {
  constructor(
    private readonly owners: {
      assets: AssetStore;
      acquisitions: AcquisitionStore;
      jobs: JobQueue;
      cache: DerivedCache;
      sourceRenderer: SourceAudioRenderer;
      project?: { projects: ProjectStore; renderer: ProjectAudioRenderer };
    },
  ) {
    if (owners.project && !owners.project.renderer.implementationId)
      throw new Error("Project audio renderer needs an implementation identity");
    if (!owners.sourceRenderer.implementationId)
      throw new Error("Audio renderer needs an implementation identity");
  }
  private plan(input: SourceAudioInput) {
    const { range, ...selection } = input;
    const source = selectSource(this.owners.assets, this.owners.acquisitions, selection);
    if (source.stream.kind !== "audio")
      throw new CatalogError("UNSUPPORTED_MEDIA", "Audio inspection requires an audio stream");
    const parsed = rangeSchema.safeParse(range === undefined ? source.stream.bounds : range);
    if (!parsed.success || parsed.data.endUs > source.durationUs)
      throw new CatalogError(
        "INVALID_RANGE",
        "Audio range must lie within the selected source duration",
      );
    const stream = this.owners.assets
      .get(source.selection.assetId)
      .streams.find((value) => value.id === source.selection.streamId)!;
    // Native admission owns unsupported formats. Known PCM dimensions permit early size refusal.
    if (
      stream.sampleRate !== undefined &&
      Number.isSafeInteger(stream.sampleRate) &&
      stream.sampleRate > 0 &&
      stream.channels !== undefined
    ) {
      const rate = BigInt(stream.sampleRate);
      const frames =
        (BigInt(parsed.data.endUs) * rate) / 1_000_000n -
        (BigInt(parsed.data.startUs) * rate) / 1_000_000n;
      const minimumBytes = frames * BigInt(stream.channels) * 4n + 44n;
      if (minimumBytes > BigInt(Number.MAX_SAFE_INTEGER))
        throw new CatalogError("LIMIT_EXCEEDED", "Audio derivative size exceeds safe accounting");
      this.owners.cache.checkCapacity(Number(minimumBytes));
    }
    return {
      source,
      sampleRate: stream.sampleRate,
      channels: stream.channels,
      options: {
        selection: source.selection,
        range: parsed.data,
        supportDigest: source.supportDigest,
        implementationId: this.owners.sourceRenderer.implementationId,
      },
    };
  }
  private sourceRecipe(input: SourceAudioInput) {
    const { options, sampleRate: rate, source, channels } = this.plan(input);
    return {
      durationUs: source.durationUs,
      channels,
      sampleClock:
        rate === undefined || !Number.isSafeInteger(rate) || rate <= 0
          ? undefined
          : {
              sampleRate: rate,
              sampleRange: {
                start: sample(options.range.startUs, rate),
                end: sample(options.range.endUs, rate),
              },
            },
      options,
      selection: { ...options.selection, range: options.range },
      identity: {
        target: { kind: "asset" as const, assetId: options.selection.assetId },
        artifact,
        input: JSON.stringify(options),
      },
    };
  }
  /** Canonical immutable audio identity without submitting work or regenerating evicted PCM. */
  recipe(input: MediaAudioInput) {
    return "projectId" in input ? this.projectRecipe(input) : this.sourceRecipe(input);
  }
  /** Surrounding analysis samples use the same pinned selector, masks and native audio owner. */
  context(input: MediaAudioInput, requested: { start: number; end: number }) {
    const recipe = this.recipe(input),
      clock = recipe.sampleClock;
    if (!clock)
      throw new CatalogError(
        "UNSUPPORTED_FORMAT",
        "Audio context requires an integral sample rate",
      );
    if (
      !Number.isSafeInteger(requested.start) ||
      !Number.isSafeInteger(requested.end) ||
      requested.start > clock.sampleRange.start ||
      requested.end < clock.sampleRange.end
    )
      throw new CatalogError(
        "INVALID_RANGE",
        "Audio context must contain the requested sample range",
      );
    const rate = BigInt(clock.sampleRate);
    const us = (frame: number) => Number((BigInt(frame) * 1_000_000n + rate - 1n) / rate);
    const start = Math.max(0, requested.start);
    const end = Math.min(sample(recipe.durationUs, clock.sampleRate), requested.end);
    return this.recipe({
      ...recipe.selection,
      range: {
        startUs: Math.min(recipe.selection.range.startUs, us(start)),
        endUs: Math.max(recipe.selection.range.endUs, Math.min(recipe.durationUs, us(end))),
      },
    });
  }
  private requestSource(input: SourceAudioInput) {
    const { options, identity } = this.sourceRecipe(input);
    const { assets, acquisitions, jobs, cache } = this.owners;
    const status = submitCachedDerivative<SourceAudioArtifact>(jobs, cache, identity, "heavy", {
      admitted: (job) => {
        const owner = { kind: "job" as const, id: job.jobId };
        assets.retain(owner, [options.selection.assetId]);
        if (options.selection.acquisitionId)
          acquisitions.retain(owner, [options.selection.acquisitionId]);
      },
    });
    return {
      ...options.selection,
      range: options.range,
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      published: status.published
        ? { generation: status.published.generation, audio: status.published.value }
        : null,
    };
  }
  request(input: SourceAudioInput): ReturnType<MediaAudioInspection["requestSource"]>;
  request(input: ProjectAudioInput): ReturnType<MediaAudioInspection["requestProject"]>;
  request(
    input: MediaAudioInput,
  ):
    | ReturnType<MediaAudioInspection["requestSource"]>
    | ReturnType<MediaAudioInspection["requestProject"]>;
  request(input: MediaAudioInput) {
    return "projectId" in input ? this.requestProject(input) : this.requestSource(input);
  }
  retry(input: SourceAudioInput): ReturnType<MediaAudioInspection["requestSource"]>;
  retry(input: ProjectAudioInput): ReturnType<MediaAudioInspection["requestProject"]>;
  retry(
    input: MediaAudioInput,
  ):
    | ReturnType<MediaAudioInspection["requestSource"]>
    | ReturnType<MediaAudioInspection["requestProject"]>;
  retry(input: MediaAudioInput) {
    const current = this.request(input);
    if (current.jobId) this.owners.jobs.retry(current.jobId);
    return this.request(
      "projectId" in current
        ? {
            projectId: current.projectId,
            revisionId: current.revisionId,
            range: current.range,
            tap: current.tap,
          }
        : input,
    );
  }
  private projectPlan(input: ProjectAudioInput) {
    const owner = this.owners.project;
    if (!owner)
      throw new CatalogError("NOT_READY", "Project audio renderer is unavailable", {}, true);
    const plan = projectWindow(owner.projects, this.owners.assets, input, owner.renderer, "audio");
    const { sampleRange } = plan.window.manifest;
    if (sampleRange.end <= sampleRange.start)
      throw new CatalogError(
        "INVALID_RANGE",
        "Project audio window must contain at least one sample",
      );
    const bytes = BigInt(sampleRange.end - sampleRange.start) * 8n + 44n;
    if (bytes > BigInt(Number.MAX_SAFE_INTEGER))
      throw new CatalogError("LIMIT_EXCEEDED", "Audio derivative size exceeds safe accounting");
    this.owners.cache.checkCapacity(Number(bytes));
    return plan;
  }
  private projectRecipe(input: ProjectAudioInput) {
    const { window, durationUs } = this.projectPlan(input);
    const { range, tap, revisionId } = window.manifest;
    const options = {
      range,
      tap,
      implementationId: this.owners.project!.renderer.implementationId,
    };
    return {
      durationUs,
      channels: 2 as const,
      options,
      sampleClock: { sampleRate: 48000, sampleRange: window.manifest.sampleRange },
      selection: { projectId: input.projectId, revisionId, range, tap },
      identity: {
        target: { kind: "project" as const, projectId: input.projectId, revisionId },
        artifact,
        input: JSON.stringify(options),
      },
    };
  }
  private requestProject(input: ProjectAudioInput) {
    const { selection, identity } = this.projectRecipe(input);
    const status = submitCachedDerivative<ProjectAudioArtifact>(
      this.owners.jobs,
      this.owners.cache,
      identity,
      "heavy",
    );
    return {
      ...selection,
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      published: status.published
        ? { generation: status.published.generation, audio: status.published.value }
        : null,
    };
  }
  private async executeProject({ job, signal }: JobExecution, raw: unknown): Promise<string> {
    const parsed = projectOptionsSchema.safeParse(raw);
    if (job.target.kind !== "project" || job.artifact !== artifact || !parsed.success)
      throw new CatalogError("UNSUPPORTED_JOB", "Audio job does not name a project window");
    const owner = this.owners.project;
    if (!owner || owner.renderer.implementationId !== parsed.data.implementationId)
      throw new CatalogError("NOT_READY", "Pinned project audio renderer is unavailable", {}, true);
    const plan = this.projectPlan({
      projectId: job.target.projectId,
      revisionId: job.target.revisionId,
      ...parsed.data,
    });
    signal.throwIfAborted();
    const output = this.owners.cache.reserve({ kind: "project", projectId: job.target.projectId });
    try {
      const value = checkProjectAudioResult(
        await owner.renderer.render({ ...plan, output: output.path }, signal),
        plan.window,
        output.path,
      );
      signal.throwIfAborted();
      const sampleRange = plan.window.manifest.sampleRange;
      const cached = await this.owners.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== value.bytes) invalid("Published audio size differs from its receipt");
      return JSON.stringify({
        ...value,
        ...parsed.data,
        projectId: job.target.projectId,
        revisionId: job.target.revisionId,
        mediaType: "audio/wav",
        layout: "stereo",
        sampleRange,
        cacheId: output.id,
      } satisfies ProjectAudioArtifact);
    } catch (error) {
      this.owners.cache.remove(output.id);
      throw error;
    }
  }
  async execute({ job, signal }: JobExecution): Promise<string> {
    let raw: unknown;
    try {
      raw = JSON.parse(job.input);
    } catch {
      throw new CatalogError("UNSUPPORTED_JOB", "Invalid audio job input");
    }
    if (job.target.kind === "project") return this.executeProject({ job, signal }, raw);
    const parsed = optionsSchema.safeParse(raw);
    if (
      job.target.kind !== "asset" ||
      job.artifact !== artifact ||
      !parsed.success ||
      parsed.data.selection.assetId !== job.target.assetId
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Audio job does not name a selected asset stream");
    const options = parsed.data;
    if (options.implementationId !== this.owners.sourceRenderer.implementationId)
      throw new CatalogError("NOT_READY", "Pinned audio renderer is unavailable", {}, true);
    const { source } = this.plan({ ...options.selection, range: options.range });
    if (source.supportDigest !== options.supportDigest)
      throw new CatalogError("ARTIFACT_CHANGED", "Selected source support changed");
    signal.throwIfAborted();
    const output = this.owners.cache.reserve({ kind: "asset", assetId: options.selection.assetId });
    try {
      const receipt = receiptSchema.safeParse(
        await this.owners.sourceRenderer.render(
          { source: source.track, range: options.range, output: output.path },
          signal,
        ),
      );
      signal.throwIfAborted();
      if (!receipt.success) invalid("Malformed source audio receipt");
      const value = receipt.data;
      const metadata = this.owners.assets
        .get(options.selection.assetId)
        .streams.find((stream) => stream.id === options.selection.streamId)!;
      const first = sample(options.range.startUs, value.sampleRate),
        last = sample(options.range.endUs, value.sampleRate);
      if (
        value.file !== output.path ||
        !isDeepStrictEqual(value.range, options.range) ||
        value.sampleRange.start !== first ||
        value.sampleRange.end !== last ||
        value.frames !== last - first ||
        value.layout !== (value.channels === 1 ? "mono" : "stereo") ||
        (metadata.sampleRate !== undefined && metadata.sampleRate !== value.sampleRate) ||
        (metadata.channels !== undefined && metadata.channels !== value.channels) ||
        !isDeepStrictEqual(value.unavailable, unavailable(options.range, source.track.available))
      )
        invalid("Source audio receipt differs from its selected stream or sample window");
      checkAudioWaveFile(value);
      const cached = await this.owners.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== value.bytes) invalid("Published audio size differs from its receipt");
      return JSON.stringify({
        ...value,
        ...options.selection,
        supportDigest: options.supportDigest,
        implementationId: options.implementationId,
        cacheId: output.id,
      } satisfies SourceAudioArtifact);
    } catch (error) {
      this.owners.cache.remove(output.id);
      throw error;
    }
  }
}

/** Validate the completed producer file before immutable publication. */
function checkAudioWaveFile(
  value: Pick<SourceAudioResult, "file" | "bytes" | "sampleRate" | "channels" | "frames">,
) {
  const fd = openSync(value.file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const file = retainedFileRead(openedFile(fd), value.bytes);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size !== value.bytes)
      invalid("Audio output is not the reported regular file");
    validateAudioWave(file, value);
  } finally {
    file.release();
  }
}

/** The same receipt and source-gap contract applies to cached and durably prepared audio. */
export function checkProjectAudioResult(
  result: unknown,
  window: CompositionWindow,
  output: string,
) {
  const receipt = projectAudioReceiptSchema.safeParse(result);
  if (!receipt.success) invalid("Malformed project audio receipt");
  const value = receipt.data;
  const sampleRange = window.manifest.sampleRange;
  if (
    value.file !== output ||
    value.frames !== sampleRange.end - sampleRange.start ||
    value.clippedSamples > value.frames * 2
  )
    invalid("Project audio receipt differs from its pinned sample window");
  const clips = new Map(
    [...window.audio()]
      .filter((clip) => clip.source.kind === "range")
      .map((clip) => [clip.clipId, clip]),
  );
  for (const missing of value.unavailable) {
    const clip = clips.get(missing.clipId);
    if (!clip) invalid("Project audio receipt names an unselected or repeated clip");
    let through = clip.sampleRange.start;
    for (const gap of missing.ranges) {
      if (gap.start < through || gap.end <= gap.start || gap.end > clip.sampleRange.end)
        invalid("Project audio unavailable samples exceed their clip");
      through = gap.end;
    }
    clips.delete(missing.clipId);
  }
  if (clips.size) invalid("Project audio receipt omitted a selected clip");
  checkAudioWaveFile(value);
  return value;
}
