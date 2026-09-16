import { test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CatalogError, RevisionStore } from "./library.js";
import { JobQueue, type Job, type JobExecutor } from "./jobs.js";

/** One attempt the queue handed to the executor, held open until the test answers it. */
type Attempt = {
  job: Job;
  signal: AbortSignal;
  finish: (result: string) => void;
  fail: (error: unknown) => void;
};

const roots: string[] = [];
const stores: RevisionStore[] = [];
const queues: JobQueue[] = [];
const held: Attempt[] = [];

/** A queue plus the executor it drives, where starting and settling are observed, never waited out. */
function open(path: string, prefix: string) {
  let id = 0;
  const store = new RevisionStore(path, {
    now: () => "2026-09-15T00:00:00.000Z",
    newId: () => `${prefix}-${++id}`,
  });
  stores.push(store);
  const attempts = new Map<string, Attempt>();
  const waiting = new Map<string, () => void>();
  const execute: JobExecutor = ({ job, signal }) =>
    new Promise<string>((resolve, reject) => {
      const attempt: Attempt = { job, signal, finish: resolve, fail: reject };
      attempts.set(job.attemptId, attempt);
      held.push(attempt);
      waiting.get(job.attemptId)?.();
    });
  const queue = new JobQueue({
    store,
    execute,
    providers: { newId: () => `${prefix}-${++id}` },
  });
  queues.push(queue);
  const started = async (attemptId: string): Promise<Attempt> => {
    if (!attempts.has(attemptId))
      await new Promise<void>((resolve) => waiting.set(attemptId, resolve));
    return attempts.get(attemptId)!;
  };
  return { store, queue, attempts, started };
}

function fixture(prefix = "run") {
  const root = mkdtempSync(join(tmpdir(), "screenrec-jobs-"));
  roots.push(root);
  const path = join(root, "library.sqlite");
  return { path, ...open(path, prefix) };
}

/** A finished take: it has a revision to pin, and no capture of it is still outstanding. */
function finished(store: RevisionStore, sourceDurationUs = 20): string {
  const { recordingId, sourceId } = store.allocate().recording;
  store.ingestLifecycle(recordingId, { sourceId, sequence: 1, state: "recording" });
  store.ingestLifecycle(recordingId, { sourceId, sequence: 2, state: "finalizing" });
  store.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 3,
    state: "complete",
    sourceDurationUs,
  });
  return recordingId;
}

afterEach(async () => {
  for (const attempt of held.splice(0)) attempt.fail(new Error("test teardown"));
  for (const queue of queues.splice(0)) await queue.close();
  for (const store of stores.splice(0)) store.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("identical work retains its published result without another automatic attempt", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const request = {
    recordingId,
    artifact: "transcript",
    lane: "heavy" as const,
    input: "narration",
  };
  const job = queue.submit(request);
  expect(queue.submit(request).jobId).toBe(job.jobId);
  const attempt = await started(job.attemptId);
  expect(queue.submit(request)).toEqual({ ...job, state: "running" });
  attempt.finish("transcript-a");
  await queue.idle();
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "transcript", input: "narration" }),
  ).toEqual({
    state: "ready",
    jobId: job.jobId,
    reason: null,
    retryable: false,
    published: {
      recordingId,
      artifact: "transcript",
      generation: 1,
      revisionId: "r0",
      input: "narration",
      result: "transcript-a",
    },
  });
  expect(queue.job(job.jobId)).toMatchObject({ state: "ready", generation: 1 });

  expect(queue.submit(request)).toEqual(queue.job(job.jobId));
  expect(queue.retry(job.jobId)).toEqual(queue.job(job.jobId));
});

