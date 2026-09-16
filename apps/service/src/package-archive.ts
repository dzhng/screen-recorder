import type { FileHandle } from "node:fs/promises";
import { CatalogError } from "@screenrec/core/library";
import {
  archiveLimits,
  validateArchiveLimits,
  verifyArchiveReceipt,
  type ArchiveLimits,
} from "@screenrec/core/package-archive";
import type { MediaWorker } from "./worker.js";

/** The caller exclusively owns this empty 0700 directory and holds it open until this promise settles. */
export async function verifyPackageArchive(
  archive: string,
  workspace: FileHandle,
  worker: MediaWorker,
  options: { signal?: AbortSignal; limits?: ArchiveLimits; timeoutMs?: number } = {},
) {
  const limits = options.limits ?? archiveLimits;
  validateArchiveLimits(limits);
  const info = await workspace.stat({ bigint: true });
  if (
    !info.isDirectory() ||
    info.uid !== BigInt(process.getuid!()) ||
    (info.mode & 0o777n) !== 0o700n
  )
    throw new CatalogError(
      "INVALID_STORAGE",
      "Archive workspace must be an owned private directory",
    );
  const identity = { dev: info.dev.toString(), ino: info.ino.toString() };
  const nativeOptions = {
    descriptors: [workspace.fd],
    timeoutMs: options.timeoutMs ?? 30 * 60_000,
  };
  const requireResult = (result: Awaited<ReturnType<MediaWorker>>) => {
    if (!result.ok)
      throw new CatalogError(
        result.error.code,
        result.error.message,
        result.error.details,
        result.error.retryable,
      );
    return result.data;
  };
  // Admission is read-only. A failed admission must not clean a directory we did not acquire empty.
  const prepared = requireResult(
    await worker(
      "archive.prepare",
      { identity },
      { ...nativeOptions, ...(options.signal ? { signal: options.signal } : {}) },
    ),
  );
  if (
    !prepared ||
    typeof prepared !== "object" ||
    !("empty" in prepared) ||
    prepared.empty !== true
  )
    throw new CatalogError(
      "INVALID_NATIVE_RESPONSE",
      "Archive workspace admission was not confirmed",
    );
  let receipt: ReturnType<typeof verifyArchiveReceipt> | undefined;
  let failure: unknown;
  try {
    const result = await worker(
      "archive.extract",
      { archive, identity, limits },
      { ...nativeOptions, ...(options.signal ? { signal: options.signal } : {}) },
    );
    receipt = verifyArchiveReceipt(requireResult(result), limits);
  } catch (error) {
    failure = error;
  }
  // The parser is reaped before independent cleanup inherits the still-open root FD.
  try {
    const result = requireResult(
      await worker("archive.cleanup", { identity }, { ...nativeOptions, timeoutMs: 30_000 }),
    );
    if (!result || typeof result !== "object" || !("removed" in result) || result.removed !== true)
      throw new CatalogError(
        "INVALID_NATIVE_RESPONSE",
        "Archive cleanup did not confirm completion",
      );
  } catch (cleanup) {
    const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));
    throw new CatalogError(
      "ARCHIVE_CLEANUP_FAILED",
      "Archive workspace cleanup failed; its owner must retain it for recovery",
      {
        operationError: failure === undefined ? null : describe(failure),
        cleanupError: describe(cleanup),
      },
      true,
    );
  }
  if (failure !== undefined) throw failure;
  return receipt!;
}
