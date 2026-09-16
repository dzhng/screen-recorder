import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat, symlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { CatalogError, RevisionStore } from "@screenrec/core/library";
import { JobQueue, type JobExecutor } from "@screenrec/core/jobs";
import { DerivedCache } from "@screenrec/core/cache";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { CaptureService } from "./capture.js";
import { DerivativeDelivery } from "./delivery.js";
import { RecordingDeletion } from "./deletion.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture(
  execute: JobExecutor = async () => "ready",
  ready = Promise.resolve(),
  existingHome?: string,
) {
  const home = existingHome ?? (await mkdtemp("/tmp/screenrec-delete-"));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const cache = new DerivedCache(store, home);
  await cache.reconcile();
  const jobs = new JobQueue({ store, providers: { newId: randomUUID }, execute });
  const capture = new CaptureService(
    store,
    home,
    async () => {
      throw new Error("Settled fixture must not call native capture");
    },
    async () => {
      throw new Error("Settled fixture must not recover source media");
    },
  );
  const delivery = new DerivativeDelivery();
  const owners = {
    store,
    jobs,
    cache,
    capture,
    delivery,
    source: new SourceEvidenceStore(store),
    scenes: new SceneEvidenceStore(store),
    index: new ScreenshotIndexStore(store, home),
    cleanupReady: () => ready,
    // Coordinator tests model native receipts. The native suite owns race/containment proof.
    files: {
      async removeRecordingDirectory(recordingId: string) {
        const path = join(home, "recordings", recordingId);
        try {
          if ((await lstat(path)).isSymbolicLink())
            throw new CatalogError("INVALID_STORAGE", "Fixture refuses a substituted root");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await rm(path, { recursive: true, force: true });
      },
      async removeCacheFiles(ids: string[]) {
        for (const id of ids)
          await rm(join(home, "cache", "derived", `${id}.cache`), { force: true });
      },
    },
  };
  const deletion = new RecordingDeletion(owners);
  let closed = false;
  async function closeOwners() {
    if (closed) return;
    closed = true;
    await deletion.close();
    delivery.dispose();
    await Promise.all([capture.close(), jobs.close()]);
    store.close();
  }
  cleanup.push(async () => {
    await closeOwners();
    await rm(home, { recursive: true, force: true });
  });
  async function take() {
    const recording = store.allocate().recording;
    const sourceId = recording.sourceId;
    for (const event of [
      { sourceId, sequence: 1, state: "recording" },
      { sourceId, sequence: 2, state: "finalizing" },
      { sourceId, sequence: 3, state: "complete", sourceDurationUs: 1_000_000 },
    ] as const)
      store.ingestLifecycle(recording.recordingId, event);
    const directory = join(home, "recordings", recording.recordingId);
    await mkdir(join(directory, "source"), { recursive: true });
    const video = join(directory, "source", "video.mov");
    await writeFile(video, recording.sourceId);
    return { ...recording, directory, video };
  }
  return { ...owners, deletion, home, take, closeOwners };
}

test("delete coalesces callers, revokes delivery immediately, and waits for a closing worker", async () => {
  const entered = deferred<AbortSignal>();
  const finish = deferred<string>();
  const f = await fixture(async ({ job, signal }) => {
    if (job.artifact === "held") {
      entered.resolve(signal);
      return finish.promise;
    }
    return "sibling result";
  });
  const target = await f.take(),
    sibling = await f.take();
  const file = f.cache.reserve(target.recordingId);
  await writeFile(file.path, "private derivative");
  await f.cache.publish(file.id);
  const lease = f.delivery.open(target.recordingId, () => f.cache.acquire(file.id));
  const request = {
    recordingId: target.recordingId,
    revisionId: "r0",
    lane: "frame" as const,
    artifact: "held",
    input: "fixture",
  };
  f.jobs.submit(request);
  const signal = await entered.promise;
  let finished: Promise<unknown> = Promise.resolve();
  try {
    let deleted = false;
    const first = f.deletion.delete(target.recordingId).then((result) => {
      deleted = true;
      return result;
    });
    const second = f.deletion.delete(target.recordingId);
    finished = Promise.allSettled([first, second]);
    expect(() => f.delivery.read(lease.token, 0, 1)).toThrow(
      expect.objectContaining({ code: "ARTIFACT_EXPIRED" }),
    );
    expect(() => f.store.get(target.recordingId)).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
    await setImmediate();
    expect(signal.aborted).toBe(true);
    expect(deleted).toBe(false);
    expect(await readFile(target.video, "utf8")).toBe(target.sourceId);
    const other = { ...request, recordingId: sibling.recordingId, artifact: "other" };
    f.jobs.submit(other);
    await expect.poll(() => f.jobs.status(other).published?.result).toBe("sibling result");
    finish.resolve("late result");
    await expect(first).resolves.toEqual({ recordingId: target.recordingId, deleted: true });
    await expect(second).resolves.toEqual({ recordingId: target.recordingId, deleted: true });
    await expect(lstat(target.directory)).rejects.toMatchObject({ code: "ENOENT" });
    expect(f.store.deleting(target.recordingId)).toBeNull();
    expect(f.jobs.status(request).jobId).toBeNull();
    expect(await readFile(sibling.video, "utf8")).toBe(sibling.sourceId);
    await expect(f.deletion.delete(target.recordingId)).resolves.toMatchObject({ deleted: true });
    await expect(f.deletion.delete("../outside")).resolves.toMatchObject({ deleted: true });
  } finally {
    finish.resolve("late result");
    await finished;
  }
});

test("startup cleanup completion gates removal; a failed path keeps intent for retry", async () => {
  const ready = deferred<void>();
  const f = await fixture(undefined, ready.promise);
  const target = await f.take(),
    sibling = await f.take();
  const original = join(target.directory, "original");
  // A substituted recording root cannot authorize removing the link's target.
  await rm(target.directory, { recursive: true });
  await symlink(sibling.directory, target.directory);
  let settled = false;
  const result = f.deletion.delete(target.recordingId).finally(() => {
    settled = true;
  });
  void result.catch(() => {});
  try {
    await setImmediate();
    expect(settled).toBe(false);
    ready.resolve();
    await expect(result).rejects.toMatchObject({ code: "INVALID_STORAGE" });
    expect(f.store.deleting(target.recordingId)?.recordingId).toBe(target.recordingId);
    expect(await readFile(sibling.video, "utf8")).toBe(sibling.sourceId);
    await rm(target.directory);
    await mkdir(target.directory);
    await writeFile(original, "owned leftover");
    await expect(f.deletion.delete(target.recordingId)).resolves.toMatchObject({ deleted: true });
    await expect(lstat(original)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(sibling.video, "utf8")).toBe(sibling.sourceId);
  } finally {
    ready.resolve();
  }
});

test("startup resumes durable intents and a failed recording does not strand another deletion", async () => {
  const home = await mkdtemp("/tmp/screenrec-delete-restart-");
  const seed = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "",
    newId: randomUUID,
  });
  const takes = [seed.allocate().recording, seed.allocate().recording];
  for (const take of takes) {
    seed.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "fixture",
      sourceDurationUs: 1,
    });
    seed.markDeleting(take.recordingId);
  }
  seed.close();
  const [blocked, valid] = takes.sort((a, b) => (a.recordingId < b.recordingId ? -1 : 1));
  const outside = join(home, "sentinel");
  await mkdir(outside);
  await writeFile(join(outside, "keep"), "untouched");
  const roots = join(home, "recordings");
  await mkdir(roots);
  await symlink(outside, join(roots, blocked!.recordingId));
  await mkdir(join(roots, valid!.recordingId));
  await writeFile(join(roots, valid!.recordingId, "partial"), "owned");
  const f = await fixture(undefined, undefined, home);
  const errors: unknown[] = [];
  await f.deletion.resume((error) => errors.push(error));
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({ code: "INVALID_STORAGE" });
  expect(f.store.deleting(blocked!.recordingId)?.sourceId).toBe(blocked!.sourceId);
  expect(f.store.markDeleting(valid!.recordingId)).toBeNull();
  await expect(lstat(join(roots, valid!.recordingId))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(outside, "keep"), "utf8")).toBe("untouched");
  await rm(join(roots, blocked!.recordingId));
  await f.deletion.resume((error) => errors.push(error));
  expect(f.store.deletionsPage().recordings).toEqual([]);
  expect(errors).toHaveLength(1);
  expect(await readFile(join(outside, "keep"), "utf8")).toBe("untouched");
});

