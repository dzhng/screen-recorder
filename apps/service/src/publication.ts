import { constants } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import { CatalogError } from "@screenrec/core/library";
import type { MediaWorker } from "./worker.js";

export type PublicationState = "missing" | "committed" | "replaced" | "modified";

/** A single external publication lifetime. Closing releases descriptors, never evidence.
 * The caller retains this private directory until reconciliation/acknowledgement and
 * persists acknowledged external truth separately from a disposable job result. */
export class Publication {
  private pending: Promise<unknown> | undefined;
  private closing: Promise<void> | undefined;
  private constructor(
    private readonly stage: FileHandle,
    private readonly destination: FileHandle,
    private readonly identities: Record<string, unknown>,
    private readonly worker: MediaWorker,
    private readonly timeoutMs: number | undefined,
  ) {}

  static async open(
    stagePath: string,
    destinationPath: string,
    worker: MediaWorker,
    options: { timeoutMs?: number } = {},
  ) {
    const stageBefore = await lstat(stagePath, { bigint: true });
    if (
      !stageBefore.isDirectory() ||
      stageBefore.uid !== BigInt(process.getuid!()) ||
      (stageBefore.mode & 0o777n) !== 0o700n
    )
      throw new CatalogError(
        "INVALID_STORAGE",
        "Publication staging must be an owned private directory",
      );
    // Darwin O_NOFOLLOW_ANY rejects symlink ancestry; O_EXLOCK follows inherited FDs.
    const flags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK | 0x20000000;
    const stage = await open(await realpath(stagePath), flags | 0x20).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "EAGAIN" || error.code === "EWOULDBLOCK")
          throw new CatalogError(
            "PUBLICATION_BUSY",
            "A publisher still owns this staging directory",
            {},
            true,
          );
        throw error;
      },
    );
    let destination: FileHandle | undefined;
    try {
      const actualStage = await stage.stat({ bigint: true });
      if (actualStage.dev !== stageBefore.dev || actualStage.ino !== stageBefore.ino)
        throw new CatalogError("INVALID_STORAGE", "Publication staging changed while opening");
      const before = await lstat(destinationPath, { bigint: true });
      if (!before.isDirectory())
        throw new CatalogError("INVALID_STORAGE", "Publication destination must be a directory");
      destination = await open(await realpath(destinationPath), flags);
      const actual = await destination.stat({ bigint: true });
      if (actual.dev !== before.dev || actual.ino !== before.ino)
        throw new CatalogError("INVALID_STORAGE", "Publication destination changed while opening");
      const identity = (value: typeof actual) => ({
        dev: value.dev.toString(),
        ino: value.ino.toString(),
      });
      return new Publication(
        stage,
        destination,
        { stage: identity(actualStage), destination: identity(actual) },
        worker,
        options.timeoutMs,
      );
    } catch (error) {
      await destination?.close();
      await stage.close();
      throw error;
    }
  }

  private run<T>(action: () => Promise<T>): Promise<T> {
    if (this.closing)
      return Promise.reject(new CatalogError("INVALID_STATE", "Publication is closed"));
    if (this.pending)
      return Promise.reject(
        new CatalogError("PUBLICATION_BUSY", "Publication operation is still running", {}, true),
      );
    const pending = action();
    this.pending = pending;
    return pending.finally(() => {
      this.pending = undefined;
    });
  }

  private async call(
    operation: string,
    params: Record<string, unknown> = {},
    options: {
      signal?: AbortSignal;
      source?: FileHandle;
    } = {},
  ) {
    const result = await this.worker(
      `publication.${operation}`,
      { ...this.identities, ...params },
      {
        ...(options.signal ? { signal: options.signal } : {}),
        ...(this.timeoutMs !== undefined ? { timeoutMs: this.timeoutMs } : {}),
        descriptors: [
          this.stage.fd,
          this.destination.fd,
          ...(options.source ? [options.source.fd] : []),
        ],
      },
    );
    if (!result.ok)
      throw new CatalogError(
        result.error.code,
        result.error.message,
        result.error.details,
        result.error.retryable,
      );
    if (!result.data || typeof result.data !== "object")
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Publication response is missing");
    return result.data;
  }

  /** Source must remain open through this call. A failed prepare keeps partial private
   * evidence for explicit discard; it can never create the external destination. */
  prepare(
    source: FileHandle,
    leaf: string,
    maxBytes: number,
    options: { signal?: AbortSignal } = {},
  ) {
    return this.run(async () => {
      const value = await this.call("prepare", { leaf, maxBytes }, { ...options, source });
      if (!("receipt" in value))
        throw new CatalogError(
          "INVALID_NATIVE_RESPONSE",
          "Publication preparation was not confirmed",
        );
      return value.receipt;
    });
  }

  private async observe(): Promise<PublicationState> {
    const value = await this.call("reconcile");
    if (
      !("state" in value) ||
      typeof value.state !== "string" ||
      !["missing", "committed", "replaced", "modified"].includes(value.state)
    )
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Publication outcome was not confirmed");
    return value.state as PublicationState;
  }

  reconcile() {
    return this.run(() => this.observe());
  }

  commit(options: { signal?: AbortSignal } = {}) {
    return this.run(async () => {
      // An abort already observed by this owner never enters the commit worker.
      if (options.signal?.aborted) throw new CatalogError("CANCELED", "Publication was canceled");
      let failure: unknown;
      try {
        await this.call("commit", {}, options);
      } catch (error) {
        failure = error;
      }
      // mediaWorker has reaped the child. Even a canceled/timeout result may have linked.
      const state = await this.observe();
      if (state === "missing" && failure !== undefined) throw failure;
      return state;
    });
  }

  /** Call only after the caller durably records the observed external commit. */
  acknowledge() {
    return this.remove("acknowledge");
  }
  /** Explicitly abandons private evidence; never removes the external destination. */
  discard() {
    return this.remove("discard");
  }
  private remove(operation: "acknowledge" | "discard") {
    return this.run(async () => {
      const value = await this.call(operation);
      if (!("removed" in value) || value.removed !== true)
        throw new CatalogError("INVALID_NATIVE_RESPONSE", "Publication cleanup was not confirmed");
    });
  }
  close(): Promise<void> {
    return (this.closing ??= (async () => {
      await this.pending?.catch(() => {});
      await Promise.all([this.stage.close(), this.destination.close()]);
    })());
  }
}
