import { lstat, mkdir, opendir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { CatalogError, isSettled, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type {
  SourceEvidenceMetadata,
  SourceEvidenceReceipt,
  SourceEvidenceStore,
} from "./evidence.js";

export type RawCursorContinuation = {
  recordingId: string;
  sourceId: string;
  generation: string;
  sourceRange: { startUs: number; endUs: number };
  afterSequence: number;
};

const artifact = "source-evidence";
const policy = "native-source-v1";

export type SourceExporter = (
  directory: string,
  output: string,
  signal: AbortSignal,
) => Promise<SourceEvidenceReceipt>;

/** Source processing pins r0; edits only change how later readers project this evidence. */
export class SourceProcessing {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly evidence: SourceEvidenceStore,
    private readonly home: string,
    private readonly exportSource: SourceExporter,
  ) {}

  status(recordingId: string) {
    const recording = this.store.get(recordingId);
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
    if (recording.sourceDurationUs === null || recording.state === "canceled")
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
            evidence: JSON.parse(status.published.result) as SourceEvidenceMetadata,
          }
        : null,
    };
  }

  prepare(recordingId: string): void {
    const recording = this.store.get(recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      return;
    this.jobs.submit({ ...this.identity(recordingId), lane: "heavy" });
  }

  /** Recover the gap between finalization and admission without inventing another durable queue. */
  resume(): void {
    // One background take can occupy the heavy lane; queuing the whole backlog only crowds
    // foreground inspection out of the shared admission budget without increasing throughput.
    if (
      this.store.catalog
        .prepare("SELECT 1 FROM jobs WHERE artifact=? AND state IN ('queued','running') LIMIT 1")
        .get(artifact)
    )
      return;
    const pending = this.store.catalog
      .prepare(`SELECT recordingId FROM recordings
      WHERE state IN ('complete','interrupted') AND sourceDurationUs IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.recordingId=recordings.recordingId
        AND jobs.revisionId='r0' AND jobs.artifact=? AND jobs.input=?)
      ORDER BY creationSequence LIMIT 1`)
      .get(artifact, policy) as { recordingId: string } | undefined;
    if (!pending) return;
    try {
      this.prepare(pending.recordingId);
    } catch (error) {
      if (error instanceof CatalogError && error.code === "LIMIT_EXCEEDED") return;
      throw error;
    }
  }

  retry(recordingId: string) {
    this.prepare(recordingId);
    const status = this.status(recordingId);
    if (!status.jobId)
      throw new CatalogError("UNAVAILABLE", status.reason ?? "Source evidence is unavailable");
    this.jobs.retry(status.jobId);
    return this.status(recordingId);
  }

  rawCursor(input: {
    recordingId: string;
    sourceRange: { startUs: number; endUs: number };
    cursor?: RawCursorContinuation | undefined;
    limit?: number;
  }) {
    const { startUs, endUs } = input.sourceRange;
    if (
      !Number.isSafeInteger(startUs) ||
      !Number.isSafeInteger(endUs) ||
      startUs < 0 ||
      endUs <= startUs ||
      endUs - startUs > 60_000_000
    )
      throw new CatalogError(
        "INVALID_RANGE",
        "Cursor range must be positive and at most 60 seconds",
      );
    const status = this.status(input.recordingId);
    if (!status.published)
      throw new CatalogError(
        status.state === "unavailable"
          ? "UNAVAILABLE"
          : status.state === "failed"
            ? "PROCESSING_FAILED"
            : "NOT_READY",
        status.reason ?? "Source cursor evidence is not ready",
        { state: status.state },
        status.retryable,
      );
    const metadata = status.published.evidence;
    const cursor = input.cursor;
    if (
      cursor &&
      (cursor.recordingId !== input.recordingId ||
        cursor.sourceId !== metadata.sourceId ||
        cursor.generation !== metadata.generation ||
        cursor.sourceRange.startUs !== input.sourceRange.startUs ||
        cursor.sourceRange.endUs !== input.sourceRange.endUs)
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Cursor continuation belongs to different evidence or filters",
      );
    const page = this.evidence.page({
      ...metadata,
      range: input.sourceRange,
      ...(cursor ? { afterSequence: cursor.afterSequence } : {}),
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    });
    return {
      recordingId: input.recordingId,
      sourceId: metadata.sourceId,
      sourceRevisionId: "r0",
      generation: metadata.generation,
      sourceRange: input.sourceRange,
      samples: page.samples,
      integrity: {
        finished: metadata.receipt.finished,
        incompleteTail: metadata.receipt.incompleteTail,
        invalidAtSequence: metadata.receipt.invalidAtSequence ?? null,
        lastSequence: metadata.receipt.lastSequence,
      },
      nextCursor:
        page.nextSequence === null
          ? null
          : {
              recordingId: input.recordingId,
              sourceId: metadata.sourceId,
              generation: metadata.generation,
              sourceRange: input.sourceRange,
              afterSequence: page.nextSequence,
            },
    };
  }

  private identity(recordingId: string) {
    return {
      recordingId,
      revisionId: this.store.revision(recordingId, "r0").id,
      artifact,
      input: policy,
    };
  }

  /** Startup can run this after readiness; the owner aborts and awaits it before closing SQLite. */
  async cleanup(signal: AbortSignal): Promise<void> {
    let after = "";
    let firstError: unknown;
    for (;;) {
      signal.throwIfAborted();
      const recording = this.store.catalog
        .prepare(
          "SELECT recordingId,sourceId FROM recordings WHERE recordingId>? ORDER BY recordingId LIMIT 1",
        )
        .get(after) as { recordingId: string; sourceId: string } | undefined;
      if (!recording) break;
      after = recording.recordingId;
      try {
        await this.cleanupRecording(recording, signal);
      } catch (error) {
        signal.throwIfAborted();
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }

  private protectedGeneration(recordingId: string, generation: string): boolean {
    if (this.jobs.isAttemptActive(generation)) return true;
    if (
      this.store.catalog
        .prepare(
          "SELECT 1 FROM jobs WHERE recordingId=? AND attemptId=? AND state IN ('queued','running')",
        )
        .get(recordingId, generation)
    )
      return true;
    // Corrupt publication metadata is not permission to delete potentially published evidence.
    return !!this.store.catalog
      .prepare(`SELECT 1 FROM artifacts WHERE recordingId=? AND artifact=?
      AND CASE WHEN json_valid(result) THEN CASE WHEN json_type(result,'$.generation')='text'
      THEN json_extract(result,'$.generation')=? ELSE 1 END ELSE 1 END`)
      .get(recordingId, artifact, generation);
  }

  private async cleanupRecording(
    recording: { recordingId: string; sourceId: string },
    signal: AbortSignal,
  ): Promise<void> {
    const { recordingId, sourceId } = recording;
    if (basename(recordingId) !== recordingId || [".", "..", ""].includes(recordingId))
      throw new CatalogError("INVALID_JOB", "Recording identity is not a path component");
    const parent = join(this.home, "recordings", recordingId, "evidence", "source");
    // An owned derivative path must never traverse a symlink into source or another directory.
    let path = this.home;
    let exists = true;
    for (const component of ["recordings", recordingId, "evidence", "source"]) {
      path = join(path, component);
      try {
        const entry = await lstat(path);
        if (!entry.isDirectory() || entry.isSymbolicLink())
          throw new CatalogError("INVALID_EVIDENCE", "Source evidence parent is not a directory");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        exists = false;
        break;
      }
    }
    let firstError: unknown;
    const reclaim = async (generation: string) => {
      signal.throwIfAborted();
      if (basename(generation) !== generation || [".", "..", ""].includes(generation)) return;
      if (this.protectedGeneration(recordingId, generation)) return;
      try {
        if (exists) await rm(join(parent, generation), { recursive: true, force: true });
        await this.evidence.reclaim({ recordingId, sourceId, generation }, signal);
      } catch (error) {
        signal.throwIfAborted();
        firstError ??= error;
      }
    };
    // Files can exist before ingestion creates its first database row.
    if (exists) {
      const directory = await opendir(parent, { bufferSize: 16 });
      for await (const entry of directory) await reclaim(entry.name);
    }
    // Conversely a crash during cleanup can leave rows after the directory is gone.
    let after = "";
    for (;;) {
      signal.throwIfAborted();
      const row = this.store.catalog
        .prepare(`SELECT generation FROM source_evidence_generations
        WHERE recordingId=? AND sourceId=? AND generation>? ORDER BY generation LIMIT 1`)
        .get(recordingId, sourceId, after) as { generation: string } | undefined;
      if (!row) break;
      after = row.generation;
      await reclaim(row.generation);
    }
    if (firstError) throw firstError;
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.artifact !== artifact || job.input !== policy || job.revisionId !== "r0")
      throw new CatalogError("UNSUPPORTED_JOB", "Source processor cannot execute this job");
    const recording = this.store.get(job.recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      throw new CatalogError("UNAVAILABLE", "The recording has no finalized source");
    for (const id of [job.recordingId, job.attemptId])
      if (basename(id) !== id || id === "." || id === "..")
        throw new CatalogError("INVALID_JOB", "Job identity is not a path component");
    await this.cleanupRecording(recording, signal);
    const root = join(this.home, "recordings", job.recordingId);
    const outputDirectory = join(root, "evidence", "source", job.attemptId);
    const output = join(outputDirectory, "observations.jsonl");
    const identity = {
      recordingId: job.recordingId,
      sourceId: recording.sourceId,
      generation: job.attemptId,
    };
    signal.throwIfAborted();
    await mkdir(dirname(outputDirectory), { recursive: true });
    await mkdir(outputDirectory);
    try {
      const receipt = await this.exportSource(join(root, "source"), output, signal);
      signal.throwIfAborted();
      const metadata = await this.evidence.ingest({ ...identity, file: output, receipt, signal });
      signal.throwIfAborted();
      return JSON.stringify(metadata);
    } catch (error) {
      this.evidence.removeUnpublished(identity);
      await rm(outputDirectory, { recursive: true, force: true });
      throw error;
    }
  }
}
