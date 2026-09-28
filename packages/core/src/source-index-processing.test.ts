import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { CatalogError } from "./catalog.js";
import { fixture, gate, png } from "./index-processing.fixture.js";
test("shared jobs publish source PNGs and exact gap coverage with bounded canonical pages", async () => {
  const f = await fixture();
  const { waiting, pending } = await f.prepare();
  expect(waiting.jobId).toBeNull();
  expect(pending.jobId).toBeTruthy();
  expect(f.jobs.job(pending.jobId!).lane).toBe("heavy");
  await f.jobs.idle();
  const result = f.index.getSource({ ...f.selection, limit: 1 });
  expect(result.state).toBe("ready");
  expect(result.page).toBeTruthy();
  const first = result.page!;
  expect(first.entries[0]!.candidate.requestedSourceUs).toBe(200000);
  expect(first.metadata.candidateCount).toBe(4);
  const continuation = f.index.getSource({ ...f.selection, cursor: first.nextCursor!, limit: 1 });
  expect(continuation.page!.entries[0]!.candidate.requestedSourceUs).toBe(399999);
  const ref = { ...f.selection, generation: first.metadata.generation };
  const coverage = f.index.coverageSource({ ...ref, limit: 100 }).coverage;
  expect(coverage.filter((r) => r.state === "unavailable").map((r) => r.source)).toEqual([
    { startUs: 0, endUs: 200000 },
    { startUs: 400000, endUs: 600000 },
    { startUs: 1000000, endUs: 1200000 },
  ]);
  expect(coverage.some((r) => r.state === "available" && r.equality === "sampled")).toBe(true);
  const frame = f.index.frameSource({ ...ref, ordinal: 0 });
  expect(frame.published.frame.assetId).toBe(f.selection.assetId);
  for (const row of f.catalog.catalog.prepare("SELECT id FROM derived_cache").all())
    f.cache.remove(row.id as string);
  const read = f.index.openReadSource({ ...ref, ordinal: 0 });
  try {
    const bytes = Buffer.alloc(read.bytes);
    read.read(bytes, 0);
    expect(bytes).toEqual(png);
  } finally {
    read.release();
  }
  expect(await readFile(f.path, "utf8")).toBe("immutable fixture media");
  expect(() =>
    f.index.getSource({ ...f.selection, streamId: "w", cursor: first.nextCursor! }),
  ).toThrow("another selection");
});
test("terminal child failure settles the parent and only explicit retry attempts the child again", async () => {
  const f = await fixture({
    beforeFrame: async (n) => {
      if (n === 1) throw new CatalogError("NATIVE_DECODE_FAILED", "decoder failed", {}, true);
    },
  });
  const { pending } = await f.prepare();
  await f.jobs.idle();
  expect(f.jobs.job(pending.jobId!).state).toBe("failed");
  expect(f.jobs.job(pending.jobId!).errorDetails).toMatchObject({
    dependency: { ...f.selection, atUs: 200000, artifact: "frame" },
  });
  expect(f.index.requestSource(f.selection).retryable).toBe(true);
  expect(f.calls).toBe(1);
  f.index.getSource(f.selection);
  expect(f.calls).toBe(1);
  f.index.retrySource(f.selection);
  await f.jobs.idle();
  expect(f.index.getSource(f.selection).state).toBe("ready");
  expect(f.calls).toBe(5);
});
test("all no-picture observations publish coverage without invented images", async () => {
  const f = await fixture({ empty: true, continuousSupport: true });
  await f.prepare();
  await f.jobs.idle();
  const result = f.index.getSource(f.selection);
  expect(result.state).toBe("ready");
  expect(result.page!.metadata.candidateCount).toBe(0);
  expect(result.page!.entries).toEqual([]);
  const coverage = f.index.coverageSource({
    ...f.selection,
    generation: result.page!.metadata.generation,
  }).coverage;
  expect(
    coverage.every(
      (r) => r.state === "unavailable" && r.basis === "observation" && r.equality === "unproven",
    ),
  ).toBe(true);
});
test("cancellation stops retention while the shared child keeps its own worker lifetime", async () => {
  const entered = gate(),
    release = gate();
  const f = await fixture({
    beforeFrame: async (n) => {
      if (n === 1) {
        entered.resolve();
        await release.promise;
      }
    },
  });
  try {
    const { pending } = await f.prepare();
    await entered.promise;
    f.jobs.cancel(pending.jobId!);
    release.resolve();
    await f.jobs.idle();
    expect(f.jobs.job(pending.jobId!).state).toBe("canceled");
    expect(f.index.requestSource(f.selection).published).toBeNull();
    f.index.retrySource(f.selection);
    await f.jobs.idle();
    expect(f.index.getSource(f.selection).state).toBe("ready");
  } finally {
    release.resolve();
  }
});
test("queued index pins its exact old scene generation across regeneration then stands alone", async () => {
  const barrier = gate();
  const f = await fixture({ barrier });
  f.scenes.prepareSource(f.selection);
  await f.jobs.idle();
  const old = f.scenes.sourceStatus(f.selection);
  const oldScene = old.published!.evidence;
  const other = { ...f.selection, streamId: "w" };
  f.scenes.prepareSource(other);
  await f.jobs.idle();
  const otherScene = f.scenes.sourceStatus(other).published!.evidence;
  f.jobs.submit({
    target: { kind: "asset", assetId: f.selection.assetId },
    artifact: "barrier",
    input: "barrier",
    lane: "heavy",
  });
  const queued = f.index.requestSource(f.selection);
  expect(f.jobs.job(queued.jobId!).state).toBe("queued");
  f.jobs.regenerate(old.jobId!, old.published!.generation);
  expect(f.index.requestSource(f.selection).jobId).toBeNull();
  expect(f.index.retainsSourceScenes(f.selection.assetId, oldScene.generation)).toBe(true);
  expect(f.index.retainsSourceScenes(f.selection.assetId, otherScene.generation)).toBe(false);
  await f.scenes.cleanup(new AbortController().signal);
  expect(f.records.sourcePage({ identity: oldScene }).metadata.generation).toBe(
    oldScene.generation,
  );
  barrier.resolve();
  await f.jobs.idle();
  const published = f.jobs.job(queued.jobId!);
  expect(published.state).toBe("ready");
  const ref = { ...f.selection, generation: published.attemptId };
  expect(f.index.publishedSource(ref).scenes.generation).toBe(oldScene.generation);
  await f.scenes.cleanup(new AbortController().signal);
  expect(() => f.records.sourcePage({ identity: oldScene })).toThrow();
  expect(f.index.frameSource({ ...ref, ordinal: 0 }).state).toBe("ready");
});

