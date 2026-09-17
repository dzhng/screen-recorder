import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  FrameInspection,
  renderFrame,
  type FrameContext,
  type FrameOptions,
  type FrameSubmission,
} from "@screenrec/core/frames";
import { CatalogError } from "@screenrec/core/library";
import type { TimelineRevision } from "@screenrec/core/timeline";
import type { MaterializedFrame, NativeFrame } from "@screenrec/core/frame-materialization";
import type { VisualObservations } from "@screenrec/core/scenes";
import { FileSourceEvidence, readSourceMetadata } from "@screenrec/core/evidence-pages";
import { fileSubdirectory } from "@screenrec/core/files";
import { openRetainedImage, retainedImageRead } from "@screenrec/core/retained-image";
import type { PackageRegistry } from "./package-registry.js";

type Target = { packageHandle: string };
export type PackageFrameArtifact = MaterializedFrame & { outputId: string };

/** Scheduling and media storage stay with the admitted package's existing owners. */
export class PackageFrameInspection extends FrameInspection<Target, PackageFrameArtifact> {
  private sourceRead:
    | { metadata: ReturnType<typeof readSourceMetadata>; reader: FileSourceEvidence }
    | undefined;
  constructor(
    private readonly registry: PackageRegistry,
    private readonly handle: string,
    private readonly revision: (id?: string) => TimelineRevision,
  ) {
    super();
  }
  protected resolve(input: Target & { revisionId?: string | undefined }): FrameContext<Target> {
    if (input.packageHandle !== this.handle)
      throw new CatalogError("CONTEXT_CLOSED", "Frame request belongs to another package");
    const { snapshot } = this.registry.lookup(this.handle).manifest;
    return {
      target: { packageHandle: this.handle },
      recordingId: snapshot.recordingId,
      sourceId: snapshot.sourceId,
      revision: this.revision(input.revisionId),
    };
  }
  private sourceData() {
    const context = this.registry.lookup(this.handle);
    if (!this.sourceRead) {
      const source = context.manifest.evidence.find(
        (entry) => entry.artifact.reference.kind === "source",
      )!;
      const metadataFiles = source.files.filter((path) => path.endsWith("/metadata.json"));
      if (metadataFiles.length !== 1 || typeof source.artifact.generation !== "string")
        throw new CatalogError(
          "INVALID_EVIDENCE",
          "Source evidence requires one pinned metadata member",
        );
      const root = fileSubdirectory(context.files, dirname(metadataFiles[0]!));
      const identity = {
        recordingId: context.manifest.snapshot.recordingId,
        sourceId: context.manifest.snapshot.sourceId,
        generation: source.artifact.generation,
      };
      const metadata = readSourceMetadata(root, identity);
      if (!source.files.includes(metadata.receipt.file))
        throw new CatalogError(
          "INVALID_EVIDENCE",
          "Source receipt does not refer to inventoried evidence",
        );
      this.sourceRead = { metadata, reader: new FileSourceEvidence(root, identity) };
    }
    return this.sourceRead;
  }
  protected source() {
    return {
      state: "ready",
      reason: null,
      retryable: false,
      jobId: null,
      evidence: this.sourceData().metadata,
    };
  }
  protected retryJob(jobId: string) {
    this.registry.retry(this.handle, jobId);
  }
  protected submit(
    context: FrameContext<Target>,
    options: FrameOptions,
  ): FrameSubmission<PackageFrameArtifact> {
    const input = JSON.stringify({ revisionId: context.revision.id, options });
    const { jobs, valueBytes } = this.registry.jobs(this.handle);
    let previous = jobs.find((job) => job.artifact === "frame" && job.input === input);
    if (previous?.state === "ready" && previous.result) {
      const frame = JSON.parse(previous.result) as PackageFrameArtifact;
      try {
        this.registry.openOutput(this.handle, frame.outputId).close();
      } catch (error) {
        if (!(error instanceof CatalogError) || error.code !== "NOT_FOUND") throw error;
        this.registry.forget(this.handle, previous.jobId);
        previous = undefined;
      }
    }
    if (!previous) {
      const current = this.registry.jobs(this.handle);
      let room = current.jobs.length < current.capacity;
      for (const job of room ? [] : current.jobs) {
        if (job.artifact !== "frame" || ["queued", "running"].includes(job.state)) continue;
        try {
          this.registry.forget(this.handle, job.jobId);
          room = true;
          break;
        } catch (error) {
          if (!(error instanceof CatalogError) || error.code !== "PROCESSING_BUSY") throw error;
        }
      }
      if (!room)
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Package job metadata is occupied by active work",
          {},
          true,
        );
    }
    const job = this.registry.submit(
      this.handle,
      { artifact: "frame", lane: "frame", input },
      async (retained, signal) => {
        const outputId = randomUUID();
        let decoded = false;
        const sourceEvidence = () => this.sourceData().reader;
        const result = await renderFrame(
          options,
          {
            recordingId: context.recordingId,
            sourceId: context.sourceId,
            revision: context.revision,
            source: "source/video.mov",
            output: {
              file: outputId,
              publish: async (frame) => {
                const result = { ...frame, outputId };
                if (Buffer.byteLength(JSON.stringify(result)) > valueBytes)
                  throw new CatalogError(
                    "LIMIT_EXCEEDED",
                    "Frame metadata exceeds its queue publication limit",
                  );
                return result;
              },
              discard: async () => {
                if (decoded) await retained.releaseOutput(outputId);
              },
            },
          },
          {
            get evidence() {
              return sourceEvidence();
            },
            decode: async (params, signal) => {
              const frame = (await retained.run("media.frame", params, signal)) as NativeFrame;
              decoded = true;
              return frame;
            },
            sample: async ({ source, kept, atSourceUs }, signal) =>
              (await retained.run(
                "media.visualSamples",
                { source, kept, atSourceUs },
                signal,
              )) as VisualObservations,
          },
          signal,
        );
        return JSON.stringify(result);
      },
    );
    return {
      state:
        job.state === "running" ? "processing" : job.state === "canceled" ? "failed" : job.state,
      reason: job.reason,
      retryable: job.retryable,
      jobId: job.jobId,
      published:
        job.state === "ready" && job.result
          ? { generation: job.generation, frame: JSON.parse(job.result) as PackageFrameArtifact }
          : null,
    };
  }
  openRead(frame: PackageFrameArtifact) {
    const read = openRetainedImage(this.registry.openOutput(this.handle, frame.outputId), frame);
    return retainedImageRead(read.file, frame.bytes);
  }
}
