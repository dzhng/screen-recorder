import { isAbsolute, join } from "node:path";
import { CatalogError, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import { trimSpans, type TimeRange, type TimelineRevision } from "./timeline.js";
import type { SourceEvidenceMetadata, SourceAudioRead } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";

export type AudioRole = "narration" | "system";
export type AudioInput = {
  recordingId: string;
  revisionId?: string | undefined;
  range: TimeRange;
  track: AudioRole | "mix";
};
export type AudioTrackPlan = {
  role: AudioRole;
  source: string;
  sourceOffsetUs: number;
  available: TimeRange[];
};
export type NativeAudio = {
  file: string;
  mediaType: string;
  sampleRate: number;
  channels: number;
  frames: number;
  durationUs: number;
  bytes: number;
  spans: TimeRange[];
  tracks: {
    role: AudioRole;
    gain: number;
    sampleRate: number;
    channels: number;
    unavailable: TimeRange[];
  }[];
};
export type AudioDecoder = (
  request: { tracks: AudioTrackPlan[]; spans: readonly TimeRange[]; output: string },
  signal: AbortSignal,
) => Promise<NativeAudio>;
type MissingRole = { role: AudioRole; reason: "not_requested" | "not_acquired" };
export type AudioArtifact = NativeAudio & {
  cacheId: string;
  recordingId: string;
  sourceId: string;
  revisionId: string;
  requestedPlaybackRange: TimeRange;
  selectedTrack: AudioInput["track"];
  missingRoles: MissingRole[];
  sourceEvidence: SourceEvidenceMetadata;
};
type Options = {
  policy: string;
  range: TimeRange;
  track: AudioInput["track"];
  sourceEvidence: SourceEvidenceMetadata;
};
const artifact = "audio";
const policy = "audio-excerpt-v1";

function validateTrack(track: AudioInput["track"]): void {
  if (!["narration", "system", "mix"].includes(track))
    throw new CatalogError("INVALID_RANGE", "Unknown audio track selection");
}

function audioExcerptSpans(revision: TimelineRevision, range: TimeRange) {
  const spans = trimSpans(revision, range);
  if (range.endUs - range.startUs > 30_000_000 || spans.length > 1000)
    throw new CatalogError(
      "LIMIT_EXCEEDED",
      "Audio excerpts are limited to thirty seconds and 1000 source spans",
    );
  return spans;
}

type AudioSourceInput = {
  recordingId: string;
  sourceId: string;
  sourceEvidence: SourceEvidenceMetadata;
};

/** Public excerpts retain their inspection limits and require an acquired track. */
export function planAudioExcerpt(
  input: AudioSourceInput & {
    revision: TimelineRevision;
    range: TimeRange;
    track: AudioInput["track"];
  },
  evidence: SourceAudioRead,
  resolveSource: (role: AudioRole) => string,
) {
  const spans = audioExcerptSpans(input.revision, input.range);
  const result = planAudioTracks(
    { ...input, spans, track: input.track },
    evidence,
    resolveSource,
    1000,
  );
  if (!result.tracks.length)
    throw new CatalogError("UNAVAILABLE", "Selected audio was not acquired", {
      missingRoles: result.missingRoles,
    });
  return { spans, ...result };
}

/** Acquisition truth for excerpts and complete movies, including genuinely absent tracks.
 * Spans come from the shared timeline; callers own asset containment and request-size limits. */
export function planAudioTracks(
  input: AudioSourceInput & {
    spans: readonly TimeRange[];
    track: AudioInput["track"];
  },
  evidence: SourceAudioRead,
  resolveSource: (role: AudioRole) => string,
  maximumIntervals = 10_000,
) {
  const { spans, track } = input;
  if (
    input.recordingId !== input.sourceEvidence.recordingId ||
    input.sourceId !== input.sourceEvidence.sourceId
  )
    throw new CatalogError("INVALID_EVIDENCE", "Audio evidence belongs to another source");
  validateTrack(track);
  const metadata = input.sourceEvidence;
  const header = metadata.receipt.header;
  const selected: AudioRole[] = track === "mix" ? ["narration", "system"] : [track];
  const tracks: AudioTrackPlan[] = [],
    missingRoles: MissingRole[] = [];
  for (const role of selected) {
    const requested = header?.[role === "narration" ? "microphone" : "systemAudio"];
    if (typeof requested !== "boolean")
      throw new CatalogError("INVALID_EVIDENCE", "Source evidence has no audio selection header");
    if (!requested) {
      missingRoles.push({ role, reason: "not_requested" });
      continue;
    }
    if (!evidence.hasAudio(metadata, role)) {
      missingRoles.push({ role, reason: "not_acquired" });
      continue;
    }
    const available: TimeRange[] = [];
    for (const span of spans) {
      available.push(...evidence.audio(metadata, role, span));
      if (available.length > maximumIntervals)
        throw new CatalogError("LIMIT_EXCEEDED", "Too many acquired intervals in retained audio");
    }
    const source = resolveSource(role);
    if (!isAbsolute(source))
      throw new CatalogError("INVALID_PATH", "Resolved audio source must be absolute");
    tracks.push({
      role,
      source,
      sourceOffsetUs: 0,
      available,
    });
  }
  return { tracks, missingRoles };
}

/** Core owns edit projection and acquisition evidence; native owns samples, mixing and WAVE output. */
export class AudioInspection {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly evidence: SourceAudioRead,
    private readonly processing: SourceProcessing,
    private readonly home: string,
    private readonly decode: AudioDecoder,
  ) {}

  request(input: AudioInput) {
    const revision = this.store.revision(input.recordingId, input.revisionId);
    audioExcerptSpans(revision, input.range);
    validateTrack(input.track);
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
    const options: Options = {
      policy,
      range: { startUs: input.range.startUs, endUs: input.range.endUs },
      track: input.track,
      sourceEvidence: source.published.evidence,
    };
    // Refuse absent roles before admission, without consuming an audio worker for an impossible plan.
    planAudioExcerpt(
      { ...input, sourceId: source.sourceId, revision, sourceEvidence: options.sourceEvidence },
      this.evidence,
      (role) => join(this.home, "recordings", input.recordingId, "source", `${role}.mov`),
    );
    const jobIdentity = {
      recordingId: input.recordingId,
      revisionId: revision.id,
      artifact,
      input: JSON.stringify(options),
    };
    this.jobs.submit({ ...jobIdentity, lane: "heavy" });
    let status = this.jobs.status(jobIdentity);
    if (status.published) {
      const audio = JSON.parse(status.published.result) as AudioArtifact;
      const read = this.cache.acquire(audio.cacheId);
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
            audio: JSON.parse(status.published.result) as AudioArtifact,
          }
        : null,
    };
  }

  retry(input: AudioInput) {
    const status = this.request(input);
    if (status.jobId) this.jobs.retry(status.jobId);
    return this.request({ ...input, revisionId: status.revisionId });
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    const options = JSON.parse(job.input) as Options;
    if (job.artifact !== artifact || options.policy !== policy)
      throw new CatalogError("UNSUPPORTED_JOB", "Audio inspector cannot execute this job");
    const revision = this.store.revision(job.recordingId, job.revisionId);
    const { spans, tracks, missingRoles } = planAudioExcerpt(
      {
        ...options,
        revision,
        recordingId: job.recordingId,
        sourceId: this.store.get(job.recordingId).sourceId,
      },
      this.evidence,
      (role) => join(this.home, "recordings", job.recordingId, "source", `${role}.mov`),
    );
    signal.throwIfAborted();
    const output = this.cache.reserve(job.recordingId);
    try {
      const audio = await this.decode({ tracks, spans, output: output.path }, signal);
      signal.throwIfAborted();
      const duration = options.range.endUs - options.range.startUs;
      if (
        audio.file !== output.path ||
        audio.mediaType !== "audio/wav" ||
        !Number.isSafeInteger(audio.sampleRate) ||
        audio.sampleRate < 1 ||
        audio.sampleRate > 192000 ||
        !Number.isSafeInteger(audio.channels) ||
        audio.channels < 1 ||
        audio.channels > 2 ||
        !Number.isSafeInteger(audio.frames) ||
        audio.frames < 0 ||
        !Number.isSafeInteger(audio.durationUs) ||
        audio.durationUs < 0 ||
        !Number.isSafeInteger(audio.bytes) ||
        audio.bytes < 1 ||
        audio.bytes > 48 * 1024 ** 2 ||
        Math.abs(audio.durationUs - duration) > Math.ceil(1_000_000 / audio.sampleRate) ||
        Math.abs(audio.durationUs - (audio.frames * 1_000_000) / audio.sampleRate) > 1 ||
        audio.spans.length !== spans.length ||
        audio.spans.some(
          (span, index) =>
            span.startUs !== spans[index]!.startUs || span.endUs !== spans[index]!.endUs,
        ) ||
        audio.tracks.length !== tracks.length ||
        audio.tracks.some(
          (track, index) =>
            track.role !== tracks[index]!.role ||
            track.gain !== (tracks.length === 1 ? 1 : 0.5) ||
            !Number.isSafeInteger(track.sampleRate) ||
            track.sampleRate < 1 ||
            track.sampleRate > 192000 ||
            !Number.isSafeInteger(track.channels) ||
            track.channels < 1 ||
            track.channels > 2 ||
            track.unavailable.some(
              (gap) =>
                !Number.isSafeInteger(gap.startUs) ||
                !Number.isSafeInteger(gap.endUs) ||
                gap.startUs >= gap.endUs ||
                !spans.some((span) => gap.startUs >= span.startUs && gap.endUs <= span.endUs),
            ),
        )
      )
        throw new CatalogError("INVALID_RESPONSE", "Decoder returned an unrelated audio excerpt");
      const cached = await this.cache.publish(output.id);
      signal.throwIfAborted();
      if (cached.bytes !== audio.bytes)
        throw new CatalogError("INVALID_RESPONSE", "Audio byte count does not match its file");
      const result: AudioArtifact = {
        ...audio,
        bytes: cached.bytes,
        cacheId: cached.id,
        recordingId: job.recordingId,
        sourceId: options.sourceEvidence.sourceId,
        revisionId: revision.id,
        requestedPlaybackRange: options.range,
        selectedTrack: options.track,
        missingRoles,
        sourceEvidence: options.sourceEvidence,
      };
      return JSON.stringify(result);
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  }
}
