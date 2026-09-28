import { ResourceReferences, resourceKinds } from "@screenrec/core/references";
import { resourceIdentity } from "@screenrec/core/project-package";
import type { ProjectPackages, PinnedProjectPackage } from "./project-packages.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { type RevisionStore } from "@screenrec/core/library";
import { CatalogError, type Catalog } from "@screenrec/core/catalog";
import type { DerivedCache, DirectoryIdentity } from "@screenrec/core/cache";
import {
  JobDependencyLost,
  ownerIdentity,
  type JobOwner,
  type Job,
  type JobAdmission,
  type JobExecution,
  type JobQueue,
} from "@screenrec/core/jobs";
import type { ProjectStore } from "@screenrec/core/projects";
import type {
  ProjectPreviewInspection,
  PinnedProjectPreview,
} from "@screenrec/core/project-preview";
import type { SourceEvidenceMetadata } from "@screenrec/core/evidence";
import type { SourceProcessing } from "@screenrec/core/processing";
import type {
  PreviewInspection,
  PreviewArtifact,
} from "@screenrec/core/preview";
import {
  Publication,
  publicationDeadlineMs,
  type PublicationReceipt,
} from "./publication.js";
import {
  provisionPackageWorkspace,
  removePackageWorkspace,
} from "./package-workspace.js";
import {
  assemblePackage,
  checkWorkspace,
  type PackageOwners,
  type PackageEvidence,
  type AssemblyReservation,
} from "./package-assembly.js";
import type { ManagedFiles } from "./managed-files.js";
import type { MediaWorker } from "./worker.js";

