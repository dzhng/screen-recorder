import { join } from "node:path";
import { CatalogError, type RevisionStore } from "@screenrec/core/library";
import type { DerivedCache, DirectoryIdentity } from "@screenrec/core/cache";
import type { JobExecution, JobQueue } from "@screenrec/core/jobs";
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
  preview: ReadyPreview;
  receipt: PublicationReceipt | null;
};
type Row = Omit<Intent, "snapshot" | "destination" | "staging" | "preview" | "receipt"> & {
  snapshot: string;
  destination: string;
  staging: string | null;
  preview: string;
  receipt: string | null;
};
const artifact = "export-video";
const stageName = (id: string) => `.screenrec-export-${id}`;

/** Durable external truth belongs here; execution state and retries remain in JobQueue.
 * This first internal consumer admits an already-ready preview. Waiting admission is a
 * separate pass, not a restriction on the eventual public export operation. */
export class VideoExports {
  constructor(
    private readonly owners: {
      store: RevisionStore;
      jobs: JobQueue;
      cache: DerivedCache;
      preview: PreviewInspection;
      worker: MediaWorker;
      files: Pick<ManagedFiles, "externalDirectory">;
    },
  ) {
    owners.store.catalog.exec(`CREATE TABLE IF NOT EXISTS export_intents (
      exportId TEXT PRIMARY KEY, recordingId TEXT NOT NULL REFERENCES recordings(recordingId),
      request TEXT NOT NULL, snapshot TEXT NOT NULL, destination TEXT NOT NULL,
      staging TEXT, preview TEXT NOT NULL, receipt TEXT
    ) STRICT; CREATE INDEX IF NOT EXISTS export_intents_recording ON export_intents(recordingId,exportId);`);
  }
  private find(exportId: string): Intent | null {
    const row = this.owners.store.catalog
      .prepare("SELECT * FROM export_intents WHERE exportId=?")
      .get(exportId) as Row | undefined;
    if (!row) return null;
    return {
      ...row,
      snapshot: JSON.parse(row.snapshot),
      destination: JSON.parse(row.destination),
      staging: row.staging ? JSON.parse(row.staging) : null,
      preview: JSON.parse(row.preview),
      receipt: row.receipt ? JSON.parse(row.receipt) : null,
    };
  }
  private require(exportId: string): Intent {
    const intent = this.find(exportId);
    if (!intent) throw new CatalogError("NOT_FOUND", "Export intent does not exist", { exportId });
    return intent;
  }
  private identity(intent: Intent) {
    return {
      recordingId: intent.recordingId,
      revisionId: intent.snapshot.revisionId,
      artifact,
      input: intent.exportId,
    };
  }
  private readyPreview(recordingId: string, revisionId: string): ReadyPreview {
    const ready = this.owners.preview.request({ recordingId, revisionId });
    if (ready.state !== "ready" || !ready.published)
      throw new CatalogError(
        "DEPENDENCY_NOT_READY",
        "Internal video export requires a ready pinned preview",
        { dependency: ready.jobId },
        true,
      );
    return {
      cacheId: ready.published.preview.cacheId,
      bytes: ready.published.preview.bytes,
      generation: ready.published.generation,
    };
  }
  async createReady(request: Request) {
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
      this.owners.store.get(existing.recordingId);
      if (!existing.receipt) this.owners.jobs.submit({ ...this.identity(existing), lane: "heavy" });
      return this.status(existing.exportId);
    }
    const { snapshot } = this.owners.store.pinPackageSnapshot(
      request.recordingId,
      request.revisionId,
    );
    const ready = this.readyPreview(request.recordingId, snapshot.revisionId);
    const selected = await this.owners.files.externalDirectory(request.directory);
    this.owners.store.get(request.recordingId);
    const destination = { ...selected, leaf: request.leaf };
    const intent = this.owners.store.transaction(() => {
      this.owners.store.catalog
        .prepare(
          "INSERT OR IGNORE INTO export_intents(exportId,recordingId,request,snapshot,destination,preview) VALUES (?,?,?,?,?,?)",
        )
        .run(
          request.exportId,
          request.recordingId,
          key,
          JSON.stringify(snapshot),
          JSON.stringify(destination),
          JSON.stringify(ready),
        );
      const admitted = this.require(request.exportId);
      if (admitted.request !== key)
        throw new CatalogError("REQUEST_CONFLICT", "Export identity names a different request");
      return admitted;
    });
    this.owners.jobs.submit({ ...this.identity(intent), lane: "heavy" });
    return this.status(request.exportId);
  }
  status(exportId: string) {
    const intent = this.require(exportId);
    this.owners.store.get(intent.recordingId);
    const job = this.owners.jobs.status(this.identity(intent));
    return {
      exportId,
      recordingId: intent.recordingId,
      snapshot: intent.snapshot,
      state: intent.receipt
        ? ("committed" as const)
        : job.jobId
          ? this.owners.jobs.job(job.jobId).state
          : ("not_requested" as const),
      receipt: intent.receipt,
      jobId: job.jobId,
      reason: intent.receipt ? null : job.reason,
      retryable: !intent.receipt && job.retryable,
    };
  }
  async retry(exportId: string) {
    const intent = this.require(exportId);
    this.owners.store.get(intent.recordingId);
    // An acknowledged commit never becomes a second export because the user moved/deleted it.
    if (intent.receipt) {
      await this.recover(exportId);
      return this.status(exportId);
    }
    const job = this.owners.jobs.submit({ ...this.identity(intent), lane: "heavy" });
    this.owners.jobs.retry(job.jobId);
    return this.status(exportId);
  }
  cancel(exportId: string) {
    const intent = this.require(exportId);
    this.owners.store.get(intent.recordingId);
    if (intent.receipt) return;
    const job = this.owners.jobs.submit({ ...this.identity(intent), lane: "heavy" });
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
        intent.preview = this.readyPreview(intent.recordingId, intent.snapshot.revisionId);
        this.owners.store.transaction(() =>
          this.owners.store.catalog
            .prepare("UPDATE export_intents SET preview=? WHERE exportId=?")
            .run(JSON.stringify(intent.preview), intent.exportId),
        );
        await this.owners.cache.withDescriptor(intent.preview.cacheId, async (source) => {
          if (source.bytes !== intent.preview.bytes)
            throw new CatalogError("INVALID_CACHE", "Pinned preview size changed");
          await publication.prepare(source, intent.destination.leaf, source.bytes, { signal });
        });
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
      return JSON.stringify(observed.receipt);
    } finally {
      await publication.close();
    }
  }
  /** Startup recovery records an already-created file without starting another export. */
  async recover(exportId: string) {
    const intent = this.require(exportId);
    const job = this.owners.jobs.status(this.identity(intent));
    if (job.jobId && this.owners.jobs.isAttemptActive(this.owners.jobs.job(job.jobId).attemptId))
      throw new CatalogError("PROCESSING_BUSY", "Export attempt is still closing", {}, true);
    if (!intent.staging) return;
    const publication = await this.open(intent);
    try {
      if (intent.receipt) {
        await publication.discard();
        return;
      }
      const observed = await publication.reconcile();
      if (observed.state === "committed" && observed.receipt) {
        this.recordCommit(intent, observed.receipt);
        await publication.acknowledge();
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
        const intent = this.require(row.exportId);
        const mayHaveStaging =
          intent.staging || this.owners.jobs.status(this.identity(intent)).jobId;
        if (
          mayHaveStaging &&
          !(await Publication.absent(
            intent.destination.directory,
            intent.destination.identity,
            stageName(intent.exportId),
            this.owners.worker,
          ))
        ) {
          const publication = await this.open(intent);
          try {
            // Deletion forgets intent status and never touches the external file. Its
            // readability cannot be a prerequisite for erasing our own private bytes.
            await publication.retire(stageName(intent.exportId));
          } finally {
            await publication.close();
          }
        }
        this.owners.store.transaction(() =>
          this.owners.store.catalog
            .prepare("DELETE FROM export_intents WHERE exportId=?")
            .run(intent.exportId),
        );
      } catch (error) {
        firstFailure ??= error;
      }
    }
    if (firstFailure) throw firstFailure;
  }
}
