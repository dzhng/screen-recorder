import { join } from "node:path";
import { isSettled, type Recording, type RevisionStore } from "./library.js";
import { CatalogError } from "./catalog.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import { planAudioTracks } from "./audio.js";
import type { SourceAudioRead, SourceEvidenceMetadata } from "./evidence.js";
import { sourceArtifact, sourcePolicy, type SourceProcessing } from "./processing.js";
import type { TimeRange } from "./timeline.js";
import type { SpeechModels } from "./speech-models.js";
import {
  transcriptPolicy,
  type SpeechTranscriber,
  type TranscriptMetadata,
  type TranscriptStore,
} from "./transcript.js";
import { TranscriptRead, transcriptContinuation } from "./transcript-read.js";

const artifact = "transcript";

/** The model owner as transcription sees it: readiness, the verified file list and its pins. */
export type TranscriptionModels = Pick<
  SpeechModels,
  "status" | "nativeRequest" | "modelDigest" | "pins"
>;

type ReadInput = {
  recordingId: string;
  revisionId?: string | undefined;
  cursor?: unknown;
  limit?: number | undefined;
};

/**
 * Source narration becomes one heavy transcript per original recording and model digest. Edits never
 * retranscribe; reads project the pinned generation through the requested revision.
 */
export class TranscriptProcessing {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly transcripts: TranscriptStore,
    private readonly source: Pick<SourceProcessing, "status" | "prepare">,
    private readonly evidence: SourceAudioRead,
    private readonly models: TranscriptionModels,
    private readonly home: string,
    private readonly transcribe: SpeechTranscriber,
    private readonly retained?: (recordingId: string, generation: string) => boolean,
  ) {}

  /** Job identity; a different model digest is a different transcript, never a retry of this one. */
  private get input() {
    return `${transcriptPolicy}:${this.models.modelDigest}`;
  }

  private identity(recordingId: string) {
    return {
      target: { kind: "recording" as const, recordingId: recordingId, revisionId: "r0" },
      artifact,
      input: this.input,
    };
  }

  /** Planning with no spans reads only the header and whether narration was ever acquired. */
  private narration(recording: Recording, evidence: SourceEvidenceMetadata, spans: TimeRange[]) {
    return planAudioTracks(
      {
        recordingId: recording.recordingId,
        sourceId: recording.sourceId,
        sourceEvidence: evidence,
        spans,
        track: "narration",
      },
      this.evidence,
      (role) => join(this.home, "recordings", recording.recordingId, "source", `${role}.mov`),
    ).tracks[0];
  }

  status(recordingId: string) {
    const recording = this.store.get(recordingId);
    const identity = { recordingId, sourceId: recording.sourceId, sourceRevisionId: "r0" };
    const blocked = (
      state: string,
      reason: string | null,
      retryable: boolean,
      dependencies: {
        artifact: "source";
        state: string;
        reason: string | null;
        retryable: boolean;
        jobId: string | null;
      }[] = [],
    ) => ({ ...identity, state, reason, retryable, jobId: null, published: null, dependencies });
    if (!isSettled(recording.state))
      return blocked("not_requested", "capture_not_finalized", false);
    if (recording.state === "canceled" || recording.sourceDurationUs === null)
      return blocked("unavailable", "no_usable_video", false);
    const source = this.source.status(recordingId);
    if (!source.published)
      return blocked(source.state, source.reason, source.retryable, [
        {
          artifact: "source",
          state: source.state,
          reason: source.reason,
          retryable: source.retryable,
          jobId: source.jobId,
        },
      ]);
    if (!this.narration(recording, source.published.evidence, []))
      return blocked("unavailable", "no_narration", false);
    const status = this.jobs.status(this.identity(recordingId));
    // A published or attempted transcript stays visible; only starting one needs prepared models.
    if (status.state === "not_requested" && this.models.status().state !== "ready")
      return blocked("unavailable", "model_not_prepared", true);
    return {
      ...identity,
      state: status.state as string,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      published: status.published
        ? {
            generation: status.published.generation,
            transcript: JSON.parse(status.published.result) as TranscriptMetadata,
          }
        : null,
      dependencies: [],
    };
  }

  prepare(recordingId: string): void {
    this.source.prepare(recordingId);
    const status = this.status(recordingId);
    if (status.state === "not_requested" && status.reason === null && !status.dependencies.length)
      this.jobs.submit({ ...this.identity(recordingId), lane: "heavy" });
  }

  /** Background admission waits for prepared models and a published source, one take at a time. */
  resume(): void {
    if (this.models.status().state !== "ready") return;
    this.jobs.backfill(
      { artifact, input: this.input, lane: "heavy" },
      { artifact: sourceArtifact, input: sourcePolicy },
    );
  }

  retry(recordingId: string) {
    this.prepare(recordingId);
    const status = this.status(recordingId);
    if (!status.jobId)
      throw new CatalogError(
        status.reason === "model_not_prepared"
          ? "MODEL_NOT_PREPARED"
          : status.state === "unavailable"
            ? "UNAVAILABLE"
            : "NOT_READY",
        status.reason ?? "Transcript is not ready to start",
        { state: status.state, reason: status.reason, dependencies: status.dependencies },
        status.retryable,
      );
    if (
      ["failed", "unavailable", "canceled"].includes(this.jobs.job(status.jobId).state) &&
      this.models.status().state !== "ready"
    )
      throw new CatalogError("MODEL_NOT_PREPARED", "Speech models are not prepared", {}, true);
    this.jobs.retry(status.jobId);
    return this.status(recordingId);
  }

  /** Resolves the revision once and the published generation a continuation must still name. */
  private resolve(input: ReadInput) {
    const cursor = input.cursor === undefined ? undefined : transcriptContinuation(input.cursor);
    if (
      cursor &&
      (cursor.recordingId !== input.recordingId ||
        (input.revisionId !== undefined && input.revisionId !== cursor.revisionId))
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Transcript continuation belongs to another recording or revision",
      );
    const revision = this.store.revision(input.recordingId, input.revisionId ?? cursor?.revisionId);
    this.prepare(input.recordingId);
    const status = this.status(input.recordingId);
    if (!status.published) {
      if (cursor)
        throw new CatalogError("ARTIFACT_CHANGED", "Transcript generation is no longer published");
      return { status: { ...status, revisionId: revision.id, page: null } };
    }
    const transcript = status.published.transcript;
    return {
      reference: {
        recordingId: input.recordingId,
        sourceId: transcript.sourceId,
        revisionId: revision.id,
        generation: transcript.generation,
        state: "ready" as const,
      },
      transcript,
      read: new TranscriptRead(this.transcripts, transcript, revision),
    };
  }

  get(input: ReadInput & { range?: TimeRange | undefined }) {
    const target = this.resolve(input);
    if (target.status) return target.status;
    const page = target.read.page(input);
    return { ...target.reference, page: { transcript: target.transcript, ...page } };
  }

  search(input: ReadInput & { text: string }) {
    const target = this.resolve(input);
    if (target.status) return target.status;
    const page = target.read.search(input);
    return { ...target.reference, page: { transcript: target.transcript, ...page } };
  }

  async cleanup(signal: AbortSignal): Promise<void> {
    await this.store.forEachRecording(signal, ({ recordingId }) =>
      this.cleanupRecording(recordingId, signal),
    );
  }

  private cleanupRecording(recordingId: string, signal: AbortSignal) {
    return this.transcripts.reclaim(
      recordingId,
      (generation) =>
        this.jobs.retainsAttempt(
          { kind: "recording", recordingId: recordingId },
          artifact,
          generation,
        ) || !!this.retained?.(recordingId, generation),
      signal,
    );
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.target.kind !== "recording")
      throw new CatalogError("UNSUPPORTED_JOB", "Recording processing needs a recording target");
    if (job.artifact !== artifact || job.target.revisionId !== "r0" || job.input !== this.input)
      throw new CatalogError("UNSUPPORTED_JOB", "Transcript processor cannot execute this job");
    const recording = this.store.get(job.target.recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      throw new CatalogError("UNAVAILABLE", "no_usable_video");
    const source = this.source.status(job.target.recordingId).published;
    if (!source) throw new CatalogError("NOT_READY", "Source evidence is not published", {}, true);
    const track = this.narration(recording, source.evidence, [
      { startUs: 0, endUs: recording.sourceDurationUs },
    ]);
    if (!track?.available.length) throw new CatalogError("UNAVAILABLE", "no_narration");
    if (this.models.status().state !== "ready")
      throw new CatalogError("MODEL_NOT_PREPARED", "Speech models are not prepared", {}, true);
    await this.cleanupRecording(job.target.recordingId, signal);
    signal.throwIfAborted();
    const identity = {
      recordingId: job.target.recordingId,
      sourceId: recording.sourceId,
      generation: job.attemptId,
    };
    const output = await this.transcripts.reserve(identity);
    try {
      const request = {
        models: this.models.nativeRequest(),
        track: {
          source: track.source,
          sourceOffsetUs: track.sourceOffsetUs,
          available: track.available,
        },
        output,
      };
      const receipt = await this.transcribe(request, signal);
      signal.throwIfAborted();
      const metadata = await this.transcripts.ingest({
        identity,
        sourceGeneration: source.evidence.generation,
        request,
        receipt,
        pins: { ...this.models.pins, modelDigest: this.models.modelDigest },
        signal,
      });
      signal.throwIfAborted();
      return JSON.stringify(metadata);
    } catch (error) {
      await this.transcripts.remove(identity);
      throw error;
    }
  }
}
