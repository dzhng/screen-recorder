import { test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { CatalogError } from "./catalog.js";
import {
  JobDependencyLost,
  JobQueue,
  type Job,
  type JobExecutor,
  type ContextJob,
  type JobContext,
} from "./jobs.js";

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
const held: Pick<Attempt, "fail">[] = [];

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

test("shutdown still stops running work when the catalog cannot record the interruption", async () => {
  const { path, store, queue, started } = fixture();
  const job = queue.submit({
    recordingId: finished(store),
    artifact: "frame",
    lane: "frame",
    input: "at=3",
  });
  const attempt = await started(job.attemptId);
  const { DatabaseSync } = await import("node:sqlite");
  const other = new DatabaseSync(path);
  other.exec("BEGIN IMMEDIATE");
  try {
    let settled = false;
    const closing = queue.close().finally(() => {
      settled = true;
    });
    expect(attempt.signal.aborted).toBe(true);
    await Promise.resolve();
    expect(settled).toBe(false);
    attempt.fail(new Error("stopped"));
    await expect(closing).rejects.toMatchObject({ code: "STORAGE_BUSY" });
    await queue.idle();
  } finally {
    other.exec("ROLLBACK");
    other.close();
  }
  const restarted = open(path, "restart");
  expect(restarted.queue.status(job)).toMatchObject({
    state: "failed",
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

test("an artifact stays busy while queued and until a canceled executor settles", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const request = { recordingId, artifact: "screenshot-index", lane: "heavy" as const };
  const running = queue.submit({ ...request, input: "running" });
  const queued = queue.submit({ ...request, input: "queued" });
  const executor = await started(running.attemptId);
  queue.cancel(running.jobId);
  expect(queue.isArtifactBusy("screenshot-index")).toBe(true);
  queue.cancel(queued.jobId);
  expect(queue.isArtifactBusy("screenshot-index")).toBe(true);
  expect(queue.isArtifactBusy("source")).toBe(false);
  executor.finish("late");
  await queue.idle();
  expect(queue.isArtifactBusy("screenshot-index")).toBe(false);
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

test("forgetting a recording refuses closing executors and removes only its drained jobs", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store),
    sibling = finished(store);
  const own = queue.submit({ recordingId, artifact: "frame", input: "own", lane: "frame" });
  const other = queue.submit({
    recordingId: sibling,
    artifact: "frame",
    input: "other",
    lane: "frame",
  });
  const ownWorker = await started(own.attemptId),
    siblingWorker = await started(other.attemptId);
  await expect(queue.forgetRecording(recordingId)).rejects.toMatchObject({ code: "INVALID_STATE" });
  store.markDeleting(recordingId);
  const draining = queue.drainRecording(recordingId);
  await expect(queue.forgetRecording(recordingId)).rejects.toMatchObject({
    code: "PROCESSING_BUSY",
    retryable: true,
  });
  ownWorker.finish("late");
  await draining;
  await queue.forgetRecording(recordingId);
  await queue.forgetRecording(recordingId);
  siblingWorker.finish("sibling-result");
  await queue.idle();
  expect(queue.status(other).published?.result).toBe("sibling-result");
  expect(
    store.catalog.prepare("SELECT jobId FROM jobs WHERE recordingId=?").all(recordingId),
  ).toEqual([]);
  expect(
    store.catalog.prepare("SELECT result FROM artifacts WHERE recordingId=?").all(recordingId),
  ).toEqual([]);
});

test("forgetting a large ready history yields and preserves another recording's publication", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store),
    sibling = finished(store);
  const other = queue.submit({
    recordingId: sibling,
    artifact: "frame",
    input: "other",
    lane: "frame",
  });
  (await started(other.attemptId)).finish("retained");
  await queue.idle();
  for (let i = 0; i < 260; i++) {
    const job = queue.submit({
      recordingId,
      artifact: "frame",
      input: `frame-${i}`,
      lane: "frame",
    });
    (await started(job.attemptId)).finish(`result-${i}`);
    await queue.idle();
  }
  store.markDeleting(recordingId);
  await queue.drainRecording(recordingId);
  let yielded = false;
  setImmediate(() => {
    yielded = true;
  });
  await queue.forgetRecording(recordingId);
  expect(yielded).toBe(true);
  expect(store.catalog.prepare("SELECT recordingId,result FROM artifacts").all()).toEqual([
    { recordingId: sibling, result: "retained" },
  ]);
  expect(store.catalog.prepare("SELECT jobId FROM jobs").all()).toEqual([{ jobId: other.jobId }]);
  store.finishDeletion(recordingId);
  expect(store.deleting(recordingId)).toBeNull();
  expect(queue.status(other).published?.result).toBe("retained");
});

test("forget refuses intent-marked work still queued behind capture priority", async () => {
  const { store, queue } = fixture();
  const recordingId = finished(store);
  store.allocate();
  const job = queue.submit({ recordingId, artifact: "transcript", input: "queued", lane: "heavy" });
  expect(job.state).toBe("queued");
  store.markDeleting(recordingId);
  await expect(queue.forgetRecording(recordingId)).rejects.toMatchObject({
    code: "PROCESSING_BUSY",
  });
  await queue.drainRecording(recordingId);
  await queue.forgetRecording(recordingId);
  store.finishDeletion(recordingId);
  expect(store.isDeleting(recordingId)).toBe(false);
});

function packageContext(queue: JobQueue) {
  const attempts: {
    job: ContextJob;
    signal: AbortSignal;
    finish: (result: string) => void;
    fail: (error: unknown) => void;
  }[] = [];
  const context = queue.createContext(
    ({ job, signal }) =>
      new Promise<string>((finish, fail) => {
        const attempt = { job, signal, finish, fail };
        attempts.push(attempt);
        held.push(attempt);
      }),
  );
  return { context, attempts };
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const packageRequest = (input: string, lane: "frame" | "heavy" = "heavy") => ({
  artifact: "inspection",
  input,
  lane,
});

test("library and same-provenance package contexts share FIFO heavy admission and one slot", async () => {
  const { queue, store, started } = fixture();
  const recordingId = finished(store),
    a = packageContext(queue),
    b = packageContext(queue);
  const first = queue.submit({ recordingId, artifact: "source", lane: "heavy", input: "first" });
  const one = queue.submitContext(a.context, packageRequest(recordingId));
  const two = queue.submitContext(b.context, packageRequest(recordingId));
  const last = queue.submit({ recordingId, artifact: "source", lane: "heavy", input: "last" });
  expect(one.contextId).not.toBe(two.contextId);
  expect(store.catalog.prepare("SELECT COUNT(*) AS count FROM recordings").get()).toEqual({
    count: 1,
  });
  (await started(first.attemptId)).finish("library-first");
  await turn();
  expect(a.attempts.map((attempt) => attempt.job.input)).toEqual([recordingId]);
  expect(b.attempts).toEqual([]);
  expect(queue.job(last.jobId).state).toBe("queued");
  a.attempts[0]!.finish("package-a");
  await turn();
  expect(queue.contextJob(a.context, one.jobId).result).toBe("package-a");
  expect(b.attempts.map((attempt) => attempt.job.input)).toEqual([recordingId]);
  expect(queue.job(last.jobId).state).toBe("queued");
  b.attempts[0]!.finish("package-b");
  await turn();
  (await started(last.attemptId)).finish("library-last");
  await queue.idle();
  expect(queue.contextJob(b.context, two.jobId).result).toBe("package-b");
});

test("package serialization spends no frame slot and canceled attempts retain capacity until terminal", async () => {
  const { queue, store, started } = fixture();
  const recordingId = finished(store),
    a = packageContext(queue),
    b = packageContext(queue);
  const one = queue.submitContext(a.context, packageRequest("a1", "frame"));
  const two = queue.submitContext(a.context, packageRequest("a2", "frame"));
  const sibling = queue.submitContext(b.context, packageRequest("b", "frame"));
  const library = queue.submit({ recordingId, artifact: "frame", lane: "frame", input: "library" });
  await turn();
  expect(a.attempts.map((attempt) => attempt.job.input)).toEqual(["a1"]);
  expect(b.attempts.map((attempt) => attempt.job.input)).toEqual(["b"]);
  queue.cancelContextJob(a.context, one.jobId);
  expect(a.attempts[0]!.signal.aborted).toBe(true);
  expect(() => queue.forgetContextJob(a.context, one.jobId)).toThrow("still active");
  expect(queue.job(library.jobId).state).toBe("queued");
  b.attempts[0]!.finish("sibling");
  await turn();
  expect(queue.job(library.jobId).state).toBe("running");
  expect(queue.contextJob(a.context, two.jobId).state).toBe("queued");
  a.attempts[0]!.finish("late canceled result");
  await turn();
  expect(queue.contextJob(a.context, one.jobId)).toMatchObject({ state: "canceled", result: null });
  expect(a.attempts.map((attempt) => attempt.job.input)).toEqual(["a1", "a2"]);
  a.attempts[1]!.finish("second");
  (await started(library.attemptId)).finish("library");
  await queue.idle();
  expect(queue.contextJob(b.context, sibling.jobId).result).toBe("sibling");
});

test("capture blocks package heavy work while frame work proceeds", async () => {
  const { queue, store } = fixture();
  const take = store.allocate().recording,
    a = packageContext(queue),
    b = packageContext(queue);
  const heavy = queue.submitContext(a.context, packageRequest("open"));
  const frame = queue.submitContext(b.context, packageRequest("frame", "frame"));
  await turn();
  expect(a.attempts).toEqual([]);
  expect(b.attempts).toHaveLength(1);
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "canceled",
  });
  queue.schedule();
  await turn();
  expect(a.attempts).toHaveLength(1);
  a.attempts[0]!.finish("opened");
  b.attempts[0]!.finish("frame");
  await queue.idle();
  expect(queue.contextJob(a.context, heavy.jobId).result).toBe("opened");
  expect(queue.contextJob(b.context, frame.jobId).result).toBe("frame");
});

test("closing capabilities cannot be forged, transferred or resurrected by late answers", async () => {
  const { queue } = fixture(),
    other = fixture("other");
  const contexts = Array.from({ length: 4 }, () => packageContext(queue));
  const a = contexts[0]!;
  const job = queue.submitContext(a.context, packageRequest("same provenance", "frame"));
  await turn();
  expect(() => packageContext(queue)).toThrow("Too many");
  expect(() => other.queue.submitContext(a.context, packageRequest("x"))).toThrow("not open");
  expect(() =>
    queue.submitContext({ contextId: a.context.contextId } as JobContext, packageRequest("x")),
  ).toThrow("not open");
  const closed = queue.closeContext(a.context);
  expect(queue.closeContext(a.context)).toBe(closed);
  expect(() => queue.submitContext(a.context, packageRequest("x"))).toThrow("not open");
  expect(() => packageContext(queue)).toThrow("Too many");
  a.attempts[0]!.finish("late answer");
  await closed;
  expect(() => queue.contextJob(a.context, job.jobId)).toThrow("not open");
  const replacement = packageContext(queue);
  const fresh = queue.submitContext(
    replacement.context,
    packageRequest("same provenance", "frame"),
  );
  await turn();
  replacement.attempts[0]!.finish("fresh");
  await queue.idle();
  expect(queue.contextJob(replacement.context, fresh.jobId).result).toBe("fresh");
  expect(() => queue.submitContext(a.context, packageRequest("same provenance"))).toThrow(
    "not open",
  );
});

test("terminal metadata can be released for unlimited sequential requests, never active attempts", async () => {
  const { queue } = fixture();
  const context = queue.createContext(async ({ job }) => `result:${job.input}`);
  const jobs: ContextJob[] = [];
  for (let i = 0; i < 32; i++) {
    const job = queue.submitContext(context, packageRequest(String(i)));
    jobs.push(job);
    await queue.idle();
    expect(queue.contextJob(context, job.jobId).result).toBe(`result:${i}`);
  }
  expect(() => queue.submitContext(context, packageRequest("next"))).toThrow("metadata limit");
  for (let i = 0; i < 40; i++) {
    const previous = jobs.shift()!;
    queue.forgetContextJob(context, previous.jobId);
    expect(() => queue.contextJob(context, previous.jobId)).toThrow("does not exist");
    const job = queue.submitContext(context, packageRequest(`later-${i}`));
    jobs.push(job);
    await queue.idle();
    expect(queue.contextJob(context, job.jobId).result).toBe(`result:later-${i}`);
  }
  expect(() => queue.submitContext(context, packageRequest("x".repeat(65537)))).toThrow(
    "too large",
  );
});

test("library deletion cannot cancel two package contexts with identical provenance inputs", async () => {
  const { queue, store, started } = fixture();
  const recordingId = finished(store),
    a = packageContext(queue),
    b = packageContext(queue);
  const library = queue.submit({
    recordingId,
    artifact: "source",
    lane: "heavy",
    input: "library",
  });
  const one = queue.submitContext(a.context, packageRequest(recordingId, "frame"));
  const two = queue.submitContext(b.context, packageRequest(recordingId, "frame"));
  await turn();
  store.markDeleting(recordingId);
  const draining = queue.drainRecording(recordingId);
  expect(a.attempts[0]!.signal.aborted).toBe(false);
  expect(b.attempts[0]!.signal.aborted).toBe(false);
  (await started(library.attemptId)).finish("discard");
  await draining;
  await queue.forgetRecording(recordingId);
  a.attempts[0]!.finish("a");
  b.attempts[0]!.finish("b");
  await queue.idle();
  expect(queue.contextJob(a.context, one.jobId).result).toBe("a");
  expect(queue.contextJob(b.context, two.jobId).result).toBe("b");
});

test("global waiting admission counts both owners and cancellation releases only queued admission", async () => {
  const { queue, store } = fixture();
  const recordingId = finished(store);
  store.allocate();
  const a = packageContext(queue),
    b = packageContext(queue);
  for (let i = 0; i < 16; i++)
    queue.submit({ recordingId, artifact: "source", lane: "heavy", input: String(i) });
  const jobs = Array.from({ length: 16 }, (_, i) =>
    queue.submitContext(a.context, packageRequest(String(i))),
  );
  expect(() => queue.submitContext(b.context, packageRequest("overflow"))).toThrow(
    "already waiting",
  );
  expect(() =>
    queue.submit({ recordingId, artifact: "source", lane: "heavy", input: "overflow" }),
  ).toThrow("already waiting");
  queue.cancelContextJob(a.context, jobs[0]!.jobId);
  expect(queue.submitContext(b.context, packageRequest("replacement")).state).toBe("queued");
  expect(a.attempts).toEqual([]);
  expect(b.attempts).toEqual([]);
});

test("retry pins a new attempt while stale package completion cannot publish or free its successor", async () => {
  const { queue } = fixture(),
    a = packageContext(queue);
  const job = queue.submitContext(a.context, packageRequest("immutable"));
  await turn();
  expect(queue.submitContext(a.context, packageRequest("immutable")).jobId).toBe(job.jobId);
  queue.cancelContextJob(a.context, job.jobId);
  let retry = queue.retryContext(a.context, job.jobId);
  expect(retry.attemptId).not.toBe(job.attemptId);
  expect(retry.generation).toBe(2);
  queue.cancelContextJob(a.context, job.jobId);
  expect(() => queue.forgetContextJob(a.context, job.jobId)).toThrow("still active");
  retry = queue.retryContext(a.context, job.jobId);
  expect(retry.generation).toBe(3);
  expect(a.attempts).toHaveLength(1);
  a.attempts[0]!.finish("old");
  await turn();
  expect(queue.contextJob(a.context, job.jobId)).toMatchObject({
    state: "running",
    result: null,
    attemptId: retry.attemptId,
  });
  a.attempts[1]!.finish("new");
  await queue.idle();
  expect(queue.contextJob(a.context, job.jobId).result).toBe("new");
  queue.forgetContextJob(a.context, job.jobId);
  const next = queue.submitContext(a.context, packageRequest("immutable"));
  expect(next.jobId).not.toBe(job.jobId);
  await turn();
  a.attempts[2]!.finish("again");
  await queue.idle();
});

test("oversized result metadata fails explicitly and queue shutdown invalidates package capabilities", async () => {
  const { queue } = fixture();
  const context = queue.createContext(async () => "x".repeat(65537));
  const job = queue.submitContext(context, packageRequest("large"));
  await queue.idle();
  expect(queue.contextJob(context, job.jobId)).toMatchObject({
    state: "failed",
    retryable: false,
    result: null,
  });
  expect(() => queue.retryContext(context, job.jobId)).toThrow("cannot be retried");
  await queue.close();
  expect(() => queue.contextJob(context, job.jobId)).toThrow("not open");
  expect(() => queue.submitContext(context, packageRequest("next"))).toThrow("queue is closed");
  await queue.closeContext(context);
});

test("32 deferred jobs leave capacity for their shared prerequisite and never spin on replay", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const dependency = {
    recordingId,
    revisionId: "r0",
    artifact: "source",
    input: "shared",
    lane: "heavy" as const,
  };
  let calls = 0;
  const pending = Array.from({ length: 32 }, (_, n) =>
    queue.submitDeferred({ recordingId, artifact: "export", input: String(n), lane: "heavy" }),
  );
  expect(() =>
    queue.submitDeferred({ recordingId, artifact: "export", input: "overflow", lane: "heavy" }),
  ).toThrow("Too much dependency work");
  expect(calls).toBe(0);
  queue.startAdmission(() => {
    calls++;
    const job = queue.submit(dependency);
    return queue.job(job.jobId).state === "ready"
      ? { state: "ready" }
      : { state: "waiting", dependency: job.jobId };
  });
  expect(calls).toBe(32);
  const source = queue.submit(dependency);
  const active = await started(source.attemptId);
  for (let n = 0; n < 100; n++) {
    queue.submit(dependency);
    queue.status({ ...dependency });
  }
  expect(calls).toBe(32);
  expect(
    queue.status({ recordingId, revisionId: "r0", artifact: "export", input: "0" }),
  ).toMatchObject({ state: "queued", reason: source.jobId });
  active.finish("source-evidence");
  await started(pending[0]!.attemptId);
  expect(queue.job(pending[0]!.jobId).state).toBe("running");
  expect(queue.job(pending[31]!.jobId).state).toBe("queued");
  expect(calls).toBe(64);
});

