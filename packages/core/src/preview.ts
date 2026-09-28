import { evidenceRecordingId } from "./evidence.js";
import { join } from "node:path";
import { type RevisionStore } from "./library.js";
import { CatalogError } from "./catalog.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import {
  DerivativeInspection,
  LibraryDerivatives,
  type DerivativeBackend,
  type DerivativeContext,
  type DerivativeSubmission,
} from "./derivative-inspection.js";
import type { DerivedCache } from "./cache.js";
import type { SourceAudioRead, SourceEvidenceMetadata } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import { planAudioTracks, type AudioTrackPlan, type NativeAudio } from "./audio.js";
import { renderPlan, type RenderSpan, type TimelineRevision } from "./timeline.js";

/**
 * A preview auditions an edit, so it is rendered as a bounded rendition rather than at the
 * capture's own resolution: on a Retina screen that is about a quarter of the pixels, and
 * encoding is what preview time is spent on. The same bound the public image contract uses,
 * so one number describes "what this product shows you rather than gives you".
 * The human video export asks for the `source` rendition and keeps every captured pixel.
 */
export const previewPolicy = Object.freeze({ id: "movie-preview-v3", maxLongEdge: 1600 });
export type PreviewRendition = "preview" | "source";
export type PreviewInput = { recordingId: string; revisionId?: string | undefined };
/** What any preview request carries, whichever media it names. */
export type PreviewRequest = {
  revisionId?: string | undefined;
  sourceEvidence?: SourceEvidenceMetadata;
  rendition?: PreviewRendition;
};
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
    /** The rendition's long-edge bound, or null to render at the source's own resolution. */
    maxLongEdge: number | null;
  },
  signal: AbortSignal,
) => Promise<RenderedMovie>;
export type PreviewArtifact = RenderedMovie & {
  /** What the movie was rendered under, so a client can tell a rendition from the capture. */
  maxLongEdge: number | null;
  cacheId: string;
  recordingId: string;
  sourceId: string;
  revisionId: string;
  sourceEvidence: SourceEvidenceMetadata;
  missingRoles: ReturnType<typeof planAudioTracks>["missingRoles"];
};
const artifact = "preview";
export type PreviewOptions = {
  policy: string;
  rendition: PreviewRendition;
  sourceEvidence: SourceEvidenceMetadata;
};
/** The rendition is part of the job identity, so the two never share one cached movie. */
const boundFor = (rendition: PreviewRendition) =>
  rendition === "preview" ? previewPolicy.maxLongEdge : null;

/**
 * What a preview is, wherever its media lives: one pinned rendition of one revision, admitted only
 * once the source evidence it is aimed by is ready. A library preview renders this person's own
 * recording; a package preview renders the copy inside an archive they were handed. Only where the
 * work is submitted differs, which is the one thing a backend supplies.
 */
export abstract class PreviewInspectionBase<
  Target extends object,
  Artifact,
> extends DerivativeInspection<Target, Target & PreviewRequest, "preview", Artifact> {
  constructor(backend: DerivativeBackend<Target>) {
    super(backend, "preview");
  }

  protected abstract submit(
    context: DerivativeContext<Target>,
    options: PreviewOptions,
  ): DerivativeSubmission<Artifact>;

  request(input: Target & PreviewRequest) {
    const context = this.backend.resolve(input);
    const source = input.sourceEvidence
      ? {
          state: "ready" as const,
          reason: null,
          retryable: false,
          jobId: null,
          evidence: input.sourceEvidence,
        }
      : this.backend.source(context);
    return this.admit(context, source, (evidence) => {
      if (
        evidenceRecordingId(evidence) !== context.recordingId ||
        evidence.sourceId !== context.sourceId
      )
        throw new CatalogError("INVALID_EVIDENCE", "Preview evidence belongs to another source");
      return this.submit(context, {
        policy: previewPolicy.id,
        rendition: input.rendition ?? "preview",
        sourceEvidence: evidence,
      });
    });
  }
}

/**
 * Whether a renderer answered with the movie that was asked for. A rendition that ignored its
 * bound, or that came back as something other than the pinned edit, is refused rather than
 * published: this is what stands between a native receipt and somebody's library.
 */
