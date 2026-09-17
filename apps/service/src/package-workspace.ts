import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import type { MediaWorker } from "./worker.js";

type Identity = Readonly<{ dev: string; ino: string }>;
type Parent = Readonly<{ directory: string; handle: FileHandle }>;

function result(value: Awaited<ReturnType<MediaWorker>>) {
  if (!value.ok)
    throw new CatalogError(
      value.error.code,
      value.error.message,
      value.error.details,
      value.error.retryable,
    );
  return value.data;
}

/** Parent is borrowed until removal succeeds. Close RetainedPackage before calling remove. */
export async function provisionPackageWorkspace(
  parent: Parent,
  worker: MediaWorker,
  options: { name?: string; signal?: AbortSignal } = {},
) {
  const name = options.name ?? randomUUID();
  const parentHandle = parent.handle;
  const directory = join(parent.directory, name);
  const signal = options.signal;
  if (signal?.aborted) throw new CatalogError("CANCELED", "Workspace creation canceled");
  const info = await parentHandle.stat({ bigint: true });
  const parentIdentity = { dev: info.dev.toString(), ino: info.ino.toString() };
  const call = (
    operation: string,
    identity?: Identity,
    handle?: FileHandle,
    signal?: AbortSignal,
  ) =>
    worker(
      operation,
      { parent: parentIdentity, name, ...(identity ? { identity } : {}) },
      {
        descriptors: [parentHandle.fd, ...(handle ? [handle.fd] : [])],
        ...(signal ? { signal } : {}),
      },
    );
  // Once mkdir can occur, drain creation to its receipt before honoring cancellation.
  let receipt: { name?: unknown; identity?: Identity };
  try {
    receipt = result(await call("packageWorkspace.create")) as typeof receipt;
  } catch (cause) {
    throw new CatalogError(
      "INVALID_STORAGE",
      "Workspace creation failed; reservation may need recovery",
      { name, cause: String(cause) },
      true,
    );
  }
  if (
    receipt?.name !== name ||
    !receipt.identity ||
    typeof receipt.identity.dev !== "string" ||
    typeof receipt.identity.ino !== "string" ||
    !/^\d+$/.test(receipt.identity.dev) ||
    !/^\d+$/.test(receipt.identity.ino)
  )
    throw new CatalogError("INVALID_STORAGE", "Invalid workspace creation receipt", { name });
  const identity = Object.freeze({ ...receipt.identity });
  let handle: FileHandle | undefined;
  try {
    if (signal?.aborted) throw new CatalogError("CANCELED", "Workspace creation canceled");
    handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | 0x20000000);
    const actual = await handle.stat({ bigint: true });
    if (
      !actual.isDirectory() ||
      actual.dev.toString() !== identity.dev ||
      actual.ino.toString() !== identity.ino
    )
      throw new CatalogError("INVALID_STORAGE", "Workspace locator identity changed");
    result(await call("packageWorkspace.admit", identity, handle, signal));
  } catch (cause) {
    await handle?.close();
    try {
      result(await call("packageWorkspace.remove", identity));
    } catch (cleanup) {
      throw new CatalogError(
        "INVALID_STORAGE",
        "Workspace admission and cleanup failed",
        { name, identity, cause: String(cause), cleanup: String(cleanup) },
        true,
      );
    }
    throw cause;
  }
  const admitted = handle;
  let removed = false;
  let closed = false;
  let removal: Promise<void> | undefined;
  return {
    name,
    directory,
    identity,
    handle: admitted,
    remove(): Promise<void> {
      if (removed) return Promise.resolve();
      if (removal) return removal;
      removal = (async () => {
        if (!closed) {
          await admitted.close();
          closed = true;
        }
        result(await call("packageWorkspace.remove", identity));
        removed = true;
      })().finally(() => {
        removal = undefined;
      });
      return removal;
    },
  };
}
