import { isDeepStrictEqual } from "node:util";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { CatalogError } from "./catalog.js";
import type { DerivedCache } from "./cache.js";
import type { JobQueue, JobExecution, Job } from "./jobs.js";
import { submitCachedDerivative } from "./cached-derivative.js";
import {
  MediaAudioInspection,
  type MediaAudioInput,
  type SourceAudioArtifact,
  type ProjectAudioArtifact,
} from "./audio-inspection.js";
import { waveformBuckets, sampleGrid } from "./audio-wave.js";
import { spectralLayout, spectralWindows } from "./audio-spectrum.js";
import { acousticImageRequest, type AcousticImageRequest } from "./acoustic-image.js";

const waveformOptions = z.strictObject({
  audioJobId: z.string().min(1),
  audioGeneration: z.int().positive(),
  bucketFrames: z.int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  policy: z.literal("waveform-buckets-v1"),
});
const spectrumOptions = waveformOptions.omit({ bucketFrames: true, policy: true }).extend({
  fftFrames: z.int().positive(),
  hopFrames: z.int().positive(),
  range: z.strictObject({ startUs: z.int().nonnegative(), endUs: z.int().positive() }),
  sampleRange: z.strictObject({ start: z.int().nonnegative(), end: z.int().positive() }),
  policy: z.literal("spectrum-density-v1"),
});
const optionsSchema = z.union([waveformOptions, spectrumOptions]);
export type AcousticInput = MediaAudioInput & { format?: "json" | "image" | undefined } & (
    | { kind?: "waveform"; bucketFrames?: number | undefined }
    | { kind: "spectrum"; fftFrames?: number | undefined; hopFrames?: number | undefined }
  );
