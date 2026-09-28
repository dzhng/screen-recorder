import { type RevisionStore } from "@screenrec/core/library";
import { CatalogError } from "@screenrec/core/catalog";
import type { JobQueue } from "@screenrec/core/jobs";
import type { DerivedCache } from "@screenrec/core/cache";
import type { SourceEvidenceStore } from "@screenrec/core/evidence";
import type { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import type { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import type { TranscriptStore } from "@screenrec/core/transcript";
import type { CaptureService } from "./capture.js";
import type { DerivativeDelivery } from "./delivery.js";
import type { ManagedFiles } from "./managed-files.js";

type Owners = {
  store: RevisionStore;
  jobs: JobQueue;
  cache: DerivedCache;
  source: SourceEvidenceStore;
  scenes: SceneEvidenceStore;
  index: ScreenshotIndexStore;
  transcripts: TranscriptStore;
  capture: Pick<CaptureService, "quiesce">;
  delivery: DerivativeDelivery;
  cleanupReady: () => Promise<void>;
  exports?: {
    retireOwner(
      owner: { kind: "recording"; recordingId: string },
      signal: AbortSignal,
    ): Promise<void>;
  };
  files: Pick<ManagedFiles, "removeRecordingDirectory" | "removeCacheFiles">;
};
type Deleted = { recordingId: string; deleted: true };

/** Orders existing resource owners; the catalog marker is the restart journal. */
export class RecordingDeletion {
  private readonly active = new Map<string, Promise<Deleted>>();
  private readonly lifetime = new AbortController();
  constructor(private readonly owners: Owners) {}

  delete(recordingId: string): Promise<Deleted> {
    if (this.lifetime.signal.aborted)
      throw new CatalogError("SERVICE_STOPPED", "Recording deletion is closed", {}, true);
    const existing = this.active.get(recordingId);
    if (existing) return existing;
    const recording = this.owners.store.markDeleting(recordingId);
    if (!recording) return Promise.resolve({ recordingId, deleted: true });
    this.owners.delivery.revoke({ kind: "recording", id: recordingId });
    const result = this.remove(recordingId).finally(() => this.active.delete(recordingId));
    this.active.set(recordingId, result);
    return result;
  }

  private async remove(recordingId: string): Promise<Deleted> {
    const { jobs, capture, cache, source, scenes, index, transcripts, store, cleanupReady, files } =
      this.owners;
    const signal = this.lifetime.signal;
    try {
      // A refusal from one owner must not abandon another owner's still-running shutdown.
      const stopped = await Promise.allSettled([
        jobs.drainOwner({ kind: "recording", recordingId: recordingId }),
        capture.quiesce(recordingId),
      ]);
      for (const result of stopped) if (result.status === "rejected") throw result.reason;
      await this.owners.exports?.retireOwner({ kind: "recording", recordingId }, signal);
      await cleanupReady();
      signal.throwIfAborted();
      await cache.purgeOwner({ kind: "recording", recordingId: recordingId }, ({ ids, root }) =>
        files.removeCacheFiles(ids, root, signal),
      );
      await source.purge({ kind: "recording", recordingId }, signal);
      await scenes.reclaim(recordingId, () => false, signal);
      await files.removeRecordingDirectory(recordingId, signal);
      await index.forgetRecording(recordingId, signal);
      // Native removed the transcript files with the recording root; only catalog rows remain.
      await transcripts.purgeRecording(recordingId, signal);
      signal.throwIfAborted();
      await jobs.forgetOwner({ kind: "recording", recordingId: recordingId });
      signal.throwIfAborted();
      store.finishDeletion(recordingId);
      return { recordingId, deleted: true };
    } catch (error) {
      if (error instanceof CatalogError)
        throw new CatalogError(error.code, error.message, { ...error.details, recordingId }, true);
      throw new CatalogError(
        "DELETE_FAILED",
        `Recording deletion could not finish: ${error instanceof Error ? error.message : String(error)}`,
        { recordingId },
        true,
      );
    }
  }

  async resume(reportFailure: (error: unknown) => void): Promise<void> {
    let afterId: string | undefined;
    while (!this.lifetime.signal.aborted) {
      const page = this.owners.store.deletionsPage(afterId);
      for (const recording of page.recordings) {
        if (this.lifetime.signal.aborted) return;
        try {
          await this.delete(recording.recordingId);
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