test("a lost prerequisite readmits a deferred job once, and only an explicit retry renews that", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const exporter = queue.submitDeferred({
    recordingId,
    artifact: "export",
    input: "pinned",
    lane: "heavy",
  });
  let admissions = 0;
  queue.startAdmission(() => {
    admissions++;
    return { state: "ready" };
  });
  const lose = async (attemptId: string) => {
    (await started(attemptId)).fail(new JobDependencyLost("Preview disappeared"));
    await turn();
    return queue.job(exporter.jobId);
  };
  const readmitted = await lose(exporter.attemptId);
  expect(readmitted.attemptId).not.toBe(exporter.attemptId);
  expect(readmitted.state).toBe("running");
  expect(admissions).toBe(2);
  expect(await lose(readmitted.attemptId)).toMatchObject({
    attemptId: readmitted.attemptId,
    state: "failed",
    reason: "Preview disappeared",
    retryable: true,
  });
  expect(admissions).toBe(2);
  const retried = queue.retry(exporter.jobId);
  expect(await lose(retried.attemptId)).toMatchObject({ state: "running" });
});

test("deferred cancellation and restart preserve identity until explicit retry", async () => {
  const first = fixture();
  const recordingId = finished(first.store);
  const request = { recordingId, artifact: "export", input: "pinned-r0", lane: "heavy" as const };
  const original = first.queue.submitDeferred(request);
  first.queue.startAdmission(() => ({ state: "waiting", dependency: "source-job" }));
  await first.queue.close();
  first.store.close();
  stores.splice(stores.indexOf(first.store), 1);
  queues.splice(queues.indexOf(first.queue), 1);
  const next = open(first.path, "restart");
  expect(next.queue.job(original.jobId)).toMatchObject({
    attemptId: original.attemptId,
    state: "waiting",
    reason: "source-job",
  });
  expect(next.attempts.size).toBe(0);
  next.queue.cancel(original.jobId);
  let evaluations = 0;
  next.queue.startAdmission(() => {
    evaluations++;
    return { state: "ready" };
  });
  expect(evaluations).toBe(0);
  expect(next.queue.submitDeferred(request).state).toBe("canceled");
  const retry = next.queue.retry(original.jobId);
  expect(retry.attemptId).not.toBe(original.attemptId);
  expect(retry.revisionId).toBe("r0");
  expect(retry.state).toBe("running");
  (await next.started(retry.attemptId)).finish("export");
  await next.queue.idle();
  expect(next.queue.job(original.jobId).state).toBe("ready");
});

