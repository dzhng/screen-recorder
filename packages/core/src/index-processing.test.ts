import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { RevisionStore } from "./library.js";
import { JobQueue } from "./jobs.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SourceProcessing } from "./processing.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
import { SceneProcessing } from "./scene-processing.js";
import { ScreenshotIndexStore } from "./screenshot-index.js";
import { IndexProcessing } from "./index-processing.js";
import type { FrameDecoder } from "./frame-materialization.js";
import type { VisualSampler } from "./scenes.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture(beforeDecode?: (call: number) => Promise<void>, beforeSource?: () => void) {
  const home = await mkdtemp("/tmp/index-processing-");
  let id = 0,
    decoded = 0;
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "2026-09-16T00:00:00Z",
    newId: () => `id-${++id}`,
  });
  const evidence = {
    source: new SourceEvidenceStore(store),
    scenes: new SceneEvidenceStore(store),
  };
  const retained = new ScreenshotIndexStore(store, home);
  let source: SourceProcessing, scenes: SceneProcessing, index: IndexProcessing;
  const jobs = new JobQueue({
    store,
    providers: { newId: () => `job-${++id}` },
    execute: (execution) => {
      if (execution.job.artifact === "source-evidence") return source.execute(execution);
      if (execution.job.artifact === "source-scenes") return scenes.execute(execution);
      if (execution.job.artifact === "foreground") return Promise.resolve("foreground image");
      return index.execute(execution);
    },
  });
  source = new SourceProcessing(store, jobs, evidence.source, home, async (directory, output) => {
    beforeSource?.();
    const geometry = {
      event: "geometry",
      data: {
        epoch: 1,
        hostUs: 1000,
        sourceUs: 0,
        geometry: {
          outputWidth: 100,
          outputHeight: 100,
          contentScale: 1,
          scaleFactor: 1,
          contentRect: { x: 0, y: 0, width: 100, height: 100 },
          screenRect: { x: 0, y: 0, width: 100, height: 100 },
        },
      },
    };
    const rows = [
      geometry,
      ...Array.from({ length: 60 }, (_, i) => ({
        event: "cursorSample",
        data: {
          sourceUs: i * 200000,
          x: -10,
          y: -10,
          globalX: -10,
          globalY: -10,
          buttons: 0,
          eligibility: "outside",
          geometryEpoch: 1,
        },
      })),
    ];
    const text = rows.map((row) => JSON.stringify(row) + "\n").join("");
    await writeFile(output, text);
    return {
      file: output,
      journal: "capture.journal.jsonl",
      firstCursorSourceUs: 0,
      lastCursorSourceUs: 11800000,
      header: { sessionID: store.get(basename(dirname(directory))).sourceId },
      cursorSamples: 60,
      geometryRecords: 1,
      displaySpaces: 0,
      pauseEvents: 0,
      audioIntervals: 0,
      lastSequence: 61,
      incompleteTail: false,
      finished: true,
      bytes: Buffer.byteLength(text),
    };
  });
  const sample: VisualSampler = async (request) => ({
    sourceWidth: 100,
    sourceHeight: 100,
    samples: request.atSourceUs.map((at) => ({
      requestedSourceUs: at,
      actualSourceUs: at,
      distanceUs: 0,
      width: 2,
      height: 2,
      rgbBase64: Buffer.alloc(12).toString("base64"),
    })),
  });
  scenes = new SceneProcessing(store, jobs, evidence.scenes, home, sample);
  const decode: FrameDecoder = async (request) => {
    decoded++;
    await beforeDecode?.(decoded);
    // Unit file lifecycle uses a real tiny PNG; bundled tests supply source-raster fidelity.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9xkAAAAASUVORK5CYII=",
      "base64",
    );
    await writeFile(request.output, png);
    return {
      file: request.output,
      mediaType: "image/png",
      requestedSourceUs: request.atSourceUs,
      actualSourceUs: request.atSourceUs,
      distanceUs: 0,
      width: 1,
      height: 1,
      sourceWidth: 100,
      sourceHeight: 100,
      bytes: png.length,
      overlay: { trailPoints: 0 },
    };
  };
  index = new IndexProcessing(store, jobs, retained, source, scenes, evidence, home, {
    sample,
    decode,
  });
  cleanup.push(async () => {
    await jobs.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  const finish = () => {
    const take = store.allocate().recording;
    return store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "generated unit source",
      sourceDurationUs: 12000000,
    });
  };
  return {
    home,
    store,
    evidence,
    retained,
    jobs,
    source,
    scenes,
    index,
    finish,
    decoded: () => decoded,
  };
}

