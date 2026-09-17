import { join } from "node:path";
import { CatalogError, type RevisionStore } from "@screenrec/core/library";
import type { DerivedCache, DirectoryIdentity } from "@screenrec/core/cache";
import {
  JobDependencyLost,
  type Job,
  type JobAdmission,
  type JobExecution,
  type JobQueue,
} from "@screenrec/core/jobs";
import type { SourceEvidenceMetadata } from "@screenrec/core/evidence";
import type { SourceProcessing } from "@screenrec/core/processing";
import type { PreviewInspection, PreviewArtifact } from "@screenrec/core/preview";
import { Publication, type PublicationReceipt } from "./publication.js";
import type { ManagedFiles } from "./managed-files.js";
import type { MediaWorker } from "./worker.js";

type Request = {
  exportId: string;
  recordingId: string;
  revisionId?: string;
  directory: string;
  leaf: string;
};
type Snapshot = ReturnType<RevisionStore["pinPackageSnapshot"]>["snapshot"];
type ReadyPreview = Pick<PreviewArtifact, "cacheId" | "bytes"> & { generation: number };
type Intent = {
  exportId: string;
  recordingId: string;
  request: string;
  snapshot: Snapshot;
  destination: { directory: string; identity: DirectoryIdentity; leaf: string };
  staging: DirectoryIdentity | null;
  stagingCleared: 0 | 1;
  preview: ReadyPreview | null;
  sourceEvidence: SourceEvidenceMetadata | null;
  receipt: PublicationReceipt | null;
  abandoning: boolean;
};
type Row = Omit<
  Intent,
  "snapshot" | "destination" | "staging" | "preview" | "receipt" | "sourceEvidence" | "abandoning"
> & {
  snapshot: string;
  destination: string;
  staging: string | null;
  preview: string | null;
  sourceEvidence: string | null;
  receipt: string | null;
  abandoning: number;
};
const artifact = "export-video";
const stageName = (id: string) => `.screenrec-export-${id}`;

/** Durable external truth belongs here; execution state and retries remain in JobQueue.
 * Prerequisites wait in the existing queue while this owner pins their source generation. */
export class VideoExports {
  private readonly retiring = new Map<string, Promise<void>>();
  private closed = false;
  constructor(
    private readonly owners: {
      store: RevisionStore;
      jobs: JobQueue;
      cache: DerivedCache;
      preview: PreviewInspection;
      processing: SourceProcessing;
      worker: MediaWorker;
      files: Pick<ManagedFiles, "externalDirectory">;
    },
  ) {
    owners.store.catalog.exec(`CREATE TABLE IF NOT EXISTS export_intents (
      exportId TEXT PRIMARY KEY, recordingId TEXT NOT NULL REFERENCES recordings(recordingId),
      request TEXT NOT NULL, snapshot TEXT NOT NULL, destination TEXT NOT NULL,
      staging TEXT, stagingCleared INTEGER NOT NULL DEFAULT 0 CHECK(stagingCleared IN (0,1)),
      preview TEXT, sourceEvidence TEXT, receipt TEXT,
      abandoning INTEGER NOT NULL DEFAULT 0 CHECK(abandoning IN (0,1))
    ) STRICT; CREATE INDEX IF NOT EXISTS export_intents_pending ON export_intents(recordingId) WHERE receipt IS NULL OR abandoning=1;
    CREATE INDEX IF NOT EXISTS export_intents_storage ON export_intents(exportId) WHERE staging IS NOT NULL AND stagingCleared=0;
    CREATE INDEX IF NOT EXISTS export_intents_recording ON export_intents(recordingId,exportId);`);
  }
  private find(exportId: string): Intent | null {
    const row = this.owners.store.catalog
      .prepare("SELECT * FROM export_intents WHERE exportId=?")
      .get(exportId) as Row | undefined;
    if (!row) return null;
    return {
      ...row,
      abandoning: row.abandoning === 1,
      snapshot: JSON.parse(row.snapshot),
      destination: JSON.parse(row.destination),
      staging: row.staging ? JSON.parse(row.staging) : null,
      preview: row.preview ? JSON.parse(row.preview) : null,
      sourceEvidence: row.sourceEvidence ? JSON.parse(row.sourceEvidence) : null,
      receipt: row.receipt ? JSON.parse(row.receipt) : null,
    };
  }
  private require(exportId: string): Intent {
    const intent = this.find(exportId);
    if (!intent) throw new CatalogError("NOT_FOUND", "Export intent does not exist", { exportId });
    return intent;
  }
  private requireActive(intent: Intent): void {
    if (intent.abandoning)
      throw new CatalogError("EXPORT_ABANDONING", "Export cleanup is pending; retry abandonment", {
        exportId: intent.exportId,
      });
  }

