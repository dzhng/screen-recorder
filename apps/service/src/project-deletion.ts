import { setImmediate } from "node:timers/promises";
import { CatalogError } from "@screenrec/core/catalog";
import type { ProjectStore } from "@screenrec/core/projects";
import type { JobQueue } from "@screenrec/core/jobs";

type Deleted = { projectId: string; deleted: true };

/** Orders current project resource owners; retained revisions journal unfinished retirement. */
export class ProjectDeletion {
  private readonly active = new Map<string, Promise<Deleted>>();
  private readonly lifetime = new AbortController();
  constructor(
    private readonly store: ProjectStore,
    private readonly jobs: JobQueue,
  ) {}

  delete(projectId: string): Promise<Deleted> {
    if (this.lifetime.signal.aborted)
      throw new CatalogError("SERVICE_STOPPED", "Project deletion is closed", {}, true);
    const existing = this.active.get(projectId);
    if (existing) return existing;
    if (!this.store.markDeleting(projectId)) return Promise.resolve({ projectId, deleted: true });
    const result = this.remove(projectId).finally(() => this.active.delete(projectId));
    this.active.set(projectId, result);
    return result;
  }

  private async remove(projectId: string): Promise<Deleted> {
    try {
      const owner = { kind: "project" as const, projectId };
      await this.jobs.drainOwner(owner);
      this.lifetime.signal.throwIfAborted();
      await this.jobs.forgetOwner(owner);
      for (;;) {
        this.lifetime.signal.throwIfAborted();
        if (this.store.finishDeletionPage(projectId)) break;
        await setImmediate();
      }
      return { projectId, deleted: true };
    } catch (error) {
      throw new CatalogError(
        "DELETE_FAILED",
        `Project deletion could not finish: ${error instanceof Error ? error.message : String(error)}`,
        { projectId },
        true,
      );
    }
  }

  async resume(reportFailure: (error: unknown) => void): Promise<void> {
    let afterId: string | undefined;
    while (!this.lifetime.signal.aborted) {
      const page = this.store.deletionsPage(afterId);
      for (const projectId of page.projectIds) {
        if (this.lifetime.signal.aborted) return;
        try {
          await this.delete(projectId);
        } catch (error) {
          reportFailure(error);
        }
      }
      if (page.nextAfterId === null) return;
      afterId = page.nextAfterId;
    }
  }

  async close(): Promise<void> {
    this.lifetime.abort();
    await Promise.allSettled(this.active.values());
  }
}