test("failure after file removal retains restart intent until catalog cleanup succeeds", async () => {
  const f = await fixture();
  const target = await f.take();
  f.store.catalog.exec(
    "CREATE TRIGGER block_final_delete BEFORE DELETE ON recordings BEGIN SELECT RAISE(ABORT, 'fixture cleanup fault'); END",
  );
  await expect(f.deletion.delete(target.recordingId)).rejects.toMatchObject({
    code: "DELETE_FAILED",
    retryable: true,
  });
  await expect(lstat(target.directory)).rejects.toMatchObject({ code: "ENOENT" });
  expect(f.store.deleting(target.recordingId)?.sourceId).toBe(target.sourceId);
  f.store.catalog.exec("DROP TRIGGER block_final_delete");
  await f.closeOwners();
  const reopened = await fixture(undefined, undefined, f.home);
  const failures: unknown[] = [];
  await reopened.deletion.resume((error) => failures.push(error));
  expect(failures).toEqual([]);
  expect(reopened.store.markDeleting(target.recordingId)).toBeNull();
  await expect(reopened.deletion.delete(target.recordingId)).resolves.toMatchObject({
    deleted: true,
  });
});

test("capture refusal still waits for a closing worker and preserves retryable intent", async () => {
  const entered = deferred<void>();
  const finish = deferred<string>();
  const f = await fixture(async () => {
    entered.resolve();
    return finish.promise;
  });
  const target = await f.take();
  f.capture.quiesce = async () => {
    throw new CatalogError("INVALID_STATE", "Native closure not proven");
  };
  f.jobs.submit({
    recordingId: target.recordingId,
    revisionId: "r0",
    lane: "frame",
    artifact: "held",
    input: "fixture",
  });
  await entered.promise;
  let settled = false;
  const result = f.deletion.delete(target.recordingId).finally(() => {
    settled = true;
  });
  void result.catch(() => {});
  try {
    await setImmediate();
    expect(settled).toBe(false);
    expect(await readFile(target.video, "utf8")).toBe(target.sourceId);
    finish.resolve("late");
    await expect(result).rejects.toMatchObject({ code: "INVALID_STATE", retryable: true });
    expect(f.store.deleting(target.recordingId)?.sourceId).toBe(target.sourceId);
    expect(await readFile(target.video, "utf8")).toBe(target.sourceId);
  } finally {
    finish.resolve("late");
    await Promise.allSettled([result]);
  }
});

