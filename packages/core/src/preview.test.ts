import { afterEach, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SourceProcessing } from "./processing.js";
import { PreviewInspection, previewPolicy, type PreviewRenderer } from "./preview.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture(render: PreviewRenderer, prepare = true) {
  const home = await mkdtemp("/tmp/screenrec-preview-core-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const cache = new DerivedCache(store, home, 10000);
  await cache.reconcile();
  const evidence = new SourceEvidenceStore(store);
  let preview!: PreviewInspection, processing!: SourceProcessing;
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    execute: (execution) =>
      execution.job.artifact === "preview"
        ? preview.execute(execution)
        : processing.execute(execution),
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "fixture",
    sourceDurationUs: 6_000_000,
  });
  processing = new SourceProcessing(store, jobs, evidence, home, async (_directory, output) => {
    await writeFile(output, "");
    return {
      file: output,
      journal: "capture.journal.jsonl",
      header: { sessionID: take.sourceId, microphone: false, systemAudio: false },
      cursorSamples: 0,
      geometryRecords: 0,
      displaySpaces: 0,
      pauseEvents: 0,
      audioIntervals: 0,
      lastSequence: 0,
      incompleteTail: false,
      invalidAtSequence: null,
      finished: true,
      bytes: 0,
    };
  });
  if (prepare) {
    processing.prepare(take.recordingId);
    await jobs.idle();
  }
  preview = new PreviewInspection(store, jobs, cache, evidence, processing, home, render);
  cleanup.push(async () => {
    if (store.catalog.isOpen) {
      await jobs.close();
      store.close();
    }
    await rm(home, { recursive: true, force: true });
  });
  return { home, store, jobs, cache, preview, take, processing };
}

test("retains the requested edit while undo advances and regenerates that edit after eviction", async () => {
  let signalStarted!: () => void, releaseRender!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseRender = resolve;
  });
  const { store, jobs, cache, preview, take } = await fixture(async (request, signal) => {
    signalStarted();
    await released;
    signal.throwIfAborted();
    const bytes = Buffer.from(JSON.stringify(request.plan));
    await writeFile(request.output, bytes, { flag: "wx" });
    return {
      file: request.output,
      mediaType: "video/mp4",
      codec: "h264",
      durationUs: request.revision.durationUs,
      width: 2,
      height: 2,
      frameCount: 2,
      bytes: bytes.length,
    };
  });
  const original = store.revision(take.recordingId);
  const edited = store.edit(take.recordingId, {
    operation: "cut",
    requestId: randomUUID(),
    expectedRevisionId: original.id,
    ranges: [{ startUs: 2_000_000, endUs: 4_000_000 }],
  });
  const first = preview.request({ recordingId: take.recordingId });
  await started;
  store.edit(take.recordingId, {
    operation: "undo",
    requestId: randomUUID(),
    expectedRevisionId: edited.id,
  });
  releaseRender();
  await jobs.idle();
  const completed = preview.request({
    recordingId: take.recordingId,
    revisionId: first.revisionId,
  });
  expect(completed.state).toBe("ready");
  const result = completed.published!.preview;
  expect(result.revisionId).toBe(edited.id);
  expect(result.durationUs).toBe(4_000_000);
  const read = cache.acquire(result.cacheId)!;
  const bytes = Buffer.alloc(read.bytes);
  read.read(bytes, 0);
  read.release();
  expect(JSON.parse(bytes.toString())).toEqual([
    { source: { startUs: 0, endUs: 2_000_000 }, playback: { startUs: 0, endUs: 2_000_000 } },
    {
      source: { startUs: 4_000_000, endUs: 6_000_000 },
      playback: { startUs: 2_000_000, endUs: 4_000_000 },
    },
  ]);
  cache.remove(result.cacheId);
  const regenerated = preview.request({ recordingId: take.recordingId, revisionId: edited.id });
  expect(regenerated.published).toBeNull();
  await jobs.idle();
  const again = preview.request({ recordingId: take.recordingId, revisionId: edited.id });
  expect(again.published!.generation).toBeGreaterThan(completed.published!.generation);
  expect(again.published!.preview.durationUs).toBe(4_000_000);
  expect(store.revision(take.recordingId).id).not.toBe(edited.id);
});

