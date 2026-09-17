import { setImmediate } from "node:timers/promises";
import { CatalogError, type RevisionStore } from "./library.js";

/** What an attempt occupies while it runs. Frame work is small and parallel; heavy work is not. */
export type JobLane = "heavy" | "frame";
export type JobState =
  | "waiting"
  | "queued"
  | "running"
  | "ready"
  | "failed"
  | "unavailable"
  | "canceled";
/** The readiness vocabulary a caller sees for one artifact of one recording. */
export type ArtifactState =
  | "not_requested"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unavailable";

/** Contracts cap concurrent work at one heavy job and two frame jobs across library and package contexts. */
const laneLimits: Readonly<Record<JobLane, number>> = { heavy: 1, frame: 2 };
/**
 * Admission stops here. Waiting work is durable, so an unbounded queue would be an unbounded
 * catalog; a caller that hits this retries after the queue drains instead of being absorbed.
 */
const queuedLimit = 32;
const waitingLimit = 32;
export type JobAdmission = (
  job: Job,
) => { state: "ready" } | { state: "waiting"; dependency: string };

export type JobRequest = Readonly<{
  recordingId: string;
  revisionId?: string;
  /** Which artifact of the recording this work produces, named by its owning adapter. */
  artifact: string;
  lane: JobLane;
  /** Canonical identity of the work's inputs. The queue only compares it; its meaning is the caller's. */
  input: string;
}>;

export type Job = Readonly<{
  jobId: string;
  /**
   * Identity of the one attempt that may currently answer for this job. A retry mints a new one,
   * so the answer of an attempt that was abandoned, canceled or lost to a restart cannot land.
   */
  attemptId: string;
  recordingId: string;
  artifact: string;
  lane: JobLane;
  input: string;
  /** The revision pinned when the job was admitted; later edits never move it. */
  revisionId: string;
  state: JobState;
  reason: string | null;
  retryable: boolean;
  /** Reserved for this attempt before work starts; retries never reuse a generation. */
  generation: number;
}>;

/** One published artifact: what the work produced, and the identity it was produced for. */
export type Artifact = Readonly<{
  recordingId: string;
  artifact: string;
  generation: number;
  revisionId: string;
  input: string;
  result: string;
}>;

export type ArtifactStatus = Readonly<{
  state: ArtifactState;
  jobId: string | null;
  reason: string | null;
  retryable: boolean;
  published: Artifact | null;
}>;

/** The running attempt handed to the executor, with the signal that asks it to stop. */
export type JobExecution = Readonly<{ job: Job; signal: AbortSignal }>;
/**
 * Does the actual work and resolves with the artifact result to publish. An ordinary rejection is a
 * retryable failure. Only CatalogError("UNAVAILABLE") reports an absent artifact; other
 * non-retryable errors remain failures rather than pretending the evidence cannot exist.
 */
export type JobExecutor = (execution: JobExecution) => Promise<string>;
/**
 * A lost prerequisite releases the settled attempt back to dependency admission once. Losing it
 * again fails the job as retryable, so a prerequisite that keeps disappearing cannot cycle forever.
 */
export class JobDependencyLost extends Error {}

declare const contextBrand: unique symbol;
/** Queue-issued lifetime authority. The embedded recording ID is never a scheduling owner. */
export type JobContext = Readonly<{ contextId: string; [contextBrand]: true }>;
export type ContextJobRequest = Pick<JobRequest, "artifact" | "lane" | "input">;
export type ContextJob = Omit<Job, "recordingId" | "revisionId" | "state"> & {
  state: Exclude<JobState, "waiting">;
  contextId: string;
  result: string | null;
};
export type ContextJobExecutor = (execution: {
  job: ContextJob;
  signal: AbortSignal;
}) => Promise<string>;
type ContextRow = ContextJob & { queuedSequence: number };
type ContextState = {
  id: string;
  execute?: ContextJobExecutor;
  jobs: Map<string, ContextRow>;
  closed: boolean;
  closing?: Promise<void>;
};
type ClaimedJob = { job: Job; context?: never } | { job: ContextJob; context: ContextState };
function contextValue({ queuedSequence: _sequence, ...job }: ContextRow): ContextJob {
  return job;
}
const contextLimit = 4;
const contextJobLimit = 32;
const contextValueBytes = 64 * 1024;

const jobColumns =
  "jobId,attemptId,recordingId,artifact,lane,input,revisionId,state,reason,retryable,generation";

type JobRow = Omit<Job, "retryable"> & { retryable: number };

function toJob(row: JobRow): Job {
  return { ...row, retryable: row.retryable === 1 };
}

