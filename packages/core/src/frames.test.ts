import { afterEach, expect, test } from "vitest";
import { chmod, mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "./library.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { FrameInspection, type FrameDecoder } from "./frames.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SourceProcessing } from "./processing.js";
import type { VisualSampler } from "./scenes.js";

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
  let processing!: SourceProcessing;
  const evidence = new SourceEvidenceStore(store);
  const controls = {
    sourceFailure: false,
    badReceipt: false,
    badSelection: false,
    emptyCursor: false,
    missingGeometry: false,
    backfill: false,
  };
  let sourceCalls = 0;
  const sourceOrder: string[] = [];
  let calls = 0;
  const requests: Parameters<FrameDecoder>[0][] = [];
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    onCapacity: () => {
      if (controls.backfill) processing.resume();
    },
    execute: (job) =>
      job.job.artifact === "source-evidence" ? processing.execute(job) : frames.execute(job),
  });
  processing = new SourceProcessing(store, jobs, evidence, home, async (directory, output) => {
    sourceCalls++;
    sourceOrder.push(basename(dirname(directory)));
    if (controls.sourceFailure) throw new Error("source exporter interrupted");
    const records = [
      {
        event: "geometry",
        data: {
          sourceUs: 0,
          hostUs: 1000,
          epoch: 1,
          geometry: {
            outputWidth: 10,
            outputHeight: 10,
            contentScale: 1,
            scaleFactor: 1,
            contentRect: { x: 0, y: 0, width: 10, height: 10 },
          },
        },
      },
      ...(controls.emptyCursor
        ? []
        : [100, 200].map((sourceUs, i) => ({
            event: "cursorSample",
            data: {
              sourceUs,
              x: 2 + i,
              y: 2 + i,
              globalX: 2 + i,
              globalY: 2 + i,
              buttons: 0,
              eligibility: "inside",
              geometryEpoch: 1,
            },
          }))),
    ];
    const body = records
      .filter((record) => !controls.missingGeometry || record.event !== "geometry")
      .map((record) => JSON.stringify(record) + "\n")
      .join("");
    await writeFile(output, body);
    return {
      file: output,
      journal: "capture.journal.jsonl",
      header: { sessionID: store.get(basename(dirname(directory))).sourceId },
      cursorSamples: controls.emptyCursor ? 0 : 2,
      geometryRecords: controls.missingGeometry ? 0 : 1,
      pauseEvents: 0,
      audioIntervals: 0,
      displaySpaces: 0,
      firstCursorSourceUs: controls.emptyCursor ? null : 100,
      lastCursorSourceUs: controls.emptyCursor ? null : 200,
      lastSequence: 4,
      incompleteTail: false,
      finished: true,
      bytes: Buffer.byteLength(body),
    };
  });
  const sample: VisualSampler = async (request) => ({
    sourceWidth: 10,
    sourceHeight: 10,
    samples: request.atSourceUs.map((at) => ({
      requestedSourceUs: at,
      actualSourceUs: at,
      distanceUs: 0,
      width: 8,
      height: 8,
      rgbBase64: Buffer.alloc(192).toString("base64"),
    })),
  });
  frames = new FrameInspection(
    store,
    jobs,
    cache,
    home,
    async (request) => {
      calls++;
      requests.push(request);
      if (held) await held();
      await writeFile(request.output, "frame");
      return {
        file: request.output,
        mediaType: "image/png",
        requestedSourceUs: request.atSourceUs,
        actualSourceUs: request.atSourceUs + decodedOffset + (controls.badSelection ? 1 : 0),
        distanceUs: 0,
        width: 10,
        height: 10,
        sourceWidth: 10,
        sourceHeight: 10,
        bytes: 5,
        ...(request.overlay
          ? {
              overlay: {
                trailPoints:
                  request.overlay.trail.reduce((n, run) => n + run.length, 0) +
                  (controls.badReceipt ? 1 : 0),
                ...(request.overlay.trail[0]?.[0]
                  ? {
                      trailStartUs: request.overlay.trail[0][0].atSourceUs,
                      trailEndUs: request.overlay.trail.at(-1)!.at(-1)!.atSourceUs,
                    }
                  : {}),
                ...(request.overlay.pointer
                  ? { pointerSourceUs: request.overlay.pointer.atSourceUs }
                  : {}),
              },
            }
          : {}),
      };
    },
    { processing, evidence, sample },
  );
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
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  const original = join(source, "video.mov");
  await writeFile(original, "immutable fixture media");
  cleanup.push(async () => {
    await jobs.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  return {
    store,
    jobs,
    cache,
    frames,
    take,
    requests,
    processing,
    evidence,
    controls,
    original,
    sourceOrder,
    sourceCalls: () => sourceCalls,
    calls: () => calls,
  };
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

test("a batch validates before admission, preserves ordered duplicates and pins all frames across edits", async () => {
  const f = await fixture();
  const input = { recordingId: f.take.recordingId, clean: true as const, atUs: [400, 100, 400] };
  expect(() => f.frames.batch({ ...input, atUs: [100, 1000] })).toThrow(
    expect.objectContaining({ code: "INVALID_RANGE" }),
  );
  await f.jobs.idle();
  expect(f.calls()).toBe(0);
  const first = f.frames.batch(input);
  f.store.edit(input.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 0, endUs: 200 }],
  });
  await f.jobs.idle();
  const ready = f.frames.batch({ ...input, revisionId: first.revisionId });
  expect(
    ready.items.map((item) =>
      item.ok ? item.data.published?.frame.actualSourceUs : item.error.code,
    ),
  ).toEqual([400, 100, 400]);
  expect(ready.items.every((item) => item.ok && item.data.revisionId === "r0")).toBe(true);
  expect(f.calls()).toBe(2);
});

