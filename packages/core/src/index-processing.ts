import { isDeepStrictEqual } from "node:util";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import type { DerivedCache } from "./cache.js";
import type { MediaFrameInspection } from "./frame-inspection.js";
import type { SceneEvidenceStore, SceneEvidenceMetadata } from "./scene-evidence.js";
import { type SourceSelection } from "./source-selection.js";
import type { SourceIndexIdentity, SourceIndexRecords } from "./source-index.js";
import { sourceIndexPolicy } from "./source-index-selection.js";
import { materializeSourceIndex } from "./source-index-materialization.js";
import { evidenceRecordingId } from "./evidence.js";
import {
  RetainedIndexRead,
  validateIndexCoverageCursor,
  type IndexCoverageCursor,
  type IndexReadCursor,
} from "./index-read.js";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { type RevisionStore } from "./library.js";
import { CatalogError, type Catalog } from "./catalog.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { SourceTrailRead, SourceEvidenceMetadata } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import type { SceneProcessing } from "./scene-processing.js";
import type { SceneEvidenceRead, RecordingSceneEvidenceMetadata } from "./scene-evidence.js";
import { selectIndex, selectionPolicy } from "./selection.js";
import { selectionEvidence } from "./selection-evidence.js";
import { materializeFrame, framePolicy, type FrameDecoder } from "./frame-materialization.js";
import { trailPolicy } from "./trails.js";
import type { VisualSampler } from "./scenes.js";
import type { ScreenshotIndexStore, ScreenshotIndexMetadata } from "./screenshot-index.js";

const artifact = "screenshot-index";
export type IndexReference = Pick<
  ScreenshotIndexMetadata,
  "recordingId" | "revisionId" | "generation"
>;
export type IndexFrameReference = IndexReference & { ordinal: number };
export type IndexEvidence = {
  source: SourceEvidenceMetadata;
  scenes: RecordingSceneEvidenceMetadata;
};
type IndexInput = IndexEvidence & {
  selectionPolicy: string;
  framePolicy: string;
  trailPolicy: string;
};
export type SourceIndexReference = SourceSelection & { generation: string };
type SourceIndexInput = Omit<SourceIndexIdentity, "generation">;
export type IndexProcessingOptions = {
  jobs: JobQueue;
  asset?: {
    catalog: Catalog;
    assets: AssetStore;
    acquisitions: AcquisitionStore;
    index: ScreenshotIndexStore<SourceIndexRecords>;
    scenes: SceneProcessing;
    records: SceneEvidenceStore;
    frames: MediaFrameInspection;
    cache: DerivedCache;
  };
  recording?: {
    store: RevisionStore;
    index: ScreenshotIndexStore;
    source: SourceProcessing;
    scenes: SceneProcessing;
    evidence: { source: SourceTrailRead; scenes: SceneEvidenceRead };
    home: string;
    render: { decode: FrameDecoder; sample: VisualSampler };
    retained?: (recordingId: string, generation: string) => boolean;
  };
};
/** Dependency readiness is resolved before index admission to the existing work lanes. */
export class IndexProcessing {
  private readonly jobs: JobQueue;
  constructor(private readonly options: IndexProcessingOptions) {
    this.jobs = options.jobs;
    if (options.asset)
      options.asset.catalog.catalog.exec(`
      CREATE INDEX IF NOT EXISTS source_index_scene_dependencies ON jobs(targetKind,targetId,artifact,json_extract(input,'$.scenes.generation'),state) WHERE targetKind='asset' AND artifact='screenshot-index';
      CREATE INDEX IF NOT EXISTS source_index_publication ON artifacts(targetKind,targetId,artifact,json_extract(result,'$.generation')) WHERE targetKind='asset' AND artifact='screenshot-index';
    `);
  }
  private get recording() {
    if (!this.options.recording)
      throw new CatalogError("UNSUPPORTED_JOB", "Recording indexes are unavailable");
    return this.options.recording;
  }

