import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "./library.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { FrameInspection, type FrameDecoder } from "./frames.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function fixture(held?: () => Promise<void>, decodedOffset = 0) {
  const home = await mkdtemp("/tmp/screenrec-frames-core-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const cache = new DerivedCache(store, home, 100);
  await cache.reconcile();
  let frames!: FrameInspection;
  let calls = 0;
  const requests: Parameters<FrameDecoder>[0][] = [];
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    execute: (job) => frames.execute(job),
  });
  frames = new FrameInspection(store, jobs, cache, home, async (request) => {
    calls++;
    requests.push(request);
    if (held) await held();
    await writeFile(request.output, "frame");
    return {
      file: request.output,
      mediaType: "image/png",
      requestedSourceUs: request.atSourceUs,
      actualSourceUs: request.atSourceUs + decodedOffset,
      distanceUs: 0,
      width: 10,
      height: 10,
      sourceWidth: 10,
      sourceHeight: 10,
      bytes: 5,
    };
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "recording",
  });
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 2,
    state: "finalizing",
  });
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 3,
    state: "complete",
    sourceDurationUs: 1000,
  });
  cleanup.push(async () => {
    await jobs.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  return { store, jobs, cache, frames, take, requests, calls: () => calls };
}

test("frame requests retain their revision across an edit, and an exact join decodes the following kept span", async () => {
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await fixture(async () => {
    entered();
    await held;
  });
  const input = { recordingId: f.take.recordingId, atUs: 400, clean: true as const };
  const first = f.frames.request(input);
  await started;
  const edited = f.store.edit(input.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 200, endUs: 400 }],
  });
  release();
  await f.jobs.idle();
  const original = f.frames.request({ ...input, revisionId: first.revisionId });
  expect(original.published?.frame).toMatchObject({
    revisionId: "r0",
    requestedPlaybackUs: 400,
    actualPlaybackUs: 400,
    actualSourceUs: 400,
    kept: { startUs: 0, endUs: 1000 },
  });
  const joinRequest = { ...input, atUs: 200 };
  f.frames.request(joinRequest);
  await f.jobs.idle();
  expect(f.frames.request(joinRequest).published?.frame).toMatchObject({
    revisionId: edited.id,
    requestedPlaybackUs: 200,
    actualPlaybackUs: 200,
    actualSourceUs: 400,
    kept: { startUs: 400, endUs: 1000 },
  });
  expect(f.requests[1]).toMatchObject({ atSourceUs: 400, kept: { startUs: 400, endUs: 1000 } });
  expect(() => f.frames.request({ ...input, atUs: edited.durationUs })).toThrow(
    expect.objectContaining({ code: "INVALID_RANGE" }),
  );
  expect(f.calls()).toBe(2);
});

test("repeated frames reuse evidence and an evicted file regenerates a new attempt", async () => {
  const f = await fixture();
  const input = { recordingId: f.take.recordingId, atUs: 100, clean: true as const };
  f.frames.request(input);
  await f.jobs.idle();
  const first = f.frames.request(input);
  expect(first.published?.frame.actualSourceUs).toBe(100);
  expect(f.frames.request(input)).toEqual(first);
  expect(f.calls()).toBe(1);
  f.cache.remove(first.published!.frame.cacheId);
  expect(f.frames.request(input).published).toBeNull();
  await f.jobs.idle();
  const next = f.frames.request(input);
  expect(next.published?.generation).toBe(2);
  expect(next.published?.frame.cacheId).not.toBe(first.published?.frame.cacheId);
  expect(next.published?.frame.actualSourceUs).toBe(100);
  expect(f.calls()).toBe(2);
});

test("a decoder result outside the kept interval is never published or retained in cache", async () => {
  const f = await fixture(undefined, 1000);
  const input = { recordingId: f.take.recordingId, atUs: 100, clean: true as const };
  f.frames.request(input);
  await f.jobs.idle();
  expect(f.frames.request(input)).toMatchObject({ state: "failed", published: null });
  expect(f.cache.bytes).toBe(0);
  expect(f.calls()).toBe(1);
});

test("a failed frame waits for explicit retry and then publishes a fresh generation", async () => {
  let calls = 0;
  const f = await fixture(async () => {
    if (++calls === 1) throw new Error("decoder interrupted");
  });
  const input = {
    recordingId: f.take.recordingId,
    revisionId: "r0",
    atUs: 100,
    clean: true as const,
  };
  f.frames.request(input);
  await f.jobs.idle();
  expect(f.frames.request(input)).toMatchObject({
    state: "failed",
    retryable: true,
    published: null,
  });
  expect(calls).toBe(1);
  f.frames.retry(input);
  await f.jobs.idle();
  expect(f.frames.request(input)).toMatchObject({ state: "ready", published: { generation: 2 } });
  expect(calls).toBe(2);
});