test("a partially admitted batch retains ready duplicates and individual admission failures", async () => {
  const f = await fixture();
  const input = { recordingId: f.take.recordingId, clean: true as const, atUs: 1 };
  f.frames.request(input);
  await f.jobs.idle();
  // Two decodes are active; fill all 32 remaining waiting slots synchronously.
  for (let atUs = 10; atUs < 44; atUs++) f.frames.request({ ...input, atUs });
  const batch = f.frames.batch({ ...input, atUs: [1, 99, 1] });
  expect(batch.items.map((item) => (item.ok ? item.data.state : item.error.code))).toEqual([
    "ready",
    "LIMIT_EXCEEDED",
    "ready",
  ]);
  await f.jobs.idle();
});

test("an unreadable cached frame does not prevent admission of a later batch item", async () => {
  const f = await fixture();
  const input = { recordingId: f.take.recordingId, clean: true as const, atUs: 1 };
  f.frames.request(input);
  await f.jobs.idle();
  const file = f.frames.request(input).published!.frame.file;
  await chmod(file, 0);
  try {
    const batch = f.frames.batch({ ...input, atUs: [1, 2] });
    expect(batch.items[0]).toMatchObject({ atUs: 1, ok: false, error: { code: "INTERNAL_ERROR" } });
    expect(batch.items[1]).toMatchObject({ atUs: 2, ok: true });
    await f.jobs.idle();
    expect(f.frames.request({ ...input, atUs: 2 }).published?.frame.actualSourceUs).toBe(2);
  } finally {
    await chmod(file, 0o600);
  }
});

test("batch polling preserves an individual failure until frame retry is explicit", async () => {
  let calls = 0;
  const f = await fixture(async () => {
    if (++calls === 1) throw new Error("temporary decode failure");
  });
  const input = { recordingId: f.take.recordingId, clean: true as const, atUs: [1, 2] };
  const first = f.frames.batch(input);
  await f.jobs.idle();
  const pinned = { ...input, revisionId: first.revisionId };
  expect(
    f.frames.batch(pinned).items.map((item) => (item.ok ? item.data.state : item.error.code)),
  ).toEqual(["failed", "ready"]);
  await f.jobs.idle();
  expect(calls).toBe(2);
  f.frames.retry({ ...pinned, atUs: 1 });
  await f.jobs.idle();
  expect(
    f.frames
      .batch(pinned)
      .items.map((item) => (item.ok ? item.data.published?.generation : item.error.code)),
  ).toEqual([2, 1]);
});

