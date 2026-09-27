import { openSync, closeSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { planAudioTracks } from "@screenrec/core/audio";
import type { DerivativeContext } from "@screenrec/core/derivative-inspection";
import { retainedFileRead, O_NOFOLLOW_ANY } from "@screenrec/core/files";
import { CatalogError } from "@screenrec/core/catalog";
import {
  PreviewInspectionBase,
  checkRenderedPreview,
  previewBoundFor,
  type PreviewOptions,
  type PreviewRenderer,
  type RenderedMovie,
} from "@screenrec/core/preview";
import { renderPlan } from "@screenrec/core/timeline";
import { PackageMediaContext, type PackageTarget } from "./package-media.js";

/**
 * A playable rendition of the revision a relocated package carries.
 *
 * It plays what the library's preview plays, out of the package's own media: the archive's copies
 * were hash-verified against its manifest when it was admitted, and they sit in a directory this
 * service owns, so the renderer reads them the way it reads a recording's own files. The movie
 * is written beside the admission's workspace rather than into a package output, because
 * AVFoundation assembles a movie at a path while a package output is a descriptor it was handed.
 *
 * Everything about it belongs to the admission: the work occupies this package's job slot, the
 * movie is read through a lease the package owns, and both go when the package closes. The whole
 * parent is cleared at startup, so a service that dies mid-render leaves nothing behind either.
 */
export type PackagePreviewArtifact = RenderedMovie & {
  maxLongEdge: number | null;
  recordingId: string;
  sourceId: string;
  revisionId: string;
  sourceEvidence: PreviewOptions["sourceEvidence"];
  missingRoles: ReturnType<typeof planAudioTracks>["missingRoles"];
};

export class PackagePreviewInspection extends PreviewInspectionBase<
  PackageTarget,
  PackagePreviewArtifact
> {
  constructor(
    private readonly media: PackageMediaContext,
    private readonly render: PreviewRenderer,
  ) {
    super(media);
  }

  /** The movie itself, for as long as the admission that rendered it is open. */
  openRead(preview: PackagePreviewArtifact) {
    let fd;
    try {
      fd = openSync(preview.file, 0 | O_NOFOLLOW_ANY);
    } catch {
      throw new CatalogError("ARTIFACT_EXPIRED", "This preview is no longer available", {}, true);
    }
    const stat = statSync(preview.file);
    if (stat.size !== preview.bytes) {
      closeSync(fd);
      throw new CatalogError("INVALID_EVIDENCE", "Preview file no longer matches its receipt");
    }
    return retainedFileRead({ fd, close: () => closeSync(fd) }, preview.bytes);
  }

  protected submit(context: DerivativeContext<PackageTarget>, options: PreviewOptions) {
    const maxLongEdge = previewBoundFor(options.rendition);
    const revision = context.revision;
    const plan = renderPlan(revision);
    // An absent audio role is reported rather than rendered as silence, and a role this package
    // never carried fails here instead of inside a heavy job.
    const { tracks, missingRoles } = planAudioTracks(
      {
        recordingId: context.recordingId,
        sourceId: context.sourceId,
        sourceEvidence: options.sourceEvidence,
        spans: revision.spans,
        track: "mix",
      },
      this.media.sourceData().reader,
      (role) => this.media.sourcePath(role),
    );
    // The package's own identity is part of what this movie is, so a package of a recording this
    // person still has cannot share a cache entry with that recording's own preview.
    const identity = this.media.identity();
    return this.media.submitWork<PackagePreviewArtifact>(
      "preview",
      JSON.stringify({ revisionId: revision.id, identity, options }),
      async (retained, signal) => {
        const file = this.media.renderPath(`${randomUUID()}.mp4`);
        const movie = await this.render(
          {
            source: retained.files.path("source/video.mov"),
            revision,
            sourceEvidence: options.sourceEvidence,
            plan,
            tracks,
            output: file,
            maxLongEdge,
          },
          signal,
        );
        signal.throwIfAborted();
        checkRenderedPreview(movie, {
          file,
          durationUs: revision.durationUs,
          maxLongEdge,
        });
        return {
          ...movie,
          maxLongEdge,
          recordingId: context.recordingId,
          sourceId: context.sourceId,
          revisionId: revision.id,
          sourceEvidence: options.sourceEvidence,
          missingRoles,
        };
      },
    );
  }
}
