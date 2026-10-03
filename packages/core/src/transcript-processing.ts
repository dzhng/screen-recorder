import { fromTime, compare, type SelectionRange } from "@screenrec/composition";
import { z } from "zod";
import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { selectSource, sourceSelectionSchema, type SourceSelection } from "./source-selection.js";
import { CatalogError } from "./catalog.js";
import { retainedPublicationSchema, type JobExecution, type JobQueue } from "./jobs.js";
import type { Models } from "./models.js";
import {
  transcriptPolicy,
  portableTranscript,
  type PortableTranscript,
  type SpeechTranscriber,
  type TranscriptStore,
  type TranscriptIdentity,
  type TranscriptSource,
  type TranscriptMetadata,
} from "./transcript.js";

const artifact = "transcript";
// Native PCM decoding is an execution input, separate from portable transcript schema policy.
const decoderExecution = "native-audio-v5";

export type PortableTranscriptPublication = z.infer<typeof retainedPublicationSchema>;
/** The model owner as transcription sees it: readiness, the verified file list and its pins. */
export type TranscriptionModels = ReturnType<Models["transcription"]>;

type AssetDomain = { assets: AssetStore; acquisitions: AcquisitionStore };
export type TranscriptProcessingOptions = {
  jobs: JobQueue;
  transcripts: TranscriptStore;
  models: TranscriptionModels;
  transcribe: SpeechTranscriber;
  asset: AssetDomain;
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

/** Selected sources share one queue, model owner and raw indexer. */
export class TranscriptProcessing {
  private readonly jobs: JobQueue;
  private readonly transcripts: TranscriptStore;
  private readonly models: TranscriptionModels;
  private readonly transcribe: SpeechTranscriber;
  private readonly asset: AssetDomain;
  constructor(options: TranscriptProcessingOptions) {
    ({
      jobs: this.jobs,
      transcripts: this.transcripts,
      models: this.models,
      transcribe: this.transcribe,
      asset: this.asset,
    } = options);
  }
  private execution() {
    return { modelDigest: this.models.modelDigest, pins: this.models.pins, decoderExecution };
  }
  private sourceIdentity(
    selected: ReturnType<typeof selectedAudio>,
    execution: ReturnType<TranscriptProcessing["execution"]>,
  ) {
    return {
      target: { kind: "asset" as const, assetId: selected.selection.assetId },
      artifact,
      input: JSON.stringify({
        selection: selected.selection,
        source: sourceDescriptor(selected),
        modelDigest: execution.modelDigest,
        pins: execution.pins,
        policy: transcriptPolicy,
        decoderExecution: execution.decoderExecution,
      }),
    };
  }

  private portableSelection(value: PortableTranscript) {
    const selected = selectedAudio(this.asset, {
      assetId: value.owner.assetId,
      streamId: value.source.streamId,
      ...(value.source.acquisitionId === undefined
        ? {}
        : { acquisitionId: value.source.acquisitionId }),
    });
    if (
      !isDeepStrictEqual(sourceDescriptor(selected), value.source) ||
      compare(fromTime(selected.track.sourceOffsetUs), fromTime(value.track.sourceOffsetUs)) !==
        0 ||
      selected.track.streamId !== value.track.streamId
    )
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Transcript source and track differ from retained selection",
      );
    return selected;
  }
  portable(value: PortableTranscript): {
    available: SelectionRange[];
    publication: PortableTranscriptPublication | null;
  } {
    const selected = this.portableSelection(value);
    const receipt = this.jobs.retainedArtifact(value.owner, artifact, value.generation);
    if (receipt && !isDeepStrictEqual(portableTranscript(JSON.parse(receipt.result)), value))
      throw new CatalogError(
        "INVALID_STORAGE",
        "Transcript publication differs from owned metadata",
      );
    return {
      available: selected.track.available,
      publication: receipt
        ? retainedPublicationSchema.parse({
            generation: receipt.generation,
            attemptId: receipt.attemptId,
            input: receipt.input,
          })
        : null,
    };
  }
  adoptPublication(
    metadata: TranscriptMetadata,
    available: SelectionRange[],
    publication: PortableTranscriptPublication | null,
  ): void {
    const value = portableTranscript(metadata),
      selected = this.portableSelection(value);
    if (
      !isDeepStrictEqual(available, selected.track.available) ||
      metadata.track.source !== selected.track.source
    )
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Transcript media binding differs from local source",
      );
    if (!publication) return;
    let input: unknown;
    try {
      input = JSON.parse(publication.input);
    } catch {
      throw new CatalogError("INVALID_PACKAGE", "Invalid transcript publication input");
    }
    const parsed = z.object({ decoderExecution: z.string().min(1).max(256) }).safeParse(input);
    if (!parsed.success)
      throw new CatalogError("INVALID_PACKAGE", "Transcript publication has no decoder identity");
    const {
      encoderPrecision: _precision,
      computeUnits: _units,
      policy: _policy,
      kindPolicy: _kind,
      modelDigest,
      ...pins
    } = value.engine;
    const identity = this.sourceIdentity(selected, {
      modelDigest,
      pins,
      decoderExecution: parsed.data.decoderExecution,
    });
    if (
      publication.attemptId !== value.generation ||
      !isDeepStrictEqual(JSON.parse(identity.input), input)
    )
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Transcript publication differs from source or engine identity",
      );
    this.jobs.adoptArtifact({ ...identity, ...publication, result: JSON.stringify(metadata) });
  }
  sourceStatus(selection: SourceSelection) {
    const selected = selectedAudio(this.asset, selection);
    const status = this.jobs.status(this.sourceIdentity(selected, this.execution()));
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
      () => ({
        ...this.sourceIdentity(selectedAudio(this.asset, selection), this.execution()),
        lane: "heavy",
      }),
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
    if (!status.jobId && status.state === "ready") return status;
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

  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.target.kind !== "asset" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Transcript processor cannot execute this job");
    const selection = sourceSelectionSchema.parse(JSON.parse(job.input).selection);
    const selected = selectedAudio(this.asset, selection);
    if (
      job.target.assetId !== selection.assetId ||
      job.input !== this.sourceIdentity(selected, this.execution()).input
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
      const request = { models: await this.models.nativeRequest(), track, output };
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

  async cleanup(signal: AbortSignal): Promise<void> {
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