test("annotated defaults wait for source evidence while clean frames bypass that dependency", async () => {
  const f = await fixture();
  const input = { recordingId: f.take.recordingId, atUs: 400 };
  f.frames.request({ ...input, clean: true });
  await f.jobs.idle();
  const clean = f.frames.request({ ...input, clean: true }).published!.frame;
  expect(clean).toMatchObject({ clean: true, annotation: null, sourceEvidence: null });
  expect(f.sourceCalls()).toBe(0);
  expect(f.requests[0]!.overlay).toBeUndefined();
  const pending = f.frames.request(input);
  expect(pending).toMatchObject({
    jobId: null,
    published: null,
    dependency: { artifact: "source", jobId: expect.any(String) },
  });
  f.processing.prepare(f.take.recordingId);
  await f.jobs.idle();
  const source = f.processing.status(f.take.recordingId).published!.evidence;
  f.frames.request(input);
  await f.jobs.idle();
  const ready = f.frames.request(input);
  expect(ready.dependency).toBeNull();
  expect(ready.published!.frame).toMatchObject({
    clean: false,
    annotation: {
      trailUs: 2000000,
      agedFromUs: 400,
      interval: { startUs: 100, endUs: 200 },
      trailPoints: 2,
      trailRuns: 1,
      pointer: { atSourceUs: 200, x: 3, y: 3 },
      geometry: { requestedEpoch: 1, selectedEpoch: 1 },
    },
    sourceEvidence: {
      generation: source.generation,
      integrity: { finished: true, incompleteTail: false },
    },
  });
  expect(f.requests[1]!.overlay).toEqual({
    trailUs: 2000000,
    pointer: { atSourceUs: 200, x: 3, y: 3 },
    trail: [
      [
        { atSourceUs: 100, x: 2, y: 2 },
        { atSourceUs: 200, x: 3, y: 3 },
      ],
    ],
  });
  expect(f.frames.request({ ...input, clean: false, trailUs: 2000000 }).published).toEqual(
    ready.published,
  );
  expect(JSON.stringify(ready.published)).not.toContain("rgbBase64");
  expect(await readFile(f.original, "utf8")).toBe("immutable fixture media");
});

test("frame retry exposes failed source dependency without restarting its worker", async () => {
  const f = await fixture();
  f.controls.sourceFailure = true;
  f.processing.prepare(f.take.recordingId);
  await f.jobs.idle();
  const input = { recordingId: f.take.recordingId, atUs: 400 };
  const failure = f.frames.request(input);
  expect(failure).toMatchObject({
    state: "failed",
    jobId: null,
    published: null,
    retryable: true,
    dependency: { artifact: "source", jobId: f.processing.status(f.take.recordingId).jobId },
  });
  f.controls.sourceFailure = false;
  expect(f.frames.retry(input)).toEqual(failure);
  await f.jobs.idle();
  expect(f.sourceCalls()).toBe(1);
  expect(f.calls()).toBe(0);
  f.processing.retry(f.take.recordingId);
  await f.jobs.idle();
  f.frames.request(input);
  await f.jobs.idle();
  expect(f.frames.request(input).state).toBe("ready");
  expect(f.sourceCalls()).toBe(2);
});

test("pointer-only and known empty overlays remain annotated and have distinct cache identities", async () => {
  const f = await fixture();
  f.processing.prepare(f.take.recordingId);
  await f.jobs.idle();
  const input = { recordingId: f.take.recordingId, atUs: 400 };
  const trail = f.frames.request(input);
  const pointer = f.frames.request({ ...input, trailUs: 0 });
  expect(pointer.jobId).not.toBe(trail.jobId);
  await f.jobs.idle();
  expect(f.frames.request({ ...input, trailUs: 0 }).published!.frame).toMatchObject({
    clean: false,
    overlay: { trailPoints: 0, pointerSourceUs: 200 },
    annotation: { trailUs: 0, trailRuns: 0, pointer: { atSourceUs: 200, x: 3, y: 3 } },
  });
  const empty = await fixture();
  empty.controls.emptyCursor = true;
  empty.processing.prepare(empty.take.recordingId);
  await empty.jobs.idle();
  const emptyInput = { recordingId: empty.take.recordingId, atUs: 400 };
  empty.frames.request(emptyInput);
  await empty.jobs.idle();
  expect(empty.frames.request(emptyInput).published!.frame).toMatchObject({
    clean: false,
    overlay: { trailPoints: 0 },
    annotation: {
      cutoffs: expect.arrayContaining([{ reason: "missing_cursor", atSourceUs: 400 }]),
    },
  });
});

