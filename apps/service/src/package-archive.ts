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
import type { MediaWorker } from "./worker.js";

type Options = { signal?: AbortSignal; limits?: ArchiveLimits; timeoutMs?: number };
function requireResult(result: Awaited<ReturnType<MediaWorker>>) {
  if (!result.ok)
    throw new CatalogError(
      result.error.code,
      result.error.message,
      result.error.details,
      result.error.retryable,
    );
  return result.data;
}
async function extractArchive(
  archive: string,
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
  let closing: Promise<void> | undefined;
  const close = (failure?: unknown) =>
    (closing ??= (async () => {
      try {
        const result = requireResult(
          await worker("archive.cleanup", { identity }, { ...nativeOptions, timeoutMs: 30_000 }),
        );
        if (
          !result ||
          typeof result !== "object" ||
          !("removed" in result) ||
          result.removed !== true
        )
          throw new CatalogError(
            "INVALID_NATIVE_RESPONSE",
            "Archive cleanup did not confirm completion",
          );
      } catch (cleanup) {
        const describe = (error: unknown) =>
          error instanceof Error ? error.message : String(error);
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
    })());
  try {
    const result = await worker(
      "archive.extract",
      { archive, identity, limits },
      { ...nativeOptions, ...(options.signal ? { signal: options.signal } : {}) },
    );
    const verified = verifyArchiveReceipt(requireResult(result), limits);
    return { verified, identity, close };
  } catch (failure) {
    await close(failure);
    throw failure;
  }
}
type Extraction = Awaited<ReturnType<typeof extractArchive>>;

/** Receipt-only admission and retained inspection use this same extraction/validation owner. */
export async function verifyPackageArchive(
  archive: string,
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
  archive: string,
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

/** Internal read context. Public scheduling/cache/handle ownership belongs to the later service integration. */
export class RetainedPackage {
  readonly manifest: Extraction["verified"]["manifest"];
  readonly revisionContents: Readonly<Record<string, string>>;
  readonly files: FileAccess;
  private readonly opened: IdentifiedFiles;
  private readonly controller = new AbortController();
  private readonly active = new Set<Promise<unknown>>();
  private readonly outputs = new Map<string, string>();
  private outputBytes = 0;
  private outputAttempts = 0;
  private closing: Promise<void> | undefined;
  constructor(
    private readonly workspace: { directory: string; handle: FileHandle },
    private readonly worker: MediaWorker,
    private readonly extraction: Extraction,
  ) {
    this.manifest = extraction.verified.manifest;
    this.revisionContents = extraction.verified.revisionContents;
    this.opened = new IdentifiedFiles(workspace.directory, extraction.verified.files);
    this.files = fileSubdirectory(this.opened, "content");
  }
  openOutput(label: string): OpenedFile {
    const file = this.outputs.get(label);
    if (!file) throw new CatalogError("NOT_FOUND", "Output is not owned by this context");
    return this.opened.open(file);
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
        if (this.outputAttempts >= 32 || this.outputBytes + reserve > 128 * 1024 ** 2)
          throw new CatalogError("LIMIT_EXCEEDED", "Package derivative budget exceeded");
        // Failed attempts retain their reservation until context close; partial files cannot evade the budget.
        this.outputAttempts++;
        this.outputBytes += reserve;
        outputName = `${randomUUID()}.${operation === "media.audio" ? "wav" : "png"}`;
        const created = requireResult(
          await this.worker(
            "archive.createOutput",
            { identity: this.extraction.identity, name: outputName },
            { descriptors: [this.workspace.handle.fd], signal },
          ),
        ) as IdentifiedFile;
        signal.throwIfAborted();
        if (created.path !== outputName || created.bytes !== 0)
          throw new CatalogError("INVALID_NATIVE_RESPONSE", "Unexpected output file receipt");
        this.opened.add(created);
        output = this.opened.open(outputName, true);
        leases.push(output);
        mapped.output = `/dev/fd/${leases.length + 2}`;
      }
      const data = requireResult(
        await this.worker(operation, mapped, {
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
      this.opened.refresh(outputName, output);
      this.opened.open(outputName).close();
      this.outputBytes -= reserve - Number(data.bytes);
      this.outputs.set(params.output as string, outputName);
      return { ...data, file: params.output };
    } finally {
      for (const file of leases) file.close();
    }
  }
  close(): Promise<void> {
    return (this.closing ??= (async () => {
      this.opened.stop();
      this.controller.abort();
      await Promise.allSettled(this.active);
      let closeFailure: unknown;
      try {
        this.opened.close();
      } catch (error) {
        closeFailure = error;
      }
      await this.extraction.close(closeFailure);
      if (closeFailure) throw closeFailure;
    })());
  }
}
