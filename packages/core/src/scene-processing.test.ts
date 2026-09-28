import { recordingSceneOwner, recordingSceneIdentity } from "./scene-evidence.js";
import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { JobQueue, recordingJobTargets } from "./jobs.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
import { SceneProcessing } from "./scene-processing.js";
import type { VisualSampler } from "./scenes.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
async function fixture(
  durationUs = 120_000_000,
  failAt = 0,
  beforeSample?: (call: number) => Promise<void>,
) {
  const home = await mkdtemp("/tmp/scene-processing-");
  let id = 0,
    calls = 0,
    largest = 0;
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "2026-09-16T00:00:00Z",
    newId: () => `id-${++id}`,
  });
  const evidence = new SceneEvidenceStore(store, recordingSceneOwner(store));
  let processing: SceneProcessing;
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
    providers: { newId: () => `job-${++id}` },
    execute: (execution) => processing.execute(execution),
  });
  const sample: VisualSampler = async (request) => {
    calls++;
    await beforeSample?.(calls);
    largest = Math.max(largest, request.atSourceUs.length);
    if (calls === failAt) throw new Error("interrupted observation");
    return {
      sourceWidth: 64,
      sourceHeight: 64,
      samples: request.atSourceUs.map((at) => {
        const actual = at <= 50_000_000 ? 0 : 100_000_000;
        return {
          requestedSourceUs: at,
          actualSourceUs: actual,
          distanceUs: Math.abs(at - actual),
          width: 2,
          height: 2,
          rgbBase64: Buffer.alloc(12, actual === 0 ? 0 : 255).toString("base64"),
        };
      }),
    };
  };
  processing = new SceneProcessing({
    jobs,
    evidence,
    recording: { store, home, sample: sample },
  });
  cleanups.push(async () => {
    await jobs.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  const recording = store.allocate().recording;
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "recording",
  });
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 2,
    state: "finalizing",
  });
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 3,
    state: "complete",
    sourceDurationUs: durationUs,
  });
  return {
    store,
    jobs,
    evidence,
    processing,
    recording,
    calls: () => calls,
    largest: () => largest,
  };
}

test("canonical scan retains a future transition beyond the discovering chunk and pins source evidence across edits", async () => {
  const f = await fixture();
  const id = f.recording.recordingId;
  f.processing.prepare(id);
  await f.jobs.idle();
  const ready = f.processing.status(id);
  expect(ready.state).toBe("ready");
  const page = f.evidence.page({
    identity: recordingSceneIdentity(ready.published!.evidence),
    limit: 100,
  });
  expect(
    page.chunks.flatMap((chunk) => chunk.comparisons).filter((pair) => pair.boundary),
  ).toContainEqual(
    expect.objectContaining({ previousActualSourceUs: 0, actualSourceUs: 100_000_000 }),
  );
  expect(f.largest()).toBeLessThanOrEqual(52);
  f.store.edit(id, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 1_000_000, endUs: 2_000_000 }],
  });
  const calls = f.calls();
  f.processing.prepare(id);
  await f.jobs.idle();
  expect(f.processing.status(id)).toEqual(ready);
  expect(f.calls()).toBe(calls);
});

test("a failed partial scan stays unpublished until an explicit retry", async () => {
  const f = await fixture(120_000_000, 3),
    id = f.recording.recordingId;
  f.processing.prepare(id);
  await f.jobs.idle();
  const failed = f.processing.status(id);
  expect(failed).toMatchObject({ state: "failed", published: null, retryable: true });
  expect(f.calls()).toBe(3);
  f.processing.prepare(id);
  await f.jobs.idle();
  expect(f.calls()).toBe(3);
  f.processing.retry(id);
  await f.jobs.idle();
  const ready = f.processing.status(id);
  expect(ready).toMatchObject({ state: "ready", jobId: failed.jobId });
  expect(ready.published!.evidence.durationUs).toBe(120_000_000);
  const page = f.evidence.page({
    identity: recordingSceneIdentity(ready.published!.evidence),
    limit: 1,
  });
  expect(page.chunks[0]!.range).toEqual({ startUs: 0, endUs: 10_000_000 });
  expect(page.nextStartUs).toBe(0);
});

test("a thirty-minute scan and paged evidence keep each native batch bounded", async () => {
  const f = await fixture(1_800_000_000),
    id = f.recording.recordingId;
  f.processing.prepare(id);
  await f.jobs.idle();
  const ready = f.processing.status(id);
  expect(ready.state).toBe("ready");
  const identity = ready.published!.evidence;
  let afterStartUs: number | undefined = undefined,
    total = 0,
    lastEnd = 0;
  for (;;) {
    const page = f.evidence.page({
      identity: recordingSceneIdentity(identity),
      limit: 3,
      ...(afterStartUs === undefined ? {} : { afterStartUs }),
    });
    expect(page.chunks.length).toBeLessThanOrEqual(3);
    for (const chunk of page.chunks) {
      expect(chunk.range.startUs).toBe(lastEnd);
      lastEnd = chunk.range.endUs;
      total++;
    }
    if (page.nextStartUs === null) break;
    afterStartUs = page.nextStartUs;
  }
  expect(total).toBe(180);
  expect(lastEnd).toBe(1_800_000_000);
  expect(f.largest()).toBeLessThanOrEqual(52);
  expect(f.calls()).toBe(180);
});

test("canceling a scan discards its partial chunks and keeps publication empty", async () => {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await fixture(120_000_000, 0, async (call) => {
    if (call === 2) {
      entered();
      await hold;
    }
  });
  const id = f.recording.recordingId;
  f.processing.prepare(id);
  await started;
  const status = f.processing.status(id),
    job = f.jobs.job(status.jobId!);
  f.jobs.cancel(job.jobId);
  release();
  await f.jobs.idle();
  expect(f.processing.status(id)).toMatchObject({
    state: "not_requested",
    reason: "canceled",
    published: null,
  });
  expect(() =>
    f.evidence.page({
      identity: {
        owner: { kind: "recording", recordingId: id },
        sourceId: f.recording.sourceId,
        generation: job.attemptId,
        policy: job.input,
      },
    }),
  ).toThrow();
  const leftovers: string[] = [];
  await f.evidence.reclaim({ kind: "recording", recordingId: id }, (generation) => {
    leftovers.push(generation);
    return true;
  });
  expect(leftovers).toEqual([]);
  expect(f.calls()).toBe(2);
});

test("startup cleanup reclaims an abandoned generation but preserves the published evidence", async () => {
  const f = await fixture();
  const id = f.recording.recordingId;
  f.processing.prepare(id);
  await f.jobs.idle();
  const ready = f.processing.status(id),
    identity = ready.published!.evidence;
  const first = f.evidence.page({ identity: recordingSceneIdentity(identity), limit: 1 })
    .chunks[0]!;
  f.evidence.append(
    recordingSceneIdentity({ ...identity, generation: "abandoned-attempt" }),
    { kind: "recording", durationUs: first.kept.endUs },
    first,
  );
  await f.processing.cleanup(new AbortController().signal);
  const generations: string[] = [];
  await f.evidence.reclaim({ kind: "recording", recordingId: id }, (generation) => {
    generations.push(generation);
    return true;
  });
  expect(generations).toEqual([identity.generation]);
  expect(
    f.evidence.page({ identity: recordingSceneIdentity(identity), limit: 1 }).chunks[0],
  ).toEqual(first);
  expect(f.processing.status(id)).toEqual(ready);
});