test("annotated batches validate every option/time before admission and preserve ordered dependency states", async () => {
  const untouched = await fixture();
  expect(() =>
    untouched.frames.batch({ recordingId: untouched.take.recordingId, atUs: [400, 1000] }),
  ).toThrow(expect.objectContaining({ code: "INVALID_RANGE" }));
  await untouched.jobs.idle();
  expect(untouched.processing.status(untouched.take.recordingId).state).toBe("not_requested");
  expect(untouched.sourceCalls()).toBe(0);
  const f = await fixture();
  const input = { recordingId: f.take.recordingId, atUs: [400, 100, 400] };
  expect(
    f.frames
      .batch(input)
      .items.map(
        (item) => item.ok && [item.atUs, item.data.published, item.data.dependency?.artifact],
      ),
  ).toEqual([
    [400, null, "source"],
    [100, null, "source"],
    [400, null, "source"],
  ]);
  f.processing.prepare(f.take.recordingId);
  await f.jobs.idle();
  for (const invalid of [
    { ...input, atUs: [400, 1000] },
    { ...input, trailUs: 10000001 },
  ]) {
    expect(() => f.frames.batch(invalid)).toThrow(
      expect.objectContaining({ code: "INVALID_RANGE" }),
    );
  }
  await f.jobs.idle();
  expect(f.calls()).toBe(0);
  const batch = f.frames.batch(input);
  await f.jobs.idle();
  expect(batch.items.every((item) => item.ok)).toBe(true);
  const ready = f.frames.batch(input);
  expect(
    ready.items.map((item) => item.ok && item.data.published?.frame.requestedPlaybackUs),
  ).toEqual([400, 100, 400]);
  expect(ready.items[0]).toEqual(ready.items[2]);
  expect(f.calls()).toBe(2);
});

test("annotation cannot publish a different native image selection or a false overlay receipt", async () => {
  for (const field of ["badSelection", "badReceipt"] as const) {
    const f = await fixture();
    f.processing.prepare(f.take.recordingId);
    await f.jobs.idle();
    f.controls[field] = true;
    const input = { recordingId: f.take.recordingId, atUs: 400 };
    f.frames.request(input);
    await f.jobs.idle();
    expect(f.frames.request(input)).toMatchObject({ state: "failed", published: null });
    expect(f.frames.request(input).reason).toContain("does not match");
    expect(f.cache.bytes).toBe(0);
  }
});

test("missing geometry fails annotation explicitly while the same take still supports clean frames", async () => {
  const f = await fixture();
  f.controls.missingGeometry = true;
  f.processing.prepare(f.take.recordingId);
  await f.jobs.idle();
  const input = { recordingId: f.take.recordingId, atUs: 400 };
  f.frames.request(input);
  await f.jobs.idle();
  expect(f.frames.request(input)).toMatchObject({
    state: "unavailable",
    published: null,
    dependency: null,
  });
  expect(f.frames.request(input).reason).toContain("No timed geometry");
  expect(f.calls()).toBe(0);
  expect(f.cache.bytes).toBe(0);
  f.frames.request({ ...input, clean: true });
  await f.jobs.idle();
  expect(f.frames.request({ ...input, clean: true }).state).toBe("ready");
});

test("annotation keeps its pinned revision and source generation across edits and reprocessing", async () => {
  let entered!: () => void, release!: () => void;
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
  f.processing.prepare(f.take.recordingId);
  await f.jobs.idle();
  const source = f.processing.status(f.take.recordingId);
  const input = { recordingId: f.take.recordingId, atUs: 400 };
  const queued = f.frames.request(input);
  const originalJob = f.jobs.job(queued.jobId!);
  await started;
  const edited = f.store.edit(f.take.recordingId, {
    operation: "cut",
    requestId: "cut-annotated",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 100, endUs: 300 }],
  });
  f.jobs.regenerate(source.jobId!, source.published!.generation);
  release();
  await f.jobs.idle();
  const original = JSON.parse(f.jobs.status(originalJob).published!.result);
  expect(original).toMatchObject({
    revisionId: "r0",
    requestedPlaybackUs: 400,
    actualSourceUs: 400,
    sourceEvidence: { generation: source.published!.evidence.generation },
    annotation: { trailPoints: 2 },
  });
  const newer = f.frames.request({ ...input, revisionId: "r0" });
  expect(newer.jobId).not.toBe(queued.jobId);
  await f.jobs.idle();
  expect(
    f.frames.request({ ...input, revisionId: "r0" }).published!.frame.sourceEvidence!.generation,
  ).not.toBe(original.sourceEvidence.generation);
  f.frames.request(input);
  await f.jobs.idle();
  expect(f.frames.request(input).published!.frame).toMatchObject({
    revisionId: edited.id,
    actualSourceUs: 600,
    kept: { startUs: 300, endUs: 1000 },
    annotation: { trailPoints: 0, pointer: null },
  });
  expect(await readFile(f.original, "utf8")).toBe("immutable fixture media");
});

