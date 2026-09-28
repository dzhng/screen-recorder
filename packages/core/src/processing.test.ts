import { afterEach, expect, test } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { RevisionStore } from "./library.js";
import { JobQueue, recordingJobTargets } from "./jobs.js";
import { recordingEvidenceOwner, SourceEvidenceStore } from "./evidence.js";
import { SourceProcessing } from "./processing.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function fixture(failFirst = false, beforeReceipt?: () => Promise<void>) {
  const home = await mkdtemp("/tmp/screenrec-processing-");
  let id = 0;
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "2026-09-16T00:00:00Z",
    newId: () => `id-${++id}`,
  });
  const evidence = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
  let processing: SourceProcessing;
  let calls = 0;
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
    providers: { newId: () => `job-${++id}` },
    execute: (job) =>
      job.job.artifact === "frame" ? Promise.resolve("foreground frame") : processing.execute(job),
    onCapacity: () => processing.resume(),
  });
  processing = new SourceProcessing(store, jobs, evidence, home, async (directory, output) => {
    calls++;
    const sourceId = store.get(basename(dirname(directory))).sourceId;
    const data = {
      sourceUs: 100,
      x: 2,
      y: 3,
      globalX: 20,
      globalY: 30,
      buttons: 0,
      eligibility: "inside",
      geometryEpoch: 1,
    };
    const text = JSON.stringify({ event: "cursorSample", data }) + "\n";
    await writeFile(output, text);
    await beforeReceipt?.();
    if (failFirst && calls === 1) throw new Error("export interrupted");
    return {
      file: output,
      journal: "capture.journal.jsonl",
      header: { sessionID: sourceId },
      cursorSamples: 1,
      geometryRecords: 0,
      displaySpaces: 0,
      pauseEvents: 0,
      audioIntervals: 0,
      firstCursorSourceUs: 100,
      lastCursorSourceUs: 100,
      lastSequence: 3,
      incompleteTail: false,
      invalidAtSequence: null,
      finished: true,
      bytes: Buffer.byteLength(text),
    };
  });
  cleanup.push(async () => {
    await jobs.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  const finish = (recording = store.allocate().recording) => {
    const { recordingId, sourceId } = recording;
    store.ingestLifecycle(recordingId, { sourceId, sequence: 1, state: "recording" });
    store.ingestLifecycle(recordingId, { sourceId, sequence: 2, state: "finalizing" });
    return store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 3,
      state: "complete",
      sourceDurationUs: 1000,
    });
  };
  return { home, store, evidence, processing, jobs, finish, calls: () => calls };
}

test("source processing waits for finalization, publishes indexed evidence, and survives edits without reprocessing", async () => {
  const f = await fixture();
  const recording = f.store.allocate().recording;
  f.processing.prepare(recording.recordingId);
  expect(f.processing.status(recording.recordingId)).toMatchObject({
    state: "not_requested",
    reason: "capture_not_finalized",
  });
  expect(f.calls()).toBe(0);
  f.finish(recording);
  f.processing.prepare(recording.recordingId);
  await f.jobs.idle();
  const status = f.processing.status(recording.recordingId);
  expect(status.state).toBe("ready");
  const metadata = status.published!.evidence;
  expect(
    f.evidence.page({ ...metadata, range: { startUs: 0, endUs: 1000 } }).samples,
  ).toMatchObject([{ sourceUs: 100, x: 2, y: 3 }]);
  expect(await readFile(metadata.receipt.file, "utf8")).toContain('"cursorSample"');
  f.store.edit(recording.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 200, endUs: 400 }],
  });
  f.processing.prepare(recording.recordingId);
  await f.jobs.idle();
  expect(f.processing.status(recording.recordingId)).toEqual(status);
  expect(f.calls()).toBe(1);
});