test("admission failures stay terminal, isolate siblings, and never retry dependencies", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const dependency = queue.submit({
    recordingId,
    artifact: "source",
    input: "source",
    lane: "heavy",
  });
  (await started(dependency.attemptId)).fail(
    new CatalogError("SOURCE_BAD", "bad source", {}, true),
  );
  await queue.idle();
  const bad = queue.submitDeferred({
    recordingId,
    artifact: "export",
    input: "bad",
    lane: "heavy",
  });
  const good = queue.submitDeferred({
    recordingId,
    artifact: "export",
    input: "good",
    lane: "heavy",
  });
  queue.startAdmission((job) => {
    if (job.input === "bad") {
      const source = queue.submit({
        recordingId,
        artifact: "source",
        input: "source",
        lane: "heavy",
      });
      expect(source.attemptId).toBe(dependency.attemptId);
      throw new CatalogError("DEPENDENCY_FAILED", source.reason!, {}, true);
    }
    return { state: "ready" };
  });
  expect(queue.job(bad.jobId)).toMatchObject({
    state: "failed",
    reason: "bad source",
    retryable: true,
  });
  (await started(good.attemptId)).finish("good");
  await queue.idle();
  queue.schedule();
  expect(queue.job(dependency.jobId)).toMatchObject({
    state: "failed",
    attemptId: dependency.attemptId,
  });
  expect(queue.job(bad.jobId)).toMatchObject({ state: "failed", attemptId: bad.attemptId });
});

