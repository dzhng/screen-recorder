import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { JobQueue } from "./jobs.js";
import { TranscriptStore, type SpeechTranscriber } from "./transcript.js";
import {
  TranscriptProcessing,
  assetTranscriptOwner,
  type TranscriptionModels,
} from "./transcript-processing.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture() {
  const home = await mkdtemp("/tmp/asset-transcript-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const acquisitions = new AcquisitionStore(catalog);
  const path = join(home, "external.mov");
  await writeFile(path, "two audio streams and one picture");
  const asset = await assets.import(path, { kind: "import" }, async () => ({
    originUs: 250000,
    streams: ["track:1", "track:2", "track:3"].map((id) => ({
      id,
      kind: id === "track:3" ? "video" : "audio",
      codec: "fixture",
      decodable: true,
      startUs: 100,
      endUs: 1000,
      segments: [{ startUs: 100, endUs: 1000, empty: false }],
    })),
  }));
  let modelDigest = "a".repeat(64);
  const models: TranscriptionModels & { state: "absent" | "ready" | "preparing" | "failed" } = {
    state: "ready",
    status: () =>
      models.state === "preparing"
        ? { state: "preparing", receivedBytes: 0, totalBytes: 1 }
        : models.state === "failed"
          ? { state: "failed", code: "fixture", message: "fixture", retryable: true }
          : { state: models.state },
    nativeRequest: () => ({ directory: join(home, "models"), files: [] }),
    get modelDigest() {
      return modelDigest;
    },
    pins: {
      runtime: "FluidAudio",
      runtimeVersion: "0.15.7",
      runtimeRevision: "runtime",
      decoder: "parakeet-tdt-batch",
      model: "model",
      modelRevision: "revision",
    },
  };
  const transcripts = new TranscriptStore(
    catalog,
    home,
    assetTranscriptOwner(assets, acquisitions),
  );
  let processing: TranscriptProcessing;
  const requests: Parameters<SpeechTranscriber>[0][] = [];
  const control = { fail: false, hold: false };
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin: (target) => {
        if (target.kind !== "asset") throw new Error("Unexpected owner");
        assets.get(target.assetId);
        return target;
      },
      isAvailable: () => true,
      isDeleting: () => false,
      isCapturing: () => false,
    },
    execute: (job) => processing.execute(job),
  });
  processing = new TranscriptProcessing({
    jobs,
    transcripts,
    models,
    asset: { assets, acquisitions },
    transcribe: async (request, signal) => {
      requests.push(request);
      if (control.hold)
        await new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
        );
      if (control.fail) throw new Error("fixture transcription failure");
      const lines = request.track.available.map((source, ordinal) => ({
        ordinal,
        source,
        state: "transcribed" as const,
        words: [
          {
            text: request.track.streamId!,
            source: { startUs: source.startUs + 10, endUs: source.endUs - 10 },
            confidence: 0.8,
          },
        ],
      }));
      const body = lines.map((line) => JSON.stringify(line) + "\n").join("");
      await writeFile(request.output, body);
      return {
        output: {
          file: request.output,
          bytes: Buffer.byteLength(body),
          sha256: createHash("sha256").update(body).digest("hex"),
        },
        engine: {
          runtime: models.pins.runtime,
          runtimeVersion: models.pins.runtimeVersion,
          decoder: models.pins.decoder,
          encoderPrecision: "int8",
          computeUnits: "cpuAndNeuralEngine",
        },
        segments: lines.map(({ words, ...line }) => ({ ...line, wordCount: words.length })),
        wordCount: lines.length,
      };
    },
  });
  cleanup.push(async () => {
    await jobs.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  return {
    home,
    catalog,
    assets,
    acquisitions,
    asset,
    jobs,
    models,
    processing,
    transcripts,
    requests,
    control,
    changeModel: (value: string) => {
      modelDigest = value;
    },
    selection: { assetId: asset.id, streamId: "track:2" },
  };
}

test("selected source admission retains its real asset and publishes normalized words without a recording", async () => {
  const f = await fixture();
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const status = f.processing.sourceStatus(f.selection);
  expect(f.requests[0]!.track).toEqual({
    source: f.assets.path(f.asset.id),
    streamId: "track:2",
    sourceOffsetUs: -250000,
    available: [{ startUs: 100, endUs: 1000 }],
  });
  expect(f.assets.references(f.asset.id)).toContainEqual({ kind: "job", id: status.jobId });
  expect(
    f.transcripts
      .wordRecords(status.published!.transcript, { limit: 5 })
      .map((word) => ({ text: word.text, startUs: word.startUs, endUs: word.endUs })),
  ).toEqual([{ text: "track:2", startUs: 110, endUs: 990 }]);
  const raw = await readFile(f.requests[0]!.output, "utf8");
  expect(raw).toContain('"track:2"');
  f.processing.prepareSource(f.selection);
  expect(f.requests).toHaveLength(1);
  expect(
    f.catalog.catalog.prepare("SELECT name FROM sqlite_master WHERE name='recordings'").all(),
  ).toEqual([]);
});

test("model readiness and failure stay explicit, reads never retry and explicit retry creates a fresh attempt", async () => {
  const f = await fixture();
  for (const state of ["absent", "preparing", "failed"] as const) {
    f.models.state = state;
    expect(f.processing.publishedSource(f.selection)).toMatchObject({
      state: "unavailable",
      reason: "model_not_prepared",
      jobId: null,
      models: { state },
    });
    expect(() => f.processing.retrySource(f.selection)).toThrow("model_not_prepared");
  }
  expect(f.requests).toEqual([]);
  f.models.state = "ready";
  f.control.fail = true;
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("failed");
  const failed = f.processing.sourceStatus(f.selection);
  const attempt = f.jobs.job(failed.jobId!).attemptId;
  f.processing.publishedSource(f.selection);
  expect(f.requests).toHaveLength(1);
  f.control.fail = false;
  f.processing.retrySource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  expect(f.processing.sourceStatus(f.selection).published!.generation).not.toBe(attempt);
  expect(f.requests).toHaveLength(2);
  await expect(readFile(f.requests[0]!.output)).rejects.toMatchObject({ code: "ENOENT" });
});

test("cancelled attempts are not revived by reads; cleanup preserves other published source generations", async () => {
  const f = await fixture();
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const retained = f.processing.sourceStatus(f.selection).published!.transcript;
  f.control.hold = true;
  const first = { ...f.selection, streamId: "track:1" };
  f.processing.prepareSource(first);
  await expect.poll(() => f.requests.length).toBe(2);
  const id = f.processing.sourceStatus(first).jobId!;
  await f.jobs.drainJob(id);
  f.processing.publishedSource(first);
  expect(f.requests).toHaveLength(2);
  f.control.hold = false;
  f.processing.retrySource(first);
  await expect.poll(() => f.processing.sourceStatus(first).state).toBe("ready");
  await f.processing.cleanup(new AbortController().signal);
  expect(f.transcripts.wordRecords(retained, { limit: 10 }).map((word) => word.text)).toEqual([
    "track:2",
  ]);
  expect(f.processing.sourceStatus(first).published!.generation).not.toBe(retained.generation);
  expect(() => f.processing.prepareSource({ ...f.selection, streamId: "track:3" })).toThrow(
    "audio stream",
  );
});

test("explicit acquisition masks separate jobs for the same bytes and retain the context", async () => {
  const f = await fixture();
  // Immutable acquisition metadata is seeded at the import boundary; acquisition tests exercise
  // actual journal adoption. This test isolates the selected support passed to inference.
  for (const [id, available] of [
    [
      "masked",
      [
        { startUs: 200, endUs: 400 },
        { startUs: 600, endUs: 800 },
      ],
    ],
    ["empty", []],
  ] as const) {
    f.catalog.catalog
      .prepare("INSERT INTO acquisitions VALUES(?,?,?,?,?)")
      .run(
        id,
        id,
        "fixture",
        "{}",
        JSON.stringify({ id, bindings: [{ assetId: f.asset.id, streamId: "track:2", available }] }),
      );
  }
  const masked = { ...f.selection, acquisitionId: "masked" };
  f.processing.prepareSource(masked);
  await expect.poll(() => f.processing.sourceStatus(masked).state).toBe("ready");
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const status = f.processing.sourceStatus(masked);
  expect(status.jobId).not.toBe(f.processing.sourceStatus(f.selection).jobId);
  expect(f.requests[0]!.track.available).toEqual([
    { startUs: 200, endUs: 400 },
    { startUs: 600, endUs: 800 },
  ]);
  expect(f.acquisitions.references("masked")).toEqual([{ kind: "job", id: status.jobId }]);
  expect(f.processing.publishedSource({ ...f.selection, acquisitionId: "empty" })).toMatchObject({
    state: "unavailable",
    reason: "no_audio",
    jobId: null,
  });
  expect(f.requests).toHaveLength(2);
  expect(f.jobs.job(status.jobId!).input).not.toContain('"available"');
});

test("a new model digest creates new immutable work while cleanup retains the earlier published words", async () => {
  const f = await fixture();
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const original = f.processing.sourceStatus(f.selection);
  f.changeModel("b".repeat(64));
  expect(f.processing.sourceStatus(f.selection).state).toBe("not_requested");
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const latest = f.processing.sourceStatus(f.selection);
  expect(latest.jobId).not.toBe(original.jobId);
  expect(latest.published!.transcript.engine.modelDigest).toBe("b".repeat(64));
  await f.processing.cleanup(new AbortController().signal);
  expect(
    f.transcripts
      .wordRecords(original.published!.transcript, { limit: 10 })
      .map((word) => word.text),
  ).toEqual(["track:2"]);
});

test("current decoder work separates source recipes while retained evidence stays readable", async () => {
  const f = await fixture();
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const previous = f.processing.sourceStatus(f.selection);
  const metadata = previous.published!.transcript;
  const original = f.transcripts.wordRecords(metadata, { limit: 100 });
  const row = f.catalog.catalog
    .prepare("SELECT input FROM jobs WHERE jobId=?")
    .get(previous.jobId) as { input: string };
  const oldRecipe = JSON.parse(row.input);
  delete oldRecipe.decoderExecution;
  const oldInput = JSON.stringify(oldRecipe);
  f.catalog.catalog.prepare("UPDATE jobs SET input=? WHERE jobId=?").run(oldInput, previous.jobId);
  f.catalog.catalog
    .prepare("UPDATE artifacts SET input=? WHERE targetId=? AND artifact='transcript'")
    .run(oldInput, f.asset.id);
  expect(f.processing.sourceStatus(f.selection).state).toBe("not_requested");
  f.processing.prepareSource(f.selection);
  await expect.poll(() => f.processing.sourceStatus(f.selection).state).toBe("ready");
  const current = f.processing.sourceStatus(f.selection);
  expect(current.jobId).not.toBe(previous.jobId);
  expect(current.published!.transcript.generation).not.toBe(metadata.generation);
  expect(f.requests).toHaveLength(2);
  await f.processing.cleanup(new AbortController().signal);
  expect(f.transcripts.wordRecords(metadata, { limit: 100 })).toEqual(original);
  expect(metadata.engine.policy).toBe("transcript-v1");
});