test("annotation eviction preserves generation identity and cancellation removes late decoder output", async () => {
  const f = await fixture();
  f.processing.prepare(f.take.recordingId);
  await f.jobs.idle();
  const input = { recordingId: f.take.recordingId, atUs: 400 };
  f.frames.request(input);
  await f.jobs.idle();
  const first = f.frames.request(input);
  await rm(first.published!.frame.file);
  const regeneration = f.frames.request(input);
  expect(regeneration.jobId).toBe(first.jobId);
  await f.jobs.idle();
  const restored = f.frames.request(input);
  expect(restored.published!.generation).toBe(first.published!.generation + 1);
  expect(restored.published!.frame.sourceEvidence).toEqual(first.published!.frame.sourceEvidence);
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const canceled = await fixture(async () => {
    entered();
    await held;
  });
  canceled.processing.prepare(canceled.take.recordingId);
  await canceled.jobs.idle();
  const cancelInput = { recordingId: canceled.take.recordingId, atUs: 400 };
  const pending = canceled.frames.request(cancelInput);
  await started;
  canceled.jobs.cancel(pending.jobId!);
  release();
  await canceled.jobs.idle();
  expect(canceled.frames.request(cancelInput)).toMatchObject({
    state: "not_requested",
    reason: "canceled",
    published: null,
  });
  expect(canceled.cache.bytes).toBe(0);
  await expect(readFile(canceled.requests[0]!.output)).rejects.toMatchObject({ code: "ENOENT" });
});

test("annotated demand admits the newest source ahead of unadmitted background history", async () => {
  const f = await fixture();
  const takes = [f.take];
  for (let i = 0; i < 3; i++) {
    const take = f.store.allocate().recording;
    f.store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "generated backlog fixture",
      sourceDurationUs: 1000,
    });
    takes.push(take);
  }
  f.controls.backfill = true;
  f.processing.resume();
  const newest = takes.at(-1)!;
  const pending = f.frames.request({ recordingId: newest.recordingId, atUs: 400 });
  expect(pending.dependency).toEqual({
    artifact: "source",
    jobId: f.processing.status(newest.recordingId).jobId,
  });
  await f.jobs.idle();
  expect(f.sourceOrder).toEqual([
    takes[0]!.recordingId,
    newest.recordingId,
    takes[1]!.recordingId,
    takes[2]!.recordingId,
  ]);
  f.frames.request({ recordingId: newest.recordingId, atUs: 400 });
  await f.jobs.idle();
  expect(f.frames.request({ recordingId: newest.recordingId, atUs: 400 }).state).toBe("ready");
});

test("annotated decoder failures stay failed until explicit frame retry reuses pinned source evidence", async () => {
  let attempts = 0;
  const f = await fixture(async () => {
    if (++attempts === 1) throw new Error("native decoder interrupted");
  });
  const input = { recordingId: f.take.recordingId, atUs: 400 };
  f.frames.request(input);
  await f.jobs.idle();
  f.frames.request(input);
  await f.jobs.idle();
  const failed = f.frames.request(input);
  expect(failed).toMatchObject({
    state: "failed",
    retryable: true,
    published: null,
    dependency: null,
  });
  expect(f.frames.request(input)).toEqual(failed);
  expect(attempts).toBe(1);
  const source = f.processing.status(f.take.recordingId).published!.evidence.generation;
  f.frames.retry(input);
  await f.jobs.idle();
  expect(f.frames.request(input)).toMatchObject({
    state: "ready",
    jobId: failed.jobId,
    published: { generation: 2, frame: { clean: false, sourceEvidence: { generation: source } } },
  });
  expect(f.sourceCalls()).toBe(1);
  expect(attempts).toBe(2);
});
