import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { selectSource, sourceSelectionSchema, type SourceSelection } from "./source-selection.js";
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
  recordingTranscript,
  type SpeechTranscriber,
  type RecordingTranscriptMetadata,
  type TranscriptStore,
  type TranscriptIdentity,
  type TranscriptSource,
  type TranscriptMetadata,
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

type RecordingDomain = {
  store: RevisionStore;
  source: Pick<SourceProcessing, "status" | "prepare">;
  evidence: SourceAudioRead;
  home: string;
  retained?: ((recordingId: string, generation: string) => boolean) | undefined;
};
type AssetDomain = { assets: AssetStore; acquisitions: AcquisitionStore };
export type TranscriptProcessingOptions = {
  jobs: JobQueue;
  transcripts: TranscriptStore;
  models: TranscriptionModels;
  transcribe: SpeechTranscriber;
  recording?: RecordingDomain;
  asset?: AssetDomain;
};
function selectedAudio(domain: AssetDomain, selection: SourceSelection) {
  const selected = selectSource(domain.assets, domain.acquisitions, selection);
  if (selected.stream.kind !== "audio")
    throw new CatalogError("UNSUPPORTED_MEDIA", "Transcription requires an audio stream");
  return selected;
}
function sourceDescriptor(selected: ReturnType<typeof selectedAudio>): TranscriptSource {
  return {
    kind: "asset",
    streamId: selected.selection.streamId,
    ...(selected.selection.acquisitionId === undefined
      ? {}
      : { acquisitionId: selected.selection.acquisitionId }),
    supportDigest: selected.supportDigest,
    durationUs: selected.durationUs,
  };
}
export function assetTranscriptOwner(assets: AssetStore, acquisitions: AcquisitionStore) {
  return (identity: TranscriptIdentity, source: TranscriptSource): void => {
    if (
      identity.owner.kind !== "asset" ||
      source.kind !== "asset" ||
      identity.sourceId !== identity.owner.assetId
    )
      throw new CatalogError("INVALID_EVIDENCE", "Asset transcript requires an asset source");
    const selected = selectedAudio(
      { assets, acquisitions },
      {
        assetId: identity.owner.assetId,
        streamId: source.streamId,
        ...(source.acquisitionId === undefined ? {} : { acquisitionId: source.acquisitionId }),
      },
    );
    if (!isDeepStrictEqual(sourceDescriptor(selected), source))
      throw new CatalogError("ARTIFACT_CHANGED", "Transcript source support changed");
  };
}