export function checkRenderedPreview(
  movie: Omit<RenderedMovie, "audio">,
  expected: { file: string; durationUs: number; maxLongEdge: number | null },
): void {
  if (
    movie.file !== expected.file ||
    movie.mediaType !== "video/mp4" ||
    movie.codec !== "h264" ||
    movie.durationUs !== expected.durationUs ||
    ![movie.width, movie.height, movie.frameCount, movie.bytes].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new CatalogError("INVALID_RESPONSE", "Renderer returned an unrelated preview");
  // The movie's own dimensions are the receipt: a bounded rendition is whatever the source scaled
  // down to, but it cannot be larger than what was asked for, nor an odd size H.264 cannot encode.
  if (
    expected.maxLongEdge !== null &&
    (Math.max(movie.width, movie.height) > expected.maxLongEdge ||
      movie.width % 2 !== 0 ||
      movie.height % 2 !== 0)
  )
    throw new CatalogError(
      "INVALID_RESPONSE",
      `Preview is ${movie.width}x${movie.height}, not the rendition bounded to ${expected.maxLongEdge}`,
    );
}

/** The long edge a rendition renders to, or null for the capture's own resolution. */
export const previewBoundFor = boundFor;

/** One pinned derivative under the existing job/cache authorities. The renderer owns
 * native execution and must leave its complete output in the reserved cache file. */
export class PreviewInspection extends PreviewInspectionBase<
  { recordingId: string },
  PreviewArtifact
> {
  private readonly library: LibraryDerivatives;
  constructor(
    private readonly store: RevisionStore,
    jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly evidence: SourceAudioRead,
    processing: SourceProcessing,
    private readonly home: string,
    private readonly render: PreviewRenderer,
  ) {
    const library = new LibraryDerivatives(store, jobs, cache, processing);
    super(library);
    this.library = library;
  }

  /** Exports pass the source evidence their intent already pinned, and the full rendition. */
  protected submit(context: DerivativeContext<{ recordingId: string }>, options: PreviewOptions) {
    return this.library.submit<PreviewArtifact>(
      {
        target: {
          kind: "recording" as const,
          recordingId: context.recordingId,
          revisionId: context.revision.id,
        },

        artifact,
        input: JSON.stringify(options),
      },
      "heavy",
    );
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.target.kind !== "recording")
      throw new CatalogError("UNSUPPORTED_JOB", "Recording processing needs a recording target");
    const options = JSON.parse(job.input) as PreviewOptions;
    if (
      job.artifact !== artifact ||
      options.policy !== previewPolicy.id ||
      !["preview", "source"].includes(options.rendition)
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Preview cannot execute this job");
    const maxLongEdge = boundFor(options.rendition);
    const revision = this.store.revision(job.target.recordingId, job.target.revisionId);
    const sourceId = this.store.get(job.target.recordingId).sourceId;
    const directory = join(this.home, "recordings", job.target.recordingId, "source");
    const { tracks, missingRoles } = planAudioTracks(
      {
        recordingId: job.target.recordingId,
        sourceId,
        sourceEvidence: options.sourceEvidence,
        spans: revision.spans,
        track: "mix",
      },
      this.evidence,
      (role) => join(directory, `${role}.mov`),
    );
    signal.throwIfAborted();
    const output = this.cache.reserve({ kind: "recording", recordingId: job.target.recordingId });
    try {
      const movie = await this.render(
        {
          source: join(directory, "video.mov"),
          revision,
          sourceEvidence: options.sourceEvidence,
          plan: renderPlan(revision),
          tracks,
          output: output.path,
          maxLongEdge,
        },
        signal,
      );
      signal.throwIfAborted();
      checkRenderedPreview(movie, {
        file: output.path,
        durationUs: revision.durationUs,
        maxLongEdge,
      });
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== movie.bytes)
        throw new CatalogError("INVALID_RESPONSE", "Preview byte count does not match its file");
      const result: PreviewArtifact = {
        ...movie,
        maxLongEdge,
        cacheId: output.id,
        recordingId: job.target.recordingId,
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