test("a restart fails the interrupted attempt, whose late answer cannot overwrite its retry", async () => {
  const { store, queue, path, started } = fixture("first");
  const recordingId = finished(store);
  const job = queue.submit({
    recordingId,
    artifact: "transcript",
    lane: "heavy",
    input: "narration",
  });
  const lost = await started(job.attemptId);

  const relaunched = open(path, "second");
  expect(
    relaunched.queue.status({
      recordingId,
      revisionId: "r0",
      artifact: "transcript",
      input: "narration",
    }),
  ).toEqual({
    state: "failed",
    jobId: job.jobId,
    reason: "interrupted",
    retryable: true,
    published: null,
  });
  const retried = relaunched.queue.retry(job.jobId);
  expect(retried.attemptId).not.toBe(job.attemptId);
  expect(retried.revisionId).toBe(job.revisionId);
  const fresh = await relaunched.started(retried.attemptId);

  lost.finish("answer-from-the-dead-process");
  await queue.idle();
  expect(
    relaunched.queue.status({
      recordingId,
      revisionId: "r0",
      artifact: "transcript",
      input: "narration",
    }).published,
  ).toBeNull();
  expect(relaunched.queue.job(job.jobId).state).toBe("running");

  fresh.finish("answer-from-the-retry");
  await relaunched.queue.idle();
  expect(
    relaunched.queue.status({
      recordingId,
      revisionId: "r0",
      artifact: "transcript",
      input: "narration",
    }).published,
  ).toEqual({
    recordingId,
    artifact: "transcript",
    generation: 2,
    revisionId: "r0",
    input: "narration",
    result: "answer-from-the-retry",
  });
});

test("an edit during processing does not move the revision the work was admitted for", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const request = {
    recordingId,
    artifact: "transcript",
    lane: "heavy" as const,
    input: "narration",
  };
  const job = queue.submit(request);
  const attempt = await started(job.attemptId);
  expect(attempt.job.revisionId).toBe("r0");
  const edited = store.edit(recordingId, {
    operation: "cut",
    requestId: "cut-1",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 3, endUs: 5 }],
  });
  attempt.finish("transcript-a");
  await queue.idle();
  expect(store.revision(recordingId).id).toBe(edited.id);
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "transcript", input: "narration" })
      .published,
  ).toEqual({
    recordingId,
    artifact: "transcript",
    generation: 1,
    revisionId: "r0",
    input: "narration",
    result: "transcript-a",
  });
  expect(queue.submit(request).revisionId).toBe(edited.id);
});

test("one heavy and two frame attempts run at once", async () => {
  const { store, queue, attempts, started } = fixture();
  const recordingId = finished(store);
  const transcript = queue.submit({
    recordingId,
    artifact: "transcript",
    lane: "heavy",
    input: "narration",
  });
  const exported = queue.submit({
    recordingId,
    artifact: "export",
    lane: "heavy",
    input: "video",
  });
  const frames = ["5s", "6s", "7s"].map((input) =>
    queue.submit({ recordingId, artifact: `frame-${input}`, lane: "frame", input }),
  );
  await started(frames[1]!.attemptId);
  expect([...attempts.keys()]).toEqual([
    transcript.attemptId,
    frames[0]!.attemptId,
    frames[1]!.attemptId,
  ]);

  (await started(frames[0]!.attemptId)).finish("frame-a");
  expect((await started(frames[2]!.attemptId)).job.jobId).toBe(frames[2]!.jobId);
  expect(queue.job(exported.jobId).state).toBe("queued");
});

test("a new heavy job waits while a take is capturing; frame work does not", async () => {
  const { store, queue, attempts, started } = fixture();
  const recordingId = finished(store);
  const live = store.allocate().recording;
  store.ingestLifecycle(live.recordingId, {
    sourceId: live.sourceId,
    sequence: 1,
    state: "recording",
  });
  const transcript = queue.submit({
    recordingId,
    artifact: "transcript",
    lane: "heavy",
    input: "narration",
  });
  const frame = queue.submit({ recordingId, artifact: "frame", lane: "frame", input: "5s" });
  await started(frame.attemptId);
  expect([...attempts.keys()]).toEqual([frame.attemptId]);
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "transcript", input: "narration" }),
  ).toEqual({
    state: "queued",
    jobId: transcript.jobId,
    reason: null,
    retryable: false,
    published: null,
  });

  store.ingestLifecycle(live.recordingId, {
    sourceId: live.sourceId,
    sequence: 2,
    state: "interrupted",
    reason: "stopped",
    sourceDurationUs: 10,
  });
  queue.schedule();
  expect((await started(transcript.attemptId)).job.jobId).toBe(transcript.jobId);
});

