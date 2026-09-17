import { constants, lstatSync, realpathSync } from "node:fs";
import { open, realpath } from "node:fs/promises";
import type { DirectoryIdentity } from "@screenrec/core/cache";
import { CatalogError } from "@screenrec/core/library";
import type { MediaWorker } from "./worker.js";

/** Native file operations anchor deletion to directory descriptors, not re-resolved paths. */
export class ManagedFiles {
  private readonly home: string;
  private readonly expectedHome: DirectoryIdentity;
  constructor(
    home: string,
    private readonly worker: MediaWorker,
  ) {
    this.home = realpathSync(home);
    const stat = lstatSync(this.home, { bigint: true });
    this.expectedHome = { dev: stat.dev.toString(), ino: stat.ino.toString() };
  }
  /** The same library-root identity used for deletion defines where exports cannot live. */
  async externalDirectory(
    path: string,
    signal?: AbortSignal,
  ): Promise<{ directory: string; identity: DirectoryIdentity }> {
    signal?.throwIfAborted();
    const directory = await realpath(path);
    const parent = await open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK | 0x20000000,
    );
    try {
      const result = await this.worker(
        "storage.externalDirectory",
        { home: this.home, expectedHome: this.expectedHome },
        { descriptors: [parent.fd], ...(signal ? { signal } : {}) },
      );
      if (!result.ok)
        throw new CatalogError(
          result.error.code,
          result.error.message,
          result.error.details,
          result.error.retryable,
        );
      const identity = result.data as DirectoryIdentity;
      if (!identity || typeof identity.dev !== "string" || typeof identity.ino !== "string")
        throw new CatalogError(
          "INVALID_NATIVE_RESPONSE",
          "External destination was not identified",
        );
      return { directory, identity };
    } finally {
      await parent.close();
    }
  }
  removeRecordingDirectory(recordingId: string, signal: AbortSignal): Promise<void> {
    return this.remove("storage.removeRecordingDirectory", { recordingId }, signal);
  }
  removeCacheFiles(ids: string[], root: DirectoryIdentity, signal: AbortSignal): Promise<void> {
    return this.remove("storage.removeCacheFiles", { ids, expectedCacheRoot: root }, signal);
  }
  private async remove(
    operation: string,
    params: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<void> {
    const result = await this.worker(
      operation,
      { home: this.home, expectedHome: this.expectedHome, ...params },
      { signal },
    );
    if (!result.ok)
      throw new CatalogError(
        result.error.code,
        result.error.message,
        result.error.details,
        result.error.retryable,
      );
    if (
      !result.data ||
      typeof result.data !== "object" ||
      !("removed" in result.data) ||
      result.data.removed !== true
    )
      throw new CatalogError(
        "INVALID_NATIVE_RESPONSE",
        "Native storage removal did not confirm completion",
      );
  }
}
