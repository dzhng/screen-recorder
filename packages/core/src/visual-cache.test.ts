import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { DerivedCache } from "./cache.js";
import { VisualObservationCache } from "./visual-cache.js";
import type { VisualSampler } from "./scenes.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const request = {
  source: "/immutable/take/video.mov",
  kept: { startUs: 0, endUs: 10 },
  atSourceUs: [4],
};
const signal = () => new AbortController().signal;
async function fixture(budget = 1024 ** 3) {
  const home = await mkdtemp("/tmp/visual-cache-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "",
    newId: () => "unused",
  });
  const cache = new DerivedCache(store, home, budget);
  await cache.reconcile();
  cleanup.push(async () => {
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  let calls = 0;
  const decode: VisualSampler = async (input) => {
    calls++;
    return {
      sourceWidth: 20,
      sourceHeight: 10,
      samples: input.atSourceUs.map((at) => {
        const actual = input.kept.endUs <= 5 ? 0 : 8;
        return {
          requestedSourceUs: at,
          actualSourceUs: actual,
          distanceUs: Math.abs(actual - at),
          width: 2,
          height: 1,
          rgbBase64: Buffer.alloc(6, actual).toString("base64"),
        };
      }),
    };
  };
  return { home, store, cache, decode, calls: () => calls };
}

test("observation reuse preserves exact native selection bounds across owner restart", async () => {
  const f = await fixture();
  const first = new VisualObservationCache(f.store, f.cache, f.decode);
  const original = await first.sample(request, signal());
  expect(original.samples[0]!.actualSourceUs).toBe(8);
  const reopened = new VisualObservationCache(f.store, f.cache, f.decode);
  expect(await reopened.sample(request, signal())).toEqual(original);
  expect(f.calls()).toBe(1);
  const past = await reopened.sample({ ...request, kept: { startUs: 0, endUs: 5 } }, signal());
  expect(past.samples[0]!.actualSourceUs).toBe(0);
  expect(f.calls()).toBe(2);
});

test("eviction removes lookup metadata and regeneration preserves selected pixels", async () => {
  const f = await fixture();
  const observations = new VisualObservationCache(f.store, f.cache, f.decode);
  const expected = await observations.sample(request, signal());
  const row = f.store.catalog.prepare("SELECT cacheId FROM visual_observation_cache").get() as {
    cacheId: string;
  };
  f.cache.remove(row.cacheId);
  expect(f.store.catalog.prepare("SELECT * FROM visual_observation_cache").all()).toEqual([]);
  expect(await observations.sample(request, signal())).toEqual(expected);
  expect(f.calls()).toBe(2);
});

test("cancellation and invalid native observations never become reusable results", async () => {
  const f = await fixture();
  const abort = new AbortController();
  const canceled = new VisualObservationCache(f.store, f.cache, async (input) => {
    const result = await f.decode(input, signal());
    abort.abort();
    return result;
  });
  await expect(canceled.sample(request, abort.signal)).rejects.toBeDefined();
  const invalid = new VisualObservationCache(f.store, f.cache, async (input) => {
    const result = await f.decode(input, signal());
    result.samples[0]!.rgbBase64 = "bad";
    return result;
  });
  await expect(invalid.sample(request, signal())).rejects.toMatchObject({
    code: "INVALID_EVIDENCE",
  });
  expect(f.store.catalog.prepare("SELECT * FROM visual_observation_cache").all()).toEqual([]);
  expect(f.cache.bytes).toBe(0);
});

test("concurrent misses retain one cache file and every caller receives the native pixels", async () => {
  const f = await fixture();
  const observations = new VisualObservationCache(f.store, f.cache, f.decode);
  const results = await Promise.all([
    observations.sample(request, signal()),
    observations.sample(request, signal()),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0]!.samples[0]!.rgbBase64).toBe(Buffer.alloc(6, 8).toString("base64"));
  expect(f.store.catalog.prepare("SELECT * FROM derived_cache").all()).toHaveLength(1);
  expect(await observations.sample(request, signal())).toEqual(results[0]);
  expect(f.calls()).toBe(2);
});

test("different sources never share observations and invalid batches never decode", async () => {
  const f = await fixture();
  const observations = new VisualObservationCache(f.store, f.cache, f.decode);
  await observations.sample(request, signal());
  await observations.sample({ ...request, source: "/another/take/video.mov" }, signal());
  expect(f.calls()).toBe(2);
  for (const times of [[], [4, 4], [4, 3], [10], Array.from({ length: 53 }, (_, i) => i)])
    await expect(
      observations.sample({ ...request, atSourceUs: times }, signal()),
    ).rejects.toMatchObject({ code: "INVALID_RANGE" });
  expect(f.calls()).toBe(2);
});

test("LRU eviction bounds lookup rows as well as raw bytes", async () => {
  const f = await fixture(200);
  const observations = new VisualObservationCache(f.store, f.cache, f.decode);
  for (let i = 0; i < 20; i++)
    await observations.sample({ ...request, source: `/immutable/take-${i}/video.mov` }, signal());
  expect(f.cache.bytes).toBeLessThanOrEqual(200);
  expect(f.store.catalog.prepare("SELECT * FROM visual_observation_cache").all()).toHaveLength(1);
  expect((await observations.sample(request, signal())).samples[0]!.actualSourceUs).toBe(8);
  expect(f.calls()).toBe(21);
});

test("a new database connection reuses persisted observations after cache reconciliation", async () => {
  const f = await fixture();
  const initial = await new VisualObservationCache(f.store, f.cache, f.decode).sample(
    request,
    signal(),
  );
  const reopened = new RevisionStore(join(f.home, "library.sqlite"), {
    now: () => "",
    newId: () => "unused",
  });
  try {
    const cache = new DerivedCache(reopened, f.home);
    await cache.reconcile();
    const observations = new VisualObservationCache(reopened, cache, async () => {
      throw new Error("Unexpected decode after restart");
    });
    expect(await observations.sample(request, signal())).toEqual(initial);
  } finally {
    reopened.close();
  }
});
