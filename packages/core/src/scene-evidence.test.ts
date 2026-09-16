import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { analyzeSceneRange, scenePolicy } from "./scenes.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
const stores: RevisionStore[] = [],
  roots: string[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
});
function fixture(durationUs = 20_000_000) {
  const root = mkdtempSync(join(tmpdir(), "scene-evidence-"));
  roots.push(root);
  const path = join(root, "catalog.sqlite");
  let id = 0;
  const providers = { now: () => "", newId: () => String(++id) };
  const store = new RevisionStore(path, providers);
  stores.push(store);
  const recording = store.allocate().recording;
  store.registerSource(recording.recordingId, durationUs);
  const identity = {
    recordingId: recording.recordingId,
    sourceId: recording.sourceId,
    generation: "attempt-1",
    policy: scenePolicy.id,
  };
  return { store, path, providers, identity, evidence: new SceneEvidenceStore(store) };
}
async function report(startUs: number, endUs: number, durationUs = 20_000_000, sparse = false) {
  const { lastSample: _lastSample, ...result } = await analyzeSceneRange(
    { source: "unused", kept: { startUs: 0, endUs: durationUs }, range: { startUs, endUs } },
    async (request) => ({
      sourceWidth: 1920,
      sourceHeight: 1080,
      samples: request.atSourceUs.map((requestedSourceUs) => {
        const actualSourceUs = sparse
          ? requestedSourceUs >= 50_000_000
            ? 100_000_000
            : 0
          : requestedSourceUs;
        return {
          requestedSourceUs,
          actualSourceUs,
          distanceUs: Math.abs(requestedSourceUs - actualSourceUs),
          width: 1,
          height: 1,
          rgbBase64: Buffer.alloc(3, actualSourceUs === 0 ? 0 : 255).toString("base64"),
        };
      }),
    }),
    new AbortController().signal,
  );
  return result;
}
test("only contiguous complete evidence becomes readable and survives reopening", async () => {
  const f = fixture(),
    first = await report(0, 10_000_000),
    second = await report(10_000_000, 20_000_000);
  f.evidence.append(f.identity, first);
  expect(() => f.evidence.page({ identity: f.identity })).toThrow("complete");
  expect(() => f.evidence.finish(f.identity, 20_000_000)).toThrow("coverage");
  f.evidence.append(f.identity, second);
  const metadata = f.evidence.finish(f.identity, 20_000_000);
  f.store.close();
  const reopened = new RevisionStore(f.path, f.providers);
  stores.push(reopened);
  const page = new SceneEvidenceStore(reopened).page({ identity: f.identity, limit: 1 });
  expect(page.metadata).toEqual(metadata);
  expect(page.chunks).toEqual([first]);
  expect(page.nextStartUs).toBe(0);
  const final = new SceneEvidenceStore(reopened).page({
    identity: f.identity,
    afterStartUs: page.nextStartUs!,
    limit: 1,
  });
  expect(final.chunks[0]?.coverage).toEqual(second.coverage);
  expect(final.nextStartUs).toBeNull();
  expect(final.chunks[0]?.comparisons[0]?.actualSourceUs).toBe(10_200_000);
});

test("sparse future comparisons are retained once while request coverage remains exact", async () => {
  const f = fixture(120_000_000),
    expectedCoverage = [];
  for (let start = 0; start < 120_000_000; start += 10_000_000) {
    const chunk = await report(start, start + 10_000_000, 120_000_000, true);
    expectedCoverage.push(...chunk.coverage);
    f.evidence.append(f.identity, chunk);
  }
  const metadata = f.evidence.finish(f.identity, 120_000_000);
  expect(metadata.comparisonCount).toBe(1);
  expect(metadata.boundaryCount).toBe(1);
  const chunks = f.evidence.page({ identity: f.identity }).chunks;
  expect(chunks.flatMap((c) => c.coverage)).toEqual(expectedCoverage);
  expect(chunks.flatMap((c) => c.comparisons)).toEqual([
    {
      previousActualSourceUs: 0,
      actualSourceUs: 100_000_000,
      changedPixelFraction: 1,
      changedCellFraction: 1,
      meanAbsoluteChannelDifference: 1,
      boundary: true,
    },
  ]);
  expect(chunks.flatMap((c) => c.boundaries)).toEqual([{ kind: "scene", atSourceUs: 100_000_000 }]);
  expect(chunks.find((c) => c.comparisons.length)!.range.endUs).toBe(50_000_000);
});