/** An absent artifact is unavailable; anything else fails, retryable unless a CatalogError says not. */
function failure(error: unknown): Pick<Job, "reason" | "retryable"> & {
  state: "failed" | "unavailable";
} {
  return {
    state: error instanceof CatalogError && error.code === "UNAVAILABLE" ? "unavailable" : "failed",
    reason: (error instanceof Error ? error.message : String(error)).slice(0, 4096),
    retryable: !(error instanceof CatalogError) || error.retryable,
  };
}

/**
 * One execution queue for durable library artifacts and transient package contexts. Library rows
 * stay in the catalog the revision store already owns, so
 * a restart reads the same authority rather than a second database, and it starts work only when a
 * submission, a settled attempt or a reported capture change says something might now be allowed.
 * Nothing polls, and a failed attempt waits for an explicit retry; the one automatic re-admission is
 * a deferred job whose prerequisite was lost once. The service that owns the catalog owns one queue.
 */
export class JobQueue {
  private readonly store: RevisionStore;
  private readonly execute: JobExecutor;
  private readonly newId: () => string;
  private readonly attempts = new Map<
    string,
    {
      jobId: string;
      recordingId?: string;
      context?: ContextState;
      lane: JobLane;
      artifact: string;
      controller: AbortController;
      done: Promise<void>;
    }
  >();
  private readonly contexts = new WeakMap<JobContext, ContextState>();
  private readonly activeContexts = new Set<ContextState>();
  private sequence = 0;
  private closed = false;
  private admission: JobAdmission | undefined;
  private admitting = false;
  private readonly onCapacity: (() => void) | undefined;

  constructor(options: {
    store: RevisionStore;
    execute: JobExecutor;
    providers: { newId: () => string };
    onCapacity?: () => void;
  }) {
    this.store = options.store;
    this.execute = options.execute;
    this.newId = options.providers.newId;
    this.onCapacity = options.onCapacity;
    this.store.catalog.exec(`
   CREATE TABLE IF NOT EXISTS jobs (
    jobId TEXT PRIMARY KEY,attemptId TEXT NOT NULL,recordingId TEXT NOT NULL REFERENCES recordings(recordingId),
    artifact TEXT NOT NULL,lane TEXT NOT NULL,input TEXT NOT NULL,revisionId TEXT NOT NULL,state TEXT NOT NULL,
    reason TEXT,retryable INTEGER NOT NULL,generation INTEGER NOT NULL,queuedSequence INTEGER NOT NULL,
    deferred INTEGER NOT NULL DEFAULT 0 CHECK(deferred IN (0,1)),
    readmitted INTEGER NOT NULL DEFAULT 0 CHECK(readmitted IN (0,1))
   ) STRICT;
   CREATE UNIQUE INDEX IF NOT EXISTS jobs_identity
    ON jobs(recordingId,revisionId,artifact,input);
   CREATE INDEX IF NOT EXISTS jobs_waiting ON jobs(queuedSequence) WHERE state='waiting';
   CREATE TABLE IF NOT EXISTS artifacts (
    recordingId TEXT NOT NULL REFERENCES recordings(recordingId),artifact TEXT NOT NULL,generation INTEGER NOT NULL,
    revisionId TEXT NOT NULL,input TEXT NOT NULL,attemptId TEXT NOT NULL,result TEXT NOT NULL,
    PRIMARY KEY(recordingId,revisionId,artifact,input)
   ) STRICT;
  `);
    // Only a process that died holding an attempt can leave a running row behind, so reopening the
    // catalog resolves the ambiguity instead of leaving work that nobody is doing look busy.
    this.store.catalog
      .prepare("UPDATE jobs SET state='failed',reason=?,retryable=1 WHERE state='running'")
      .run("interrupted");
    this.sequence = Number(
      (
        this.store.catalog
          .prepare("SELECT COALESCE(MAX(queuedSequence),0) AS sequence FROM jobs")
          .get() as { sequence: number }
      ).sequence,
    );
    this.runQueued();
  }

