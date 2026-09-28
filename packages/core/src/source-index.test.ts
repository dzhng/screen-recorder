import { RevisionStore } from "./library.js";
import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { SceneEvidenceStore, assetSceneOwner, sourceSceneDescriptor } from "./scene-evidence.js";
import { SelectedSourceSceneAnalysis, sourceScenePolicy } from "./source-scenes.js";
import { selectSource } from "./source-selection.js";
import { ScreenshotIndexStore, recordingIndexDomain } from "./screenshot-index.js";
import {
  sourceIndexDomain,
  type SourceIndexIdentity,
  type SourceIndexRecords,
} from "./source-index.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=",
  "base64",
);
async function fixture(emptyAt?: number, allEmpty = false) {
  const home = await mkdtemp("/tmp/source-index-"),
    path = join(home, "catalog.sqlite");
  let catalog = new Catalog(path),
    assets = new AssetStore(catalog, home),
    acquisitions = new AcquisitionStore(catalog);
  await assets.recover();
  const input = join(home, "video.mov");
  await writeFile(input, "original source");
  const asset = await assets.import(input, { kind: "import" }, async () => ({
    originUs: 1250000,
    streams: [
      {
        id: "v",
        kind: "video",
        codec: "fixture",
        decodable: true,
        startUs: 200000,
        endUs: 1000000,
        segments: [{ startUs: 200000, endUs: 1000000, empty: allEmpty }],
        width: 1,
        height: 1,
      },
    ],
  }));
  const selected = selectSource(assets, acquisitions, { assetId: asset.id, streamId: "v" });
  let scenes = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
  const sceneId = {
    owner: { kind: "asset" as const, assetId: asset.id },
    sourceId: asset.id,
    generation: "scene",
    policy: sourceScenePolicy,
  };
  const analysis = new SelectedSourceSceneAnalysis(
    {
      asset: { assetId: asset.id, streamId: "v", path: assets.path(asset.id), originUs: 1250000 },
      available: selected.track.available,
    },
    1000000,
    async (r) => ({
      assetId: asset.id,
      streamId: "v",
      originUs: 1250000,
      sourceWidth: 1,
      sourceHeight: 1,
      decodedSamples: 1,
      readerOpens: 1,
      samples: r.atSourceUs.map((at, i) =>
        allEmpty || at < 200000 || at === emptyAt
          ? {
              requestedSourceUs: at,
              status: "unavailable",
              reason: at === emptyAt ? "empty_edit" : "outside_support",
              continuousFromPrevious: false,
            }
          : {
              requestedSourceUs: at,
              status: "available",
              actualSourceUs: 200000,
              sample: {
                value: "1450000",
                timescale: 1000000,
                endValue: "2250000",
                endTimescale: 1000000,
              },
              width: 1,
              height: 1,
              rgbBase64: Buffer.alloc(3).toString("base64"),
              continuousFromPrevious: i > 1 && r.atSourceUs[i - 1] !== emptyAt,
            },
      ),
    }),
  );
  scenes.append(
    sceneId,
    sourceSceneDescriptor(selected),
    await analysis.analyze({ startUs: 0, endUs: 1000000 }, new AbortController().signal),
  );
  const identity: SourceIndexIdentity = {
    assetId: asset.id,
    streamId: "v",
    generation: "index",
    scenes: scenes.finish(sceneId),
    selectionPolicy: "source-selection",
    implementationId: "source-frame",
    maxLongEdge: 1600,
  };
  let index = new ScreenshotIndexStore(
    catalog,
    home,
    sourceIndexDomain(assets, acquisitions, scenes),
  );
  cleanup.push(async () => {
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  const candidate = {
    ordinal: 0,
    requestedSourceUs: 200000,
    support: { startUs: 200000, endUs: 1000000 },
    reasons: [],
  };
  async function append() {
    const output = index.outputPath(identity, 0);
    await writeFile(output, png);
    const frame: SourceIndexRecords["frame"] = {
      file: output,
      bytes: png.length,
      mediaType: "image/png",
      width: 1,
      height: 1,
      sourceWidth: 1,
      sourceHeight: 1,
      decodedSamples: 1,
      readerOpens: 1,
      assetId: asset.id,
      streamId: "v",
      atUs: 200000,
      requestedSourceUs: 200000,
      actualSourceUs: 200000,
      sample: {
        value: "1450000",
        timescale: 1000000,
        endValue: "2250000",
        endTimescale: 1000000,
        originUs: 1250000,
      },
      maxLongEdge: 1600,
      supportDigest: selected.supportDigest,
      implementationId: "source-frame",
    };
    index.appendCandidate(identity, candidate, frame);
    return frame;
  }
  return {
    home,
    input,
    identity,
    candidate,
    append,
    get index() {
      return index;
    },
    get catalog() {
      return catalog;
    },
    reopen() {
      catalog.close();
      catalog = new Catalog(path);
      assets = new AssetStore(catalog, home);
      acquisitions = new AcquisitionStore(catalog);
      scenes = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
      index = new ScreenshotIndexStore(
        catalog,
        home,
        sourceIndexDomain(assets, acquisitions, scenes),
      );
    },
  };
}
test("real source indexes retain images and explicit unsupported coverage without recording metadata", async () => {
  const f = await fixture();
  f.index.begin(f.identity);
  const frame = await f.append();
  f.index.appendCoverage(f.identity, {
    ordinal: null,
    state: "unavailable",
    basis: "support",
    source: { startUs: 0, endUs: 200000 },
  });
  f.index.appendCoverage(f.identity, {
    ordinal: 0,
    state: "available",
    equality: "sampled",
    source: { startUs: 200000, endUs: 1000000 },
  });
  const metadata = await f.index.finish(f.identity);
  expect(metadata).toMatchObject({
    assetId: f.identity.assetId,
    candidateCount: 1,
    coverageCount: 2,
  });
  expect(metadata).not.toHaveProperty("recordingId");
  expect(metadata).not.toHaveProperty("revisionId");
  f.reopen();
  expect(f.index.page({ identity: f.identity }).entries).toEqual([
    { candidate: f.candidate, frame, coverageCount: 1 },
  ]);
  const first = f.index.coveragePage({ identity: f.identity, limit: 1 });
  expect(first.coverage).toEqual([
    {
      sequence: 0,
      ordinal: null,
      state: "unavailable",
      basis: "support",
      source: { startUs: 0, endUs: 200000 },
    },
  ]);
  expect(
    f.index.coveragePage({ identity: f.identity, afterSequence: first.nextSequence!, limit: 1 })
      .coverage[0],
  ).toMatchObject({ ordinal: 0, state: "available" });
  const opened = f.index.openRead(f.identity, 0);
  await f.index.remove(f.identity);
  const bytes = Buffer.alloc(png.length);
  expect(opened.read(bytes, 0)).toBe(png.length);
  expect(bytes).toEqual(png);
  opened.release();
  expect(await readFile(f.input, "utf8")).toBe("original source");
  expect(
    f.catalog.catalog.prepare("SELECT name FROM sqlite_master WHERE name='recordings'").all(),
  ).toEqual([]);
});
test("source support cannot be mislabeled unavailable and incomplete generations cannot become readable", async () => {
  const f = await fixture();
  f.index.begin(f.identity);
  await f.append();
  expect(() =>
    f.index.appendCoverage(f.identity, {
      ordinal: null,
      state: "unavailable",
      basis: "support",
      source: { startUs: 0, endUs: 300000 },
    }),
  ).toThrow("overlaps");
  await expect(f.index.finish(f.identity)).rejects.toThrow("incomplete");
  expect(() => f.index.page({ identity: f.identity })).toThrow("complete");
  await f.index.reclaim({ kind: "asset", assetId: f.identity.assetId }, () => false);
  expect(f.catalog.catalog.prepare("SELECT * FROM screenshot_index_generations").all()).toEqual([]);
});

test("asset and recording indexes with equal IDs and attempts reclaim independently", async () => {
  const f = await fixture();
  f.index.begin(f.identity);
  const recordingStore = new RevisionStore(join(f.home, "catalog.sqlite"), {
    now: () => "fixture",
    newId: () => f.identity.assetId,
  });
  try {
    const recording = recordingStore.allocate().recording;
    recordingStore.registerSource(recording.recordingId, 1000000);
    const identity = {
      recordingId: recording.recordingId,
      sourceId: recording.sourceId,
      revisionId: "r0",
      generation: f.identity.generation,
      sourceIdentity: {
        owner: { kind: "recording" as const, recordingId: recording.recordingId },
        sourceId: recording.sourceId,
        generation: "source",
      },
      sceneIdentity: {
        recordingId: recording.recordingId,
        sourceId: recording.sourceId,
        generation: "scenes",
        policy: "nearest",
      },
      selectionPolicy: "recording",
      framePolicy: "recording",
      trailPolicy: "recording",
    };
    const retained = new ScreenshotIndexStore(
      recordingStore,
      f.home,
      recordingIndexDomain(recordingStore),
    );
    retained.begin(identity);
    const path = retained.outputPath(identity, 0);
    await writeFile(path, png);
    await f.index.reclaim({ kind: "asset", assetId: f.identity.assetId }, () => false);
    expect(await readFile(retained.outputPath(identity, 0))).toEqual(png);
    expect(
      f.catalog.catalog
        .prepare("SELECT ownerKind,ownerId,generation FROM screenshot_index_generations")
        .all(),
    ).toEqual([
      { ownerKind: "recording", ownerId: f.identity.assetId, generation: f.identity.generation },
    ]);
    await retained.remove(identity);
  } finally {
    recordingStore.close();
  }
});

test("a pinned unavailable observation is retained without claiming neighboring pixels are absent", async () => {
  const f = await fixture(400000);
  f.index.begin(f.identity);
  await f.append();
  f.index.appendCoverage(f.identity, {
    ordinal: null,
    state: "unavailable",
    basis: "support",
    source: { startUs: 0, endUs: 200000 },
  });
  f.index.appendCoverage(f.identity, {
    ordinal: 0,
    state: "available",
    equality: "unproven",
    source: { startUs: 200000, endUs: 400000 },
  });
  const coverage = {
    ordinal: null,
    state: "unavailable" as const,
    basis: "observation" as const,
    equality: "unproven" as const,
    source: { startUs: 400000, endUs: 600000 },
    observation: {
      requestedSourceUs: 400000,
      status: "unavailable" as const,
      reason: "empty_edit" as const,
      continuousFromPrevious: false as const,
    },
  };
  expect(() =>
    f.index.appendCoverage(f.identity, {
      ...coverage,
      observation: { ...coverage.observation, requestedSourceUs: 500000 },
    }),
  ).toThrow("pinned scene");
  f.index.appendCoverage(f.identity, coverage);
  f.index.appendCoverage(f.identity, {
    ordinal: 0,
    state: "available",
    equality: "unproven",
    source: { startUs: 600000, endUs: 1000000 },
  });
  await f.index.finish(f.identity);
  expect(f.index.coveragePage({ identity: f.identity }).coverage[2]).toEqual({
    ...coverage,
    sequence: 2,
  });
});

test("complete source coverage with no available pictures remains readable without inventing an image", async () => {
  const f = await fixture(undefined, true);
  f.index.begin(f.identity);
  const coverage = {
    ordinal: null,
    state: "unavailable" as const,
    basis: "support" as const,
    source: { startUs: 0, endUs: 1000000 },
  };
  f.index.appendCoverage(f.identity, coverage);
  const metadata = await f.index.finish(f.identity);
  expect(metadata).toMatchObject({
    candidateCount: 0,
    coverageCount: 1,
    bytes: 0,
    durationUs: 1000000,
  });
  f.reopen();
  expect(f.index.page({ identity: f.identity }).entries).toEqual([]);
  expect(f.index.coveragePage({ identity: f.identity }).coverage).toEqual([
    { ...coverage, sequence: 0 },
  ]);
  expect(() => f.index.openRead(f.identity, 0)).toThrow("does not exist");
});