test("two source parents share the heavy lane and leave frame capacity for their children", async () => {
  const f = await fixture();
  const other = { ...f.selection, streamId: "w" };
  f.index.requestSource(f.selection);
  f.index.requestSource(other);
  await f.jobs.idle();
  f.index.requestSource(f.selection);
  f.index.requestSource(other);
  await f.jobs.idle();
  expect(f.index.getSource(f.selection).state).toBe("ready");
  expect(f.index.getSource(other).state).toBe("ready");
  expect(f.calls).toBe(8);
});

test("narrow acquisition support remains visible when every prepared scene grid point misses it", async () => {
  const f = await fixture();
  f.catalog.catalog.prepare("INSERT INTO acquisitions VALUES(?,?,?,?,?)").run(
    "mask",
    "fixture",
    f.home,
    "{}",
    JSON.stringify({
      id: "mask",
      bindings: [
        {
          assetId: f.selection.assetId,
          streamId: "v",
          available: [{ startUs: 300000, endUs: 350000 }],
        },
      ],
    }),
  );
  const selection = { ...f.selection, acquisitionId: "mask" };
  f.index.requestSource(selection);
  await f.jobs.idle();
  const pending = f.index.requestSource(selection);
  await f.jobs.idle();
  const result = f.index.getSource(selection);
  expect(result.state).toBe("ready");
  expect(
    result.page!.entries.map((e) => [e.candidate.requestedSourceUs, e.frame.actualSourceUs]),
  ).toEqual([
    [300000, 200000],
    [349999, 200000],
  ]);
  expect(f.assets.references(f.selection.assetId)).toContainEqual({
    kind: "job",
    id: pending.jobId,
  });
  expect(f.acquisitions.references("mask")).toContainEqual({ kind: "job", id: pending.jobId });
  expect(() =>
    f.index.frameSource({
      ...f.selection,
      generation: result.page!.metadata.generation,
      ordinal: 0,
    }),
  ).toThrow("another selection");
});

test("retrying an index with a failed scene dependency retries that dependency explicitly", async () => {
  let calls = 0;
  const f = await fixture({
    beforeScene: () => {
      if (++calls === 1)
        throw new CatalogError("NATIVE_DECODE_FAILED", "scene decoder failed", {}, true);
    },
  });
  f.index.requestSource(f.selection);
  await f.jobs.idle();
  expect(f.index.requestSource(f.selection).state).toBe("failed");
  expect(calls).toBe(1);
  f.index.retrySource(f.selection);
  await f.jobs.idle();
  f.index.requestSource(f.selection);
  await f.jobs.idle();
  expect(f.index.getSource(f.selection).state).toBe("ready");
  expect(calls).toBe(2);
});

test("explicit index retry recovers a canceled scene prerequisite without read-triggered retries", async () => {
  const barrier = gate();
  let sceneCalls = 0;
  const f = await fixture({
    barrier,
    beforeScene: () => {
      sceneCalls++;
    },
  });
  f.jobs.submit({
    target: { kind: "asset", assetId: f.selection.assetId },
    artifact: "barrier",
    input: "hold",
    lane: "heavy",
  });
  f.index.requestSource(f.selection);
  const scene = f.scenes.sourceStatus(f.selection);
  f.jobs.cancel(scene.jobId!);
  expect(f.index.requestSource(f.selection)).toMatchObject({
    state: "not_requested",
    reason: "canceled",
    retryable: true,
    jobId: null,
  });
  expect(sceneCalls).toBe(0);
  f.index.retrySource(f.selection);
  barrier.resolve();
  await f.jobs.idle();
  expect(sceneCalls).toBe(1);
  f.index.requestSource(f.selection);
  await f.jobs.idle();
  expect(f.index.getSource(f.selection).state).toBe("ready");
});

test("explicit index retry recovers its canceled frame child instead of repeating terminal failure", async () => {
  const entered = gate(),
    release = gate();
  const f = await fixture({
    beforeFrame: async (n) => {
      if (n === 1) {
        entered.resolve();
        await release.promise;
      }
    },
  });
  try {
    const { pending } = await f.prepare();
    await entered.promise;
    const child = f.frames.request({ ...f.selection, atUs: 200000 });
    f.jobs.cancel(child.jobId!);
    release.resolve();
    await f.jobs.idle();
    expect(f.jobs.job(pending.jobId!).state).toBe("failed");
    expect(f.calls).toBe(1);
    f.index.getSource(f.selection);
    expect(f.calls).toBe(1);
    f.index.retrySource(f.selection);
    await f.jobs.idle();
    expect(f.index.getSource(f.selection).state).toBe("ready");
    expect(f.calls).toBe(5);
  } finally {
    release.resolve();
  }
});
