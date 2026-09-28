import { constants, openSync, closeSync, fstatSync, readSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { rangeSchema } from "@screenrec/composition";
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

/** Selected-source audio shares queue/cache delivery without inventing a recording revision. */
export class MediaAudioInspection {
  constructor(
    private readonly owners: {
      assets: AssetStore;
      acquisitions: AcquisitionStore;
      jobs: JobQueue;
      cache: DerivedCache;
      sourceRenderer: SourceAudioRenderer;
    },
  ) {
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
    return {
      source,
      options: {
        selection: source.selection,
        range: parsed.data,
        supportDigest: source.supportDigest,
        implementationId: this.owners.sourceRenderer.implementationId,
      },
    };
  }
  request(input: SourceAudioInput) {
    const { options } = this.plan(input);
    const { assets, acquisitions, jobs, cache } = this.owners;
    const status = submitCachedDerivative<SourceAudioArtifact>(
      jobs,
      cache,
      {
        target: { kind: "asset", assetId: options.selection.assetId },
        artifact,
        input: JSON.stringify(options),
      },
      "heavy",
      (job) => {
        const owner = { kind: "job" as const, id: job.jobId };
        assets.retain(owner, [options.selection.assetId]);
        if (options.selection.acquisitionId)
          acquisitions.retain(owner, [options.selection.acquisitionId]);
      },
    );
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
  retry(input: SourceAudioInput) {
    const current = this.request(input);
    if (current.jobId) this.owners.jobs.retry(current.jobId);
    return this.request(input);
  }
  async execute({ job, signal }: JobExecution): Promise<string> {
    let raw: unknown;
    try {
      raw = JSON.parse(job.input);
    } catch {
      throw new CatalogError("UNSUPPORTED_JOB", "Invalid audio job input");
    }
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
      checkWave(value);
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

/** Verify bounded RIFF metadata against the receipt without loading full extraction samples. */
function checkWave(value: SourceAudioResult) {
  const fd = openSync(value.file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size !== value.bytes)
      invalid("Audio output is not the reported regular file");
    const read = (at: number, size: number) => {
      const bytes = Buffer.alloc(size);
      if (readSync(fd, bytes, 0, size, at) !== size) invalid("Truncated WAV metadata");
      return bytes;
    };
    const header = read(0, 12);
    if (
      header.toString("ascii", 0, 4) !== "RIFF" ||
      header.toString("ascii", 8, 12) !== "WAVE" ||
      header.readUInt32LE(4) + 8 !== stat.size
    )
      invalid("Audio output is not a complete RIFF WAVE");
    let at = 12,
      format = false,
      data = false,
      chunks = 0;
    while (at < stat.size) {
      if (++chunks > 128 || at + 8 > stat.size) invalid("WAV chunk metadata exceeds its bounds");
      const chunk = read(at, 8),
        name = chunk.toString("ascii", 0, 4),
        size = chunk.readUInt32LE(4);
      at += 8;
      if (at + size + (size % 2) > stat.size) invalid("WAV chunk exceeds the file");
      if (name === "fmt ") {
        if (format || size < 16) invalid("WAV format is missing or repeated");
        const fmt = read(at, 16);
        if (
          fmt.readUInt16LE(0) !== 3 ||
          fmt.readUInt16LE(2) !== value.channels ||
          fmt.readUInt32LE(4) !== value.sampleRate ||
          fmt.readUInt32LE(8) !== value.sampleRate * value.channels * 4 ||
          fmt.readUInt16LE(12) !== value.channels * 4 ||
          fmt.readUInt16LE(14) !== 32
        )
          invalid("WAV format differs from the native receipt");
        format = true;
      } else if (name === "data") {
        if (data || BigInt(size) !== BigInt(value.frames) * BigInt(value.channels) * 4n)
          invalid("WAV sample count differs from its receipt");
        data = true;
      }
      at += size + (size % 2);
    }
    if (!format || !data) invalid("WAV format or samples are missing");
  } finally {
    closeSync(fd);
  }
}