test("canceling a running job frees its lane only once the work settles", async () => {
  const { store, queue, attempts, started } = fixture();
  const recordingId = finished(store);
  const first = queue.submit({
    recordingId,
    artifact: "transcript",
    lane: "heavy",
    input: "narration",
  });
  const running = await started(first.attemptId);
  expect(queue.cancel(first.jobId).state).toBe("canceled");
  expect(running.signal.aborted).toBe(true);

  const second = queue.submit({ recordingId, artifact: "export", lane: "heavy", input: "video" });
  expect(attempts.has(second.attemptId)).toBe(false);
  running.finish("answer-after-cancellation");
  expect((await started(second.attemptId)).job.jobId).toBe(second.jobId);
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "transcript", input: "narration" }),
  ).toEqual({
    state: "not_requested",
    jobId: first.jobId,
    reason: "canceled",
    retryable: true,
    published: null,
  });
});

test("work that outlives a discarded take publishes nothing and does not revive it", async () => {
  const { store, queue, attempts, started } = fixture();
  const recording = store.allocate().recording;
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "recording",
  });
  store.registerSource(recording.recordingId, 20);
  const [running, alsoRunning, waiting] = ["5s", "6s", "7s"].map((input) =>
    queue.submit({
      recordingId: recording.recordingId,
      artifact: `frame-${input}`,
      lane: "frame",
      input,
    }),
  );
  const attempt = await started(running!.attemptId);
  const other = await started(alsoRunning!.attemptId);
  expect(attempts.has(waiting!.attemptId)).toBe(false);
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 2,
    state: "canceled",
  });

  attempt.finish("answer-for-a-discarded-take");
  other.fail(new Error("worker stopped"));
  await queue.idle();
  expect(store.get(recording.recordingId).state).toBe("canceled");
  expect(store.list().recordings).toEqual([]);
  expect(attempts.has(waiting!.attemptId)).toBe(false);
  for (const job of [running!, waiting!]) {
    expect(queue.job(job.jobId).state).toBe("canceled");
    expect(queue.status(job)).toEqual({
      state: "not_requested",
      jobId: job.jobId,
      reason: "recording_unavailable",
      retryable: false,
      published: null,
    });
  }
});

test("waiting work is bounded, while work already admitted still answers", async () => {
  const { store, queue } = fixture();
  const recordingId = finished(store);
  const running = queue.submit({
    recordingId,
    artifact: "transcript",
    lane: "heavy",
    input: "narration",
  });
  const queued: Job[] = [];
  let refused: unknown;
  for (let index = 0; index < 500; index += 1) {
    try {
      queued.push(
        queue.submit({ recordingId, artifact: `frame-${index}`, lane: "heavy", input: `${index}` }),
      );
    } catch (error) {
      refused = error;
      break;
    }
  }
  expect(refused).toMatchObject({ code: "LIMIT_EXCEEDED", retryable: true });
  expect(queue.job(running.jobId).state).toBe("running");
  const oldest = queued[0]!;
  expect(queue.job(oldest.jobId).state).toBe("queued");
  expect(
    queue.submit({ recordingId, artifact: oldest.artifact, lane: "heavy", input: oldest.input })
      .jobId,
  ).toBe(oldest.jobId);

  queue.cancel(oldest.jobId);
  expect(queue.submit({ recordingId, artifact: "late", lane: "heavy", input: "late" }).state).toBe(
    "queued",
  );
});

test("a validated absence is not retryable, while an ordinary failure is", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const absent = queue.submit({
    recordingId,
    artifact: "transcript",
    lane: "heavy",
    input: "narration",
  });
  (await started(absent.attemptId)).fail(
    new CatalogError("UNAVAILABLE", "unavailable:no_narration"),
  );
  await queue.idle();
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "transcript", input: "narration" }),
  ).toEqual({
    state: "unavailable",
    jobId: absent.jobId,
    reason: "unavailable:no_narration",
    retryable: false,
    published: null,
  });
  expect(() => queue.retry(absent.jobId)).toThrow(expect.objectContaining({ code: "UNAVAILABLE" }));

  const failed = queue.submit({ recordingId, artifact: "export", lane: "heavy", input: "video" });
  (await started(failed.attemptId)).fail(new Error("encoder exited with 1"));
  await queue.idle();
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "export", input: "video" }),
  ).toEqual({
    state: "failed",
    jobId: failed.jobId,
    reason: "encoder exited with 1",
    retryable: true,
    published: null,
  });
  const retried = queue.retry(failed.jobId);
  expect(retried.attemptId).not.toBe(failed.attemptId);
  (await started(retried.attemptId)).finish("export-a");
  await queue.idle();
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "export", input: "video" }).published,
  ).toMatchObject({ result: "export-a" });
  expect(queue.retry(failed.jobId)).toEqual(queue.job(failed.jobId));
});