test("index waits for source dependencies then retains a pinned static selection and coverage", async () => {
  const f = await fixture(),
    take = f.finish();
  const pending = f.index.request({ recordingId: take.recordingId });
  expect(pending.published).toBeNull();
  expect(pending.jobId).toBeNull();
  expect(pending.dependencies.map((d) => d.artifact)).toEqual(["source", "scenes"]);
  await f.jobs.idle();
  const started = f.index.request({ recordingId: take.recordingId });
  expect(started, JSON.stringify(started)).toHaveProperty("jobId", expect.any(String));
  await f.jobs.idle();
  const ready = f.index.request({ recordingId: take.recordingId });
  expect(ready.state).toBe("ready");
  const identity = ready.published!.evidence;
  expect(identity.candidateCount).toBe(2);
  expect(identity.durationUs).toBe(12000000);
  const page = f.retained.page({ identity, limit: 1 });
  expect(page.entries[0]!.candidate.requestedSourceUs).toBe(0);
  expect(page.entries[0]!.frame.annotation!.trailPoints).toBe(0);
  const bytes = await readFile(page.entries[0]!.frame.file);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  f.store.edit(take.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 1000000, endUs: 2000000 }],
  });
  const again = f.index.request({ recordingId: take.recordingId, revisionId: "r0" });
  expect(again.published).toEqual(ready.published);
  expect(f.decoded()).toBe(2);
  const coverage = f.retained.coveragePage({ identity, limit: 200 });
  expect(coverage.coverage[0]!.playback.startUs).toBe(0);
  expect(coverage.coverage.at(-1)!.playback.endUs).toBe(12000000);
});

test("canceled index holds its slot until decoding settles while foreground work proceeds", async () => {
  let enter!: () => void, resume!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const f = await fixture(async (call) => {
    if (call === 1) {
      enter();
      await released;
    }
  });
  const first = f.finish(),
    second = f.finish();
  f.index.request({ recordingId: first.recordingId });
  await f.jobs.idle();
  f.index.request({ recordingId: second.recordingId });
  await f.jobs.idle();
  const running = f.index.request({ recordingId: first.recordingId });
  await entered;
  try {
    f.jobs.cancel(running.jobId!);
    expect(() => f.index.request({ recordingId: second.recordingId })).toThrow(
      "background frame slot",
    );
    expect(() => f.index.retry({ recordingId: first.recordingId })).toThrow(
      "background frame slot",
    );
    const foreground = f.jobs.submit({
      recordingId: second.recordingId,
      revisionId: "r0",
      artifact: "foreground",
      lane: "frame",
      input: "visible request",
    });
    await expect.poll(() => f.jobs.job(foreground.jobId).state).toBe("ready");
    expect(f.index.request({ recordingId: first.recordingId }).published).toBeNull();
  } finally {
    resume();
  }
  await f.jobs.idle();
  const retried = f.index.retry({ recordingId: first.recordingId });
  expect(retried.jobId).toBe(running.jobId);
  await f.jobs.idle();
  const ready = f.index.request({ recordingId: first.recordingId });
  expect(ready.state).toBe("ready");
  expect(ready.published!.generation).toBe(2);
  expect(
    f.retained
      .page({ identity: ready.published!.evidence })
      .entries.map((e) => e.candidate.requestedSourceUs),
  ).toEqual([0, 11999999]);
});

test("partial rendering is never published and only explicit retry rebuilds it", async () => {
  const f = await fixture(async (call) => {
    if (call === 2) throw new Error("decoder interrupted");
  });
  const take = f.finish();
  f.index.request({ recordingId: take.recordingId });
  await f.jobs.idle();
  const started = f.index.request({ recordingId: take.recordingId });
  const attempt = f.jobs.job(started.jobId!).attemptId;
  await f.jobs.idle();
  const failed = f.index.request({ recordingId: take.recordingId });
  expect(failed).toMatchObject({
    state: "failed",
    reason: "decoder interrupted",
    published: null,
    retryable: true,
  });
  await f.jobs.idle();
  expect(f.decoded()).toBe(2);
  expect(
    f.store.catalog
      .prepare("SELECT 1 FROM screenshot_index_generations WHERE generation=?")
      .get(attempt),
  ).toBeUndefined();
  f.index.retry({ recordingId: take.recordingId });
  await f.jobs.idle();
  const ready = f.index.request({ recordingId: take.recordingId });
  expect(ready.state).toBe("ready");
  expect(ready.published!.evidence.generation).not.toBe(attempt);
  expect(
    f.retained
      .page({ identity: ready.published!.evidence })
      .entries.map((e) => e.candidate.requestedSourceUs),
  ).toEqual([0, 11999999]);
});

test("index demand and retry do not implicitly retry a failed source dependency", async () => {
  let unavailable = true;
  const f = await fixture(undefined, () => {
    if (unavailable) throw new Error("source worker stopped");
  });
  const take = f.finish();
  f.index.request({ recordingId: take.recordingId });
  await f.jobs.idle();
  const failure = f.index.request({ recordingId: take.recordingId });
  expect(failure).toMatchObject({
    state: "failed",
    jobId: null,
    published: null,
    reason: "source worker stopped",
  });
  unavailable = false;
  expect(f.index.retry({ recordingId: take.recordingId })).toEqual(failure);
  await f.jobs.idle();
  expect(f.source.status(take.recordingId).state).toBe("failed");
  f.source.retry(take.recordingId);
  await f.jobs.idle();
  expect(f.index.request({ recordingId: take.recordingId }).jobId).not.toBeNull();
  await f.jobs.idle();
  expect(f.index.request({ recordingId: take.recordingId }).state).toBe("ready");
});
