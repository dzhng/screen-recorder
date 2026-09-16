import { join } from "node:path";
import { CatalogError, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { editedToSource, sourceToEdited, type TimeRange } from "./timeline.js";

export type FrameCrop = { x: number; y: number; width: number; height: number };
export type FrameInput = {
  recordingId: string;
  revisionId?: string;
  atUs: number;
  clean: true;
  crop?: FrameCrop;
  maxLongEdge?: number;
};
export type NativeFrame = {
  file: string;
  mediaType: string;
  requestedSourceUs: number;
  actualSourceUs: number;
  distanceUs: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  crop?: FrameCrop | null;
  bytes: number;
};
export type FrameDecoder = (
  request: {
    source: string;
    output: string;
    atSourceUs: number;
    kept: TimeRange;
    crop?: FrameCrop;
    maxLongEdge: number;
  },
  signal: AbortSignal,
) => Promise<NativeFrame>;
export type FrameArtifact = NativeFrame & {
  cacheId: string;
  recordingId: string;
  sourceId: string;
  revisionId: string;
  requestedPlaybackUs: number;
  actualPlaybackUs: number;
  kept: TimeRange;
  clean: true;
};
const artifact = "frame";
const policy = "clean-frame-v1";

/** Pins edits once; the native decoder only sees the resulting retained source interval. */
export class FrameInspection {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly home: string,
    private readonly decode: FrameDecoder,
  ) {}

  request(input: FrameInput) {
    const revision = this.store.revision(input.recordingId, input.revisionId);
    const mapped = editedToSource(revision, input.atUs);
    if (!mapped) throw new CatalogError("INVALID_RANGE", "Frame time is outside this revision");
    const maxLongEdge = input.maxLongEdge ?? 1600;
    if (
      input.clean !== true ||
      !Number.isSafeInteger(maxLongEdge) ||
      maxLongEdge < 1 ||
      maxLongEdge > 8192
    )
      throw new CatalogError("INVALID_RANGE", "Invalid clean frame options");
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
    const identity = {
      recordingId: input.recordingId,
      revisionId: revision.id,
      artifact,
      input: JSON.stringify({
        policy,
        atUs: input.atUs,
        maxLongEdge,
        crop: crop ? { x: crop.x, y: crop.y, width: crop.width, height: crop.height } : null,
      }),
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
      recordingId: input.recordingId,
      sourceId: this.store.get(input.recordingId).sourceId,
      revisionId: revision.id,
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
    const options = JSON.parse(job.input) as {
      policy: string;
      atUs: number;
      maxLongEdge: number;
      crop: FrameCrop | null;
    };
    if (job.artifact !== artifact || options.policy !== policy)
      throw new CatalogError("UNSUPPORTED_JOB", "Frame inspector cannot execute this job");
    const revision = this.store.revision(job.recordingId, job.revisionId);
    const mapped = editedToSource(revision, options.atUs);
    if (!mapped)
      throw new CatalogError("INVALID_RANGE", "Frame time is outside the pinned revision");
    signal.throwIfAborted();
    const output = this.cache.reserve();
    try {
      const frame = await this.decode(
        {
          source: join(this.home, "recordings", job.recordingId, "source", "video.mov"),
          output: output.path,
          atSourceUs: mapped.sourceUs,
          kept: mapped.span.source,
          maxLongEdge: options.maxLongEdge,
          ...(options.crop ? { crop: options.crop } : {}),
        },
        signal,
      );
      signal.throwIfAborted();
      if (
        !Number.isSafeInteger(frame.actualSourceUs) ||
        frame.actualSourceUs < mapped.span.source.startUs ||
        frame.actualSourceUs >= mapped.span.source.endUs
      )
        throw new CatalogError(
          "INVALID_RESPONSE",
          "Decoder returned a frame outside the retained interval",
        );
      const actualPlaybackUs = sourceToEdited(revision, frame.actualSourceUs);
      if (actualPlaybackUs === null || frame.file !== output.path)
        throw new CatalogError("INVALID_RESPONSE", "Decoder returned an unrelated frame");
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      const result: FrameArtifact = {
        ...frame,
        bytes: cached.bytes,
        cacheId: cached.id,
        recordingId: job.recordingId,
        sourceId: this.store.get(job.recordingId).sourceId,
        revisionId: revision.id,
        requestedPlaybackUs: options.atUs,
        actualPlaybackUs,
        kept: mapped.span.source,
        clean: true,
      };
      return JSON.stringify(result);
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  }
}
