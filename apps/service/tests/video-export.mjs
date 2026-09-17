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
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { RecordingStorage } from "@screenrec/core/storage";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue } from "@screenrec/core/jobs";
import { DerivedCache } from "@screenrec/core/cache";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { SourceProcessing } from "@screenrec/core/processing";
import { PreviewInspection } from "@screenrec/core/preview";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { Publication } from "../dist/publication.js";
import { RecordingExports } from "../dist/exports.js";
import { RecordingDeletion } from "../dist/deletion.js";
import { DerivativeDelivery } from "../dist/delivery.js";
import { ManagedFiles } from "../dist/managed-files.js";
import { mediaWorker } from "../dist/worker.js";
import { journalRows } from "../../macos/tests/fixtures/generated-capture.mjs";
const binary = process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native");
const native = mediaWorker({ SCREENREC_NATIVE: binary });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
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
    await mkdir(source, { recursive: true });
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
  let processing, preview, exports;
  let recoverOnCapacity = false;
  const recoveryErrors = [];
  const worker = wrap(native);
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    onCapacity: () => {
      if (recoverOnCapacity) recoveryErrors.push(...exports.resumeRecovery());
    },
    execute: (execution) =>
      ["export-video", "export-recovery"].includes(execution.job.artifact)
        ? exports.execute(execution)
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
  const files = new ManagedFiles(home, worker);
  exports = new RecordingExports({ store, jobs, cache, preview, processing, worker, files });
  const storage = new RecordingStorage(store, cache, home, (recordingId, signal) =>
    exports.usage(recordingId, signal),
  );
  if (admission) jobs.startAdmission((job) => exports.admit(job));
  if (warm) processing.prepare(take.recordingId);
  await jobs.idle();
  if (warm) preview.request({ recordingId: take.recordingId });
  await jobs.idle();
  const ready = warm ? preview.request({ recordingId: take.recordingId }) : null;
  if (warm) assert.equal(ready.state, "ready");
  const delivery = new DerivativeDelivery();
  const deletion = new RecordingDeletion({
    store,
    jobs,
    cache,
    source: evidence,
    scenes: new SceneEvidenceStore(store),
    index: new ScreenshotIndexStore(store, home),
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
        const result = await run(op, ...args);
        if (
          (gap === "commit" && op === "publication.commit") ||
          (gap === "allocate" && op === "publication.allocate") ||
          (gap === "abandon" && op === "publication.retire")
        ) {
          process.send({ gap });
          await new Promise(() => {});
        }
        return result;
      },
    existing,
  );
  if (gap === "abandon") await crashed.exports.abandon(existing.exportId);
} else {
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
    assert.equal(f.exports.status(exportId).state, "committed");
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
    const names = await readdir(f.output);
    assert.deepEqual(
      names.filter((name) => name.endsWith(".mp4")).sort(),
      Array.from({ length: 33 }, (_, n) => `${n}.mp4`).sort(),
    );
    for (const name of names.filter((name) => name.startsWith(".screenrec-export-")))
      assert.deepEqual(await readdir(join(f.output, name)), []);
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

  test("acknowledged historical retry does not access a moved destination but abandonment still verifies ownership", async (t) => {
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
    const moved = f.output + "-moved";
    t.after(() => rm(moved, { recursive: true, force: true }));
    await rename(f.output, moved);
    const before = nativeCalls;
    assert.equal((await f.exports.retry(exportId)).state, "committed");
    assert.equal(f.exports.status(exportId).state, "committed");
    assert.equal(nativeCalls, before);
    await assert.rejects(f.exports.abandon(exportId));
    assert.equal(f.exports.status(exportId).abandoning, true);
    await rename(moved, f.output);
    await f.exports.abandon(exportId);
    assert.deepEqual(await readdir(f.output), ["moved.mp4"]);
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
    assert.equal(f.exports.status(exportId).abandoning, true);
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
    const requested = await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "survives.mp4",
    });
    await f.jobs.idle();
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
        recordingId: f.take.recordingId,
        revisionId: "r0",
        artifact: "export-video",
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
    assert.equal(f.exports.status(exportId).state, "committed");
    await f.exports.abandon(exportId);
    assert.equal(
      f.jobs.status({
        recordingId: f.take.recordingId,
        revisionId: "r0",
        artifact: "export-video",
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
    const regenerated = f.preview.request({ recordingId: f.take.recordingId, revisionId: "r0" });
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
    assert.equal(f.exports.status(exportId).state, "committed");
    const regenerated = f.preview.request({
      recordingId: f.take.recordingId,
      revisionId: "r0",
      sourceEvidence: old.published.evidence,
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
        recordingId: f.take.recordingId,
        revisionId: "r0",
        artifact: "export-video",
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
      assert.deepEqual(await readdir(join(f.output, ".screenrec-export-" + exportId)), []);
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
    assert.equal(f.exports.status(exportId).state, "committed");
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
    await f.exports.create({
      exportId,
      recordingId: f.take.recordingId,
      kind: "video",
      directory: f.output,
      leaf: "retained.mp4",
    });
    await f.jobs.idle();
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
      assert.deepEqual(await readdir(join(f.output, ".screenrec-export-" + exportId)), []);
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
    assert.equal(f.exports.status(exportId).state, "committed");
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
    assert.deepEqual(await readdir(stage), []);
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
    assert.deepEqual(
      f.store.catalog
        .prepare("SELECT exportId FROM export_intents ORDER BY exportId")
        .all()
        .map((row) => row.exportId),
      [ids[0]],
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
    assert.equal(f.exports.status(exportId).state, "committed");
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

  test("processed-package requests leave no intent, job or destination before producer exists", async (t) => {
    const f = await fixture(t);
    const request = {
      exportId: randomUUID(),
      recordingId: f.take.recordingId,
      kind: "processed-package",
      directory: f.output,
      leaf: "capture.zip",
    };
    const beforeJobs = f.store.catalog.prepare("SELECT * FROM jobs ORDER BY jobId").all();
    await assert.rejects(f.exports.create(request), { code: "UNSUPPORTED_EXPORT" });
    assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
    assert.deepEqual(
      f.store.catalog.prepare("SELECT * FROM jobs ORDER BY jobId").all(),
      beforeJobs,
    );
    assert.deepEqual(await readdir(f.output), []);
  });

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
}

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
