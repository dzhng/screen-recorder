import { ResourceReferences, resourceKinds, type ResourceReference } from "./references.js";
import { archiveLimits } from "./package-archive.js";
import { AcquisitionStore } from "./acquisitions.js";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  applyBatch,
  getProcessing,
  validateComposition,
  compositionSchema,
  editOperationSchema,
  isMediaClip,
  type Composition,
  type EditBatchResult,
} from "@screenrec/composition";
import { Catalog, CatalogError } from "./catalog.js";
import { AssetStore, compositionAsset } from "./assets.js";

export type Project = {
  projectId: string;
  title: string;
  createdAt: string;
  currentRevisionId: string;
};
export type ProjectRevision = {
  id: string;
  projectId: string;
  ordinal: number;
  createdAt: string;
  operation: "create" | "apply" | "undo" | "restore";
  document: EditBatchResult["document"];
};
export type ProjectSnapshot = {
  project: Project;
  revisions: ProjectRevision[];
  undo: string[];
  references: { revisionId: string; resources: ResourceReference[] }[];
};
export const projectSnapshotReferencesSchema = z
  .array(
    z.strictObject({
      revisionId: z.string().min(1),
      resources: z
        .array(z.strictObject({ kind: z.enum(resourceKinds), id: z.string().min(1).max(2048) }))
        .max(25000),
    }),
  )
  .max(archiveLimits.history)
  .refine((values) => values.reduce((sum, value) => sum + value.resources.length, 0) <= 25000);
const projectSnapshotSchema = z.strictObject({
  project: z.strictObject({
    projectId: z.string().min(1),
    title: z.string(),
    createdAt: z.string().min(1),
    currentRevisionId: z.string().min(1),
  }),
  revisions: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        projectId: z.string().min(1),
        ordinal: z.number().int().nonnegative(),
        createdAt: z.string().min(1),
        operation: z.enum(["create", "apply", "undo", "restore"]),
        document: compositionSchema,
      }),
    )
    .min(1)
    .max(archiveLimits.history),
  undo: z.array(z.string().min(1)).max(archiveLimits.history),
  references: projectSnapshotReferencesSchema,
});
/** Untrusted snapshots must retain a complete ordered history and a valid undo stack. */
export function validateProjectSnapshot(value: unknown): ProjectSnapshot {
  const result = projectSnapshotSchema.safeParse(value);
  if (!result.success) throw new CatalogError("INVALID_PACKAGE", "Invalid project snapshot");
  const snapshot = result.data;
  const ids = new Set<string>();
  for (const [ordinal, revision] of snapshot.revisions.entries()) {
    if (
      revision.ordinal !== ordinal ||
      revision.projectId !== snapshot.project.projectId ||
      ids.has(revision.id)
    )
      throw new CatalogError("INVALID_PACKAGE", "Project history is incomplete or ambiguous");
    ids.add(revision.id);
  }
  if (
    snapshot.project.currentRevisionId !== snapshot.revisions.at(-1)!.id ||
    snapshot.undo.some((id) => !ids.has(id))
  )
    throw new CatalogError("INVALID_PACKAGE", "Project head or undo target is missing");
  const owners = new Set<string>();
  for (const reference of snapshot.references) {
    if (!ids.has(reference.revisionId) || owners.has(reference.revisionId))
      throw new CatalogError("INVALID_PACKAGE", "Revision dependency owner is missing or repeated");
    owners.add(reference.revisionId);
    const resources = new Set(
      reference.resources.map((value) => JSON.stringify([value.kind, value.id])),
    );
    if (resources.size !== reference.resources.length)
      throw new CatalogError("INVALID_PACKAGE", "Revision dependency is repeated");
  }
  return snapshot;
}
export type ProjectEditResult = { revision: ProjectRevision; edit: EditBatchResult };
export type ProjectHistoryCursor = {
  projectId: string;
  afterOrdinal: number;
  throughOrdinal: number;
};
function acquisitionIds(document: ProjectRevision["document"]): string[] {
  return [
    ...new Set(
      document.clips
        .filter(isMediaClip)
        .flatMap((clip) => (clip.acquisitionId ? [clip.acquisitionId] : [])),
    ),
  ];
}
const projectColumns = "projectId,title,createdAt,currentRevisionId";
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}
function parsed<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new CatalogError("INVALID_PARAMS", result.error.message);
  return result.data;
}
function pageLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new CatalogError("INVALID_PARAMS", "Page limit must be 1–1000");
}

