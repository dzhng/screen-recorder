import { createHash } from "node:crypto";
import { fstatSync, constants } from "node:fs";
import { mkdir, open, writeFile, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import { copyImportedFile, fileIdentity, type IdentifiedFile } from "@screenrec/core/files";
import { archiveLimits } from "@screenrec/core/package-archive";
import {
  collectPortableResources,
  projectResourceRoots,
  resourceMembers,
  type PortableResource,
  projectPackageManifest,
  validateProjectPackage,
  type ValidatedProjectPackage,
} from "@screenrec/core/project-package";
import type { ProjectStore, ProjectSnapshot } from "@screenrec/core/projects";
import type { AssetStore } from "@screenrec/core/assets";
import type { AcquisitionImporter, PortableAcquisitionFiles } from "@screenrec/core/acquisitions";
import type { JobQueue } from "@screenrec/core/jobs";
import { PackageRegistry } from "./package-registry.js";
import { openPackageParent } from "./package-workspace.js";
import { writeArchive } from "./archive-write.js";
import type { MediaWorker } from "./worker.js";
import type { DerivativeDelivery } from "./delivery.js";

export type PinnedProjectPackage = {
  revisionId: string;
  snapshot: ProjectSnapshot;
  resources: PortableResource[];
  acquisitionFiles: Record<string, Record<"journal" | "normalized", IdentifiedFile>>;
};
type Workspace = { directory: string; handle: FileHandle };
type Owners = {
  directory: string;
  projects: ProjectStore;
  assets: AssetStore;
  acquisitions: AcquisitionImporter;
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
        assets: manifest.resources.filter((resource) => resource.kind === "asset").length,
        acquisitions: manifest.resources.filter((resource) => resource.kind === "acquisition")
          .length,
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
    const acquisitionFiles: PinnedProjectPackage["acquisitionFiles"] = {};
    const resources = collectPortableResources(projectResourceRoots(snapshot), (identity) => {
      let resource: PortableResource;
      if (identity.kind === "asset")
        resource = { kind: "asset", ...this.owners.assets.portable(identity.id) };
      else if (identity.kind === "acquisition") {
        const pinned = this.owners.acquisitions.portable(identity.id);
        acquisitionFiles[identity.id] = pinned.files;
        resource = { kind: "acquisition", acquisition: pinned.acquisition };
      } else
        throw new CatalogError(
          "UNSUPPORTED_PACKAGE_DEPENDENCY",
          "Portable scene-generation adoption is not yet implemented",
        );
      metadataBytes += Buffer.byteLength(JSON.stringify(resource));
      if (metadataBytes > archiveLimits.manifestBytes)
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Project resource metadata exceeds package manifest budget",
        );
      return resource;
    });
    this.owners.assertPortable(
      projectId,
      resources.flatMap((entry) => (entry.kind === "asset" ? [entry.asset.id] : [])),
    );
    return {
      revisionId: snapshot.project.currentRevisionId,
      snapshot,
      resources,
      acquisitionFiles,
    };
  }
  adopt(packageHandle: string, requestId: string) {
    if (!this.registry) throw new CatalogError("CONTEXT_CLOSED", "Project package is not open");
    const job = this.registry.submit(
      packageHandle,
      { artifact: "package.adopt", lane: "heavy", input: JSON.stringify({ requestId }) },
      async (context, signal) => {
        const manifest = context.manifest;
        const staged: Awaited<ReturnType<AssetStore["stagePortable"]>>[] = [];
        const acquisitions: Awaited<ReturnType<AcquisitionImporter["stagePortable"]>>[] = [];
        try {
          for (const entry of manifest.resources.filter((entry) => entry.kind === "asset")) {
            signal.throwIfAborted();
            const path = `assets/${entry.asset.fileName}`,
              source = context.files.open(path);
            try {
              const stat = fstatSync(source.fd, { bigint: true });
              const locator = context.files.path(path);
              staged.push(
                await this.owners.assets.stagePortable(
                  { asset: entry.asset, origins: entry.origins, dependencies: entry.dependencies },
                  locator,
                  signal,
                  {
                    path: locator,
                    bytes: Number(stat.size),
                    identity: fileIdentity(stat),
                  },
                ),
              );
            } finally {
              source.close();
            }
          }
          for (const entry of manifest.resources) {
            if (entry.kind !== "acquisition") continue;
            const members = resourceMembers(entry);
            const leases: ReturnType<typeof context.files.open>[] = [];
            try {
              for (const member of members) leases.push(context.files.open(member.path));
              const files = Object.fromEntries(
                members.map((member, index) => {
                  const stat = fstatSync(leases[index]!.fd, { bigint: true });
                  return [
                    index === 0 ? "journal" : "normalized",
                    {
                      path: context.files.path(member.path),
                      bytes: Number(stat.size),
                      identity: fileIdentity(stat),
                      sha256: manifest.inventory.find((item) => item.path === member.path)!.sha256,
                    },
                  ];
                }),
              ) as PortableAcquisitionFiles;
              acquisitions.push(
                await this.owners.acquisitions.stagePortable(entry.acquisition, files, signal),
              );
            } finally {
              for (const lease of leases) lease.close();
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
              for (const acquisition of acquisitions) acquisition.publish();
            },
          );
          return JSON.stringify({
            projectId: result.project.projectId,
            revisionId: result.revision.id,
          });
        } finally {
          await Promise.all(acquisitions.map((acquisition) => acquisition.close()));
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
    const declared = pinned.resources.flatMap(resourceMembers);
    if (
      declared.length + plan.length >= archiveLimits.entries ||
      declared.some((entry) => entry.bytes > archiveLimits.memberBytes) ||
      declared.reduce((sum, entry) => sum + entry.bytes, expanded) > archiveLimits.expandedBytes
    )
      throw new CatalogError("LIMIT_EXCEEDED", "Project resources exceed archive budget");
    for (const entry of pinned.resources) {
      const members = resourceMembers(entry);
      for (const [index, member] of members.entries()) {
        signal.throwIfAborted();
        const source =
          entry.kind === "asset"
            ? undefined
            : pinned.acquisitionFiles[entry.acquisition.id]![
                index === 0 ? "journal" : "normalized"
              ];
        const path = join(input.directory, member.path);
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        const copied = await copyImportedFile(
          entry.kind === "asset" ? this.owners.assets.path(entry.asset.id) : source!.path,
          path,
          signal,
          source,
        );
        if (
          (member.sha256 !== null && copied.sha256 !== member.sha256) ||
          copied.bytes !== member.bytes
        )
          throw new CatalogError("INVALID_STORAGE", "Package source bytes changed");
        await add(member.path, copied.bytes, copied.sha256);
      }
    }
    const manifest = projectPackageManifest(
      pinned.snapshot,
      pinned.resources,
      plan.map(({ identity: _identity, ...entry }) => entry),
    );
    const body = JSON.stringify(manifest);
    validateProjectPackage(body, revisions, archiveLimits);
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
