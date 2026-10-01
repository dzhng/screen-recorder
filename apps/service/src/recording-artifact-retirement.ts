import type { DerivedCache } from "@screenrec/core/cache";
import type { SourceEvidenceStore } from "@screenrec/core/evidence";
import type { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import type { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import type { TranscriptStore } from "@screenrec/core/transcript";
import type { ManagedFiles } from "./managed-files.js";

type Owners = {
  cache: DerivedCache;
  source: SourceEvidenceStore;
  scenes: SceneEvidenceStore;
  index: ScreenshotIndexStore;
  transcripts: TranscriptStore;
  cleanupReady: () => Promise<void>;
  exports?: {
    retireOwner(
      owner: { kind: "recording"; recordingId: string },
      signal: AbortSignal,
    ): Promise<void>;
  };
  files: Pick<ManagedFiles, "removeCacheFiles">;
};

/** Recording editing owns artifacts outside the donor directory as well as catalog generations. */
export class RecordingArtifactRetirement {
  constructor(private readonly owners: Owners) {}

  async prepare(recordingId: string, signal: AbortSignal): Promise<void> {
    await this.owners.exports?.retireOwner({ kind: "recording", recordingId }, signal);
    await this.owners.cleanupReady();
  }

  async purge(
    recordingId: string,
    signal: AbortSignal,
    lifetime?: { readonly fd: number },
  ): Promise<void> {
    const owner = { kind: "recording" as const, recordingId };
    const { cache, source, scenes, files } = this.owners;
    await cache.purgeOwner(owner, ({ ids, root }) =>
      files.removeCacheFiles(ids, root, signal, lifetime),
    );
    await source.purge(owner, signal);
    await scenes.reclaim(owner, () => false, signal);
  }

  async forget(recordingId: string, signal: AbortSignal): Promise<void> {
    const owner = { kind: "recording" as const, recordingId };
    await this.owners.index.forgetOwner(owner, signal);
    // Native removed transcript files with the recording root; only catalog rows remain.
    await this.owners.transcripts.purge(owner, signal);
  }
}