test("ready admission respects package capacity, FIFO and capture while frame work progresses", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const blocker = queue.submit({
    recordingId,
    artifact: "source",
    input: "blocker",
    lane: "heavy",
  });
  const active = await started(blocker.attemptId);
  const context = packageContext(queue);
  const packages = Array.from({ length: 32 }, (_, n) =>
    queue.submitContext(context.context, packageRequest(String(n))),
  );
  const deferred = queue.submitDeferred({
    recordingId,
    artifact: "export",
    input: "after-packages",
    lane: "heavy",
  });
  queue.startAdmission(() => ({ state: "ready" }));
  expect(queue.job(deferred.jobId).state).toBe("waiting");
  queue.cancelContextJob(context.context, packages[31]!.jobId);
  expect(queue.job(deferred.jobId).state).toBe("queued");
  const capture = store.allocate().recording;
  active.finish("done");
  await turn();
  expect(context.attempts).toEqual([]);
  expect(queue.job(deferred.jobId).state).toBe("queued");
  queue.cancelContextJob(context.context, packages[30]!.jobId);
  const frame = queue.submit({ recordingId, artifact: "frame", input: "frame", lane: "frame" });
  (await started(frame.attemptId)).finish("frame");
  store.ingestLifecycle(capture.recordingId, {
    sourceId: capture.sourceId,
    sequence: 1,
    state: "canceled",
  });
  queue.schedule();
  await turn();
  expect(context.attempts.map((a) => a.job.input)).toEqual(["0"]);
  expect(queue.job(deferred.jobId).state).toBe("queued");
  for (let n = 0; n < 30; n++) {
    context.attempts[n]!.finish(String(n));
    await turn();
  }
  (await started(deferred.attemptId)).finish("export");
  await queue.idle();
  expect(queue.job(deferred.jobId).state).toBe("ready");
});