  createContext(execute: ContextJobExecutor): JobContext {
    this.requireOpen();
    if (this.activeContexts.size >= contextLimit)
      throw new CatalogError("LIMIT_EXCEEDED", "Too many package contexts are open", {}, true);
    const context = Object.freeze({ contextId: this.newId() }) as JobContext;
    const state: ContextState = { id: context.contextId, execute, jobs: new Map(), closed: false };
    this.contexts.set(context, state);
    this.activeContexts.add(state);
    return context;
  }
  private context(context: JobContext, allowClosed = false): ContextState {
    const state = this.contexts.get(context);
    if (!state || (state.closed && !allowClosed))
      throw new CatalogError("CONTEXT_CLOSED", "Package context is not open in this queue");
    return state;
  }
  submitContext(context: JobContext, request: ContextJobRequest): ContextJob {
    this.requireOpen();
    const state = this.context(context);
    if (
      !request.artifact ||
      Buffer.byteLength(request.artifact) > 128 ||
      Buffer.byteLength(request.input) > contextValueBytes
    )
      throw new CatalogError("LIMIT_EXCEEDED", "Package job identity is too large");
    const existing = [...state.jobs.values()].find(
      (job) => job.artifact === request.artifact && job.input === request.input,
    );
    if (existing) {
      if (existing.lane !== request.lane)
        throw new CatalogError("INVALID_REQUEST", "An existing job cannot change execution lane");
      this.runQueued();
      return this.contextJob(context, existing.jobId);
    }
    if (state.jobs.size >= contextJobLimit)
      throw new CatalogError("LIMIT_EXCEEDED", "Package context job metadata limit exceeded");
    this.admit();
    const job: ContextRow = {
      jobId: this.newId(),
      attemptId: this.newId(),
      contextId: state.id,
      artifact: request.artifact,
      input: request.input,
      lane: request.lane,
      state: "queued",
      reason: null,
      retryable: false,
      generation: 1,
      result: null,
      queuedSequence: ++this.sequence,
    };
    state.jobs.set(job.jobId, job);
    this.runQueued();
    return this.contextJob(context, job.jobId);
  }
  contextJobs(context: JobContext): { jobs: ContextJob[]; capacity: number; valueBytes: number } {
    return {
      jobs: [...this.context(context).jobs.values()].map(contextValue),
      capacity: contextJobLimit,
      valueBytes: contextValueBytes,
    };
  }
  contextJob(context: JobContext, jobId: string): ContextJob {
    const job = this.context(context).jobs.get(jobId);
    if (!job) throw new CatalogError("NOT_FOUND", "Package job does not exist", { jobId });
    return contextValue(job);
  }
  retryContext(context: JobContext, jobId: string): ContextJob {
    this.requireOpen();
    const state = this.context(context),
      current = this.contextJob(context, jobId);
    if (["queued", "running", "ready"].includes(current.state)) {
      this.runQueued();
      return this.contextJob(context, jobId);
    }
    if (!current.retryable) throw new CatalogError("UNAVAILABLE", "Package job cannot be retried");
    this.admit();
    state.jobs.set(jobId, {
      ...current,
      attemptId: this.newId(),
      generation: current.generation + 1,
      queuedSequence: ++this.sequence,
      state: "queued",
      reason: null,
      retryable: false,
      result: null,
    });
    this.runQueued();
    return this.contextJob(context, jobId);
  }
  cancelContextJob(context: JobContext, jobId: string): ContextJob {
    this.requireOpen();
    const state = this.context(context),
      job = this.contextJob(context, jobId);
    if (job.state === "queued" || job.state === "running") {
      Object.assign(state.jobs.get(jobId)!, {
        state: "canceled",
        reason: "canceled",
        retryable: true,
      });
      this.attempts.get(job.attemptId)?.controller.abort();
      this.capacityAvailable();
    }
    return this.contextJob(context, jobId);
  }
  /** The owner releases terminal metadata after retaining any result it needs. Active attempts are never evicted. */
  forgetContextJob(context: JobContext, jobId: string): void {
    const state = this.context(context),
      job = this.contextJob(context, jobId);
    if (
      job.state === "queued" ||
      job.state === "running" ||
      [...this.attempts.values()].some((attempt) => attempt.jobId === jobId)
    )
      throw new CatalogError("PROCESSING_BUSY", "Package job is still active", {}, true);
    state.jobs.delete(jobId);
  }
  closeContext(context: JobContext): Promise<void> {
    const state = this.context(context, true);
    return (state.closing ??= (async () => {
      state.closed = true;
      for (const job of state.jobs.values())
        if (job.state === "queued" || job.state === "running")
          Object.assign(job, { state: "canceled", reason: "context_closed", retryable: false });
      const attempts = [...this.attempts.values()].filter((attempt) => attempt.context === state);
      for (const attempt of attempts) attempt.controller.abort();
      this.capacityAvailable();
      await Promise.all(attempts.map((attempt) => attempt.done));
      state.jobs.clear();
      delete state.execute;
      this.activeContexts.delete(state);
    })());
  }

  /**
   * Admits one job for an artifact of a recording. An existing exact identity returns its current outcome, including failure. Resolve
   * current once at admission; historical requests pin their explicit revision. Only retry
   * creates another attempt, so repeated inspection cannot trigger automatic retry loops.
   */
  submit(request: JobRequest): Job {
    return this.submitJob(request, false);
  }