type Request = {
  exportId: string;
  revisionId?: string | undefined;
  directory: string;
  leaf: string;
} & (
  | { kind: "video" | "processed-package"; recordingId: string }
  | { kind: "video" | "processed-package"; projectId: string }
);
type ExportOwner = Extract<JobOwner, { kind: "recording" | "project" }>;
type ExportCursor = {
  recordingId: string | null;
  projectId: string | null;
  unfinishedOnly: boolean;
  afterExportId: string;
};
type Snapshot = ReturnType<RevisionStore["pinPackageSnapshot"]>["snapshot"];
type ReadyPreview = Pick<PreviewArtifact, "cacheId" | "bytes"> & {
  generation: number;
};
type Intent = {
  kind: Request["kind"];
  packageEvidence: PackageEvidence | null;
  assembly: AssemblyReservation | null;
  exportId: string;
  targetKind: "recording" | "project";
  targetId: string;
  request: string;
  snapshot: Snapshot | PinnedProjectPreview | PinnedProjectPackage;
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
const artifact = "export-media",
  recoveryArtifact = "export-recovery";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const stageName = (id: string) => `.screenrec-export-${id}`;

/** Lifecycle columns as stored: JSON or null for staging, assembly and receipt, 0/1 flags. */
type Lifecycle = {
  staging: unknown;
  stagingCleared: number;
  assembly: unknown;
  receipt: unknown;
  abandoning: unknown;
};
/** Staging bytes or the staging directory beside the destination may still exist. */
const stagingPending = (row: Pick<Lifecycle, "staging" | "stagingCleared">) =>
  !!row.staging && !row.stagingCleared;
/** Private obligations remain: staging beside the destination or package assembly workspaces. */
const cleanupPending = (row: Lifecycle) =>
  !!row.assembly || stagingPending(row);
// Partial indexes and page filters need these predicates in SQL; each mirrors its TS twin above.
const stagingPendingSql = "(staging IS NOT NULL AND stagingCleared=0)";
const cleanupPendingSql = `(assembly IS NOT NULL OR ${stagingPendingSql})`;
const unfinishedSql = `(receipt IS NULL OR abandoning=1 OR ${cleanupPendingSql})`;
/** Intents that still pin prerequisites or library workspaces count against admission. */
const admittedSql = "(receipt IS NULL OR abandoning=1 OR assembly IS NOT NULL)";

/** The summary both discovery pages and status report for one intent. */
function summarize(row: Lifecycle, job: Job["state"] | null) {
  return {
    state: row.receipt
      ? ("committed" as const)
      : job === "waiting"
        ? ("queued" as const)
        : (job ?? ("not_requested" as const)),
    abandoning: !!row.abandoning,
    cleanupPending: cleanupPending(row),
  };
}

/** Durable external truth belongs here; execution state and retries remain in JobQueue.
 * Prerequisites wait in that queue while this owner pins their source generation. */
export class MediaExports {
  private readonly references: ResourceReferences;
  private readonly creating = new Map<Promise<unknown>, string>();
  private readonly lifetime = new AbortController();
  private readonly retiring = new Map<string, Promise<void>>();
  private closed = false;
  private admittingRecovery = false;
  constructor(
    private readonly owners: {
      catalog: Catalog;
      jobs: JobQueue;
      cache: DerivedCache;
      worker: MediaWorker;
      files: Pick<ManagedFiles, "externalDirectory">;
      recording?: {
        store: RevisionStore;
        preview: PreviewInspection;
        processing: SourceProcessing;
        package: PackageOwners;
        files: Pick<ManagedFiles, "recordingDirectory">;
      };
      project?: { store: ProjectStore; preview: ProjectPreviewInspection; package?: ProjectPackages };
    },
  ) {
    this.references = new ResourceReferences(owners.catalog);
    owners.catalog.catalog.exec(`CREATE TABLE IF NOT EXISTS export_intents (
      exportId TEXT PRIMARY KEY, targetKind TEXT NOT NULL CHECK(targetKind IN ('recording','project')), targetId TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('video','processed-package')),
      request TEXT NOT NULL, snapshot TEXT NOT NULL, destination TEXT NOT NULL,
      staging TEXT, stagingCleared INTEGER NOT NULL DEFAULT 0 CHECK(stagingCleared IN (0,1)),
      preview TEXT, sourceEvidence TEXT, packageEvidence TEXT, assembly TEXT, receipt TEXT,
      abandoning INTEGER NOT NULL DEFAULT 0 CHECK(abandoning IN (0,1))
    ) STRICT; CREATE INDEX IF NOT EXISTS export_intents_pending ON export_intents(targetKind,targetId) WHERE ${admittedSql};
    CREATE INDEX IF NOT EXISTS export_intents_storage ON export_intents(exportId) WHERE ${stagingPendingSql};
    CREATE INDEX IF NOT EXISTS export_intents_owner ON export_intents(targetKind,targetId,exportId);
    CREATE INDEX IF NOT EXISTS export_discovery_unfinished ON export_intents(exportId) WHERE ${unfinishedSql};
    CREATE INDEX IF NOT EXISTS export_discovery_owner_unfinished ON export_intents(targetKind,targetId,exportId) WHERE ${unfinishedSql};`);
  }
  private recording() {
    if (!this.owners.recording)
      throw new CatalogError(
        "UNSUPPORTED_TARGET",
        "Recording exports are unavailable in this service",
      );
    return this.owners.recording;
  }
  private project() {
    if (!this.owners.project)
      throw new CatalogError(
        "UNSUPPORTED_TARGET",
        "Project exports are unavailable in this service",
      );
    return this.owners.project;
  }
  private projectPackage() {
    const packages = this.project().package;
    if (!packages) throw new CatalogError("NOT_READY", "Project packages are unavailable in this service");
    return packages;
  }
  private packageDirectory(intent: Pick<Intent, "targetKind" | "targetId">, signal?: AbortSignal) {
    return intent.targetKind === "project" ? this.projectPackage().exportDirectory() : this.recording().files.recordingDirectory(intent.targetId, signal);
  }
  private owner(intent: Pick<Intent, "targetKind" | "targetId">): ExportOwner {
    return intent.targetKind === "recording"
      ? { kind: "recording", recordingId: intent.targetId }
      : { kind: "project", projectId: intent.targetId };
  }
  private assertOwner(intent: Pick<Intent, "targetKind" | "targetId">) {
    if (intent.targetKind === "recording")
      this.recording().store.get(intent.targetId);
    else this.project().store.get(intent.targetId);
  }
  private deleting(owner: ExportOwner) {
    return owner.kind === "recording"
      ? this.recording().store.isDeleting(owner.recordingId)
      : this.project().store.isDeleting(owner.projectId);
  }
  private matches(job: Job, intent: Intent) {
    return (
      ownerIdentity(job.target).every(
        (value, index) => value === ownerIdentity(this.owner(intent))[index],
      ) &&
      "revisionId" in job.target &&
      job.target.revisionId === intent.snapshot.revisionId
    );
  }
  private find(exportId: string): Intent | null {
    const row = this.owners.catalog.catalog
      .prepare("SELECT * FROM export_intents WHERE exportId=?")
      .get(exportId) as Row | undefined;
    if (!row) return null;
    return {
      ...row,
      abandoning: row.abandoning === 1,
      // A selection stored without a transcript field selected none.
      packageEvidence: row.packageEvidence
        ? { transcript: null, ...JSON.parse(row.packageEvidence) }
        : null,
      assembly: row.assembly ? JSON.parse(row.assembly) : null,
      snapshot: JSON.parse(row.snapshot),
      destination: JSON.parse(row.destination),
      staging: row.staging ? JSON.parse(row.staging) : null,
      preview: row.preview ? JSON.parse(row.preview) : null,
      sourceEvidence: row.sourceEvidence
        ? JSON.parse(row.sourceEvidence)
        : null,
      receipt: row.receipt ? JSON.parse(row.receipt) : null,
    };
  }
  private require(exportId: string): Intent {
    const intent = this.find(exportId);
    if (!intent)
      throw new CatalogError("NOT_FOUND", "Export intent does not exist", {
        exportId,
      });
    return intent;
  }
  private requireActive(intent: Intent): void {
    if (intent.abandoning)
      throw new CatalogError(
        "EXPORT_ABANDONING",
        "Export cleanup is pending; retry abandonment",
        {
          exportId: intent.exportId,
        },
      );
  }

  abandon(exportId: string): Promise<void> {
    if (this.closed)
      throw new CatalogError(
        "SERVICE_STOPPED",
        "Export cleanup is closed",
        {},
        true,
      );
    this.owners.catalog.catalog
      .prepare("UPDATE export_intents SET abandoning=1 WHERE exportId=?")
      .run(exportId);
    return this.retire(exportId);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.lifetime.abort();
    await Promise.allSettled([
      ...this.creating.keys(),
      ...this.retiring.values(),
    ]);
  }

  private identity(intent: Intent) {
    return {
      target: { ...this.owner(intent), revisionId: intent.snapshot.revisionId },

      artifact,
      input: intent.exportId,
    };
  }
  private recoveryIdentity(intent: Intent, attemptId: string) {
    return {
      target: { ...this.owner(intent), revisionId: intent.snapshot.revisionId },

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
      const rows = this.owners.catalog.catalog
        .prepare(
          `SELECT i.exportId,j.attemptId FROM export_intents i
        JOIN jobs j ON j.targetKind=i.targetKind AND j.targetId=i.targetId AND j.artifact=? AND j.input=i.exportId
        WHERE ${cleanupPendingSql} AND i.abandoning=0
        AND j.state IN ('failed','canceled','ready','unavailable')
        AND ${this.owners.recording ? "NOT (i.targetKind='recording' AND EXISTS(SELECT 1 FROM recording_deletions d WHERE d.recordingId=i.targetId))" : "i.targetKind<>'recording'"}
        AND ${this.owners.project ? "NOT (i.targetKind='project' AND EXISTS(SELECT 1 FROM projects p WHERE p.projectId=i.targetId AND p.deletedAt IS NOT NULL))" : "i.targetKind<>'project'"}
        AND NOT EXISTS(SELECT 1 FROM jobs r WHERE r.targetKind=j.targetKind AND r.targetId=j.targetId AND r.revisionId=j.revisionId
          AND r.artifact=? AND r.input=i.exportId || '/' || j.attemptId)
        ORDER BY i.exportId LIMIT 32`,
        )
        .all(artifact, recoveryArtifact) as {
        exportId: string;
        attemptId: string;
      }[];
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
            (error.code === "LIMIT_EXCEEDED" ||
              error.code === "SERVICE_STOPPED")
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
    return !!this.owners.catalog.catalog
      .prepare(
        `SELECT 1 FROM export_intents
      WHERE receipt IS NULL AND targetKind='recording' AND targetId=? AND sourceEvidence IS NOT NULL
      AND json_extract(sourceEvidence,'$.generation')=? LIMIT 1`,
      )
      .get(recordingId, generation);
  }
  private hasPreparedInput(intent: Intent): boolean {
    // A staged attempt may already have committed; reconcile before asking dependencies again.
    if (
      intent.receipt ||
      intent.assembly ||
      (intent.staging && (intent.preview || intent.packageEvidence?.index))
    )
      return true;
    if (intent.preview) {
      const read = this.owners.cache.acquire(intent.preview.cacheId);
      if (read) {
        try {
          if (read.bytes !== intent.preview.bytes)
            throw new CatalogError(
              "INVALID_CACHE",
              "Pinned preview size changed",
            );
          return true;
        } finally {
          read.release();
        }
      }
    }
    return false;
  }
  admit(job: Job): ReturnType<JobAdmission> {
    const intent = this.require(job.input);
    this.requireActive(intent);
    if (job.artifact !== artifact || !this.matches(job, intent))
      throw new CatalogError(
        "INVALID_JOB",
        "Export job does not match its pinned intent",
      );
    if (this.hasPreparedInput(intent)) return { state: "ready" };
    let ready;
    if (intent.targetKind === "project") {
      if (intent.kind === "processed-package") return { state: "ready" };
      const pinned = intent.snapshot as PinnedProjectPreview;
      ready = this.project().preview.request(pinned);
    } else {
      if (!intent.sourceEvidence) {
        this.recording().processing.prepare(intent.targetId);
        const source = this.recording().processing.status(intent.targetId);
        if (source.state !== "ready" || !source.published)
          return this.dependency(source);
        intent.sourceEvidence = source.published.evidence;
        this.owners.catalog.catalog
          .prepare(
            "UPDATE export_intents SET sourceEvidence=? WHERE exportId=?",
          )
          .run(JSON.stringify(intent.sourceEvidence), intent.exportId);
      }
      if (intent.kind === "processed-package") return this.admitPackage(intent);
      ready = this.recording().preview.request({
        recordingId: intent.targetId,
        revisionId: intent.snapshot.revisionId,
        sourceEvidence: intent.sourceEvidence,
        rendition: "source",
      });
    }
    if (ready.state !== "ready" || !ready.published)
      return this.dependency(ready);
    intent.preview = {
      cacheId: ready.published.preview.cacheId,
      bytes: ready.published.preview.bytes,
      generation: ready.published.generation,
    };
    this.owners.catalog.catalog
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
  retainsTranscript(recordingId: string, generation: string): boolean {
    return this.retainsPackageEvidence(recordingId, generation, "transcript");
  }
  private retainsPackageEvidence(
    recordingId: string,
    generation: string,
    kind: keyof PackageEvidence,
  ) {
    return !!this.owners.catalog.catalog
      .prepare(
        `SELECT 1 FROM export_intents
      WHERE receipt IS NULL AND targetKind='recording' AND targetId=? AND packageEvidence IS NOT NULL
      AND json_extract(packageEvidence,?)=? LIMIT 1`,
      )
      .get(recordingId, `$.${kind}.generation`, generation);
  }
  private savePackageEvidence(intent: Intent) {
    this.owners.catalog.catalog
      .prepare("UPDATE export_intents SET packageEvidence=? WHERE exportId=?")
      .run(JSON.stringify(intent.packageEvidence), intent.exportId);
  }
  private admitPackage(intent: Intent): ReturnType<JobAdmission> {
    const owners = this.recording().package;
    const source = intent.sourceEvidence;
    if (!source)
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Package source is not selected",
      );
    intent.packageEvidence ??= { scenes: null, index: null, transcript: null };
    // Acquired narration, never a caller flag, makes the transcript required.
    if (
      owners.source.hasAudio(source, "narration") &&
      !intent.packageEvidence.transcript
    ) {
      owners.transcript.prepare(intent.targetId);
      const transcript = owners.transcript.status(intent.targetId);
      // Unprepared models start no job, so there is nothing to wait on; the caller must act.
      if (transcript.state === "failed" || transcript.state === "unavailable")
        throw transcript.reason === "model_not_prepared"
          ? new CatalogError(
              "MODEL_NOT_PREPARED",
              "Narrated export needs a transcript; prepare speech models, then retry the export",
              {},
              true,
            )
          : new CatalogError(
              "DEPENDENCY_FAILED",
              `Narrated export needs a transcript, which failed (${transcript.reason}); retry transcription, then retry the export`,
              { dependency: transcript.jobId },
              transcript.retryable,
            );
      if (transcript.state !== "ready" || !transcript.published)
        return this.dependency(transcript);
      intent.packageEvidence.transcript = transcript.published.transcript;
      this.savePackageEvidence(intent);
    }
    if (!intent.packageEvidence.scenes) {
      owners.scenes.prepare(intent.targetId);
      const scenes = owners.scenes.status(intent.targetId);
      if (scenes.state !== "ready" || !scenes.published)
        return this.dependency(scenes);
      intent.packageEvidence.scenes = scenes.published.evidence;
      this.savePackageEvidence(intent);
    }
    if (!intent.packageEvidence.index) {
      const index = owners.index.request({
        recordingId: intent.targetId,
        revisionId: intent.snapshot.revisionId,
        evidence: { source, scenes: intent.packageEvidence.scenes },
      });
      if (index.state !== "ready" || !index.published)
        return this.dependency(index);
      intent.packageEvidence.index = index.published.evidence;
      this.savePackageEvidence(intent);
    }
    return { state: "ready" };
  }
  private saveAssembly(intent: Intent) {
    this.owners.catalog.catalog
      .prepare("UPDATE export_intents SET assembly=? WHERE exportId=?")
      .run(
        intent.assembly ? JSON.stringify(intent.assembly) : null,
        intent.exportId,
      );
  }
  private async cleanupAssembly(intent: Intent): Promise<void> {
    const reservation = intent.assembly;
    if (!reservation) return;
    let parent:
      Awaited<ReturnType<ManagedFiles["recordingDirectory"]>> | undefined;
    try {
      parent = await this.packageDirectory(intent);
      if (
        parent.identity.dev !== reservation.parent.dev ||
        parent.identity.ino !== reservation.parent.ino
      )
        throw new CatalogError(
          "INVALID_STORAGE",
          "Assembly parent changed",
        );
      for (const child of [reservation.input, reservation.zip])
        await removePackageWorkspace(
          parent,
          child.name,
          child.identity,
          this.owners.worker,
        );
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
    const owners = intent.targetKind === "recording" ? this.recording().package : null;
    const source = intent.sourceEvidence,
      scenes = intent.packageEvidence?.scenes,
      index = intent.packageEvidence?.index,
      transcript = intent.packageEvidence?.transcript ?? null;
    if (
      owners && (!source || !scenes || !index || (!transcript && owners.source.hasAudio(source, "narration")))
    )
      throw new JobDependencyLost("Package evidence is not admitted");
    const parent = await this.packageDirectory(intent, signal);
    const workspaces: Awaited<ReturnType<typeof provisionPackageWorkspace>>[] =
      [];
    let archive: Awaited<ReturnType<typeof assemblePackage>> | undefined;
    try {
      signal.throwIfAborted();
      this.requireActive(this.require(intent.exportId));
      this.assertOwner(intent);
      intent.assembly = {
        parent: parent.identity,
        input: { name: randomUUID(), identity: null },
        zip: { name: randomUUID(), identity: null },
      };
      this.saveAssembly(intent);
      for (const kind of ["input", "zip"] as const) {
        const workspace = await provisionPackageWorkspace(
          parent,
          this.owners.worker,
          {
            name: intent.assembly[kind].name,
            signal,
          },
        );
        workspaces.push(workspace);
        intent.assembly[kind].identity = workspace.identity;
        this.saveAssembly(intent);
      }
      const input = workspaces[0]!,
        zip = workspaces[1]!;
      archive = owners
        ? await assemblePackage(
            { snapshot: intent.snapshot as Snapshot, source: source!, scenes: scenes!, index: index!, transcript },
            { ...owners, store: this.recording().store, worker: this.owners.worker }, parent, input, zip, signal,
          )
        : await this.projectPackage().assemble(intent.snapshot as PinnedProjectPackage, input, zip, signal);
      intent.assembly.bytes = archive.receipt.bytes;
      this.saveAssembly(intent);
      await checkWorkspace(input);
      await checkWorkspace(zip);
      await prepare(archive.file, archive.receipt.bytes);
    } finally {
      try {
        await archive?.close();
      } finally {
        await Promise.all(
          workspaces.map((workspace) => workspace.handle.close()),
        );
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
      throw new CatalogError(
        "INVALID_STATE",
        "Waiting export dependency has no job identity",
      );
    return { state: "waiting", dependency: status.jobId };
  }
  create(request: Request) {
    const pending = this.prepareIntent(request).finally(() =>
      this.creating.delete(pending),
    );
    this.creating.set(pending, request.exportId);
    return pending;
  }
  private requireAdmission(exportId: string): void {
    if (this.closed)
      throw new CatalogError(
        "SERVICE_STOPPED",
        "Export admission is closed",
        {},
        true,
      );
    if (this.retiring.has(exportId))
      throw new CatalogError(
        "EXPORT_ABANDONING",
        "Export cleanup is pending; retry abandonment",
        {
          exportId,
        },
      );
  }
  private async prepareIntent(request: Request) {
    this.requireAdmission(request.exportId);
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
    const targetKind = "projectId" in request ? "project" : "recording";
    const targetId =
      "projectId" in request ? request.projectId : request.recordingId;
    const key = JSON.stringify([
      request.kind,
      targetKind,
      targetId,
      request.revisionId ?? null,
      request.directory,
      request.leaf,
    ]);
    const existing = this.find(request.exportId);
    if (existing) {
      if (existing.request !== key)
        throw new CatalogError(
          "REQUEST_CONFLICT",
          "Export identity names a different request",
        );
      this.requireActive(existing);
      this.assertOwner(existing);
      if (!existing.receipt)
        this.owners.jobs.submitDeferred({
          ...this.identity(existing),
          lane: "heavy",
        });
      return this.status(existing.exportId);
    }
    const snapshot =
      targetKind === "project"
        ? request.kind === "processed-package"
          ? this.projectPackage().pin(targetId, request.revisionId)
          : this.project().preview.pin({
            projectId: targetId,
            revisionId: request.revisionId,
          })
        : this.recording().store.pinPackageSnapshot(
            targetId,
            request.revisionId,
          ).snapshot;
    const selected = await this.owners.files.externalDirectory(
      request.directory,
      this.lifetime.signal,
    );
    this.lifetime.signal.throwIfAborted();
    this.requireAdmission(request.exportId);
    this.assertOwner({ targetKind, targetId });
    const destination = { ...selected, leaf: request.leaf };
    const intent = this.owners.catalog.transaction(() => {
      const existing = this.find(request.exportId);
      if (existing) {
        if (existing.request !== key)
          throw new CatalogError(
            "REQUEST_CONFLICT",
            "Export identity names a different request",
          );
        this.requireActive(existing);
        return existing;
      }
      const pending = this.owners.catalog.catalog
        .prepare(
          `SELECT COUNT(*) AS count FROM export_intents WHERE ${admittedSql}`,
        )
        .get() as { count: number };
      if (pending.count >= 32)
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Too many uncommitted exports retain their prerequisites",
          {},
          true,
        );
      this.owners.catalog.catalog
        .prepare(
          "INSERT OR IGNORE INTO export_intents(exportId,targetKind,targetId,kind,request,snapshot,destination) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          request.exportId,
          targetKind,
          targetId,
          request.kind,
          key,
          JSON.stringify(snapshot),
          JSON.stringify(destination),
        );
      if (targetKind === "project" && request.kind === "processed-package") {
        const pinned = snapshot as PinnedProjectPackage;
        this.projectPackage().checkPinned(pinned);
        for (const resource of pinned.resources) {
          const identity = resourceIdentity(resource);
          this.references.retain(identity.kind, { kind: "export", id: request.exportId }, [identity.id]);
        }
      }
      const admitted = this.require(request.exportId);
      if (admitted.request !== key)
        throw new CatalogError(
          "REQUEST_CONFLICT",
          "Export identity names a different request",
        );
      return admitted;
    });
    this.owners.jobs.submitDeferred({
      ...this.identity(intent),
      lane: "heavy",
    });
    return this.status(request.exportId);
  }
  private ownerFields(intent: Pick<Intent, "targetKind" | "targetId">) {
    return intent.targetKind === "recording"
      ? { recordingId: intent.targetId }
      : { projectId: intent.targetId };
  }
  list(
    input: {
      recordingId?: string | undefined;
      projectId?: string | undefined;
      unfinishedOnly?: boolean | undefined;
      limit?: number | undefined;
      cursor?: ExportCursor | undefined;
    } = {},
  ) {
    const recordingId = input.recordingId ?? null,
      projectId = input.projectId ?? null,
      unfinishedOnly = input.unfinishedOnly ?? false,
      limit = input.limit ?? 100;
    if (recordingId !== null && projectId !== null)
      throw new CatalogError(
        "INVALID_PARAMS",
        "Choose one export owner filter",
      );
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new CatalogError(
        "INVALID_PARAMS",
        "Export page limit must be1–1000",
      );
    if (
      input.cursor &&
      (input.cursor.recordingId !== recordingId ||
        input.cursor.projectId !== projectId ||
        input.cursor.unfinishedOnly !== unfinishedOnly)
    )
      throw new CatalogError(
        "INVALID_CURSOR",
        "Export cursor does not match filters",
      );
    const owner: ExportOwner | undefined =
      recordingId !== null
        ? { kind: "recording", recordingId }
        : projectId !== null
          ? { kind: "project", projectId }
          : undefined;
    const rows = this.owners.catalog.catalog
      .prepare(
        `SELECT selected.*,j.state FROM (SELECT exportId,targetKind,targetId,kind,
      json_extract(snapshot,'$.revisionId') AS revisionId,receipt IS NOT NULL AS receipt,abandoning,
      assembly IS NOT NULL AS assembly,staging IS NOT NULL AS staging,stagingCleared
      FROM export_intents WHERE exportId>? ${owner ? "AND targetKind=? AND targetId=?" : ""}
      ${unfinishedOnly ? `AND ${unfinishedSql}` : ""} ORDER BY exportId LIMIT ?) selected
      LEFT JOIN jobs j ON j.targetKind=selected.targetKind AND j.targetId=selected.targetId AND j.revisionId=selected.revisionId
      AND j.artifact=? AND j.input=selected.exportId ORDER BY selected.exportId`,
      )
      .all(
        input.cursor?.afterExportId ?? "",
        ...(owner ? ownerIdentity(owner) : []),
        limit + 1,
        artifact,
      ) as (Lifecycle & {
      exportId: string;
      targetKind: Intent["targetKind"];
      targetId: string;
      kind: Request["kind"];
      revisionId: string;
      state: Job["state"] | null;
    })[];
    const exports = rows
      .slice(0, limit)
      .map(
        ({
          exportId,
          targetKind,
          targetId,
          kind,
          revisionId,
          state,
          ...lifecycle
        }) => ({
          exportId,
          ...this.ownerFields({ targetKind, targetId }),
          kind,
          revisionId,
          ...summarize(lifecycle, state),
        }),
      );
    return {
      exports,
      nextCursor:
        rows.length > limit
          ? {
              recordingId,
              projectId,
              unfinishedOnly,
              afterExportId: exports.at(-1)!.exportId,
            }
          : null,
    };
  }
  /** Reads the durable intent even while its owner is being deleted, as discovery does. */
  status(exportId: string) {
    const intent = this.require(exportId);
    const job = this.owners.jobs.status(this.identity(intent));
    const current = job.jobId ? this.owners.jobs.job(job.jobId) : null;
    const recovery = current
      ? this.owners.jobs.status(
          this.recoveryIdentity(intent, current.attemptId),
        )
      : null;
    return {
      exportId,
      kind: intent.kind,
      ...summarize(intent, current?.state ?? null),
      recovery,
      ...this.ownerFields(intent),
      snapshot: intent.snapshot,
      // A restarted client can describe an unfinished export from this alone; output still
      // names only a committed file.
      destination: {
        directory: intent.destination.directory,
        leaf: intent.destination.leaf,
      },
      receipt: intent.receipt,
      output: intent.receipt
        ? join(intent.destination.directory, intent.destination.leaf)
        : null,
      jobId: job.jobId,
      reason: intent.receipt ? null : job.reason,
      retryable: !intent.receipt && job.retryable,
    };
  }
  /** Private staging remains attributed to its owner even when it lives beside an external destination. */
  async usage(
    owner: ExportOwner | undefined,
    signal: AbortSignal,
  ): Promise<number> {
    let after = "",
      bytes = 0;
    const query = this.owners.catalog.catalog.prepare(
      `SELECT exportId FROM export_intents WHERE ${owner === undefined ? "" : "targetKind=? AND targetId=? AND "}${stagingPendingSql} AND exportId>? ORDER BY exportId LIMIT 1`,
    );
    for (;;) {
      signal.throwIfAborted();
      const row = (
        owner === undefined
          ? query.get(after)
          : query.get(...ownerIdentity(owner), after)
      ) as { exportId: string } | undefined;
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
        // Retirement can remove staging during a live observation, and a destination that is gone
        // or replaced holds nothing this library can measure. A substituted entry stays an error.
        if ((await this.stagingPresence(intent, signal)) === "present")
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
    this.assertOwner(intent);
    // An acknowledged commit never becomes a second export because the user moved/deleted it.
    if (intent.receipt)
      return cleanupPending(intent)
        ? this.recover(exportId)
        : this.status(exportId);
    if (intent.targetKind === "project" && !this.hasPreparedInput(intent)) {
      const pinned = intent.snapshot as PinnedProjectPreview;
      const repairable = (job: Job) => {
        if (job.state !== "failed" || !job.retryable) return false;
        if (job.errorCode === "NOT_READY")
          return job.errorDetails?.implementationId === pinned.implementationId;
        if (job.errorCode !== "DEPENDENCY_FAILED" || typeof job.errorDetails?.dependency !== "string")
          return false;
        return this.owners.jobs.job(job.errorDetails.dependency).artifact === "pointer-presentation";
      };
      const prior = this.owners.jobs.status(this.identity(intent));
      if (prior.jobId) {
        let failure = this.owners.jobs.job(prior.jobId);
        if (failure.errorCode === "DEPENDENCY_FAILED" && typeof failure.errorDetails?.dependency === "string")
          failure = this.owners.jobs.job(failure.errorDetails.dependency);
        if (repairable(failure)) {
          const current = this.project().preview.request(pinned);
          if (current.jobId && repairable(this.owners.jobs.job(current.jobId)))
            this.project().preview.retry(pinned);
        }
      }
    }
    const job = this.owners.jobs.submitDeferred({
      ...this.identity(intent),
      lane: "heavy",
    });
    this.owners.jobs.retry(job.jobId);
    return this.status(exportId);
  }
  cancel(exportId: string) {
    const intent = this.require(exportId);
    this.requireActive(intent);
    this.assertOwner(intent);
    const { jobId } = this.owners.jobs.status(this.identity(intent));
    if (!intent.receipt && jobId) this.owners.jobs.cancel(jobId);
    // Only runnable/active heavy jobs are returned: the shared queue bounds this set.
    const active = this.owners.catalog.catalog
      .prepare(
        `SELECT jobId FROM jobs WHERE targetKind=? AND targetId=?
      AND revisionId=? AND artifact=? AND input>? AND input<? AND state IN ('queued','running')`,
      )
      .all(
        intent.targetKind,
        intent.targetId,
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
      this.owners.catalog.transaction(() =>
        this.owners.catalog.catalog
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
        expected: {
          stage: intent.staging,
          destination: intent.destination.identity,
        },
        timeoutMs: publicationDeadlineMs(
          intent.receipt?.bytes ??
            intent.assembly?.bytes ??
            intent.preview?.bytes ??
            0,
        ),
      },
    );
  }
  private stagingPresence(intent: Intent, signal?: AbortSignal) {
    return Publication.staging(
      intent.destination.directory,
      intent.destination.identity,
      stageName(intent.exportId),
      this.owners.worker,
      signal,
    );
  }
  /** Removes private evidence and then its directory while the publication lock is held. */
  private async retireStaging(
    intent: Intent,
    publication: Publication,
    evidence: "acknowledge" | "discard",
  ) {
    await publication[evidence]();
    await publication.retire(stageName(intent.exportId));
    this.markStagingCleared(intent.exportId);
  }
  /** The receipt is durable before private cleanup. An aborted attempt leaves that cleanup to
   * its canceling owner or to recovery rather than racing their drain. */
  private async settleCommit(
    intent: Intent,
    publication: Publication,
    receipt: PublicationReceipt,
    signal: AbortSignal,
  ) {
    this.recordCommit(intent, receipt);
    if (!signal.aborted)
      await this.retireStaging(intent, publication, "acknowledge");
  }
  private markStagingCleared(exportId: string) {
    this.owners.catalog.catalog
      .prepare("UPDATE export_intents SET stagingCleared=1 WHERE exportId=?")
      .run(exportId);
  }
  private recordCommit(intent: Intent, receipt: PublicationReceipt) {
    // This write is allowed during deletion/cancellation: the file already exists outside the library.
    this.owners.catalog.transaction(() => {
      this.owners.catalog.catalog.prepare("UPDATE export_intents SET receipt=? WHERE exportId=?").run(JSON.stringify(receipt), intent.exportId);
      for (const kind of resourceKinds) this.references.release(kind, { kind: "export", id: intent.exportId });
    });
    intent.receipt = receipt;
  }
  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.artifact === recoveryArtifact)
      return this.reconcile({ job, signal });
    if (job.artifact !== artifact)
      throw new CatalogError(
        "UNSUPPORTED_JOB",
        "Media exporter cannot execute this job",
      );
    const intent = this.require(job.input);
    this.requireActive(intent);
    if (!this.matches(job, intent))
      throw new CatalogError(
        "INVALID_JOB",
        "Export job does not match its pinned intent",
      );
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
            await publication.prepare(file, intent.destination.leaf, bytes, {
              signal,
            });
          });
        } else {
          try {
            if (!intent.preview)
              throw new JobDependencyLost("Preview is not admitted");
            const preview = intent.preview;
            await this.owners.cache.withDescriptor(
              preview.cacheId,
              async (source) => {
                if (source.bytes !== preview.bytes)
                  throw new CatalogError(
                    "INVALID_CACHE",
                    "Pinned preview size changed",
                  );
                await publication.prepare(
                  source,
                  intent.destination.leaf,
                  source.bytes,
                  { signal },
                );
              },
            );
          } catch (error) {
            if (
              error instanceof JobDependencyLost ||
              (error instanceof CatalogError &&
                error.code === "ARTIFACT_EXPIRED")
            ) {
              this.owners.catalog.catalog
                .prepare(
                  "UPDATE export_intents SET preview=NULL WHERE exportId=?",
                )
                .run(intent.exportId);
              throw new JobDependencyLost(
                "Preview disappeared before preparation",
              );
            }
            throw error;
          }
        }
        observed = await publication.commit({ signal });
      } else if (observed.state === "missing")
        observed = await publication.commit({ signal });
      if (observed.state !== "committed" || !observed.receipt)
        throw new CatalogError(
          "DESTINATION_CHANGED",
          "Export destination belongs to another file or was modified",
          { state: observed.state },
        );
      await this.settleCommit(intent, publication, observed.receipt, signal);
      await this.cleanupAssembly(intent);
      return JSON.stringify(observed.receipt);
    } finally {
      await publication.close();
    }
  }
  /** Status never observes publication files; this queues the job that does. */
  recover(exportId: string) {
    const intent = this.require(exportId);
    this.requireActive(intent);
    this.assertOwner(intent);
    if (!cleanupPending(intent)) return this.status(exportId);
    const original = this.owners.jobs.status(this.identity(intent));
    if (!original.jobId)
      throw new CatalogError(
        "INVALID_JOB",
        "Staged export has no publication job",
      );
    const job = this.owners.jobs.submit({
      ...this.recoveryIdentity(
        intent,
        this.owners.jobs.job(original.jobId).attemptId,
      ),
      lane: "heavy",
    });
    if (job.state === "ready")
      this.owners.jobs.regenerate(job.jobId, job.generation);
    else this.owners.jobs.retry(job.jobId);
    return this.status(exportId);
  }

  private async reconcile({ job, signal }: JobExecution): Promise<string> {
    const exportId = job.input.slice(0, job.input.indexOf("/"));
    const intent = this.require(exportId);
    this.requireActive(intent);
    if (!this.matches(job, intent))
      throw new CatalogError(
        "INVALID_JOB",
        "Recovery does not match the pinned export",
      );
    signal.throwIfAborted();
    await this.cleanupAssembly(intent);
    if (!stagingPending(intent)) return JSON.stringify({ observation: null });
    if (intent.receipt) {
      // Recovery never forgets staging it cannot verify; abandonment is the explicit release.
      const presence = await this.stagingPresence(intent, signal);
      if (presence === "unreachable")
        throw new CatalogError(
          "DESTINATION_UNAVAILABLE",
          "Export destination directory is missing or replaced; restore it or abandon the export",
          { exportId },
          true,
        );
      if (presence === "absent") this.markStagingCleared(exportId);
      else {
        const publication = await this.open(intent);
        try {
          await this.retireStaging(intent, publication, "discard");
        } finally {
          await publication.close();
        }
      }
      return JSON.stringify({ observation: null });
    }
    const publication = await this.open(intent);
    try {
      const observed = await publication.reconcile({ signal });
      if (observed.state === "committed" && observed.receipt)
        await this.settleCommit(intent, publication, observed.receipt, signal);
      return JSON.stringify({ observation: observed.state });
    } finally {
      await publication.close();
    }
  }

  async retireOwner(owner: ExportOwner, signal?: AbortSignal) {
    if (!this.deleting(owner))
      throw new CatalogError(
        "INVALID_STATE",
        "Owner deletion must be marked first",
      );
    let after = "",
      firstFailure: unknown;
    for (;;) {
      signal?.throwIfAborted();
      const row = this.owners.catalog.catalog
        .prepare(
          "SELECT exportId FROM export_intents WHERE targetKind=? AND targetId=? AND exportId>? ORDER BY exportId LIMIT 1",
        )
        .get(...ownerIdentity(owner), after) as
        { exportId: string } | undefined;
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
          throw new CatalogError(
            error.code,
            error.message,
            { ...error.details, exportId },
            true,
          );
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
      [...this.creating]
        .filter(([, id]) => id === exportId)
        .map(([pending]) => pending),
    );
    let intent = this.find(exportId);
    if (!intent) return;
    const jobId = this.owners.jobs.status(this.identity(intent)).jobId;
    if (jobId) await this.owners.jobs.drainJob(jobId);
    // The durable intent fence stops every recovery identity before any drain begins.
    const recoveryJobs = this.owners.catalog.catalog
      .prepare(`SELECT jobId,input FROM jobs
      WHERE targetKind=? AND targetId=? AND revisionId=? AND artifact=? AND input>? AND input<? ORDER BY input LIMIT 1`);
    let after = `${exportId}/`;
    for (;;) {
      const recovery = recoveryJobs.get(
        intent.targetKind,
        intent.targetId,
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
    if (!intent.abandoning && !this.deleting(this.owner(intent)))
      throw new CatalogError(
        "INVALID_STATE",
        "Export must be fenced before retirement",
      );
    // Retired staging needs no destination access. Otherwise a destination that is gone or
    // replaced has nothing of this export's to clean, and a job may have allocated unregistered staging.
    const mayHaveStaging = intent.staging
      ? !intent.stagingCleared
      : jobId !== null;
    if (mayHaveStaging && (await this.stagingPresence(intent)) === "present") {
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
    this.owners.catalog.transaction(() => {
      this.owners.catalog.catalog.prepare("DELETE FROM export_intents WHERE exportId=?").run(exportId);
      for (const kind of resourceKinds) this.references.release(kind, { kind: "export", id: exportId });
    });
  }
}
