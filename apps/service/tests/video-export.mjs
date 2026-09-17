import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { fork, spawnSync } from "node:child_process";
import {
  mkdtemp,
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
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue } from "@screenrec/core/jobs";
import { DerivedCache } from "@screenrec/core/cache";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { SourceProcessing } from "@screenrec/core/processing";
import { PreviewInspection } from "@screenrec/core/preview";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { VideoExports } from "../dist/video-exports.js";
import { RecordingDeletion } from "../dist/deletion.js";
import { DerivativeDelivery } from "../dist/delivery.js";
import { ManagedFiles } from "../dist/managed-files.js";
import { mediaWorker } from "../dist/worker.js";
import { journalRows } from "../../macos/tests/fixtures/generated-capture.mjs";
const binary = process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native");
const native = mediaWorker({ SCREENREC_NATIVE: binary });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t, wrap = (value) => value, existing) {
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
  const worker = wrap(native);
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    execute: (execution) =>
      execution.job.artifact === "export-video"
        ? exports.execute(execution)
        : execution.job.artifact === "preview"
          ? preview.execute(execution)
          : processing.execute(execution),
  });
  const call = async (op, params, signal) => {
    const result = await native(op, params, { signal });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  processing = new SourceProcessing(store, jobs, evidence, home, (directory, output, signal) =>
    call("media.sourceEvidence", { directory, output }, signal),
  );
  preview = new PreviewInspection(store, jobs, cache, evidence, processing, home, (r, signal) =>
    call(
      "media.renderMovie",
      { source: r.source, plan: r.plan, tracks: r.tracks, output: r.output },
      signal,
    ),
  );
  const files = new ManagedFiles(home, native);
  exports = new VideoExports({ store, jobs, cache, preview, worker, files });
  processing.prepare(take.recordingId);
  await jobs.idle();
  preview.request({ recordingId: take.recordingId });
  await jobs.idle();
  const ready = preview.request({ recordingId: take.recordingId });
  assert.equal(ready.state, "ready");
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
    await deletion.close();
    await jobs.close();
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
  return { home, output, store, take, cache, jobs, preview, exports, deletion, ready, closeOwners };
}
async function crashFixture(t, gap) {
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
  await f.exports.createReady({
    exportId,
    recordingId: f.take.recordingId,
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
  const reopened = await fixture(t, undefined, existing);
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
  await f.exports.createReady({
    exportId,
    recordingId: f.take.recordingId,
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
  await fixture(
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
          (gap === "allocate" && op === "publication.allocate")
        ) {
          process.send({ gap });
          await new Promise(() => {});
        }
        return result;
      },
    existing,
  );
} else {
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
      directory: f.output,
      leaf: "recording.mp4",
    };
    const admitted = await f.exports.createReady(request);
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
    assert.equal((await f.exports.createReady(request)).exportId, admitted.exportId);
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
    await f.exports.createReady({
      exportId,
      recordingId: f.take.recordingId,
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
    await f.exports.createReady({
      exportId,
      recordingId: f.take.recordingId,
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
      await reopened.exports.recover(exportId);
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
    await f.exports.createReady({
      exportId,
      recordingId: f.take.recordingId,
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
      directory: f.output,
      leaf: "once.mp4",
    };
    const results = await Promise.all([
      f.exports.createReady(request),
      f.exports.createReady(request),
    ]);
    assert.equal(results[0].jobId, results[1].jobId);
    await f.jobs.idle();
    await assert.rejects(
      f.exports.createReady({ ...request, leaf: "different.mp4" }),
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
    await f.exports.createReady({
      exportId,
      recordingId: f.take.recordingId,
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
    await f.exports.createReady({
      exportId,
      recordingId: f.take.recordingId,
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
    const failed = f.exports.status(exportId);
    assert.equal(failed.state, "failed");
    assert.equal(failed.retryable, true);
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
      f.exports.createReady({
        exportId,
        recordingId: f.take.recordingId,
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
      await f.exports.createReady({
        exportId,
        recordingId: f.take.recordingId,
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
    await f.exports.createReady({
      exportId,
      recordingId: f.take.recordingId,
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
}