  submitDeferred(request: JobRequest): Job {
    return this.submitJob(request, true);
  }

  private submitJob(request: JobRequest, deferred: boolean): Job {
    let created = false;
    const jobId = this.store.transaction(() => {
      this.requireOpen();
      const revisionId = this.store.revision(request.recordingId, request.revisionId).id;
      const existing = this.existing({ ...request, revisionId });
      if (existing) {
        if (existing.lane !== request.lane)
          throw new CatalogError("INVALID_REQUEST", "An existing job cannot change execution lane");
        return existing.jobId;
      }
      if (deferred) this.admitWaiting();
      else this.admit();
      created = true;
      const admitted = this.newId();
      this.store.catalog
        .prepare(
          `INSERT INTO jobs(${jobColumns},queuedSequence,deferred)
           VALUES (?,?,?,?,?,?,?,?,NULL,0,1,?,?)`,
        )
        .run(
          admitted,
          this.newId(),
          request.recordingId,
          request.artifact,
          request.lane,
          request.input,
          revisionId,
          deferred ? "waiting" : "queued",
          ++this.sequence,
          Number(deferred),
        );
      return admitted;
    });
    if (created) this.resumeAdmission();
    this.runQueued();
    return this.job(jobId);
  }

  /**
   * Starts one more attempt at a failed job under a fresh attempt identity. A job that is already
   * queued or running is that attempt, and a job that already produced its artifact is the outcome
   * being asked for, so both are returned unchanged rather than duplicated.
   */
  retry(jobId: string): Job {
    let changed = false;
    const retried = this.store.transaction(() => {
      this.requireOpen();
      const current = this.job(jobId);
      this.store.revision(current.recordingId, current.revisionId);
      if (
        current.state === "waiting" ||
        current.state === "queued" ||
        current.state === "running" ||
        current.state === "ready"
      )
        return current.jobId;
      if (!current.retryable)
        throw new CatalogError("UNAVAILABLE", "This job cannot be retried", {
          state: current.state,
          reason: current.reason,
        });
      this.requeue(current);
      changed = true;
      return jobId;
    });
    if (changed) this.resumeAdmission();
    this.runQueued();
    return this.job(retried);
  }

  /** Rebuild an evicted derivative only if the caller still names the published generation. */
  regenerate(jobId: string, generation: number): Job {
    let changed = false;
    this.store.transaction(() => {
      this.requireOpen();
      const current = this.job(jobId);
      if (current.state !== "ready" || current.generation !== generation) return;
      this.store.revision(current.recordingId, current.revisionId);
      this.requeue(current);
      this.store.catalog
        .prepare(
          "DELETE FROM artifacts WHERE recordingId=? AND revisionId=? AND artifact=? AND input=? AND generation=?",
        )
        .run(current.recordingId, current.revisionId, current.artifact, current.input, generation);
      changed = true;
    });
    if (changed) this.resumeAdmission();
    this.runQueued();
    return this.job(jobId);
  }

  /** Starts another attempt. Only a lost prerequisite marks it readmitted; an explicit request clears that. */
  private requeue(current: Job, readmitted = false): void {
    const { deferred } = this.store.catalog
      .prepare("SELECT deferred FROM jobs WHERE jobId=?")
      .get(current.jobId) as { deferred: number };
    if (deferred) this.admitWaiting();
    else this.admit();
    this.store.catalog
      .prepare(
        `UPDATE jobs SET state=?,attemptId=?,reason=NULL,retryable=0,generation=generation+1,
         queuedSequence=?,readmitted=? WHERE jobId=?`,
      )
      .run(
        deferred ? "waiting" : "queued",
        this.newId(),
        ++this.sequence,
        Number(readmitted),
        current.jobId,
      );
  }

  /**
   * Stops a job. The attempt is asked to abort, but its lane stays occupied until the work actually
   * settles, so cancellation can never hand out capacity that something is still using.
   */
  cancel(jobId: string): Job {
    this.requireOpen();
    const stopped = this.store.transaction(() => {
      const current = this.job(jobId);
      if (current.state !== "waiting" && current.state !== "queued" && current.state !== "running")
        return null;
      this.discard(jobId, "canceled");
      return current.attemptId;
    });
    if (stopped !== null) {
      this.attempts.get(stopped)?.controller.abort();
      this.capacityAvailable();
    }
    return this.job(jobId);
  }

  private requireOpen(): void {
    if (this.closed) throw new CatalogError("SERVICE_STOPPED", "The job queue is closed", {}, true);
  }