/** Source transcripts share one queue, model owner and raw indexer across actual source domains. */
export class TranscriptProcessing {
  private readonly jobs: JobQueue;
  private readonly transcripts: TranscriptStore;
  private readonly models: TranscriptionModels;
  private readonly transcribe: SpeechTranscriber;
  constructor(private readonly options: TranscriptProcessingOptions) {
    ({
      jobs: this.jobs,
      transcripts: this.transcripts,
      models: this.models,
      transcribe: this.transcribe,
    } = options);
  }
  private get recording() {
    if (!this.options.recording)
      throw new CatalogError("UNSUPPORTED_JOB", "Recording transcription is unavailable");
    return this.options.recording;
  }
  private get asset() {
    if (!this.options.asset)
      throw new CatalogError("UNSUPPORTED_JOB", "Asset transcription is unavailable");
    return this.options.asset;
  }

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
      this.recording.evidence,
      (role) =>
        join(this.recording.home, "recordings", recording.recordingId, "source", `${role}.mov`),
    ).tracks[0];
  }

  status(recordingId: string) {
    const recording = this.recording.store.get(recordingId);
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
    const source = this.recording.source.status(recordingId);
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
            transcript: JSON.parse(status.published.result) as RecordingTranscriptMetadata,
          }
        : null,
      dependencies: [],
    };
  }

  prepare(recordingId: string): void {
    this.recording.source.prepare(recordingId);
    const status = this.status(recordingId);
    if (status.state === "not_requested" && status.reason === null && !status.dependencies.length)
      this.jobs.submit({ ...this.identity(recordingId), lane: "heavy" });
  }

  /** Background admission waits for prepared models and a published source, one take at a time. */
  resume(): void {
    if (!this.options.recording || this.models.status().state !== "ready") return;
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

  private sourceIdentity(selected: ReturnType<typeof selectedAudio>) {
    return {
      target: { kind: "asset" as const, assetId: selected.selection.assetId },
      artifact,
      input: JSON.stringify({
        selection: selected.selection,
        source: sourceDescriptor(selected),
        modelDigest: this.models.modelDigest,
        pins: this.models.pins,
        policy: transcriptPolicy,
      }),
    };
  }

  sourceStatus(selection: SourceSelection) {
    const selected = selectedAudio(this.asset, selection);
    const status = this.jobs.status(this.sourceIdentity(selected));
    const models = this.models.status();
    const reason = !selected.track.available.length
      ? "no_audio"
      : status.state === "not_requested" && models.state !== "ready"
        ? "model_not_prepared"
        : null;
    return {
      ...selected.selection,
      state: reason ? "unavailable" : status.state,
      reason: reason ?? status.reason,
      retryable: reason ? reason === "model_not_prepared" : status.retryable,
      jobId: reason ? null : status.jobId,
      published:
        reason || !status.published
          ? null
          : {
              generation: status.published.generation,
              transcript: JSON.parse(status.published.result) as TranscriptMetadata,
            },
      models,
      dependencies: [],
    };
  }

  prepareSource(selection: SourceSelection): void {
    const status = this.sourceStatus(selection);
    if (status.state !== "not_requested" || status.reason !== null) return;
    this.jobs.submit(
      () => ({ ...this.sourceIdentity(selectedAudio(this.asset, selection)), lane: "heavy" }),
      (job) => {
        const owner = { kind: "job" as const, id: job.jobId };
        this.asset.assets.retain(owner, [selection.assetId]);
        if (selection.acquisitionId !== undefined)
          this.asset.acquisitions.retain(owner, [selection.acquisitionId]);
      },
    );
  }

  publishedSource(selection: SourceSelection) {
    this.prepareSource(selection);
    return this.sourceStatus(selection);
  }

  retrySource(selection: SourceSelection) {
    this.prepareSource(selection);
    const status = this.sourceStatus(selection);
    if (!status.jobId)
      throw new CatalogError(
        status.reason === "model_not_prepared" ? "MODEL_NOT_PREPARED" : "UNAVAILABLE",
        status.reason ?? "Source transcript is unavailable",
        {},
        status.retryable,
      );
    if (
      ["failed", "unavailable", "canceled"].includes(this.jobs.job(status.jobId).state) &&
      this.models.status().state !== "ready"
    )
      throw new CatalogError("MODEL_NOT_PREPARED", "Speech models are not prepared", {}, true);
    this.jobs.retry(status.jobId);
    return this.sourceStatus(selection);
  }

  private cleanupAsset(assetId: string, signal: AbortSignal) {
    const owner = { kind: "asset" as const, assetId };
    return this.transcripts.reclaim(
      owner,
      (generation) => this.jobs.retainsAttempt(owner, artifact, generation),
      signal,
    );
  }

  private async executeSource({ job, signal }: JobExecution): Promise<string> {
    if (job.target.kind !== "asset" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Transcript processor cannot execute this job");
    const selection = sourceSelectionSchema.parse(JSON.parse(job.input).selection);
    const selected = selectedAudio(this.asset, selection);
    if (
      job.target.assetId !== selection.assetId ||
      job.input !== this.sourceIdentity(selected).input
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Transcript source or model inputs changed");
    if (!selected.track.available.length) throw new CatalogError("UNAVAILABLE", "no_audio");
    if (this.models.status().state !== "ready")
      throw new CatalogError("MODEL_NOT_PREPARED", "Speech models are not prepared", {}, true);
    await this.cleanupAsset(selection.assetId, signal);
    return JSON.stringify(
      await this.transcribeSource(
        {
          owner: { kind: "asset", assetId: selection.assetId },
          sourceId: selection.assetId,
          generation: job.attemptId,
        },
        sourceDescriptor(selected),
        selected.track,
        signal,
      ),
    );
  }

  private async transcribeSource(
    identity: TranscriptIdentity,
    source: TranscriptSource,
    track: Parameters<SpeechTranscriber>[0]["track"],
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const output = await this.transcripts.reserve(identity);
    try {
      const request = { models: this.models.nativeRequest(), track, output };
      const receipt = await this.transcribe(request, signal);
      signal.throwIfAborted();
      const metadata = await this.transcripts.ingest({
        identity,
        source,
        request,
        receipt,
        pins: { ...this.models.pins, modelDigest: this.models.modelDigest },
        signal,
      });
      signal.throwIfAborted();
      return metadata;
    } catch (error) {
      await this.transcripts.remove(identity);
      throw error;
    }
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
    const revision = this.recording.store.revision(
      input.recordingId,
      input.revisionId ?? cursor?.revisionId,
    );
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
    if (this.options.recording)
      await this.recording.store.forEachRecording(signal, ({ recordingId }) =>
        this.cleanupRecording(recordingId, signal),
      );
    if (this.options.asset) {
      let afterSequence = 0;
      let failure: unknown;
      for (;;) {
        signal.throwIfAborted();
        const page = this.asset.assets.list({ afterSequence, limit: 100 });
        for (const asset of page.assets) {
          try {
            await this.cleanupAsset(asset.id, signal);
          } catch (error) {
            signal.throwIfAborted();
            failure ??= error;
          }
        }
        if (!page.nextCursor) break;
        afterSequence = page.nextCursor.afterSequence;
        await setImmediate(undefined, { signal });
      }
      if (failure) throw failure;
    }
  }

  private cleanupRecording(recordingId: string, signal: AbortSignal) {
    return this.transcripts.reclaim(
      { kind: "recording", recordingId },
      (generation) =>
        this.jobs.retainsAttempt(
          { kind: "recording", recordingId: recordingId },
          artifact,
          generation,
        ) || !!this.recording.retained?.(recordingId, generation),
      signal,
    );
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.target.kind === "asset") return this.executeSource({ job, signal });
    if (job.target.kind !== "recording")
      throw new CatalogError("UNSUPPORTED_JOB", "Recording processing needs a recording target");
    if (job.artifact !== artifact || job.target.revisionId !== "r0" || job.input !== this.input)
      throw new CatalogError("UNSUPPORTED_JOB", "Transcript processor cannot execute this job");
    const recording = this.recording.store.get(job.target.recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      throw new CatalogError("UNAVAILABLE", "no_usable_video");
    const source = this.recording.source.status(job.target.recordingId).published;
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
      owner: { kind: "recording" as const, recordingId: job.target.recordingId },
      sourceId: recording.sourceId,
      generation: job.attemptId,
    };
    return JSON.stringify(
      recordingTranscript(
        await this.transcribeSource(
          identity,
          {
            kind: "recording",
            sourceGeneration: source.evidence.generation,
            durationUs: recording.sourceDurationUs,
          },
          {
            source: track.source,
            sourceOffsetUs: track.sourceOffsetUs,
            available: track.available,
          },
          signal,
        ),
      ),
    );
  }
}
