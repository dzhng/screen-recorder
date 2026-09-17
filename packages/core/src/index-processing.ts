import {
  RetainedIndexRead,
  validateIndexCoverageCursor,
  type IndexCoverageCursor,
  type IndexReadCursor,
} from "./index-read.js";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { CatalogError, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { SourceTrailRead, SourceEvidenceMetadata } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import type { SceneProcessing } from "./scene-processing.js";
import type { SceneEvidenceRead, SceneEvidenceMetadata } from "./scene-evidence.js";
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
export type IndexEvidence = { source: SourceEvidenceMetadata; scenes: SceneEvidenceMetadata };
type IndexInput = IndexEvidence & {
  selectionPolicy: string;
  framePolicy: string;
  trailPolicy: string;
};
/** One index occupies one existing frame slot; dependencies are resolved before admission. */
export class IndexProcessing {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly index: ScreenshotIndexStore,
    private readonly source: SourceProcessing,
    private readonly scenes: SceneProcessing,
    private readonly evidence: { source: SourceTrailRead; scenes: SceneEvidenceRead },
    private readonly home: string,
    private readonly render: { decode: FrameDecoder; sample: VisualSampler },
    private readonly retained?: (recordingId: string, generation: string) => boolean,
  ) {}

  request(input: {
    recordingId: string;
    revisionId?: string | undefined;
    evidence?: IndexEvidence;
  }) {
    const revision = this.store.revision(input.recordingId, input.revisionId);
    let selected = input.evidence;
    if (!selected) {
      this.source.prepare(input.recordingId);
      this.scenes.prepare(input.recordingId);
      const source = this.source.status(input.recordingId);
      const scenes = this.scenes.status(input.recordingId);
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
    const sourceId = this.store.get(input.recordingId).sourceId;
    if (
      [selected.source, selected.scenes].some(
        (value) => value.recordingId !== input.recordingId || value.sourceId !== sourceId,
      )
    )
      throw new CatalogError("INVALID_EVIDENCE", "Index evidence belongs to another source");
    const options: IndexInput = {
      ...selected,
      selectionPolicy: selectionPolicy.id,
      framePolicy,
      trailPolicy: trailPolicy.id,
    };
    const identity = {
      recordingId: input.recordingId,
      revisionId: revision.id,
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
    return new RetainedIndexRead(this.index, metadata, {
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
    return new RetainedIndexRead(this.index, this.published(reference), reference).coverage(input);
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
    return new RetainedIndexRead(this.index, this.published(reference), reference);
  }

  /** Public references resolve through queue publication, never merely a completed store row. */
  published(input: IndexReference) {
    this.store.revision(input.recordingId, input.revisionId);
    const row = this.store.catalog
      .prepare(`SELECT result FROM artifacts WHERE recordingId=? AND revisionId=? AND artifact=?
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
    const input = JSON.parse(job.input) as IndexInput;
    if (
      job.artifact !== artifact ||
      input.selectionPolicy !== selectionPolicy.id ||
      input.framePolicy !== framePolicy ||
      input.trailPolicy !== trailPolicy.id
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Index processor cannot execute this job");
    const revision = this.store.revision(job.recordingId, job.revisionId);
    const sourceId = this.store.get(job.recordingId).sourceId;
    const sourceIdentity = {
      recordingId: job.recordingId,
      sourceId,
      generation: input.source.generation,
    };
    const sceneIdentity = {
      recordingId: job.recordingId,
      sourceId,
      generation: input.scenes.generation,
      policy: input.scenes.policy,
    };
    const identity = {
      recordingId: job.recordingId,
      sourceId,
      revisionId: revision.id,
      generation: job.attemptId,
      sourceIdentity,
      sceneIdentity,
      selectionPolicy: input.selectionPolicy,
      framePolicy: input.framePolicy,
      trailPolicy: input.trailPolicy,
    };
    await this.cleanupRecording(job.recordingId, signal);
    const selection = {
      revision,
      sourceIdentity,
      sceneIdentity,
      sourceWidth: input.scenes.sourceWidth,
      sourceHeight: input.scenes.sourceHeight,
    };
    try {
      this.index.begin(identity);
      for await (const row of selectIndex(
        selection,
        selectionEvidence(selection, this.evidence, signal),
        signal,
      )) {
        signal.throwIfAborted();
        if (row.kind === "coverage") this.index.appendCoverage(identity, row);
        else {
          const selectionEndUs = row.reasons.reduce(
            (end, reason) => (reason.side === "before" ? Math.min(end, reason.eventSourceUs) : end),
            row.kept.endUs,
          );
          const frame = await materializeFrame(
            {
              recordingId: job.recordingId,
              sourceId,
              revision,
              source: join(this.home, "recordings", job.recordingId, "source", "video.mov"),
              output: this.index.outputPath(identity, row.ordinal),
              atUs: row.requestedPlaybackUs,
              ...(selectionEndUs < row.kept.endUs ? { selectionEndUs } : {}),
              maxLongEdge: 1600,
              crop: null,
              clean: false,
              trailUs: trailPolicy.defaultUs,
              sourceEvidence: input.source,
            },
            { ...this.render, evidence: this.evidence.source },
            signal,
          );
          this.index.appendCandidate(identity, row, frame);
        }
        await setImmediate();
      }
      signal.throwIfAborted();
      const result = await this.index.finish(identity, signal);
      signal.throwIfAborted();
      return JSON.stringify(result);
    } catch (error) {
      await this.index.remove(identity);
      throw error;
    }
  }

  private cleanupRecording(recordingId: string, signal: AbortSignal) {
    return this.index.reclaim(
      recordingId,
      ({ generation }) =>
        this.jobs.retainsAttempt(recordingId, artifact, generation) ||
        !!this.retained?.(recordingId, generation),
      signal,
    );
  }
  async cleanup(signal: AbortSignal): Promise<void> {
    await this.store.forEachRecording(signal, ({ recordingId }) =>
      this.cleanupRecording(recordingId, signal),
    );
  }
}