  private existing(
    identity: Pick<Job, "recordingId" | "revisionId" | "artifact" | "input">,
  ): Job | null {
    const row = this.store.catalog
      .prepare(
        `SELECT ${jobColumns} FROM jobs WHERE recordingId=? AND revisionId=? AND artifact=? AND input=?`,
      )
      .get(identity.recordingId, identity.revisionId, identity.artifact, identity.input) as
      | JobRow
      | undefined;
    return row ? toJob(row) : null;
  }

  job(jobId: string): Job {
    const row = this.store.catalog
      .prepare(`SELECT ${jobColumns} FROM jobs WHERE jobId=?`)
      .get(jobId) as JobRow | undefined;
    if (!row) throw new CatalogError("NOT_FOUND", "Job does not exist", { jobId });
    return toJob(row);
  }

  /** Readiness is for the exact pinned revision and inputs, never whichever job finished last. */
  status(identity: Pick<Job, "recordingId" | "revisionId" | "artifact" | "input">): ArtifactStatus {
    const job = this.existing(identity);
    const present = this.store.isAvailable(identity.recordingId);
    const published = present
      ? ((this.store.catalog
          .prepare(
            "SELECT recordingId,artifact,generation,revisionId,input,result FROM artifacts WHERE recordingId=? AND revisionId=? AND artifact=? AND input=?",
          )
          .get(identity.recordingId, identity.revisionId, identity.artifact, identity.input) as
          | Artifact
          | undefined) ?? null)
      : null;
    return {
      state:
        !job || job.state === "canceled" || !present
          ? "not_requested"
          : job.state === "waiting"
            ? "queued"
            : job.state === "running"
              ? "processing"
              : job.state,
      jobId: job?.jobId ?? null,
      reason: job?.reason ?? null,
      retryable: job?.retryable ?? false,
      published,
    };
  }

  /**
   * Re-examines what may start now. The queue never polls, so the owner calls this after a reported
   * capture transition; every other trigger is a submission, a retry, a cancel or a settled attempt.
   */
  schedule(): void {
    this.resumeAdmission();
    this.runQueued();
  }

  private runQueued(): void {
    if (this.closed || this.admitting) return;
    // A take that can still produce media outranks heavy background work, so heavy attempts wait for
    // it. Startup reconciliation is what settles a stranded take, and with it this pause.
    const capturing = this.store.unsettled().length > 0;
    for (const lane of Object.keys(laneLimits) as JobLane[]) {
      if (lane === "heavy" && capturing) continue;
      while (this.occupied(lane) < laneLimits[lane]) {
        const job = this.claim(lane);
        if (!job) break;
        if (job.context) this.runContext(job.context, job.job);
        else this.run(job.job);
      }
    }
  }

  /** The resource owner must fence retries before draining one job's complete worker lifetime. */
  async drainJob(jobId: string): Promise<void> {
    this.cancel(jobId);
    const active = [...this.attempts.values()].filter((attempt) => attempt.jobId === jobId);
    for (const attempt of active) attempt.controller.abort();
    await Promise.all(active.map((attempt) => attempt.done));
  }

  /** Forget identity and result together only after all attempts, including canceled ones, close. */
  forgetJob(jobId: string): void {
    this.store.transaction(() => {
      const job = this.job(jobId);
      if (
        ["waiting", "queued", "running"].includes(job.state) ||
        [...this.attempts.values()].some((attempt) => attempt.jobId === jobId)
      )
        throw new CatalogError("PROCESSING_BUSY", "Job is still active", {}, true);
      this.store.catalog
        .prepare(
          "DELETE FROM artifacts WHERE recordingId=? AND revisionId=? AND artifact=? AND input=?",
        )
        .run(job.recordingId, job.revisionId, job.artifact, job.input);
      this.store.catalog.prepare("DELETE FROM jobs WHERE jobId=?").run(jobId);
    });
  }

  /** Intent is committed first: no new attempt may enter while these executors close. */
  async drainRecording(recordingId: string): Promise<void> {
    if (!this.store.isDeleting(recordingId))
      throw new CatalogError("INVALID_STATE", "Recording deletion has not been requested");
    this.store.catalog
      .prepare(`UPDATE jobs SET state='canceled',reason='recording_unavailable',retryable=0
      WHERE recordingId=? AND state IN ('waiting','queued','running')`)
      .run(recordingId);
    const active = [...this.attempts.values()].filter(
      (attempt) => attempt.recordingId === recordingId,
    );
    for (const attempt of active) attempt.controller.abort();
    this.capacityAvailable();
    await Promise.all(active.map((attempt) => attempt.done));
  }

