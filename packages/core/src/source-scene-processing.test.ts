import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { JobQueue } from "./jobs.js";
import { SceneProcessing } from "./scene-processing.js";
import { SceneEvidenceStore, assetSceneOwner } from "./scene-evidence.js";
import type { SourceVisualSampler } from "./source-scenes.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
async function fixture(durationUs = 1000000) {
  const home = await mkdtemp("/tmp/source-scene-processing-");
  const path = join(home, "catalog.sqlite");
  let catalog = new Catalog(path),
    assets = new AssetStore(catalog, home),
    acquisitions = new AcquisitionStore(catalog);
  await assets.recover();
  const original = join(home, "external.mov");
  await writeFile(original, "two video streams");
  const asset = await assets.import(original, { kind: "import" }, async () => ({
    originUs: -250000,
    streams: ["v1", "v2", "a1"].map((id) => ({
      id,
      kind: id === "a1" ? "audio" : "video",
      codec: "fixture",
      decodable: true,
      startUs: 0,
      endUs: durationUs,
      segments: [{ startUs: 0, endUs: durationUs, empty: false }],
      width: 64,
      height: 48,
    })),
  }));
  const requests: Parameters<SourceVisualSampler>[0][] = [];
  const control = {
    failAt: 0,
    hold: false,
    deleting: false,
    implementationId: "presentation-native-v1",
    release: () => {},
  };
  const sample: SourceVisualSampler = async (request) => {
    requests.push(request);
    if (control.hold)
      await new Promise<void>((resolve) => {
        control.release = resolve;
      });
    if (control.failAt === requests.length) throw new Error("sampler failed");
    return {
      assetId: asset.id,
      streamId: request.asset.streamId,
      originUs: -250000,
      sourceWidth: 64,
      sourceHeight: 48,
      readerOpens: 1,
      decodedSamples: request.atSourceUs.length,
      samples: request.atSourceUs.map((at, i) => {
        if (!request.available.some((r) => r.startUs <= at && at < r.endUs))
          return {
            requestedSourceUs: at,
            status: "unavailable",
            reason: "outside_support",
            continuousFromPrevious: false,
          };
        const prior = request.atSourceUs[i - 1];
        return {
          requestedSourceUs: at,
          status: "available",
          actualSourceUs: at,
          sample: {
            value: String(at - 250000),
            timescale: 1000000,
            endValue: String(at - 250000 + 1),
            endTimescale: 1000000,
          },
          width: 1,
          height: 1,
          rgbBase64: Buffer.alloc(3, Math.floor(at / 200000) % 2 ? 255 : 0).toString("base64"),
          continuousFromPrevious:
            prior !== undefined &&
            request.available.some((r) => r.startUs <= prior && r.endUs > at),
        };
      }),
    };
  };
  let evidence: SceneEvidenceStore, jobs: JobQueue, processing: SceneProcessing;
  function start() {
    evidence = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
    jobs = new JobQueue({
      store: catalog,
      providers: { newId: randomUUID },
      targets: {
        pin(target) {
          if (target.kind !== "asset") throw new Error("expected asset");
          assets.get(target.assetId);
          return target;
        },
        isAvailable: () => !control.deleting,
        isDeleting: () => control.deleting,
        isCapturing: () => false,
      },
      execute: (execution) => processing.execute(execution),
    });
    processing = new SceneProcessing({
      jobs,
      evidence,
      asset: {
        assets,
        acquisitions,
        sample,
        get implementationId() {
          return control.implementationId;
        },
      },
    });
  }
  start();
  cleanup.push(async () => {
    control.release();
    await jobs.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  return {
    asset,
    selection: { assetId: asset.id, streamId: "v1" },
    requests,
    control,
    get catalog() {
      return catalog;
    },
    get assets() {
      return assets;
    },
    get acquisitions() {
      return acquisitions;
    },
    get evidence() {
      return evidence;
    },
    get jobs() {
      return jobs;
    },
    get processing() {
      return processing;
    },
    async reopen() {
      await jobs.close();
      catalog.close();
      catalog = new Catalog(path);
      assets = new AssetStore(catalog, home);
      acquisitions = new AcquisitionStore(catalog);
      start();
    },
    context(id: string, available: { startUs: number; endUs: number }[]) {
      catalog.catalog
        .prepare("INSERT INTO acquisitions VALUES(?,?,?,?)")
        .run(
          id,
          id,
          JSON.stringify({ kind: "import", path: "fixture", files: {} }),
          JSON.stringify({ id, bindings: [{ assetId: asset.id, streamId: "v1", available }] }),
        );
      return { assetId: asset.id, streamId: "v1", acquisitionId: id };
    },
  };
}
test("selected scene jobs retain exact source identity and survive restart without resampling", async () => {
  const f = await fixture();
  expect(f.processing.sourceStatus(f.selection).state).toBe("not_requested");
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const status = f.processing.sourceStatus(f.selection),
    metadata = status.published!.evidence;
  expect(f.assets.references(f.asset.id)).toEqual([{ kind: "job", id: status.jobId }]);
  expect(f.requests[0]!.asset).toEqual({
    assetId: f.asset.id,
    streamId: "v1",
    path: f.assets.path(f.asset.id),
    originUs: -250000,
  });
  expect(
    f.evidence.boundaryPage({ identity: metadata }).boundaries.map((b) => b.actualSourceUs),
  ).toEqual([200000, 400000, 600000, 800000]);
  await f.reopen();
  expect(f.processing.publishedSource(f.selection)).toEqual(status);
  expect(f.requests).toHaveLength(1);
  expect(f.evidence.sourcePage({ identity: metadata }).chunks[0]!.coverage[0]).toMatchObject({
    sample: { value: "-250000" },
  });
  expect(
    f.catalog.catalog.prepare("SELECT name FROM sqlite_master WHERE name='recordings'").all(),
  ).toEqual([]);
  expect(() => f.processing.prepareSource({ ...f.selection, streamId: "a1" })).toThrow(
    "video stream",
  );
});
test("acquisition support selects independent work, empty support stays unavailable, and admission references are atomic", async () => {
  const f = await fixture();
  const selected = f.context("masked", [
    { startUs: 200000, endUs: 400000 },
    { startUs: 600000, endUs: 1000000 },
  ]);
  const empty = f.context("empty", []);
  expect(f.processing.publishedSource(empty)).toMatchObject({
    state: "unavailable",
    reason: "no_video",
    jobId: null,
  });
  const retain = vi.spyOn(f.acquisitions, "retain").mockImplementationOnce(() => {
    throw new Error("reference refused");
  });
  expect(() => f.processing.prepareSource(selected)).toThrow("reference refused");
  expect(f.assets.references(f.asset.id)).toEqual([]);
  expect(f.catalog.catalog.prepare("SELECT jobId FROM jobs").all()).toEqual([]);
  retain.mockRestore();
  f.processing.prepareSource(selected);
  await expect.poll(() => f.processing.sourceStatus(selected).state).toBe("ready");
  const status = f.processing.sourceStatus(selected);
  expect(f.acquisitions.references("masked")).toEqual([{ kind: "job", id: status.jobId }]);
  expect(f.requests[0]!.available).toEqual([
    { startUs: 200000, endUs: 400000 },
    { startUs: 600000, endUs: 1000000 },
  ]);
  expect(
    f.evidence
      .boundaryPage({ identity: status.published!.evidence })
      .boundaries.map((b) => b.actualSourceUs),
  ).toEqual([800000]);
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  expect(f.processing.sourceStatus(f.selection).jobId).not.toBe(status.jobId);
});
test("partial failures are reclaimed, ordinary reads never retry, explicit retry publishes a new generation", async () => {
  const f = await fixture(12000000);
  f.control.failAt = 2;
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("failed");
  const failed = f.processing.sourceStatus(f.selection),
    old = f.jobs.job(failed.jobId!).attemptId;
  expect(f.catalog.catalog.prepare("SELECT * FROM scene_evidence_chunks").all()).toEqual([]);
  f.processing.publishedSource(f.selection);
  expect(f.requests).toHaveLength(2);
  f.control.failAt = 0;
  f.processing.retrySource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  expect(f.processing.sourceStatus(f.selection).published!.evidence.generation).not.toBe(old);
  expect(f.requests.map((r) => r.atSourceUs.length)).toEqual([51, 11, 51, 11]);
});
test("deletion waits for retained worker lifetime and canceled late results cannot publish", async () => {
  const f = await fixture();
  f.control.hold = true;
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.requests.length).toBe(1);
  const jobId = f.processing.sourceStatus(f.selection).jobId!;
  f.control.deleting = true;
  let settled = false;
  const drain = f.jobs.drainOwner({ kind: "asset", assetId: f.asset.id }).then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(settled).toBe(false);
  expect(f.assets.references(f.asset.id)).toEqual([{ kind: "job", id: jobId }]);
  f.control.release();
  await drain;
  expect(f.jobs.job(jobId).state).toBe("canceled");
  expect(f.processing.sourceStatus(f.selection).published).toBeNull();
  expect(f.catalog.catalog.prepare("SELECT * FROM scene_evidence_generations").all()).toEqual([]);
  f.control.deleting = false;
  f.control.hold = false;
  f.processing.publishedSource(f.selection);
  expect(f.requests).toHaveLength(1);
  expect(() => f.processing.retrySource(f.selection)).toThrow("cannot be retried");
});
test("ordinary cancellation remains explicit and retry starts fresh work", async () => {
  const f = await fixture();
  f.control.hold = true;
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.requests.length).toBe(1);
  const id = f.processing.sourceStatus(f.selection).jobId!;
  const drain = f.jobs.drainJob(id);
  f.control.release();
  await drain;
  f.processing.publishedSource(f.selection);
  expect(f.requests).toHaveLength(1);
  f.control.hold = false;
  f.processing.retrySource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  expect(f.requests).toHaveLength(2);
});
test("sampler execution identity separates work and cleanup preserves all published streams", async () => {
  const f = await fixture();
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const first = f.processing.sourceStatus(f.selection);
  f.control.implementationId = "presentation-native-v2";
  expect(f.processing.sourceStatus(f.selection).state).toBe("not_requested");
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const second = f.processing.sourceStatus(f.selection);
  expect(second.jobId).not.toBe(first.jobId);
  const other = { ...f.selection, streamId: "v2" };
  f.processing.prepareSource(other);
  await expect.poll(() => f.processing.sourceStatus(other).state).toBe("ready");
  await f.processing.cleanup(new AbortController().signal);
  expect(f.evidence.sourcePage({ identity: first.published!.evidence }).chunks).toHaveLength(1);
  expect(f.evidence.sourcePage({ identity: second.published!.evidence }).chunks).toHaveLength(1);
  expect(f.requests).toHaveLength(3);
});