test("deletion fences waiting jobs before admission and forgets them after drain", async () => {
  const { store, queue } = fixture();
  const recordingId = finished(store);
  const waiting = queue.submitDeferred({
    recordingId,
    artifact: "export",
    input: "pending",
    lane: "heavy",
  });
  store.markDeleting(recordingId);
  let evaluations = 0;
  queue.startAdmission(() => {
    evaluations++;
    return { state: "ready" };
  });
  await queue.drainRecording(recordingId);
  expect(evaluations).toBe(0);
  expect(queue.job(waiting.jobId)).toMatchObject({
    state: "canceled",
    reason: "recording_unavailable",
    retryable: false,
  });
  expect(() => queue.retry(waiting.jobId)).toThrow();
  await queue.forgetRecording(recordingId);
  expect(() => queue.job(waiting.jobId)).toThrow("Job does not exist");
});

test("dependency owners can cancel a waiting sibling without admitting its stale snapshot", () => {
  const { store, queue } = fixture();
  const recordingId = finished(store);
  const first = queue.submitDeferred({
    recordingId,
    artifact: "export",
    input: "first",
    lane: "heavy",
  });
  const sibling = queue.submitDeferred({
    recordingId,
    artifact: "export",
    input: "sibling",
    lane: "heavy",
  });
  const visited: string[] = [];
  queue.startAdmission((job) => {
    visited.push(job.input);
    queue.cancel(sibling.jobId);
    queue.submit({ recordingId, artifact: "source", input: "source", lane: "heavy" });
    return { state: "waiting", dependency: "source" };
  });
  expect(visited).toEqual(["first"]);
  expect(queue.job(first.jobId).state).toBe("waiting");
  expect(queue.job(sibling.jobId).state).toBe("canceled");
  queue.retry(first.jobId);
  queue.submitDeferred({ recordingId, artifact: "export", input: "first", lane: "heavy" });
  expect(visited).toEqual(["first"]);
});