  /** Job metadata can disappear only after every executor, including canceled workers, has exited. */
  async forgetRecording(recordingId: string): Promise<void> {
    if (!this.store.isDeleting(recordingId))
      throw new CatalogError("INVALID_STATE", "Recording deletion has not been requested");
    if (
      [...this.attempts.values()].some((attempt) => attempt.recordingId === recordingId) ||
      this.store.catalog
        .prepare(
          "SELECT 1 FROM jobs WHERE recordingId=? AND state IN ('waiting','queued','running') LIMIT 1",
        )
        .get(recordingId)
    )
      throw new CatalogError(
        "PROCESSING_BUSY",
        "Recording jobs have not finished closing",
        {},
        true,
      );
    for (const table of ["artifacts", "jobs"]) {
      for (;;) {
        const removed = this.store.catalog
          .prepare(`DELETE FROM ${table} WHERE rowid IN
          (SELECT rowid FROM ${table} WHERE recordingId=? LIMIT 256)`)
          .run(recordingId);
        if (Number(removed.changes) === 0) break;
        await setImmediate();
      }
    }
  }
  /** Resolves once no attempt is in flight. Work still queued behind a lane or capture stays queued. */
  async idle(): Promise<void> {
    while (this.attempts.size > 0)
      await Promise.all([...this.attempts.values()].map((attempt) => attempt.done));
  }

  /** Aborts everything in flight and stops admitting starts. The catalog stays the store's to close. */
  async close(): Promise<void> {
    this.closed = true;
    let interruption: unknown;
    try {
      this.store.transaction(() => {
        for (const attemptId of this.attempts.keys())
          this.store.catalog
            .prepare(
              "UPDATE jobs SET state='failed',reason='interrupted',retryable=1 WHERE attemptId=? AND state='running'",
            )
            .run(attemptId);
      });
    } catch (error) {
      // Running workers must still stop; startup marks any attempt left running as interrupted.
      interruption = error;
    }
    const contexts = [...this.activeContexts];
    for (const state of contexts) state.closed = true;
    for (const attempt of this.attempts.values()) attempt.controller.abort();
    await this.idle();
    for (const state of contexts) {
      state.jobs.clear();
      delete state.execute;
    }
    this.activeContexts.clear();
    if (interruption) throw interruption;
  }

  /** A canceled attempt still owns its files until its executor has settled. */
  isAttemptActive(attemptId: string): boolean {
    return this.attempts.has(attemptId);
  }

  /** Work of this artifact is queued, running, or a canceled executor of it is still closing. */
  isArtifactBusy(artifact: string): boolean {
    return (
      [...this.attempts.values()].some((attempt) => attempt.artifact === artifact) ||
      Boolean(
        this.store.catalog
          .prepare("SELECT 1 FROM jobs WHERE artifact=? AND state IN ('queued','running') LIMIT 1")
          .get(artifact),
      )
    );
  }

  /**
   * Whether files an attempt wrote under its own ID may still be read: the attempt is running or
   * closing, or its result is what this artifact currently publishes for the recording.
   */
  retainsAttempt(recordingId: string, artifact: string, attemptId: string): boolean {
    return (
      this.attempts.has(attemptId) ||
      Boolean(
        this.store.catalog
          .prepare("SELECT 1 FROM artifacts WHERE recordingId=? AND artifact=? AND attemptId=?")
          .get(recordingId, artifact, attemptId),
      )
    );
  }

  /**
   * Admits original-revision work for the oldest finalized take that never requested it. One take at
   * a time: while the artifact is busy the backlog waits rather than crowding foreground requests
   * out of the shared admission budget, and a full queue leaves it for the next call. A dependency
   * limits the backlog to takes whose original-revision prerequisite is already published.
   */
  backfill(
    request: Pick<JobRequest, "artifact" | "lane" | "input">,
    dependency?: Pick<JobRequest, "artifact" | "input">,
  ): void {
    if (this.isArtifactBusy(request.artifact)) return;
    const pending = this.store.catalog
      .prepare(`SELECT recordingId FROM recordings
      WHERE state IN ('complete','interrupted') AND sourceDurationUs IS NOT NULL
      AND recordingId NOT IN (SELECT recordingId FROM recording_deletions)
      AND NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.recordingId=recordings.recordingId
        AND jobs.revisionId='r0' AND jobs.artifact=? AND jobs.input=?)
      ${
        dependency
          ? `AND EXISTS (SELECT 1 FROM artifacts WHERE artifacts.recordingId=recordings.recordingId
        AND artifacts.revisionId='r0' AND artifacts.artifact=? AND artifacts.input=?)`
          : ""
      }
      ORDER BY creationSequence LIMIT 1`)
      .get(
        request.artifact,
        request.input,
        ...(dependency ? [dependency.artifact, dependency.input] : []),
      ) as { recordingId: string } | undefined;
    if (!pending) return;
    try {
      this.submit({ ...request, recordingId: pending.recordingId, revisionId: "r0" });
    } catch (error) {
      if (!(error instanceof CatalogError && error.code === "LIMIT_EXCEEDED")) throw error;
    }
  }

