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
import { waveformBuckets, waveformLayout } from "./audio-wave.js";

const optionsSchema = z.strictObject({
  audioJobId: z.string().min(1),
  audioGeneration: z.int().positive(),
  bucketFrames: z.int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  policy: z.literal("waveform-buckets-v1"),
});
export type WaveformInput = MediaAudioInput & { bucketFrames?: number | undefined };
type AudioArtifact = SourceAudioArtifact | ProjectAudioArtifact;
function metadata(audio: AudioArtifact) {
  const common = {
    range: audio.range,
    timeOriginUs: 0,
    sampleRange: audio.sampleRange,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    layout: audio.layout,
    unavailable: audio.unavailable,
    implementationId: audio.implementationId,
  };
  return "projectId" in audio
    ? {
        ...common,
        domain: "project" as const,
        projectId: audio.projectId,
        revisionId: audio.revisionId,
        tap: audio.tap,
      }
    : {
        ...common,
        domain: "source" as const,
        assetId: audio.assetId,
        streamId: audio.streamId,
        ...(audio.acquisitionId ? { acquisitionId: audio.acquisitionId } : {}),
        supportDigest: audio.supportDigest,
      };
}
export type WaveformArtifact = ReturnType<typeof metadata> & {
  file: string;
  bytes: number;
  mediaType: "application/json";
  cacheId: string;
  bucketFrames: number;
  bucketCount: number;
  audio: { jobId: string; generation: number };
};
const lost = (message: string) => new CatalogError("ARTIFACT_CHANGED", message, {}, true);
/** Acoustic derivatives retain audio provenance; only a rebuild needs the disposable PCM bytes. */
export class WaveformInspection {
  constructor(
    private readonly owners: { audio: MediaAudioInspection; jobs: JobQueue; cache: DerivedCache },
  ) {}
  private input(input: WaveformInput) {
    const { bucketFrames, ...selection } = input;
    if (bucketFrames !== undefined && (!Number.isSafeInteger(bucketFrames) || bucketFrames < 1))
      throw new CatalogError("INVALID_PARAMS", "bucketFrames must be a positive integer");
    const recipe = this.owners.audio.recipe(selection);
    if (bucketFrames !== undefined && recipe.sampleClock) {
      const { sampleRange } = recipe.sampleClock;
      waveformLayout(
        { sampleRange, frames: sampleRange.end - sampleRange.start },
        { bucketFrames },
      );
    }
    return { recipe, bucketFrames: bucketFrames ?? null };
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
  request(input: WaveformInput) {
    const { recipe, bucketFrames } = this.input(input);
    let dependency = this.dependency(recipe.identity);
    if (!dependency.status.published) {
      this.owners.audio.request(recipe.selection);
      dependency = this.dependency(recipe.identity);
    }
    if (!dependency.status.published)
      return {
        ...recipe.selection,
        state: dependency.status.state,
        reason: dependency.status.reason,
        retryable: dependency.status.retryable,
        jobId: dependency.status.jobId,
        dependency: dependency.summary,
        published: null,
      };
    const identity = {
      target: recipe.identity.target,
      artifact: "waveform",
      input: JSON.stringify({
        audioJobId: dependency.status.jobId!,
        audioGeneration: dependency.status.published.generation,
        bucketFrames,
        policy: "waveform-buckets-v1",
      }),
    };
    const status = submitCachedDerivative<WaveformArtifact>(
      this.owners.jobs,
      this.owners.cache,
      identity,
      "heavy",
    );
    return {
      ...recipe.selection,
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      dependency: dependency.summary,
      published: status.published
        ? { generation: status.published.generation, waveform: status.published.value }
        : null,
    };
  }
  retry(input: WaveformInput) {
    const { recipe } = this.input(input);
    // Ready acoustic bytes need no PCM regeneration. Rebuilds prepare the same frozen selector.
    const current = this.request(input);
    if (current.published) return current;
    this.owners.audio.retry(recipe.selection);
    const next = this.request({
      ...recipe.selection,
      ...(input.bucketFrames === undefined ? {} : { bucketFrames: input.bucketFrames }),
    });
    if (next.jobId && next.jobId !== next.dependency.jobId) this.owners.jobs.retry(next.jobId);
    return this.request({
      ...recipe.selection,
      ...(input.bucketFrames === undefined ? {} : { bucketFrames: input.bucketFrames }),
    });
  }
  private pinned(job: Job, options: z.infer<typeof optionsSchema>) {
    const source = this.owners.jobs.job(options.audioJobId);
    if (source.artifact !== "audio" || !isDeepStrictEqual(source.target, job.target))
      throw lost("Waveform dependency does not belong to its selected audio target");
    const status = this.owners.jobs.status(source);
    if (
      !status.published ||
      status.published.generation !== options.audioGeneration ||
      source.generation !== options.audioGeneration
    )
      throw lost("Pinned audio generation is no longer available");
    return JSON.parse(status.published.result) as AudioArtifact;
  }
  async execute({ job, signal }: JobExecution) {
    let raw: unknown;
    try {
      raw = JSON.parse(job.input);
    } catch {
      throw new CatalogError("UNSUPPORTED_JOB", "Invalid waveform input");
    }
    const parsed = optionsSchema.safeParse(raw);
    if (
      job.artifact !== "waveform" ||
      !parsed.success ||
      (job.target.kind !== "asset" && job.target.kind !== "project")
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Job does not name an acoustic waveform");
    const options = parsed.data,
      audio = this.pinned(job, options);
    const lease = this.owners.cache.acquire(audio.cacheId);
    if (!lease)
      throw new CatalogError(
        "ARTIFACT_EXPIRED",
        "Pinned PCM bytes were evicted; retry waveform preparation",
        {},
        true,
      );
    let output: ReturnType<DerivedCache["reserve"]> | undefined;
    try {
      output = this.owners.cache.reserve(job.target);
      const bucketFrames = options.bucketFrames ?? Math.max(1, Math.ceil(audio.frames / 1024));
      const waveform = await waveformBuckets(lease, audio, { bucketFrames }, signal);
      signal.throwIfAborted();
      const description = metadata(audio),
        provenance = { jobId: options.audioJobId, generation: options.audioGeneration };
      const document = {
        ...description,
        ...waveform,
        units: {
          range: "microsecond",
          sampleRange: "sample-frame",
          amplitude: "linear",
          rms: "linear",
        },
        audio: provenance,
        generation: job.generation,
      };
      const bytes = Buffer.from(JSON.stringify(document) + "\n");
      if (bytes.length > 4 * 1024 * 1024)
        throw new CatalogError("LIMIT_EXCEEDED", "Waveform JSON exceeds 4 MiB");
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
        file: output.path,
        bytes: published.bytes,
        mediaType: "application/json",
        cacheId: output.id,
        bucketFrames,
        bucketCount: waveform.buckets.length,
        audio: provenance,
      } satisfies WaveformArtifact);
    } catch (error) {
      if (output) this.owners.cache.remove(output.id);
      throw error;
    } finally {
      lease.release();
    }
  }
}
