import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import { parseRevisionHistory, type TimelineRevision } from "@screenrec/core/timeline";
import { archiveLimits } from "@screenrec/core/package-archive";
import { FileSourceEvidence, readSourceMetadata } from "@screenrec/core/evidence-pages";
import { fileSubdirectory } from "@screenrec/core/files";
import type { ContextJob } from "@screenrec/core/jobs";
import type { PackageRegistry } from "./package-registry.js";
import type { RetainedPackage } from "./package-archive.js";
export type PackageTarget = { packageHandle: string };
type Manifest = RetainedPackage["manifest"];

/** One pinned evidence artifact of a package, located by its single `leaf` member. */
export function portableEvidence(
  manifest: Manifest,
  kind: "source" | "scenes" | "index" | "source-transcript" | "edited-transcript",
  leaf: "metadata.json" | "pages.json",
) {
  const entry = manifest.evidence.find((value) => value.artifact.reference.kind === kind);
  const members = entry?.files.filter((path) => path.endsWith(`/${leaf}`)) ?? [];
  const generation = entry?.artifact.generation;
  if (!entry || members.length !== 1 || typeof generation !== "string")
    throw new CatalogError(
      "INVALID_EVIDENCE",
      `Package ${kind} evidence requires one pinned ${leaf}`,
    );
  return {
    artifact: entry.artifact,
    files: entry.files,
    generation,
    directory: dirname(members[0]!),
  };
}

/** The package's included history, parsed by the timeline owner. */
export function packageRevisions(
  context: Pick<RetainedPackage, "manifest" | "revisionContents">,
): readonly TimelineRevision[] {
  return parseRevisionHistory(
    context.manifest.history.map(({ path }) => JSON.parse(context.revisionContents[path]!)),
    archiveLimits.history,
  );
}

/** The source and scene identities that package evidence readers are keyed by. */
export function portableIdentities(manifest: Manifest) {
  const { recordingId, sourceId } = manifest.snapshot;
  const source = portableEvidence(manifest, "source", "metadata.json"),
    scenes = portableEvidence(manifest, "scenes", "pages.json");
  const sourceIdentity = { recordingId, sourceId, generation: source.generation };
  return {
    source,
    scenes,
    sourceIdentity,
    sceneIdentity: {
      ...sourceIdentity,
      generation: scenes.generation,
      policy: scenes.artifact.policy,
    },
  };
}

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
  retained() {
    return this.registry.lookup(this.handle);
  }
  sourceData() {
    const context = this.retained();
    if (!this.sourceRead) {
      const { source, sourceIdentity: identity } = portableIdentities(context.manifest);
      const root = fileSubdirectory(context.files, source.directory);
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
  /**
   * What this package is, rather than which admission is holding it open: the recording it was
   * exported from and the archive's own copy of it. A derivative keyed by this cannot be confused
   * with one of the recording still in this person's library.
   */
  /** Where this admission's own work may write a file, removed when the admission closes. */
  renderPath(leaf: string) {
    return this.registry.renderPath(this.handle, leaf);
  }
  identity() {
    const { snapshot } = this.retained().manifest;
    return `package:${snapshot.recordingId}:${snapshot.sourceId}:${snapshot.revisionId}`;
  }
  retry(jobId: string) {
    this.registry.retry(this.handle, jobId);
  }
  openOutput(label: string) {
    return this.registry.openOutput(this.handle, label);
  }
  /**
   * A job this package's admission owns whose result is not a package output.
   *
   * A rendered preview is assembled by AVFoundation, which writes at a path rather than into a
   * descriptor this context handed it, so the movie lands in the service's own derived cache the
   * way a library preview does. What stays here is the work: it occupies this package's bounded
   * job slot, it is canceled when the admission closes, and it is retried through the same
   * registry as every other package job.
   */
  submitWork<T>(
    artifact: "preview",
    input: string,
    work: (retained: RetainedPackage, signal: AbortSignal) => Promise<T>,
  ) {
    const { valueBytes } = this.reserveSlot(artifact, input);
    const job = this.registry.submit(
      this.handle,
      { artifact, lane: "heavy", input },
      async (retained, signal) => {
        const result = await work(retained, signal);
        if (Buffer.byteLength(JSON.stringify(result)) > valueBytes)
          throw new CatalogError(
            "LIMIT_EXCEEDED",
            "Media metadata exceeds its queue publication limit",
          );
        return JSON.stringify(result);
      },
    );
    return this.state<T>(job);
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
    const { valueBytes } = this.reserveSlot(artifact, input);
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
    return this.state<T & { outputId: string }>(job);
  }

  /**
   * Makes room for one more job of this kind, reusing the one that already answered this exact
   * request when its output is still there. A ready job whose output has been released is
   * forgotten rather than replayed, because its result names a file nobody can open any more.
   */
  private reserveSlot(artifact: "frame" | "audio" | "preview", input: string) {
    const { jobs, valueBytes } = this.registry.jobs(this.handle);
    let previous = jobs.find((job) => job.artifact === artifact && job.input === input);
    if (previous?.state === "ready" && previous.result && artifact !== "preview") {
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
        if (
          !["frame", "audio", "preview"].includes(job.artifact) ||
          ["queued", "running"].includes(job.state)
        )
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
    return { valueBytes };
  }

  /** One job's state in the shape every derivative inspector answers with. */
  private state<T>(job: ContextJob) {
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
          ? { generation: job.generation, value: JSON.parse(job.result) as T }
          : null,
    };
  }
}
