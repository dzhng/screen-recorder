import { readRawCursor, type RawCursorOptions } from "./raw-cursor.js";
import { lstat, mkdir, opendir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isSettled, type RevisionStore } from "./library.js";
import { CatalogError } from "./catalog.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type {
  SourceEvidenceMetadata,
  SourceEvidenceReceipt,
  SourceEvidenceStore,
} from "./evidence.js";

export const sourceArtifact = "source-evidence";
export const sourcePolicy = "native-source-v1";

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
    private readonly retained?: (recordingId: string, generation: string) => boolean,
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
    this.jobs.backfill({ artifact: sourceArtifact, input: sourcePolicy, lane: "heavy" });
  }

  retry(recordingId: string) {
    this.prepare(recordingId);
    const status = this.status(recordingId);
    if (!status.jobId)
      throw new CatalogError("UNAVAILABLE", status.reason ?? "Source evidence is unavailable");
    this.jobs.retry(status.jobId);
    return this.status(recordingId);
  }

  rawCursor(input: { recordingId: string } & RawCursorOptions<{ recordingId: string }>) {
    return readRawCursor({ recordingId: input.recordingId }, input, () => {
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
      return { metadata: status.published.evidence, reader: this.evidence };
    });
  }

  private identity(recordingId: string) {
    return {
      target: {
        kind: "recording" as const,
        recordingId: recordingId,
        revisionId: this.store.revision(recordingId, "r0").id,
      },

      artifact: sourceArtifact,
      input: sourcePolicy,
    };
  }

  /** Startup can run this after readiness; the owner aborts and awaits it before closing SQLite. */
  async cleanup(signal: AbortSignal): Promise<void> {
    await this.store.forEachRecording(signal, (recording) =>
      this.cleanupRecording(recording, signal),
    );
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
      if (
        this.jobs.retainsAttempt(
          { kind: "recording", recordingId: recordingId },
          sourceArtifact,
          generation,
        ) ||
        this.retained?.(recordingId, generation)
      )
        return;
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
    if (job.target.kind !== "recording")
      throw new CatalogError("UNSUPPORTED_JOB", "Recording processing needs a recording target");
    if (
      job.artifact !== sourceArtifact ||
      job.input !== sourcePolicy ||
      job.target.revisionId !== "r0"
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Source processor cannot execute this job");
    const recording = this.store.get(job.target.recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      throw new CatalogError("UNAVAILABLE", "The recording has no finalized source");
    for (const id of [job.target.recordingId, job.attemptId])
      if (basename(id) !== id || id === "." || id === "..")
        throw new CatalogError("INVALID_JOB", "Job identity is not a path component");
    await this.cleanupRecording(recording, signal);
    const root = join(this.home, "recordings", job.target.recordingId);
    const outputDirectory = join(root, "evidence", "source", job.attemptId);
    const output = join(outputDirectory, "observations.jsonl");
    const identity = {
      recordingId: job.target.recordingId,
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
