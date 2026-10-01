import { ceil, fromTime } from "@screenrec/composition";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { type RevisionStore } from "./library.js";
import { isSettled } from "./capture-store.js";
import { CatalogError } from "./catalog.js";
import { retainedPublicationSchema, type JobExecution, type JobQueue } from "./jobs.js";
import { SourceSceneAnalysis, scenePolicy, type VisualSampler } from "./scenes.js";
import {
  recordingSceneMetadata,
  sourceSceneDescriptor,
  type SceneEvidenceStore,
  type RecordingSceneEvidenceMetadata,
  type SceneEvidenceMetadata,
  type SceneEvidenceIdentity,
  type SceneSource,
} from "./scene-evidence.js";

import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { selectSource, sourceSelectionSchema, type SourceSelection } from "./source-selection.js";
import {
  SelectedSourceSceneAnalysis,
  sourceScenePolicy,
  type SourceVisualSampler,
} from "./source-scenes.js";

const artifact = "source-scenes";
export const portableScenePublicationSchema = retainedPublicationSchema.extend({
  result: z.string().max(65536),
});
export type PortableScenePublication = z.infer<typeof portableScenePublicationSchema>;

export type SceneProcessingOptions = {
  jobs: JobQueue;
  evidence: SceneEvidenceStore;
  recording?: {
    store: RevisionStore;
    home: string;
    sample: VisualSampler;
    retained?: (recordingId: string, generation: string) => boolean;
  };
  asset?: {
    assets: AssetStore;
    acquisitions: AcquisitionStore;
    sample: SourceVisualSampler;
    implementationId: string;
    retained?: (assetId: string, generation: string) => boolean;
  };
};
/** Canonical source analysis is independent of edit revisions and local frame demand. */
export class SceneProcessing {
  private readonly jobs: JobQueue;
  private readonly evidence: SceneEvidenceStore;
  constructor(private readonly options: SceneProcessingOptions) {
    if (options.asset && !options.asset.implementationId)
      throw new CatalogError("INVALID_PARAMS", "Scene sampler requires an implementation identity");
    this.jobs = options.jobs;
    this.evidence = options.evidence;
  }
  private get recording() {
    if (!this.options.recording)
      throw new CatalogError("UNSUPPORTED_JOB", "Recording scene analysis is unavailable");
    return this.options.recording;
  }
  private get asset() {
    if (!this.options.asset)
      throw new CatalogError("UNSUPPORTED_JOB", "Asset scene analysis is unavailable");
    return this.options.asset;
  }
  private selected(selection: SourceSelection) {
    const selected = selectSource(this.asset.assets, this.asset.acquisitions, selection);
    if (selected.stream.kind !== "video")
      throw new CatalogError("UNSUPPORTED_MEDIA", "Scene analysis requires a video stream");
    return selected;
  }
  private identity(recordingId: string) {
    return {
      target: { kind: "recording" as const, recordingId: recordingId, revisionId: "r0" },
      artifact,
      input: scenePolicy.id,
    };
  }
  status(recordingId: string) {
    const recording = this.recording.store.get(recordingId);
    const identity = { recordingId, sourceId: recording.sourceId, sourceRevisionId: "r0" };
    if (!isSettled(recording.state))
      return {
        ...identity,
        state: "not_requested",
        reason: "capture_not_finalized",
        retryable: false,
        jobId: null,
        published: null,
      };
    if (recording.state === "canceled" || recording.sourceDurationUs === null)
      return {
        ...identity,
        state: "unavailable",
        reason: "no_usable_video",
        retryable: false,
        jobId: null,
        published: null,
      };
    const status = this.jobs.status(this.identity(recordingId));
    return {
      ...identity,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            evidence: JSON.parse(status.published.result) as RecordingSceneEvidenceMetadata,
          }
        : null,
    };
  }
  prepare(recordingId: string): void {
    const recording = this.recording.store.get(recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      return;
    this.jobs.submit({ ...this.identity(recordingId), lane: "heavy" });
  }
  resume(): void {
    if (this.options.recording)
      this.jobs.backfill({ artifact, input: scenePolicy.id, lane: "heavy" });
  }
  retry(recordingId: string) {
    this.prepare(recordingId);
    const status = this.status(recordingId);
    if (!status.jobId && status.state === "ready") return status;
    if (!status.jobId)
      throw new CatalogError("UNAVAILABLE", status.reason ?? "Scene evidence unavailable");
    this.jobs.retry(status.jobId);
    return this.status(recordingId);
  }
  private sourceIdentity(selected: ReturnType<typeof selectSource>, implementationId: string) {
    return {
      target: { kind: "asset" as const, assetId: selected.selection.assetId },
      artifact,
      input: JSON.stringify({
        selection: selected.selection,
        source: sourceSceneDescriptor(selected),
        policy: sourceScenePolicy,
        implementationId,
      }),
    };
  }
  portablePublication(metadata: SceneEvidenceMetadata): PortableScenePublication | null {
    const receipt = this.jobs.retainedArtifact(metadata.owner, artifact, metadata.generation);
    return receipt
      ? portableScenePublicationSchema.parse({
          generation: receipt.generation,
          attemptId: receipt.attemptId,
          input: receipt.input,
          result: receipt.result,
        })
      : null;
  }
  adoptPublication(metadata: SceneEvidenceMetadata, publication: PortableScenePublication): void {
    if (metadata.owner.kind !== "asset" || metadata.source.kind !== "asset")
      throw new CatalogError("INVALID_PACKAGE", "Portable scenes require an asset owner");
    const selection = {
      assetId: metadata.owner.assetId,
      streamId: metadata.source.streamId,
      ...(metadata.source.acquisitionId === undefined
        ? {}
        : { acquisitionId: metadata.source.acquisitionId }),
    };
    let input: unknown, result: unknown;
    try {
      input = JSON.parse(publication.input);
      result = JSON.parse(publication.result);
    } catch {
      throw new CatalogError("INVALID_PACKAGE", "Invalid scene publication JSON");
    }
    const execution = z.object({ implementationId: z.string().min(1).max(256) }).safeParse(input);
    if (!execution.success)
      throw new CatalogError("INVALID_PACKAGE", "Scene publication has no sampler identity");
    const identity = this.sourceIdentity(this.selected(selection), execution.data.implementationId);
    if (
      identity.input !== publication.input ||
      publication.attemptId !== metadata.generation ||
      !isDeepStrictEqual(result, metadata)
    )
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Scene publication differs from its source and generation",
      );
    this.jobs.adoptArtifact({ ...identity, ...publication });
  }
  sourceStatus(selection: SourceSelection) {
    const selected = this.selected(selection);
    const status = this.jobs.status(this.sourceIdentity(selected, this.asset.implementationId));
    const unavailable = !selected.track.available.length;
    return {
      ...selected.selection,
      ...status,
      state: unavailable ? ("unavailable" as const) : status.state,
      reason: unavailable ? "no_video" : status.reason,
      jobId: unavailable ? null : status.jobId,
      retryable: unavailable ? false : status.retryable,
      published:
        unavailable || !status.published
          ? null
          : {
              generation: status.published.generation,
              evidence: JSON.parse(status.published.result) as SceneEvidenceMetadata,
            },
    };
  }
  prepareSource(selection: SourceSelection): void {
    const status = this.sourceStatus(selection);
    if (status.state !== "not_requested") return;
    this.jobs.submit(
      () => ({
        ...this.sourceIdentity(this.selected(selection), this.asset.implementationId),
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
      throw new CatalogError("UNAVAILABLE", status.reason ?? "Scene evidence unavailable");
    this.jobs.retry(status.jobId);
    return this.sourceStatus(selection);
  }
  private cleanupAsset(assetId: string, signal: AbortSignal) {
    const owner = { kind: "asset" as const, assetId };
    return this.evidence.reclaim(
      owner,
      (generation) =>
        this.jobs.retainsAttempt(owner, artifact, generation) ||
        !!this.asset.retained?.(assetId, generation),
      signal,
    );
  }
  async cleanup(signal: AbortSignal): Promise<void> {
    if (this.options.recording)
      await this.recording.store.forEachRecording(signal, ({ recordingId }) =>
        this.cleanupRecording(recordingId, signal),
      );
    if (this.options.asset) {
      let afterSequence = 0,
        failure: unknown;
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
  private async executeSource({ job, signal }: JobExecution) {
    if (job.target.kind !== "asset" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Scene processor cannot execute this job");
    const selection = sourceSelectionSchema.parse(JSON.parse(job.input).selection);
    const selected = this.selected(selection);
    if (
      job.target.assetId !== selection.assetId ||
      job.input !== this.sourceIdentity(selected, this.asset.implementationId).input
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Scene source inputs changed");
    if (!selected.track.available.length) throw new CatalogError("UNAVAILABLE", "no_video");
    await this.cleanupAsset(selection.assetId, signal);
    const identity = {
      owner: { kind: "asset" as const, assetId: selection.assetId },
      sourceId: selection.assetId,
      generation: job.attemptId,
      policy: sourceScenePolicy,
    };
    const source = sourceSceneDescriptor(selected);
    const analysis = new SelectedSourceSceneAnalysis(
      {
        asset: {
          assetId: selection.assetId,
          streamId: selection.streamId,
          path: selected.track.source,
          originUs: source.originUs,
        },
        available: selected.track.available,
      },
      selected.durationUs,
      this.asset.sample,
    );
    return JSON.stringify(await this.analyze(identity, source, analysis, signal));
  }
  private cleanupRecording(recordingId: string, signal: AbortSignal) {
    return this.evidence.reclaim(
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
    if (job.artifact !== artifact || job.input !== scenePolicy.id || job.target.revisionId !== "r0")
      throw new CatalogError("UNSUPPORTED_JOB", "Scene processor cannot execute this job");
    const recording = this.recording.store.get(job.target.recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      throw new CatalogError("UNAVAILABLE", "Scene analysis needs finalized video");
    await this.cleanupRecording(job.target.recordingId, signal);
    const identity = {
      owner: { kind: "recording" as const, recordingId: job.target.recordingId },
      sourceId: recording.sourceId,
      generation: job.attemptId,
      policy: scenePolicy.id,
    };
    const kept = { startUs: 0, endUs: recording.sourceDurationUs };
    const source = join(
      this.recording.home,
      "recordings",
      job.target.recordingId,
      "source",
      "video.mov",
    );
    const analysis = new SourceSceneAnalysis(
      job.target.recordingId,
      source,
      kept.endUs,
      this.recording.sample,
    );
    return JSON.stringify(
      recordingSceneMetadata(
        await this.analyze(
          identity,
          { kind: "recording", durationUs: kept.endUs },
          analysis,
          signal,
        ),
      ),
    );
  }
  private async analyze(
    identity: SceneEvidenceIdentity,
    source: SceneSource,
    analysis: SourceSceneAnalysis | SelectedSourceSceneAnalysis,
    signal: AbortSignal,
  ) {
    try {
      for (
        let startUs = 0;
        startUs < ceil(fromTime(source.durationUs));
        startUs += scenePolicy.maximumRangeUs
      ) {
        signal.throwIfAborted();
        const analyzed = await analysis.analyze(
          {
            startUs,
            endUs: Math.min(
              startUs + scenePolicy.maximumRangeUs,
              ceil(fromTime(source.durationUs)),
            ),
          },
          signal,
        );
        this.evidence.append(identity, source, analyzed);
        await setImmediate();
      }
      signal.throwIfAborted();
      return this.evidence.finish(identity);
    } catch (error) {
      await this.evidence.remove(identity);
      throw error;
    }
  }
}
