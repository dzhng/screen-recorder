import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import type { TimelineRevision } from "@screenrec/core/timeline";
import { FileSourceEvidence, readSourceMetadata } from "@screenrec/core/evidence-pages";
import { fileSubdirectory } from "@screenrec/core/files";
import type { PackageRegistry } from "./package-registry.js";
import type { RetainedPackage } from "./package-archive.js";
export type PackageTarget = { packageHandle: string };
export type PackageOutput<T> = {
  file: string;
  publish(value: T): Promise<T & { outputId: string }>;
  discard(cause: unknown): Promise<void>;
};

/** Shared bounded job and source policy; the registry retains all lifetime authority. */
export class PackageMediaContext {
  private sourceRead:
    | { metadata: ReturnType<typeof readSourceMetadata>; reader: FileSourceEvidence }
    | undefined;
  constructor(
    private readonly registry: PackageRegistry,
    private readonly handle: string,
    private readonly revision: (id?: string) => TimelineRevision,
  ) {}
  resolve(input: PackageTarget & { revisionId?: string | undefined }) {
    if (input.packageHandle !== this.handle)
      throw new CatalogError("CONTEXT_CLOSED", "Media request belongs to another package");
    const { snapshot } = this.registry.lookup(this.handle).manifest;
    return {
      target: { packageHandle: this.handle },
      recordingId: snapshot.recordingId,
      sourceId: snapshot.sourceId,
      revision: this.revision(input.revisionId),
    };
  }
  sourceData() {
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

  source() {
    return {
      state: "ready",
      reason: null,
      retryable: false,
      jobId: null,
      evidence: this.sourceData().metadata,
    };
  }
  sourcePath(role: "narration" | "system") {
    return this.registry.lookup(this.handle).files.path(`source/${role}.mov`);
  }
  retry(jobId: string) {
    this.registry.retry(this.handle, jobId);
  }
  openOutput(label: string) {
    return this.registry.openOutput(this.handle, label);
  }
  submit<T>(
    artifact: "frame" | "audio",
    input: string,
    render: (
      output: PackageOutput<T>,
      run: RetainedPackage["run"],
      signal: AbortSignal,
    ) => Promise<T & { outputId: string }>,
  ) {
    const { jobs, valueBytes } = this.registry.jobs(this.handle);
    let previous = jobs.find((job) => job.artifact === artifact && job.input === input);
    if (previous?.state === "ready" && previous.result) {
      const result = JSON.parse(previous.result) as { outputId: string };
      try {
        this.registry.openOutput(this.handle, result.outputId).close();
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
        if (!["frame", "audio"].includes(job.artifact) || ["queued", "running"].includes(job.state))
          continue;
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
      { artifact, lane: artifact === "audio" ? "heavy" : "frame", input },
      async (retained, signal) => {
        const outputId = randomUUID();
        let decoded = false;
        const result = await render(
          {
            file: outputId,
            publish: async (value) => {
              const result = { ...value, outputId };
              if (Buffer.byteLength(JSON.stringify(result)) > valueBytes)
                throw new CatalogError(
                  "LIMIT_EXCEEDED",
                  "Media metadata exceeds its queue publication limit",
                );
              return result;
            },
            discard: async () => {
              if (decoded) await retained.releaseOutput(outputId);
            },
          },
          async (operation, params, signal) => {
            const value = await retained.run(operation, params, signal);
            if (operation !== "media.visualSamples") decoded = true;
            return value;
          },
          signal,
        );
        return JSON.stringify(result);
      },
    );
    return {
      state:
        job.state === "running"
          ? ("processing" as const)
          : job.state === "canceled"
            ? ("failed" as const)
            : job.state,
      reason: job.reason,
      retryable: job.retryable,
      jobId: job.jobId,
      published:
        job.state === "ready" && job.result
          ? {
              generation: job.generation,
              value: JSON.parse(job.result) as T & { outputId: string },
            }
          : null,
    };
  }
}
