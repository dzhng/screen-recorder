import { constants } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import { CatalogError } from "@screenrec/core/library";
import type { DirectoryIdentity } from "@screenrec/core/cache";
import type { MediaWorker } from "./worker.js";

export type PublicationState = "unprepared" | "missing" | "committed" | "replaced" | "modified";

export type PublicationReceipt = {
  stage: DirectoryIdentity;
  destination: DirectoryIdentity;
  file: DirectoryIdentity;
  leaf: string;
  bytes: number;
  sha256: string;
};
export type PublicationObservation = {
  state: PublicationState;
  receipt: PublicationReceipt | null;
};

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
    options: {
      timeoutMs?: number;
      expected?: { stage: DirectoryIdentity; destination: DirectoryIdentity };
    } = {},
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
      if (
        options.expected &&
        (actualStage.dev.toString() !== options.expected.stage.dev ||
          actualStage.ino.toString() !== options.expected.stage.ino ||
          actual.dev.toString() !== options.expected.destination.dev ||
          actual.ino.toString() !== options.expected.destination.ino)
      )
        throw new CatalogError("PUBLICATION_CHANGED", "Registered publication ownership changed");
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

  /** The catalog records this random sibling name before allocation. No payload writer
   * may enter until the returned directory identity is committed to that catalog. */
  static async allocate(
    directory: string,
    expected: DirectoryIdentity,
    name: string,
    worker: MediaWorker,
  ): Promise<DirectoryIdentity> {
    const value = await this.stageEntry("allocate", directory, expected, name, worker);
    const identity = value.identity as DirectoryIdentity;
    if (!identity || typeof identity.dev !== "string" || typeof identity.ino !== "string")
      throw new CatalogError(
        "INVALID_NATIVE_RESPONSE",
        "Publication allocation did not identify staging",
      );
    return identity;
  }

  static async absent(
    directory: string,
    expected: DirectoryIdentity,
    name: string,
    worker: MediaWorker,
  ): Promise<boolean> {
    const value = await this.stageEntry("absent", directory, expected, name, worker);
    if (typeof value.absent !== "boolean")
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Staging absence was not confirmed");
    return value.absent;
  }

  private static async stageEntry(
    operation: "allocate" | "absent",
    directory: string,
    expected: DirectoryIdentity,
    name: string,
    worker: MediaWorker,
  ) {
    const parent = await open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK | 0x20000000,
    );
    try {
      const result = await worker(
        `publication.${operation}`,
        { destination: expected, name },
        { descriptors: [parent.fd] },
      );
      return this.data(result);
    } finally {
      await parent.close();
    }
  }

  private static data(result: Awaited<ReturnType<MediaWorker>>): Record<string, unknown> {
    if (!result.ok)
      throw new CatalogError(
        result.error.code,
        result.error.message,
        result.error.details,
        result.error.retryable,
      );
    if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Publication response is missing");
    return result.data as Record<string, unknown>;
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
      source?: { readonly fd: number };
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
    return Publication.data(result);
  }

  /** Source must remain open through this call. A failed prepare keeps partial private
   * evidence for explicit discard; it can never create the external destination. */
  prepare(
    source: { readonly fd: number },
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

  private async observe(): Promise<PublicationObservation> {
    const value = await this.call("reconcile");
    if (
      !("state" in value) ||
      typeof value.state !== "string" ||
      !["unprepared", "missing", "committed", "replaced", "modified"].includes(value.state)
    )
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Publication outcome was not confirmed");
    const receipt = "receipt" in value ? value.receipt : undefined;
    if (value.state === "unprepared" ? receipt !== null : !receipt || typeof receipt !== "object")
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Publication receipt is missing");
    return {
      state: value.state as PublicationState,
      receipt: receipt as PublicationReceipt | null,
    };
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
      const observed = await this.observe();
      if (
        (observed.state === "missing" || observed.state === "unprepared") &&
        failure !== undefined
      )
        throw failure;
      return observed;
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
  retire(name: string) {
    return this.run(async () => {
      const value = await this.call("retire", { name });
      if (!("removed" in value) || value.removed !== true)
        throw new CatalogError(
          "INVALID_NATIVE_RESPONSE",
          "Publication staging retirement was not confirmed",
        );
    });
  }
  close(): Promise<void> {
    return (this.closing ??= (async () => {
      await this.pending?.catch(() => {});
      await Promise.all([this.stage.close(), this.destination.close()]);
    })());
  }
}
