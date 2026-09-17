import type { RevisionStore } from "./library.js";
import type { JobLane, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import type { SourceEvidenceMetadata } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import type { TimelineRevision } from "./timeline.js";

export type RevisionTarget = { revisionId?: string | undefined };
export type DerivativeContext<Target extends object> = {
  target: Target;
  recordingId: string;
  sourceId: string;
  revision: TimelineRevision;
};
export type SourceReadiness = {
  state: string;
  reason: string | null;
  retryable: boolean;
  jobId: string | null;
  evidence: SourceEvidenceMetadata | null;
};
export type DerivativeSubmission<Value> = Omit<SourceReadiness, "evidence"> & {
  published: { generation: number; value: Value } | null;
};

/** Target authority for pinned derivatives; library and package backends differ only here. */
export type DerivativeBackend<Target extends object> = {
  resolve(input: Target & RevisionTarget): DerivativeContext<Target>;
  source(context: DerivativeContext<Target>): SourceReadiness;
  retry(jobId: string): void;
};

export type DerivativeStatus<Target extends object, Key extends string, Value> = Target & {
  sourceId: string;
  revisionId: string;
  state: string;
  reason: string | null;
  retryable: boolean;
  jobId: string | null;
  published: ({ generation: number } & Record<Key, Value>) | null;
  dependency: { artifact: "source"; jobId: string | null } | null;
};

/** One admission and retry policy for every derivative pinned to a revision and its source evidence. */
export abstract class DerivativeInspection<
  Target extends object,
  Input extends Target & RevisionTarget,
  Key extends string,
  Value,
> {
  constructor(
    protected readonly backend: DerivativeBackend<Target>,
    private readonly key: Key,
  ) {}

  abstract request(input: Input): DerivativeStatus<Target, Key, Value>;

  retry(input: Input): DerivativeStatus<Target, Key, Value> {
    const status = this.request(input);
    if (status.jobId) this.backend.retry(status.jobId);
    return this.request({ ...input, revisionId: status.revisionId });
  }

  /** A missing source is reported as the dependency; nothing is submitted until it is ready. */
  protected admit(
    context: DerivativeContext<Target>,
    source: SourceReadiness,
    submit: (evidence: SourceEvidenceMetadata) => DerivativeSubmission<Value>,
  ): DerivativeStatus<Target, Key, Value> {
    if (source.state !== "ready" || !source.evidence)
      return {
        ...this.identity(context),
        state: source.state,
        reason: source.reason,
        retryable: source.retryable,
        jobId: null,
        published: null,
        dependency: { artifact: "source", jobId: source.jobId },
      };
    return this.status(context, submit(source.evidence));
  }

  protected status(
    context: DerivativeContext<Target>,
    submission: DerivativeSubmission<Value>,
  ): DerivativeStatus<Target, Key, Value> {
    return {
      ...this.identity(context),
      state: submission.state,
      reason: submission.reason,
      retryable: submission.retryable,
      jobId: submission.jobId,
      published: submission.published
        ? ({
            generation: submission.published.generation,
            [this.key]: submission.published.value,
          } as { generation: number } & Record<Key, Value>)
        : null,
      dependency: null,
    };
  }

  private identity(context: DerivativeContext<Target>) {
    return { ...context.target, sourceId: context.sourceId, revisionId: context.revision.id };
  }
}

/** Library derivatives: catalog revisions, the source job, and cached job results. */
export class LibraryDerivatives implements DerivativeBackend<{ recordingId: string }> {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly cache: DerivedCache,
    private readonly processing: SourceProcessing,
  ) {}

  resolve(input: { recordingId: string } & RevisionTarget) {
    return {
      target: { recordingId: input.recordingId },
      recordingId: input.recordingId,
      sourceId: this.store.get(input.recordingId).sourceId,
      revision: this.store.revision(input.recordingId, input.revisionId),
    };
  }

  source(context: DerivativeContext<{ recordingId: string }>): SourceReadiness {
    this.processing.prepare(context.recordingId);
    const status = this.processing.status(context.recordingId);
    return {
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      evidence: status.published?.evidence ?? null,
    };
  }

  retry(jobId: string) {
    this.jobs.retry(jobId);
  }

  /** A published result whose cached file was evicted is regenerated rather than reported ready. */
  submit<Value extends { cacheId: string }>(
    identity: { recordingId: string; revisionId: string; artifact: string; input: string },
    lane: JobLane,
  ): DerivativeSubmission<Value> {
    this.jobs.submit({ ...identity, lane });
    let status = this.jobs.status(identity);
    if (status.published) {
      const read = this.cache.acquire((JSON.parse(status.published.result) as Value).cacheId);
      if (read) read.release();
      else {
        this.jobs.regenerate(status.jobId!, status.published.generation);
        status = this.jobs.status(identity);
      }
    }
    return {
      state: status.state,
      reason: status.reason,
      retryable: status.retryable,
      jobId: status.jobId,
      published: status.published
        ? {
            generation: status.published.generation,
            value: JSON.parse(status.published.result) as Value,
          }
        : null,
    };
  }
}
