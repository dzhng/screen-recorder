import { createHash } from "node:crypto";
import { fstatSync, constants } from "node:fs";
import { mkdir, open, writeFile, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import { copyImportedFile, fileIdentity } from "@screenrec/core/files";
import { archiveLimits } from "@screenrec/core/package-archive";
import {
  collectPortableAssets,
  projectAssetRoots,
  projectPackageManifest,
  validateProjectPackage,
  type ValidatedProjectPackage,
} from "@screenrec/core/project-package";
import type { ProjectStore, ProjectSnapshot } from "@screenrec/core/projects";
import type { AssetStore, PortableAsset } from "@screenrec/core/assets";
import type { JobQueue } from "@screenrec/core/jobs";
import { PackageRegistry } from "./package-registry.js";
import { openPackageParent } from "./package-workspace.js";
import { writeArchive } from "./archive-write.js";
import type { MediaWorker } from "./worker.js";
import type { DerivativeDelivery } from "./delivery.js";

export type PinnedProjectPackage = {
  revisionId: string;
  snapshot: ProjectSnapshot;
  assets: PortableAsset[];
};
type Workspace = { directory: string; handle: FileHandle };
type Owners = {
  directory: string;
  projects: ProjectStore;
  assets: AssetStore;
  jobs: JobQueue;
  worker: MediaWorker;
  delivery: DerivativeDelivery;
  assertPortable(projectId: string, assetIds: string[]): void;
};

/** Archive lifetimes remain in the registry; durable adoption remains in the project and asset owners. */
export class ProjectPackages {
  private parent: Awaited<ReturnType<typeof openPackageParent>> | undefined;
  private registry: PackageRegistry<ValidatedProjectPackage> | undefined;
  private preparing: Promise<void> | undefined;
  private closed = false;
  constructor(private readonly owners: Owners) {}
  private async prepare() {
    if (this.closed) throw new CatalogError("SERVICE_STOPPED", "Project packages are closed");
    if (this.preparing) return this.preparing;
    if (this.registry) return;
    this.preparing = (async () => {
      const parent = await openPackageParent(join(this.owners.directory, "packages"));
      const registry = new PackageRegistry({
        parent,
        jobs: this.owners.jobs,
        worker: this.owners.worker,
        delivery: this.owners.delivery,
        validate: validateProjectPackage,
      });
      try {
        await registry.recover();
        this.parent = parent;
        this.registry = registry;
      } catch (error) {
        await parent.handle.close();
        throw error;
      }
    })().finally(() => {
      this.preparing = undefined;
    });
    return this.preparing;
  }
  async open(path: string) {
    await this.prepare();
    return this.registry!.open(path);
  }
  status(admissionId?: string) {
    if (admissionId) {
      if (!this.registry) throw new CatalogError("NOT_FOUND", "Package admission does not exist");
      const admission = this.registry.status(admissionId);
      if (admission.state !== "ready" || !admission.packageHandle) return admission;
      const manifest = this.registry.lookup(admission.packageHandle).manifest;
      return {
        ...admission,
        project: manifest.snapshot.project,
        revisions: manifest.snapshot.revisions.length,
        assets: manifest.assets.length,
      };
    }
    return { usage: this.registry?.usage() ?? null, admissions: this.registry?.active() ?? [] };
  }
  async closeAdmission(admissionId: string) {
    if (!this.registry) throw new CatalogError("NOT_FOUND", "Package admission does not exist");
    await this.registry.close(admissionId);
    return this.registry.status(admissionId);
  }
  async close() {
    this.closed = true;
    await this.preparing;
    await this.registry?.dispose();
    await this.parent?.handle.close();
  }
  exportDirectory() {
    return openPackageParent(join(this.owners.directory, "package-exports"));
  }
  pin(projectId: string, revisionId?: string): PinnedProjectPackage {
    const snapshot = this.owners.projects.snapshot(projectId);
    if (revisionId && revisionId !== snapshot.project.currentRevisionId)
      throw new CatalogError(
        "UNSUPPORTED_PACKAGE_REVISION",
        "Project package currently requires the current revision",
      );
    let metadataBytes = 0;
    const assets = collectPortableAssets(projectAssetRoots(snapshot), (id) => {
      const asset = this.owners.assets.portable(id);
      metadataBytes += Buffer.byteLength(JSON.stringify(asset));
      if (metadataBytes > archiveLimits.manifestBytes)
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Project asset metadata exceeds package manifest budget",
        );
      return asset;
    });
    this.owners.assertPortable(
      projectId,
      assets.map((entry) => entry.asset.id),
    );
    return { revisionId: snapshot.project.currentRevisionId, snapshot, assets };
  }
  adopt(packageHandle: string, requestId: string) {
    if (!this.registry) throw new CatalogError("CONTEXT_CLOSED", "Project package is not open");
    const job = this.registry.submit(
      packageHandle,
      { artifact: "package.adopt", lane: "heavy", input: JSON.stringify({ requestId }) },
      async (context, signal) => {
        const manifest = context.manifest;
        const staged: Awaited<ReturnType<AssetStore["stagePortable"]>>[] = [];
        try {
          for (const entry of manifest.assets) {
            signal.throwIfAborted();
            const path = `assets/${entry.asset.fileName}`,
              source = context.files.open(path);
            try {
              const stat = fstatSync(source.fd, { bigint: true });
              const locator = context.files.path(path);
              staged.push(
                await this.owners.assets.stagePortable(entry, locator, signal, {
                  path: locator,
                  bytes: Number(stat.size),
                  identity: fileIdentity(stat),
                }),
              );
            } finally {
              source.close();
            }
          }
          signal.throwIfAborted();
          const result = this.owners.projects.adopt(
            {
              requestId,
              packageIdentity: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
              snapshot: manifest.snapshot,
            },
            () => {
              for (const asset of staged) asset.publish();
            },
          );
          return JSON.stringify({
            projectId: result.project.projectId,
            revisionId: result.revision.id,
          });
        } finally {
          await Promise.all(staged.map((asset) => asset.close()));
        }
      },
    );
    return { ...job, result: job.result ? JSON.parse(job.result) : null };
  }
  async assemble(
    pinned: PinnedProjectPackage,
    input: Workspace,
    zip: Workspace,
    signal: AbortSignal,
  ) {
    const plan: {
      path: string;
      bytes: number;
      sha256: string;
      identity: ReturnType<typeof fileIdentity>;
    }[] = [];
    const revisions = new Map<string, string>();
    let expanded = 0;
    const add = async (path: string, bytes: number, sha256: string) => {
      if (
        bytes > archiveLimits.memberBytes ||
        plan.length >= archiveLimits.entries - 1 ||
        expanded + bytes > archiveLimits.expandedBytes
      )
        throw new CatalogError("LIMIT_EXCEEDED", "Project package exceeds archive budget");
      const file = await open(
        join(input.directory, path),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        plan.push({
          path,
          bytes,
          sha256,
          identity: fileIdentity(await file.stat({ bigint: true })),
        });
      } finally {
        await file.close();
      }
      expanded += bytes;
    };
    const text = async (path: string, body: string) => {
      await writeFile(join(input.directory, path), body, { flag: "wx", signal });
      await add(path, Buffer.byteLength(body), createHash("sha256").update(body).digest("hex"));
    };
    await mkdir(join(input.directory, "revisions"), { mode: 0o700 });
    await mkdir(join(input.directory, "assets"), { mode: 0o700 });
    for (const revision of pinned.snapshot.revisions) {
      const path = `revisions/${revision.ordinal}.json`,
        body = JSON.stringify(revision);
      revisions.set(path, body);
      await text(path, body);
    }
    const manifest = projectPackageManifest(pinned.snapshot, pinned.assets, [
      ...plan.map(({ identity: _identity, ...entry }) => entry),
      ...pinned.assets.map(({ asset }) => ({
        path: `assets/${asset.fileName}`,
        bytes: asset.bytes,
        sha256: asset.id,
      })),
    ]);
    const body = JSON.stringify(manifest);
    validateProjectPackage(body, revisions, archiveLimits);
    for (const entry of pinned.assets) {
      signal.throwIfAborted();
      const path = `assets/${entry.asset.fileName}`;
      const copied = await copyImportedFile(
        this.owners.assets.path(entry.asset.id),
        join(input.directory, path),
        signal,
      );
      if (copied.sha256 !== entry.asset.id || copied.bytes !== entry.asset.bytes)
        throw new CatalogError("INVALID_STORAGE", "Package source bytes changed");
      await add(path, copied.bytes, copied.sha256);
    }
    await text("manifest.json", body);
    const planBody = JSON.stringify(plan);
    if (Buffer.byteLength(planBody) > archiveLimits.receiptBytes)
      throw new CatalogError("LIMIT_EXCEEDED", "Project ZIP plan exceeds metadata budget");
    const path = join(input.directory, "zip-plan.json");
    await writeFile(path, planBody, { flag: "wx", signal });
    const planFile = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return await writeArchive(
        { handle: input.handle, plan: planFile, bytes: expanded },
        zip,
        this.owners.worker,
        { signal },
      );
    } finally {
      await planFile.close();
    }
  }
}
