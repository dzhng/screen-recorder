import type { FileHandle } from "node:fs/promises";
import { fstatSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { CatalogError } from "@screenrec/core/library";
import {
  archiveLimits,
  validateArchiveLimits,
  verifyArchiveReceipt,
  type ArchiveLimits,
} from "@screenrec/core/package-archive";
import {
  IdentifiedFiles,
  fileSubdirectory,
  type IdentifiedFile,
  type OpenedFile,
  type FileAccess,
} from "@screenrec/core/files";
import { nativeConfirmed, nativeResult, type MediaWorker } from "./worker.js";
import type { AdmittedArchive } from "./archive-input.js";

export const packageOutputBytes = 128 * 1024 ** 2;

type Options = { signal?: AbortSignal; limits?: ArchiveLimits; timeoutMs?: number };
async function extractArchive(
  archive: AdmittedArchive,
  workspace: FileHandle,
  worker: MediaWorker,
  options: Options,
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
  nativeConfirmed(
    await worker(
      "archive.prepare",
      { identity },
      { ...nativeOptions, ...(options.signal ? { signal: options.signal } : {}) },
    ),
    "empty",
    "Archive workspace admission was not confirmed",
  );
  const close = async (failure?: unknown) => {
    try {
      nativeConfirmed(
        await worker("archive.cleanup", { identity }, { ...nativeOptions, timeoutMs: 30_000 }),
        "removed",
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
  };
  try {
    const result = await worker(
      "archive.extract",
      { input: { bytes: archive.bytes, identity: archive.identity }, identity, limits },
      {
        ...nativeOptions,
        descriptors: [workspace.fd, archive.fd],
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    const verified = verifyArchiveReceipt(nativeResult(result), limits);
    if (verified.copiedBytes !== archive.bytes)
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "Archive copy size differs from admission");
    return { verified, identity, close };
  } catch (failure) {
    await close(failure);
    throw failure;
  }
}
type Extraction = Awaited<ReturnType<typeof extractArchive>>;

/** Receipt-only admission and retained inspection use this same extraction/validation owner. */
export async function verifyPackageArchive(
  archive: AdmittedArchive,
  workspace: FileHandle,
  worker: MediaWorker,
  options: Options = {},
) {
  const extraction = await extractArchive(archive, workspace, worker, options);
  await extraction.close();
  const { files: _files, revisionContents: _revisions, ...receipt } = extraction.verified;
  return receipt;
}

export async function openPackageArchive(
  archive: AdmittedArchive,
  workspace: { directory: string; handle: FileHandle },
  worker: MediaWorker,
  options: Options = {},
) {
  const extraction = await extractArchive(archive, workspace.handle, worker, options);
  try {
    return new RetainedPackage(workspace, worker, extraction);
  } catch (error) {
    await extraction.close(error);
    throw error;
  }
}

type Output = {
  name: string;
  label: string;
  charged: number;
  file?: IdentifiedFile;
  phase: "writing" | "ready" | "retired";
  readers: number;
  drained?: () => void;
  retirement?: Promise<void>;
};

/** Internal read context. Public scheduling/cache/handle ownership belongs to the later service integration. */
export class RetainedPackage {
  readonly manifest: Extraction["verified"]["manifest"];
  readonly archiveUsage: Readonly<Pick<Extraction["verified"], "copiedBytes" | "expandedBytes">>;
  readonly revisionContents: Readonly<Record<string, string>>;
  readonly files: FileAccess;
  private readonly opened: IdentifiedFiles;
  private readonly controller = new AbortController();
  private readonly active = new Set<Promise<unknown>>();
  private readonly outputs = new Map<string, Output>();
  private readonly maintenance = new Set<Promise<void>>();
  private outputBytes = 0;
  private workerTail: Promise<unknown> = Promise.resolve();
  private closing: Promise<void> | undefined;
  private closeFailed = false;
  constructor(
    private readonly workspace: { directory: string; handle: FileHandle },
    private readonly worker: MediaWorker,
    private readonly extraction: Extraction,
  ) {
    this.manifest = extraction.verified.manifest;
    this.archiveUsage = Object.freeze({
      copiedBytes: extraction.verified.copiedBytes,
      expandedBytes: extraction.verified.expandedBytes,
    });
    this.revisionContents = extraction.verified.revisionContents;
    this.opened = new IdentifiedFiles(workspace.directory, extraction.verified.files);
    this.files = fileSubdirectory(this.opened, "content");
  }
  private callWorker(...args: Parameters<MediaWorker>): ReturnType<MediaWorker> {
    const task = this.workerTail.then(() => this.worker(...args));
    this.workerTail = task.catch(() => {});
    return task;
  }
  outputUsage(): { actualBytes: number; reservedBytes: number; outputs: number } {
    const actualBytes = [...this.outputs.values()].reduce(
      (sum, output) => sum + (output.file?.bytes ?? 0),
      0,
    );
    return {
      actualBytes,
      reservedBytes: this.outputBytes - actualBytes,
      outputs: this.outputs.size,
    };
  }
  openOutput(label: string): OpenedFile {
    const output = this.outputs.get(label);
    if (output?.phase !== "ready")
      throw new CatalogError("NOT_FOUND", "Output is not available in this context");
    const file = this.opened.open(output.name, false, () => {
      output.readers--;
      if (!output.readers) output.drained?.();
    });
    output.readers++;
    this.outputs.delete(label);
    this.outputs.set(label, output);
    return file;
  }
  releaseOutput(label: string): Promise<void> {
    const output = this.outputs.get(label);
    if (!output) return Promise.resolve();
    if (output.phase === "writing")
      throw new CatalogError("PROCESSING_BUSY", "Output is still being written", {}, true);
    output.phase = "retired";
    if (output.retirement) return output.retirement;
    const retirement = (async () => {
      if (output.readers)
        await new Promise<void>((resolve) => {
          output.drained = resolve;
        });
      if (this.closing) return this.closing;
      await this.removeOutput(output);
    })();
    output.retirement = retirement;
    void retirement.catch(() => {
      if (output.retirement === retirement) delete output.retirement;
    });
    return retirement;
  }
  private removeOutput(output: Output): Promise<void> {
    const task = (async () => {
      if (!output.file)
        throw new CatalogError(
          "OUTPUT_CLEANUP_FAILED",
          "Output creation was not confirmed; close the context for recovery",
        );
      nativeConfirmed(
        await this.callWorker(
          "archive.removeOutput",
          {
            identity: this.extraction.identity,
            name: output.name,
            fileIdentity: output.file.identity,
          },
          { descriptors: [this.workspace.handle.fd] },
        ),
        "removed",
        "Output cleanup did not confirm removal",
      );
      this.opened.forget(output.name);
      this.outputBytes -= output.charged;
      this.outputs.delete(output.label);
    })();
    this.maintenance.add(task);
    void task.then(
      () => this.maintenance.delete(task),
      () => this.maintenance.delete(task),
    );
    return task;
  }
  private async reserveCapacity(bytes: number, signal: AbortSignal): Promise<void> {
    const available = () =>
      this.outputs.size < 32 && this.outputBytes + bytes <= packageOutputBytes;
    const candidates = [...this.outputs.values()];
    for (const output of candidates) {
      signal.throwIfAborted();
      if (available()) return;
      // An unconfirmed creation has no identity to remove; only close recovers its slot.
      if (output.phase === "writing" || output.readers || output.retirement || !output.file)
        continue;
      await this.releaseOutput(output.label);
    }
    if (!available())
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Package derivative budget is pinned by active reads or work",
        {},
        true,
      );
  }
  run(
    operation: "media.frame" | "media.visualSamples" | "media.audio",
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    this.opened.check();
    if (this.closing) throw new CatalogError("CONTEXT_CLOSED", "Package is closing");
    if (this.active.size) throw new CatalogError("BUSY", "Package already owns a native request");
    const combined = signal
      ? AbortSignal.any([this.controller.signal, signal])
      : this.controller.signal;
    const task = this.execute(operation, structuredClone(params), combined);
    this.active.add(task);
    void task.then(
      () => this.active.delete(task),
      () => this.active.delete(task),
    );
    return task;
  }
  private async execute(
    operation: string,
    params: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    signal.throwIfAborted();
    const leases: OpenedFile[] = [];
    let output: OpenedFile | undefined,
      outputName: string | undefined,
      reserve = 0;
    let owned: Output | undefined, failure: unknown;
    const inputs = (name: unknown) => {
      const member =
        typeof name === "string"
          ? this.manifest.inventory.find(
              (file) =>
                ["video", "system", "narration"].includes(file.role) &&
                (file.path === name || this.files.path(file.path) === name),
            )
          : undefined;
      if (!member)
        throw new CatalogError(
          "INVALID_REQUEST",
          "Native source must be an inventoried media member",
        );
      const file = this.files.open(member.path);
      leases.push(file);
      return `/dev/fd/${leases.length + 2}`;
    };
    try {
      const mapped = { ...params };
      if (operation === "media.audio") {
        if (!Array.isArray(params.tracks))
          throw new CatalogError("INVALID_REQUEST", "Audio requires tracks");
        mapped.tracks = params.tracks.map((value) => {
          const track = value as Record<string, unknown>;
          return { ...track, source: inputs(track.source) };
        });
      } else mapped.source = inputs(params.source);
      if (operation !== "media.visualSamples") {
        if (typeof params.output !== "string" || !params.output || this.outputs.has(params.output))
          throw new CatalogError("INVALID_REQUEST", "Output label must be new within this context");
        reserve = operation === "media.audio" ? 64 * 1024 ** 2 : 32 * 1024 ** 2;
        await this.reserveCapacity(reserve, signal);
        signal.throwIfAborted();
        this.outputBytes += reserve;
        outputName = `${randomUUID()}.${operation === "media.audio" ? "wav" : "png"}`;
        owned = {
          name: outputName,
          label: params.output,
          charged: reserve,
          phase: "writing",
          readers: 0,
        };
        this.outputs.set(params.output, owned);
        const created = nativeResult(
          await this.callWorker(
            "archive.createOutput",
            { identity: this.extraction.identity, name: outputName },
            { descriptors: [this.workspace.handle.fd], signal },
          ),
        ) as IdentifiedFile;
        if (created.path !== outputName || created.bytes !== 0)
          throw new CatalogError("INVALID_NATIVE_RESPONSE", "Unexpected output file receipt");
        owned.file = created;
        this.opened.add(created);
        signal.throwIfAborted();
        output = this.opened.open(outputName, true);
        leases.push(output);
        mapped.output = `/dev/fd/${leases.length + 2}`;
      }
      const data = nativeResult(
        await this.callWorker(operation, mapped, {
          // Keep the workspace lock alive if this parent dies before the native child.
          descriptors: [...leases.map((file) => file.fd), this.workspace.handle.fd],
          signal,
        }),
      );
      signal.throwIfAborted();
      if (!output || !outputName) return data;
      if (
        !data ||
        typeof data !== "object" ||
        !("bytes" in data) ||
        !Number.isSafeInteger(data.bytes) ||
        Number(data.bytes) < 0 ||
        Number(data.bytes) > reserve ||
        fstatSync(output.fd).size !== data.bytes
      )
        throw new CatalogError(
          "INVALID_NATIVE_RESPONSE",
          "Output byte receipt does not match its admitted descriptor",
        );
      owned!.file = this.opened.refresh(outputName, output);
      this.opened.open(outputName).close();
      this.outputBytes -= reserve - Number(data.bytes);
      owned!.charged = Number(data.bytes);
      owned!.phase = "ready";
      return { ...data, file: params.output };
    } catch (error) {
      failure = error;
    } finally {
      if (owned && output && owned.phase === "writing") {
        try {
          owned.file = this.opened.refresh(owned.name, output);
          if (owned.file.bytes > owned.charged) {
            this.outputBytes += owned.file.bytes - owned.charged;
            owned.charged = owned.file.bytes;
          }
        } catch {
          /* Keep the last admitted identity and reservation for explicit cleanup failure. */
        }
      }
      for (const file of leases) file.close();
      if (owned?.phase === "writing") owned.phase = "retired";
    }
    if (owned && !owned.file) {
      // Native creation writes no bytes, so an unknown entry holds only its output slot.
      this.outputBytes -= owned.charged;
      owned.charged = 0;
      if (!this.closing)
        throw new CatalogError(
          "OUTPUT_CLEANUP_FAILED",
          "Output creation was not confirmed; its slot is held until context close",
          { operationError: failure instanceof Error ? failure.message : String(failure) },
          true,
        );
    } else if (owned && !this.closing) {
      try {
        await this.releaseOutput(owned.label);
      } catch (cleanup) {
        throw new CatalogError(
          "OUTPUT_CLEANUP_FAILED",
          "Failed output remains charged until cleanup or context close",
          {
            operationError: failure instanceof Error ? failure.message : String(failure),
            cleanupError: cleanup instanceof Error ? cleanup.message : String(cleanup),
          },
          true,
        );
      }
    }
    throw failure;
  }
  close(): Promise<void> {
    if (this.closing && !this.closeFailed) return this.closing;
    this.closeFailed = false;
    const attempt = (async () => {
      this.opened.stop();
      this.controller.abort();
      await Promise.allSettled(this.active);
      let closeFailure: unknown;
      try {
        this.opened.close();
      } catch (error) {
        closeFailure = error;
      }
      await Promise.allSettled(this.maintenance);
      await this.extraction.close(closeFailure);
      this.outputs.clear();
      this.outputBytes = 0;
      if (closeFailure) throw closeFailure;
    })();
    this.closing = attempt;
    void attempt.catch(() => {
      this.closeFailed = true;
    });
    return attempt;
  }
}
