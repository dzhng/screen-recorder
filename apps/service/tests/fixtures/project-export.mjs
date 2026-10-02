import { ProjectDeletion } from "../../dist/project-deletion.js";
import { DerivativeDelivery } from "../../dist/delivery.js";
import { ManagedStorage } from "@screenrec/core/storage";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { projectIndexDomain } from "@screenrec/core/project-index";
import { projectComposition } from "@screenrec/core/project-window";
import { selectSource } from "@screenrec/core/source-selection";
import { SceneEvidenceStore, assetSceneOwner } from "@screenrec/core/scene-evidence";
import { PreparedAudioStore } from "@screenrec/core/prepared-audio";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Catalog } from "@screenrec/core/catalog";
import { AssetStore } from "@screenrec/core/assets";
import { ProjectStore } from "@screenrec/core/projects";
import { AcquisitionStore } from "@screenrec/core/acquisitions";
import { TranscriptStore } from "@screenrec/core/transcript";
import { assetTranscriptOwner } from "@screenrec/core/transcript-processing";
import { JobQueue } from "@screenrec/core/jobs";
import { DerivedCache } from "@screenrec/core/cache";
import { ProjectPreviewInspection } from "@screenrec/core/project-preview";
import { MediaExports } from "../../dist/exports.js";
import { ManagedFiles } from "../../dist/managed-files.js";
import { mediaWorker } from "../../dist/worker.js";
export const nativeBinary =
  process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native");
export const native = mediaWorker({ SCREENREC_NATIVE: nativeBinary });
export const gate = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
export async function until(run) {
  const end = Date.now() + 15000;
  for (;;) {
    const value = await run();
    if (value) return value;
    assert.ok(Date.now() < end, "Owner did not settle within 15s");
    await delay(10);
  }
}
export async function fixture(
  t,
  { render, wrap = (value) => value, admission = true, existing } = {},
) {
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
  const projects = new ProjectStore(
      catalog,
      assets,
      new TranscriptStore(catalog, home, assetTranscriptOwner(assets, acquisitions)),
      acquisitions,
    ),
    cache = new DerivedCache(catalog, home, (owner) => {
      assert.equal(owner.kind, "project");
      projects.get(owner.projectId);
    });
  await cache.reconcile();
  let preview,
    exports,
    recoverOnCapacity = false;
  const recoveryErrors = [];
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    onCapacity: () => {
      if (recoverOnCapacity) recoveryErrors.push(...exports.resumeRecovery());
    },
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
  const prepared = new PreparedAudioStore({
    catalog,
    assets,
    projects,
    jobs,
    staging: join(home, "prepared"),
    renderer: {
      implementationId: "unused",
      render: async () => {
        throw new Error("unused preparation");
      },
    },
    probe: async () => {
      throw new Error("unused preparation");
    },
  });
  preview = new ProjectPreviewInspection(projects, assets, jobs, cache, binding, prepared);
  const domain = { store: projects, preview };
  exports = new MediaExports({
    catalog,
    jobs,
    cache,
    worker,
    files,
    project: domain,
  });
  const scenes = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
  const index = new ScreenshotIndexStore(
    catalog,
    home,
    projectIndexDomain(
      {
        composition: (identity) => projectComposition(projects, assets, identity),
        source: (selection) => selectSource(assets, acquisitions, selection),
        scenes,
        isDeleting: (id) => projects.isDeleting(id),
      },
      { implementationId: "unused-index" },
    ),
  );
  const delivery = new DerivativeDelivery();
  const deletion = new ProjectDeletion(projects, jobs, cache, files, delivery, exports, index);
  const storage = new ManagedStorage(null, cache, home, (signal) =>
    exports.usage(undefined, signal),
  );
  if (admission) jobs.startAdmission((job) => exports.admit(job));
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await storage.close();
    await deletion.close();
    await exports.close();
    await jobs.close();
    delivery.dispose();
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
    deletion,
    storage,
    replaceRenderer(implementationId) {
      preview = new ProjectPreviewInspection(
        projects,
        assets,
        jobs,
        cache,
        {
          ...binding,
          implementationId,
        },
        prepared,
      );
      domain.preview = preview;
    },
    recoveryErrors,
    startRecovery() {
      recoverOnCapacity = true;
      return exports.resumeRecovery();
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
