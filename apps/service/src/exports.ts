import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
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
import { Publication, publicationDeadlineMs, type PublicationReceipt } from "./publication.js";
import {
  provisionPackageWorkspace,
  recoverUnconfirmedPackageWorkspace,
} from "./package-workspace.js";
import {
  assemblePackage,
  checkWorkspace,
  type PackageOwners,
  type PackageEvidence,
  type AssemblyReservation,
} from "./package-assembly.js";
import type { ManagedFiles } from "./managed-files.js";
import { type MediaWorker } from "./worker.js";

type Request = {
  kind: "video" | "processed-package";
  exportId: string;
  recordingId: string;
  revisionId?: string | undefined;
  directory: string;
  leaf: string;
};
type ExportCursor = { recordingId: string | null; unfinishedOnly: boolean; afterExportId: string };
type ExportSummary = {
  exportId: string;
  recordingId: string;
  kind: Request["kind"];
  revisionId: string;
  state: Exclude<Job["state"], "waiting"> | "committed" | "not_requested";
  abandoning: boolean;
  cleanupPending: boolean;
};
const unfinished =
  "receipt IS NULL OR abandoning=1 OR assembly IS NOT NULL OR (staging IS NOT NULL AND stagingCleared=0)";
type Snapshot = ReturnType<RevisionStore["pinPackageSnapshot"]>["snapshot"];
type ReadyPreview = Pick<PreviewArtifact, "cacheId" | "bytes"> & { generation: number };
type Intent = {
  kind: Request["kind"];
  packageEvidence: PackageEvidence | null;
  assembly: AssemblyReservation | null;
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
  | "snapshot"
  | "destination"
  | "staging"
  | "preview"
  | "receipt"
  | "sourceEvidence"
  | "abandoning"
  | "packageEvidence"
  | "assembly"
> & {
  packageEvidence: string | null;
  assembly: string | null;
  snapshot: string;
  destination: string;
  staging: string | null;
  preview: string | null;
  sourceEvidence: string | null;
  receipt: string | null;
  abandoning: number;
};
const artifact = "export-recording",
  recoveryArtifact = "export-recovery";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const stageName = (id: string) => `.screenrec-export-${id}`;

/** Durable external truth belongs here; execution state and retries remain in JobQueue.
 * Prerequisites wait in the existing queue while this owner pins their source generation. */
export class RecordingExports {
  private readonly creating = new Map<Promise<unknown>, string>();
  private readonly lifetime = new AbortController();
  private readonly retiring = new Map<string, Promise<void>>();
  private closed = false;
  private admittingRecovery = false;
  constructor(
    private readonly owners: {
      store: RevisionStore;
      jobs: JobQueue;
      cache: DerivedCache;
      preview: PreviewInspection;
      processing: SourceProcessing;
      worker: MediaWorker;
      files: Pick<ManagedFiles, "externalDirectory" | "recordingDirectory">;
      package: PackageOwners;
    },
  ) {
    owners.store.catalog.exec(`CREATE TABLE IF NOT EXISTS export_intents (
      exportId TEXT PRIMARY KEY, recordingId TEXT NOT NULL REFERENCES recordings(recordingId),
      kind TEXT NOT NULL CHECK(kind IN ('video','processed-package')),
      request TEXT NOT NULL, snapshot TEXT NOT NULL, destination TEXT NOT NULL,
      staging TEXT, stagingCleared INTEGER NOT NULL DEFAULT 0 CHECK(stagingCleared IN (0,1)),
      preview TEXT, sourceEvidence TEXT, packageEvidence TEXT, assembly TEXT, receipt TEXT,
      abandoning INTEGER NOT NULL DEFAULT 0 CHECK(abandoning IN (0,1))
    ) STRICT; CREATE INDEX IF NOT EXISTS export_intents_pending ON export_intents(recordingId) WHERE receipt IS NULL OR abandoning=1 OR assembly IS NOT NULL;
    CREATE INDEX IF NOT EXISTS export_intents_storage ON export_intents(exportId) WHERE staging IS NOT NULL AND stagingCleared=0;
    CREATE INDEX IF NOT EXISTS export_intents_recording ON export_intents(recordingId,exportId);
    CREATE INDEX IF NOT EXISTS export_discovery_unfinished ON export_intents(exportId) WHERE ${unfinished};
    CREATE INDEX IF NOT EXISTS export_discovery_recording_unfinished ON export_intents(recordingId,exportId) WHERE ${unfinished};`);
  }
  private find(exportId: string): Intent | null {
    const row = this.owners.store.catalog
      .prepare("SELECT * FROM export_intents WHERE exportId=?")
      .get(exportId) as Row | undefined;
    if (!row) return null;
    return {
      ...row,
      abandoning: row.abandoning === 1,
      packageEvidence: row.packageEvidence ? JSON.parse(row.packageEvidence) : null,
      assembly: row.assembly ? JSON.parse(row.assembly) : null,
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
    this.owners.store.catalog
      .prepare("UPDATE export_intents SET abandoning=1 WHERE exportId=?")
      .run(exportId);
    return this.retire(exportId);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.lifetime.abort();
    await Promise.allSettled([...this.creating.keys(), ...this.retiring.values()]);
  }

  private identity(intent: Intent) {
    return {
      recordingId: intent.recordingId,
      revisionId: intent.snapshot.revisionId,
      artifact,
      input: intent.exportId,
    };
  }
  private recoveryIdentity(intent: Intent, attemptId: string) {
    if (!uuid.test(intent.exportId) || !uuid.test(attemptId))
      throw new CatalogError("INVALID_JOB", "Recovery requires export and attempt UUIDs");
    return {
      recordingId: intent.recordingId,
      revisionId: intent.snapshot.revisionId,
      artifact: recoveryArtifact,
      input: `${intent.exportId}/${attemptId}`,
    };
  }

  /** One metadata-only admission turn; capacity hooks call again after real queue progress. */
  resumeRecovery(): unknown[] {
    if (this.closed || this.admittingRecovery) return [];
    this.admittingRecovery = true;
    const errors: unknown[] = [];
    try {
      const rows = this.owners.store.catalog
        .prepare(`SELECT i.exportId,j.attemptId FROM export_intents i
        JOIN jobs j ON j.recordingId=i.recordingId AND j.artifact=? AND j.input=i.exportId
        WHERE ((i.staging IS NOT NULL AND i.stagingCleared=0) OR i.assembly IS NOT NULL) AND i.abandoning=0
        AND j.state IN ('failed','canceled','ready','unavailable')
        AND NOT EXISTS(SELECT 1 FROM recording_deletions d WHERE d.recordingId=i.recordingId)
        AND NOT EXISTS(SELECT 1 FROM jobs r WHERE r.recordingId=j.recordingId AND r.revisionId=j.revisionId
          AND r.artifact=? AND r.input=i.exportId || '/' || j.attemptId)
        ORDER BY i.exportId LIMIT 32`)
        .all(artifact, recoveryArtifact) as { exportId: string; attemptId: string }[];
      for (const row of rows) {
        try {
          const intent = this.require(row.exportId);
          this.owners.jobs.submit({
            ...this.recoveryIdentity(intent, row.attemptId),
            lane: "heavy",
          });
        } catch (error) {
          if (
            error instanceof CatalogError &&
            (error.code === "LIMIT_EXCEEDED" || error.code === "SERVICE_STOPPED")
          )
            break;
          errors.push(error);
        }
      }
    } finally {
      this.admittingRecovery = false;
    }
    return errors;
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
    if (
      intent.receipt ||
      intent.assembly ||
      (intent.staging && (intent.preview || intent.packageEvidence?.index))
    )
      return { state: "ready" };
    if (!intent.sourceEvidence) {
      this.owners.processing.prepare(intent.recordingId);
      const source = this.owners.processing.status(intent.recordingId);
      if (source.state !== "ready" || !source.published) return this.dependency(source);
      intent.sourceEvidence = source.published.evidence;
      this.owners.store.catalog
        .prepare("UPDATE export_intents SET sourceEvidence=? WHERE exportId=?")
        .run(JSON.stringify(intent.sourceEvidence), intent.exportId);
    }
    if (intent.kind === "processed-package") return this.admitPackage(intent);
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
  retainsScenes(recordingId: string, generation: string): boolean {
    return this.retainsPackageEvidence(recordingId, generation, "scenes");
  }
  retainsIndex(recordingId: string, generation: string): boolean {
    return this.retainsPackageEvidence(recordingId, generation, "index");
  }
  private retainsPackageEvidence(
    recordingId: string,
    generation: string,
    kind: "scenes" | "index",
  ) {
    return !!this.owners.store.catalog
      .prepare(`SELECT 1 FROM export_intents
      WHERE receipt IS NULL AND recordingId=? AND packageEvidence IS NOT NULL
      AND CASE WHEN json_valid(packageEvidence) THEN json_extract(packageEvidence,?)=? ELSE 1 END LIMIT 1`)
      .get(recordingId, `$.${kind}.generation`, generation);
  }
  private savePackageEvidence(intent: Intent) {
    this.owners.store.catalog
      .prepare("UPDATE export_intents SET packageEvidence=? WHERE exportId=?")
      .run(JSON.stringify(intent.packageEvidence), intent.exportId);
  }
  private admitPackage(intent: Intent): ReturnType<JobAdmission> {
    const owners = this.owners.package;
    const source = intent.sourceEvidence;
    if (!source) throw new CatalogError("INVALID_EVIDENCE", "Package source is not selected");
    if (owners.source.hasAudio(source, "narration"))
      throw new CatalogError(
        "UNSUPPORTED_ARTIFACT",
        "Narrated export requires accepted transcript payloads",
      );
    intent.packageEvidence ??= { scenes: null, index: null };
    if (!intent.packageEvidence.scenes) {
      owners.scenes.prepare(intent.recordingId);
      const scenes = owners.scenes.status(intent.recordingId);
      if (scenes.state !== "ready" || !scenes.published) return this.dependency(scenes);
      intent.packageEvidence.scenes = scenes.published.evidence;
      this.savePackageEvidence(intent);
    }
    if (!intent.packageEvidence.index) {
      const index = owners.index.request({
        recordingId: intent.recordingId,
        revisionId: intent.snapshot.revisionId,
        evidence: { source, scenes: intent.packageEvidence.scenes },
      });
      if (index.state !== "ready" || !index.published) return this.dependency(index);
      intent.packageEvidence.index = index.published.evidence;
      this.savePackageEvidence(intent);
    }
    return { state: "ready" };
  }
  private saveAssembly(intent: Intent) {
    this.owners.store.catalog
      .prepare("UPDATE export_intents SET assembly=? WHERE exportId=?")
      .run(intent.assembly ? JSON.stringify(intent.assembly) : null, intent.exportId);
  }
  private async cleanupAssembly(intent: Intent): Promise<void> {
    const reservation = intent.assembly;
    if (!reservation) return;
    let parent: Awaited<ReturnType<ManagedFiles["recordingDirectory"]>> | undefined;
    try {
      parent = await this.owners.files.recordingDirectory(intent.recordingId);
      if (
        parent.identity.dev !== reservation.parent.dev ||
        parent.identity.ino !== reservation.parent.ino
      )
        throw new CatalogError("INVALID_STORAGE", "Assembly recording parent changed");
      for (const child of [reservation.input, reservation.zip]) {
        if (!child.identity) {
          await recoverUnconfirmedPackageWorkspace(parent, child.name, this.owners.worker);
        } else {
          const removed = await this.owners.worker(
            "packageWorkspace.remove",
            {
              parent: reservation.parent,
              name: child.name,
              identity: child.identity,
            },
            { descriptors: [parent.handle.fd] },
          );
          if (!removed.ok)
            throw new CatalogError(
              removed.error.code,
              removed.error.message,
              removed.error.details,
              removed.error.retryable,
            );
          if (
            !removed.data ||
            typeof removed.data !== "object" ||
            !("removed" in removed.data) ||
            removed.data.removed !== true
          )
            throw new CatalogError("INVALID_NATIVE_RESPONSE", "Assembly removal was not confirmed");
        }
      }
      intent.assembly = null;
      this.saveAssembly(intent);
    } catch (error) {
      if (error instanceof CatalogError)
        throw new CatalogError(error.code, error.message, error.details, true);
      throw error;
    } finally {
      await parent?.handle.close();
    }
  }
  private async preparePackage(
    intent: Intent,
    signal: AbortSignal,
    prepare: (file: { readonly fd: number }, bytes: number) => Promise<void>,
  ) {
    await this.cleanupAssembly(intent);
    const owners = this.owners.package;
    const source = intent.sourceEvidence,
      scenes = intent.packageEvidence?.scenes,
      index = intent.packageEvidence?.index;
    if (!source || !scenes || !index)
      throw new JobDependencyLost("Package evidence is not admitted");
    const parent = await this.owners.files.recordingDirectory(intent.recordingId, signal);
    const workspaces: Awaited<ReturnType<typeof provisionPackageWorkspace>>[] = [];
    let archive: Awaited<ReturnType<typeof assemblePackage>> | undefined;
    try {
      signal.throwIfAborted();
      this.requireActive(this.require(intent.exportId));
      this.owners.store.get(intent.recordingId);
      intent.assembly = {
        parent: parent.identity,
        input: { name: randomUUID(), identity: null },
        zip: { name: randomUUID(), identity: null },
      };
      this.saveAssembly(intent);
      for (const kind of ["input", "zip"] as const) {
        const workspace = await provisionPackageWorkspace(parent, this.owners.worker, {
          name: intent.assembly[kind].name,
          signal,
        });
        workspaces.push(workspace);
        intent.assembly[kind].identity = workspace.identity;
        this.saveAssembly(intent);
      }
      const input = workspaces[0]!,
        zip = workspaces[1]!;
      archive = await assemblePackage(
        { snapshot: intent.snapshot, source, scenes, index },
        { ...owners, store: this.owners.store, worker: this.owners.worker },
        parent,
        input,
        zip,
        signal,
      );
      intent.assembly.bytes = archive.receipt.bytes;
      this.saveAssembly(intent);
      await checkWorkspace(input);
      await checkWorkspace(zip);
      await prepare(archive.file, archive.receipt.bytes);
    } finally {
      try {
        await archive?.close();
      } finally {
        await Promise.all(workspaces.map((workspace) => workspace.handle.close()));
        await parent.handle.close();
      }
    }
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
  create(request: Request) {
    const pending = this.prepareIntent(request).finally(() => this.creating.delete(pending));
    this.creating.set(pending, request.exportId);
    return pending;
  }
  private requireAdmission(exportId: string): void {
    if (this.closed)
      throw new CatalogError("SERVICE_STOPPED", "Export admission is closed", {}, true);
    if (this.retiring.has(exportId))
      throw new CatalogError("EXPORT_ABANDONING", "Export cleanup is pending; retry abandonment", {
        exportId,
      });
  }
  private async prepareIntent(request: Request) {
    this.requireAdmission(request.exportId);
    if (request.kind !== "video" && request.kind !== "processed-package")
      throw new CatalogError("INVALID_PARAMS", "Export kind must be video or processed-package");
    if (
      !uuid.test(request.exportId) ||
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
      request.kind,
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
    const selected = await this.owners.files.externalDirectory(
      request.directory,
      this.lifetime.signal,
    );
    this.lifetime.signal.throwIfAborted();
    this.requireAdmission(request.exportId);
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
          "SELECT COUNT(*) AS count FROM export_intents WHERE receipt IS NULL OR abandoning=1 OR assembly IS NOT NULL",
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
          "INSERT OR IGNORE INTO export_intents(exportId,recordingId,kind,request,snapshot,destination) VALUES (?,?,?,?,?,?)",
        )
        .run(
          request.exportId,
          request.recordingId,
          request.kind,
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
  list(
    input: {
      recordingId?: string | undefined;
      unfinishedOnly?: boolean | undefined;
      limit?: number | undefined;
      cursor?: ExportCursor | undefined;
    } = {},
  ) {
    const recordingId = input.recordingId ?? null,
      unfinishedOnly = input.unfinishedOnly ?? false,
      limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new CatalogError("INVALID_PARAMS", "Export page limit must be between 1 and 500");
    if (
      input.cursor &&
      (input.cursor.recordingId !== recordingId || input.cursor.unfinishedOnly !== unfinishedOnly)
    )
      throw new CatalogError("INVALID_CURSOR", "Export cursor does not match filters");
    const rows = this.owners.store.catalog
      .prepare(`SELECT selected.*,j.state FROM (SELECT exportId,recordingId,kind,
      json_extract(snapshot,'$.revisionId') AS revisionId,
      receipt IS NOT NULL AS committed,abandoning,
      (assembly IS NOT NULL OR (staging IS NOT NULL AND stagingCleared=0)) AS cleanupPending
      FROM export_intents WHERE exportId>? ${recordingId === null ? "" : "AND recordingId=?"}
      ${unfinishedOnly ? `AND (${unfinished})` : ""} ORDER BY exportId LIMIT ?) selected
      LEFT JOIN jobs j ON j.recordingId=selected.recordingId AND j.revisionId=selected.revisionId
      AND j.artifact=? AND j.input=selected.exportId ORDER BY selected.exportId`)
      .all(
        input.cursor?.afterExportId ?? "",
        ...(recordingId === null ? [] : [recordingId]),
        limit + 1,
        artifact,
      ) as (Omit<ExportSummary, "state" | "abandoning" | "cleanupPending"> & {
      state: Job["state"] | null;
      committed: number;
      abandoning: number;
      cleanupPending: number;
    })[];
    const exports = rows
      .slice(0, limit)
      .map(({ committed, abandoning, cleanupPending, state, ...row }): ExportSummary => {
        return {
          ...row,
          state: committed
            ? "committed"
            : state === "waiting"
              ? "queued"
              : (state ?? "not_requested"),
          abandoning: !!abandoning,
          cleanupPending: !!cleanupPending,
        };
      });
    return {
      exports,
      nextCursor:
        rows.length > limit
          ? { recordingId, unfinishedOnly, afterExportId: exports.at(-1)!.exportId }
          : null,
    };
  }
  status(exportId: string) {
    const intent = this.require(exportId);
    this.owners.store.get(intent.recordingId);
    const job = this.owners.jobs.status(this.identity(intent));
    const current = job.jobId ? this.owners.jobs.job(job.jobId) : null;
    const state = current?.state ?? "not_requested";
    const recovery = current
      ? this.owners.jobs.status(this.recoveryIdentity(intent, current.attemptId))
      : null;
    return {
      exportId,
      kind: intent.kind,
      abandoning: intent.abandoning,
      recovery,
      recordingId: intent.recordingId,
      snapshot: intent.snapshot,
      state: intent.receipt ? ("committed" as const) : state === "waiting" ? "queued" : state,
      // The admitted destination lets a restarted client describe an unfinished export
      // without keeping its own copy; output still names only a committed file.
      destination: { directory: intent.destination.directory, leaf: intent.destination.leaf },
      cleanupPending: !!intent.assembly || (!!intent.staging && !intent.stagingCleared),
      receipt: intent.receipt,
      output: intent.receipt ? join(intent.destination.directory, intent.destination.leaf) : null,
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
    if (intent.receipt)
      return intent.stagingCleared && !intent.assembly
        ? this.status(exportId)
        : this.recover(exportId);
    const job = this.owners.jobs.submitDeferred({ ...this.identity(intent), lane: "heavy" });
    this.owners.jobs.retry(job.jobId);
    return this.status(exportId);
  }
  cancel(exportId: string) {
    const intent = this.require(exportId);
    this.requireActive(intent);
    this.owners.store.get(intent.recordingId);
    if (!intent.receipt) {
      const job = this.owners.jobs.submitDeferred({ ...this.identity(intent), lane: "heavy" });
      this.owners.jobs.cancel(job.jobId);
    }
    // Only runnable/active heavy jobs are returned: the shared queue bounds this set.
    const active = this.owners.store.catalog
      .prepare(`SELECT jobId FROM jobs WHERE recordingId=?
      AND revisionId=? AND artifact=? AND input>? AND input<? AND state IN ('queued','running')`)
      .all(
        intent.recordingId,
        intent.snapshot.revisionId,
        recoveryArtifact,
        `${exportId}/`,
        `${exportId}0`,
      ) as { jobId: string }[];
    for (const recovery of active) this.owners.jobs.cancel(recovery.jobId);
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
      {
        expected: { stage: intent.staging, destination: intent.destination.identity },
        timeoutMs: publicationDeadlineMs(
          intent.receipt?.bytes ?? intent.assembly?.bytes ?? intent.preview?.bytes ?? 0,
        ),
      },
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
    if (job.artifact === recoveryArtifact) return this.reconcile({ job, signal });
    if (job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Recording exporter cannot execute this job");
    const intent = this.require(job.input);
    this.requireActive(intent);
    if (job.recordingId !== intent.recordingId || job.revisionId !== intent.snapshot.revisionId)
      throw new CatalogError("INVALID_JOB", "Export job does not match its pinned intent");
    if (intent.receipt) {
      await this.cleanupAssembly(intent);
      return JSON.stringify(intent.receipt);
    }
    signal.throwIfAborted();
    let publication = await this.open(intent);
    try {
      let observed = await publication.reconcile();
      if (observed.state === "unprepared") {
        signal.throwIfAborted();
        await publication.discard();
        if (intent.kind === "processed-package") {
          await publication.close();
          await this.preparePackage(intent, signal, async (file, bytes) => {
            publication = await this.open(intent);
            await publication.prepare(file, intent.destination.leaf, bytes, { signal });
          });
        } else {
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
      await this.cleanupAssembly(intent);
      return JSON.stringify(observed.receipt);
    } finally {
      await publication.close();
    }
  }
  /** Explicit recovery/retry requests enqueue work; status and startup never hash files. */
  recover(exportId: string) {
    const intent = this.require(exportId);
    this.requireActive(intent);
    this.owners.store.get(intent.recordingId);
    if (!intent.assembly && (!intent.staging || (intent.receipt && intent.stagingCleared)))
      return this.status(exportId);
    const original = this.owners.jobs.status(this.identity(intent));
    if (!original.jobId)
      throw new CatalogError("INVALID_JOB", "Staged export has no publication job");
    const job = this.owners.jobs.submit({
      ...this.recoveryIdentity(intent, this.owners.jobs.job(original.jobId).attemptId),
      lane: "heavy",
    });
    if (job.state === "ready") this.owners.jobs.regenerate(job.jobId, job.generation);
    else this.owners.jobs.retry(job.jobId);
    return this.status(exportId);
  }

  private async reconcile({ job, signal }: JobExecution): Promise<string> {
    const [exportId, attemptId, extra] = job.input.split("/");
    if (
      !exportId ||
      !attemptId ||
      extra !== undefined ||
      !uuid.test(exportId) ||
      !uuid.test(attemptId)
    )
      throw new CatalogError("INVALID_JOB", "Recovery identity is invalid");
    const intent = this.require(exportId);
    this.requireActive(intent);
    if (job.recordingId !== intent.recordingId || job.revisionId !== intent.snapshot.revisionId)
      throw new CatalogError("INVALID_JOB", "Recovery does not match the pinned export");
    signal.throwIfAborted();
    if (!intent.staging || (intent.receipt && intent.stagingCleared)) {
      await this.cleanupAssembly(intent);
      return JSON.stringify({ observation: null });
    }
    const publication = await this.open(intent);
    try {
      if (intent.receipt) {
        await publication.discard();
        this.markStagingCleared(intent.exportId);
        await this.cleanupAssembly(intent);
        return JSON.stringify({ observation: null });
      }
      const observed = await publication.reconcile({ signal });
      if (observed.state === "committed" && observed.receipt) {
        this.recordCommit(intent, observed.receipt);
        if (!signal.aborted) {
          await publication.acknowledge();
          this.markStagingCleared(intent.exportId);
        }
      }
      await this.cleanupAssembly(intent);
      return JSON.stringify({ observation: observed.state });
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
    // Destination admission can precede the intent row; absence is final only after those calls drain.
    await Promise.allSettled(
      [...this.creating].filter(([, id]) => id === exportId).map(([pending]) => pending),
    );
    let intent = this.find(exportId);
    if (!intent) return;
    const jobId = this.owners.jobs.status(this.identity(intent)).jobId;
    if (jobId) await this.owners.jobs.drainJob(jobId);
    // The durable intent fence stops every recovery identity before any drain begins.
    const recoveryJobs = this.owners.store.catalog.prepare(`SELECT jobId,input FROM jobs
      WHERE recordingId=? AND revisionId=? AND artifact=? AND input>? AND input<? ORDER BY input LIMIT 1`);
    let after = `${exportId}/`;
    for (;;) {
      const recovery = recoveryJobs.get(
        intent.recordingId,
        intent.snapshot.revisionId,
        recoveryArtifact,
        after,
        `${exportId}0`,
      ) as { jobId: string; input: string } | undefined;
      if (!recovery) break;
      after = recovery.input;
      await this.owners.jobs.drainJob(recovery.jobId);
      this.owners.jobs.forgetJob(recovery.jobId);
      await setImmediate();
    }
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
    await this.cleanupAssembly(intent);
    if (jobId) this.owners.jobs.forgetJob(jobId);
    // A crash after job retirement is harmless: the still-fenced intent resumes private absence checking.
    this.owners.store.catalog.prepare("DELETE FROM export_intents WHERE exportId=?").run(exportId);
  }
}