  private occupied(lane: JobLane): number {
    let count = 0;
    for (const attempt of this.attempts.values()) if (attempt.lane === lane) count += 1;
    return count;
  }

  /** Install only after dependency owners exist. Persisted waiters cannot execute before this. */
  startAdmission(admit: JobAdmission): void {
    this.requireOpen();
    if (this.admission)
      throw new CatalogError("INVALID_STATE", "Admission owner already installed");
    this.admission = admit;
    this.resumeAdmission();
  }

  /** One bounded event turn. Dependency submissions cannot recursively restart this scan. */
  resumeAdmission(): void {
    if (this.closed || this.admitting || !this.admission) return;
    this.admitting = true;
    try {
      const rows = this.store.catalog
        .prepare(
          `SELECT ${jobColumns} FROM jobs WHERE state='waiting' ORDER BY queuedSequence LIMIT ?`,
        )
        .all(waitingLimit) as JobRow[];
      for (const row of rows) {
        if (this.closed) break;
        if (this.job(row.jobId).state !== "waiting") continue;
        if (this.store.isDeleting(row.recordingId)) {
          this.discard(row.jobId, "recording_unavailable");
          continue;
        }
        try {
          const outcome = this.admission(toJob(row));
          // The callback may cancel this job while requesting another owner.
          if (this.job(row.jobId).state !== "waiting") continue;
          if (outcome.state === "waiting") {
            this.store.catalog
              .prepare("UPDATE jobs SET reason=? WHERE jobId=?")
              .run(outcome.dependency, row.jobId);
          } else {
            this.admit();
            this.store.catalog
              .prepare("UPDATE jobs SET state='queued',reason=NULL,queuedSequence=? WHERE jobId=?")
              .run(++this.sequence, row.jobId);
          }
        } catch (error) {
          if (error instanceof CatalogError && error.code === "LIMIT_EXCEEDED") continue;
          if (this.job(row.jobId).state !== "waiting") continue;
          this.fail(row.jobId, error);
        }
      }
    } finally {
      this.admitting = false;
    }
    this.runQueued();
  }