  abandon(exportId: string): Promise<void> {
    if (this.closed)
      throw new CatalogError("SERVICE_STOPPED", "Export cleanup is closed", {}, true);
    const intent = this.find(exportId);
    if (!intent) return Promise.resolve();
    this.owners.store.catalog
      .prepare("UPDATE export_intents SET abandoning=1 WHERE exportId=?")
      .run(exportId);
    return this.retire(exportId);
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.allSettled(this.retiring.values());
  }

  private identity(intent: Intent) {
    return {
      recordingId: intent.recordingId,
      revisionId: intent.snapshot.revisionId,
      artifact,
      input: intent.exportId,
    };
  }
  retainsSource(recordingId: string, generation: string): boolean {
    return !!this.owners.store.catalog
      .prepare(`SELECT 1 FROM export_intents
      WHERE receipt IS NULL AND recordingId=? AND sourceEvidence IS NOT NULL
      AND CASE WHEN json_valid(sourceEvidence) THEN json_extract(sourceEvidence,'$.generation')=? ELSE 1 END LIMIT 1`)
      .get(recordingId, generation);
  }
  admit(job: Job): ReturnType<JobAdmission> {
    const intent = this.require(job.input);
    this.requireActive(intent);
    if (
      job.artifact !== artifact ||
      job.recordingId !== intent.recordingId ||
      job.revisionId !== intent.snapshot.revisionId
    )
      throw new CatalogError("INVALID_JOB", "Export job does not match its pinned intent");
    // A staged attempt may already have committed; reconcile before asking dependencies again.
    if (intent.receipt || (intent.staging && intent.preview)) return { state: "ready" };
    if (!intent.sourceEvidence) {
      this.owners.processing.prepare(intent.recordingId);
      const source = this.owners.processing.status(intent.recordingId);
      if (source.state !== "ready" || !source.published) return this.dependency(source);
      intent.sourceEvidence = source.published.evidence;
      this.owners.store.catalog
        .prepare("UPDATE export_intents SET sourceEvidence=? WHERE exportId=?")
        .run(JSON.stringify(intent.sourceEvidence), intent.exportId);
    }
    const ready = this.owners.preview.request({
      recordingId: intent.recordingId,
      revisionId: intent.snapshot.revisionId,
      sourceEvidence: intent.sourceEvidence,
    });
    if (ready.state !== "ready" || !ready.published) return this.dependency(ready);
    intent.preview = {
      cacheId: ready.published.preview.cacheId,
      bytes: ready.published.preview.bytes,
      generation: ready.published.generation,
    };
    this.owners.store.catalog
      .prepare("UPDATE export_intents SET preview=? WHERE exportId=?")
      .run(JSON.stringify(intent.preview), intent.exportId);
    return { state: "ready" };
  }
  private dependency(status: {
    state: string;
    jobId: string | null;
    reason: string | null;
    retryable: boolean;
  }): ReturnType<JobAdmission> {
    if (
      status.state === "failed" ||
      status.state === "unavailable" ||
      status.state === "not_requested"
    )
      throw new CatalogError(
        status.state === "unavailable" ? "UNAVAILABLE" : "DEPENDENCY_FAILED",
        status.reason ?? "Required evidence is unavailable",
        { dependency: status.jobId },
        status.retryable,
      );
    if (!status.jobId)
      throw new CatalogError("INVALID_STATE", "Waiting export dependency has no job identity");
    return { state: "waiting", dependency: status.jobId };
  }
  async create(request: Request) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(request.exportId) ||
      !request.leaf ||
      [".", ".."].includes(request.leaf) ||
      /[/\0]/.test(request.leaf) ||
      Buffer.byteLength(request.leaf) > 255
    )
      throw new CatalogError(
        "INVALID_PARAMS",
        "Export needs a UUID identity and destination filename",
      );
    const key = JSON.stringify([
      request.recordingId,
      request.revisionId ?? null,
      request.directory,
      request.leaf,
    ]);
    const existing = this.find(request.exportId);
    if (existing) {
      if (existing.request !== key)
        throw new CatalogError("REQUEST_CONFLICT", "Export identity names a different request");
      this.requireActive(existing);
      this.owners.store.get(existing.recordingId);
      if (!existing.receipt)
        this.owners.jobs.submitDeferred({ ...this.identity(existing), lane: "heavy" });
      return this.status(existing.exportId);
    }
    const { snapshot } = this.owners.store.pinPackageSnapshot(
      request.recordingId,
      request.revisionId,
    );
    const selected = await this.owners.files.externalDirectory(request.directory);
    this.owners.store.get(request.recordingId);
    const destination = { ...selected, leaf: request.leaf };
    const intent = this.owners.store.transaction(() => {
      const existing = this.find(request.exportId);
      if (existing) {
        if (existing.request !== key)
          throw new CatalogError("REQUEST_CONFLICT", "Export identity names a different request");
        this.requireActive(existing);
        return existing;
      }
      const pending = this.owners.store.catalog
        .prepare(
          "SELECT COUNT(*) AS count FROM export_intents WHERE receipt IS NULL OR abandoning=1",
        )
        .get() as { count: number };
      if (pending.count >= 32)
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Too many uncommitted exports retain their prerequisites",
          {},
          true,
        );
      this.owners.store.catalog
        .prepare(
          "INSERT OR IGNORE INTO export_intents(exportId,recordingId,request,snapshot,destination) VALUES (?,?,?,?,?)",
        )
        .run(
          request.exportId,
          request.recordingId,
          key,
          JSON.stringify(snapshot),
          JSON.stringify(destination),
        );
      const admitted = this.require(request.exportId);
      if (admitted.request !== key)
        throw new CatalogError("REQUEST_CONFLICT", "Export identity names a different request");
      return admitted;
    });
    this.owners.jobs.submitDeferred({ ...this.identity(intent), lane: "heavy" });
    return this.status(request.exportId);
  }
  status(exportId: string) {
    const intent = this.require(exportId);
    this.owners.store.get(intent.recordingId);
    const job = this.owners.jobs.status(this.identity(intent));
    const state = job.jobId ? this.owners.jobs.job(job.jobId).state : "not_requested";
    return {
      exportId,
      abandoning: intent.abandoning,
      recordingId: intent.recordingId,
      snapshot: intent.snapshot,
      state: intent.receipt ? ("committed" as const) : state === "waiting" ? "queued" : state,
      receipt: intent.receipt,
      jobId: job.jobId,
      reason: intent.receipt ? null : job.reason,
      retryable: !intent.receipt && job.retryable,
    };
  }
  /** Private staging remains recording-owned even when it lives beside an external destination. */
  async usage(recordingId: string | undefined, signal: AbortSignal): Promise<number> {
    let after = "",
      bytes = 0;
    const query = this.owners.store.catalog.prepare(
      recordingId === undefined
        ? "SELECT exportId FROM export_intents WHERE staging IS NOT NULL AND stagingCleared=0 AND exportId>? ORDER BY exportId LIMIT 1"
        : "SELECT exportId FROM export_intents WHERE recordingId=? AND staging IS NOT NULL AND stagingCleared=0 AND exportId>? ORDER BY exportId LIMIT 1",
    );
    for (;;) {
      signal.throwIfAborted();
      const row = (recordingId === undefined ? query.get(after) : query.get(recordingId, after)) as
        | { exportId: string }
        | undefined;
      if (!row) return bytes;
      after = row.exportId;
      const intent = this.require(row.exportId);
      let observed: number;
      try {
        observed = await Publication.usage(
          join(intent.destination.directory, stageName(intent.exportId)),
          intent.staging!,
          this.owners.worker,
          signal,
          intent.receipt !== null,
        );
      } catch (error) {
        signal.throwIfAborted();
        // Retirement can remove staging during a live observation. Only confirmed absence
        // beneath the same destination identity counts as zero; replacement stays an error.
        if (
          (error as NodeJS.ErrnoException).code !== "ENOENT" ||
          !(await Publication.absent(
            intent.destination.directory,
            intent.destination.identity,
            stageName(intent.exportId),
            this.owners.worker,
            signal,
          ))
        )
          throw error;
        observed = 0;
      }
      if (!Number.isSafeInteger(bytes + observed))
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Export storage byte total exceeds safe integer range",
        );
      bytes += observed;
    }
  }
  async retry(exportId: string) {
    const intent = this.require(exportId);
    this.requireActive(intent);
    this.owners.store.get(intent.recordingId);
    // An acknowledged commit never becomes a second export because the user moved/deleted it.
    if (intent.receipt) {
      await this.recover(exportId);
      return this.status(exportId);
    }
    const job = this.owners.jobs.submitDeferred({ ...this.identity(intent), lane: "heavy" });
    this.owners.jobs.retry(job.jobId);
    return this.status(exportId);
  }
  cancel(exportId: string) {
    const intent = this.require(exportId);
    this.requireActive(intent);
    this.owners.store.get(intent.recordingId);
    if (intent.receipt) return;
    const job = this.owners.jobs.submitDeferred({ ...this.identity(intent), lane: "heavy" });
    this.owners.jobs.cancel(job.jobId);
  }
  private async open(intent: Intent) {
    if (!intent.staging) {
      const identity = await Publication.allocate(
        intent.destination.directory,
        intent.destination.identity,
        stageName(intent.exportId),
        this.owners.worker,
      );
      this.owners.store.transaction(() =>
        this.owners.store.catalog
          .prepare("UPDATE export_intents SET staging=? WHERE exportId=?")
          .run(JSON.stringify(identity), intent.exportId),
      );
      intent.staging = identity;
    }
    return Publication.open(
      join(intent.destination.directory, stageName(intent.exportId)),
      intent.destination.directory,
      this.owners.worker,
      { expected: { stage: intent.staging, destination: intent.destination.identity } },
    );
  }
  private markStagingCleared(exportId: string) {
    this.owners.store.catalog
      .prepare("UPDATE export_intents SET stagingCleared=1 WHERE exportId=?")
      .run(exportId);
  }
  private recordCommit(intent: Intent, receipt: PublicationReceipt) {
    // This write is allowed during deletion/cancellation: the file already exists outside the library.
    this.owners.store.transaction(() =>
      this.owners.store.catalog
        .prepare("UPDATE export_intents SET receipt=? WHERE exportId=?")
        .run(JSON.stringify(receipt), intent.exportId),
    );
    intent.receipt = receipt;
  }
  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Video exporter cannot execute this job");
    const intent = this.require(job.input);
    this.requireActive(intent);
    if (job.recordingId !== intent.recordingId || job.revisionId !== intent.snapshot.revisionId)
      throw new CatalogError("INVALID_JOB", "Export job does not match its pinned intent");
    if (intent.receipt) return JSON.stringify(intent.receipt);
    signal.throwIfAborted();
    const publication = await this.open(intent);
    try {
      let observed = await publication.reconcile();
      if (observed.state === "unprepared") {
        signal.throwIfAborted();
        await publication.discard();
        try {
          if (!intent.preview) throw new JobDependencyLost("Preview is not admitted");
          const preview = intent.preview;
          await this.owners.cache.withDescriptor(preview.cacheId, async (source) => {
            if (source.bytes !== preview.bytes)
              throw new CatalogError("INVALID_CACHE", "Pinned preview size changed");
            await publication.prepare(source, intent.destination.leaf, source.bytes, { signal });
          });
        } catch (error) {
          if (
            error instanceof JobDependencyLost ||
            (error instanceof CatalogError && error.code === "ARTIFACT_EXPIRED")
          ) {
            this.owners.store.catalog
              .prepare("UPDATE export_intents SET preview=NULL WHERE exportId=?")
              .run(intent.exportId);
            throw new JobDependencyLost("Preview disappeared before preparation");
          }
          throw error;
        }
        observed = await publication.commit({ signal });
      } else if (observed.state === "missing") observed = await publication.commit({ signal });
      if (observed.state !== "committed" || !observed.receipt)
        throw new CatalogError(
          "DESTINATION_CHANGED",
          "Export destination belongs to another file or was modified",
          { state: observed.state },
        );
      this.recordCommit(intent, observed.receipt);
      await publication.acknowledge();
      this.markStagingCleared(intent.exportId);
      return JSON.stringify(observed.receipt);
    } finally {
      await publication.close();
    }
  }
  /** Startup recovery records an already-created file without starting another export. */
  async recover(exportId: string) {
    const intent = this.require(exportId);
    this.requireActive(intent);
    const job = this.owners.jobs.status(this.identity(intent));
    if (job.jobId && this.owners.jobs.isAttemptActive(this.owners.jobs.job(job.jobId).attemptId))
      throw new CatalogError("PROCESSING_BUSY", "Export attempt is still closing", {}, true);
    if (!intent.staging) return;
    const publication = await this.open(intent);
    try {
      if (intent.receipt) {
        await publication.discard();
        this.markStagingCleared(intent.exportId);
        return;
      }
      const observed = await publication.reconcile();
      if (observed.state === "committed" && observed.receipt) {
        this.recordCommit(intent, observed.receipt);
        await publication.acknowledge();
        this.markStagingCleared(intent.exportId);
      }
    } finally {
      await publication.close();
    }
  }
  async retireRecording(recordingId: string, signal?: AbortSignal) {
    if (!this.owners.store.isDeleting(recordingId))
      throw new CatalogError("INVALID_STATE", "Recording deletion must be marked first");
    let after = "",
      firstFailure: unknown;
    for (;;) {
      signal?.throwIfAborted();
      const row = this.owners.store.catalog
        .prepare(
          "SELECT exportId FROM export_intents WHERE recordingId=? AND exportId>? ORDER BY exportId LIMIT 1",
        )
        .get(recordingId, after) as { exportId: string } | undefined;
      if (!row) break;
      after = row.exportId;
      try {
        await this.retire(row.exportId);
      } catch (error) {
        firstFailure ??= error;
      }
    }
    if (firstFailure) throw firstFailure;
  }
  private retire(exportId: string): Promise<void> {
    const existing = this.retiring.get(exportId);
    if (existing) return existing;
    const result = Promise.resolve()
      .then(() => this.remove(exportId))
      .catch((error) => {
        if (error instanceof CatalogError)
          throw new CatalogError(error.code, error.message, { ...error.details, exportId }, true);
        throw new CatalogError(
          "EXPORT_CLEANUP_FAILED",
          `Export cleanup could not finish: ${error instanceof Error ? error.message : String(error)}`,
          { exportId },
          true,
        );
      })
      .finally(() => this.retiring.delete(exportId));
    this.retiring.set(exportId, result);
    return result;
  }

  private async remove(exportId: string): Promise<void> {
    let intent = this.find(exportId);
    if (!intent) return;
    const jobId = this.owners.jobs.status(this.identity(intent)).jobId;
    if (jobId) await this.owners.jobs.drainJob(jobId);
    // A late commit may have updated the receipt while the canceled executor drained.
    intent = this.require(exportId);
    if (!intent.abandoning && !this.owners.store.isDeleting(intent.recordingId))
      throw new CatalogError("INVALID_STATE", "Export must be fenced before retirement");
    const mayHaveStaging = intent.staging || jobId;
    if (
      mayHaveStaging &&
      !(await Publication.absent(
        intent.destination.directory,
        intent.destination.identity,
        stageName(exportId),
        this.owners.worker,
      ))
    ) {
      const publication = await this.open(intent);
      try {
        // Retirement forgets status, so unreadable external files cannot gate private cleanup.
        await publication.retire(stageName(exportId));
      } finally {
        await publication.close();
      }
    }
    if (jobId) this.owners.jobs.forgetJob(jobId);
    // A crash after job retirement is harmless: the still-fenced intent resumes private absence checking.
    this.owners.store.catalog.prepare("DELETE FROM export_intents WHERE exportId=?").run(exportId);
  }
}