  private get asset() {
    if (!this.options.asset)
      throw new CatalogError("UNSUPPORTED_JOB", "Source indexes are unavailable");
    return this.options.asset;
  }
  private sourceRecipe(
    selection: SourceSelection,
    scenes: SceneEvidenceMetadata,
  ): SourceIndexInput {
    const { options } = this.asset.frames.sourcePlan({ ...selection, atUs: 0 });
    return {
      ...options.selection,
      scenes,
      selectionPolicy: sourceIndexPolicy.id,
      implementationId: options.implementationId,
      maxLongEdge: options.maxLongEdge,
    };
  }
  requestSource(selection: SourceSelection) {
    selection = this.asset.frames.sourcePlan({ ...selection, atUs: 0 }).source.selection;
    const dependency = this.asset.scenes.publishedSource(selection);
    if (!dependency.published)
      return {
        ...selection,
        state: dependency.state,
        reason: dependency.reason,
        retryable: dependency.retryable,
        jobId: null,
        published: null,
        dependencies: [{ artifact: "source-scenes", ...dependency }],
      };
    const input = this.sourceRecipe(selection, dependency.published.evidence);
    const identity = {
      target: { kind: "asset" as const, assetId: input.assetId },
      artifact,
      input: JSON.stringify(input),
    };
    this.jobs.submit({ ...identity, lane: "heavy" }, (job) => {
      const owner = { kind: "job" as const, id: job.jobId };
      this.asset.assets.retain(owner, [input.assetId]);
      if (input.acquisitionId) this.asset.acquisitions.retain(owner, [input.acquisitionId]);
    });
    const status = this.jobs.status(identity);
    return {
      ...selection,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            evidence: JSON.parse(
              status.published.result,
            ) as ScreenshotIndexMetadata<SourceIndexRecords>,
          }
        : null,
      dependencies: [],
    };
  }
  retrySource(selection: SourceSelection) {
    const status = this.requestSource(selection);
    if (status.jobId) this.jobs.retry(status.jobId);
    else if (status.retryable && !["queued", "processing", "ready"].includes(status.state))
      this.asset.scenes.retrySource(
        this.asset.frames.sourcePlan({ ...selection, atUs: 0 }).source.selection,
      );
    return this.requestSource(selection);
  }
  publishedSource(reference: SourceIndexReference) {
    const selected = this.asset.frames.sourcePlan({ ...reference, atUs: 0 }).source;
    const row = this.asset.catalog.catalog
      .prepare(
        `SELECT result FROM artifacts WHERE targetKind='asset' AND targetId=? AND artifact='screenshot-index' AND json_extract(result,'$.generation')=? LIMIT 1`,
      )
      .get(reference.assetId, reference.generation) as { result: string } | undefined;
    if (!row)
      throw new CatalogError("ARTIFACT_CHANGED", "Source screenshot index is not published");
    const metadata = JSON.parse(row.result) as ScreenshotIndexMetadata<SourceIndexRecords>;
    if (
      metadata.assetId !== selected.selection.assetId ||
      metadata.streamId !== selected.selection.streamId ||
      metadata.acquisitionId !== selected.selection.acquisitionId
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Source screenshot index belongs to another selection",
      );
    return metadata;
  }
  private sourceRead(reference: SourceIndexReference) {
    const pinned = {
      assetId: reference.assetId,
      streamId: reference.streamId,
      ...(reference.acquisitionId === undefined ? {} : { acquisitionId: reference.acquisitionId }),
      generation: reference.generation,
    };
    return new RetainedIndexRead<SourceIndexReference, SourceIndexRecords>(
      this.asset.index,
      this.publishedSource(pinned),
      pinned,
    );
  }
  getSource(
    input: SourceSelection & {
      cursor?: IndexReadCursor<SourceIndexReference> | undefined;
      limit?: number;
    },
  ) {
    if (
      input.cursor &&
      (input.cursor.assetId !== input.assetId ||
        input.cursor.streamId !== input.streamId ||
        input.cursor.acquisitionId !== input.acquisitionId)
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Source index continuation belongs to another selection",
      );
    const status = input.cursor ? null : this.requestSource(input);
    if (status && !status.published) return { ...status, page: null };
    const metadata = input.cursor
      ? this.publishedSource(input.cursor)
      : status!.published!.evidence;
    return this.sourceRead(metadata).get({ cursor: input.cursor, limit: input.limit });
  }
  coverageSource(
    input: SourceIndexReference & {
      candidateOrdinal?: number | undefined;
      cursor?: IndexCoverageCursor<SourceIndexReference> | undefined;
      limit?: number | undefined;
    },
  ) {
    return this.sourceRead(input).coverage(input);
  }
  frameSource(input: SourceIndexReference & { ordinal: number }) {
    return this.sourceRead(input).frame(input.ordinal);
  }
  openReadSource(input: SourceIndexReference & { ordinal: number }) {
    return this.sourceRead(input).openRead(input.ordinal);
  }
  /** Scene evidence stays pinned for unfinished recipes, including explicit retry after failure. */
  retainsSourceScenes(assetId: string, generation: string) {
    return !!this.asset.catalog.catalog
      .prepare(
        `SELECT 1 FROM jobs WHERE targetKind='asset' AND targetId=? AND artifact='screenshot-index' AND json_extract(input,'$.scenes.generation')=? AND (state IN ('waiting','queued','running','canceled') OR (state='failed' AND retryable=1)) LIMIT 1`,
      )
      .get(assetId, generation);
  }
  private async cleanupAsset(assetId: string, signal: AbortSignal) {
    const owner = { kind: "asset" as const, assetId };
    await this.asset.index.reclaim(
      owner,
      ({ generation }) => this.jobs.retainsAttempt(owner, artifact, generation),
      signal,
    );
  }
  private async executeSource({ job, signal }: JobExecution) {
    if (job.target.kind !== "asset" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Source index requires an asset job");
    const input = JSON.parse(job.input) as SourceIndexInput;
    if (
      job.target.assetId !== input.assetId ||
      !isDeepStrictEqual(input, this.sourceRecipe(input, input.scenes))
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Source index recipe changed");
    const source = this.asset.frames.sourcePlan({ ...input, atUs: 0 }).source;
    await this.cleanupAsset(input.assetId, signal);
    return JSON.stringify(
      await materializeSourceIndex(
        { ...input, generation: job.attemptId },
        { durationUs: source.durationUs, support: source.track.available },
        this.asset,
        job.generation > 1,
        signal,
      ),
    );
  }

  request(input: {
    recordingId: string;
    revisionId?: string | undefined;
    evidence?: IndexEvidence;
  }) {
    const revision = this.recording.store.revision(input.recordingId, input.revisionId);
    let selected = input.evidence;
    if (!selected) {
      this.recording.source.prepare(input.recordingId);
      this.recording.scenes.prepare(input.recordingId);
      const source = this.recording.source.status(input.recordingId);
      const scenes = this.recording.scenes.status(input.recordingId);
      const dependencies = [
        { artifact: "source", ...source },
        { artifact: "scenes", ...scenes },
      ];
      if (!source.published || !scenes.published) {
        const waiting =
          dependencies.find((item) => ["failed", "unavailable"].includes(item.state)) ??
          dependencies.find((item) => !item.published)!;
        return {
          recordingId: input.recordingId,
          revisionId: revision.id,
          state: waiting.state,
          reason: waiting.reason,
          retryable: waiting.retryable,
          jobId: null,
          published: null,
          dependencies,
        };
      }
      selected = { source: source.published.evidence, scenes: scenes.published.evidence };
    }
    const sourceId = this.recording.store.get(input.recordingId).sourceId;
    if (
      evidenceRecordingId(selected.source) !== input.recordingId ||
      selected.scenes.recordingId !== input.recordingId ||
      [selected.source, selected.scenes].some((value) => value.sourceId !== sourceId)
    )
      throw new CatalogError("INVALID_EVIDENCE", "Index evidence belongs to another source");
    const options: IndexInput = {
      ...selected,
      selectionPolicy: selectionPolicy.id,
      framePolicy,
      trailPolicy: trailPolicy.id,
    };
    const identity = {
      target: {
        kind: "recording" as const,
        recordingId: input.recordingId,
        revisionId: revision.id,
      },

      artifact,
      input: JSON.stringify(options),
    };
    const existing = this.jobs.status(identity);
    if (!existing.jobId) this.requireSlot();
    this.jobs.submit({ ...identity, lane: "frame" });
    const status = this.jobs.status(identity);
    return {
      recordingId: input.recordingId,
      revisionId: revision.id,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            evidence: JSON.parse(status.published.result) as ScreenshotIndexMetadata,
          }
        : null,
      dependencies: [],
    };
  }

  get(input: {
    recordingId: string;
    revisionId?: string | undefined;
    cursor?: IndexReadCursor<IndexReference> | undefined;
    limit?: number | undefined;
  }) {
    const cursor = input.cursor;
    if (
      cursor &&
      (cursor.recordingId !== input.recordingId ||
        (input.revisionId !== undefined && input.revisionId !== cursor.revisionId))
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Index continuation belongs to another recording or revision",
      );
    const status = cursor ? null : this.request(input);
    if (status && !status.published) return { ...status, page: null };
    const metadata = cursor ? this.published(cursor) : status!.published!.evidence;
    return new RetainedIndexRead(this.recording.index, metadata, {
      recordingId: metadata.recordingId,
      revisionId: metadata.revisionId,
      generation: metadata.generation,
    }).get({ cursor, limit: input.limit });
  }

  coverage(
    input: IndexReference & {
      candidateOrdinal?: number | undefined;
      cursor?: IndexCoverageCursor<IndexReference> | undefined;
      limit?: number | undefined;
    },
  ) {
    const reference: IndexReference = {
      recordingId: input.recordingId,
      revisionId: input.revisionId,
      generation: input.generation,
    };
    validateIndexCoverageCursor(reference, input);
    return new RetainedIndexRead(
      this.recording.index,
      this.published(reference),
      reference,
    ).coverage(input);
  }

  frame(input: IndexFrameReference) {
    return this.read(input).frame(input.ordinal);
  }

  openRead(input: IndexFrameReference) {
    return this.read(input).openRead(input.ordinal);
  }

  private read(input: IndexReference) {
    const reference: IndexReference = {
      recordingId: input.recordingId,
      revisionId: input.revisionId,
      generation: input.generation,
    };
    return new RetainedIndexRead(this.recording.index, this.published(reference), reference);
  }

  /** Public references resolve through queue publication, never merely a completed store row. */
  published(input: IndexReference) {
    this.recording.store.revision(input.recordingId, input.revisionId);
    const row = this.recording.store.catalog
      .prepare(`SELECT result FROM artifacts WHERE targetKind='recording' AND targetId=? AND revisionId=? AND artifact=?
        AND json_extract(result,'$.generation')=? LIMIT 1`)
      .get(input.recordingId, input.revisionId, artifact, input.generation) as
      | { result: string }
      | undefined;
    if (!row)
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Screenshot index reference is not published for this revision",
      );
    return JSON.parse(row.result) as ScreenshotIndexMetadata;
  }

  retry(input: { recordingId: string; revisionId?: string | undefined }) {
    const status = this.request(input);
    if (!status.jobId) return status;
    const job = this.jobs.job(status.jobId);
    if (!["queued", "running", "ready"].includes(job.state)) this.requireSlot();
    this.jobs.retry(job.jobId);
    return this.request({ ...input, revisionId: status.revisionId });
  }
  private requireSlot() {
    if (this.jobs.isArtifactBusy(artifact))
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Another screenshot index is using the background frame slot",
        {},
        true,
      );
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.target.kind === "asset") return this.executeSource({ job, signal });
    if (job.target.kind !== "recording")
      throw new CatalogError("UNSUPPORTED_JOB", "Recording processing needs a recording target");
    const input = JSON.parse(job.input) as IndexInput;
    if (
      job.artifact !== artifact ||
      input.selectionPolicy !== selectionPolicy.id ||
      input.framePolicy !== framePolicy ||
      input.trailPolicy !== trailPolicy.id
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Index processor cannot execute this job");
    const revision = this.recording.store.revision(job.target.recordingId, job.target.revisionId);
    const sourceId = this.recording.store.get(job.target.recordingId).sourceId;
    const sourceIdentity = {
      owner: { kind: "recording" as const, recordingId: job.target.recordingId },
      sourceId,
      generation: input.source.generation,
    };
    const sceneIdentity = {
      recordingId: job.target.recordingId,
      sourceId,
      generation: input.scenes.generation,
      policy: input.scenes.policy,
    };
    const identity = {
      recordingId: job.target.recordingId,
      sourceId,
      revisionId: revision.id,
      generation: job.attemptId,
      sourceIdentity,
      sceneIdentity,
      selectionPolicy: input.selectionPolicy,
      framePolicy: input.framePolicy,
      trailPolicy: input.trailPolicy,
    };
    await this.cleanupRecording(job.target.recordingId, signal);
    const selection = {
      revision,
      sourceIdentity,
      sceneIdentity,
      sourceWidth: input.scenes.sourceWidth,
      sourceHeight: input.scenes.sourceHeight,
    };
    try {
      this.recording.index.begin(identity);
      for await (const row of selectIndex(
        selection,
        selectionEvidence(selection, this.recording.evidence, signal),
        signal,
      )) {
        signal.throwIfAborted();
        if (row.kind === "coverage") this.recording.index.appendCoverage(identity, row);
        else {
          const selectionEndUs = row.reasons.reduce(
            (end, reason) => (reason.side === "before" ? Math.min(end, reason.eventSourceUs) : end),
            row.kept.endUs,
          );
          const frame = await materializeFrame(
            {
              recordingId: job.target.recordingId,
              sourceId,
              revision,
              source: join(
                this.recording.home,
                "recordings",
                job.target.recordingId,
                "source",
                "video.mov",
              ),
              output: this.recording.index.outputPath(identity, row.ordinal),
              atUs: row.requestedPlaybackUs,
              ...(selectionEndUs < row.kept.endUs ? { selectionEndUs } : {}),
              maxLongEdge: 1600,
              crop: null,
              clean: false,
              trailUs: trailPolicy.defaultUs,
              sourceEvidence: input.source,
            },
            { ...this.recording.render, evidence: this.recording.evidence.source },
            signal,
          );
          this.recording.index.appendCandidate(identity, row, frame);
        }
        await setImmediate();
      }
      signal.throwIfAborted();
      const result = await this.recording.index.finish(identity, signal);
      signal.throwIfAborted();
      return JSON.stringify(result);
    } catch (error) {
      await this.recording.index.remove(identity);
      throw error;
    }
  }

  private cleanupRecording(recordingId: string, signal: AbortSignal) {
    return this.recording.index.reclaim(
      { kind: "recording", recordingId },
      ({ generation }) =>
        this.jobs.retainsAttempt(
          { kind: "recording", recordingId: recordingId },
          artifact,
          generation,
        ) || !!this.recording.retained?.(recordingId, generation),
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
}
