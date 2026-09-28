import { afterEach, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Catalog, CatalogError } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { ProjectStore } from "./projects.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { ProjectPreviewInspection, type ProjectMovieRenderer } from "./project-preview.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const renderer: ProjectMovieRenderer = {
  implementationId: "fixture-movie-v1",
  async render({ window, assets, output, settings }, signal) {
    signal.throwIfAborted();
    const frames = [...window.frames()];
    const bytes = Buffer.from(JSON.stringify({ manifest: window.manifest, frames, assets }));
    await writeFile(output, bytes, { flag: "wx" });
    return {
      file: output,
      settings,
      encodedVideo: {
        profile: settings.video.profile,
        level: settings.video.level === "auto" ? "3.1" : settings.video.level,
      },
      mediaType: "video/mp4",
      codec: "h264",
      durationUs: window.manifest.range.endUs - window.manifest.range.startUs,
      width: window.manifest.canvas.width,
      height: window.manifest.canvas.height,
      frameCount: frames.length,
      bytes: bytes.length,
    };
  },
};
async function fixture(render = renderer) {
  const home = await mkdtemp("/tmp/screenrec-project-preview-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const projects = new ProjectStore(catalog, assets);
  const cache = new DerivedCache(catalog, home, (owner) => {
    if (owner.kind !== "project") throw new CatalogError("INVALID_TARGET", "Expected project");
    projects.get(owner.projectId);
  });
  await cache.reconcile();
  let preview!: ProjectPreviewInspection;
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin(target) {
        if (target.kind !== "project") throw new Error("Expected project");
        return { ...target, revisionId: projects.revision(target.projectId, target.revisionId).id };
      },
      isAvailable: (target) => target.kind === "project" && !projects.isDeleting(target.projectId),
      isDeleting: (target) => target.kind === "project" && projects.isDeleting(target.projectId),
      isCapturing: () => false,
    },
    execute: (execution) => preview.execute(execution),
  });
  preview = new ProjectPreviewInspection(projects, assets, jobs, cache, render);
  cleanup.push(async () => {
    await jobs.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  const input = join(home, "source.mov");
  await writeFile(input, "source identity");
  const asset = await assets.import(input, { kind: "import" }, async () => ({
    originUs: 9000,
    streams: [
      {
        id: "track:7",
        kind: "video",
        codec: "h264",
        decodable: true,
        startUs: 0,
        endUs: 1000000,
        segments: [{ startUs: 0, endUs: 1000000, empty: false }],
        width: 160,
        height: 96,
        orientedWidth: 160,
        orientedHeight: 96,
      },
    ],
  }));
  const created = projects.create({
    requestId: "create",
    canvas: {
      width: 160,
      height: 96,
      fps: { numerator: 20, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = created.project.projectId;
  const placed = projects.apply(projectId, {
    requestId: "place",
    expectedRevisionId: created.revision.id,
    operations: [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "track" },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: { label: "track" },
          assetId: asset.id,
          streamId: "track:7",
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
  });
  return {
    home,
    catalog,
    projects,
    assets,
    asset,
    cache,
    jobs,
    preview,
    projectId,
    placed,
    replaceRenderer(next: ProjectMovieRenderer) {
      preview = new ProjectPreviewInspection(projects, assets, jobs, cache, next);
      return preview;
    },
  };
}
test("pins an old revision through edits, repeated admission and cache eviction", async () => {
  const started = gate(),
    release = gate();
  const f = await fixture({
    ...renderer,
    async render(request, signal) {
      started.resolve();
      await release.promise;
      return renderer.render(request, signal);
    },
  });
  cleanup.push(async () => release.resolve());
  const request = { projectId: f.projectId, range: { startUs: 50001, endUs: 200000 } };
  const first = f.preview.request(request);
  await started.promise;
  f.projects.apply(f.projectId, {
    requestId: "new-canvas",
    expectedRevisionId: first.revisionId,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  const pinned = { ...request, revisionId: first.revisionId };
  expect(f.preview.request(pinned).jobId).toBe(first.jobId);
  release.resolve();
  await f.jobs.idle();
  const ready = f.preview.request(pinned);
  expect(ready.state).toBe("ready");
  const preview = ready.published!.preview;
  const content = JSON.parse(await readFile(preview.file, "utf8"));
  expect(content.manifest.revisionId).toBe(first.revisionId);
  expect(content.manifest.canvas.width).toBe(160);
  expect(content.frames.map((frame: { sampleAtUs: number }) => frame.sampleAtUs)).toEqual([
    50000, 100000, 150000,
  ]);
  expect(content.assets).toEqual([
    { assetId: f.asset.id, streamId: "track:7", path: f.assets.path(f.asset.id), originUs: 9000 },
  ]);
  expect(
    content.manifest.requirements.every(
      (r: { implementationId: unknown }) => typeof r.implementationId === "string",
    ),
  ).toBe(true);
  f.cache.remove(preview.cacheId);
  expect(f.preview.request(pinned).published).toBeNull();
  await f.jobs.idle();
  const again = f.preview.request(pinned);
  expect(again.published!.generation).toBeGreaterThan(ready.published!.generation);
  expect(JSON.parse(await readFile(again.published!.preview.file, "utf8"))).toEqual(content);
});

test("cancellation fences an uncooperative renderer and retry stays on the admitted revision", async () => {
  const started = gate(),
    release = gate();
  let first = true;
  const f = await fixture({
    ...renderer,
    async render(request, signal) {
      if (first) {
        first = false;
        started.resolve();
        await release.promise;
        return renderer.render(request, new AbortController().signal);
      }
      return renderer.render(request, signal);
    },
  });
  cleanup.push(async () => release.resolve());
  const admitted = f.preview.request({ projectId: f.projectId });
  await started.promise;
  f.jobs.cancel(admitted.jobId!);
  release.resolve();
  await f.jobs.idle();
  expect(f.cache.bytes).toBe(0);
  expect(await readdir(join(f.home, "cache", "derived"))).toEqual([]);
  const canceled = f.preview.request({ projectId: f.projectId, revisionId: admitted.revisionId });
  expect(canceled.published).toBeNull();
  expect(canceled.state).not.toBe("ready");
  f.projects.apply(f.projectId, {
    requestId: "edit",
    expectedRevisionId: admitted.revisionId,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  f.preview.retry({ projectId: f.projectId, revisionId: admitted.revisionId });
  await f.jobs.idle();
  const ready = f.preview.request({ projectId: f.projectId, revisionId: admitted.revisionId });
  expect(ready.published!.preview.width).toBe(160);
  expect(ready.published!.preview.revisionId).toBe(admitted.revisionId);
});

test("deletion denies new previews while the existing queue drains before revision retirement", async () => {
  const started = gate(),
    release = gate();
  const f = await fixture({
    ...renderer,
    async render(request) {
      started.resolve();
      await release.promise;
      return renderer.render(request, new AbortController().signal);
    },
  });
  cleanup.push(async () => release.resolve());
  const admitted = f.preview.request({ projectId: f.projectId });
  await started.promise;
  const owner = { kind: "project" as const, projectId: f.projectId };
  f.projects.markDeleting(f.projectId);
  const draining = f.jobs.drainOwner(owner);
  expect(() =>
    f.preview.request({ projectId: f.projectId, revisionId: admitted.revisionId }),
  ).toThrow(/does not exist/);
  expect(f.assets.references(f.asset.id)).toContainEqual({
    kind: "revision",
    id: admitted.revisionId,
  });
  release.resolve();
  await draining;
  expect(f.cache.bytes).toBe(0);
  expect(await readdir(join(f.home, "cache", "derived"))).toEqual([]);
  await f.jobs.forgetOwner(owner);
  while (!f.projects.finishDeletionPage(f.projectId)) {
    /* bounded store retirement */
  }
  expect(f.assets.references(f.asset.id)).toEqual([]);
  expect(await readFile(f.assets.path(f.asset.id), "utf8")).toBe("source identity");
});

test("binds supported gain throughout audio routing and output, but refuses unprepared retiming", async () => {
  const f = await fixture();
  expect(f.preview.capabilities()).toMatchObject([
    {
      type: "pointer",
      targets: ["clip"],
      requiresAcquisition: true,
      execution: false,
      implementationId: null,
    },
    { type: "geometry", execution: true, implementationId: renderer.implementationId },
    { type: "opacity", execution: true, implementationId: renderer.implementationId },
    { type: "gain", execution: true, implementationId: renderer.implementationId },
  ]);
  const path = join(f.home, "voice.wav");
  await writeFile(path, "voice identity");
  const audio = await f.assets.import(path, { kind: "import" }, async () => ({
    originUs: 0,
    streams: [
      {
        id: "voice",
        kind: "audio",
        codec: "pcm",
        decodable: true,
        startUs: 0,
        endUs: 1000000,
        segments: [{ startUs: 0, endUs: 1000000, empty: false }],
        sampleRate: 48000,
        channels: 2,
      },
    ],
  }));
  const targets = [
    { kind: "clip", id: { label: "voice" } },
    { kind: "track", id: { label: "audio" } },
    { kind: "group", id: { label: "inner" } },
    { kind: "group", id: { label: "outer" } },
    { kind: "output" },
  ];
  const edited = f.projects.apply(f.projectId, {
    requestId: "gain-tree",
    expectedRevisionId: f.placed.revision.id,
    operations: [
      { operation: "group.add", group: { kind: "audio", order: 1 }, label: "outer" },
      {
        operation: "group.add",
        group: { kind: "audio", order: 0, parentId: { label: "outer" } },
        label: "inner",
      },
      {
        operation: "track.add",
        track: { kind: "audio", order: 0, parentId: { label: "inner" } },
        label: "audio",
      },
      {
        operation: "place",
        label: "voice",
        clip: {
          trackId: { label: "audio" },
          assetId: audio.id,
          streamId: "voice",
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
      ...targets.map((target, i) => ({
        operation: "processing.set",
        target,
        steps: [{ processor: { type: "gain", gain: (i + 1) / 10 } }],
      })),
    ],
  });
  f.preview.request({ projectId: f.projectId });
  await f.jobs.idle();
  const result = f.preview.request({ projectId: f.projectId }).published!.preview;
  const content = JSON.parse(await readFile(result.file, "utf8"));
  expect(
    content.manifest.requirements
      .filter((r: { kind: string }) => r.kind === "processor")
      .map((r: { processor: { gain: number }; implementationId: string }) => [
        r.processor.gain,
        r.implementationId,
      ]),
  ).toEqual([0.1, 0.2, 0.3, 0.4, 0.5].map((gain) => [gain, renderer.implementationId]));
  f.projects.apply(f.projectId, {
    requestId: "stretch",
    expectedRevisionId: edited.revision.id,
    operations: [
      {
        operation: "retime",
        clipIds: [edited.edit.labels.voice],
        durationUs: 2000000,
        ripple: "none",
      },
    ],
  });
  expect(() => f.preview.request({ projectId: f.projectId })).toThrowError(
    expect.objectContaining({
      code: "NOT_READY",
      details: {
        requirements: [expect.objectContaining({ kind: "retime", implementationId: null })],
      },
    }),
  );
});

test("changed execution implementation never reuses a prior published movie", async () => {
  const f = await fixture();
  const first = f.preview.request({ projectId: f.projectId });
  await f.jobs.idle();
  const old = f.preview.request({ projectId: f.projectId }).published!.preview;
  const next = f.replaceRenderer({ ...renderer, implementationId: "fixture-movie-v2" });
  const changed = next.request({ projectId: f.projectId });
  expect(changed.jobId).not.toBe(first.jobId);
  expect(changed.published).toBeNull();
  await f.jobs.idle();
  const ready = next.request({ projectId: f.projectId }).published!.preview;
  expect(ready.cacheId).not.toBe(old.cacheId);
  expect(ready.implementationId).toBe("fixture-movie-v2");
  expect(JSON.parse(await readFile(ready.file, "utf8")).manifest.requirements).toEqual([
    { kind: "executor", mediaKind: "audio", implementationId: "fixture-movie-v2" },
    { kind: "executor", mediaKind: "video", implementationId: "fixture-movie-v2" },
  ]);
});

test.each(["bytes", "width", "durationUs"] as const)(
  "refuses an unrelated %s receipt and removes its reserved output",
  async (field) => {
    const f = await fixture({
      ...renderer,
      async render(request, signal) {
        const movie = await renderer.render(request, signal);
        return { ...movie, [field]: movie[field] + 1 };
      },
    });
    f.preview.request({ projectId: f.projectId });
    await f.jobs.idle();
    const result = f.preview.request({ projectId: f.projectId });
    expect(result.state).toBe("failed");
    expect(result.published).toBeNull();
    expect(await readdir(join(f.home, "cache", "derived"))).toEqual([]);
  },
);

test("equivalent settings reuse the movie while meaningful changes pin distinct work", async () => {
  const f = await fixture();
  const a = f.preview.request({ projectId: f.projectId });
  const b = f.preview.request({ projectId: f.projectId, settings: a.settings });
  expect(b.jobId).toBe(a.jobId);
  const changed = f.preview.request({
    projectId: f.projectId,
    settings: { video: { keyframeInterval: 15 } },
  });
  expect(changed.jobId).not.toBe(a.jobId);
  await f.jobs.idle();
  expect(f.preview.request({ projectId: f.projectId }).published?.preview.settings).toEqual(
    a.settings,
  );
  expect(
    f.preview.request({ projectId: f.projectId, settings: changed.settings }).published?.preview
      .settings.video.keyframeInterval,
  ).toBe(15);
});
