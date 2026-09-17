import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import { O_NOFOLLOW_ANY } from "@screenrec/core/files";
import { nativeConfirmed, nativeResult, type MediaWorker } from "./worker.js";

type Identity = Readonly<{ dev: string; ino: string }>;
type Parent = Readonly<{ directory: string; handle: FileHandle }>;

class FailedWorkspaceProvision extends CatalogError {
  constructor(
    readonly workspaceName: string,
    readonly parentIdentity: Identity,
    readonly childIdentity: Identity,
    cause: unknown,
    cleanup: unknown,
  ) {
    super(
      "INVALID_STORAGE",
      "Workspace admission and cleanup failed",
      {
        name: workspaceName,
        identity: childIdentity,
        cause: String(cause),
        cleanup: String(cleanup),
      },
      true,
    );
  }
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
    receipt = nativeResult(await call("packageWorkspace.create")) as typeof receipt;
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
    handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | O_NOFOLLOW_ANY);
    const actual = await handle.stat({ bigint: true });
    if (
      !actual.isDirectory() ||
      actual.dev.toString() !== identity.dev ||
      actual.ino.toString() !== identity.ino
    )
      throw new CatalogError("INVALID_STORAGE", "Workspace locator identity changed");
    nativeResult(await call("packageWorkspace.admit", identity, handle, signal));
  } catch (cause) {
    await handle?.close();
    try {
      nativeConfirmed(
        await call("packageWorkspace.remove", identity),
        "removed",
        "Workspace removal was not confirmed",
      );
    } catch (cleanup) {
      throw new FailedWorkspaceProvision(name, parentIdentity, identity, cause, cleanup);
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
        nativeConfirmed(
          await call("packageWorkspace.remove", identity),
          "removed",
          "Workspace removal was not confirmed",
        );
        removed = true;
      })().finally(() => {
        removal = undefined;
      });
      return removal;
    },
  };
}

/** Startup-only: caller blocks admission and exclusively owns the borrowed private parent. */
export function recoverPackageWorkspaces(
  parent: Parent,
  worker: MediaWorker,
): Promise<{ recovered: number }> {
  return recoverWorkspaces(parent, worker);
}

/** No creation receipt was observed, so only an empty child (or absence) authorizes release. */
export function recoverUnconfirmedPackageWorkspace(
  parent: Parent,
  name: string,
  worker: MediaWorker,
): Promise<{ recovered: number }> {
  return recoverWorkspaces(parent, worker, name);
}

async function recoverWorkspaces(
  parent: Parent,
  worker: MediaWorker,
  name?: string,
): Promise<{ recovered: number }> {
  const handle = parent.handle;
  const info = await handle.stat({ bigint: true });
  const receipt = nativeResult(
    await worker(
      name === undefined ? "packageWorkspace.recover" : "packageWorkspace.recoverUnconfirmed",
      {
        ...(name === undefined ? {} : { name }),
        parent: { dev: info.dev.toString(), ino: info.ino.toString() },
      },
      { descriptors: [handle.fd] },
    ),
  ) as { recovered?: unknown };
  if (
    !receipt ||
    !Number.isInteger(receipt.recovered) ||
    (receipt.recovered as number) < 0 ||
    (receipt.recovered as number) > 4
  )
    throw new CatalogError("INVALID_NATIVE_RESPONSE", "Invalid workspace recovery receipt");
  return { recovered: receipt.recovered as number };
}

/** Retry owner-issued known identity; an unconfirmed creation may authorize only empty cleanup. */
export async function cleanupFailedPackageWorkspace(
  parent: Parent,
  name: string,
  failure: unknown,
  worker: MediaWorker,
): Promise<void> {
  if (failure instanceof FailedWorkspaceProvision) {
    if (failure.workspaceName !== name)
      throw new CatalogError("INVALID_STORAGE", "Failed workspace name changed");
    nativeConfirmed(
      await worker(
        "packageWorkspace.remove",
        {
          parent: failure.parentIdentity,
          name,
          identity: failure.childIdentity,
        },
        { descriptors: [parent.handle.fd] },
      ),
      "removed",
      "Workspace removal was not confirmed",
    );
  } else {
    await recoverUnconfirmedPackageWorkspace(parent, name, worker);
  }
}