test("rejects a copied movie whose actual bytes disagree without publishing it", async () => {
  let wrongBytes = true;
  const { preview, take, jobs, cache } = await fixture(async (request) => {
    await writeFile(request.output, "movie", { flag: "wx" });
    return {
      file: request.output,
      mediaType: "video/mp4",
      codec: "h264",
      durationUs: request.revision.durationUs,
      width: 2,
      height: 2,
      frameCount: 1,
      bytes: wrongBytes ? 4 : 5,
    };
  });
  const input = { recordingId: take.recordingId };
  preview.request(input);
  await jobs.idle();
  expect(preview.request(input).state).toBe("failed");
  expect(cache.bytes).toBe(0);
  wrongBytes = false;
  expect(preview.request(input).state).toBe("failed");
  expect(() => preview.retry(input)).toThrow("cannot be retried");
});

test("a transient renderer failure needs explicit retry and never publishes a partial copy", async () => {
  let failed = true;
  const { preview, take, jobs, cache } = await fixture(async (request) => {
    await writeFile(request.output, "movie", { flag: "wx" });
    if (failed) throw new Error("encoder interrupted");
    return {
      file: request.output,
      mediaType: "video/mp4",
      codec: "h264",
      durationUs: request.revision.durationUs,
      width: 2,
      height: 2,
      frameCount: 1,
      bytes: 5,
    };
  });
  const input = { recordingId: take.recordingId };
  preview.request(input);
  await jobs.idle();
  expect(preview.request(input).state).toBe("failed");
  expect(cache.bytes).toBe(0);
  failed = false;
  expect(preview.request(input).state).toBe("failed");
  preview.retry(input);
  await jobs.idle();
  expect(preview.request(input).published!.preview.bytes).toBe(5);
});

test("canceling during output creation drains the renderer and removes its reservation", async () => {
  let started!: () => void;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  const { preview, take, jobs, cache } = await fixture(async (request, signal) => {
    await writeFile(request.output, "partial", { flag: "wx" });
    started();
    await new Promise<void>((resolve) =>
      signal.addEventListener("abort", () => resolve(), { once: true }),
    );
    throw new Error("renderer drained");
  });
  const input = { recordingId: take.recordingId };
  const status = preview.request(input);
  await running;
  jobs.cancel(status.jobId!);
  await jobs.idle();
  expect(preview.request(input).published).toBeNull();
  expect([...cache.usageFiles(take.recordingId)]).toEqual([]);
});

test("a reopened catalog retains a ready movie and discards an interrupted reservation", async () => {
  const f = await fixture(async (request) => {
    await writeFile(request.output, "movie", { flag: "wx" });
    return {
      file: request.output,
      mediaType: "video/mp4",
      codec: "h264",
      durationUs: request.revision.durationUs,
      width: 2,
      height: 2,
      frameCount: 1,
      bytes: 5,
    };
  });
  const input = { recordingId: f.take.recordingId };
  f.preview.request(input);
  await f.jobs.idle();
  const prior = f.preview.request(input).published!;
  const interrupted = f.cache.reserve(f.take.recordingId);
  await writeFile(interrupted.path, "partial");
  await f.jobs.close();
  f.store.close();
  const store = new RevisionStore(join(f.home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const cache = new DerivedCache(store, f.home, 10000);
  await cache.reconcile();
  const evidence = new SourceEvidenceStore(store);
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    execute: async () => {
      throw new Error("unexpected work on retained read");
    },
  });
  try {
    const processing = new SourceProcessing(store, jobs, evidence, f.home, async () => {
      throw new Error("unexpected source export");
    });
    const preview = new PreviewInspection(
      store,
      jobs,
      cache,
      evidence,
      processing,
      f.home,
      async () => {
        throw new Error("unexpected render");
      },
    );
    expect(preview.request(input).published).toEqual(prior);
    expect([...cache.usageFiles(f.take.recordingId)]).toEqual([prior.preview.file]);
    const held = cache.acquire(prior.preview.cacheId)!;
    const bytes = Buffer.alloc(held.bytes);
    held.read(bytes, 0);
    held.release();
    expect(bytes.toString()).toBe("movie");
  } finally {
    await jobs.close();
    store.close();
  }
});

