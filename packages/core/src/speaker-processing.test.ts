import { afterEach, expect, test } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Catalog, CatalogError } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { Models, type ModelManifest } from "./models.js";
import { JobQueue } from "./jobs.js";
import { SpeakerEvidenceStore, assetSpeakerOwner } from "./speaker-evidence.js";
import { SpeakerProcessing, type SpeakerObserver } from "./speaker-processing.js";
import { nativeOutput, speakerSource } from "./speaker-evidence.fixture.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
async function fixture() {
  const home = await mkdtemp("/tmp/speaker-processing-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home),
    acquisitions = new AcquisitionStore(catalog);
  await assets.recover();
  const original = join(home, "external.wav");
  await writeFile(original, "two-channel source");
  const asset = await assets.import(original, { kind: "import" }, async () => ({
    originUs: -250000,
    streams: [
      {
        id: "a1",
        kind: "audio",
        codec: "fixture",
        decodable: true,
        channels: 2,
        sampleRate: 48000,
        startUs: 0,
        endUs: 40000000,
        segments: [{ startUs: 0, endUs: 40000000, empty: false }],
      },
    ],
  }));
  const runtimeSource = join(home, "runtime"),
    modelSource = join(home, "model");
  await mkdir(join(runtimeSource, "execution"), { recursive: true, mode: 0o700 });
  await mkdir(modelSource);
  await writeFile(join(runtimeSource, "execution/worker.py"), "controlled worker", { mode: 0o700 });
  await writeFile(join(modelSource, "model.nemo"), "controlled model");
  const entries = [
    { kind: "directory" as const, path: "execution", mode: 0o700 },
    {
      kind: "file" as const,
      path: "execution/worker.py",
      mode: 0o700,
      bytes: 17,
      sha256: hash("controlled worker"),
    },
  ];
  const manifest: ModelManifest = {
    name: "speaker-control",
    purpose: "speaker",
    modelSourceRequired: true,
    platform: { system: process.platform, architecture: process.arch },
    repo: "fixture/original30s",
    revision: "r1",
    folderName: "model",
    engine: {
      runtime: "control",
      runtimeVersion: "1",
      runtimeRevision: "r1",
      decoder: "sortformer-original30s",
    },
    files: [{ path: "model.nemo", bytes: 16, sha256: hash("controlled model") }],
    runtimeArtifact: {
      entries,
      digest: hash(JSON.stringify(entries)),
      python: "execution/worker.py",
      entry: "execution/worker.py",
    },
  };
  const models = new Models(home, () => {
    throw new Error("network refused");
  }, [manifest]);
  await models.prepare(manifest.name, new AbortController().signal, { runtimeSource, modelSource });
  const evidence = new SpeakerEvidenceStore(catalog, assetSpeakerOwner(assets, acquisitions));
  const requests: Parameters<SpeakerObserver>[0][] = [];
  const control = { hold: false, deleting: false, fail: false, release: () => {} };
  const observe: SpeakerObserver = async (request) => {
    requests.push(request);
    if (control.hold)
      await new Promise<void>((resolve) => {
        control.release = resolve;
      });
    if (control.fail)
      return {
        pcm: speakerSource.pcm,
        operands: {
          nativeReceipt: nativeOutput(["0.000 30.001 speaker_0"], request.engine.modelSha256)
            .nativeReceipt,
          report: "{}",
        },
        failure: new CatalogError("MODEL_CONTRACT_CHANGED", "Native endpoint is outside support"),
      };
    return {
      pcm: speakerSource.pcm,
      operands: nativeOutput(undefined, request.engine.modelSha256),
    };
  };
  let processing: SpeakerProcessing;
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin: (v) => {
        if (v.kind !== "asset") throw new Error("expected asset");
        assets.get(v.assetId);
        return v;
      },
      isAvailable: () => !control.deleting,
      isDeleting: () => control.deleting,
      isCapturing: () => false,
    },
    execute: (execution) => processing.execute(execution),
  });
  const decoder = { ...speakerSource.decoder };
  processing = new SpeakerProcessing({
    assets,
    acquisitions,
    models,
    jobs,
    evidence,
    observe,
    decoder,
  });
  cleanup.push(async () => {
    control.release();
    await jobs.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  const input = {
    assetId: asset.id,
    streamId: "a1",
    channel: 1,
    sourceRange: speakerSource.observationRange,
    modelId: manifest.name,
  };
  return { processing, jobs, models, requests, evidence, input, control, home, decoder };
}

test("a repeated explicit observation joins the source job and ready reads need no runtime", async () => {
  const f = await fixture();
  f.processing.prepareSource(f.input);
  f.processing.prepareSource(f.input);
  await expect.poll(() => f.processing.sourceStatus(f.input).state).toBe("ready");
  const status = f.processing.sourceStatus(f.input);
  const metadata = status.published!.evidence;
  expect(
    f.evidence.intervalPage({ identity: metadata }).intervals.map((v) => [v.slot, v.identity]),
  ).toEqual([
    [0, "unknown"],
    [1, "unknown"],
  ]);
  expect(
    f.requests.map((v) => ({ channel: v.selected.channel, range: v.selected.sourceRange })),
  ).toEqual([{ channel: 1, range: f.input.sourceRange }]);
  await rm(join(f.home, "models", f.input.modelId), { recursive: true });
  expect(f.processing.sourceStatus(f.input)).toEqual(status);
});

test("cancellation drains a held worker and explicit retry publishes a fresh generation", async () => {
  const f = await fixture();
  f.control.hold = true;
  f.processing.prepareSource(f.input);
  await expect.poll(() => f.requests.length).toBe(1);
  const jobId = f.processing.sourceStatus(f.input).jobId!;
  const first = f.jobs.job(jobId).attemptId;
  const draining = f.jobs.drainJob(jobId);
  f.control.release();
  await draining;
  expect(f.processing.sourceStatus(f.input).published).toBeNull();
  expect(() =>
    f.evidence.metadata({
      owner: { kind: "asset", assetId: f.input.assetId },
      sourceId: f.input.assetId,
      generation: first,
      policy: "speaker-v1",
    }),
  ).toThrow("not ready");
  f.control.hold = false;
  f.jobs.retry(jobId);
  await expect.poll(() => f.processing.sourceStatus(f.input).state).toBe("ready");
  expect(f.processing.sourceStatus(f.input).published!.evidence.generation).not.toBe(first);
});

test("native refusals retain exact original operands but never expose ready intervals", async () => {
  const f = await fixture();
  f.control.fail = true;
  f.processing.prepareSource(f.input);
  await expect.poll(() => f.processing.sourceStatus(f.input).state).toBe("failed");
  const status = f.processing.sourceStatus(f.input),
    job = f.jobs.job(status.jobId!);
  const identity = {
    owner: { kind: "asset" as const, assetId: f.input.assetId },
    sourceId: f.input.assetId,
    generation: job.attemptId,
    policy: "speaker-v1" as const,
  };
  const expected = {
    nativeReceipt: nativeOutput(
      ["0.000 30.001 speaker_0"],
      f.models.speaker(f.input.modelId).engine.modelSha256,
    ).nativeReceipt,
    report: "{}",
  };
  await f.processing.cleanupAsset(f.input.assetId);
  expect(f.evidence.capturedOperands(identity)).toEqual(expected);
  expect(job.errorCode).toBe("MODEL_CONTRACT_CHANGED");
  expect(job.errorDetails).toMatchObject({
    generation: job.attemptId,
    nativeReceiptSha256: hash(expected.nativeReceipt),
    verified: false,
  });
  expect(status.published).toBeNull();
  expect(() => f.evidence.intervalPage({ identity })).toThrow("not ready");
});

test("retained reads bind the original decoder after native identity replacement", async () => {
  const f = await fixture();
  f.processing.prepareSource(f.input);
  await expect.poll(() => f.processing.sourceStatus(f.input).state).toBe("ready");
  const original = f.processing.sourceStatus(f.input);
  f.decoder.workerSha256 = hash("replacement native executable");
  f.decoder.osBuild = "replacement OS build";
  const replacement = f.processing.sourceStatus(f.input);
  await writeFile(
    join(f.home, "decoder-read-comparison.json"),
    JSON.stringify({ original, replacement }),
  );
  expect(replacement).toEqual(original);
  expect(f.processing.prepareSource(f.input)).toEqual(original);
  expect(f.processing.sourceStatus({ ...f.input, channel: 0 }).published).toBeNull();
  expect(f.requests.length).toBe(1);
  await rm(join(f.home, "models", f.input.modelId), { recursive: true });
  expect(f.processing.sourceStatus(f.input)).toEqual(original);
});