test("failure removes only its derivative and requires explicit retry", async () => {
  const f = await fixture(true);
  const recording = f.finish();
  f.processing.prepare(recording.recordingId);
  await f.jobs.idle();
  const failed = f.processing.status(recording.recordingId);
  expect(failed).toMatchObject({ state: "failed", retryable: true });
  expect(
    await readdir(join(f.home, "recordings", recording.recordingId, "evidence", "source")),
  ).toEqual([]);
  f.processing.prepare(recording.recordingId);
  await f.jobs.idle();
  expect(f.calls()).toBe(1);
  f.processing.retry(recording.recordingId);
  await f.jobs.idle();
  expect(f.processing.status(recording.recordingId)).toMatchObject({
    state: "ready",
    jobId: failed.jobId,
    published: { generation: 2 },
  });
  expect(f.calls()).toBe(2);
});

test("startup backfill drains a backlog larger than queue admission without retrying completed work", async () => {
  const f = await fixture();
  const recordings = Array.from({ length: 45 }, () => f.finish());
  f.processing.resume();
  await f.jobs.idle();
  expect(f.calls()).toBe(recordings.length);
  for (const recording of recordings)
    expect(f.processing.status(recording.recordingId).state).toBe("ready");
  f.processing.resume();
  await f.jobs.idle();
  expect(f.calls()).toBe(recordings.length);
});

async function orphan(
  f: Awaited<ReturnType<typeof fixture>>,
  recording: ReturnType<Awaited<ReturnType<typeof fixture>>["finish"]>,
  generation: string,
  mode: "file" | "partial" | "complete" | "index",
) {
  const directory = join(
    f.home,
    "recordings",
    recording.recordingId,
    "evidence",
    "source",
    generation,
  );
  if (mode !== "index") {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "observations.jsonl"), "abandoned output");
  }
  if (mode !== "file") {
    f.store.catalog
      .prepare("INSERT INTO source_evidence_generations VALUES('recording',?,?,?,?)")
      .run(
        recording.recordingId,
        recording.sourceId,
        generation,
        mode === "complete" ? "{}" : null,
      );
    const insert = f.store.catalog.prepare(
      "INSERT INTO source_evidence_records VALUES('recording',?,?,?,?,?,?,?)",
    );
    for (let sequence = 1; sequence <= 600; sequence++)
      insert.run(
        recording.recordingId,
        recording.sourceId,
        generation,
        sequence,
        "cursorSample",
        sequence,
        "{}",
      );
  }
  return directory;
}

test("cleanup reclaims every crash phase while preserving published evidence and immutable source", async () => {
  const f = await fixture();
  const recording = f.finish();
  f.processing.prepare(recording.recordingId);
  await f.jobs.idle();
  const ready = f.processing.status(recording.recordingId);
  const file = ready.published!.evidence.receipt.file;
  const bytes = await readFile(file);
  const source = join(f.home, "recordings", recording.recordingId, "source");
  await mkdir(source);
  await writeFile(join(source, "original.mov"), "immutable media");
  for (const mode of ["file", "partial", "complete", "index"] as const)
    await orphan(f, recording, `dead-${mode}`, mode);
  let yielded = false;
  const tick = setImmediate(() => {
    yielded = true;
  });
  await f.processing.cleanup(new AbortController().signal);
  clearImmediate(tick);
  expect(yielded).toBe(true);
  expect(await readFile(file)).toEqual(bytes);
  expect(await readFile(join(source, "original.mov"), "utf8")).toBe("immutable media");
  expect(await readdir(dirname(dirname(file)))).toEqual([ready.published!.evidence.generation]);
  expect(
    f.store.catalog.prepare("SELECT COUNT(*) AS n FROM source_evidence_records").get(),
  ).toEqual({ n: 1 });
  expect(
    f.processing.rawCursor({
      recordingId: recording.recordingId,
      sourceRange: { startUs: 0, endUs: 1000 },
    }).samples[0],
  ).toMatchObject({ x: 2, y: 3 });
  await f.processing.cleanup(new AbortController().signal);
  expect(f.processing.status(recording.recordingId)).toEqual(ready);
});