test("regeneration re-admits deferred work without an unrelated wake and ignores stale generations", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  let calls = 0;
  queue.startAdmission(() => {
    calls++;
    return { state: "ready" };
  });
  const job = queue.submitDeferred({
    recordingId,
    artifact: "derivative",
    input: "pinned",
    lane: "heavy",
  });
  (await started(job.attemptId)).finish("first");
  await queue.idle();
  const replacement = queue.regenerate(job.jobId, job.generation);
  expect(replacement.state).toBe("running");
  const before = calls;
  queue.regenerate(job.jobId, job.generation);
  expect(calls).toBe(before);
  (await started(replacement.attemptId)).finish("regenerated");
  await queue.idle();
  expect(queue.status(job).published?.result).toBe("regenerated");
});

test("single-job retirement drains older canceled attempts before forgetting identity and result", async () => {
  const { store, queue, started } = fixture();
  const recordingId = finished(store);
  const request = { recordingId, artifact: "export", input: "one", lane: "heavy" as const };
  const first = queue.submit(request),
    active = await started(first.attemptId);
  queue.cancel(first.jobId);
  const retry = queue.retry(first.jobId);
  const draining = queue.drainJob(first.jobId);
  let done = false;
  draining.then(() => {
    done = true;
  });
  await turn();
  expect(done).toBe(false);
  expect(active.signal.aborted).toBe(true);
  expect(queue.job(retry.jobId).state).toBe("canceled");
  expect(() => queue.forgetJob(first.jobId)).toThrow("still active");
  active.finish("late result");
  await draining;
  queue.forgetJob(first.jobId);
  expect(queue.status(first)).toMatchObject({
    state: "not_requested",
    published: null,
    jobId: null,
  });
  const next = queue.submit(request);
  expect(next.jobId).not.toBe(first.jobId);
  (await started(next.attemptId)).finish("ready result");
  await queue.idle();
  expect(queue.status(next).published?.result).toBe("ready result");
  await queue.drainJob(next.jobId);
  queue.forgetJob(next.jobId);
  expect(queue.status(next)).toMatchObject({
    state: "not_requested",
    published: null,
    jobId: null,
  });
});
