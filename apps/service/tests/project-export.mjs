import { outputPresets } from "@screenrec/composition";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { Catalog, CatalogError } from "@screenrec/core/catalog";
import { AssetStore } from "@screenrec/core/assets";
import { ProjectStore } from "@screenrec/core/projects";
import { AcquisitionStore } from "@screenrec/core/acquisitions";
import { TranscriptStore } from "@screenrec/core/transcript";
import { assetTranscriptOwner } from "@screenrec/core/transcript-processing";
import { JobQueue } from "@screenrec/core/jobs";
import { DerivedCache } from "@screenrec/core/cache";
import { ProjectPreviewInspection } from "@screenrec/core/project-preview";
import { MediaExports } from "../dist/exports.js";
import { ManagedFiles } from "../dist/managed-files.js";
import { mediaWorker } from "../dist/worker.js";
const native = mediaWorker({
  SCREENREC_NATIVE:
    process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native"),
});
const gate = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function until(run) {
  const end = Date.now() + 15000;
  for (;;) {
    const value = run();
    if (value) return value;
    assert.ok(Date.now() < end, "Owner did not settle within15s");
    await delay(10);
  }
}
async function fixture(t, { render, wrap = (value) => value, admission = true, existing } = {}) {
  const home = existing?.home ?? (await mkdtemp("/tmp/screenrec-project-export-")),
    output = existing?.output ?? (await mkdtemp("/tmp/screenrec-project-destination-"));
  const lifetime = existing?.lifetime ?? { closers: [] };
  if (!existing)
    t.after(async () => {
      for (const close of [...lifetime.closers].reverse()) await close();
      await rm(home, { recursive: true, force: true });
      await rm(output, { recursive: true, force: true });
    });
  const catalog = new Catalog(join(home, "catalog.sqlite")),
    assets = new AssetStore(catalog, home);
  await assets.recover();
  const acquisitions = new AcquisitionStore(catalog);
  const projects = new ProjectStore(catalog, assets, new TranscriptStore(catalog, home, assetTranscriptOwner(assets, acquisitions)), acquisitions),
    cache = new DerivedCache(catalog, home, (owner) => {
      assert.equal(owner.kind, "project");
      projects.get(owner.projectId);
    });
  await cache.reconcile();
  let preview, exports;
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin(target) {
        assert.equal(target.kind, "project");
        return {
          ...target,
          revisionId: projects.revision(target.projectId, target.revisionId).id,
        };
      },
      isAvailable: (target) => target.kind === "project" && !projects.isDeleting(target.projectId),
      isDeleting: (owner) => owner.kind === "project" && projects.isDeleting(owner.projectId),
      isCapturing: () => false,
    },
    execute: (execution) =>
      execution.job.artifact === "preview"
        ? preview.execute(execution)
        : exports.execute(execution),
  });
  const ordinary = async ({ window, output, settings }, signal) => {
    signal.throwIfAborted();
    const frames = [...window.frames()];
    const data = Buffer.from(JSON.stringify({ manifest: window.manifest, frames }));
    await writeFile(output, data, { flag: "wx" });
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
      bytes: data.length,
    };
  };
  const worker = wrap(native),
    files = new ManagedFiles(home, worker);
  const binding = {
    implementationId: "project-owner-fixture-v1",
    render: render ? (request, signal) => render(request, signal, ordinary) : ordinary,
  };
  preview = new ProjectPreviewInspection(projects, assets, jobs, cache, binding);
  const domain = { store: projects, preview };
  exports = new MediaExports({
    catalog,
    jobs,
    cache,
    worker,
    files,
    project: domain,
  });
  if (admission) jobs.startAdmission((job) => exports.admit(job));
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await exports.close();
    await jobs.close();
    catalog.close();
  };
  lifetime.closers.push(close);
  let asset, projectId, placed;
  if (existing) {
    asset = assets.get(existing.asset.id);
    projectId = existing.projectId;
    placed = {
      revision: projects.revision(projectId, existing.placed.revision.id),
    };
  } else {
    const path = join(home, "input.mov");
    await writeFile(path, "source identity");
    asset = await assets.import(path, { kind: "import" }, async () => ({
      originUs: 0,
      streams: [
        {
          id: "video",
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
    const initial = projects.create({
      requestId: "create",
      canvas: {
        width: 160,
        height: 96,
        fps: { numerator: 20, denominator: 1 },
        background: "#000000ff",
      },
    });
    projectId = initial.project.projectId;
    placed = projects.apply(projectId, {
      requestId: "place",
      expectedRevisionId: initial.revision.id,
      operations: [
        {
          operation: "track.add",
          track: { kind: "video", order: 0 },
          label: "track",
        },
        {
          operation: "place",
          clip: {
            trackId: { label: "track" },
            assetId: asset.id,
            streamId: "video",
            source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
            placement: {
              kind: "project",
              range: { startUs: 0, endUs: 1000000 },
            },
          },
        },
      ],
    });
  }
  return {
    lifetime,
    close,
    home,
    output,
    catalog,
    assets,
    asset,
    projects,
    projectId,
    placed,
    jobs,
    cache,
    preview,
    exports,
    binding,
    replaceRenderer(implementationId) {
      preview = new ProjectPreviewInspection(projects, assets, jobs, cache, {
        ...binding,
        implementationId,
      });
      domain.preview = preview;
    },
    request: () => ({
      kind: "video",
      projectId,
      exportId: randomUUID(),
      directory: output,
      leaf: randomUUID() + ".mp4",
    }),
  };
}
test("project export pins an omitted revision, replays it after edits and atomically publishes exact cached bytes", async (t) => {
  const started = gate(),
    release = gate();
  t.after(() => release.resolve());
  const f = await fixture(t, {
    render: async (req, signal, ordinary) => {
      started.resolve();
      await release.promise;
      return ordinary(req, signal);
    },
  });
  const request = f.request(),
    first = await f.exports.create(request);
  await started.promise;
  f.projects.apply(f.projectId, {
    requestId: "resize",
    expectedRevisionId: f.placed.revision.id,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  assert.equal((await f.exports.create(request)).snapshot.revisionId, first.snapshot.revisionId);
  await assert.rejects(
    f.exports.create({ ...request, leaf: "other.mp4" }),
    (error) => error.code === "REQUEST_CONFLICT",
  );
  assert.deepEqual(await readdir(f.output), []);
  release.resolve();
  const ready = await until(() => {
    const s = f.exports.status(request.exportId);
    if (s.state === "failed") throw new Error(JSON.stringify(s));
    return s.state === "committed" && !s.cleanupPending && s;
  });
  const data = JSON.parse(await readFile(ready.output, "utf8"));
  assert.equal(data.manifest.revisionId, f.placed.revision.id);
  assert.equal(data.manifest.canvas.width, 160);
  assert.deepEqual(await readdir(f.output), [request.leaf]);
  assert.equal(f.exports.list({ projectId: f.projectId }).exports[0].projectId, f.projectId);
  await f.exports.retry(request.exportId);
  assert.equal(f.exports.status(request.exportId).receipt.sha256, ready.receipt.sha256);
});
for (const evict of [false, true])
  test(`canceled export ${evict ? "refuses missing old implementation after eviction" : "publishes retained ready bytes despite implementation replacement"}`, async (t) => {
    const started = gate(),
      release = gate();
    let held = false,
      renders = 0;
    t.after(() => release.resolve());
    const f = await fixture(t, {
      render: async (req, signal, ordinary) => {
        renders++;
        return ordinary(req, signal);
      },
      wrap: (worker) => async (op, params, options) => {
        if (op === "publication.allocate" && !held) {
          held = true;
          started.resolve();
          await release.promise;
        }
        return worker(op, params, options);
      },
    });
    const request = f.request();
    await f.exports.create(request);
    await started.promise;
    const preview = f.preview.request({ projectId: f.projectId }).published.preview;
    f.exports.cancel(request.exportId);
    release.resolve();
    await f.jobs.idle();
    assert.equal(f.exports.status(request.exportId).state, "canceled");
    assert.equal(await readFile(preview.file, "utf8").then(() => true), true);
    if (evict) f.cache.remove(preview.cacheId);
    f.replaceRenderer("project-owner-fixture-v2");
    await f.exports.retry(request.exportId);
    const state = await until(() => {
      const s = f.exports.status(request.exportId);
      return ["failed", "committed"].includes(s.state) && s;
    });
    await f.jobs.idle();
    if (evict) {
      assert.equal(state.state, "failed");
      assert.equal(f.jobs.job(state.jobId).errorCode, "NOT_READY");
      await assert.rejects(readFile(join(f.output, request.leaf)));
      f.replaceRenderer("project-owner-fixture-v1");
      await f.exports.retry(request.exportId);
      await until(() => {
        const value = f.exports.status(request.exportId);
        return value.state === "committed" && !value.cleanupPending;
      });
      assert.equal(
        JSON.parse(await readFile(join(f.output, request.leaf), "utf8")).manifest.requirements[0]
          .implementationId,
        "project-owner-fixture-v1",
      );
    } else {
      assert.equal(state.state, "committed");
      assert.equal(
        JSON.parse(await readFile(state.output, "utf8")).manifest.requirements[0].implementationId,
        "project-owner-fixture-v1",
      );
    }
    assert.equal(renders, evict ? 2 : 1);
    await f.exports.abandon(request.exportId);
    assert.throws(
      () => f.exports.status(request.exportId),
      (error) => error.code === "NOT_FOUND",
    );
    assert.deepEqual(await readdir(f.output), [request.leaf]);
  });

test("an evicted admitted preview regenerates through the same dependency job before publishing", async (t) => {
  const started = gate(),
    release = gate();
  let held = false,
    renders = 0;
  t.after(() => release.resolve());
  const f = await fixture(t, {
    render: async (req, signal, ordinary) => {
      renders++;
      return ordinary(req, signal);
    },
    wrap: (worker) => async (op, params, options) => {
      if (op === "publication.allocate" && !held) {
        held = true;
        started.resolve();
        await release.promise;
      }
      return worker(op, params, options);
    },
  });
  const request = f.request();
  await f.exports.create(request);
  await started.promise;
  const old = f.preview.request({ projectId: f.projectId }).published;
  f.projects.apply(f.projectId, {
    requestId: "advance-before-regeneration",
    expectedRevisionId: f.placed.revision.id,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  f.cache.remove(old.preview.cacheId);
  release.resolve();
  const ready = await until(() => {
    const s = f.exports.status(request.exportId);
    if (s.state === "failed") throw new Error(JSON.stringify(s));
    return s.state === "committed" && !s.cleanupPending && s;
  });
  assert.equal(renders, 2);
  assert.equal(
    JSON.parse(await readFile(ready.output, "utf8")).manifest.revisionId,
    f.placed.revision.id,
  );
  assert.ok(
    f.preview.request({
      projectId: f.projectId,
      revisionId: f.placed.revision.id,
    }).published.generation > old.generation,
  );
});

test("publication holds its cached read lease until the native copy finishes", async (t) => {
  const started = gate(),
    release = gate();
  let held = false;
  t.after(() => release.resolve());
  const f = await fixture(t, {
    wrap: (worker) => async (op, params, options) => {
      if (op === "publication.prepare" && !held) {
        held = true;
        started.resolve();
        await release.promise;
      }
      return worker(op, params, options);
    },
  });
  const request = f.request();
  await f.exports.create(request);
  await started.promise;
  const cacheId = f.preview.request({ projectId: f.projectId }).published.preview.cacheId;
  assert.throws(
    () => f.cache.remove(cacheId),
    (error) => error.code === "CACHE_BUSY",
  );
  release.resolve();
  await until(() => {
    const s = f.exports.status(request.exportId);
    return s.state === "committed" && !s.cleanupPending;
  });
  await f.jobs.idle();
  f.cache.remove(cacheId);
  assert.equal(
    JSON.parse(await readFile(join(f.output, request.leaf), "utf8")).manifest.revisionId,
    f.placed.revision.id,
  );
});

test("restart recovery observes an unacknowledged project commit without republishing", async (t) => {
  let committed = false;
  const f = await fixture(t, {
    wrap: (worker) => async (op, params, options) => {
      if (op === "publication.reconcile" && committed) throw new Error("lost observation");
      const result = await worker(op, params, options);
      if (op === "publication.commit") committed = true;
      return result;
    },
  });
  const request = f.request();
  await f.exports.create(request);
  await until(() => f.exports.status(request.exportId).state === "failed");
  await f.jobs.idle();
  const before = await stat(join(f.output, request.leaf));
  await f.close();
  const reopened = await fixture(t, { existing: f });
  assert.deepEqual(reopened.exports.resumeRecovery(), []);
  const recovered = await until(() => {
    const s = reopened.exports.status(request.exportId);
    return s.state === "committed" && !s.cleanupPending && s;
  });
  assert.equal((await stat(recovered.output)).ino, before.ino);
  assert.equal((await reopened.exports.create(request)).snapshot.revisionId, f.placed.revision.id);
  assert.deepEqual(await readdir(f.output), [request.leaf]);
});

test("project retirement drains a late publication, removes only private state and preserves source bytes", async (t) => {
  const started = gate(),
    release = gate();
  t.after(() => release.resolve());
  const f = await fixture(t, {
    wrap: (worker) => async (op, params, options) => {
      if (op === "publication.commit") {
        started.resolve();
        await release.promise;
        return worker(op, params, { ...options, signal: undefined });
      }
      return worker(op, params, options);
    },
  });
  const request = f.request();
  await f.exports.create(request);
  await started.promise;
  f.projects.markDeleting(f.projectId);
  const owner = { kind: "project", projectId: f.projectId };
  const retiring = Promise.all([f.jobs.drainOwner(owner), f.exports.retireOwner(owner)]);
  assert.ok(f.assets.references(f.asset.id).length > 0);
  await assert.rejects(
    f.exports.create({ ...f.request(), leaf: "forbidden.mp4" }),
    (error) => error.code === "NOT_FOUND",
  );
  release.resolve();
  await retiring;
  assert.throws(
    () => f.exports.status(request.exportId),
    (error) => error.code === "NOT_FOUND",
  );
  await f.jobs.forgetOwner(owner);
  while (!f.projects.finishDeletionPage(f.projectId)) {}
  assert.deepEqual(f.assets.references(f.asset.id), []);
  assert.equal(await readFile(f.assets.path(f.asset.id), "utf8"), "source identity");
  assert.deepEqual(await readdir(f.output), [request.leaf]);
  assert.equal(
    JSON.parse(await readFile(join(f.output, request.leaf), "utf8")).manifest.revisionId,
    f.placed.revision.id,
  );
});

test("explicit export retry recovers a queued preview after its pinned renderer returns", async (t) => {
  const started = gate(),
    release = gate();
  t.after(() => release.resolve());
  const f = await fixture(t);
  const context = f.jobs.createContext(async () => {
    started.resolve();
    await release.promise;
    return "released";
  });
  f.jobs.submitContext(context, {
    artifact: "hold",
    input: "renderer-switch",
    lane: "heavy",
  });
  await started.promise;
  const request = f.request();
  await f.exports.create(request);
  await until(() => f.preview.request({ projectId: f.projectId }).state === "queued");
  f.replaceRenderer("project-owner-fixture-v2");
  release.resolve();
  await until(() => f.exports.status(request.exportId).state === "failed");
  await f.jobs.idle();
  f.replaceRenderer("project-owner-fixture-v1");
  assert.equal(f.preview.request({ projectId: f.projectId }).state, "failed");
  await f.exports.retry(request.exportId);
  const result = await until(() => {
    const value = f.exports.status(request.exportId);
    if (value.state === "failed") throw new Error(JSON.stringify(value));
    return value.state === "committed" && !value.cleanupPending && value;
  });
  assert.equal(
    JSON.parse(await readFile(result.output, "utf8")).manifest.requirements[0].implementationId,
    "project-owner-fixture-v1",
  );
});

test("polling and export retry leave unrelated failed preview dependencies alone", async (t) => {
  let fail = true,
    renders = 0;
  const f = await fixture(t, {
    render: async (request, signal, ordinary) => {
      renders++;
      if (fail) throw new CatalogError("DECODE_FAILED", "fixture dependency", {}, true);
      return ordinary(request, signal);
    },
  });
  const request = f.request();
  await f.exports.create(request);
  await until(() => f.exports.status(request.exportId).state === "failed");
  fail = false;
  f.exports.status(request.exportId);
  f.preview.request({ projectId: f.projectId });
  await f.exports.retry(request.exportId);
  await until(() => f.exports.status(request.exportId).state === "failed");
  assert.equal(renders, 1);
  f.preview.retry({ projectId: f.projectId });
  await f.jobs.idle();
  await f.exports.retry(request.exportId);
  await until(() => {
    const value = f.exports.status(request.exportId);
    return value.state === "committed" && !value.cleanupPending;
  });
  assert.equal(renders, 2);
});

test("stale export implementation absence does not retry a newer decode failure", async (t) => {
  let fail = false,
    renders = 0;
  const f = await fixture(t, {
    admission: false,
    render: async (request, signal, ordinary) => {
      renders++;
      if (fail) throw new CatalogError("DECODE_FAILED", "newer failure", {}, true);
      return ordinary(request, signal);
    },
  });
  const request = f.request();
  await f.exports.create(request);
  f.replaceRenderer("project-owner-fixture-v2");
  f.jobs.startAdmission((job) => f.exports.admit(job));
  await until(() => f.exports.status(request.exportId).state === "failed");
  assert.equal(f.jobs.job(f.exports.status(request.exportId).jobId).errorCode, "NOT_READY");
  f.replaceRenderer("project-owner-fixture-v1");
  fail = true;
  f.preview.request({ projectId: f.projectId });
  await until(() => f.preview.request({ projectId: f.projectId }).state === "failed");
  fail = false;
  await f.exports.retry(request.exportId);
  await until(() => ["failed", "committed"].includes(f.exports.status(request.exportId).state));
  await f.jobs.idle();
  assert.equal(f.exports.status(request.exportId).state, "failed");
  assert.equal(renders, 1);
});

test("staged project bytes retry after renderer replacement without rendering again", async (t) => {
  let rejectCommit = true,
    renders = 0;
  const f = await fixture(t, {
    render: async (request, signal, ordinary) => {
      renders++;
      return ordinary(request, signal);
    },
    wrap: (worker) => async (operation, params, options) => {
      if (operation === "publication.commit" && rejectCommit)
        throw new CatalogError("FIXTURE_COMMIT_INTERRUPTED", "Staged before commit", {}, true);
      return worker(operation, params, options);
    },
  });
  const request = f.request();
  await f.exports.create(request);
  await until(() => f.exports.status(request.exportId).state === "failed");
  await f.jobs.idle();
  const preview = f.preview.request({ projectId: f.projectId }).published.preview;
  f.cache.remove(preview.cacheId);
  f.replaceRenderer("project-owner-fixture-v2");
  rejectCommit = false;
  await f.exports.retry(request.exportId);
  const result = await until(() => {
    const status = f.exports.status(request.exportId);
    if (status.state === "failed") throw Error(JSON.stringify(status));
    return status.state === "committed" && !status.cleanupPending && status;
  });
  assert.equal(renders, 1);
  assert.equal(
    JSON.parse(await readFile(result.output, "utf8")).manifest.requirements[0].implementationId,
    "project-owner-fixture-v1",
  );
});

test("retained authored export replay does not expand a changed preset", async (t) => {
  const f = await fixture(t, { admission: false });
  const request = {
    ...f.request(),
    settings: { preset: "balanced", video: { keyframeInterval: 42 } },
  };
  const first = await f.exports.create(request);
  const before = outputPresets.balanced.video.rateControl;
  try {
    outputPresets.balanced.video.rateControl = { mode: "average", bitrate: 1234567 };
    const replay = await f.exports.create(request);
    assert.deepEqual(replay.snapshot.settings, first.snapshot.settings);
    await assert.rejects(
      f.exports.create({ ...request, settings: { preset: "sharp" } }),
      (error) => error.code === "REQUEST_CONFLICT",
    );
  } finally {
    outputPresets.balanced.video.rateControl = before;
  }
});

test("settings-free export replay retains its original request identity", async (t) => {
  const f = await fixture(t, { admission: false });
  const request = f.request();
  const first = await f.exports.create(request);
  const stored = f.catalog.catalog
    .prepare("SELECT request FROM export_intents WHERE exportId=?")
    .get(request.exportId);
  assert.equal(
    stored.request,
    JSON.stringify([
      request.kind,
      "project",
      request.projectId,
      null,
      request.directory,
      request.leaf,
    ]),
  );
  const replay = await f.exports.create({ ...request, settings: {} });
  assert.deepEqual(replay.snapshot, first.snapshot);
});
