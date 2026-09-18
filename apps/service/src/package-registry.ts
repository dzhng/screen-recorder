import { randomUUID } from "node:crypto";
import { rm, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import {
  archiveLimits,
  validateArchiveLimits,
  type ArchiveLimits,
} from "@screenrec/core/package-archive";
import {
  type JobQueue,
  type JobContext,
  type ContextJobRequest,
  type ContextJob,
} from "@screenrec/core/jobs";
import { admitArchive, type AdmittedArchive } from "./archive-input.js";
import { openPackageArchive, packageOutputBytes, type RetainedPackage } from "./package-archive.js";
import {
  provisionPackageWorkspace,
  recoverPackageWorkspaces,
  cleanupFailedPackageWorkspace,
} from "./package-workspace.js";
import type { MediaWorker } from "./worker.js";
import type { DerivativeDelivery } from "./delivery.js";

const packageRegistryLimits = Object.freeze({
  bytes: 64 * 1024 ** 3,
  owners: 4,
  terminal: 32,
  derivatives: packageOutputBytes,
});
type State =
  | "queued"
  | "opening"
  | "ready"
  | "closing"
  | "cleanup_failed"
  | "failed"
  | "canceled"
  | "closed";
type Admission = {
  id: string;
  state: State;
  packageHandle: string | null;
  jobId: string;
  error: string | null;
};
type PackageAdmission = Readonly<Admission>;
type Work = (context: RetainedPackage, signal: AbortSignal) => Promise<string>;
type Workspace = Awaited<ReturnType<typeof provisionPackageWorkspace>>;
type Entry = Admission & {
  terminal: "failed" | "canceled" | "closed";
  budget: number;
  input: AdmittedArchive;
  context: JobContext;
  requests: Map<string, Work>;
  workspace?: Workspace;
  retained?: RetainedPackage;
  provisionFailure?: unknown;
  provisionStarted: boolean;
  closing?: Promise<void>;
  /** Files this admission's own work left beside its workspace; they go when it does. */
  renders: Set<string>;
};
const describe = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 4096);

