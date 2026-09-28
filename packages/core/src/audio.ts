import { evidenceRecordingId } from "./evidence.js";
import { isAbsolute, join } from "node:path";
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
import { trimSpans, type TimeRange, type TimelineRevision } from "./timeline.js";
import type { SourceEvidenceMetadata, SourceAudioRead } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";

export type AudioRole = "narration" | "system";
export type AudioRequest = {
  revisionId?: string | undefined;
  range: TimeRange;
  track: AudioRole | "mix";
};
export type AudioInput = AudioRequest & { recordingId: string };
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
export type MaterializedAudio = NativeAudio & {
  recordingId: string;
  sourceId: string;
  revisionId: string;
  requestedPlaybackRange: TimeRange;
  selectedTrack: AudioInput["track"];
  missingRoles: MissingRole[];
  sourceEvidence: SourceEvidenceMetadata;
};
export type AudioArtifact = MaterializedAudio & { cacheId: string };
export type AudioOptions = {
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
    input.recordingId !== evidenceRecordingId(input.sourceEvidence) ||
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

export type AudioPlan = ReturnType<typeof planAudioExcerpt>;

/** One admission policy for library and retained-package excerpts. */
export abstract class AudioInspection<
  Target extends object,
  Artifact extends MaterializedAudio,
> extends DerivativeInspection<Target, Target & AudioRequest, "audio", Artifact> {
  constructor(backend: DerivativeBackend<Target>) {
    super(backend, "audio");
  }
  protected abstract plan(context: DerivativeContext<Target>, options: AudioOptions): AudioPlan;
  protected abstract submit(
    context: DerivativeContext<Target>,
    options: AudioOptions,
  ): DerivativeSubmission<Artifact>;

  request(input: Target & AudioRequest) {
    const context = this.backend.resolve(input);
    audioExcerptSpans(context.revision, input.range);
    validateTrack(input.track);
    return this.admit(context, this.backend.source(context), (evidence) => {
      const options: AudioOptions = {
        policy,
        range: { startUs: input.range.startUs, endUs: input.range.endUs },
        track: input.track,
        sourceEvidence: evidence,
      };
      // Reject absent roles before occupying a heavy worker slot.
      this.plan(context, options);
      return this.submit(context, options);
    });
  }
}

/** Native sample validation and output cleanup are identical for both storage backends. */
export async function renderAudio<Artifact extends MaterializedAudio>(
  options: AudioOptions,
  context: {
    recordingId: string;
    sourceId: string;
    revision: TimelineRevision;
    output: {
      file: string;
      publish(audio: MaterializedAudio): Promise<Artifact>;
      discard(cause: unknown): Promise<void>;
    };
  },
  dependencies: {
    evidence: SourceAudioRead;
    resolveSource: (role: AudioRole) => string;
    decode: AudioDecoder;
  },
  signal: AbortSignal,
): Promise<Artifact> {
  try {
    if (options.policy !== policy)
      throw new CatalogError("UNSUPPORTED_JOB", "Audio inspector cannot execute this job");
    const { spans, tracks, missingRoles } = planAudioExcerpt(
      {
        ...options,
        recordingId: context.recordingId,
        sourceId: context.sourceId,
        revision: context.revision,
      },
      dependencies.evidence,
      dependencies.resolveSource,
    );
    signal.throwIfAborted();
    const audio = await dependencies.decode({ tracks, spans, output: context.output.file }, signal);
    signal.throwIfAborted();
    const duration = options.range.endUs - options.range.startUs;
    if (
      audio.file !== context.output.file ||
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

    const result = await context.output.publish({
      ...audio,
      recordingId: context.recordingId,
      sourceId: context.sourceId,
      revisionId: context.revision.id,
      requestedPlaybackRange: options.range,
      selectedTrack: options.track,
      missingRoles,
      sourceEvidence: options.sourceEvidence,
    });
    signal.throwIfAborted();
    return result;
  } catch (error) {
    await context.output.discard(error);
    throw error;
  }
}

/** Library jobs and DerivedCache retain their durable recording ownership. */
export class LibraryAudioInspection extends AudioInspection<
  { recordingId: string },
  AudioArtifact
> {
  private readonly library: LibraryDerivatives;
  constructor(
    private readonly store: RevisionStore,
    jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly evidence: SourceAudioRead,
    processing: SourceProcessing,
    private readonly home: string,
    private readonly decode: AudioDecoder,
  ) {
    const library = new LibraryDerivatives(store, jobs, cache, processing);
    super(library);
    this.library = library;
  }
  private sourcePath(recordingId: string, role: AudioRole) {
    return join(this.home, "recordings", recordingId, "source", `${role}.mov`);
  }
  protected plan(context: DerivativeContext<{ recordingId: string }>, options: AudioOptions) {
    return planAudioExcerpt({ ...context, ...options }, this.evidence, (role) =>
      this.sourcePath(context.recordingId, role),
    );
  }
  protected submit(context: DerivativeContext<{ recordingId: string }>, options: AudioOptions) {
    return this.library.submit<AudioArtifact>(
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
    if (job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Audio inspector cannot execute this job");
    const target = job.target;
    const options = JSON.parse(job.input) as AudioOptions;
    const revision = this.store.revision(job.target.recordingId, job.target.revisionId);
    const sourceId = this.store.get(job.target.recordingId).sourceId;
    const output = this.cache.reserve({ kind: "recording", recordingId: job.target.recordingId });
    const result = await renderAudio(
      options,
      {
        recordingId: job.target.recordingId,
        sourceId,
        revision,
        output: {
          file: output.path,
          publish: async (audio) => {
            const cached = await this.cache.publish(output.id);
            if (cached.bytes !== audio.bytes)
              throw new CatalogError(
                "INVALID_RESPONSE",
                "Audio byte count does not match its file",
              );
            return { ...audio, bytes: cached.bytes, cacheId: cached.id };
          },
          discard: async () => {
            this.cache.remove(output.id);
          },
        },
      },
      {
        evidence: this.evidence,
        resolveSource: (role) => this.sourcePath(target.recordingId, role),
        decode: this.decode,
      },
      signal,
    );
    return JSON.stringify(result);
  }
}