test("an unchanged failed request needs explicit retry, including after reopen", async () => {
  const { store, queue, started, path } = fixture();
  const recordingId = finished(store);
  const request = {
    recordingId,
    artifact: "transcript",
    lane: "heavy" as const,
    input: "narration",
  };
  const job = queue.submit(request);
  (await started(job.attemptId)).fail(new Error("decoder failed"));
  await queue.idle();
  expect(queue.submit(request)).toMatchObject({
    jobId: job.jobId,
    state: "failed",
    attemptId: job.attemptId,
  });
  const next = open(path, "again");
  expect(next.queue.submit(request)).toMatchObject({ jobId: job.jobId, state: "failed" });
});

test("the same parameters on an edited revision never reuse the old running job", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const request = { recordingId, artifact: "frame", lane: "frame" as const, input: "at=2" };
  const first = queue.submit(request);
  await started(first.attemptId);
  const revision = store.edit(recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 0, endUs: 3 }],
  });
  const second = queue.submit(request);
  expect(second.revisionId).toBe(revision.id);
  expect(second.jobId).not.toBe(first.jobId);
});

test("out-of-order results retain their own revision and input identities", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const request = { recordingId, artifact: "frame", lane: "frame" as const, input: "at=2" };
  const old = queue.submit(request);
  const oldWork = await started(old.attemptId);
  const edited = store.edit(recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 0, endUs: 3 }],
  });
  const current = queue.submit(request);
  (await started(current.attemptId)).finish("new-revision-pixels");
  // An acknowledged next start proves the preceding result was durably settled.
  const alternate = queue.submit({ ...request, input: "at=4" });
  (await started(alternate.attemptId)).finish("other-time-pixels");
  oldWork.finish("old-revision-pixels");
  await queue.idle();
  expect(queue.status(current).published).toMatchObject({
    revisionId: edited.id,
    input: "at=2",
    result: "new-revision-pixels",
  });
  expect(queue.status(alternate).published).toMatchObject({
    revisionId: edited.id,
    input: "at=4",
    result: "other-time-pixels",
  });
  expect(queue.status(old).published).toMatchObject({
    revisionId: "r0",
    result: "old-revision-pixels",
  });
  expect(queue.submit({ ...request, revisionId: "r0" }).jobId).toBe(old.jobId);
});

test("a permanent processing error is failed rather than unavailable", async () => {
  const { store, queue, started } = fixture();
  const job = queue.submit({
    recordingId: finished(store),
    artifact: "frame",
    lane: "frame",
    input: "at=2",
  });
  (await started(job.attemptId)).fail(new CatalogError("INVALID_RANGE", "bad decode plan"));
  await queue.idle();
  expect(queue.status(job)).toMatchObject({ state: "failed", retryable: false });
  expect(queue.submit(job).jobId).toBe(job.jobId);
});

test("shutdown rejects late success and leaves the attempt explicitly retryable", async () => {
  const { store, queue, started } = fixture();
  const request = {
    recordingId: finished(store),
    artifact: "frame",
    lane: "frame" as const,
    input: "at=2",
  };
  const job = queue.submit(request);
  const attempt = await started(job.attemptId);
  const closing = queue.close();
  expect(attempt.signal.aborted).toBe(true);
  expect(() => queue.submit(request)).toThrow(expect.objectContaining({ code: "SERVICE_STOPPED" }));
  attempt.finish("answer-after-shutdown");
  await closing;
  expect(queue.status(job)).toMatchObject({
    state: "failed",
    reason: "interrupted",
    retryable: true,
    published: null,
  });
});