test("source readiness is reported before admitting a heavy preview", async () => {
  const { preview, take, jobs } = await fixture(async (request) => {
    await writeFile(request.output, "movie", { flag: "wx" });
    return {
      file: request.output,
      mediaType: "video/mp4",
      codec: "h264",
      durationUs: request.revision.durationUs,
      width: 2,
      height: 2,
      frameCount: 1,
      bytes: 5,
    };
  }, false);
  const input = { recordingId: take.recordingId };
  const waiting = preview.request(input);
  expect(waiting.jobId).toBeNull();
  expect(waiting.dependency?.artifact).toBe("source");
  expect(waiting.dependency?.jobId).toBeTruthy();
  await jobs.idle();
  const admitted = preview.request({ ...input, revisionId: waiting.revisionId });
  expect(admitted.jobId).not.toBeNull();
  expect(admitted.dependency).toBeNull();
  await jobs.idle();
  expect(preview.request(input).published!.preview.durationUs).toBe(6_000_000);
});

// This Mac captures 3120x1970; a rendition the size of the capture is what made an audition
// cost as long as the take itself.
const capture = { width: 3120, height: 1970 };
function renderAt(scaled: (bound: number | null) => { width: number; height: number }) {
  const asked: (number | null)[] = [];
  const render: PreviewRenderer = async (request) => {
    asked.push(request.maxLongEdge);
    await writeFile(request.output, "movie", { flag: "wx" });
    return {
      file: request.output,
      mediaType: "video/mp4",
      codec: "h264",
      durationUs: request.revision.durationUs,
      ...scaled(request.maxLongEdge),
      frameCount: 1,
      bytes: 5,
    } as const;
  };
  return { asked, render };
}
const bounded = (bound: number | null) => {
  if (bound === null) return capture;
  const scale = Math.min(1, bound / Math.max(capture.width, capture.height));
  const even = (edge: number) => Math.max(2, Math.round(edge * scale)) & ~1;
  return { width: even(capture.width), height: even(capture.height) };
};

test("an audition is a bounded rendition and an export keeps the capture's own size", async () => {
  const { asked, render } = renderAt(bounded);
  const { preview, take, jobs } = await fixture(render);
  const input = { recordingId: take.recordingId };
  preview.request(input);
  await jobs.idle();
  const audition = preview.request(input).published!.preview;
  expect(asked).toEqual([previewPolicy.maxLongEdge]);
  expect(audition.maxLongEdge).toBe(previewPolicy.maxLongEdge);
  expect([audition.width, audition.height]).toEqual([1600, 1010]);

  // The export's full rendition is its own pinned movie, never the audition's smaller one.
  const exported = { ...input, rendition: "source" } as const;
  expect(preview.request(exported).published).toBeNull();
  await jobs.idle();
  const full = preview.request(exported).published!.preview;
  expect(asked).toEqual([previewPolicy.maxLongEdge, null]);
  expect(full.maxLongEdge).toBeNull();
  expect([full.width, full.height]).toEqual([capture.width, capture.height]);
  expect(full.cacheId).not.toBe(audition.cacheId);
});

test("a movie that disagrees with the bound it was rendered for is never published", async () => {
  for (const [name, dimensions] of [
    ["ignored the bound", capture],
    ["odd short edge", { width: 1600, height: 1011 }],
  ] as const) {
    const { preview, take, jobs, cache } = await fixture(renderAt(() => dimensions).render);
    const input = { recordingId: take.recordingId };
    preview.request(input);
    await jobs.idle();
    const failed = preview.request(input);
    expect(failed.state, name).toBe("failed");
    expect(failed.reason, name).toContain(`${dimensions.width}x${dimensions.height}`);
    expect(cache.bytes, name).toBe(0);
  }
});