type AudioArtifact = SourceAudioArtifact | ProjectAudioArtifact;
function metadata(audio: AudioArtifact) {
  const common = {
    range: audio.range,
    timeOriginUs: 0,
    sampleRange: audio.sampleRange,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    layout: audio.layout,
    implementationId: audio.implementationId,
  };
  return "projectId" in audio
    ? {
        ...common,
        unavailable: audio.unavailable,
        domain: "project" as const,
        projectId: audio.projectId,
        revisionId: audio.revisionId,
        tap: audio.tap,
      }
    : {
        ...common,
        unavailable: audio.unavailable,
        domain: "source" as const,
        assetId: audio.assetId,
        streamId: audio.streamId,
        ...(audio.acquisitionId ? { acquisitionId: audio.acquisitionId } : {}),
        supportDigest: audio.supportDigest,
      };
}
export type AcousticArtifact = ReturnType<typeof metadata> & {
  file: string;
  bytes: number;
  mediaType: "application/json" | "image/png";
  cacheId: string;
  bucketFrames?: number;
  bucketCount?: number;
  context?: Pick<ReturnType<typeof metadata>, "range" | "sampleRange" | "unavailable">;
  analysis:
    | { kind: "waveform"; bucketFrames: number; bucketCount: number }
    | { kind: "spectrum"; fftFrames: number; hopFrames: number; columnCount: number };
  audio: { jobId: string; generation: number };
};
const imageOptions = z.strictObject({
  measurementJobId: z.string().min(1),
  measurementGeneration: z.int().positive(),
  implementationId: z.string().min(1),
});
const imageReceipt = z.object({
  file: z.string(),
  bytes: z
    .int()
    .positive()
    .max(32 * 1024 * 1024),
  mediaType: z.literal("image/png"),
  width: z.int().positive(),
  height: z.int().positive(),
  provenance: z.array(z.string()),
  plotLeft: z.int().nonnegative(),
  plotWidth: z.int().positive(),
  plotTop: z.int().nonnegative(),
  panelHeight: z.int().positive(),
  panelStride: z.int().positive(),
  amplitudeLimit: z.number().positive().nullable().optional(),
  densityFloorDb: z.number().nullable().optional(),
  densityCeilingDb: z.number().nullable().optional(),
});
export type AcousticRenderer = {
  implementationId: string;
  render(request: AcousticImageRequest, signal: AbortSignal): Promise<unknown>;
};
const lost = (message: string) => new CatalogError("ARTIFACT_CHANGED", message, {}, true);
/** Acoustic derivatives retain audio provenance; only a rebuild needs the disposable PCM bytes. */
export class AcousticInspection {
  constructor(
    private readonly owners: {
      audio: MediaAudioInspection;
      jobs: JobQueue;
      cache: DerivedCache;
      renderer?: AcousticRenderer;
    },
  ) {}
  private input(value: AcousticInput) {
    const { format, ...input } = value;
    if (input.kind === "spectrum") {
      const { kind, fftFrames = 1024, hopFrames = 512, ...selection } = input;
      const display = this.owners.audio.recipe(selection),
        clock = display.sampleClock;
      if (!clock)
        throw new CatalogError("UNSUPPORTED_FORMAT", "Spectra require an integral sample rate");
      if (display.channels !== 1 && display.channels !== 2)
        throw new CatalogError("UNSUPPORTED_FORMAT", "Spectra require known mono or stereo audio");
      const layout = spectralLayout(
        {
          ...clock,
          frames: clock.sampleRange.end - clock.sampleRange.start,
          channels: display.channels,
        },
        { fftFrames, hopFrames },
      );
      const recipe = this.owners.audio.context(display.selection, layout.context);
      return {
        recipe,
        selection: display.selection,
        parameters: {
          fftFrames,
          hopFrames,
          range: display.selection.range,
          sampleRange: clock.sampleRange,
          policy: "spectrum-density-v1" as const,
        },
        artifact: "spectrum",
      };
    }
    const { bucketFrames, kind, ...selection } = input;
    if (bucketFrames !== undefined && (!Number.isSafeInteger(bucketFrames) || bucketFrames < 1))
      throw new CatalogError("INVALID_PARAMS", "bucketFrames must be a positive integer");
    const recipe = this.owners.audio.recipe(selection);
    if (bucketFrames !== undefined && recipe.sampleClock) {
      const { sampleRange } = recipe.sampleClock;
      sampleGrid({ sampleRange, frames: sampleRange.end - sampleRange.start }, { bucketFrames });
    }
    return {
      recipe,
      selection: recipe.selection,
      parameters: {
        bucketFrames: bucketFrames ?? null,
        policy: "waveform-buckets-v1" as const,
      },
      artifact: "waveform",
    };
  }
  private dependency(identity: ReturnType<MediaAudioInspection["recipe"]>["identity"]) {
    const status = this.owners.jobs.status(identity);
    return {
      status,
      summary: {
        jobId: status.jobId,
        state: status.state,
        reason: status.reason,
        retryable: status.retryable,
        generation: status.published?.generation ?? null,
      },
    };
  }
  request(input: AcousticInput) {
    return input.format === "image" ? this.image(input) : this.measurements(input);
  }
  private measurements(input: AcousticInput, regenerate = true) {
    const { recipe, selection, parameters, artifact } = this.input(input);
    let dependency = this.dependency(recipe.identity);
    if (!dependency.status.published) {
      this.owners.audio.request(recipe.selection);
      dependency = this.dependency(recipe.identity);
    }
    if (!dependency.status.published)
      return {
        ...selection,
        state: dependency.status.state,
        reason: dependency.status.reason,
        retryable: dependency.status.retryable,
        jobId: dependency.status.jobId,
        dependency: dependency.summary,
        published: null,
      };
    const identity = {
      target: recipe.identity.target,
      artifact,
      input: JSON.stringify({
        audioJobId: dependency.status.jobId!,
        audioGeneration: dependency.status.published.generation,
        ...parameters,
      }),
    };
    const retained = this.owners.jobs.status(identity);
    const status =
      !regenerate && retained.published
        ? {
            ...retained,
            published: {
              generation: retained.published.generation,
              value: JSON.parse(retained.published.result) as AcousticArtifact,
            },
          }
        : submitCachedDerivative<AcousticArtifact>(
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
      dependency: dependency.summary,
      published: status.published
        ? { generation: status.published.generation, artifact: status.published.value }
        : null,
    };
  }
  private image(input: AcousticInput) {
    const renderer = this.owners.renderer;
    if (!renderer)
      throw new CatalogError("NOT_READY", "Acoustic image renderer is unavailable", {}, true);
    const measurement = this.measurements(input, false);
    if (!measurement.published) return measurement;
    const source = this.owners.jobs.job(measurement.jobId!);
    const status = submitCachedDerivative<AcousticArtifact>(
      this.owners.jobs,
      this.owners.cache,
      {
        target: source.target,
        artifact: "acoustic-image",
        input: JSON.stringify({
          measurementJobId: source.jobId,
          measurementGeneration: measurement.published.generation,
          implementationId: renderer.implementationId,
        }),
      },
      "heavy",
    );
    return {
      ...measurement,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            artifact: status.published.value,
          }
        : null,
    };
  }
  retry(input: AcousticInput) {
    const { recipe, selection } = this.input(input);
    const pinnedInput = { ...input, ...selection };
    const current = this.request(pinnedInput);
    if (current.published) return current;
    if (input.format === "image") {
      this.retry({ ...pinnedInput, format: "json" });
    } else this.owners.audio.retry(recipe.selection);
    const next = this.request(pinnedInput);
    if (next.jobId && next.jobId !== next.dependency.jobId) this.owners.jobs.retry(next.jobId);
    return this.request(pinnedInput);
  }
  private pinned(job: Job, options: z.infer<typeof optionsSchema>) {
    const source = this.owners.jobs.job(options.audioJobId);
    if (source.artifact !== "audio" || !isDeepStrictEqual(source.target, job.target))
      throw lost("Acoustic dependency does not belong to its selected audio target");
    const status = this.owners.jobs.status(source);
    if (
      !status.published ||
      status.published.generation !== options.audioGeneration ||
      source.generation !== options.audioGeneration
    )
      throw lost("Pinned audio generation is no longer available");
    return JSON.parse(status.published.result) as AudioArtifact;
  }
  private measurement(job: Job, options: z.infer<typeof imageOptions>) {
    const source = this.owners.jobs.job(options.measurementJobId);
    const status = this.owners.jobs.status(source);
    if (
      !["waveform", "spectrum"].includes(source.artifact) ||
      !isDeepStrictEqual(source.target, job.target) ||
      !status.published ||
      source.generation !== options.measurementGeneration ||
      status.published.generation !== options.measurementGeneration
    )
      throw lost("Pinned acoustic measurements are no longer available");
    return {
      kind: source.artifact,
      value: JSON.parse(status.published.result) as AcousticArtifact,
    };
  }
  private async executeImage({ job, signal }: JobExecution, raw: unknown) {
    const options = imageOptions.parse(raw),
      renderer = this.owners.renderer;
    if (!renderer || renderer.implementationId !== options.implementationId)
      throw new CatalogError("NOT_READY", "Pinned acoustic renderer is unavailable", {}, true);
    const measurement = this.measurement(job, options),
      lease = this.owners.cache.acquire(measurement.value.cacheId);
    if (!lease)
      throw new CatalogError(
        "ARTIFACT_EXPIRED",
        "Acoustic measurements were evicted; retry image preparation",
        {},
        true,
      );
    let output: ReturnType<DerivedCache["reserve"]> | undefined;
    try {
      if (lease.bytes > 16 * 1024 * 1024)
        throw new CatalogError("LIMIT_EXCEEDED", "Acoustic measurements exceed 16 MiB");
      const bytes = Buffer.alloc(lease.bytes);
      if (lease.read(bytes, 0) !== bytes.length) throw lost("Acoustic measurements are incomplete");
      const document = JSON.parse(bytes.toString("utf8"));
      const evidence =
        measurement.kind === "waveform"
          ? {
              kind: "waveform" as const,
              data: document as Awaited<ReturnType<typeof waveformBuckets>>,
            }
          : {
              kind: "spectrum" as const,
              data: { ...document, density: Float64Array.from(document.density) } as Awaited<
                ReturnType<typeof spectralWindows>
              >,
            };
      output = this.owners.cache.reserve(job.target);
      const request = acousticImageRequest(measurement.value, evidence, output.path);
      const receipt = imageReceipt.parse(await renderer.render(request, signal));
      signal.throwIfAborted();
      if (
        receipt.file !== output.path ||
        !isDeepStrictEqual(receipt.provenance, request.provenance)
      )
        throw lost("Acoustic image receipt differs from its pinned request");
      this.measurement(job, options);
      lease.release();
      const published = await this.owners.cache.publish(output.id);
      if (published.bytes !== receipt.bytes)
        throw lost("Acoustic image byte count differs from its receipt");
      signal.throwIfAborted();
      this.measurement(job, options);
      return JSON.stringify({
        ...measurement.value,
        ...receipt,
        cacheId: output.id,
        measurements: {
          jobId: options.measurementJobId,
          generation: options.measurementGeneration,
        },
        imageImplementationId: renderer.implementationId,
      });
    } catch (error) {
      if (output) this.owners.cache.remove(output.id);
      throw error;
    } finally {
      lease.release();
    }
  }
  async execute(execution: JobExecution) {
    const { job, signal } = execution;
    let raw: unknown;
    try {
      raw = JSON.parse(job.input);
    } catch {
      throw new CatalogError("UNSUPPORTED_JOB", "Invalid acoustic input");
    }
    if (job.artifact === "acoustic-image") return this.executeImage(execution, raw);
    const parsed = optionsSchema.safeParse(raw);
    if (
      !["waveform", "spectrum"].includes(job.artifact) ||
      !parsed.success ||
      (job.target.kind !== "asset" && job.target.kind !== "project")
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Job does not name acoustic measurements");
    const options = parsed.data,
      audio = this.pinned(job, options);
    const lease = this.owners.cache.acquire(audio.cacheId);
    if (!lease)
      throw new CatalogError(
        "ARTIFACT_EXPIRED",
        "Pinned PCM bytes were evicted; retry acoustic preparation",
        {},
        true,
      );
    let output: ReturnType<DerivedCache["reserve"]> | undefined;
    try {
      output = this.owners.cache.reserve(job.target);
      const provenance = { jobId: options.audioJobId, generation: options.audioGeneration };
      const description = metadata(audio);
      let context: AcousticArtifact["context"];
      let measurements: object;
      let analysis: AcousticArtifact["analysis"];
      if (options.policy === "waveform-buckets-v1") {
        const bucketFrames = options.bucketFrames ?? Math.max(1, Math.ceil(audio.frames / 1024));
        const result = await waveformBuckets(lease, audio, { bucketFrames }, signal);
        measurements = {
          ...result,
          units: {
            range: "microsecond",
            sampleRange: "sample-frame",
            amplitude: "linear",
            rms: "linear",
          },
        };
        analysis = { kind: "waveform", bucketFrames, bucketCount: result.buckets.length };
      } else {
        const result = await spectralWindows(lease, audio, options, signal);
        context = {
          range: description.range,
          sampleRange: description.sampleRange,
          unavailable: description.unavailable,
        };
        description.range = options.range;
        description.sampleRange = options.sampleRange;
        if (description.domain === "project") {
          description.unavailable = description.unavailable.map((entry) => ({
            ...entry,
            ranges: entry.ranges
              .map((span) => ({
                start: Math.max(span.start, options.sampleRange.start),
                end: Math.min(span.end, options.sampleRange.end),
              }))
              .filter((span) => span.start < span.end),
          }));
        } else {
          description.unavailable = description.unavailable
            .map((span) => ({
              startUs: Math.max(span.startUs, options.range.startUs),
              endUs: Math.min(span.endUs, options.range.endUs),
            }))
            .filter((span) => span.startUs < span.endUs);
        }
        measurements = { ...result, density: Array.from(result.density) };
        analysis = {
          kind: "spectrum",
          fftFrames: options.fftFrames,
          hopFrames: options.hopFrames,
          columnCount: result.columns.length,
        };
      }
      signal.throwIfAborted();
      const document = {
        ...description,
        ...measurements,
        ...(context ? { context } : {}),
        audio: provenance,
        generation: job.generation,
      };
      const bytes = Buffer.from(JSON.stringify(document) + "\n");
      const maximum = options.policy === "waveform-buckets-v1" ? 4 * 1024 * 1024 : 16 * 1024 * 1024;
      if (bytes.length > maximum)
        throw new CatalogError("LIMIT_EXCEEDED", "Acoustic JSON exceeds its byte limit");
      this.owners.cache.checkCapacity(bytes.length);
      await writeFile(output.path, bytes, { flag: "wx", signal });
      const pinned = this.pinned(job, options);
      if (pinned.cacheId !== audio.cacheId)
        throw lost("Pinned PCM identity changed during reduction");
      lease.release();
      const published = await this.owners.cache.publish(output.id);
      signal.throwIfAborted();
      this.pinned(job, options);
      return JSON.stringify({
        ...description,
        ...(context ? { context } : {}),
        file: output.path,
        bytes: published.bytes,
        mediaType: "application/json",
        cacheId: output.id,
        analysis,
        ...(analysis.kind === "waveform"
          ? { bucketFrames: analysis.bucketFrames, bucketCount: analysis.bucketCount }
          : {}),
        audio: provenance,
      } satisfies AcousticArtifact);
    } catch (error) {
      if (output) this.owners.cache.remove(output.id);
      throw error;
    } finally {
      lease.release();
    }
  }
}
