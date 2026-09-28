import { afterEach, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Catalog, CatalogError } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { ProjectStore } from "./projects.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { ProjectFrameInspection, type ProjectFrameRenderer } from "./project-frames.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const renderer: ProjectFrameRenderer = {
  implementationId: "fixture-picture",
  async render({ window, assets, output }, signal) {
    signal.throwIfAborted();
    const bytes = Buffer.from("test frame payload");
    await writeFile(output, bytes, { flag: "wx" });
    const frame = [...window.frames()][0]!;
    const layer = frame.layers[0]!;
    return {
      file: output,
      mediaType: "image/png",
      profile: "h264-rec709",
      frame,
      width: window.manifest.canvas.width,
      height: window.manifest.canvas.height,
      sourceWidth: window.manifest.canvas.width,
      sourceHeight: window.manifest.canvas.height,
      decodedSamples: 1,
      readerOpens: 1,
      bytes: bytes.length,
      picture: {
        status: "available",
        clipId: layer.clipId,
        assetId: layer.assetId,
        streamId: layer.streamId,
        requestedSourceUs: layer.sourceUs,
        actualSourceUs: layer.sourceUs,
        sample: {
          value: String(layer.sourceUs + assets[0]!.originUs),
          timescale: 1000000,
          originUs: assets[0]!.originUs,
        },
      },
    };
  },
};
async function fixture(render = renderer) {
  const home = await mkdtemp("/tmp/screenrec-project-frames-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const projects = new ProjectStore(catalog, assets);
  const cache = new DerivedCache(catalog, home, (owner) => {
    if (owner.kind !== "project") throw new CatalogError("INVALID_TARGET", "Expected project");
    projects.get(owner.projectId);
  });
  await cache.reconcile();
  let frames!: ProjectFrameInspection;
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
    execute: (execution) => frames.execute(execution),
  });
  frames = new ProjectFrameInspection(projects, assets, jobs, cache, render);
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
  projects.apply(projectId, {
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
  return { projects, cache, jobs, frames, projectId };
}
test("demanded still pins global picture timing across head changes and cache regeneration", async () => {
  const f = await fixture();
  const first = f.frames.request({ projectId: f.projectId, atUs: 75001 });
  f.projects.apply(f.projectId, {
    requestId: "resize",
    expectedRevisionId: first.revisionId,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  await f.jobs.idle();
  const request = { projectId: f.projectId, revisionId: first.revisionId, atUs: 75001 };
  const ready = f.frames.request(request);
  expect(ready.state).toBe("ready");
  const image = ready.published!.frame;
  expect(image).toMatchObject({
    revisionId: first.revisionId,
    atUs: 75001,
    width: 160,
    height: 96,
    frame: { sampleAtUs: 50000, visibleRange: { startUs: 75001, endUs: 75002 } },
    picture: { status: "available", requestedSourceUs: 50000, actualSourceUs: 50000 },
  });
  expect(await readFile(image.file, "utf8")).toBe("test frame payload");
  f.cache.remove(image.cacheId);
  expect(f.frames.request(request).published).toBeNull();
  await f.jobs.idle();
  expect(f.frames.request(request).published!.frame.frame).toEqual(image.frame);
  expect(() => f.frames.request({ ...request, atUs: 1000000 })).toThrow();
});

test("a renderer cannot publish the wrong globally phased picture", async () => {
  const f = await fixture({
    ...renderer,
    async render(request, signal) {
      const value = (await renderer.render(request, signal)) as { frame: { sampleAtUs: number } };
      value.frame.sampleAtUs++;
      return value;
    },
  });
  const request = { projectId: f.projectId, atUs: 75001 };
  f.frames.request(request);
  await f.jobs.idle();
  expect(f.frames.request(request)).toMatchObject({ state: "failed", published: null });
  expect(f.cache.bytes).toBe(0);
});

test("canceled late picture output is discarded and the same revision can retry", async () => {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  const f = await fixture({
    ...renderer,
    async render(request, signal) {
      if (first) {
        first = false;
        entered();
        await held;
        return renderer.render(request, new AbortController().signal);
      }
      return renderer.render(request, signal);
    },
  });
  cleanup.push(async () => release());
  const request = { projectId: f.projectId, atUs: 75001 };
  const pending = f.frames.request(request);
  await started;
  f.jobs.cancel(pending.jobId!);
  release();
  await f.jobs.idle();
  expect(f.cache.bytes).toBe(0);
  expect(f.frames.request(request).published).toBeNull();
  f.frames.retry({ ...request, revisionId: pending.revisionId });
  await f.jobs.idle();
  expect(f.frames.request(request)).toMatchObject({
    state: "ready",
    published: { frame: { revisionId: pending.revisionId, atUs: 75001 } },
  });
});
