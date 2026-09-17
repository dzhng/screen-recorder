import { PackageMediaContext } from "./package-media.js";
import { PackageAudioInspection } from "./package-audio.js";
import { PackageFrameInspection } from "./package-frames.js";
import { constants } from "node:fs";
import { mkdir, lstat, realpath, open, type FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import { archiveLimits } from "@screenrec/core/package-archive";
import { parseRevisionHistory, type TimelineRevision } from "@screenrec/core/timeline";
import { fileSubdirectory } from "@screenrec/core/files";
import { FileScreenshotIndex } from "@screenrec/core/index-pages";
import { RetainedIndexRead } from "@screenrec/core/index-read";
import { framePolicy } from "@screenrec/core/frame-materialization";
import { trailPolicy } from "@screenrec/core/trails";
import type { JobQueue } from "@screenrec/core/jobs";
import type { DerivativeDelivery } from "./delivery.js";
import type { MediaWorker } from "./worker.js";
import { PackageRegistry } from "./package-registry.js";

type Reference = { packageHandle: string; revisionId: string; generation: string };
type HistoryCursor = { packageHandle: string; afterOrdinal: number; throughOrdinal: number };

/** Service composition of retained package authority; inspection stays in the shared readers. */
export class PackageInspection {
  private parent: FileHandle | undefined;
  private registry: PackageRegistry | undefined;
  private preparing: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private stopped = false;
  private error: string | null = null;
  private readonly views = new WeakMap<
    object,
    {
      revisions: readonly TimelineRevision[];
      index?: RetainedIndexRead<Reference>;
      media?: PackageMediaContext;
      frames?: PackageFrameInspection;
      audio?: PackageAudioInspection;
    }
  >();
  constructor(
    private readonly options: {
      directory: string;
      jobs: JobQueue;
      worker: MediaWorker;
      delivery: DerivativeDelivery;
    },
  ) {}

  prepare(): Promise<void> {
    if (this.stopped)
      return Promise.reject(new CatalogError("SERVICE_STOPPED", "Packages are closed"));
    if (this.preparing) return this.preparing;
    this.preparing = (async () => {
      if (!this.registry) {
        await mkdir(this.options.directory, { recursive: true, mode: 0o700 });
        const before = await lstat(this.options.directory, { bigint: true });
        if (
          !before.isDirectory() ||
          before.uid !== BigInt(process.getuid!()) ||
          (before.mode & 0o777n) !== 0o700n
        )
          throw new CatalogError(
            "INVALID_STORAGE",
            "Package root must be an exclusively owned private directory",
          );
        const directory = await realpath(this.options.directory);
        const handle = await open(
          directory,
          constants.O_RDONLY | constants.O_DIRECTORY | 0x20000000,
        );
        try {
          const info = await handle.stat({ bigint: true });
          if (
            !info.isDirectory() ||
            info.uid !== BigInt(process.getuid!()) ||
            (info.mode & 0o777n) !== 0o700n ||
            info.dev !== before.dev ||
            info.ino !== before.ino
          )
            throw new CatalogError(
              "INVALID_STORAGE",
              "Package root must be an exclusively owned private directory",
            );
          this.registry = new PackageRegistry({
            ...this.options,
            parent: { directory, handle },
          });
          this.parent = handle;
        } catch (error) {
          await handle.close();
          throw error;
        }
      }
      if (this.registry.usage().state === "recovery") await this.registry.recover();
      this.error = null;
    })()
      .catch((error) => {
        this.error = (error instanceof Error ? error.message : String(error)).slice(0, 4096);
        if (error instanceof CatalogError) throw error;
        throw new CatalogError(
          "INVALID_STORAGE",
          "Package root initialization failed",
          { reason: this.error },
          true,
        );
      })
      .finally(() => {
        this.preparing = undefined;
      });
    return this.preparing;
  }
  async open(path: string) {
    await this.prepare();
    try {
      return await this.registry!.open(path);
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      throw new CatalogError("INVALID_PACKAGE", "Package archive could not be admitted", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  status(admissionId?: string) {
    if (admissionId !== undefined) {
      if (!this.registry) throw new CatalogError("NOT_FOUND", "Package admission does not exist");
      return this.registry.status(admissionId);
    }
    return this.registry
      ? { ...this.registry.usage(), admissions: this.registry.active() }
      : { state: this.stopped ? "disposed" : "recovery", error: this.error, admissions: [] };
  }
  async close(admissionId: string) {
    if (!this.registry) throw new CatalogError("NOT_FOUND", "Package admission does not exist");
    await this.registry.close(admissionId);
    return this.registry.status(admissionId);
  }
  dispose(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true;
    this.closing = (async () => {
      await this.preparing?.catch(() => {});
      try {
        await this.registry?.dispose();
      } finally {
        await this.parent?.close();
      }
    })();
    return this.closing;
  }
  private context(handle: string) {
    if (!this.registry) throw new CatalogError("CONTEXT_CLOSED", "Package handle does not exist");
    return this.registry.lookup(handle);
  }
  private revisions(handle: string) {
    const context = this.context(handle);
    let view = this.views.get(context);
    if (!view) {
      view = {
        revisions: parseRevisionHistory(
          context.manifest.history.map(({ path }) => JSON.parse(context.revisionContents[path]!)),
          archiveLimits.history,
        ),
      };
      this.views.set(context, view);
    }
    return { context, view, revisions: view.revisions };
  }
  revision(input: { packageHandle: string; revisionId?: string | undefined }) {
    const { context, revisions } = this.revisions(input.packageHandle);
    const id = input.revisionId ?? context.manifest.snapshot.revisionId;
    const revision = revisions.find((value) => value.id === id);
    if (!revision) throw new CatalogError("NOT_FOUND", "Revision is not included in this package");
    return {
      packageHandle: input.packageHandle,
      recordingId: context.manifest.snapshot.recordingId,
      revision,
    };
  }
  history(input: {
    packageHandle: string;
    cursor?: HistoryCursor | null | undefined;
    limit?: number | undefined;
  }) {
    const { context, revisions } = this.revisions(input.packageHandle);
    const throughOrdinal = context.manifest.snapshot.historyThroughOrdinal;
    const afterOrdinal = input.cursor?.afterOrdinal ?? -1;
    const limit = input.limit ?? 100;
    if (
      input.cursor &&
      (input.cursor.packageHandle !== input.packageHandle ||
        input.cursor.throughOrdinal !== throughOrdinal)
    )
      throw new CatalogError("ARTIFACT_CHANGED", "History continuation belongs to another package");
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 500 ||
      !Number.isSafeInteger(afterOrdinal) ||
      afterOrdinal < -1 ||
      afterOrdinal > throughOrdinal
    )
      throw new CatalogError("INVALID_RANGE", "Invalid history page");
    const page = revisions.slice(afterOrdinal + 1, afterOrdinal + 1 + limit);
    return {
      packageHandle: input.packageHandle,
      recordingId: context.manifest.snapshot.recordingId,
      revisions: page,
      nextCursor:
        afterOrdinal + 1 + limit < revisions.length
          ? {
              packageHandle: input.packageHandle,
              throughOrdinal,
              afterOrdinal: page.at(-1)!.ordinal,
            }
          : null,
    };
  }
  private media(packageHandle: string) {
    const { view } = this.revisions(packageHandle);
    return (view.media ??= new PackageMediaContext(
      this.registry!,
      packageHandle,
      (revisionId) =>
        this.revision({ packageHandle, ...(revisionId === undefined ? {} : { revisionId }) })
          .revision,
    ));
  }
  frames(packageHandle: string): PackageFrameInspection {
    const { view } = this.revisions(packageHandle);
    return (view.frames ??= new PackageFrameInspection(this.media(packageHandle)));
  }
  audio(packageHandle: string): PackageAudioInspection {
    const { view } = this.revisions(packageHandle);
    return (view.audio ??= new PackageAudioInspection(this.media(packageHandle)));
  }
  index(input: {
    packageHandle: string;
    revisionId?: string | undefined;
    generation?: string | undefined;
  }) {
    const { context, view } = this.revisions(input.packageHandle);
    const { snapshot, evidence } = context.manifest;
    const revisionId = input.revisionId ?? snapshot.revisionId;
    if (revisionId !== snapshot.revisionId)
      throw new CatalogError(
        "ARTIFACT_UNAVAILABLE",
        "This package retains an index only for its exported revision",
      );
    const artifact = (kind: "source" | "scenes" | "index") =>
      evidence.find((value) => value.artifact.reference.kind === kind)!;
    const source = artifact("source"),
      scenes = artifact("scenes"),
      index = artifact("index");
    if ([source, scenes, index].some((value) => typeof value.artifact.generation !== "string"))
      throw new CatalogError("INVALID_EVIDENCE", "Portable index generations must be text");
    const generation = index.artifact.generation as string;
    if (input.generation !== undefined && input.generation !== generation)
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Index generation differs from the package snapshot",
      );
    if (view.index) return view.index;
    const pageFiles = index.files.filter((path) => path.endsWith("/pages.json"));
    if (pageFiles.length !== 1)
      throw new CatalogError("INVALID_EVIDENCE", "Index requires one normalized page manifest");
    const sourceIdentity = {
      recordingId: snapshot.recordingId,
      sourceId: snapshot.sourceId,
      generation: source.artifact.generation as string,
    };
    const identity = {
      ...sourceIdentity,
      revisionId,
      generation,
      sourceIdentity,
      sceneIdentity: {
        ...sourceIdentity,
        generation: scenes.artifact.generation as string,
        policy: scenes.artifact.policy,
      },
      selectionPolicy: index.artifact.policy,
      framePolicy,
      trailPolicy: trailPolicy.id,
    };
    const reader = new FileScreenshotIndex(
      fileSubdirectory(context.files, dirname(pageFiles[0]!)),
      identity,
      this.revision({ packageHandle: input.packageHandle, revisionId }).revision,
    );
    const metadata = reader.metadata(identity);
    const reference: Reference = { packageHandle: input.packageHandle, revisionId, generation };
    view.index = new RetainedIndexRead(reader, metadata, reference);
    return view.index;
  }
}
