import { afterEach, expect, test } from "vitest";
import type { CompiledFrame } from "@screenrec/composition";
import { validateProjectFrameReceipt } from "./frame-inspection.js";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { ProjectStore } from "./projects.js";
import { SceneEvidenceStore, assetSceneOwner, sourceSceneDescriptor } from "./scene-evidence.js";
import { ScreenshotIndexStore, encodeIndexRecord } from "./screenshot-index.js";
import { projectComposition } from "./project-window.js";
import {
  projectIndexPlan,
  projectIndexDomain,
  type ProjectIndexIdentity,
  type ProjectIndexRecords,
} from "./project-index.js";
import { selectSource } from "./source-selection.js";
import { SelectedSourceSceneAnalysis, sourceScenePolicy } from "./source-scenes.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture() {
  const home = await mkdtemp("/tmp/project-index-"),
    path = join(home, "catalog.sqlite");
  let catalog = new Catalog(path),
    assets = new AssetStore(catalog, home),
    acquisitions = new AcquisitionStore(catalog);
  await assets.recover();
  let projects = new ProjectStore(catalog, assets, acquisitions);
  let scenes = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
  const created = projects.create({
    requestId: "create",
    canvas: {
      width: 2,
      height: 2,
      fps: { numerator: 10, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = created.project.projectId;
  let index = new ScreenshotIndexStore(
    catalog,
    home,
    projectIndexDomain(projects, assets, acquisitions, scenes, "picture-test"),
  );
  const identity = (generation = "index"): ProjectIndexIdentity => ({
    ...projectIndexPlan(projectComposition(projects, assets, { projectId }), {}, "picture-test")
      .identity,
    generation,
    scenes: [],
  });
  cleanup.push(async () => {
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  return {
    home,
    path,
    projectId,
    identity,
    get catalog() {
      return catalog;
    },
    get assets() {
      return assets;
    },
    get acquisitions() {
      return acquisitions;
    },
    get projects() {
      return projects;
    },
    get scenes() {
      return scenes;
    },
    get index() {
      return index;
    },
    reopen(renderer = "picture-test") {
      catalog.close();
      catalog = new Catalog(path);
      assets = new AssetStore(catalog, home);
      acquisitions = new AcquisitionStore(catalog);
      projects = new ProjectStore(catalog, assets, acquisitions);
      scenes = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
      index = new ScreenshotIndexStore(
        catalog,
        home,
        projectIndexDomain(projects, assets, acquisitions, scenes, renderer),
      );
    },
  };
}
test("true-empty project publishes an empty retained generation and validates its real tap", async () => {
  const f = await fixture(),
    identity = f.identity();
  f.index.begin(identity);
  expect(await f.index.finish(identity)).toMatchObject({
    durationUs: 0,
    candidateCount: 0,
    coverageCount: 0,
    bytes: 0,
  });
  expect(f.index.page({ identity })).toMatchObject({ entries: [], nextOrdinal: null });
  expect(() =>
    f.index.begin({
      ...identity,
      generation: "bad-target",
      tap: { target: { kind: "track", id: "missing" }, point: { kind: "processed" } },
    }),
  ).toThrow("Unknown processing tap target");
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=",
  "base64",
);
function addSilence(f: Awaited<ReturnType<typeof fixture>>) {
  f.projects.apply(f.projectId, {
    requestId: "silence",
    expectedRevisionId: f.projects.get(f.projectId).currentRevisionId,
    operations: [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      {
        operation: "place",
        clip: {
          trackId: { label: "audio" },
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
  });
}
// Frozen PNGs and synthetic native receipts exercise ownership only, not native pixel quality.
async function append(
  f: Awaited<ReturnType<typeof fixture>>,
  identity: ProjectIndexIdentity,
  ordinal: number,
  atUs: number,
  mutate?: (frame: ProjectIndexRecords["frame"]) => void,
) {
  const composition = projectComposition(f.projects, f.assets, identity);
  const candidate = { ...composition.compiler.frameBoundary(atUs).after!, ordinal, reasons: [] };
  const plan = composition.window(
    { range: { startUs: atUs, endUs: atUs + 1 }, tap: identity.tap },
    identity.implementationId,
    "video",
  );
  const file = f.index.outputPath(identity, ordinal);
  await writeFile(file, png);
  const compiled: CompiledFrame = plan.window.frames().next().value!;
  const raw = {
    projectId: identity.projectId,
    revisionId: identity.revisionId,
    tap: identity.tap,
    implementationId: identity.implementationId,
    maxLongEdge: identity.maxLongEdge,
    file,
    bytes: png.length,
    mediaType: "image/png" as const,
    profile: "h264-rec709" as const,
    frame: compiled,
    width: 1,
    height: 1,
    sourceWidth: 2,
    sourceHeight: 2,
    decodedSamples: compiled.layers.length,
    readerOpens: compiled.layers.length,
    atUs,
    pictures: compiled.layers.map((layer) =>
      layer.availability === "available"
        ? {
            status: "available",
            clipId: layer.clipId,
            assetId: layer.assetId,
            streamId: layer.streamId,
            requestedSourceUs: layer.sourceUs,
            actualSourceUs: layer.sourceUs,
            sample: { value: String(layer.sourceUs), timescale: 1000000, originUs: 0 },
          }
        : {
            status: "unavailable",
            clipId: layer.clipId,
            assetId: layer.assetId,
            streamId: layer.streamId,
            requestedSourceUs: layer.sourceUs,
            reason: "source-unavailable",
          },
    ),
  };
  const frame: ProjectIndexRecords["frame"] = {
    ...raw,
    ...validateProjectFrameReceipt(raw, plan, file, identity.maxLongEdge),
  };
  mutate?.(frame);
  f.index.appendCandidate(identity, candidate, frame);
  return { candidate, frame };
}
function coverage(f: Awaited<ReturnType<typeof fixture>>, identity: ProjectIndexIdentity) {
  f.index.appendCoverage(identity, {
    project: { startUs: 0, endUs: 100000 },
    ordinal: 0,
    equality: "sampled",
  });
  f.index.appendCoverage(identity, {
    project: { startUs: 100000, endUs: 900000 },
    ordinal: null,
    equality: "unproven",
  });
  f.index.appendCoverage(identity, {
    project: { startUs: 900000, endUs: 1000000 },
    ordinal: 1,
    equality: "sampled",
  });
}
test("audio-only project retains background pictures and exact sampled visibility around unproven time", async () => {
  const f = await fixture();
  addSilence(f);
  const identity = f.identity();
  f.index.begin(identity);
  const first = await append(f, identity, 0, 0);
  await append(f, identity, 1, 900000);
  expect(first.frame).toMatchObject({
    pictures: [],
    frame: { visibleRange: { startUs: 0, endUs: 100000 } },
  });
  expect(first.frame.frame).not.toHaveProperty("visual");
  expect(first.candidate.visibleRange).toEqual({ startUs: 0, endUs: 100000 });
  expect(() =>
    f.index.appendCoverage(identity, {
      project: { startUs: 0, endUs: 100001 },
      ordinal: 0,
      equality: "sampled",
    }),
  ).toThrow("complete visibility");
  coverage(f, identity);
  const metadata = await f.index.finish(identity);
  expect(metadata).toMatchObject({ candidateCount: 2, coverageCount: 3, durationUs: 1000000 });
  expect(f.index.coveragePage({ identity }).coverage).toEqual([
    { sequence: 0, project: { startUs: 0, endUs: 100000 }, ordinal: 0, equality: "sampled" },
    {
      sequence: 1,
      project: { startUs: 100000, endUs: 900000 },
      ordinal: null,
      equality: "unproven",
    },
    { sequence: 2, project: { startUs: 900000, endUs: 1000000 }, ordinal: 1, equality: "sampled" },
  ]);
});
test("retained entry reads reject another tap and deletion fences readers without blocking reclaim", async () => {
  const f = await fixture();
  addSilence(f);
  const identity = f.identity();
  f.index.begin(identity);
  const first = await append(f, identity, 0, 0);
  await append(f, identity, 1, 900000);
  coverage(f, identity);
  await f.index.finish(identity);
  const different = {
    ...identity,
    tap: { target: { kind: "output" as const }, point: { kind: "dry" as const } },
  };
  expect(() => f.index.readEntry(different, 0)).toThrow("identity");
  f.projects.markDeleting(f.projectId);
  expect(() => f.index.readEntry(identity, 0)).toThrow("delet");
  expect(() => f.index.openRead(identity, 0)).toThrow("delet");
  await f.index.reclaim({ kind: "project", projectId: f.projectId }, () => false);
  await expect(readFile(first.frame.file)).rejects.toMatchObject({ code: "ENOENT" });
});
test("candidate admission refuses duplicate frames, mismatched requests and incomplete sampled coverage", async () => {
  const f = await fixture();
  addSilence(f);
  const identity = f.identity();
  f.index.begin(identity);
  await append(f, identity, 0, 0);
  await expect(append(f, identity, 1, 0)).rejects.toThrow("distinct globally phased");
  await expect(
    append(f, identity, 1, 900000, (frame) => {
      frame.tap = { target: { kind: "output" }, point: { kind: "dry" } };
    }),
  ).rejects.toThrow("another request");
  await expect(
    append(f, identity, 1, 900000, (frame) => {
      frame.frame.visibleRange.endUs++;
    }),
  ).rejects.toThrow("pinned frame");
  await expect(
    append(f, identity, 1, 900000, (frame) => {
      frame.width = Number.NaN;
    }),
  ).rejects.toThrow("Malformed picture receipt");
  await append(f, identity, 1, 900000);
  expect(() =>
    f.index.appendCoverage(identity, {
      project: { startUs: 0, endUs: 1 },
      ordinal: 0,
      equality: "sampled",
    }),
  ).toThrow("complete visibility");
  f.index.appendCoverage(identity, {
    project: { startUs: 0, endUs: 100000 },
    ordinal: 0,
    equality: "sampled",
  });
  expect(() =>
    f.index.appendCoverage(identity, {
      project: { startUs: 0, endUs: 100000 },
      ordinal: 0,
      equality: "sampled",
    }),
  ).toThrow("progress contiguously");
  await expect(f.index.finish(identity)).rejects.toThrow("incomplete");
  f.index.appendCoverage(identity, {
    project: { startUs: 100000, endUs: 500000 },
    ordinal: null,
    equality: "unproven",
  });
  f.index.appendCoverage(identity, {
    project: { startUs: 500000, endUs: 900000 },
    ordinal: null,
    equality: "unproven",
  });
  f.index.appendCoverage(identity, {
    project: { startUs: 900000, endUs: 1000000 },
    ordinal: 1,
    equality: "sampled",
  });
  expect(await f.index.finish(identity)).toMatchObject({ candidateCount: 2, coverageCount: 3 });
});
test("retained images survive restart, head edits and renderer replacement; reclaimed files have held-reader lifetime", async () => {
  const f = await fixture();
  addSilence(f);
  const identity = f.identity();
  f.index.begin(identity);
  const first = await append(f, identity, 0, 0);
  await append(f, identity, 1, 900000);
  coverage(f, identity);
  await f.index.finish(identity);
  f.projects.apply(f.projectId, {
    requestId: "resize",
    expectedRevisionId: identity.revisionId,
    operations: [{ operation: "canvas.set", canvas: { width: 4 } }],
  });
  f.reopen("replacement-renderer");
  expect(f.index.page({ identity, limit: 1 })).toMatchObject({
    metadata: { revisionId: identity.revisionId },
    entries: [{ frame: { sourceWidth: 2 } }],
    nextOrdinal: 0,
  });
  expect(
    f.index.page({ identity, afterOrdinal: 0, limit: 1 }).entries[0]!.candidate.sampleAtUs,
  ).toBe(900000);
  const lease = f.index.openRead(identity, 0),
    received = Buffer.alloc(png.length);
  try {
    await f.index.reclaim({ kind: "project", projectId: f.projectId }, () => false);
    await expect(readFile(first.frame.file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(lease.read(received, 0)).toBe(png.length);
    expect(received).toEqual(png);
  } finally {
    lease.release();
  }
  expect(() => lease.read(received, 0)).toThrow("released");
  expect(() => f.index.page({ identity })).toThrow("identity");
});

test("retained row preflight reports size overflow before admission and preserves JSON error semantics", async () => {
  const f = await fixture();
  expect(() => f.index.begin({ ...f.identity(), generation: "x".repeat(262144) })).toThrowError(
    expect.objectContaining({
      code: "LIMIT_EXCEEDED",
      details: expect.objectContaining({ limitKind: "index-record-bytes", maximum: 262144 }),
    }),
  );
  expect(
    f.catalog.catalog.prepare("SELECT COUNT(*) AS count FROM screenshot_index_generations").get(),
  ).toEqual({ count: 0 });
  const candidate = {
    ordinal: 0,
    index: 0,
    sampleAtUs: 0,
    visibleRange: { startUs: 0, endUs: 100000 },
    reasons: [
      { kind: "clip", clipId: "long".repeat(70000), edge: "start", projectAtUs: 0, side: "after" },
    ],
  };
  expect(() => encodeIndexRecord(candidate)).toThrowError(
    expect.objectContaining({ code: "LIMIT_EXCEEDED" }),
  );
  const circular: { self?: unknown } = {};
  circular.self = circular;
  expect(() => encodeIndexRecord(circular)).toThrow(TypeError);
  expect(() => encodeIndexRecord({ value: 1n })).toThrow(TypeError);
  expect(encodeIndexRecord({ value: Number.NaN })).toBe('{"value":null}');
});

async function addVideo(f: Awaited<ReturnType<typeof fixture>>, available = true) {
  const input = join(f.home, "source.mov");
  await writeFile(input, "frozen video source");
  const asset = await f.assets.import(input, { kind: "import" }, async () => ({
    originUs: 0,
    streams: [
      {
        id: "v",
        kind: "video",
        codec: "fixture",
        decodable: true,
        startUs: 0,
        endUs: 1000000,
        segments: [{ startUs: 0, endUs: 1000000, empty: !available }],
        width: 2,
        height: 2,
        orientedWidth: 2,
        orientedHeight: 2,
      },
    ],
  }));
  f.projects.apply(f.projectId, {
    requestId: "video",
    expectedRevisionId: f.projects.get(f.projectId).currentRevisionId,
    operations: [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "video" },
      {
        operation: "place",
        clip: {
          trackId: { label: "video" },
          assetId: asset.id,
          streamId: "v",
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
  });
  return {
    asset,
    input,
    selection: selectSource(f.assets, f.acquisitions, { assetId: asset.id, streamId: "v" }),
  };
}
async function publishScenes(
  f: Awaited<ReturnType<typeof fixture>>,
  video: Awaited<ReturnType<typeof addVideo>>,
  generation: string,
) {
  const analysis = new SelectedSourceSceneAnalysis(
    {
      asset: {
        assetId: video.asset.id,
        streamId: "v",
        path: f.assets.path(video.asset.id),
        originUs: 0,
      },
      available: video.selection.track.available,
    },
    1000000,
    async (request) => ({
      assetId: video.asset.id,
      streamId: "v",
      originUs: 0,
      sourceWidth: 2,
      sourceHeight: 2,
      decodedSamples: 1,
      readerOpens: 1,
      samples: request.atSourceUs.map((at, i) => ({
        requestedSourceUs: at,
        status: "available",
        actualSourceUs: 0,
        sample: { value: "0", timescale: 1000000, endValue: "1000000", endTimescale: 1000000 },
        width: 1,
        height: 1,
        rgbBase64: Buffer.alloc(3).toString("base64"),
        continuousFromPrevious: i > 0,
      })),
    }),
  );
  const identity = {
    owner: { kind: "asset" as const, assetId: video.asset.id },
    sourceId: video.asset.id,
    generation,
    policy: sourceScenePolicy,
  };
  f.scenes.append(
    identity,
    sourceSceneDescriptor(video.selection),
    await analysis.analyze({ startUs: 0, endUs: 1000000 }, new AbortController().signal),
  );
  return f.scenes.finish(identity);
}
test("pinned source scene generations validate at admission while published PNGs survive replacement and reclamation", async () => {
  const f = await fixture(),
    video = await addVideo(f);
  const oldScenes = await publishScenes(f, video, "scene-old");
  const identity = { ...f.identity(), scenes: [oldScenes] };
  expect(() =>
    f.index.begin({
      ...identity,
      generation: "duplicate-dependency",
      scenes: [oldScenes, oldScenes],
    }),
  ).toThrow("duplicated");
  expect(() =>
    f.index.begin({
      ...identity,
      generation: "wrong-receipt",
      scenes: [{ ...oldScenes, comparisonCount: oldScenes.comparisonCount + 1 }],
    }),
  ).toThrow("pinned source");
  f.index.begin(identity);
  await expect(
    append(f, identity, 0, 0, (frame) => {
      const picture = frame.pictures[0]!;
      if (picture.status === "available") picture.actualSourceUs = 1;
    }),
  ).rejects.toThrow("source clock");
  const first = await append(f, identity, 0, 0);
  await append(f, identity, 1, 900000);
  coverage(f, identity);
  await f.index.finish(identity);
  const nextScenes = await publishScenes(f, video, "scene-next");
  expect(() => f.index.readEntry({ ...identity, scenes: [nextScenes] }, 0)).toThrow("identity");
  await f.scenes.remove(oldScenes);
  await rm(video.input);
  f.reopen("new-picture-implementation");
  expect(f.index.readEntry(identity, 0).frame).toEqual(first.frame);
  expect(await readFile(first.frame.file)).toEqual(png);
});
test("unavailable source support stays separate from valid sampled composite background", async () => {
  const f = await fixture();
  await addVideo(f, false);
  const identity = f.identity();
  f.index.begin(identity);
  const first = await append(f, identity, 0, 0);
  await append(f, identity, 1, 900000);
  expect(first.frame.pictures).toMatchObject([{ status: "unavailable" }]);
  coverage(f, identity);
  await f.index.finish(identity);
  expect(f.index.coveragePage({ identity }).coverage[0]).toMatchObject({
    equality: "sampled",
    ordinal: 0,
  });
});
test("publication rejects a delivered picture whose visibility was left entirely unproven", async () => {
  const f = await fixture();
  addSilence(f);
  const identity = f.identity();
  f.index.begin(identity);
  await append(f, identity, 0, 0);
  f.index.appendCoverage(identity, {
    project: { startUs: 0, endUs: 1000000 },
    ordinal: null,
    equality: "unproven",
  });
  await expect(f.index.finish(identity)).rejects.toThrow("sampled coverage");
});
