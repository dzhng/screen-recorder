import { CatalogError } from "@screenrec/core/catalog";
import { fileSubdirectory } from "@screenrec/core/files";
import type { TimeRange } from "@screenrec/core/presentation-time";
import { FileSourceEvidence } from "@screenrec/core/evidence-pages";
import type { RecordingTranscriptMetadata } from "@screenrec/core/transcript";
import { FileTranscript, validateTranscriptPages } from "@screenrec/core/transcript-pages";
import { TranscriptRead, transcriptContinuation } from "@screenrec/core/transcript-read";
import {
  packageRevisions,
  portableEvidence,
  portableIdentities,
  type PackageMediaContext,
  type PackageTarget,
} from "./package-media.js";
import type { RetainedPackage } from "./package-archive.js";

type Retained = Pick<RetainedPackage, "manifest" | "revisionContents" | "files">;

/** Admits a narrated package's transcript against its own source evidence before a handle exists. */
export async function validatePackageTranscript(
  context: Retained,
  signal?: AbortSignal,
): Promise<void> {
  const { manifest } = context;
  if (manifest.transcript !== "ready") return;
  const { source, sourceIdentity } = portableIdentities(manifest);
  const transcript = portableEvidence(manifest, "source-transcript", "pages.json"),
    edited = portableEvidence(manifest, "edited-transcript", "pages.json");
  await validateTranscriptPages(
    {
      source: fileSubdirectory(context.files, transcript.directory),
      edited: fileSubdirectory(context.files, edited.directory),
      identity: {
        recordingId: sourceIdentity.owner.recordingId,
        sourceId: sourceIdentity.sourceId,
        generation: transcript.generation,
      },
      revision: packageRevisions(context).find(({ id }) => id === manifest.snapshot.revisionId)!,
      narration: new FileSourceEvidence(
        fileSubdirectory(context.files, source.directory),
        sourceIdentity,
      ).audio(sourceIdentity, "narration", {
        startUs: 0,
        endUs: manifest.snapshot.sourceDurationUs,
      }),
    },
    signal,
  );
}

type ReadInput = PackageTarget & {
  revisionId?: string | undefined;
  cursor?: unknown;
  limit?: number | undefined;
};

/** Transcript reads of a retained package, with the library's semantics over its portable pages. */
export class PackageTranscriptInspection {
  private portable: { records: FileTranscript; metadata: RecordingTranscriptMetadata } | undefined;
  constructor(private readonly media: PackageMediaContext) {}

  /** Resolves the revision once, as the library does, and the generation a continuation must name. */
  private resolve(input: ReadInput) {
    const { manifest, files } = this.media.retained();
    const cursor = input.cursor === undefined ? undefined : transcriptContinuation(input.cursor);
    if (
      cursor &&
      (cursor.recordingId !== manifest.snapshot.recordingId ||
        (input.revisionId !== undefined && input.revisionId !== cursor.revisionId))
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Transcript continuation belongs to another recording or revision",
      );
    const resolved = this.media.resolve({
      packageHandle: input.packageHandle,
      revisionId: input.revisionId ?? cursor?.revisionId,
    });
    const reference = {
      ...resolved.target,
      recordingId: resolved.recordingId,
      sourceId: resolved.sourceId,
      revisionId: resolved.revision.id,
    };
    if (manifest.transcript !== "ready") {
      if (cursor)
        throw new CatalogError("ARTIFACT_CHANGED", "This package retains no transcript generation");
      return {
        status: {
          ...reference,
          state: "unavailable" as const,
          reason: "no_narration" as const,
          retryable: false,
          page: null,
        },
      };
    }
    if (!this.portable) {
      const records = new FileTranscript(
        fileSubdirectory(
          files,
          portableEvidence(manifest, "source-transcript", "pages.json").directory,
        ),
      );
      this.portable = { records, metadata: records.metadata };
    }
    const { records, metadata } = this.portable;
    return {
      reference: { ...reference, generation: metadata.generation, state: "ready" as const },
      transcript: metadata,
      read: new TranscriptRead(records, metadata, resolved.revision),
    };
  }

  get(input: ReadInput & { range?: TimeRange | undefined }) {
    const target = this.resolve(input);
    if (target.status) return target.status;
    const page = target.read.page(input);
    return { ...target.reference, page: { transcript: target.transcript, ...page } };
  }

  search(input: ReadInput & { text: string }) {
    const target = this.resolve(input);
    if (target.status) return target.status;
    const page = target.read.search(input);
    return { ...target.reference, page: { transcript: target.transcript, ...page } };
  }
}