test("an executor submitting dependent work cannot exceed the frame capacity", async () => {
  const { store, queue: initial } = fixture();
  await initial.close();
  const recordingId = finished(store);
  const started: string[] = [];
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new JobQueue({
    store,
    providers: {
      newId: (() => {
        let n = 0;
        return () => `nested-${++n}`;
      })(),
    },
    execute: async ({ job }) => {
      started.push(job.input);
      if (job.input === "first") {
        queue.submit({ recordingId, artifact: "frame", input: "second", lane: "frame" });
        queue.submit({ recordingId, artifact: "frame", input: "third", lane: "frame" });
      }
      await hold;
      return job.input;
    },
  });
  queues.push(queue);
  queue.submit({ recordingId, artifact: "frame", input: "first", lane: "frame" });
  await Promise.resolve();
  await Promise.resolve();
  expect(started).toEqual(["first", "second"]);
  release();
  await queue.idle();
  expect(started).toEqual(["first", "second", "third"]);
});

test("explicit retry of canceled work waits for its old executor to release capacity", async () => {
  const { store, queue, started, attempts } = fixture();
  const request = {
    recordingId: finished(store),
    artifact: "transcript",
    lane: "heavy" as const,
    input: "narration",
  };
  const job = queue.submit(request);
  const old = await started(job.attemptId);
  queue.cancel(job.jobId);
  expect(queue.submit(request).state).toBe("canceled");
  const retry = queue.retry(job.jobId);
  expect(retry.generation).toBe(job.generation + 1);
  expect(attempts.has(retry.attemptId)).toBe(false);
  old.finish("stale");
  (await started(retry.attemptId)).finish("fresh");
  await queue.idle();
  expect(queue.status(retry).published?.result).toBe("fresh");
});

test("an earlier development job catalog is refused before catalog schema writes", async () => {
  const { store, queue, path } = fixture();
  await queue.close();
  queues.splice(queues.indexOf(queue), 1);
  store.catalog.exec(
    "DROP TABLE recording_deletions; DROP INDEX jobs_identity; CREATE UNIQUE INDEX jobs_active_identity ON jobs(recordingId,artifact,input) WHERE state IN ('queued','running')",
  );
  store.close();
  const before = readFileSync(path);
  expect(() => {
    const reopened = new RevisionStore(path, { now: () => "", newId: () => "unused" });
    try {
      new JobQueue({
        store: reopened,
        providers: { newId: () => "unused" },
        execute: async () => "unused",
      });
    } finally {
      reopened.close();
    }
  }).toThrow(expect.objectContaining({ code: "UNSUPPORTED_CATALOG" }));
  expect(readFileSync(path).equals(before)).toBe(true);
});

test("regenerating an evicted artifact preserves its revision and cannot invalidate a newer publication", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const request = { recordingId, artifact: "frame", lane: "frame" as const, input: "at=10" };
  const original = queue.submit(request);
  (await started(original.attemptId)).finish("frame-one");
  await queue.idle();
  store.edit(recordingId, {
    operation: "cut",
    requestId: "edit",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 0, endUs: 5 }],
  });
  const replacement = queue.regenerate(original.jobId, original.generation);
  expect(replacement).toMatchObject({ revisionId: "r0", generation: 2 });
  expect(replacement.attemptId).not.toBe(original.attemptId);
  expect(queue.status({ ...request, revisionId: "r0" }).published).toBeNull();
  expect(queue.regenerate(original.jobId, original.generation).attemptId).toBe(
    replacement.attemptId,
  );
  (await started(replacement.attemptId)).finish("frame-two");
  await queue.idle();
  expect(queue.regenerate(original.jobId, original.generation)).toMatchObject({
    state: "ready",
    generation: 2,
    attemptId: replacement.attemptId,
  });
  expect(queue.status({ ...request, revisionId: "r0" }).published?.result).toBe("frame-two");
});