test("cleanup preserves a canceled attempt's output until its executor settles", async () => {
  let release!: () => void;
  let entered!: () => void;
  let count = 0;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writing = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const f = await fixture(false, async () => {
    if (++count === 1) {
      entered();
      await held;
    }
  });
  const recording = f.finish();
  f.processing.prepare(recording.recordingId);
  await writing;
  const jobId = f.processing.status(recording.recordingId).jobId!;
  const old = f.jobs.job(jobId).attemptId;
  f.jobs.cancel(jobId);
  const replacement = f.jobs.retry(jobId);
  expect(replacement.attemptId).not.toBe(old);
  const generations = join(f.home, "recordings", recording.recordingId, "evidence", "source");
  try {
    await f.processing.cleanup(new AbortController().signal);
    expect(await readdir(generations)).toEqual([old]);
  } finally {
    release();
  }
  await f.jobs.idle();
  expect(f.processing.status(recording.recordingId).state).toBe("ready");
  expect(await readdir(generations)).toEqual([replacement.attemptId]);
});

test("cleanup skips unsafe parents without starving later recordings and never follows symlinks", async () => {
  const f = await fixture();
  const unsafe = f.finish();
  const later = f.finish();
  const source = join(f.home, "recordings", unsafe.recordingId, "source");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "original.mov"), "source");
  await symlink(source, join(f.home, "recordings", unsafe.recordingId, "evidence"));
  await orphan(f, later, "dead", "partial");
  await expect(f.processing.cleanup(new AbortController().signal)).rejects.toThrow(
    "parent is not a directory",
  );
  expect(await readFile(join(source, "original.mov"), "utf8")).toBe("source");
  expect(
    await readdir(join(f.home, "recordings", later.recordingId, "evidence", "source")),
  ).toEqual([]);
});

test("cleanup aborts between index batches and the next pass completes the remainder", async () => {
  const f = await fixture();
  const recording = f.finish();
  await orphan(f, recording, "dead", "index");
  const controller = new AbortController();
  const tick = setImmediate(() => controller.abort());
  await expect(
    f.evidence.reclaim(
      {
        owner: { kind: "recording", recordingId: recording.recordingId },
        sourceId: recording.sourceId,
        generation: "dead",
      },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(
    f.store.catalog.prepare("SELECT COUNT(*) AS n FROM source_evidence_records").get(),
  ).toEqual({ n: 344 });
  clearImmediate(tick);
  await f.processing.cleanup(new AbortController().signal);
  expect(
    f.store.catalog.prepare("SELECT COUNT(*) AS n FROM source_evidence_records").get(),
  ).toEqual({ n: 0 });
  expect(
    f.store.catalog.prepare("SELECT COUNT(*) AS n FROM source_evidence_generations").get(),
  ).toEqual({ n: 0 });
});

test("raw cursor enforces the positive 60-second source range boundary before reading evidence", async () => {
  const f = await fixture();
  const recording = f.finish();
  f.processing.prepare(recording.recordingId);
  await f.jobs.idle();
  const read = (startUs: number, endUs: number) =>
    f.processing.rawCursor({ recordingId: recording.recordingId, sourceRange: { startUs, endUs } });
  expect(read(0, 60_000_000).samples[0]).toMatchObject({ sourceUs: 100, x: 2, y: 3 });
  for (const [start, end] of [
    [0, 60_000_001],
    [-1, 1],
    [0, 0],
    [2, 1],
    [0.5, 1],
    [0, Infinity],
  ])
    expect(() => read(start!, end!)).toThrow(expect.objectContaining({ code: "INVALID_RANGE" }));
});

test("background backfill leaves admission capacity for a foreground inspection", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await fixture(false, () => held);
  const recordings = Array.from({ length: 45 }, () => f.finish());
  f.processing.resume();
  try {
    const job = f.jobs.submit({
      target: { kind: "recording" as const, recordingId: recordings[0]!.recordingId },
      artifact: "frame",
      input: "inspect",
      lane: "frame",
    });
    await expect.poll(() => f.jobs.job(job.jobId).state).toBe("ready");
    expect(f.jobs.status({ ...job }).published?.result).toBe("foreground frame");
  } finally {
    release();
  }
  await f.jobs.idle();
  expect(f.calls()).toBe(recordings.length);
});
