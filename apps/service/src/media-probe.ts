import { randomUUID, createHash } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/catalog";
import { withRenderAttempt } from "./render.js";
import { nativeResult, type MediaWorker } from "./worker.js";

const metadataBytes = 64 * 1024 * 1024;

/** The caller owns this attempt and its inherited leases; metadata never crosses a control frame. */
export async function readMediaProbe(
  worker: MediaWorker,
  directory: string,
  path: string,
  signal: AbortSignal,
  descriptors: readonly number[],
  options: { inspectCompressedVideo?: boolean } = {},
): Promise<unknown> {
  signal.throwIfAborted();
  const output = join(directory, `probe-${randomUUID()}.json`);
  const handle = await open(output, "wx+", 0o600);
  try {
    const locator = `/dev/fd/${3 + descriptors.length}`;
    const receipt = nativeResult(
      await worker(
        "media.probe",
        {
          path,
          output: locator,
          ...(options.inspectCompressedVideo ? { inspectCompressedVideo: true } : {}),
        },
        {
          signal,
          descriptors: [...descriptors, handle.fd],
        },
      ),
    ) as { file?: unknown; bytes?: unknown; sha256?: unknown };
    const size = (await handle.stat()).size;
    if (
      !receipt ||
      receipt.file !== locator ||
      typeof receipt.bytes !== "number" ||
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes <= 0 ||
      receipt.bytes > metadataBytes ||
      receipt.bytes !== size ||
      typeof receipt.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(receipt.sha256)
    )
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Media probe file receipt is invalid", {
        maximumBytes: metadataBytes,
      });
    // OutputFile uses positional writes, leaving the caller-created descriptor at offset zero.
    const bytes = await handle.readFile({ signal });
    if (
      bytes.length !== size ||
      createHash("sha256").update(bytes).digest("hex") !== receipt.sha256
    )
      throw new CatalogError(
        "INVALID_NATIVE_RESPONSE",
        "Media probe bytes differ from their receipt",
      );
    signal.throwIfAborted();
    try {
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Media probe file is not valid JSON");
    }
  } finally {
    await handle.close();
    await rm(output, { force: true });
  }
}

/** Asset preparation borrows the existing render-attempt owner for its transient metadata file. */
export function assetProbe(worker: MediaWorker, workspace: string) {
  return async (path: string, signal: AbortSignal, lifetime?: { readonly fd: number }) => {
    await mkdir(workspace, { recursive: true, mode: 0o700 });
    return withRenderAttempt(
      worker,
      workspace,
      signal,
      (directory, execute) =>
        readMediaProbe(execute, directory, path, signal, lifetime ? [lifetime.fd] : []),
      async (metadata) => metadata,
    );
  };
}
