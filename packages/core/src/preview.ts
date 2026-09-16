import { join } from "node:path";
import { CatalogError, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import type { SourceAudioRead, SourceEvidenceMetadata } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import { planAudioTracks, type AudioTrackPlan, type NativeAudio } from "./audio.js";
import { renderPlan, type RenderSpan, type TimelineRevision } from "./timeline.js";

export type PreviewInput = { recordingId: string; revisionId?: string | undefined };
export type RenderedMovie = {
  file: string;
  mediaType: "video/mp4";
  codec: "h264";
  durationUs: number;
  width: number;
  height: number;
  frameCount: number;
  bytes: number;
  audio?: {
    codec?: "aac";
    frames: number;
    sampleRate: number;
    channels: number;
    tracks: NativeAudio["tracks"];
  };
};
export type PreviewRenderer = (
  request: {
    source: string;
    revision: TimelineRevision;
    sourceEvidence: SourceEvidenceMetadata;
    plan: readonly RenderSpan[];
    tracks: readonly AudioTrackPlan[];
    output: string;
  },
  signal: AbortSignal,
) => Promise<RenderedMovie>;
export type PreviewArtifact = RenderedMovie & {
  cacheId: string;
  recordingId: string;
  sourceId: string;
  revisionId: string;
  sourceEvidence: SourceEvidenceMetadata;
  missingRoles: ReturnType<typeof planAudioTracks>["missingRoles"];
};
const artifact = "preview",
  policy = "movie-preview-v1";
type Options = { policy: string; sourceEvidence: SourceEvidenceMetadata };

/** One pinned derivative under the existing job/cache authorities. The renderer owns
 * native execution and must leave its complete output in the reserved cache file. */
export class PreviewInspection {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly evidence: SourceAudioRead,
    private readonly processing: SourceProcessing,
    private readonly home: string,
    private readonly render: PreviewRenderer,
  ) {}

  request(input: PreviewInput) {
    const revision = this.store.revision(input.recordingId, input.revisionId);
    if (!revision.durationUs)
      throw new CatalogError("UNAVAILABLE", "Revision has no retained video");
    this.processing.prepare(input.recordingId);
    const source = this.processing.status(input.recordingId);
    const identity = {
      recordingId: input.recordingId,
      sourceId: source.sourceId,
      revisionId: revision.id,
    };
    if (source.state !== "ready" || !source.published)
      return {
        ...identity,
        state: source.state,
        reason: source.reason,
        retryable: source.retryable,
        jobId: null,
        published: null,
        dependency: { artifact: "source" as const, jobId: source.jobId },
      };
    const options: Options = { policy, sourceEvidence: source.published.evidence };
    const jobIdentity = {
      recordingId: input.recordingId,
      revisionId: revision.id,
      artifact,
      input: JSON.stringify(options),
    };
    this.jobs.submit({ ...jobIdentity, lane: "heavy" });
    let status = this.jobs.status(jobIdentity);
    if (status.published) {
      const result = JSON.parse(status.published.result) as PreviewArtifact;
      const read = this.cache.acquire(result.cacheId);
      if (read) read.release();
      else {
        this.jobs.regenerate(status.jobId!, status.published.generation);
        status = this.jobs.status(jobIdentity);
      }
    }
    return {
      ...identity,
      ...status,
      dependency: null,
      published: status.published
        ? {
            generation: status.published.generation,
            preview: JSON.parse(status.published.result) as PreviewArtifact,
          }
        : null,
    };
  }

  retry(input: PreviewInput) {
    const status = this.request(input);
    if (status.jobId) this.jobs.retry(status.jobId);
    return this.request({ ...input, revisionId: status.revisionId });
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    const options = JSON.parse(job.input) as Options;
    if (job.artifact !== artifact || options.policy !== policy)
      throw new CatalogError("UNSUPPORTED_JOB", "Preview cannot execute this job");
    const revision = this.store.revision(job.recordingId, job.revisionId);
    const sourceId = this.store.get(job.recordingId).sourceId;
    const directory = join(this.home, "recordings", job.recordingId, "source");
    const { tracks, missingRoles } = planAudioTracks(
      {
        recordingId: job.recordingId,
        sourceId,
        sourceEvidence: options.sourceEvidence,
        spans: revision.spans,
        track: "mix",
      },
      this.evidence,
      (role) => join(directory, `${role}.mov`),
    );
    signal.throwIfAborted();
    const output = this.cache.reserve(job.recordingId);
    try {
      const movie = await this.render(
        {
          source: join(directory, "video.mov"),
          revision,
          sourceEvidence: options.sourceEvidence,
          plan: renderPlan(revision),
          tracks,
          output: output.path,
        },
        signal,
      );
      signal.throwIfAborted();
      if (
        movie.file !== output.path ||
        movie.mediaType !== "video/mp4" ||
        movie.codec !== "h264" ||
        movie.durationUs !== revision.durationUs ||
        ![movie.width, movie.height, movie.frameCount, movie.bytes].every(
          (value) => Number.isSafeInteger(value) && value > 0,
        )
      )
        throw new CatalogError("INVALID_RESPONSE", "Renderer returned an unrelated preview");
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== movie.bytes)
        throw new CatalogError("INVALID_RESPONSE", "Preview byte count does not match its file");
      const result: PreviewArtifact = {
        ...movie,
        cacheId: output.id,
        recordingId: job.recordingId,
        sourceId,
        revisionId: revision.id,
        sourceEvidence: options.sourceEvidence,
        missingRoles,
      };
      return JSON.stringify(result);
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  }
}