test("cache regeneration preserves the published artifact when queue admission is full", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const job = queue.submit({ recordingId, artifact: "frame", lane: "frame", input: "cached" });
  (await started(job.attemptId)).finish("still-readable");
  await queue.idle();
  // Capture holds the heavy lane, so all pending slots remain occupied.
  store.allocate();
  for (let i = 0; i < 32; i++)
    queue.submit({ recordingId, artifact: "transcript", lane: "heavy", input: `pending-${i}` });
  expect(() => queue.regenerate(job.jobId, job.generation)).toThrow(
    expect.objectContaining({ code: "LIMIT_EXCEEDED" }),
  );
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "frame", input: "cached" }),
  ).toMatchObject({ state: "ready", published: { generation: 1, result: "still-readable" } });
});

test("artifact activity remains visible until a canceled executor settles", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const job = queue.submit({
    recordingId,
    artifact: "screenshot-index",
    lane: "frame",
    input: "retained",
  });
  const executor = await started(job.attemptId);
  expect(queue.isArtifactActive("screenshot-index")).toBe(true);
  queue.cancel(job.jobId);
  expect(queue.isArtifactActive("screenshot-index")).toBe(true);
  executor.finish("late");
  await queue.idle();
  expect(queue.isArtifactActive("screenshot-index")).toBe(false);
});

test("recording deletion drains only its held attempts and fences queued and late publication", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const other = finished(store);
  const target = queue.submit({ recordingId, artifact: "frame", lane: "frame", input: "target" });
  const sibling = queue.submit({
    recordingId: other,
    artifact: "frame",
    lane: "frame",
    input: "sibling",
  });
  const waiting = queue.submit({ recordingId, artifact: "frame", lane: "frame", input: "waiting" });
  const targetAttempt = await started(target.attemptId);
  const siblingAttempt = await started(sibling.attemptId);
  queue.cancel(target.jobId);
  store.markDeleting(recordingId);
  let drained = false;
  const draining = queue.drainRecording(recordingId).then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(targetAttempt.signal.aborted).toBe(true);
  expect(siblingAttempt.signal.aborted).toBe(false);
  expect(drained).toBe(false);
  expect(queue.job(waiting.jobId).state).toBe("canceled");
  expect(() => queue.retry(target.jobId)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  expect(() =>
    queue.submit({ recordingId, artifact: "frame", lane: "frame", input: "new" }),
  ).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  targetAttempt.finish("late target");
  await draining;
  expect(queue.status(target).published).toBeNull();
  expect(queue.job(sibling.jobId).state).toBe("running");
  siblingAttempt.finish("sibling kept");
  await queue.idle();
  expect(queue.status(sibling).published?.result).toBe("sibling kept");
});

test("startup skips deletion-marked queued work and runs the next recording", async () => {
  const first = fixture();
  const live = first.store.allocate().recording;
  const recordingId = finished(first.store);
  const sibling = finished(first.store);
  const blocked = first.queue.submit({
    recordingId,
    artifact: "source",
    lane: "heavy",
    input: "gone",
  });
  const next = first.queue.submit({
    recordingId: sibling,
    artifact: "source",
    lane: "heavy",
    input: "kept",
  });
  first.store.markDeleting(recordingId);
  first.store.ingestLifecycle(live.recordingId, {
    sourceId: live.sourceId,
    sequence: 1,
    state: "canceled",
  });
  await first.queue.close();
  queues.splice(queues.indexOf(first.queue), 1);
  first.store.close();
  const reopened = open(first.path, "reopen");
  expect(reopened.queue.job(blocked.jobId).state).toBe("canceled");
  const attempt = await reopened.started(next.attemptId);
  expect([...reopened.attempts.values()].map((value) => value.job.recordingId)).toEqual([sibling]);
  attempt.finish("sibling result");
  await reopened.queue.idle();
  expect(reopened.queue.status(next).published?.result).toBe("sibling result");
});

test("intent alone fences an executor resolving before cancellation is requested", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const job = queue.submit({ recordingId, artifact: "frame", lane: "frame", input: "late" });
  const attempt = await started(job.attemptId);
  store.markDeleting(recordingId);
  attempt.finish("must not publish");
  await queue.idle();
  expect(queue.job(job.jobId).state).toBe("canceled");
  expect(queue.status(job).published).toBeNull();
});