  private admitWaiting(): void {
    const row = this.store.catalog
      .prepare("SELECT COUNT(*) AS count FROM jobs WHERE state='waiting'")
      .get() as { count: number };
    if (row.count >= waitingLimit)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Too much dependency work is already waiting",
        {},
        true,
      );
  }

  private admit(): void {
    const { queued } = this.store.catalog
      .prepare("SELECT COUNT(*) AS queued FROM jobs WHERE state='queued'")
      .get() as { queued: number };
    const contextQueued = [...this.activeContexts].reduce(
      (count, context) =>
        count + [...context.jobs.values()].filter((job) => job.state === "queued").length,
      0,
    );
    if (queued + contextQueued >= queuedLimit)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Too much work is already waiting; retry once the queue drains",
        { queued: queued + contextQueued },
        true,
      );
  }

  private fail(jobId: string, error: unknown): void {
    const { state, reason, retryable } = failure(error);
    this.store.catalog
      .prepare("UPDATE jobs SET state=?,reason=?,retryable=? WHERE jobId=?")
      .run(state, reason, Number(retryable), jobId);
  }

  private discard(jobId: string, reason: string): void {
    this.store.catalog
      .prepare("UPDATE jobs SET state='canceled',reason=?,retryable=? WHERE jobId=?")
      .run(reason, reason === "canceled" ? 1 : 0, jobId);
  }

  /** Takes the oldest startable job in a lane, dropping work whose take was discarded meanwhile. */
  private claim(lane: JobLane): ClaimedJob | null {
    const claimed = this.store.transaction<ClaimedJob | null>(() => {
      for (;;) {
        const row = this.store.catalog
          .prepare(
            `SELECT ${jobColumns},queuedSequence FROM jobs
             WHERE lane=? AND state='queued' ORDER BY queuedSequence LIMIT 1`,
          )
          .get(lane) as (JobRow & { queuedSequence: number }) | undefined;
        const eligible = [...this.activeContexts]
          .filter(
            (context) =>
              !context.closed &&
              ![...this.attempts.values()].some((attempt) => attempt.context === context),
          )
          .flatMap((context) =>
            [...context.jobs.values()]
              .filter((job) => job.state === "queued" && job.lane === lane)
              .map((job) => ({ context, job })),
          )
          .sort((a, b) => a.job.queuedSequence - b.job.queuedSequence)[0];
        if (eligible && (!row || eligible.job.queuedSequence < row.queuedSequence)) {
          return {
            context: eligible.context,
            job: { ...contextValue(eligible.job), state: "running" },
          };
        }
        if (!row) return null;
        const { queuedSequence: _sequence, ...fields } = row;
        if (!this.store.isAvailable(fields.recordingId)) {
          this.discard(row.jobId, "recording_unavailable");
          continue;
        }
        this.store.catalog.prepare("UPDATE jobs SET state='running' WHERE jobId=?").run(row.jobId);
        return { job: { ...toJob(fields), state: "running" } };
      }
    });
    if (claimed?.context)
      Object.assign(claimed.context.jobs.get(claimed.job.jobId)!, { state: "running" });
    return claimed;
  }

  private run(job: Job): void {
    this.startAttempt(
      job,
      { recordingId: job.recordingId },
      (signal) => this.execute({ job, signal }),
      (outcome) => this.settle(job, outcome),
    );
  }
  private runContext(context: ContextState, job: ContextJob): void {
    this.startAttempt(
      job,
      { context },
      (signal) => context.execute!({ job, signal }),
      (outcome) => {
        const current = context.jobs.get(job.jobId);
        if (
          context.closed ||
          !current ||
          current.attemptId !== job.attemptId ||
          current.state !== "running"
        )
          return;
        if ("result" in outcome && Buffer.byteLength(outcome.result) > contextValueBytes)
          outcome = {
            error: new CatalogError("LIMIT_EXCEEDED", "Package job result exceeds metadata limit"),
          };
        if ("result" in outcome) Object.assign(current, { state: "ready", result: outcome.result });
        else Object.assign(current, failure(outcome.error));
      },
    );
  }
  private startAttempt(
    job: Pick<Job, "jobId" | "attemptId" | "lane" | "artifact">,
    owner: { recordingId: string } | { context: ContextState },
    execute: (signal: AbortSignal) => Promise<string>,
    settle: (outcome: { result: string } | { error: unknown }) => void,
  ): void {
    const controller = new AbortController();
    const done = Promise.resolve()
      .then(() => execute(controller.signal))
      .then(
        (result) => settle({ result }),
        (error: unknown) => settle({ error }),
      )
      .finally(() => {
        this.attempts.delete(job.attemptId);
      });
    this.attempts.set(job.attemptId, {
      ...owner,
      jobId: job.jobId,
      lane: job.lane,
      artifact: job.artifact,
      controller,
      done,
    });
    void done.then(
      () => this.capacityAvailable(),
      () => this.capacityAvailable(),
    );
  }

  private capacityAvailable(): void {
    this.resumeAdmission();
    this.runQueued();
    if (!this.closed) this.onCapacity?.();
  }

  private settle(job: Job, outcome: { result: string } | { error: unknown }): void {
    this.store.transaction(() => {
      const current = this.store.catalog
        .prepare(`SELECT ${jobColumns} FROM jobs WHERE jobId=?`)
        .get(job.jobId) as JobRow | undefined;
      // The job may have been canceled, or retried under a new attempt after a restart declared this
      // one lost. Either way this answer is stale and must not overwrite what replaced it.
      if (!current || current.attemptId !== job.attemptId || current.state !== "running") return;
      // An answer that outlived its take, or its take's discard, is dropped rather than resurrecting it.
      if (!this.store.isAvailable(job.recordingId)) {
        this.discard(job.jobId, "recording_unavailable");
        return;
      }
      if ("error" in outcome) {
        let error = outcome.error;
        if (error instanceof JobDependencyLost) {
          const row = this.store.catalog
            .prepare("SELECT deferred,readmitted FROM jobs WHERE jobId=?")
            .get(job.jobId) as { deferred: number; readmitted: number };
          if (row.deferred && !row.readmitted) {
            try {
              this.requeue(toJob(current), true);
              return;
            } catch (admission) {
              error = admission;
            }
          }
        }
        this.fail(job.jobId, error);
        return;
      }
      this.store.catalog
        .prepare(
          `INSERT INTO artifacts(recordingId,artifact,generation,revisionId,input,attemptId,result)
           VALUES (?,?,?,?,?,?,?) ON CONFLICT(recordingId,revisionId,artifact,input) DO UPDATE SET
           generation=excluded.generation,attemptId=excluded.attemptId,result=excluded.result`,
        )
        .run(
          job.recordingId,
          job.artifact,
          job.generation,
          job.revisionId,
          job.input,
          job.attemptId,
          outcome.result,
        );
      this.store.catalog
        .prepare("UPDATE jobs SET state='ready',reason=NULL,retryable=0 WHERE jobId=?")
        .run(job.jobId);
    });
  }
}