/** One process-local resource owner; execution capacity remains exclusively in JobQueue. */
export class PackageRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly handles = new Map<string, Entry>();
  private readonly terminal = new Map<string, PackageAdmission>();
  private phase: "recovery" | "ready" | "disposed" = "recovery";
  private recovering: Promise<void> | undefined;
  private recoveryError: string | null = null;
  private readonly limits: ArchiveLimits;
  private readonly bytes: number;
  constructor(
    private readonly options: {
      parent: { directory: string; handle: FileHandle };
      jobs: JobQueue;
      worker: MediaWorker;
      delivery: DerivativeDelivery;
      limits?: ArchiveLimits;
      bytes?: number;
    },
  ) {
    this.limits = { ...(options.limits ?? archiveLimits) };
    validateArchiveLimits(this.limits);
    this.bytes = options.bytes ?? packageRegistryLimits.bytes;
    if (
      !Number.isSafeInteger(this.bytes) ||
      this.bytes < 1 ||
      this.bytes > packageRegistryLimits.bytes
    )
      throw new RangeError(
        "Package pool must be a positive safe byte count within its supported maximum",
      );
  }
  usage() {
    return {
      state: this.phase,
      error: this.recoveryError,
      owners: this.entries.size,
      budgetBytes: [...this.entries.values()].reduce((sum, entry) => sum + entry.budget, 0),
      confirmedBytes: [...this.entries.values()].reduce(
        (sum, entry) =>
          sum +
          (entry.retained
            ? entry.retained.archiveUsage.copiedBytes +
              entry.retained.archiveUsage.expandedBytes +
              entry.retained.outputUsage().actualBytes
            : 0),
        0,
      ),
      terminalReceipts: this.terminal.size,
    };
  }
  recover(): Promise<void> {
    if (this.phase === "disposed")
      return Promise.reject(new CatalogError("SERVICE_STOPPED", "Package registry is closed"));
    if (this.entries.size)
      return Promise.reject(
        new CatalogError(
          "PROCESSING_BUSY",
          "Package resources must close before startup recovery",
          {},
          true,
        ),
      );
    if (this.recovering) return this.recovering;
    this.phase = "recovery";
    this.recovering = recoverPackageWorkspaces(this.options.parent, this.options.worker)
      .then(() => {
        if (this.phase !== "disposed") this.phase = "ready";
        this.recoveryError = null;
      })
      .catch((error) => {
        this.recoveryError = describe(error);
        throw error;
      })
      .finally(() => {
        this.recovering = undefined;
      });
    return this.recovering;
  }
  async open(path: string): Promise<PackageAdmission> {
    if (this.phase === "disposed")
      throw new CatalogError("SERVICE_STOPPED", "Package registry is closed");
    if (this.phase !== "ready")
      throw new CatalogError("PROCESSING_BUSY", "Package admission awaits recovery", {}, true);
    if (this.entries.size >= packageRegistryLimits.owners)
      throw new CatalogError("LIMIT_EXCEEDED", "Too many package resources are owned", {}, true);
    const input = admitArchive(path);
    if (input.bytes > this.limits.compressedBytes) {
      input.close();
      throw new CatalogError("LIMIT_EXCEEDED", "Archive exceeds admission copy limit");
    }
    const budget = input.bytes + this.limits.expandedBytes + packageRegistryLimits.derivatives;
    if (this.usage().budgetBytes + budget > this.bytes) {
      input.close();
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Package pool cannot reserve this admission",
        {},
        true,
      );
    }
    let entry!: Entry;
    let context: JobContext;
    try {
      context = this.options.jobs.createContext(({ job, signal }) =>
        this.execute(entry, job, signal),
      );
    } catch (error) {
      input.close();
      throw error;
    }
    entry = {
      renders: new Set<string>(),
      id: randomUUID(),
      state: "queued",
      packageHandle: null,
      jobId: "",
      error: null,
      terminal: "closed",
      budget,
      input,
      context,
      requests: new Map(),
      provisionStarted: false,
    };
    this.entries.set(entry.id, entry);
    try {
      entry.jobId = this.options.jobs.submitContext(context, {
        artifact: "package.open",
        lane: "heavy",
        input: "{}",
      }).jobId;
      return this.snapshot(entry);
    } catch (error) {
      entry.terminal = "failed";
      entry.error = describe(error);
      await this.closeEntry(entry);
      throw error;
    }
  }
  active(): PackageAdmission[] {
    return [...this.entries.values()].map((entry) => this.snapshot(entry));
  }
  status(id: string): PackageAdmission {
    const entry = this.entries.get(id);
    const result = entry ? this.snapshot(entry) : this.terminal.get(id);
    if (!result) throw new CatalogError("NOT_FOUND", "Package admission expired or does not exist");
    return result;
  }
  lookup(
    handle: string,
  ): Pick<RetainedPackage, "manifest" | "revisionContents" | "files" | "archiveUsage"> {
    return this.ready(handle).retained!;
  }
  submit(handle: string, request: ContextJobRequest, execute: Work): ContextJob {
    if (request.artifact === "package.open")
      throw new CatalogError("INVALID_REQUEST", "Package admission is owned by the registry");
    const entry = this.ready(handle);
    const job = this.options.jobs.submitContext(entry.context, request);
    if (!entry.requests.has(job.jobId)) entry.requests.set(job.jobId, execute);
    return job;
  }
  /**
   * A path beside this admission's workspace for work that writes a file the archive seam cannot:
   * a rendered movie is assembled by AVFoundation at a path, not into a descriptor. The file
   * belongs to the admission and is removed with it, and the whole parent is cleared at startup,
   * so a service that dies mid-render leaves nothing behind either.
   */
  renderPath(handle: string, leaf: string): string {
    const entry = this.ready(handle);
    const path = join(this.options.parent.directory, `${entry.id}-${leaf}`);
    entry.renders.add(path);
    return path;
  }
  jobs(handle: string): ReturnType<JobQueue["contextJobs"]> {
    return this.options.jobs.contextJobs(this.ready(handle).context);
  }
  openOutput(handle: string, label: string) {
    return this.ready(handle).retained!.openOutput(label);
  }
  job(handle: string, jobId: string): ContextJob {
    return this.options.jobs.contextJob(this.ready(handle).context, jobId);
  }
  retry(handle: string, jobId: string): ContextJob {
    return this.options.jobs.retryContext(this.ready(handle).context, jobId);
  }
  cancel(handle: string, jobId: string): ContextJob {
    return this.options.jobs.cancelContextJob(this.ready(handle).context, jobId);
  }
  forget(handle: string, jobId: string): void {
    const entry = this.ready(handle);
    this.options.jobs.forgetContextJob(entry.context, jobId);
    entry.requests.delete(jobId);
  }
  close(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      if (entry.state === "queued" || entry.state === "opening") entry.terminal = "canceled";
      return this.closeEntry(entry);
    }
    if (this.terminal.has(id)) return Promise.resolve();
    return Promise.reject(
      new CatalogError("NOT_FOUND", "Package admission expired or does not exist"),
    );
  }
  async dispose(): Promise<void> {
    this.phase = "disposed";
    const results = await Promise.allSettled([
      this.recovering,
      ...[...this.entries.values()].map((entry) => this.closeEntry(entry)),
    ]);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) throw failed.reason;
  }
  private ready(handle: string): Entry {
    const entry = this.handles.get(handle);
    if (this.phase === "disposed" || !entry || entry.state !== "ready")
      throw new CatalogError("CONTEXT_CLOSED", "Package handle is not open in this process");
    return entry;
  }
  private snapshot(entry: Entry): PackageAdmission {
    return Object.freeze({
      id: entry.id,
      state: entry.state,
      packageHandle: entry.packageHandle,
      jobId: entry.jobId,
      error: entry.error,
    });
  }
  private async execute(entry: Entry, job: ContextJob, signal: AbortSignal): Promise<string> {
    if (job.artifact !== "package.open") {
      const work = entry.requests.get(job.jobId);
      if (!work || entry.state !== "ready")
        throw new CatalogError("CONTEXT_CLOSED", "Package work is no longer admitted");
      return work(entry.retained!, signal);
    }
    try {
      if (signal.aborted || entry.state !== "queued")
        throw new CatalogError("CANCELED", "Package opening canceled");
      entry.state = "opening";
      entry.provisionStarted = true;
      try {
        entry.workspace = await provisionPackageWorkspace(
          this.options.parent,
          this.options.worker,
          { name: entry.id, signal },
        );
      } catch (error) {
        entry.provisionFailure = error;
        throw error;
      }
      entry.retained = await openPackageArchive(
        entry.input,
        { directory: entry.workspace.directory, handle: entry.workspace.handle },
        this.options.worker,
        { signal, limits: this.limits },
      );
      if (signal.aborted || entry.state !== "opening")
        throw new CatalogError("CANCELED", "Package opening canceled");
      const { copiedBytes, expandedBytes } = entry.retained.archiveUsage;
      entry.budget = copiedBytes + expandedBytes + packageRegistryLimits.derivatives;
      entry.input.close();
      entry.packageHandle = randomUUID();
      entry.state = "ready";
      this.handles.set(entry.packageHandle, entry);
      return JSON.stringify({ packageHandle: entry.packageHandle });
    } catch (error) {
      entry.error = describe(error);
      if (!entry.closing) {
        entry.terminal = signal.aborted ? "canceled" : "failed";
        // Closing waits for this queue attempt; do not await it from inside the attempt.
        void this.closeEntry(entry).catch(() => {});
      }
      throw error;
    }
  }
  private closeEntry(entry: Entry): Promise<void> {
    if (entry.closing) return entry.closing;
    entry.state = "closing";
    if (entry.packageHandle) this.handles.delete(entry.packageHandle);
    const attempt = (async () => {
      await this.options.jobs.closeContext(entry.context);
      entry.requests.clear();
      if (entry.packageHandle)
        this.options.delivery.revoke({ kind: "package", id: entry.packageHandle });
      // Anything this admission rendered for itself is its own to take away: the leases over it
      // were just revoked, so nothing is reading it.
      for (const path of entry.renders) await rm(path, { force: true });
      entry.renders.clear();
      await entry.retained?.close();
      if (entry.workspace) await entry.workspace.remove();
      else if (entry.provisionStarted)
        await cleanupFailedPackageWorkspace(
          this.options.parent,
          entry.id,
          entry.provisionFailure,
          this.options.worker,
        );
      entry.input.close();
      entry.budget = 0;
      entry.state = entry.terminal;
      this.entries.delete(entry.id);
      this.terminal.set(entry.id, this.snapshot(entry));
      while (this.terminal.size > packageRegistryLimits.terminal)
        this.terminal.delete(this.terminal.keys().next().value!);
    })().catch((error) => {
      entry.state = "cleanup_failed";
      entry.error = describe(error);
      throw error;
    });
    entry.closing = attempt;
    void attempt
      .finally(() => {
        delete entry.closing;
      })
      .catch(() => {});
    return attempt;
  }
}