test("gaps, changed identities and dimensions cannot advance persisted coverage", async () => {
  const f = fixture(),
    first = await report(0, 10_000_000),
    second = await report(10_000_000, 20_000_000);
  expect(() => f.evidence.append(f.identity, second)).toThrow("contiguous");
  expect(() => f.evidence.append({ ...f.identity, sourceId: "wrong" }, first)).toThrow("identity");
  expect(() => f.evidence.append({ ...f.identity, policy: "wrong" }, first)).toThrow("identity");
  f.evidence.append(f.identity, first);
  expect(() => f.evidence.append(f.identity, first)).toThrow("contiguous");
  expect(() => f.evidence.append(f.identity, { ...second, sourceWidth: 1280 })).toThrow(
    "dimensions",
  );
  expect(() =>
    f.evidence.append(f.identity, { ...second, comparisons: [{ ...first.comparisons[0]! }] }),
  ).toThrow("backwards");
  f.evidence.append(f.identity, second);
  f.evidence.finish(f.identity, 20_000_000);
  expect(() => f.evidence.append(f.identity, second)).toThrow("contiguous");
  const retry = { ...f.identity, generation: "retry" };
  f.evidence.append(retry, first);
  expect(() => f.evidence.page({ identity: retry })).toThrow("complete");
  expect(() => f.evidence.page({ identity: { ...f.identity, policy: "other" } })).toThrow(
    "complete",
  );
  await f.evidence.reclaim(f.identity.recordingId, (g) => g === f.identity.generation);
  expect(() => f.evidence.finish(retry, 20_000_000)).toThrow("coverage");
  expect(f.evidence.page({ identity: f.identity }).chunks[0]).toEqual(first);
  f.evidence.append(retry, first); // Removed generations leave no orphan chunks.
  await f.evidence.remove(retry);
});

test("a thirty-minute scan pages exact ranges and cleanup hides evidence before yielding", async () => {
  const duration = 1_800_000_000,
    f = fixture(duration);
  for (let start = 0; start < duration; start += 10_000_000)
    f.evidence.append(f.identity, await report(start, start + 10_000_000, duration));
  f.evidence.finish(f.identity, duration);
  const first = f.evidence.page({ identity: f.identity });
  expect(first.chunks.map((c) => c.range.startUs)).toEqual(
    Array.from({ length: 100 }, (_, i) => i * 10_000_000),
  );
  expect(first.nextStartUs).toBe(990_000_000);
  const second = f.evidence.page({ identity: f.identity, afterStartUs: first.nextStartUs! });
  expect(second.chunks.map((c) => c.range.startUs)).toEqual(
    Array.from({ length: 80 }, (_, i) => (i + 100) * 10_000_000),
  );
  expect(second.nextStartUs).toBeNull();
  expect(() => f.evidence.page({ identity: f.identity, limit: 101 })).toThrow("limit");
  const removing = f.evidence.remove(f.identity);
  expect(() => f.evidence.page({ identity: f.identity })).toThrow("complete");
  expect(() => f.evidence.finish(f.identity, duration)).toThrow("coverage");
  await removing;
  f.evidence.append(f.identity, await report(0, 10_000_000, duration));
});

test("restart leaves partial attempts unreadable and separates source generations", async () => {
  const f = fixture(10_000_000),
    chunk = await report(0, 10_000_000, 10_000_000);
  f.evidence.append(f.identity, chunk);
  f.store.close();
  const reopened = new RevisionStore(f.path, f.providers);
  stores.push(reopened);
  const evidence = new SceneEvidenceStore(reopened);
  expect(() => evidence.page({ identity: f.identity })).toThrow("complete");
  evidence.finish(f.identity, 10_000_000);
  const recording = reopened.allocate().recording;
  reopened.registerSource(recording.recordingId, 10_000_000);
  const sourceIdentity = {
    ...f.identity,
    recordingId: recording.recordingId,
    sourceId: recording.sourceId,
  };
  evidence.append(sourceIdentity, chunk);
  evidence.finish(sourceIdentity, 10_000_000);
  await evidence.remove(f.identity);
  expect(evidence.page({ identity: sourceIdentity }).chunks).toEqual([chunk]);
  const controller = new AbortController();
  controller.abort();
  await expect(
    evidence.reclaim(recording.recordingId, () => false, controller.signal),
  ).rejects.toThrow();
  expect(evidence.page({ identity: sourceIdentity }).chunks).toEqual([chunk]);
});
