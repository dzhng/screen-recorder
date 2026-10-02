import { validatePackageSource } from "./package-source.js";
import { openPackageParent } from "./package-workspace.js";
import { validateManifest } from "@screenrec/core/package-manifest";
import { validatePackageTranscript } from "./package-transcript.js";
import { readRawCursor, type RawCursorOptions } from "@screenrec/core/raw-cursor";
import { PackageTimelineInspection } from "./timeline-inspection.js";
import {
  PackageMediaContext,
  packageRevisions,
  portableEvidence,
  portableIdentities,
} from "./package-media.js";
import { PackageTranscriptInspection } from "./package-transcript.js";
import { PackageAudioInspection } from "./package-audio.js";
import { PackagePreviewInspection } from "./package-preview.js";
import { PackageFrameInspection } from "./package-frames.js";
import { type FileHandle } from "node:fs/promises";
import { CatalogError } from "@screenrec/core/catalog";
import type { TimelineRevision } from "@screenrec/core/timeline";
import type { PreviewRenderer } from "@screenrec/core/preview";
import type { PreviewEvidence } from "./render.js";
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
  private registry: PackageRegistry<ReturnType<typeof validateManifest>> | undefined;
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
      preview?: PackagePreviewInspection;
      timeline?: PackageTimelineInspection;
      transcript?: PackageTranscriptInspection;
    }
  >();
  constructor(
    private readonly options: {
      directory: string;
      jobs: JobQueue;
      worker: MediaWorker;
      delivery: DerivativeDelivery;
      /**
       * Builds a renderer over a package's own evidence: the pointer schedule a preview composes
       * is read from the archive's copy, never from a library this package may not even be in.
       */
      render?: (evidence: PreviewEvidence) => PreviewRenderer;
    },
  ) {}

  prepare(): Promise<void> {
    if (this.stopped)
      return Promise.reject(new CatalogError("SERVICE_STOPPED", "Packages are closed"));
    if (this.preparing) return this.preparing;
    this.preparing = (async () => {
      if (!this.registry) {
        const { directory, handle } = await openPackageParent(this.options.directory);
        try {
          this.registry = new PackageRegistry({
            ...this.options,
            validate: validateManifest,
            mediaPaths: (manifest) =>
              manifest.inventory
                .filter((member) => ["video", "system", "narration"].includes(member.role))
                .map((member) => member.path),
            inspect: async (context, signal = new AbortController().signal, lifetime) => {
              await validatePackageSource(context, this.options.worker, signal, lifetime);
              await validatePackageTranscript(context, signal);
            },
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
    return this.registry!.open(path);
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
      view = { revisions: packageRevisions(context) };
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
  rawCursor(input: { packageHandle: string } & RawCursorOptions<{ packageHandle: string }>) {
    return readRawCursor({ packageHandle: input.packageHandle }, input, () =>
      this.media(input.packageHandle).sourceData(),
    );
  }
  timeline(packageHandle: string): PackageTimelineInspection {
    const { view } = this.revisions(packageHandle);
    return (view.timeline ??= new PackageTimelineInspection(this.media(packageHandle)));
  }
  transcript(packageHandle: string): PackageTranscriptInspection {
    const { view } = this.revisions(packageHandle);
    return (view.transcript ??= new PackageTranscriptInspection(this.media(packageHandle)));
  }
  frames(packageHandle: string): PackageFrameInspection {
    const { view } = this.revisions(packageHandle);
    return (view.frames ??= new PackageFrameInspection(this.media(packageHandle)));
  }
  audio(packageHandle: string): PackageAudioInspection {
    const { view } = this.revisions(packageHandle);
    return (view.audio ??= new PackageAudioInspection(this.media(packageHandle)));
  }
  preview(packageHandle: string): PackagePreviewInspection {
    const { view } = this.revisions(packageHandle);
    const { render } = this.options;
    if (!render)
      throw new CatalogError(
        "UNSUPPORTED_OPERATION",
        "This service renders no previews, so a package cannot be previewed either",
      );
    const media = this.media(packageHandle);
    return (view.preview ??= new PackagePreviewInspection(
      media,
      render(media.sourceData().reader),
    ));
  }
  index(input: {
    packageHandle: string;
    revisionId?: string | undefined;
    generation?: string | undefined;
  }) {
    const { context, view } = this.revisions(input.packageHandle);
    const { snapshot } = context.manifest;
    const revisionId = input.revisionId ?? snapshot.revisionId;
    if (revisionId !== snapshot.revisionId)
      throw new CatalogError(
        "ARTIFACT_UNAVAILABLE",
        "This package retains an index only for its exported revision",
      );
    const index = portableEvidence(context.manifest, "index", "pages.json");
    const generation = index.generation;
    if (input.generation !== undefined && input.generation !== generation)
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Index generation differs from the package snapshot",
      );
    if (view.index) return view.index;
    const { sourceIdentity, sceneIdentity } = portableIdentities(context.manifest);
    const identity = {
      recordingId: sourceIdentity.owner.recordingId,
      sourceId: sourceIdentity.sourceId,
      revisionId,
      generation,
      sourceIdentity,
      sceneIdentity,
      selectionPolicy: index.artifact.policy,
      framePolicy,
      trailPolicy: trailPolicy.id,
    };
    const reader = new FileScreenshotIndex(
      fileSubdirectory(context.files, index.directory),
      identity,
      this.revision({ packageHandle: input.packageHandle, revisionId }).revision,
    );
    const metadata = reader.metadata(identity);
    const reference: Reference = { packageHandle: input.packageHandle, revisionId, generation };
    view.index = new RetainedIndexRead(reader, metadata, reference);
    return view.index;
  }
}