test("close drains held startup cleanup and aborts before removing files", async () => {
  const ready = deferred<void>();
  const f = await fixture(undefined, ready.promise);
  const target = await f.take();
  const result = f.deletion.delete(target.recordingId);
  void result.catch(() => {});
  let closed = false;
  const closing = f.deletion.close().then(() => {
    closed = true;
  });
  try {
    await setImmediate();
    expect(closed).toBe(false);
    expect(() => f.deletion.delete(target.recordingId)).toThrow(
      expect.objectContaining({ code: "SERVICE_STOPPED" }),
    );
    ready.resolve();
    await closing;
    await expect(result).rejects.toMatchObject({ code: "DELETE_FAILED", retryable: true });
    expect(f.store.deleting(target.recordingId)?.sourceId).toBe(target.sourceId);
    expect(await readFile(target.video, "utf8")).toBe(target.sourceId);
  } finally {
    ready.resolve();
    await closing;
  }
});

test("close waits for the native deletion receipt before allowing the catalog to close", async () => {
  const f = await fixture();
  const target = await f.take();
  const entered = deferred<void>();
  const finish = deferred<void>();
  f.files.removeRecordingDirectory = async () => {
    entered.resolve();
    await finish.promise;
  };
  const result = f.deletion.delete(target.recordingId);
  void result.catch(() => {});
  await entered.promise;
  let closed = false;
  const closing = f.deletion.close().then(() => {
    closed = true;
  });
  try {
    await setImmediate();
    expect(closed).toBe(false);
    expect(f.store.deleting(target.recordingId)?.sourceId).toBe(target.sourceId);
    finish.resolve();
    await closing;
    await expect(result).rejects.toMatchObject({ retryable: true });
    expect(f.store.deleting(target.recordingId)?.sourceId).toBe(target.sourceId);
  } finally {
    finish.resolve();
    await closing;
  }
});