/** Immutable revisions and replay receipts share the catalog transaction with asset references. */
export class ProjectStore {
  private readonly references: ResourceReferences;
  constructor(
    private readonly store: Catalog,
    private readonly assets: AssetStore,
    private readonly acquisitions = new AcquisitionStore(store),
  ) {
    this.references = new ResourceReferences(store);
    store.catalog.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, projectId TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL, createdAt TEXT NOT NULL, currentRevisionId TEXT NOT NULL,
        deletedAt TEXT, createRequestId TEXT UNIQUE NOT NULL, createArguments TEXT NOT NULL,
        createResult TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS project_revisions (
        id TEXT PRIMARY KEY, projectId TEXT NOT NULL, ordinal INTEGER NOT NULL,
        content TEXT NOT NULL, UNIQUE(projectId,ordinal)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS project_requests (
        projectId TEXT NOT NULL, requestId TEXT NOT NULL, arguments TEXT NOT NULL,
        result TEXT NOT NULL, PRIMARY KEY(projectId,requestId)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS project_undo (
        projectId TEXT NOT NULL, position INTEGER NOT NULL, targetId TEXT NOT NULL,
        PRIMARY KEY(projectId,position)
      ) STRICT;
    `);
  }
  create(input: { requestId: string; title?: string; canvas: unknown }): {
    project: Project;
    revision: ProjectRevision;
  } {
    const canvas = parsed(compositionSchema.shape.canvas, input.canvas);
    const title = input.title ?? "Untitled";
    const argumentsKey = canonical({ canvas, title });
    return this.store.transaction(() => {
      const prior = this.store.catalog
        .prepare("SELECT createArguments,createResult FROM projects WHERE createRequestId=?")
        .get(input.requestId);
      if (prior) {
        if (prior.createArguments !== argumentsKey)
          throw new CatalogError(
            "REQUEST_CONFLICT",
            "Request ID was already used with different arguments",
          );
        return JSON.parse(prior.createResult as string);
      }
      const projectId = randomUUID(),
        id = randomUUID(),
        createdAt = new Date().toISOString();
      const document: Composition = {
        canvas,
        tracks: [],
        groups: [],
        clips: [],
        syncGroups: [],
        processing: [],
        captions: [],
      };
      const revision: ProjectRevision = {
        id,
        projectId,
        ordinal: 0,
        createdAt,
        operation: "create",
        document,
      };
      const project: Project = { projectId, title, createdAt, currentRevisionId: id };
      const result = { project, revision };
      this.store.catalog
        .prepare(
          `INSERT INTO projects(projectId,title,createdAt,currentRevisionId,createRequestId,createArguments,createResult) VALUES(?,?,?,?,?,?,?)`,
        )
        .run(
          projectId,
          title,
          createdAt,
          id,
          input.requestId,
          argumentsKey,
          JSON.stringify(result),
        );
      this.insertRevision(revision);
      return result;
    });
  }
  get(projectId: string): Project {
    const row = this.store.catalog
      .prepare(`SELECT ${projectColumns} FROM projects WHERE projectId=? AND deletedAt IS NULL`)
      .get(projectId);
    if (!row) throw new CatalogError("NOT_FOUND", "Project does not exist", { projectId });
    return row as Project;
  }
  list(input: { afterSequence?: number; limit?: number } = {}) {
    const limit = input.limit ?? 250,
      after = input.afterSequence ?? 0;
    pageLimit(limit);
    if (!Number.isSafeInteger(after) || after < 0)
      throw new CatalogError("INVALID_PARAMS", "Invalid project cursor");
    const rows = this.store.catalog
      .prepare(
        `SELECT sequence,${projectColumns} FROM projects WHERE deletedAt IS NULL AND sequence>? ORDER BY sequence LIMIT ?`,
      )
      .all(after, limit + 1);
    return {
      projects: rows.slice(0, limit).map(({ sequence: _sequence, ...row }) => row as Project),
      nextCursor:
        rows.length > limit ? { afterSequence: rows[limit - 1]!.sequence as number } : null,
    };
  }
  /** The marker fences all readers and new work before asynchronous owners drain. */
  markDeleting(projectId: string): boolean {
    return this.store.transaction(() => {
      this.store.catalog
        .prepare("UPDATE projects SET deletedAt=COALESCE(deletedAt,?) WHERE projectId=?")
        .run(new Date().toISOString(), projectId);
      return Boolean(
        this.store.catalog
          .prepare("SELECT 1 FROM project_revisions WHERE projectId=? LIMIT 1")
          .get(projectId),
      );
    });
  }
  isDeleting(projectId: string): boolean {
    return Boolean(
      this.store.catalog
        .prepare("SELECT 1 FROM projects WHERE projectId=? AND deletedAt IS NOT NULL")
        .get(projectId),
    );
  }
  deletionsPage(afterId = "") {
    const rows = this.store.catalog
      .prepare(`SELECT projectId FROM projects WHERE deletedAt IS NOT NULL AND projectId>?
      AND EXISTS(SELECT 1 FROM project_revisions WHERE project_revisions.projectId=projects.projectId)
      ORDER BY projectId LIMIT 256`)
      .all(afterId);
    const projectIds = rows.map((row) => row.projectId as string);
    return { projectIds, nextAfterId: rows.length === 256 ? projectIds.at(-1)! : null };
  }
  /** Only the deletion coordinator calls this, after every asynchronous owner has drained. */
  finishDeletionPage(projectId: string): boolean {
    return this.store.transaction(() => {
      if (!this.isDeleting(projectId))
        throw new CatalogError("INVALID_STATE", "Project deletion has not been requested");
      // Keep revisions as the recovery marker until undo retirement has also finished.
      this.store.catalog
        .prepare(`DELETE FROM project_undo WHERE rowid IN
        (SELECT rowid FROM project_undo WHERE projectId=? LIMIT 256)`)
        .run(projectId);
      if (
        this.store.catalog
          .prepare("SELECT 1 FROM project_undo WHERE projectId=? LIMIT 1")
          .get(projectId)
      )
        return false;
      const rows = this.store.catalog
        .prepare("SELECT id FROM project_revisions WHERE projectId=? LIMIT 256")
        .all(projectId);
      for (const row of rows) {
        // Retire every dependency kind before deleting the immutable revision marker.
        if (this.references.releaseOwnerPage({ kind: "revision", id: row.id as string }) === 256)
          return false;
        this.store.catalog.prepare("DELETE FROM project_revisions WHERE id=?").run(row.id!);
      }
      const complete = !this.store.catalog
        .prepare("SELECT 1 FROM project_revisions WHERE projectId=? LIMIT 1")
        .get(projectId);
      return complete;
    });
  }
  revision(projectId: string, revisionId?: string): ProjectRevision {
    const project = this.get(projectId);
    const row = this.store.catalog
      .prepare("SELECT content FROM project_revisions WHERE projectId=? AND id=?")
      .get(projectId, revisionId ?? project.currentRevisionId);
    if (!row)
      throw new CatalogError("NOT_FOUND", "Revision does not exist in project", {
        projectId,
        revisionId,
      });
    return JSON.parse(row.content as string);
  }
  apply(
    projectId: string,
    request: { requestId: string; expectedRevisionId: string; operations: unknown },
  ): ProjectEditResult {
    const operations = parsed(z.array(editOperationSchema).max(1000), request.operations);
    const args = { operation: "apply", expectedRevisionId: request.expectedRevisionId, operations };
    return this.mutate(projectId, request.requestId, args, () => {
      const current = this.current(projectId, request.expectedRevisionId);
      const assetIds = new Set(
        current.document.clips.filter(isMediaClip).map((clip) => clip.assetId),
      );
      const contextIds = new Set(acquisitionIds(current.document));
      for (const operation of operations) {
        if (operation.operation === "replace") {
          assetIds.add(operation.media.assetId);
          if (operation.media.acquisitionId) contextIds.add(operation.media.acquisitionId);
        }
        if (operation.operation === "place" && "assetId" in operation.clip) {
          assetIds.add(operation.clip.assetId);
          if (operation.clip.acquisitionId) contextIds.add(operation.clip.acquisitionId);
        }
      }
      const metadata = [...assetIds].map((id) => compositionAsset(this.assets.get(id)));
      const namespace = createHash("sha256")
        .update(canonical([projectId, request.requestId]))
        .digest("hex");
      const edit = applyBatch(current.document, operations, {
        assets: metadata,
        namespace,
        acquisitions: [...contextIds].map((id) => this.acquisitions.context(id)),
      });
      if (!edit.changed) return { revision: current, edit };
      this.pushUndo(projectId, current.id);
      const revision: ProjectRevision = {
        id: randomUUID(),
        projectId,
        ordinal: current.ordinal + 1,
        createdAt: new Date().toISOString(),
        operation: "apply",
        document: edit.document,
      };
      this.insertRevision(revision);
      return { revision, edit };
    });
  }
  undo(
    projectId: string,
    request: { requestId: string; expectedRevisionId: string },
  ): ProjectRevision {
    return this.restoreRevision(projectId, request, "undo");
  }
  restore(
    projectId: string,
    request: { requestId: string; expectedRevisionId: string; targetRevisionId: string },
  ): ProjectRevision {
    return this.restoreRevision(projectId, request, "restore", request.targetRevisionId);
  }
  processing(projectId: string, revisionId: string, target: unknown) {
    const revision = this.revision(projectId, revisionId);
    const ids = [
      ...new Set(revision.document.clips.filter(isMediaClip).map((clip) => clip.assetId)),
    ];
    const model = validateComposition(
      revision.document,
      ids.map((id) => compositionAsset(this.assets.get(id))),
      this.contexts(revision.document),
    );
    return { projectId, revisionId: revision.id, target, steps: getProcessing(model, target) };
  }
  history(projectId: string, cursor: ProjectHistoryCursor | null = null, limit = 250) {
    this.get(projectId);
    pageLimit(limit);
    const afterOrdinal = cursor?.afterOrdinal ?? -1;
    const throughOrdinal =
      cursor?.throughOrdinal ??
      (this.store.catalog
        .prepare("SELECT MAX(ordinal) AS ordinal FROM project_revisions WHERE projectId=?")
        .get(projectId)!.ordinal as number);
    if (
      (cursor && cursor.projectId !== projectId) ||
      !Number.isSafeInteger(afterOrdinal) ||
      afterOrdinal < -1 ||
      !Number.isSafeInteger(throughOrdinal) ||
      throughOrdinal < afterOrdinal
    )
      throw new CatalogError("INVALID_PARAMS", "Invalid history cursor");
    const rows = this.store.catalog
      .prepare(
        "SELECT content FROM project_revisions WHERE projectId=? AND ordinal>? AND ordinal<=? ORDER BY ordinal LIMIT ?",
      )
      .all(projectId, afterOrdinal, throughOrdinal, limit + 1);
    const revisions = rows
      .slice(0, limit)
      .map((row) => JSON.parse(row.content as string) as ProjectRevision);
    return {
      revisions,
      nextCursor:
        rows.length > limit
          ? { projectId, afterOrdinal: revisions.at(-1)!.ordinal, throughOrdinal }
          : null,
    };
  }
  snapshot(projectId: string): ProjectSnapshot {
    const project = this.get(projectId);
    const usage = this.store.catalog
      .prepare(
        "SELECT COUNT(*) AS count,COALESCE(SUM(length(CAST(content AS BLOB))),0) AS bytes FROM project_revisions WHERE projectId=?",
      )
      .get(projectId) as { count: number; bytes: number };
    if (usage.count > archiveLimits.history || usage.bytes > archiveLimits.revisionBytes)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Project history exceeds the portable snapshot budget",
      );
    const history = this.history(projectId, undefined, archiveLimits.history);
    if (history.nextCursor)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Project history exceeds the portable snapshot limit",
      );
    const undo = this.store.catalog
      .prepare("SELECT targetId FROM project_undo WHERE projectId=? ORDER BY position LIMIT 1001")
      .all(projectId)
      .map((row) => row.targetId as string);
    if (undo.length > archiveLimits.history)
      throw new CatalogError("LIMIT_EXCEEDED", "Project undo exceeds the portable snapshot limit");
    let edges = 0;
    const references = history.revisions.map((revision) => {
      const resources = this.references.dependencies({ kind: "revision", id: revision.id });
      edges += resources.length;
      if (edges > 25000)
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Project revision dependencies exceed package budget",
        );
      return { revisionId: revision.id, resources };
    });
    return { project, revisions: history.revisions, undo, references };
  }
  /** Identity preparation is transient; publication rechecks replay before exposing any dependencies. */
  prepareAdoption(input: { requestId: string; packageIdentity: string; snapshot: unknown }) {
    const snapshot = validateProjectSnapshot(input.snapshot);
    const key = canonical({ packageIdentity: input.packageIdentity, snapshot });
    const replay = () => {
      const prior = this.store.catalog
        .prepare("SELECT createArguments,createResult FROM projects WHERE createRequestId=?")
        .get(input.requestId);
      if (!prior) return null;
      if (prior.createArguments !== key)
        throw new CatalogError(
          "REQUEST_CONFLICT",
          "Adoption request ID already names another package",
        );
      return JSON.parse(prior.createResult as string) as {
        project: Project;
        revision: ProjectRevision;
        revisionIds: Record<string, string>;
      };
    };
    const prior = replay();
    const projectId = prior?.project.projectId ?? randomUUID();
    const revisionIds =
      prior?.revisionIds ??
      Object.fromEntries(snapshot.revisions.map((revision) => [revision.id, randomUUID()]));
    const revisions = snapshot.revisions.map((revision) => ({
      ...revision,
      id: revisionIds[revision.id]!,
      projectId,
    }));
    const project = {
      ...snapshot.project,
      projectId,
      currentRevisionId: revisionIds[snapshot.project.currentRevisionId]!,
    };
    const result = { project, revision: revisions.at(-1)!, revisionIds };
    return {
      ...structuredClone(result),
      revisions: structuredClone(revisions),
      publish: (publishDependencies: () => void) =>
        this.store.transaction(() => {
          const existing = replay();
          if (existing) return existing;
          publishDependencies();
          for (const revision of revisions) {
            const ids = [
              ...new Set(revision.document.clips.filter(isMediaClip).map((clip) => clip.assetId)),
            ];
            validateComposition(
              revision.document,
              ids.map((id) => compositionAsset(this.assets.get(id))),
              this.contexts(revision.document),
            );
          }
          this.store.catalog
            .prepare(
              "INSERT INTO projects(projectId,title,createdAt,currentRevisionId,createRequestId,createArguments,createResult) VALUES(?,?,?,?,?,?,?)",
            )
            .run(
              projectId,
              project.title,
              project.createdAt,
              project.currentRevisionId,
              input.requestId,
              key,
              JSON.stringify(result),
            );
          for (const revision of revisions) this.insertRevision(revision);
          for (const dependency of snapshot.references)
            for (const resource of dependency.resources)
              this.references.retain(
                resource.kind,
                { kind: "revision", id: revisionIds[dependency.revisionId]! },
                [resource.id],
              );
          for (const id of snapshot.undo) this.pushUndo(projectId, revisionIds[id]!);
          return result;
        }),
    };
  }
  private mutate<T>(projectId: string, requestId: string, args: unknown, run: () => T): T {
    const key = canonical(args);
    return this.store.transaction(() => {
      this.get(projectId);
      const replay = this.store.catalog
        .prepare("SELECT arguments,result FROM project_requests WHERE projectId=? AND requestId=?")
        .get(projectId, requestId);
      if (replay) {
        if (replay.arguments !== key)
          throw new CatalogError(
            "REQUEST_CONFLICT",
            "Request ID was already used with different arguments",
          );
        return JSON.parse(replay.result as string) as T;
      }
      const result = run();
      this.store.catalog
        .prepare("INSERT INTO project_requests VALUES(?,?,?,?)")
        .run(projectId, requestId, key, JSON.stringify(result));
      return result;
    });
  }
  private current(projectId: string, expected: string) {
    const current = this.revision(projectId);
    if (current.id !== expected)
      throw new CatalogError("STALE_REVISION", "Current revision has changed", {
        currentRevisionId: current.id,
      });
    return current;
  }
  private pushUndo(projectId: string, targetId: string) {
    this.store.catalog
      .prepare(
        "INSERT INTO project_undo SELECT ?,COALESCE(MAX(position),0)+1,? FROM project_undo WHERE projectId=?",
      )
      .run(projectId, targetId, projectId);
  }
  private restoreRevision(
    projectId: string,
    request: { requestId: string; expectedRevisionId: string },
    operation: "undo" | "restore",
    targetRevisionId?: string,
  ): ProjectRevision {
    return this.mutate(
      projectId,
      request.requestId,
      {
        operation,
        expectedRevisionId: request.expectedRevisionId,
        ...(targetRevisionId ? { targetRevisionId } : {}),
      },
      () => {
        const current = this.current(projectId, request.expectedRevisionId);
        let targetId = targetRevisionId;
        if (operation === "undo") {
          const entry = this.store.catalog
            .prepare(
              "SELECT position,targetId FROM project_undo WHERE projectId=? ORDER BY position DESC LIMIT 1",
            )
            .get(projectId);
          if (!entry) throw new CatalogError("NOTHING_TO_UNDO", "No active edit remains to undo");
          targetId = entry.targetId as string;
          this.store.catalog
            .prepare("DELETE FROM project_undo WHERE projectId=? AND position=?")
            .run(projectId, entry.position!);
        } else this.pushUndo(projectId, current.id);
        const target = this.revision(projectId, targetId);
        const revision: ProjectRevision = {
          ...target,
          id: randomUUID(),
          ordinal: current.ordinal + 1,
          createdAt: new Date().toISOString(),
          operation,
        };
        this.insertRevision(revision);
        return revision;
      },
    );
  }
  contexts(document: ProjectRevision["document"]) {
    return acquisitionIds(document).map((id) => this.acquisitions.context(id));
  }
  revisionDependencies(projectId: string, revisionId: string) {
    this.revision(projectId, revisionId);
    return this.references.dependencies({ kind: "revision", id: revisionId });
  }
  private insertRevision(revision: ProjectRevision) {
    const ids = [
      ...new Set(revision.document.clips.filter(isMediaClip).map((clip) => clip.assetId)),
    ];
    this.assets.retain({ kind: "revision", id: revision.id }, ids);
    this.acquisitions.retain(
      { kind: "revision", id: revision.id },
      acquisitionIds(revision.document),
    );
    this.store.catalog
      .prepare("INSERT INTO project_revisions VALUES(?,?,?,?)")
      .run(revision.id, revision.projectId, revision.ordinal, JSON.stringify(revision));
    this.store.catalog
      .prepare("UPDATE projects SET currentRevisionId=? WHERE projectId=?")
      .run(revision.id, revision.projectId);
  }
}
