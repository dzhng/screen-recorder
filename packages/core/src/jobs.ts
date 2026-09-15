import { CatalogError, type RevisionStore } from "./library.js";

/** What an attempt occupies while it runs. Frame work is small and parallel; heavy work is not. */
export type JobLane = "heavy" | "frame";
export type JobState = "queued" | "running" | "ready" | "failed" | "canceled";
/** The readiness vocabulary a caller sees for one artifact of one recording. */
export type ArtifactState =
  | "not_requested"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unavailable";

/** Contracts cap concurrent work at one heavy job and two frame jobs across the whole library. */
const laneLimits: Readonly<Record<JobLane, number>> = { heavy: 1, frame: 2 };
/**
 * Admission stops here. Waiting work is durable, so an unbounded queue would be an unbounded
 * catalog; a caller that hits this retries after the queue drains instead of being absorbed.
 */
const queuedLimit = 32;

export type JobRequest = Readonly<{
  recordingId: string;
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
  /** The artifact generation this job published, once it did. */
  generation: number | null;
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
 * retryable failure; rejecting with a non-retryable {@link CatalogError} states a validated absence
 * (an artifact this recording simply cannot have) and the queue reports it as unavailable.
 */
export type JobExecutor = (execution: JobExecution) => Promise<string>;

const jobColumns =
  "jobId,attemptId,recordingId,artifact,lane,input,revisionId,state,reason,retryable,generation";
const joinedJobColumns = jobColumns
  .split(",")
  .map((column) => `jobs.${column}`)
  .join(",");

type JobRow = Omit<Job, "retryable"> & { retryable: number };

function toJob(row: JobRow): Job {
  return { ...row, retryable: row.retryable === 1 };
}

/**
 * The durable artifact queue. It keeps its rows in the catalog the revision store already owns, so
 * a restart reads the same authority rather than a second database, and it starts work only when a
 * submission, a settled attempt or a reported capture change says something might now be allowed.
 * Nothing polls, nothing retries by itself, and the service that owns the catalog owns one queue.
 */
export class JobQueue {
  private readonly store: RevisionStore;
  private readonly execute: JobExecutor;
  private readonly newId: () => string;
  private readonly attempts = new Map<
    string,
    { lane: JobLane; controller: AbortController; done: Promise<void> }
  >();
  private closed = false;

  constructor(options: {
    store: RevisionStore;
    execute: JobExecutor;
    providers: { newId: () => string };
  }) {
    this.store = options.store;
    this.execute = options.execute;
    this.newId = options.providers.newId;
    this.store.catalog.exec(`
   CREATE TABLE IF NOT EXISTS jobs (
    jobId TEXT PRIMARY KEY,attemptId TEXT NOT NULL,recordingId TEXT NOT NULL REFERENCES recordings(recordingId),
    artifact TEXT NOT NULL,lane TEXT NOT NULL,input TEXT NOT NULL,revisionId TEXT NOT NULL,state TEXT NOT NULL,
    reason TEXT,retryable INTEGER NOT NULL,generation INTEGER,queuedSequence INTEGER NOT NULL
   ) STRICT;
   CREATE UNIQUE INDEX IF NOT EXISTS jobs_active_identity
    ON jobs(recordingId,artifact,input) WHERE state IN ('queued','running');
   CREATE TABLE IF NOT EXISTS artifacts (
    recordingId TEXT NOT NULL REFERENCES recordings(recordingId),artifact TEXT NOT NULL,generation INTEGER NOT NULL,
    revisionId TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(recordingId,artifact)
   ) STRICT;
  `);
    // Only a process that died holding an attempt can leave a running row behind, so reopening the
    // catalog resolves the ambiguity instead of leaving work that nobody is doing look busy.
    this.store.catalog
      .prepare("UPDATE jobs SET state='failed',reason=?,retryable=1 WHERE state='running'")
      .run("interrupted");
    this.schedule();
  }

  /**
   * Admits one job for an artifact of a recording. Work already queued or running for the same
   * inputs is returned as it stands rather than doubled, and admission pins the recording's current
   * revision, so this is the single automatic attempt: nothing retries it but an explicit retry.
   */
  submit(request: JobRequest): Job {
    const jobId = this.store.transaction(() => {
      const revisionId = this.store.revision(request.recordingId).id;
      const active = this.active(request.recordingId, request.artifact, request.input);
      if (active) return active.jobId;
      this.admit();
      const admitted = this.newId();
      this.store.catalog
        .prepare(
          `INSERT INTO jobs(${jobColumns},queuedSequence)
           VALUES (?,?,?,?,?,?,?,'queued',NULL,0,NULL,(SELECT COALESCE(MAX(queuedSequence),0)+1 FROM jobs))`,
        )
        .run(
          admitted,
          this.newId(),
          request.recordingId,
          request.artifact,
          request.lane,
          request.input,
          revisionId,
        );
      return admitted;
    });
    this.schedule();
    return this.job(jobId);
  }

  /**
   * Starts one more attempt at a failed job under a fresh attempt identity. A job that is already
   * queued or running is that attempt, and a job that already produced its artifact is the outcome
   * being asked for, so both are returned unchanged rather than duplicated.
   */
  retry(jobId: string): Job {
    const retried = this.store.transaction(() => {
      const current = this.job(jobId);
      if (current.state === "queued" || current.state === "running" || current.state === "ready")
        return current.jobId;
      if (!current.retryable)
        throw new CatalogError("UNAVAILABLE", "This job cannot be retried", {
          state: current.state,
          reason: current.reason,
        });
      const active = this.active(current.recordingId, current.artifact, current.input);
      if (active) return active.jobId;
      this.admit();
      this.store.catalog
        .prepare(
          `UPDATE jobs SET state='queued',attemptId=?,reason=NULL,retryable=0,
           queuedSequence=(SELECT COALESCE(MAX(queuedSequence),0)+1 FROM jobs) WHERE jobId=?`,
        )
        .run(this.newId(), jobId);
      return jobId;
    });
    this.schedule();
    return this.job(retried);
  }

  /**
   * Stops a job. The attempt is asked to abort, but its lane stays occupied until the work actually
   * settles, so cancellation can never hand out capacity that something is still using.
   */
  cancel(jobId: string): Job {
    const stopped = this.store.transaction(() => {
      const current = this.job(jobId);
      if (current.state !== "queued" && current.state !== "running") return null;
      this.discard(jobId, "canceled");
      return current.attemptId;
    });
    if (stopped !== null) this.attempts.get(stopped)?.controller.abort();
    this.schedule();
    return this.job(jobId);
  }

  /** The one job that may currently be doing this exact work, if any is queued or running for it. */
  private active(recordingId: string, artifact: string, input: string): Job | null {
    const row = this.store.catalog
      .prepare(
        `SELECT ${jobColumns} FROM jobs WHERE recordingId=? AND artifact=? AND input=? AND state IN ('queued','running')`,
      )
      .get(recordingId, artifact, input) as JobRow | undefined;
    return row ? toJob(row) : null;
  }

  job(jobId: string): Job {
    const row = this.store.catalog
      .prepare(`SELECT ${jobColumns} FROM jobs WHERE jobId=?`)
      .get(jobId) as JobRow | undefined;
    if (!row) throw new CatalogError("NOT_FOUND", "Job does not exist", { jobId });
    return toJob(row);
  }

  /** How ready one artifact of one recording is, from its newest job and what has been published. */
  status(recordingId: string, artifact: string): ArtifactStatus {
    const published =
      (this.store.catalog
        .prepare(
          "SELECT recordingId,artifact,generation,revisionId,input,result FROM artifacts WHERE recordingId=? AND artifact=?",
        )
        .get(recordingId, artifact) as Artifact | undefined) ?? null;
    const row = this.store.catalog
      .prepare(
        `SELECT ${jobColumns} FROM jobs WHERE recordingId=? AND artifact=? ORDER BY queuedSequence DESC LIMIT 1`,
      )
      .get(recordingId, artifact) as JobRow | undefined;
    const job = row ? toJob(row) : null;
    // A canceled job left the artifact exactly where it found it, so only what is published speaks.
    const state: ArtifactState =
      job === null || job.state === "canceled"
        ? published
          ? "ready"
          : "not_requested"
        : job.state === "running"
          ? "processing"
          : job.state === "failed"
            ? job.retryable
              ? "failed"
              : "unavailable"
            : job.state;
    return {
      state,
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
    if (this.closed) return;
    // A take that can still produce media outranks heavy background work, so heavy attempts wait for
    // it. Startup reconciliation is what settles a stranded take, and with it this pause.
    const capturing = this.store.unsettled().length > 0;
    for (const lane of Object.keys(laneLimits) as JobLane[]) {
      if (lane === "heavy" && capturing) continue;
      while (this.occupied(lane) < laneLimits[lane]) {
        const job = this.claim(lane);
        if (!job) break;
        this.run(job);
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
    for (const attempt of this.attempts.values()) attempt.controller.abort();
    await this.idle();
  }

  private occupied(lane: JobLane): number {
    let count = 0;
    for (const attempt of this.attempts.values()) if (attempt.lane === lane) count += 1;
    return count;
  }

  private admit(): void {
    const { queued } = this.store.catalog
      .prepare("SELECT COUNT(*) AS queued FROM jobs WHERE state='queued'")
      .get() as { queued: number };
    if (queued >= queuedLimit)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Too much work is already waiting; retry once the queue drains",
        { queued },
        true,
      );
  }

  private discard(jobId: string, reason: string): void {
    this.store.catalog
      .prepare("UPDATE jobs SET state='canceled',reason=?,retryable=0 WHERE jobId=?")
      .run(reason, jobId);
  }

  /** Takes the oldest startable job in a lane, dropping work whose take was discarded meanwhile. */
  private claim(lane: JobLane): Job | null {
    return this.store.transaction(() => {
      for (;;) {
        const row = this.store.catalog
          .prepare(
            `SELECT ${joinedJobColumns},recordings.state AS recordingState
             FROM jobs JOIN recordings USING(recordingId)
             WHERE jobs.lane=? AND jobs.state='queued' ORDER BY jobs.queuedSequence LIMIT 1`,
          )
          .get(lane) as (JobRow & { recordingState: string }) | undefined;
        if (!row) return null;
        if (row.recordingState === "canceled") {
          this.discard(row.jobId, "recording_unavailable");
          continue;
        }
        this.store.catalog.prepare("UPDATE jobs SET state='running' WHERE jobId=?").run(row.jobId);
        return { ...toJob(row), state: "running" };
      }
    });
  }

  private run(job: Job): void {
    const controller = new AbortController();
    const done = (async () => this.execute({ job, signal: controller.signal }))()
      .then(
        (result) => this.settle(job, { result }),
        (error: unknown) => this.settle(job, { error }),
      )
      .finally(() => {
        this.attempts.delete(job.attemptId);
      });
    this.attempts.set(job.attemptId, { lane: job.lane, controller, done });
    void done.then(
      () => this.schedule(),
      () => this.schedule(),
    );
  }

  private settle(job: Job, outcome: { result: string } | { error: unknown }): void {
    this.store.transaction(() => {
      const current = this.store.catalog
        .prepare(`SELECT ${jobColumns} FROM jobs WHERE jobId=?`)
        .get(job.jobId) as JobRow | undefined;
      // The job may have been canceled, or retried under a new attempt after a restart declared this
      // one lost. Either way this answer is stale and must not overwrite what replaced it.
      if (!current || current.attemptId !== job.attemptId || current.state !== "running") return;
      if ("error" in outcome) {
        const error = outcome.error;
        const retryable = !(error instanceof CatalogError) || error.retryable;
        this.store.catalog
          .prepare("UPDATE jobs SET state='failed',reason=?,retryable=? WHERE jobId=?")
          .run(
            error instanceof Error ? error.message : String(error),
            retryable ? 1 : 0,
            job.jobId,
          );
        return;
      }
      // Publication needs the take that asked for the work to still be there and still be wanted, so
      // an answer that outlived its recording is dropped rather than resurrecting it.
      const publishable = this.store.catalog
        .prepare("SELECT 1 AS ok FROM recordings WHERE recordingId=? AND state!='canceled'")
        .get(job.recordingId);
      if (!publishable) {
        this.discard(job.jobId, "recording_unavailable");
        return;
      }
      const previous = this.store.catalog
        .prepare("SELECT generation FROM artifacts WHERE recordingId=? AND artifact=?")
        .get(job.recordingId, job.artifact) as { generation: number } | undefined;
      const generation = (previous?.generation ?? 0) + 1;
      this.store.catalog
        .prepare(
          `INSERT INTO artifacts(recordingId,artifact,generation,revisionId,input,result) VALUES (?,?,?,?,?,?)
           ON CONFLICT(recordingId,artifact) DO UPDATE SET generation=excluded.generation,
           revisionId=excluded.revisionId,input=excluded.input,result=excluded.result`,
        )
        .run(job.recordingId, job.artifact, generation, job.revisionId, job.input, outcome.result);
      this.store.catalog
        .prepare("UPDATE jobs SET state='ready',reason=NULL,retryable=0,generation=? WHERE jobId=?")
        .run(generation, job.jobId);
    });
  }
}
