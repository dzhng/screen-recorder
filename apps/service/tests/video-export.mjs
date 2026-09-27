import { withArchiveCopyBarrier } from "../../macos/tests/fixtures/archive-copy-barrier.mjs";
import { SceneProcessing } from "@screenrec/core/scene-processing";
import { IndexProcessing } from "@screenrec/core/index-processing";
import { admitArchive } from "../dist/archive-input.js";
import { openPackageArchive } from "../dist/package-archive.js";
import { callLocal } from "@screenrec/client";
import { launchReady, socketPath, waitFor } from "../../macos/tests/harness.mjs";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { fork, spawnSync } from "node:child_process";
import {
  mkdtemp,
  open,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
  stat,
  rename,
  chmod,
  realpath,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { RecordingStorage } from "@screenrec/core/storage";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import { DerivedCache } from "@screenrec/core/cache";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { SourceProcessing } from "@screenrec/core/processing";
import { PreviewInspection } from "@screenrec/core/preview";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { TranscriptStore } from "@screenrec/core/transcript";
import { TranscriptProcessing } from "@screenrec/core/transcript-processing";
import { Publication } from "../dist/publication.js";
import { RecordingExports } from "../dist/exports.js";
import { RecordingDeletion } from "../dist/deletion.js";
import { DerivativeDelivery } from "../dist/delivery.js";
import { PackageInspection } from "../dist/packages.js";
import { ManagedFiles } from "../dist/managed-files.js";
import { mediaWorker } from "../dist/worker.js";
import { journalRows } from "../../macos/tests/fixtures/generated-capture.mjs";
const binary = process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native");
const native = mediaWorker({ SCREENREC_NATIVE: binary });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const speechEngine = {
  runtime: "FluidAudio",
  runtimeVersion: "0.15.7",
  decoder: "parakeet-tdt-batch",
  encoderPrecision: "float16",
  computeUnits: "cpuAndNeuralEngine",
};
/** Stands in for native speech: words every 250 ms of each readable narration interval, never in gaps. */
function fakeTranscriber(speech) {
  const texts = ["Um,", "hello", "world.", "hello", "again"];
  return async (request) => {
    speech.requests++;
    if (speech.fail) throw new Error(speech.fail);
    let spoken = 0;
    const lines = request.track.available.map((interval, ordinal) => {
      const words = [];
      for (let at = interval.startUs + 50_000; at + 200_000 <= interval.endUs; at += 250_000) {
        const source = { startUs: at, endUs: at + 200_000 };
        words.push({ text: texts[spoken++ % texts.length], ...source, source, confidence: 0.9 });
      }
      return { ordinal, source: interval, state: "transcribed", words };
    });
    const body = lines.map((line) => `${JSON.stringify(line)}\n`).join("");
    await writeFile(request.output, body);
    return {
      output: { file: request.output, bytes: Buffer.byteLength(body), sha256: sha(body) },
      engine: speechEngine,
      segments: lines.map(({ words, ...line }) => ({ ...line, wordCount: words.length })),
      wordCount: spoken,
    };
  };
}
async function fixture(
  t,
  wrap = (value) => value,
  existing,
  { warm = true, admission = true } = {},
) {
  const home = existing?.home ?? (await mkdtemp("/tmp/screenrec-video-export-"));
  const output = existing?.output ?? (await mkdtemp("/tmp/screenrec-video-destination-"));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const take = existing ? store.get(existing.recordingId) : store.allocate().recording;
  if (!existing) {
    store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "generated",
      sourceDurationUs: 2000000,
    });
    const source = join(home, "recordings", take.recordingId, "source");
    await mkdir(source, { recursive: true, mode: 0o700 });
    const made = spawnSync(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=gray:s=160x90:r=1:d=2",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        join(source, "video.mov"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(made.status, 0, made.stderr);
    const rows = journalRows({
      sourceId: take.sourceId,
      width: 160,
      height: 90,
      samples: [],
      pauses: [],
    });
    await writeFile(
      join(source, "capture.journal.jsonl"),
      rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
    );
  }
  const cache = new DerivedCache(store, home);
  await cache.reconcile();
  const evidence = new SourceEvidenceStore(store);
  let processing, preview, exports, sceneOwner, indexOwner, transcriptOwner;
  const sceneEvidence = new SceneEvidenceStore(store);
  const indexEvidence = new ScreenshotIndexStore(store, home);
  const transcriptEvidence = new TranscriptStore(store, home);
  const speech = { models: "ready", fail: null, requests: 0 };
  let recoverOnCapacity = false;
  const recoveryErrors = [];
  const worker = wrap(native);
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
    providers: { newId: randomUUID },
    onCapacity: () => {
      if (recoverOnCapacity) recoveryErrors.push(...exports.resumeRecovery());
    },
    execute: (execution) =>
      ["export-recording", "export-recovery"].includes(execution.job.artifact)
        ? exports.execute(execution)
        : execution.job.artifact === "source-scenes"
          ? sceneOwner.execute(execution)
          : execution.job.artifact === "screenshot-index"
            ? indexOwner.execute(execution)
            : execution.job.artifact === "transcript"
              ? transcriptOwner.execute(execution)
              : execution.job.artifact === "preview"
                ? preview.execute(execution)
                : processing.execute(execution),
  });
  const call = async (op, params, signal) => {
    const result = await worker(op, params, { signal });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  processing = new SourceProcessing(
    store,
    jobs,
    evidence,
    home,
    (directory, output, signal) => call("media.sourceEvidence", { directory, output }, signal),
    (recordingId, generation) => exports.retainsSource(recordingId, generation),
  );
  preview = new PreviewInspection(store, jobs, cache, evidence, processing, home, (r, signal) =>
    call(
      "media.renderMovie",
      { source: r.source, plan: r.plan, tracks: r.tracks, output: r.output },
      signal,
    ),
  );
  const sample = ({ source, kept, atSourceUs }, signal) =>
    call("media.visualSamples", { source, kept, atSourceUs }, signal);
  sceneOwner = new SceneProcessing(
    store,
    jobs,
    sceneEvidence,
    home,
    sample,
    (recordingId, generation) => exports.retainsScenes(recordingId, generation),
  );
  indexOwner = new IndexProcessing(
    store,
    jobs,
    indexEvidence,
    processing,
    sceneOwner,
    { source: evidence, scenes: sceneEvidence },
    home,
    { decode: (params, signal) => call("media.frame", params, signal), sample },
    (recordingId, generation) => exports.retainsIndex(recordingId, generation),
  );
  transcriptOwner = new TranscriptProcessing(
    store,
    jobs,
    transcriptEvidence,
    processing,
    evidence,
    {
      status: () => ({ state: speech.models }),
      nativeRequest: () => ({ directory: join(home, "models"), files: [] }),
      modelDigest: "a".repeat(64),
      pins: {
        ...speechEngine,
        runtimeRevision: "41540ea237350afe5117a082b5c28eda642d0612",
        model: "FluidInference/parakeet-tdt-0.6b-v2-coreml",
        modelRevision: "ee09c569f73759e6d44c9bd16766f477b2b36d39",
      },
    },
    home,
    fakeTranscriber(speech),
    (recordingId, generation) => exports.retainsTranscript(recordingId, generation),
  );
  const files = new ManagedFiles(home, worker);
  exports = new RecordingExports({
    store,
    jobs,
    cache,
    preview,
    processing,
    worker,
    files,
    package: {
      scenes: sceneOwner,
      index: indexOwner,
      transcript: transcriptOwner,
      source: evidence,
      sceneEvidence,
      indexEvidence,
      transcriptEvidence,
    },
  });
  const storage = new RecordingStorage(store, cache, home, (recordingId, signal) =>
    exports.usage(recordingId, signal),
  );
  if (admission) jobs.startAdmission((job) => exports.admit(job));
  if (warm) processing.prepare(take.recordingId);
  await jobs.idle();
  // A video export consumes the full-resolution rendition, not the audition a person plays.
  const rendition = "source";
  if (warm) preview.request({ recordingId: take.recordingId, rendition });
  await jobs.idle();
  const ready = warm ? preview.request({ recordingId: take.recordingId, rendition }) : null;
  if (warm) assert.equal(ready.state, "ready");
  const delivery = new DerivativeDelivery();
  const deletion = new RecordingDeletion({
    store,
    jobs,
    cache,
    source: evidence,
    scenes: sceneEvidence,
    index: indexEvidence,
    transcripts: transcriptEvidence,
    capture: { quiesce: async () => {} },
    delivery,
    cleanupReady: async () => {},
    files,
    exports,
  });
  let closed = false;
  async function closeOwners() {
    if (closed) return;
    closed = true;
    await storage.close();
    await deletion.close();
    await jobs.close();
    await exports.close();
    delivery.dispose();
    store.close();
  }
  t.after(async () => {
    await closeOwners();
    if (!existing) {
      await rm(home, { recursive: true, force: true });
      await rm(output, { recursive: true, force: true });
    }
  });
  return {
    home,
    output,
    store,
    take,
    cache,
    jobs,
    preview,
    exports,
    deletion,
    ready,
    processing,
    evidence,
    sceneOwner,
    indexOwner,
    sceneEvidence,
    indexEvidence,
    transcriptOwner,
    speech,
    worker,
    closeOwners,
    storage,
    recoveryErrors,
    startRecovery: () => {
      recoverOnCapacity = true;
      return exports.resumeRecovery();
    },
  };
}
async function crashFixture(t, gap, reopenWrap) {
  const f = await fixture(t),
    exportId = randomUUID();
  const hold = f.jobs.createContext(
    ({ signal }) =>
      new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve("closed"), { once: true }),
      ),
  );
  f.jobs.submitContext(hold, { artifact: "held", input: "fixture", lane: "heavy" });
  await new Promise(setImmediate);
  await f.exports.create({
    exportId,
    recordingId: f.take.recordingId,
    kind: "video",
    directory: f.output,
    leaf: "recovered.mp4",
  });
  await f.closeOwners();
  const existing = { home: f.home, output: f.output, recordingId: f.take.recordingId };
  const child = fork(
    fileURLToPath(import.meta.url),
    ["crash-owner", JSON.stringify(existing), gap],
    {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
      env: { ...process.env, SCREENREC_NATIVE: binary },
    },
  );
  t.after(() => child.kill("SIGKILL"));
  await once(child, "message", { signal: AbortSignal.timeout(20000) });
  const closed = once(child, "close");
  assert.equal(child.kill("SIGKILL"), true);
  assert.deepEqual(await closed, [null, "SIGKILL"]);
  const reopened = await fixture(t, reopenWrap, existing);
  return { f, reopened, exportId };
}
async function packageCrashFixture(t, gap) {
  const f = await fixture(t, undefined, undefined, {
    warm: false,
    admission: false,
  });
  const exportId = randomUUID();
  await f.exports.create({
    kind: "processed-package",
    exportId,
    recordingId: f.take.recordingId,
    directory: f.output,
    leaf: "recovered.zip",
  });
  await f.closeOwners();
  const existing = { home: f.home, output: f.output, recordingId: f.take.recordingId };
  const child = fork(
    fileURLToPath(import.meta.url),
    ["crash-owner", JSON.stringify(existing), gap],
    {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
      env: { ...process.env, SCREENREC_NATIVE: binary },
    },
  );
  t.after(() => child.kill("SIGKILL"));
  await once(child, "message", { signal: AbortSignal.timeout(20000) });
  const terminal = once(child, "close");
  child.kill("SIGKILL");
  assert.deepEqual(await terminal, [null, "SIGKILL"]);
  const reopened = await fixture(t, undefined, existing, { warm: false });
  return { reopened, exportId };
}
async function receiptCrash(t, mode = "write") {
  let limited,
    interrupt = true;
  const f = await fixture(t, (run) => async (op, ...args) => {
      if (op === "publication.prepare" && interrupt) {
        interrupt = false;
        return limited(op, ...args);
      }
      return run(op, ...args);
    }),
    exportId = randomUUID();
  const library = join(f.home, "receipt-fault.dylib"),
    executable = join(f.home, "receipt-fault-worker");
  const compiled = spawnSync(
    "clang",
    [
      "-dynamiclib",
      resolve("helpers/mac/Tests/fixtures/publication-write-interpose.c"),
      "-o",
      library,
    ],
    { encoding: "utf8" },
  );
  assert.equal(compiled.status, 0, compiled.stderr);
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  await writeFile(
    executable,
    `#!/bin/sh\nSCREENREC_RECEIPT_FAULT=${quote(mode)} DYLD_INSERT_LIBRARIES=${quote(library)} exec ${quote(binary)}\n`,
    { mode: 0o700 },
  );
  limited = mediaWorker({ SCREENREC_NATIVE: executable });
  await f.exports.create({
    exportId,
    recordingId: f.take.recordingId,
    kind: "video",
    directory: f.output,
    leaf: "retry.mp4",
  });
  await f.jobs.idle();
  return { f, exportId, stage: join(f.output, ".screenrec-export-" + exportId) };
}
if (process.argv[2] === "crash-owner") {
  process.on("message", () => {});
  const existing = JSON.parse(process.argv[3]),
    gap = process.argv[4];
  const crashed = await fixture(
    { after: () => {} },
    (run) =>
      async (op, ...args) => {
        if (gap === "ack" && op === "publication.acknowledge") {
          process.send({ gap });
          await new Promise(() => {});
        }
        if (gap === "package-survivor" && op === "archive.write") {
          const environment = {
            DYLD_INSERT_LIBRARIES: existing.library,
            SCREENREC_TEST_COPY_BARRIER: existing.marker,
            SCREENREC_TEST_COPY_PARTIAL: "0",
            SCREENREC_TEST_COPY_MIN_FD: "6",
          };
          Object.assign(process.env, environment);
          try {
            return run(op, ...args);
          } finally {
            for (const key of Object.keys(environment)) delete process.env[key];
          }
        }
        const result = await run(op, ...args);
        if (
          (gap === "commit" && op === "publication.commit") ||
          (gap === "allocate" && op === "publication.allocate") ||
          (gap === "abandon" && op === "publication.retire") ||
          (gap === "package-create" && op === "packageWorkspace.create") ||
          (gap === "package-copy" && op === "archive.copy") ||
          (gap === "package-write" && op === "archive.write") ||
          (gap === "package-commit" && op === "publication.commit") ||
          (gap === "package-cleanup" && op === "packageWorkspace.remove")
        ) {
          process.send({ gap });
          await new Promise(() => {});
        }
        return result;
      },
    existing,
    gap.startsWith("package-") ? { warm: false } : {},
  );
  if (gap === "abandon") await crashed.exports.abandon(existing.exportId);
} else {
  test("export discovery pages pinned summaries without admitting work and binds cursor filters", async (t) => {
    const f = await fixture(t, (value) => value, undefined, { admission: false });
    const ids = [1, 2, 3].map((value) => `${value}0000000-0000-4000-8000-000000000000`);
    for (const exportId of ids)
      await f.exports.create({
        kind: "video",
        exportId,
        recordingId: f.take.recordingId,
        directory: f.output,
        leaf: exportId + ".mp4",
      });
    const page = f.exports.list({ limit: 2, unfinishedOnly: true });
    assert.deepEqual(
      page.exports.map((row) => row.exportId),
      ids.slice(0, 2),
    );
    assert.deepEqual(page.exports[0], {
      exportId: ids[0],
      recordingId: f.take.recordingId,
      kind: "video",
      revisionId: "r0",
      state: "queued",
      abandoning: false,
      cleanupPending: false,
    });
    assert.throws(() => f.exports.list({ cursor: page.nextCursor }), /cursor.*filters/i);
    assert.throws(
      () =>
        f.exports.list({
          unfinishedOnly: true,
          recordingId: f.take.recordingId,
          cursor: page.nextCursor,
        }),
      /cursor.*filters/i,
    );
    assert.deepEqual(
      f.exports
        .list({ unfinishedOnly: true, cursor: page.nextCursor })
        .exports.map((row) => row.exportId),
      ids.slice(2),
    );
    const arrival = "00000000-0000-4000-8000-000000000000";
    await f.exports.create({
      kind: "video",
      exportId: arrival,
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "new.mp4",
    });
    assert.deepEqual(
      f.exports
        .list({ unfinishedOnly: true, cursor: page.nextCursor })
        .exports.map((row) => row.exportId),
      [ids[2]],
    );
    assert.equal(f.exports.list({ unfinishedOnly: true }).exports[0].exportId, arrival);
    assert.deepEqual(f.exports.list({ recordingId: randomUUID() }).exports, []);
    await f.exports.abandon(arrival);
    await f.exports.abandon(ids[1]);
    assert.deepEqual(
      f.exports.list({}).exports.map((row) => row.exportId),
      [ids[0], ids[2]],
    );
    assert.deepEqual(await readdir(f.output), []);
    assert.equal(f.exports.status(ids[0]).state, "queued");
  });
  test("explicit recovery refreshes a negative observation when the same committed file returns", async (t) => {
    const { reopened: f, exportId } = await crashFixture(t, "commit");
    const destination = join(f.output, "recovered.mp4"),
      moved = join(f.output, "moved.mp4");
    const before = await stat(destination, { bigint: true });
    await rename(destination, moved);
    f.exports.resumeRecovery();
    await f.jobs.idle();
    const missing = f.exports.status(exportId);
    assert.equal(missing.receipt, null);
    assert.equal(JSON.parse(missing.recovery.published.result).observation, "missing");
    const attempt = f.jobs.job(missing.recovery.jobId).attemptId;
    await rename(moved, destination);
    f.exports.resumeRecovery();
    assert.equal(f.jobs.job(missing.recovery.jobId).attemptId, attempt);
    f.exports.recover(exportId);
    await f.jobs.idle();
    const restored = f.exports.status(exportId);
    assert.equal(restored.state, "committed");
    assert.notEqual(f.jobs.job(restored.recovery.jobId).attemptId, attempt);
    assert.equal((await stat(destination, { bigint: true })).ino, before.ino);
  });

  test("abandonment drains and forgets recovery identities without touching neighboring intents", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    let intercept = false;
    const f = await fixture(t, (run) => async (operation, ...args) => {
      const result = await run(operation, ...args);
      if (operation === "publication.reconcile" && intercept) {
        entered.resolve();
        await release.promise;
      }
      return result;
    });
    const ids = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"];
    for (const exportId of ids) {
      await writeFile(join(f.output, exportId + ".mp4"), "foreign");
      await f.exports.create({
        exportId,
        recordingId: f.take.recordingId,
        kind: "video",
        directory: f.output,
        leaf: exportId + ".mp4",
      });
      await f.jobs.idle();
    }
    intercept = true;
    f.exports.resumeRecovery();
    await entered.promise;
    const firstRecovery = f.exports.status(ids[0]).recovery.jobId;
    const siblingRecovery = f.exports.status(ids[1]).recovery.jobId;
    let finished = false;
    const removing = f.exports.abandon(ids[0]).then(() => {
      finished = true;
    });
    await new Promise(setImmediate);
    assert.equal(finished, false);
    release.resolve();
    await removing;
    await f.jobs.idle();
    assert.throws(() => f.jobs.job(firstRecovery), { code: "NOT_FOUND" });
    assert.equal(f.jobs.job(siblingRecovery).state, "ready");
    assert.equal(f.exports.status(ids[1]).state, "failed");
    assert.equal(f.store.get(f.take.recordingId).recordingId, f.take.recordingId);
    for (const exportId of ids)
      assert.equal(await readFile(join(f.output, exportId + ".mp4"), "utf8"), "foreign");
  });

  test("canceling recovery keeps its lane until close and preserves an actually observed commit", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    const { reopened: f, exportId } = await crashFixture(
      t,
      "commit",
      (run) =>
        async (operation, ...args) => {
          const result = await run(operation, ...args);
          if (operation === "publication.reconcile") {
            entered.resolve();
            await release.promise;
          }
          return result;
        },
    );
    f.exports.resumeRecovery();
    await entered.promise;
    const recovery = f.exports.status(exportId).recovery;
    f.exports.cancel(exportId);
    assert.equal(f.jobs.job(recovery.jobId).state, "canceled");
    assert.equal(f.jobs.isAttemptActive(f.jobs.job(recovery.jobId).attemptId), true);
    release.resolve();
    await f.jobs.idle();
    const committed = f.exports.status(exportId);
    assert.equal(committed.state, "committed");
    assert.equal(f.jobs.job(recovery.jobId).state, "canceled");
    assert.equal(
      f.store.catalog
        .prepare("SELECT stagingCleared FROM export_intents WHERE exportId=?")
        .get(exportId).stagingCleared,
      0,
    );
    assert.deepEqual(f.exports.resumeRecovery(), []);
    assert.equal(f.jobs.job(recovery.jobId).state, "canceled");
    f.exports.recover(exportId);
    await f.jobs.idle();
    assert.equal(
      f.store.catalog
        .prepare("SELECT stagingCleared FROM export_intents WHERE exportId=?")
        .get(exportId).stagingCleared,
      1,
    );
  });

  test("publication uses its known-byte budget instead of the worker's unrelated short default", async (t) => {
    let delayed;
    const f = await fixture(
      t,
      (run) =>
        (operation, ...args) =>
          operation === "publication.prepare"
            ? delayed(operation, ...args)
            : run(operation, ...args),
    );
    const executable = join(f.home, "delayed-publication");
    const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
    await writeFile(executable, `#!/bin/sh\nsleep 0.05\nexec ${quote(binary)}\n`, { mode: 0o700 });
    delayed = mediaWorker({ SCREENREC_NATIVE: executable }, 1);
    const exportId = randomUUID();
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "budget.mp4",
    });
    await f.jobs.idle();
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
    assert.deepEqual(
      await readFile(join(f.output, "budget.mp4")),
      await readFile(f.ready.published.preview.file),
    );
  });

  test("startup admission is bounded and capacity events discover the remaining recovery backlog", async (t) => {
    const f = await fixture(t, (run) => async (operation, ...args) => {
      if (operation === "publication.acknowledge") throw new Error("generated lost acknowledgment");
      return run(operation, ...args);
    });
    for (let n = 0; n < 33; n++) {
      await f.exports.create({
        exportId: randomUUID(),
        recordingId: f.take.recordingId,
        kind: "video",
        directory: f.output,
        leaf: `${n}.mp4`,
      });
      await f.jobs.idle();
    }
    const hold = f.jobs.createContext(
      ({ signal }) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve("closed"), { once: true }),
        ),
    );
    f.jobs.submitContext(hold, { artifact: "hold", input: "recovery-capacity", lane: "heavy" });
    await new Promise(setImmediate);
    assert.deepEqual(f.startRecovery(), []);
    assert.equal(
      f.store.catalog
        .prepare("SELECT COUNT(*) AS count FROM jobs WHERE artifact='export-recovery'")
        .get().count,
      32,
    );
    assert.deepEqual(f.exports.resumeRecovery(), []);
    assert.equal(
      f.store.catalog
        .prepare("SELECT COUNT(*) AS count FROM jobs WHERE artifact='export-recovery'")
        .get().count,
      32,
    );
    await f.jobs.closeContext(hold);
    await f.jobs.idle();
    assert.deepEqual(f.recoveryErrors, []);
    assert.equal(
      f.store.catalog
        .prepare(
          "SELECT COUNT(*) AS count FROM jobs WHERE artifact='export-recovery' AND state='ready'",
        )
        .get().count,
      33,
    );
    assert.equal(
      f.store.catalog
        .prepare("SELECT COUNT(*) AS count FROM export_intents WHERE stagingCleared=0")
        .get().count,
      0,
    );
    assert.deepEqual(
      (await readdir(f.output)).sort(),
      Array.from({ length: 33 }, (_, n) => `${n}.mp4`).sort(),
    );
  });

  test("recovery failures are isolated and explicit retry observes absence without publishing", async (t) => {
    let failOnce = false,
      calls = 0;
    const f = await fixture(t, (run) => async (operation, ...args) => {
      if (operation === "publication.reconcile") {
        calls++;
        if (failOnce) {
          failOnce = false;
          throw new Error("generated recovery failure");
        }
      }
      return run(operation, ...args);
    });
    const ids = [randomUUID(), randomUUID()];
    for (const exportId of ids) {
      await writeFile(join(f.output, exportId + ".mp4"), "foreign");
      await f.exports.create({
        exportId,
        recordingId: f.take.recordingId,
        kind: "video",
        directory: f.output,
        leaf: exportId + ".mp4",
      });
      await f.jobs.idle();
      assert.equal(f.exports.status(exportId).state, "failed");
    }
    failOnce = true;
    assert.deepEqual(f.exports.resumeRecovery(), []);
    await f.jobs.idle();
    const states = ids.map((id) => f.exports.status(id));
    assert.deepEqual(states.map((s) => s.recovery.state).sort(), ["failed", "ready"]);
    const failed = states.find((s) => s.recovery.state === "failed");
    const attempt = f.jobs.job(failed.recovery.jobId).attemptId,
      before = calls;
    for (let n = 0; n < 10; n++) {
      assert.deepEqual(f.exports.resumeRecovery(), []);
      f.exports.status(failed.exportId);
    }
    assert.equal(calls, before);
    assert.equal(f.jobs.job(failed.recovery.jobId).attemptId, attempt);
    await rm(join(f.output, failed.exportId + ".mp4"));
    f.exports.recover(failed.exportId);
    await f.jobs.idle();
    const recovered = f.exports.status(failed.exportId);
    assert.equal(recovered.receipt, null);
    assert.equal(recovered.state, "failed");
    assert.equal(recovered.recovery.state, "ready");
    assert.equal(JSON.parse(recovered.recovery.published.result).observation, "missing");
    await assert.rejects(stat(join(f.output, failed.exportId + ".mp4")), { code: "ENOENT" });
    assert.notEqual(f.jobs.job(recovered.recovery.jobId).attemptId, attempt);
  });

  test("an acknowledged export leaves only its file and never needs the destination again", async (t) => {
    let nativeCalls = 0;
    const f = await fixture(t, (run) => async (...args) => {
      nativeCalls++;
      return run(...args);
    });
    const exportId = randomUUID();
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "moved.mp4",
    });
    await f.jobs.idle();
    assert.deepEqual(await readdir(f.output), ["moved.mp4"]);
    const moved = f.output + "-moved";
    t.after(() => rm(moved, { recursive: true, force: true }));
    await rename(f.output, moved);
    const before = nativeCalls;
    assert.equal((await f.exports.retry(exportId)).state, "committed");
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
    await f.exports.abandon(exportId);
    assert.equal(nativeCalls, before);
    assert.throws(() => f.exports.status(exportId), { code: "NOT_FOUND" });
    assert.deepEqual(await readdir(moved), ["moved.mp4"]);
  });

  test("recording deletion needs no removed, moved or replaced export destination", async (t) => {
    const f = await fixture(t);
    const directories = [f.output, f.output + "-failed", f.output + "-replaced"];
    t.after(() =>
      Promise.all(directories.slice(1).map((path) => rm(path, { recursive: true, force: true }))),
    );
    for (const directory of directories.slice(1)) await mkdir(directory);
    await writeFile(join(directories[1], "taken.mp4"), "foreign");
    await writeFile(join(directories[2], "taken.mp4"), "foreign");
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, directory] of directories.entries()) {
      await f.exports.create({
        exportId: ids[i],
        recordingId: f.take.recordingId,
        kind: "video",
        directory,
        leaf: i === 0 ? "committed.mp4" : "taken.mp4",
      });
      await f.jobs.idle();
    }
    assert.deepEqual(
      ids.map((id) => [f.exports.status(id).state, f.exports.status(id).cleanupPending]),
      [
        ["committed", false],
        ["failed", true],
        ["failed", true],
      ],
    );
    await rm(directories[0], { recursive: true });
    await rm(directories[1], { recursive: true });
    const foreign = join(directories[2], ".screenrec-export-" + ids[2]);
    await rename(directories[2], directories[2] + "-original");
    directories.push(directories[2] + "-original");
    await mkdir(foreign, { recursive: true, mode: 0o700 });
    await writeFile(join(foreign, "payload"), "not this export's");
    assert.equal((await f.storage.usage(f.take.recordingId)).otherBytes, 0);
    await f.deletion.delete(f.take.recordingId);
    assert.equal(f.store.deleting(f.take.recordingId), null);
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
    assert.equal(await readFile(join(foreign, "payload"), "utf8"), "not this export's");
  });

  test("a lost staging retirement after commit is confirmed absent by explicit recovery", async (t) => {
    let lose = true;
    const f = await fixture(t, (run) => async (op, ...args) => {
      const result = await run(op, ...args);
      if (op === "publication.retire" && lose) {
        lose = false;
        throw new Error("lost retirement response");
      }
      return result;
    });
    const exportId = randomUUID();
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "retired.mp4",
    });
    await f.jobs.idle();
    assert.deepEqual(await readdir(f.output), ["retired.mp4"]);
    const pending = f.exports.status(exportId);
    assert.deepEqual([pending.state, pending.cleanupPending], ["committed", true]);
    const recovered = await f.exports.retry(exportId);
    await f.jobs.idle();
    assert.ok(recovered.recovery.jobId);
    assert.equal(f.exports.status(exportId).cleanupPending, false);
    assert.deepEqual(f.exports.list({ unfinishedOnly: true }).exports, []);
  });

  test("startup recovery waits for the shared heavy lane and ignores failed source dependencies", async (t) => {
    let failSource = false;
    const { reopened: f, exportId } = await crashFixture(
      t,
      "commit",
      (run) =>
        async (operation, ...args) => {
          if (operation === "media.sourceEvidence" && failSource)
            throw new Error("generated dependency failure");
          return run(operation, ...args);
        },
    );
    const source = f.processing.status(f.take.recordingId);
    failSource = true;
    f.jobs.regenerate(source.jobId, source.published.generation);
    await f.jobs.idle();
    assert.equal(f.processing.status(f.take.recordingId).state, "failed");
    const failedAttempt = f.jobs.job(source.jobId).attemptId;
    const hold = f.jobs.createContext(
      ({ signal }) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve("closed"), { once: true }),
        ),
    );
    f.jobs.submitContext(hold, { artifact: "hold", input: "startup-recovery", lane: "heavy" });
    await new Promise(setImmediate);
    assert.deepEqual(f.exports.resumeRecovery(), []);
    const before = f.exports.status(exportId);
    assert.equal(before.receipt, null);
    assert.equal(before.recovery.state, "queued");
    for (let n = 0; n < 20; n++) {
      f.exports.status(exportId);
      assert.deepEqual(f.exports.resumeRecovery(), []);
    }
    assert.equal(
      f.store.catalog
        .prepare("SELECT COUNT(*) AS count FROM jobs WHERE artifact='export-recovery'")
        .get().count,
      1,
    );
    await f.jobs.closeContext(hold);
    await f.jobs.idle();
    const after = f.exports.status(exportId);
    assert.equal(after.state, "committed");
    assert.equal(after.recovery.state, "ready");
    assert.equal(f.jobs.job(source.jobId).attemptId, failedAttempt);
    assert.equal(f.processing.status(f.take.recordingId).state, "failed");
  });

  test("late commit releases source evidence but abandonment capacity waits for confirmed retirement", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    let failRetirement = true;
    const f = await fixture(t, (run) => async (operation, ...args) => {
      if (operation === "publication.retire" && failRetirement) {
        failRetirement = false;
        throw new Error("generated retirement interruption");
      }
      const result = await run(operation, ...args);
      if (operation === "publication.commit") {
        entered.resolve();
        await release.promise;
      }
      return result;
    });
    const exportId = randomUUID();
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "late-retire.mp4",
    });
    await entered.promise;
    const removing = f.exports.abandon(exportId);
    const failed = assert.rejects(removing, /generated retirement interruption/);
    release.resolve();
    await failed;
    const status = f.exports.status(exportId),
      generation = f.processing.status(f.take.recordingId).published.evidence.generation;
    assert.equal(status.state, "committed");
    assert.equal(status.abandoning, true);
    assert.equal(f.exports.retainsSource(f.take.recordingId, generation), false);
    assert.equal(
      f.store.catalog
        .prepare(
          "SELECT COUNT(*) AS count FROM export_intents WHERE receipt IS NULL OR abandoning=1",
        )
        .get().count,
      1,
    );
    await f.exports.abandon(exportId);
    assert.equal(
      f.store.catalog
        .prepare(
          "SELECT COUNT(*) AS count FROM export_intents WHERE receipt IS NULL OR abandoning=1",
        )
        .get().count,
      0,
    );
    assert.equal(f.store.get(f.take.recordingId).recordingId, f.take.recordingId);
    assert.deepEqual(await readdir(f.output), ["late-retire.mp4"]);
  });

  test("failed abandonment keeps its fence and pins until verified staging can retire", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    await writeFile(join(f.output, "occupied.mp4"), "foreign");
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "occupied.mp4",
    });
    await f.jobs.idle();
    const generation = f.processing.status(f.take.recordingId).published.evidence.generation;
    const stage = join(f.output, ".screenrec-export-" + exportId),
      saved = stage + "-saved",
      substitute = stage + "-substitute";
    await rename(stage, saved);
    await mkdir(stage, { mode: 0o700 });
    await writeFile(join(stage, "unrelated"), "do not delete");
    await assert.rejects(f.exports.abandon(exportId), { code: "PUBLICATION_CHANGED" });
    assert.deepEqual(
      f.exports
        .list({ unfinishedOnly: true })
        .exports.map((row) => [row.exportId, row.abandoning, row.cleanupPending]),
      [[exportId, true, true]],
    );
    const unfinished = f.exports.status(exportId);
    assert.equal(unfinished.abandoning, true);
    assert.equal(unfinished.cleanupPending, true);
    assert.equal(unfinished.output, null, "an uncommitted export names no output file");
    assert.deepEqual(unfinished.destination, {
      directory: await realpath(f.output),
      leaf: "occupied.mp4",
    });
    assert.equal(f.exports.retainsSource(f.take.recordingId, generation), true);
    assert.equal(
      f.store.catalog
        .prepare("SELECT COUNT(*) AS count FROM export_intents WHERE receipt IS NULL")
        .get().count,
      1,
    );
    assert.equal(await readFile(join(stage, "unrelated"), "utf8"), "do not delete");
    await assert.rejects(f.exports.retry(exportId), { code: "EXPORT_ABANDONING" });
    await rename(stage, substitute);
    await rename(saved, stage);
    await f.exports.abandon(exportId);
    assert.equal(f.exports.retainsSource(f.take.recordingId, generation), false);
    assert.equal(
      f.store.catalog
        .prepare("SELECT COUNT(*) AS count FROM export_intents WHERE receipt IS NULL")
        .get().count,
      0,
    );
    assert.equal(await readFile(join(substitute, "unrelated"), "utf8"), "do not delete");
    assert.equal(await readFile(join(f.output, "occupied.mp4"), "utf8"), "foreign");
    assert.equal(f.store.get(f.take.recordingId).recordingId, f.take.recordingId);
  });

  test("abandonment resumes after actual process death following private retirement", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    await writeFile(join(f.output, "survives.mp4"), "foreign");
    const requested = await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "survives.mp4",
    });
    await f.jobs.idle();
    assert.equal(f.exports.status(exportId).cleanupPending, true);
    const bytes = await readFile(join(f.output, "survives.mp4"));
    await f.closeOwners();
    const existing = { home: f.home, output: f.output, recordingId: f.take.recordingId, exportId };
    const child = fork(
      fileURLToPath(import.meta.url),
      ["crash-owner", JSON.stringify(existing), "abandon"],
      {
        stdio: ["ignore", "ignore", "inherit", "ipc"],
        env: { ...process.env, SCREENREC_NATIVE: binary },
      },
    );
    t.after(() => child.kill("SIGKILL"));
    await once(child, "message", { signal: AbortSignal.timeout(20000) });
    const closed = once(child, "close");
    assert.equal(child.kill("SIGKILL"), true);
    assert.deepEqual(await closed, [null, "SIGKILL"]);
    const reopened = await fixture(t, undefined, existing);
    assert.equal(reopened.exports.status(exportId).abandoning, true);
    await assert.rejects(reopened.exports.retry(exportId), { code: "EXPORT_ABANDONING" });
    await reopened.exports.abandon(exportId);
    assert.throws(() => reopened.exports.status(exportId), { code: "NOT_FOUND" });
    assert.throws(() => reopened.jobs.job(requested.jobId), { code: "NOT_FOUND" });
    assert.equal(reopened.store.get(f.take.recordingId).recordingId, f.take.recordingId);
    assert.deepEqual(await readdir(f.output), ["survives.mp4"]);
    assert.deepEqual(await readFile(join(f.output, "survives.mp4")), bytes);
  });

  test("abandonment fences retries and recording deletion joins its drain after external commit", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    const f = await fixture(t, (run) => async (operation, ...args) => {
      const result = await run(operation, ...args);
      if (operation === "publication.commit") {
        entered.resolve();
        await release.promise;
      }
      return result;
    });
    const exportId = randomUUID(),
      request = {
        exportId,
        recordingId: f.take.recordingId,
        kind: "video",
        directory: f.output,
        leaf: "late.mp4",
      };
    const status = await f.exports.create(request);
    await entered.promise;
    const published = await readFile(join(f.output, "late.mp4"));
    const removing = f.exports.abandon(exportId);
    assert.equal(f.exports.abandon(exportId), removing);
    assert.equal(f.exports.status(exportId).abandoning, true);
    await assert.rejects(f.exports.retry(exportId), { code: "EXPORT_ABANDONING" });
    await assert.rejects(f.exports.create(request), { code: "EXPORT_ABANDONING" });
    let abandoned = false,
      deleted = false;
    removing.then(() => {
      abandoned = true;
    });
    const deleting = f.deletion.delete(f.take.recordingId).then(() => {
      deleted = true;
    });
    let cleanupClosed = false;
    const closing = f.exports.close().then(() => {
      cleanupClosed = true;
    });
    assert.throws(() => f.exports.abandon(exportId), { code: "SERVICE_STOPPED" });
    await new Promise(setImmediate);
    assert.equal(cleanupClosed, false);
    assert.equal(abandoned, false);
    assert.equal(deleted, false);
    assert.equal(f.jobs.isAttemptActive(f.jobs.job(status.jobId).attemptId), true);
    release.resolve();
    await Promise.all([removing, deleting, closing]);
    assert.equal(f.store.deleting(f.take.recordingId), null);
    assert.deepEqual(await readdir(f.output), ["late.mp4"]);
    assert.deepEqual(await readFile(join(f.output, "late.mp4")), published);
  });

  test("abandonment releases a failed export without deleting its recording or external collision", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID(),
      leaf = "foreign.mp4";
    const original = await readFile(
      join(f.home, "recordings", f.take.recordingId, "source", "video.mov"),
    );
    await writeFile(join(f.output, leaf), "foreign output");
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf,
    });
    await f.jobs.idle();
    const status = f.exports.status(exportId),
      source = f.processing.status(f.take.recordingId).published.evidence;
    assert.equal(status.state, "failed");
    assert.equal(f.exports.retainsSource(f.take.recordingId, source.generation), true);
    await f.exports.abandon(exportId);
    await f.exports.abandon(exportId);
    assert.throws(() => f.exports.status(exportId), { code: "NOT_FOUND" });
    assert.throws(() => f.jobs.job(status.jobId), { code: "NOT_FOUND" });
    assert.equal(
      f.jobs.status({
        target: { kind: "recording", recordingId: f.take.recordingId, revisionId: "r0" },
        artifact: "export-recording",
        input: exportId,
      }).published,
      null,
    );
    assert.equal(f.exports.retainsSource(f.take.recordingId, source.generation), false);
    assert.equal(f.store.get(f.take.recordingId).recordingId, f.take.recordingId);
    assert.deepEqual(
      await readFile(join(f.home, "recordings", f.take.recordingId, "source", "video.mov")),
      original,
    );
    assert.equal(await readFile(join(f.output, leaf), "utf8"), "foreign output");
    assert.deepEqual(await readdir(f.output), [leaf]);
    const reused = await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "reused.mp4",
    });
    assert.notEqual(reused.jobId, status.jobId);
    await f.jobs.idle();
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
    await f.exports.abandon(exportId);
    assert.equal(
      f.jobs.status({
        target: { kind: "recording", recordingId: f.take.recordingId, revisionId: "r0" },
        artifact: "export-recording",
        input: exportId,
      }).published,
      null,
    );
    assert.deepEqual((await readdir(f.output)).sort(), [leaf, "reused.mp4"].sort());
  });

  test("failed source readiness is reported without export polling retrying it", async (t) => {
    let calls = 0;
    const f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          if (operation === "media.sourceEvidence" && ++calls === 1)
            throw new Error("generated source failure");
          return run(operation, ...args);
        },
      undefined,
      { warm: false },
    );
    const request = {
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "source-retry.mp4",
    };
    await f.exports.create(request);
    await f.jobs.idle();
    assert.equal(f.exports.status(request.exportId).state, "failed");
    const failed = f.processing.status(f.take.recordingId),
      attempt = f.jobs.job(failed.jobId).attemptId;
    for (let n = 0; n < 10; n++) {
      await f.exports.create(request);
      f.exports.status(request.exportId);
    }
    assert.equal(f.jobs.job(failed.jobId).attemptId, attempt);
    assert.equal(calls, 1);
    f.processing.retry(f.take.recordingId);
    await f.jobs.idle();
    assert.equal(f.exports.status(request.exportId).state, "failed");
    await f.exports.retry(request.exportId);
    await f.jobs.idle();
    assert.equal(f.exports.status(request.exportId).state, "committed");
    assert.equal(calls, 2);
  });

  test("canceled intents keep exact-retry pins within a bounded uncommitted allowance", async (t) => {
    const f = await fixture(t);
    const hold = f.jobs.createContext(
      ({ signal }) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve("closed"), { once: true }),
        ),
    );
    f.jobs.submitContext(hold, { artifact: "held", input: "pin-limit", lane: "heavy" });
    const ids = [];
    for (let n = 0; n < 32; n++) {
      const exportId = randomUUID();
      ids.push(exportId);
      await f.exports.create({
        exportId,
        recordingId: f.take.recordingId,
        kind: "video",
        directory: f.output,
        leaf: `bounded-${n}.mp4`,
      });
      f.exports.cancel(exportId);
    }
    const overflow = {
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "overflow.mp4",
    };
    await assert.rejects(f.exports.create(overflow), { code: "LIMIT_EXCEEDED" });
    assert.equal(
      f.store.catalog
        .prepare("SELECT COUNT(*) AS count FROM export_intents WHERE receipt IS NULL")
        .get().count,
      32,
    );
    assert.deepEqual(await readdir(f.output), []);
    await f.exports.abandon(ids[1]);
    await f.exports.create(overflow);
    f.exports.cancel(overflow.exportId);
    await assert.rejects(f.exports.create({ ...overflow, exportId: randomUUID() }), {
      code: "LIMIT_EXCEEDED",
    });
    await f.jobs.closeContext(hold);
    await f.exports.retry(ids[0]);
    await f.jobs.idle();
    assert.equal(f.exports.status(ids[0]).state, "committed");
    await f.exports.retry(overflow.exportId);
    await f.jobs.idle();
    assert.equal(f.exports.status(overflow.exportId).state, "committed");
    await f.deletion.delete(f.take.recordingId);
    assert.deepEqual((await readdir(f.output)).sort(), ["bounded-0.mp4", "overflow.mp4"]);
  });

  test("cache eviction after promotion returns the settled exporter to admission and rebuilds its pinned preview", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    let intercept = true;
    t.after(() => release.resolve());
    const f = await fixture(t, (run) => async (operation, ...args) => {
      if (operation === "publication.reconcile" && intercept) {
        intercept = false;
        entered.resolve();
        await release.promise;
      }
      return run(operation, ...args);
    });
    const exportId = randomUUID();
    const request = await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "evicted.mp4",
    });
    const first = f.jobs.job(request.jobId);
    await entered.promise;
    f.cache.remove(f.ready.published.preview.cacheId);
    f.store.edit(f.take.recordingId, {
      operation: "cut",
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 0, endUs: 1000000 }],
    });
    release.resolve();
    await f.jobs.idle();
    const result = f.exports.status(exportId),
      last = f.jobs.job(request.jobId);
    assert.equal(result.state, "committed");
    assert.notEqual(last.attemptId, first.attemptId);
    assert.equal(last.generation, first.generation + 1);
    const selected = JSON.parse(
      f.store.catalog.prepare("SELECT preview FROM export_intents WHERE exportId=?").get(exportId)
        .preview,
    );
    assert.notEqual(selected.cacheId, f.ready.published.preview.cacheId);
    const regenerated = f.preview.request({
      recordingId: f.take.recordingId,
      revisionId: "r0",
      rendition: "source",
    });
    const bytes = await readFile(regenerated.published.preview.file);
    assert.deepEqual(await readFile(join(f.output, "evicted.mp4")), bytes);
    assert.equal(regenerated.published.preview.durationUs, 2000000);
  });

  test("canceled export retains its selected source through newer evidence cleanup and retry then releases it", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    const old = f.processing.status(f.take.recordingId);
    const generation = old.published.evidence.generation;
    const oldDirectory = join(
      f.home,
      "recordings",
      f.take.recordingId,
      "evidence",
      "source",
      generation,
    );
    const hold = f.jobs.createContext(
      ({ signal }) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve("closed"), { once: true }),
        ),
    );
    f.jobs.submitContext(hold, { artifact: "held", input: "cancel-before-export", lane: "heavy" });
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "old-generation.mp4",
    });
    f.exports.cancel(exportId);
    assert.equal(f.exports.retainsSource(f.take.recordingId, generation), true);
    f.cache.remove(f.ready.published.preview.cacheId);
    f.jobs.regenerate(old.jobId, old.published.generation);
    await f.jobs.closeContext(hold);
    await f.jobs.idle();
    const newer = f.processing.status(f.take.recordingId).published.evidence;
    assert.notEqual(newer.generation, generation);
    await f.processing.cleanup(new AbortController().signal);
    assert.equal((await stat(oldDirectory)).isDirectory(), true);
    f.store.edit(f.take.recordingId, {
      operation: "cut",
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 0, endUs: 1000000 }],
    });
    await f.exports.retry(exportId);
    await f.jobs.idle();
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
    const regenerated = f.preview.request({
      recordingId: f.take.recordingId,
      revisionId: "r0",
      sourceEvidence: old.published.evidence,
      rendition: "source",
    });
    assert.equal(regenerated.state, "ready");
    assert.equal(regenerated.published.preview.sourceEvidence.generation, generation);
    assert.equal(f.exports.retainsSource(f.take.recordingId, generation), false);
    await f.processing.cleanup(new AbortController().signal);
    await assert.rejects(stat(oldDirectory), { code: "ENOENT" });
    assert.equal(
      f.store.catalog
        .prepare("SELECT 1 FROM source_evidence_generations WHERE generation=?")
        .get(generation),
      undefined,
    );
    assert.equal(
      (
        await stat(
          join(f.home, "recordings", f.take.recordingId, "evidence", "source", newer.generation),
        )
      ).isDirectory(),
      true,
    );
  });

  test("waiting export pins revision before source readiness and admits dependencies without a lane", async (t) => {
    const f = await fixture(t, undefined, undefined, { warm: false });
    const hold = f.jobs.createContext(
      ({ signal }) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve("closed"), { once: true }),
        ),
    );
    f.jobs.submitContext(hold, { artifact: "hold", input: "source-delay", lane: "heavy" });
    const exportId = randomUUID();
    const requested = await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "waiting.mp4",
    });
    assert.equal(requested.state, "queued");
    assert.equal(f.jobs.job(requested.jobId).state, "waiting");
    f.store.edit(f.take.recordingId, {
      operation: "cut",
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 0, endUs: 1000000 }],
    });
    await f.jobs.closeContext(hold);
    await f.jobs.idle();
    const result = f.exports.status(exportId);
    assert.equal(result.state, "committed");
    assert.equal(result.snapshot.revisionId, "r0");
    assert.equal(result.snapshot.historyThroughOrdinal, requested.snapshot.historyThroughOrdinal);
    const source = f.processing.status(f.take.recordingId).published.evidence;
    assert.equal(f.exports.retainsSource(f.take.recordingId, source.generation), false);
  });

  test("ready preview exports its pinned bytes and real recording deletion forgets private export metadata", async (t) => {
    const f = await fixture(t);
    const exportId = randomUUID();
    const initial = f.store.revision(f.take.recordingId);
    const expectedRead = f.cache.acquire(f.ready.published.preview.cacheId);
    const expected = Buffer.alloc(expectedRead.bytes);
    assert.equal(expectedRead.read(expected, 0), expected.length);
    expectedRead.release();
    const request = {
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "recording.mp4",
    };
    const admitted = await f.exports.create(request);
    f.store.edit(f.take.recordingId, {
      operation: "cut",
      requestId: randomUUID(),
      expectedRevisionId: initial.id,
      ranges: [{ startUs: 0, endUs: 1000000 }],
    });
    await f.jobs.idle();
    const status = await f.exports.status(exportId);
    assert.equal(status.state, "committed");
    assert.equal(status.snapshot.revisionId, initial.id);
    const bytes = await readFile(join(f.output, "recording.mp4"));
    assert.equal(sha(bytes), sha(expected));
    assert.equal(sha(bytes), status.receipt.sha256);
    const info = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        join(f.output, "recording.mp4"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(Number(JSON.parse(info.stdout).format.duration), 2);
    assert.equal((await f.exports.create(request)).exportId, admitted.exportId);
    await f.deletion.delete(f.take.recordingId);
    assert.throws(
      () => f.exports.status(exportId),
      (e) => e.code === "NOT_FOUND",
    );
    assert.deepEqual(await readdir(f.output), ["recording.mp4"]);
    assert.equal(sha(await readFile(join(f.output, "recording.mp4"))), sha(bytes));
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
  });

  test("a committed export remains authoritative when cancellation discards its late job result", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    const f = await fixture(t, (run) => async (op, ...args) => {
      const result = await run(op, ...args);
      if (op === "publication.commit") {
        entered.resolve();
        await release.promise;
      }
      return result;
    });
    const exportId = randomUUID();
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "late.mp4",
    });
    await entered.promise;
    f.exports.cancel(exportId);
    release.resolve();
    await f.jobs.idle();
    const status = await f.exports.status(exportId);
    assert.equal(status.state, "committed");
    assert.equal(f.jobs.job(status.jobId).state, "canceled");
    assert.equal(
      f.jobs.status({
        target: { kind: "recording", recordingId: f.take.recordingId, revisionId: "r0" },
        artifact: "export-recording",
        input: exportId,
      }).published,
      null,
    );
    assert.equal(sha(await readFile(join(f.output, "late.mp4"))), status.receipt.sha256);
  });

  test("deletion drains the exporter and its validated cache descriptor before removing private bytes", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    const f = await fixture(t, (run) => async (op, ...args) => {
      const result = await run(op, ...args);
      if (op === "publication.prepare") {
        entered.resolve();
        await release.promise;
      }
      return result;
    });
    const exportId = randomUUID();
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "never.mp4",
    });
    await entered.promise;
    assert.throws(
      () => f.cache.remove(f.ready.published.preview.cacheId),
      (e) => e.code === "CACHE_BUSY",
    );
    let deleted = false;
    const done = f.deletion.delete(f.take.recordingId).then(() => {
      deleted = true;
    });
    await new Promise(setImmediate);
    assert.equal(deleted, false);
    release.resolve();
    await done;
    assert.deepEqual(await readdir(f.output), []);
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
  });

  test("actual owner death between external commit and catalog acknowledgement reconciles without republishing", async (t) => {
    const { f, reopened, exportId } = await crashFixture(t, "commit");
    const before = await readFile(join(f.output, "recovered.mp4"));
    try {
      assert.equal(
        reopened.store.catalog
          .prepare("SELECT receipt FROM export_intents WHERE exportId=?")
          .get(exportId).receipt,
        null,
      );
      const metadataBytes = (
        await stat(join(f.output, ".screenrec-export-" + exportId, "prepared.json"))
      ).size;
      assert.equal((await reopened.storage.usage(f.take.recordingId)).otherBytes, metadataBytes);
      await reopened.exports.recover(exportId);
      await reopened.jobs.idle();
      const status = await reopened.exports.status(exportId);
      assert.equal(status.state, "committed");
      assert.equal(reopened.jobs.job(status.jobId).state, "failed");
      assert.equal(sha(await readFile(join(f.output, "recovered.mp4"))), sha(before));
      assert.deepEqual(await readdir(f.output), ["recovered.mp4"]);
      await reopened.deletion.delete(f.take.recordingId);
      assert.deepEqual(await readdir(f.output), ["recovered.mp4"]);
    } finally {
      await reopened.closeOwners();
    }
  });

  test("committed history survives external removal or replacement without silently exporting again", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID(),
      file = join(f.output, "external.mp4");
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "external.mp4",
    });
    await f.jobs.idle();
    const committed = await f.exports.status(exportId);
    await rm(file);
    const missing = await f.exports.retry(exportId);
    assert.equal(missing.state, "committed");
    assert.deepEqual(missing.receipt, committed.receipt);
    await assert.rejects(readFile(file), { code: "ENOENT" });
    await writeFile(file, "user replacement");
    const replaced = await f.exports.retry(exportId);
    assert.deepEqual(replaced.receipt, committed.receipt);
    assert.equal(await readFile(file, "utf8"), "user replacement");
    await f.deletion.delete(f.take.recordingId);
    assert.equal(await readFile(file, "utf8"), "user replacement");
  });
  test("concurrent request replay shares one intent and conflicting reuse is rejected", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    const request = {
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "once.mp4",
    };
    const results = await Promise.all([f.exports.create(request), f.exports.create(request)]);
    assert.equal(results[0].jobId, results[1].jobId);
    await f.jobs.idle();
    await assert.rejects(
      f.exports.create({ ...request, leaf: "different.mp4" }),
      (e) => e.code === "REQUEST_CONFLICT",
    );
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 1);
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
  });
  test("lost retirement acknowledgement resumes real recording deletion after the staging directory is gone", async (t) => {
    let lost = true;
    const f = await fixture(t, (run) => async (op, ...args) => {
        const result = await run(op, ...args);
        if (op === "publication.retire" && lost) {
          lost = false;
          return {
            ok: false,
            error: {
              code: "MEDIA_WORKER_FAILED",
              message: "lost retirement response",
              retryable: true,
              details: {},
            },
          };
        }
        return result;
      }),
      exportId = randomUUID();
    await writeFile(join(f.output, "retained.mp4"), "foreign");
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "retained.mp4",
    });
    await f.jobs.idle();
    assert.equal(f.exports.status(exportId).cleanupPending, true);
    await assert.rejects(
      f.deletion.delete(f.take.recordingId),
      (e) => e.code === "MEDIA_WORKER_FAILED",
    );
    assert.ok(f.store.deleting(f.take.recordingId));
    assert.deepEqual(await readdir(f.output), ["retained.mp4"]);
    await f.deletion.delete(f.take.recordingId);
    assert.equal(f.store.deleting(f.take.recordingId), null);
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
  });

  test("actual owner death after catalog commit finishes private acknowledgement on recovery", async (t) => {
    const { f, reopened, exportId } = await crashFixture(t, "ack");
    try {
      const committed = await reopened.exports.status(exportId);
      assert.equal(committed.state, "committed");
      assert.deepEqual((await readdir(join(f.output, ".screenrec-export-" + exportId))).sort(), [
        "payload",
        "prepared.json",
      ]);
      await reopened.exports.recover(exportId);
      await reopened.jobs.idle();
      assert.deepEqual(await readdir(f.output), ["recovered.mp4"]);
      assert.deepEqual((await reopened.exports.status(exportId)).receipt, committed.receipt);
    } finally {
      await reopened.closeOwners();
    }
  });
  test("actual owner death before staging identity registration leaves only an empty recoverable directory", async (t) => {
    const { f, reopened, exportId } = await crashFixture(t, "allocate");
    try {
      assert.equal(
        reopened.store.catalog
          .prepare("SELECT staging FROM export_intents WHERE exportId=?")
          .get(exportId).staging,
        null,
      );
      assert.deepEqual(await readdir(join(f.output, ".screenrec-export-" + exportId)), []);
      await reopened.exports.retry(exportId);
      await reopened.jobs.idle();
      assert.equal(reopened.exports.status(exportId).state, "committed");
    } finally {
      await reopened.closeOwners();
    }
  });

  test("canceled queued export retries its original revision after preview eviction and regeneration", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    const hold = f.jobs.createContext(
      ({ signal }) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve("closed"), { once: true }),
        ),
    );
    f.jobs.submitContext(hold, { artifact: "held", input: "fixture", lane: "heavy" });
    await new Promise(setImmediate);
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "retried.mp4",
    });
    f.exports.cancel(exportId);
    assert.equal(f.exports.status(exportId).state, "canceled");
    f.cache.remove(f.ready.published.preview.cacheId);
    f.store.edit(f.take.recordingId, {
      operation: "cut",
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 0, endUs: 1000000 }],
    });
    await f.jobs.closeContext(hold);
    await f.exports.retry(exportId);
    await f.jobs.idle();
    const result = f.exports.status(exportId);
    assert.equal(result.state, "committed");
    assert.equal(result.snapshot.revisionId, "r0");
    const info = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        join(f.output, "retried.mp4"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(Number(JSON.parse(info.stdout).format.duration), 2);
  });

  test("interrupted allocation refuses nonempty substituted staging and keeps deletion pending", async (t) => {
    const { f, reopened, exportId } = await crashFixture(t, "allocate");
    try {
      const sentinel = join(f.output, ".screenrec-export-" + exportId, "sentinel");
      await writeFile(sentinel, "external sentinel");
      await reopened.exports.retry(exportId);
      await reopened.jobs.idle();
      assert.equal(reopened.exports.status(exportId).state, "failed");
      await assert.rejects(
        reopened.deletion.delete(f.take.recordingId),
        (e) => e.code === "INVALID_STORAGE",
      );
      assert.ok(reopened.store.deleting(f.take.recordingId));
      assert.equal(await readFile(sentinel, "utf8"), "external sentinel");
      await assert.rejects(readFile(join(f.output, "recovered.mp4")), { code: "ENOENT" });
    } finally {
      await reopened.closeOwners();
    }
  });
  test("managed source directories cannot be selected as allegedly external exports", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    await assert.rejects(
      f.exports.create({
        exportId,
        recordingId: f.take.recordingId,
        kind: "video",
        directory: join(f.home, "recordings", f.take.recordingId, "source"),
        leaf: "wrong.mp4",
      }),
      (e) => e.code === "INVALID_STORAGE",
    );
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
    await f.deletion.delete(f.take.recordingId);
    assert.equal(f.store.deleting(f.take.recordingId), null);
    assert.deepEqual(await readdir(f.output), []);
  });
  test("native death during receipt writing leaves unprepared evidence that the same intent can retry", async (t) => {
    const { f, exportId, stage } = await receiptCrash(t);
    assert.equal(f.exports.status(exportId).state, "failed");
    await assert.rejects(readFile(join(stage, "prepared.json")), { code: "ENOENT" });
    assert.equal((await readFile(join(stage, "receipt.pending"))).length, 1);
    await f.exports.retry(exportId);
    await f.jobs.idle();
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
    await f.deletion.delete(f.take.recordingId);
    assert.deepEqual(await readdir(f.output), ["retry.mp4"]);
  });

  test("native death after canonical receipt publication retains that exact payload for retry", async (t) => {
    const { f, exportId, stage } = await receiptCrash(t, "after-link");
    assert.equal(f.exports.status(exportId).state, "failed");
    const inode = (await stat(join(stage, "payload"), { bigint: true })).ino.toString();
    assert.deepEqual(
      JSON.parse(await readFile(join(stage, "prepared.json"))),
      JSON.parse(await readFile(join(stage, "receipt.pending"))),
    );
    await f.exports.retry(exportId);
    await f.jobs.idle();
    const result = f.exports.status(exportId);
    assert.equal(result.state, "committed");
    assert.equal(result.receipt.file.ino, inode);
    await assert.rejects(readdir(stage), { code: "ENOENT" });
  });
  test("recording deletion removes a receipt interrupted before its canonical publication", async (t) => {
    const { f, exportId, stage } = await receiptCrash(t);
    assert.equal(f.exports.status(exportId).state, "failed");
    assert.equal((await readFile(join(stage, "receipt.pending"))).length, 1);
    await f.deletion.delete(f.take.recordingId);
    assert.deepEqual(await readdir(f.output), []);
  });
  test("one unsafe export staging entry does not prevent retiring independent intents of the same recording", async (t) => {
    const f = await fixture(t),
      ids = [randomUUID(), randomUUID()].sort();
    for (const [i, exportId] of ids.entries()) {
      await writeFile(join(f.output, `saved-${i}.mp4`), "foreign");
      await f.exports.create({
        exportId,
        recordingId: f.take.recordingId,
        kind: "video",
        directory: f.output,
        leaf: `saved-${i}.mp4`,
      });
      await f.jobs.idle();
    }
    const stage = join(f.output, ".screenrec-export-" + ids[0]);
    await rename(stage, stage + "-original");
    await mkdir(stage, { mode: 0o700 });
    await writeFile(join(stage, "sentinel"), "keep");
    await assert.rejects(
      f.deletion.delete(f.take.recordingId),
      (e) => e.code === "PUBLICATION_CHANGED",
    );
    const discovery = f.exports.list({}).exports;
    assert.deepEqual(
      discovery.map((row) => row.exportId),
      [ids[0]],
    );
    const [discovered] = discovery;
    const detailed = f.exports.status(ids[0]);
    assert.deepEqual(
      [detailed.state, detailed.abandoning, detailed.cleanupPending],
      [discovered.state, discovered.abandoning, discovered.cleanupPending],
    );
    assert.equal(await readFile(join(stage, "sentinel"), "utf8"), "keep");
    await assert.rejects(readdir(join(f.output, ".screenrec-export-" + ids[1])), {
      code: "ENOENT",
    });
  });
  test("an unreadable unrelated destination never prevents deleting owned private export data", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID(),
      destination = join(f.output, "unreadable.mp4");
    await writeFile(destination, "unreadable foreign bytes", { mode: 0 });
    const before = await stat(destination, { bigint: true });
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "unreadable.mp4",
    });
    await f.jobs.idle();
    assert.equal(f.exports.status(exportId).state, "failed");
    await f.deletion.delete(f.take.recordingId);
    assert.deepEqual(await readdir(f.output), ["unreadable.mp4"]);
    const after = await stat(destination, { bigint: true });
    assert.equal(after.ino, before.ino);
    assert.equal(after.size, before.size);
    assert.equal(after.mode, before.mode);
    await chmod(destination, 0o600);
    assert.equal(await readFile(destination, "utf8"), "unreadable foreign bytes");
    assert.equal(f.store.deleting(f.take.recordingId), null);
  });
  test("storage totals include failed private exports and exclude the committed external movie", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    const before = await f.storage.usage(f.take.recordingId);
    const globalBefore = await f.storage.usage();
    await writeFile(join(f.output, "taken.mp4"), "external sentinel");
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "taken.mp4",
    });
    await f.jobs.idle();
    assert.equal(f.exports.status(exportId).state, "failed");
    const stage = join(f.output, ".screenrec-export-" + exportId);
    const bytes =
      (await stat(join(stage, "payload"))).size + (await stat(join(stage, "prepared.json"))).size;
    assert.ok(bytes > 0);
    const one = await f.storage.usage(f.take.recordingId);
    assert.equal(one.otherBytes, before.otherBytes + bytes);
    assert.equal(one.totalBytes, before.totalBytes + bytes);
    assert.equal((await f.storage.usage()).otherBytes, globalBefore.otherBytes + bytes);
    assert.equal(await readFile(join(f.output, "taken.mp4"), "utf8"), "external sentinel");
    const successful = randomUUID();
    await f.exports.create({
      exportId: successful,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "export.mp4",
    });
    await f.jobs.idle();
    assert.equal(f.exports.status(successful).state, "committed");
    assert.equal((await f.storage.usage(f.take.recordingId)).otherBytes, before.otherBytes + bytes);
    assert.equal((await f.storage.usage()).otherBytes, globalBefore.otherBytes + bytes);
    await f.deletion.delete(f.take.recordingId);
    assert.equal((await f.storage.usage()).otherBytes, globalBefore.otherBytes);
    assert.ok((await stat(join(f.output, "export.mp4"))).size > 0);
    assert.equal(await readFile(join(f.output, "taken.mp4"), "utf8"), "external sentinel");
  });
  test("storage reconciles retired staging but rejects a substituted private directory", async (t) => {
    const f = await fixture(t),
      exportId = randomUUID();
    await writeFile(join(f.output, "taken.mp4"), "external sentinel");
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "taken.mp4",
    });
    await f.jobs.idle();
    const name = ".screenrec-export-" + exportId,
      stage = join(f.output, name);
    const retainedDirectory = await open(stage);
    t.after(() => retainedDirectory.close());
    const owner = await Publication.open(stage, f.output, native);
    try {
      await owner.retire(name);
    } finally {
      await owner.close();
    }
    // Simulate completed private retirement before its catalog acknowledgement.
    assert.equal((await f.storage.usage(f.take.recordingId)).otherBytes, 0);
    await mkdir(stage, { mode: 0o700 });
    await writeFile(join(stage, "payload"), "replacement");
    await assert.rejects(f.storage.usage(f.take.recordingId));
    assert.equal(await readFile(join(stage, "payload"), "utf8"), "replacement");
    assert.equal(await readFile(join(f.output, "taken.mp4"), "utf8"), "external sentinel");
  });
  test("storage shutdown aborts and drains an export observation before catalog teardown", async (t) => {
    const entered = Promise.withResolvers(),
      aborted = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    const f = await fixture(t, (worker) => async (operation, params, options) => {
      if (operation === "publication.usage") {
        entered.resolve();
        options.signal.addEventListener("abort", () => aborted.resolve(), { once: true });
        await release.promise;
      }
      return worker(operation, params, options);
    });
    await writeFile(join(f.output, "taken.mp4"), "sentinel");
    await f.exports.create({
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "taken.mp4",
    });
    await f.jobs.idle();
    const read = f.storage.usage(f.take.recordingId);
    const rejected = assert.rejects(read, { code: "CANCELED" });
    await entered.promise;
    let closed = false;
    const closing = f.storage.close().then(() => {
      closed = true;
    });
    await aborted.promise;
    await new Promise(setImmediate);
    assert.equal(closed, false);
    release.resolve();
    await Promise.all([closing, rejected]);
    assert.equal(closed, true);
  });
  test("committed storage excludes the movie before acknowledgement and skips cleared destinations", async (t) => {
    let failAcknowledgement = true;
    const f = await fixture(t, (worker) => async (operation, params, options) => {
      if (operation === "publication.acknowledge" && failAcknowledgement)
        throw new Error("fixture acknowledgement failure");
      return worker(operation, params, options);
    });
    const exportId = randomUUID();
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "export.mp4",
    });
    await f.jobs.idle();
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
    const stage = join(f.output, ".screenrec-export-" + exportId);
    const metadataBytes = (await stat(join(stage, "prepared.json"))).size;
    assert.equal((await f.storage.usage(f.take.recordingId)).otherBytes, metadataBytes);
    failAcknowledgement = false;
    await f.exports.retry(exportId);
    await f.jobs.idle();
    const moved = f.output + "-moved";
    await rename(f.output, moved);
    t.after(() => rm(moved, { recursive: true, force: true }));
    assert.equal((await f.storage.usage(f.take.recordingId)).otherBytes, 0);
    assert.ok((await stat(join(moved, "export.mp4"))).size > 0);
  });

  test(
    "abandonment drains in-flight destination admissions before confirming absence",
    { timeout: 10000 },
    async (t) => {
      let release,
        entered,
        count = 0;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      const atDestination = new Promise((resolve) => {
        entered = resolve;
      });
      const f = await fixture(
        t,
        (native) => async (operation, params, options) => {
          if (operation === "storage.externalDirectory" && ++count <= 2) {
            if (count === 2) entered();
            await held;
          }
          return native(operation, params, options);
        },
        undefined,
        { warm: false, admission: false },
      );
      const request = {
        exportId: randomUUID(),
        kind: "video",
        recordingId: f.take.recordingId,
        directory: f.output,
        leaf: "abandoned-before-admission.mp4",
      };
      const pending = [f.exports.create(request), f.exports.create(request)];
      const outcomes = Promise.allSettled(pending);
      await atDestination;
      assert.throws(() => f.exports.status(request.exportId), { code: "NOT_FOUND" });
      const removing = f.exports.abandon(request.exportId);
      let removed = false;
      void removing.then(() => {
        removed = true;
      });
      try {
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(
          removed,
          false,
          "absence is not final while matching create calls remain active",
        );
        assert.equal(f.exports.abandon(request.exportId), removing);
        await assert.rejects(f.exports.create(request), { code: "EXPORT_ABANDONING" });
        const other = await f.exports.create({
          ...request,
          exportId: randomUUID(),
          leaf: "other.mp4",
        });
        assert.equal(other.state, "queued", "an unrelated admission must remain independent");
        await f.exports.abandon(other.exportId);
      } finally {
        release();
        await removing;
        await outcomes;
      }
      for (const result of await outcomes) {
        assert.equal(result.status, "rejected");
        assert.equal(result.reason.code, "EXPORT_ABANDONING");
      }
      assert.throws(() => f.exports.status(request.exportId), { code: "NOT_FOUND" });
      assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
      assert.deepEqual(await readdir(f.output), []);
    },
  );

  test("export kind is persisted and incompatible replay cannot change video intent", async (t) => {
    const f = await fixture(t);
    const request = {
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "pinned.mp4",
    };
    const first = await f.exports.create(request);
    assert.equal(first.kind, "video");
    assert.equal((await f.exports.create(request)).jobId, first.jobId);
    await assert.rejects(f.exports.create({ ...request, kind: "processed-package" }), {
      code: "REQUEST_CONFLICT",
    });
    const row = f.store.catalog
      .prepare("SELECT kind,request FROM export_intents WHERE exportId=?")
      .get(request.exportId);
    assert.equal(row.kind, "video");
    assert.equal(JSON.parse(row.request)[0], "video");
    assert.equal(f.exports.status(request.exportId).jobId, first.jobId);
  });
  test("complete no-narration package uses the shared intent and reopens independent retained evidence", async (t) => {
    const f = await fixture(t, undefined, undefined, { warm: false });
    const exportId = randomUUID();
    const requested = await f.exports.create({
      kind: "processed-package",
      exportId,
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "capture.zip",
    });
    assert.equal(requested.state, "queued");
    await f.jobs.idle();
    const done = f.exports.status(exportId);
    assert.equal(done.state, "committed", JSON.stringify(done));
    const intent = f.store.catalog
      .prepare(
        "SELECT packageEvidence,assembly,sourceEvidence FROM export_intents WHERE exportId=?",
      )
      .get(exportId);
    assert.equal(intent.assembly, null);
    const source = JSON.parse(intent.sourceEvidence),
      evidence = JSON.parse(intent.packageEvidence);
    assert.equal(f.exports.retainsSource(f.take.recordingId, source.generation), false);
    assert.equal(f.exports.retainsScenes(f.take.recordingId, evidence.scenes.generation), false);
    assert.equal(f.exports.retainsIndex(f.take.recordingId, evidence.index.generation), false);
    const directory = join(f.home, "verify-package");
    await mkdir(directory, { mode: 0o700 });
    const handle = await open(directory);
    const archive = admitArchive(done.output);
    let context;
    try {
      context = await openPackageArchive(
        archive,
        { directory: await (await import("node:fs/promises")).realpath(directory), handle },
        native,
      );
      assert.equal(context.manifest.transcript, "unavailable:no_narration");
      assert.equal(context.manifest.snapshot.revisionId, requested.snapshot.revisionId);
      assert.equal(
        context.manifest.inventory.find((entry) => entry.role === "video").sha256,
        sha(await readFile(join(f.home, "recordings", f.take.recordingId, "source/video.mov"))),
      );
      assert.ok(
        context.manifest.evidence
          .find((item) => item.artifact.reference.kind === "events")
          .files.includes("evidence/events/pages.json"),
      );
      assert.ok(context.manifest.inventory.some((item) => item.role === "image"));
    } finally {
      await context?.close();
      archive.close();
      await handle.close();
    }
  });
  test("package request pins revision and source-scene generations across newer cleanup", async (t) => {
    const sourceEntered = Promise.withResolvers(),
      releaseSource = Promise.withResolvers();
    const indexEntered = Promise.withResolvers(),
      releaseIndex = Promise.withResolvers();
    t.after(() => {
      releaseSource.resolve();
      releaseIndex.resolve();
    });
    let firstSource = true,
      firstFrame = true;
    const f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          if (operation === "media.sourceEvidence" && firstSource) {
            firstSource = false;
            sourceEntered.resolve();
            await releaseSource.promise;
          }
          if (operation === "media.frame" && firstFrame) {
            firstFrame = false;
            indexEntered.resolve();
            await releaseIndex.promise;
          }
          return run(operation, ...args);
        },
      undefined,
      { warm: false },
    );
    const requested = await f.exports.create({
      kind: "processed-package",
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "pinned.zip",
    });
    await sourceEntered.promise;
    f.store.edit(f.take.recordingId, {
      operation: "cut",
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 0, endUs: 500000 }],
    });
    releaseSource.resolve();
    await indexEntered.promise;
    const read = () =>
      f.store.catalog
        .prepare("SELECT sourceEvidence,packageEvidence FROM export_intents WHERE exportId=?")
        .get(requested.exportId);
    const selected = read(),
      pinnedSource = JSON.parse(selected.sourceEvidence),
      pinnedScene = JSON.parse(selected.packageEvidence).scenes;
    const sourceJob = f.processing.status(f.take.recordingId),
      sceneJob = f.sceneOwner.status(f.take.recordingId);
    f.jobs.regenerate(sourceJob.jobId, sourceJob.published.generation);
    f.jobs.regenerate(sceneJob.jobId, sceneJob.published.generation);
    await waitFor(
      () =>
        f.processing.status(f.take.recordingId).state === "ready" &&
        f.processing.status(f.take.recordingId).published.evidence.generation !==
          pinnedSource.generation &&
        f.sceneOwner.status(f.take.recordingId).state === "ready" &&
        f.sceneOwner.status(f.take.recordingId).published.evidence.generation !==
          pinnedScene.generation,
      10000,
    );
    await f.processing.cleanup(new AbortController().signal);
    await f.sceneOwner.cleanup(new AbortController().signal);
    assert.equal(f.exports.retainsSource(f.take.recordingId, pinnedSource.generation), true);
    assert.equal(f.exports.retainsScenes(f.take.recordingId, pinnedScene.generation), true);
    assert.equal(f.evidence.hasAudio(pinnedSource, "narration"), false);
    assert.equal(
      f.sceneEvidence.page({ identity: pinnedScene }).metadata.generation,
      pinnedScene.generation,
    );
    releaseIndex.resolve();
    await f.jobs.idle();
    const done = f.exports.status(requested.exportId);
    assert.equal(done.state, "committed", JSON.stringify(done));
    assert.equal(done.snapshot.revisionId, "r0");
    assert.equal(done.snapshot.historyThroughOrdinal, 0);
    const final = read(),
      selectedIndex = JSON.parse(final.packageEvidence).index;
    assert.equal(selectedIndex.sourceIdentity.generation, pinnedSource.generation);
    assert.equal(selectedIndex.sceneIdentity.generation, pinnedScene.generation);
    assert.equal(selectedIndex.revisionId, "r0");
    assert.equal(f.exports.retainsSource(f.take.recordingId, pinnedSource.generation), false);
    assert.equal(f.exports.retainsScenes(f.take.recordingId, pinnedScene.generation), false);
    await f.processing.cleanup(new AbortController().signal);
    await f.sceneOwner.cleanup(new AbortController().signal);
    assert.throws(() => f.sceneEvidence.page({ identity: pinnedScene }));
  });
  test("committed package retains counted private cleanup until explicit retry and never republishes", async (t) => {
    let refuse = true,
      publicationCalls = 0;
    const f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          if (operation.startsWith("publication.")) publicationCalls++;
          if (operation === "packageWorkspace.remove" && refuse)
            throw new Error("generated private cleanup failure");
          return run(operation, ...args);
        },
      undefined,
      { warm: false },
    );
    const created = await f.exports.create({
      kind: "processed-package",
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "historical.zip",
    });
    await f.jobs.idle();
    const committed = f.exports.status(created.exportId);
    assert.equal(committed.state, "committed", JSON.stringify(committed));
    assert.deepEqual(
      f.exports
        .list({ unfinishedOnly: true })
        .exports.map((row) => [row.exportId, row.state, row.cleanupPending]),
      [[created.exportId, "committed", true]],
    );
    assert.equal(committed.cleanupPending, true, "status and discovery agree on private cleanup");
    const original = await readFile(committed.output);
    const reservation = JSON.parse(
      f.store.catalog
        .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
        .get(created.exportId).assembly,
    );
    assert.ok(reservation.input.identity && reservation.zip.identity);
    async function bytes(directory) {
      let total = 0;
      for (const name of await readdir(directory)) {
        const path = join(directory, name),
          info = await stat(path);
        total += info.isDirectory() ? await bytes(path) : info.size;
      }
      return total;
    }
    const owned =
      (await bytes(join(f.home, "recordings", f.take.recordingId, reservation.input.name))) +
      (await bytes(join(f.home, "recordings", f.take.recordingId, reservation.zip.name)));
    assert.ok(owned > 0);
    assert.equal((await f.storage.usage(f.take.recordingId)).otherBytes, owned);
    assert.equal(
      f.store.catalog
        .prepare(
          "SELECT COUNT(*) AS n FROM export_intents WHERE receipt IS NULL OR abandoning=1 OR assembly IS NOT NULL",
        )
        .get().n,
      1,
    );
    const moved = f.output + "-moved";
    await rename(f.output, moved);
    t.after(async () => {
      await rename(moved, f.output).catch(() => {});
    });
    refuse = false;
    const before = publicationCalls;
    await f.exports.retry(created.exportId);
    await f.jobs.idle();
    assert.equal(
      publicationCalls,
      before,
      "Known acknowledged publication needs no external access for private cleanup",
    );
    assert.equal(f.exports.status(created.exportId).state, "committed");
    assert.equal(
      f.store.catalog
        .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
        .get(created.exportId).assembly,
      null,
    );
    assert.equal((await f.storage.usage(f.take.recordingId)).otherBytes, 0);
    assert.deepEqual(f.exports.list({ unfinishedOnly: true }).exports, []);
    assert.equal(f.exports.list({}).exports[0].cleanupPending, false);
    assert.equal(f.exports.status(created.exportId).cleanupPending, false);
    assert.deepEqual(await readFile(join(moved, "historical.zip")), original);
    await rename(moved, f.output);
  });
  /** Acquired narration in two readable intervals, recorded as the capture journal reports it. */
  async function narrate(f) {
    const source = join(f.home, "recordings", f.take.recordingId, "source");
    const rows = journalRows({ sourceId: f.take.sourceId, width: 160, height: 90, samples: [] });
    rows[0].data.microphone = true;
    rows.splice(
      rows.length - 1,
      0,
      ...[
        { role: "narration", startUs: 0, endUs: 900_000 },
        { role: "narration", startUs: 1_200_000, endUs: 2_000_000 },
      ].map((data) => ({ event: "audioSamples", data })),
    );
    await writeFile(
      join(source, "capture.journal.jsonl"),
      rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
    );
    for (const [input, codec, file] of [
      ["sine=frequency=1000:duration=2", ["-c:a", "pcm_f32le"], "narration.mov"],
      // Ten frames a second give the index a sample at every cut this test makes.
      ["color=c=gray:s=160x90:r=10:d=2", ["-c:v", "libx264", "-pix_fmt", "yuv420p"], "video.mov"],
    ]) {
      const made = spawnSync("ffmpeg", [
        "-nostdin",
        "-y",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        input,
        ...codec,
        join(source, file),
      ]);
      assert.equal(made.status, 0);
    }
    return source;
  }
  async function openPackage(t, f, path) {
    const directory = join(f.home, "opened-packages");
    const packages = new PackageInspection({
      directory,
      jobs: f.jobs,
      worker: f.worker,
      delivery: new DerivativeDelivery(),
    });
    t.after(() => packages.dispose());
    await packages.prepare();
    const admitted = await packages.open(path);
    const opened = await waitFor(() => {
      const status = packages.status(admitted.id);
      return ["ready", "failed"].includes(status.state) && status;
    }, 30_000);
    return { packages, opened };
  }
  test("narrated package pins its transcript and reopens with the library's transcript reads", async (t) => {
    const f = await fixture(t, undefined, undefined, { warm: false });
    await narrate(f);
    f.processing.prepare(f.take.recordingId);
    await f.jobs.idle();
    // Cut through the second word so the pinned revision holds a partial word and a removed one.
    const revision = f.store.edit(f.take.recordingId, {
      operation: "cut",
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 0, endUs: 400_000 }],
    });
    const exportId = randomUUID();
    await f.exports.create({
      kind: "processed-package",
      exportId,
      recordingId: f.take.recordingId,
      revisionId: revision.id,
      directory: f.output,
      leaf: "narrated.zip",
    });
    await f.jobs.idle();
    const done = f.exports.status(exportId);
    assert.equal(done.state, "committed", JSON.stringify(done));
    assert.equal(f.speech.requests, 1);
    const selected = JSON.parse(
      f.store.catalog
        .prepare("SELECT packageEvidence FROM export_intents WHERE exportId=?")
        .get(exportId).packageEvidence,
    ).transcript;
    const library = f.transcriptOwner.status(f.take.recordingId).published.transcript;
    assert.equal(selected.generation, library.generation);
    assert.equal(f.exports.retainsTranscript(f.take.recordingId, selected.generation), false);

    const { packages, opened } = await openPackage(t, f, done.output);
    assert.equal(opened.state, "ready", JSON.stringify(opened));
    const handle = opened.packageHandle;
    const manifest = packages.revision({ packageHandle: handle });
    assert.equal(manifest.revision.id, revision.id);
    const transcript = packages.transcript(handle);
    const whole = f.transcriptOwner.get({ recordingId: f.take.recordingId, limit: 1000 });
    const words = whole.page.rows.filter((row) => row.type === "word");
    assert.ok(
      words.some((row) => row.partial),
      "the cut leaves a partial word",
    );
    assert.ok(words.length < library.wordCount, "the cut removes a whole word");
    assert.ok(whole.page.rows.some((row) => row.type === "gap"));
    const same = (actual, expected) => {
      assert.equal(actual.revisionId, expected.revisionId);
      assert.equal(actual.generation, expected.generation);
      assert.deepEqual(
        actual.page.rows ?? actual.page.entries,
        expected.page.rows ?? expected.page.entries,
      );
      assert.deepEqual(actual.page.nextCursor, expected.page.nextCursor);
      return expected.page.nextCursor;
    };
    for (const revisionId of [undefined, "r0"])
      for (const range of [undefined, { startUs: 300_000, endUs: 1_400_000 }])
        for (const limit of [1, 3, 1000]) {
          let cursor;
          do {
            const query = { revisionId, limit, ...(cursor ? { cursor } : { range }) };
            cursor = same(
              transcript.get({ packageHandle: handle, ...query }),
              f.transcriptOwner.get({ recordingId: f.take.recordingId, ...query }),
            );
          } while (cursor);
        }
    for (const text of ["hello", "hello again", "world."]) {
      let cursor;
      do {
        const query = { text, limit: 1, ...(cursor ? { cursor } : {}) };
        cursor = same(
          transcript.search({ packageHandle: handle, ...query }),
          f.transcriptOwner.search({ recordingId: f.take.recordingId, ...query }),
        );
      } while (cursor);
    }
    const page = transcript.get({ packageHandle: handle });
    assert.deepEqual(page.page.transcript, {
      ...library,
      narration: { source: "source/narration.mov", sourceOffsetUs: 0 },
    });
  });
  test("narrated package keeps its selected transcript generation across regeneration and cleanup", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    let first = true;
    const f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          if (operation === "media.frame" && first) {
            first = false;
            entered.resolve();
            await release.promise;
          }
          return run(operation, ...args);
        },
      undefined,
      { warm: false },
    );
    await narrate(f);
    const exportId = randomUUID();
    await f.exports.create({
      kind: "processed-package",
      exportId,
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "pinned-transcript.zip",
    });
    await entered.promise;
    const pinned = JSON.parse(
      f.store.catalog
        .prepare("SELECT packageEvidence FROM export_intents WHERE exportId=?")
        .get(exportId).packageEvidence,
    ).transcript;
    const status = f.transcriptOwner.status(f.take.recordingId);
    assert.equal(status.published.transcript.generation, pinned.generation);
    f.jobs.regenerate(status.jobId, status.published.generation);
    await waitFor(
      () =>
        f.transcriptOwner.status(f.take.recordingId).published?.transcript.generation !==
        pinned.generation,
      10_000,
    );
    await f.transcriptOwner.cleanup(new AbortController().signal);
    const raw = join(
      f.home,
      "recordings",
      f.take.recordingId,
      "evidence/transcript",
      pinned.generation,
      "raw.jsonl",
    );
    assert.equal(f.exports.retainsTranscript(f.take.recordingId, pinned.generation), true);
    assert.equal((await stat(raw)).size, pinned.raw.bytes);
    release.resolve();
    await f.jobs.idle();
    const done = f.exports.status(exportId);
    assert.equal(done.state, "committed", JSON.stringify(done));
    const { packages, opened } = await openPackage(t, f, done.output);
    assert.equal(opened.state, "ready", JSON.stringify(opened));
    assert.equal(
      packages.transcript(opened.packageHandle).get({ packageHandle: opened.packageHandle })
        .generation,
      pinned.generation,
    );
    assert.equal(f.exports.retainsTranscript(f.take.recordingId, pinned.generation), false);
    await f.transcriptOwner.cleanup(new AbortController().signal);
    await assert.rejects(stat(raw), { code: "ENOENT" });
  });
  test("narrated export fails retryably until models are prepared, then waits for transcription", async (t) => {
    const f = await fixture(t, undefined, undefined, { warm: false });
    await narrate(f);
    f.speech.models = "absent";
    const exportId = randomUUID();
    await f.exports.create({
      kind: "processed-package",
      exportId,
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "unprepared.zip",
    });
    await f.jobs.idle();
    const blocked = f.exports.status(exportId);
    assert.equal(blocked.state, "failed");
    assert.equal(blocked.retryable, true);
    assert.match(blocked.reason, /prepare speech models, then retry the export/);
    assert.equal(f.transcriptOwner.status(f.take.recordingId).jobId, null);
    const row = f.store.catalog
      .prepare("SELECT assembly,staging FROM export_intents WHERE exportId=?")
      .get(exportId);
    assert.deepEqual([row.assembly, row.staging], [null, null]);
    assert.deepEqual(await readdir(f.output), []);

    f.speech.models = "ready";
    f.speech.fail = "generated transcription failure";
    await f.exports.retry(exportId);
    await f.jobs.idle();
    const failed = f.exports.status(exportId);
    assert.equal(failed.state, "failed");
    assert.match(failed.reason, /generated transcription failure.*retry transcription/);
    assert.equal(f.speech.requests, 1);
    await f.exports.retry(exportId);
    await f.jobs.idle();
    assert.equal(f.speech.requests, 1, "export retry never restarts a failed transcript");

    f.speech.fail = null;
    f.transcriptOwner.retry(f.take.recordingId);
    await f.jobs.idle();
    await f.exports.retry(exportId);
    await f.jobs.idle();
    assert.equal(
      f.exports.status(exportId).state,
      "committed",
      JSON.stringify(f.exports.status(exportId)),
    );
  });
  test("failed package scene prerequisite is not restarted by polling or export retry", async (t) => {
    let fail = true;
    const f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          if (operation === "media.visualSamples" && fail)
            throw new Error("generated scene failure");
          return run(operation, ...args);
        },
      undefined,
      { warm: false },
    );
    const request = {
      kind: "processed-package",
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "retry.zip",
    };
    await f.exports.create(request);
    await f.jobs.idle();
    const scene = f.sceneOwner.status(f.take.recordingId),
      attempt = f.jobs.job(scene.jobId).attemptId;
    assert.equal(f.exports.status(request.exportId).state, "failed");
    for (let i = 0; i < 3; i++) {
      await f.exports.create(request);
      f.exports.status(request.exportId);
    }
    await f.exports.retry(request.exportId);
    await f.jobs.idle();
    assert.equal(f.jobs.job(scene.jobId).attemptId, attempt);
    fail = false;
    f.sceneOwner.retry(f.take.recordingId);
    await f.jobs.idle();
    await f.exports.retry(request.exportId);
    await f.jobs.idle();
    assert.equal(f.exports.status(request.exportId).state, "committed");
  });
  test("canceled package retains its exact index across regeneration and retries those bytes", async (t) => {
    const entered = Promise.withResolvers(),
      release = Promise.withResolvers();
    t.after(() => release.resolve());
    let block = true;
    const f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          if (operation === "archive.copy" && block) {
            entered.resolve();
            await release.promise;
          }
          return run(operation, ...args);
        },
      undefined,
      { warm: false },
    );
    const created = await f.exports.create({
      kind: "processed-package",
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "old-index.zip",
    });
    await entered.promise;
    const row = f.store.catalog
      .prepare("SELECT sourceEvidence,packageEvidence FROM export_intents WHERE exportId=?")
      .get(created.exportId);
    const source = JSON.parse(row.sourceEvidence),
      evidence = JSON.parse(row.packageEvidence),
      old = evidence.index;
    const request = f.indexOwner.request({
      recordingId: f.take.recordingId,
      revisionId: "r0",
      evidence: { source, scenes: evidence.scenes },
    });
    f.jobs.regenerate(request.jobId, request.published.generation);
    await waitFor(
      () =>
        f.jobs.job(request.jobId).state === "ready" &&
        f.jobs.job(request.jobId).attemptId !== old.generation,
      10000,
    );
    await f.indexOwner.cleanup(new AbortController().signal);
    assert.equal(f.indexEvidence.metadata(old).generation, old.generation);
    assert.equal(f.exports.retainsIndex(f.take.recordingId, old.generation), true);
    f.exports.cancel(created.exportId);
    block = false;
    release.resolve();
    await f.jobs.idle();
    assert.equal(f.exports.status(created.exportId).state, "canceled");
    await f.indexOwner.cleanup(new AbortController().signal);
    assert.equal(f.indexEvidence.metadata(old).generation, old.generation);
    await f.exports.retry(created.exportId);
    await f.jobs.idle();
    assert.equal(f.exports.status(created.exportId).state, "committed");
    assert.equal(
      JSON.parse(
        f.store.catalog
          .prepare("SELECT packageEvidence FROM export_intents WHERE exportId=?")
          .get(created.exportId).packageEvidence,
      ).index.generation,
      old.generation,
    );
    assert.equal(f.exports.retainsIndex(f.take.recordingId, old.generation), false);
    await f.indexOwner.cleanup(new AbortController().signal);
    assert.throws(() => f.indexEvidence.metadata(old));
  });

  for (const gap of ["create", "copy", "write", "commit", "cleanup"]) {
    test(`package actual owner death at ${gap} retains recoverable workspace identity`, async (t) => {
      const { reopened: f, exportId } = await packageCrashFixture(t, `package-${gap}`);
      const row = f.store.catalog
        .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
        .get(exportId);
      assert.ok(row.assembly);
      const before = await readFile(join(f.output, "recovered.zip")).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      assert.equal(!!before, ["commit", "cleanup"].includes(gap));
      f.exports.resumeRecovery();
      await f.jobs.idle();
      assert.equal(
        f.store.catalog
          .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
          .get(exportId).assembly,
        null,
      );
      if (before) {
        assert.equal(
          f.exports.status(exportId).state,
          "committed",
          JSON.stringify(f.exports.status(exportId)),
        );
        assert.deepEqual(await readFile(join(f.output, "recovered.zip")), before);
      } else {
        assert.notEqual(f.exports.status(exportId).state, "committed");
        await f.exports.retry(exportId);
        await f.jobs.idle();
        assert.equal(
          f.exports.status(exportId).state,
          "committed",
          JSON.stringify(f.exports.status(exportId)),
        );
      }
      const bytes = await readFile(join(f.output, "recovered.zip"));
      await f.exports.abandon(exportId);
      assert.deepEqual(await readFile(join(f.output, "recovered.zip")), bytes);
      assert.ok(
        (await stat(join(f.home, "recordings", f.take.recordingId, "source/video.mov"))).size > 0,
      );
    });
  }

  test("surviving package writer fences actual recording deletion after service SIGKILL", async (t) => {
    const original = await fixture(t, undefined, undefined, {
      warm: false,
      admission: false,
    });
    const exportId = randomUUID();
    await original.exports.create({
      kind: "processed-package",
      exportId,
      recordingId: original.take.recordingId,
      directory: original.output,
      leaf: "uncommitted.zip",
    });
    await original.closeOwners();
    const library = join(original.home, "copy-barrier.dylib"),
      marker = join(original.home, "copy-stopped");
    const compiled = spawnSync("/usr/bin/clang", [
      "-dynamiclib",
      "-o",
      library,
      resolve("apps/macos/tests/fixtures/archive-copy-barrier.c"),
    ]);
    assert.equal(compiled.status, 0, compiled.stderr.toString());
    const existing = {
      home: original.home,
      output: original.output,
      recordingId: original.take.recordingId,
      library,
      marker,
    };
    const child = fork(
      fileURLToPath(import.meta.url),
      ["crash-owner", JSON.stringify(existing), "package-survivor"],
      {
        stdio: ["ignore", "ignore", "inherit", "ipc"],
        env: { ...process.env, SCREENREC_NATIVE: binary },
      },
    );
    t.after(() => child.kill("SIGKILL"));
    const pid = await waitFor(
      async () =>
        Number(
          await readFile(marker, "utf8").catch((error) => {
            if (error.code !== "ENOENT") throw error;
            return "";
          }),
        ),
      20000,
    );
    t.after(() => {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    });
    const closed = once(child, "close");
    child.kill("SIGKILL");
    assert.deepEqual(await closed, [null, "SIGKILL"]);
    const f = await fixture(t, undefined, existing, { warm: false });
    const row = f.store.catalog
      .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
      .get(exportId);
    const reservation = JSON.parse(row.assembly);
    assert.ok(reservation.input.identity && reservation.zip.identity);
    await assert.rejects(
      f.deletion.delete(f.take.recordingId),
      (error) => error.retryable === true,
    );
    assert.ok(
      (await stat(join(f.home, "recordings", f.take.recordingId, "source/video.mov"))).size > 0,
    );
    assert.ok(
      (
        await stat(
          join(f.home, "recordings", f.take.recordingId, reservation.zip.name, "payload.zip"),
        )
      ).size > 0,
    );
    assert.equal(
      f.store.catalog.prepare("SELECT assembly FROM export_intents WHERE exportId=?").get(exportId)
        .assembly,
      row.assembly,
    );
    process.kill(pid, "SIGKILL");
    await waitFor(async () => {
      try {
        await f.deletion.delete(f.take.recordingId);
        return true;
      } catch (error) {
        if (!error.retryable) throw error;
        return false;
      }
    }, 5000);
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
    await assert.rejects(stat(join(f.home, "recordings", f.take.recordingId)), { code: "ENOENT" });
    assert.deepEqual(await readdir(f.output), []);
  });

  test("package input locator substitution blocks publication and cleanup until owned identity returns", async (t) => {
    let f,
      moved,
      original,
      onceOnly = true;
    f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          const result = await run(operation, ...args);
          if (operation === "archive.copy" && onceOnly) {
            onceOnly = false;
            const row = f.store.catalog
              .prepare("SELECT assembly FROM export_intents WHERE kind='processed-package'")
              .get();
            const reservation = JSON.parse(row.assembly);
            original = join(f.home, "recordings", f.take.recordingId, reservation.input.name);
            moved = original + "-owned";
            await rename(original, moved);
            await mkdir(original, { mode: 0o700 });
            await writeFile(join(original, "foreign"), "preserve replacement");
          }
          return result;
        },
      undefined,
      { warm: false },
    );
    const created = await f.exports.create({
      kind: "processed-package",
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "substituted.zip",
    });
    await f.jobs.idle();
    assert.equal(f.exports.status(created.exportId).state, "failed");
    await assert.rejects(stat(join(f.output, "substituted.zip")), { code: "ENOENT" });
    f.exports.resumeRecovery();
    await f.jobs.idle();
    const failed = f.exports.status(created.exportId).recovery;
    assert.equal(failed.state, "failed");
    assert.equal(failed.retryable, true);
    assert.equal(await readFile(join(original, "foreign"), "utf8"), "preserve replacement");
    await rm(original, { recursive: true });
    await rename(moved, original);
    f.exports.recover(created.exportId);
    await f.jobs.idle();
    assert.equal(f.exports.status(created.exportId).recovery.state, "ready");
    assert.equal(
      f.store.catalog
        .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
        .get(created.exportId).assembly,
      null,
    );
    await f.exports.abandon(created.exportId);
    assert.deepEqual(await readdir(f.output), []);
  });
  test("source changes during descriptor copy cannot produce a complete package", async (t) => {
    let selectedWorker = native;
    const f = await fixture(
      t,
      () =>
        (...args) =>
          selectedWorker(...args),
      undefined,
      { warm: false },
    );
    await withArchiveCopyBarrier(
      f.home,
      binary,
      { operation: "archive.copy", minimumFd: 5 },
      async ({ worker, held, drain, resume }) => {
        selectedWorker = worker;
        const created = await f.exports.create({
          kind: "processed-package",
          exportId: randomUUID(),
          recordingId: f.take.recordingId,
          directory: f.output,
          leaf: "changed.zip",
        });
        const pending = drain(f.jobs.idle());
        await held;
        const file = await open(
          join(f.home, "recordings", f.take.recordingId, "source/video.mov"),
          "r+",
        );
        await file.write(Buffer.from([99]), 0, 1, 0);
        await file.close();
        await resume();
        await pending;
        assert.equal(f.exports.status(created.exportId).state, "failed");
        assert.match(f.exports.status(created.exportId).reason, /Source changed/);
        await assert.rejects(stat(join(f.output, "changed.zip")), { code: "ENOENT" });
        selectedWorker = native;
        await f.exports.abandon(created.exportId);
        assert.deepEqual(await readdir(f.output), []);
        assert.equal(
          (await readFile(join(f.home, "recordings", f.take.recordingId, "source/video.mov")))[0],
          99,
        );
      },
    );
  });

  test("normalized source payload must still match its pinned generation byte receipt", async (t) => {
    let f,
      changed = false;
    f = await fixture(
      t,
      (run) =>
        async (operation, ...args) => {
          if (operation === "media.frame" && !changed) {
            changed = true;
            const source = f.processing.status(f.take.recordingId).published.evidence;
            await writeFile(source.receipt.file, "\n", { flag: "a" });
          }
          return run(operation, ...args);
        },
      undefined,
      { warm: false },
    );
    const created = await f.exports.create({
      kind: "processed-package",
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      directory: f.output,
      leaf: "wrong-normalized.zip",
    });
    await f.jobs.idle();
    const failed = f.exports.status(created.exportId);
    assert.equal(failed.state, "failed");
    assert.match(failed.reason, /pinned.*byte receipt/);
    await assert.rejects(stat(join(f.output, "wrong-normalized.zip")), { code: "ENOENT" });
    await f.exports.abandon(created.exportId);
  });

  test(
    "shutdown fences and drains export destination admission before catalog closure",
    { timeout: 10000 },
    async (t) => {
      let release, entered;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      const atDestination = new Promise((resolve) => {
        entered = resolve;
      });
      const f = await fixture(
        t,
        (native) => async (operation, params, options) => {
          if (operation === "storage.externalDirectory") {
            entered();
            await held;
          }
          return native(operation, params, options);
        },
        undefined,
        { warm: false },
      );
      const exportId = randomUUID();
      const pending = f.exports.create({
        exportId,
        kind: "video",
        recordingId: f.take.recordingId,
        directory: f.output,
        leaf: "shutdown.mp4",
      });
      const outcome = pending.then(
        () => "created",
        () => "closed",
      );
      await atDestination;
      let closed = false;
      const closing = f.exports.close().then(() => {
        closed = true;
      });
      try {
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(
          closed,
          false,
          "close must retain the catalog until destination admission drains",
        );
      } finally {
        release();
        await closing;
        await outcome;
      }
      assert.equal(await outcome, "closed");
      assert.equal(
        f.store.catalog
          .prepare("SELECT count(*) AS n FROM export_intents WHERE exportId=?")
          .get(exportId).n,
        0,
      );
      assert.deepEqual(await readdir(f.output), []);
    },
  );

  test(
    "bundled startup admits a persisted waiter only after its ready preview cache is reconciled",
    { timeout: 30000 },
    async (t) => {
      const f = await fixture(t, (native) => native, undefined, { admission: false });
      const exportId = randomUUID();
      const pending = await f.exports.create({
        exportId,
        kind: "video",
        recordingId: f.take.recordingId,
        directory: f.output,
        leaf: "restarted.mp4",
      });
      assert.equal(pending.state, "queued");
      assert.equal(f.jobs.job(pending.jobId).state, "waiting");
      await f.closeOwners();
      const { instance } = await launchReady(f.home);
      try {
        const status = await waitFor(async () => {
          const result = await callLocal(socketPath(f.home), {
            id: randomUUID(),
            operation: "export.status",
            params: { exportId },
          });
          assert.equal(result.ok, true, JSON.stringify(result));
          if (["failed", "unavailable"].includes(result.data.state))
            throw new Error(JSON.stringify(result.data));
          return result.data.state === "committed" && result.data;
        }, 15000);
        assert.equal(status.snapshot.revisionId, "r0");
        assert.equal(status.receipt.sha256, sha(await readFile(join(f.output, "restarted.mp4"))));
      } finally {
        instance.kill("SIGTERM");
        await waitFor(() => !instance.running, 15000);
        assert.equal((await instance.exited).code, 0);
      }
    },
  );
}
