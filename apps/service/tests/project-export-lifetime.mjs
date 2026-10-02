import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { fixture } from "./fixtures/project-export.mjs";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("project deletion needs no removed, moved or replaced export destination", async (t) => {
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
      projectId: f.projectId,
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
  assert.equal((await f.storage.usage()).otherBytes, 0);
  await f.deletion.delete(f.projectId);
  assert.deepEqual(f.projects.deletionsPage().projectIds, []);
  assert.equal(f.catalog.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
  assert.equal(await readFile(join(foreign, "payload"), "utf8"), "not this export's");
});

test("abandonment fences retries and project deletion joins its drain after external commit", async (t) => {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  t.after(() => release.resolve());
  const f = await fixture(t, {
    wrap:
      (run) =>
      async (operation, ...args) => {
        const result = await run(operation, ...args);
        if (operation === "publication.commit") {
          entered.resolve();
          await release.promise;
        }
        return result;
      },
  });
  const exportId = randomUUID(),
    request = {
      exportId,
      projectId: f.projectId,
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
  const deleting = f.deletion.delete(f.projectId).then(() => {
    deleted = true;
  });
  let cleanupClosed = false;
  const closing = f.exports.close().then(() => {
    cleanupClosed = true;
  });
  try {
    assert.throws(() => f.exports.abandon(exportId), { code: "SERVICE_STOPPED" });
    await new Promise(setImmediate);
    assert.equal(cleanupClosed, false);
    assert.equal(abandoned, false);
    assert.equal(deleted, false);
    assert.equal(f.jobs.isAttemptActive(f.jobs.job(status.jobId).attemptId), true);
    release.resolve();
    await Promise.all([removing, deleting, closing]);
    assert.deepEqual(f.projects.deletionsPage().projectIds, []);
    assert.deepEqual(await readdir(f.output), ["late.mp4"]);
    assert.deepEqual(await readFile(join(f.output, "late.mp4")), published);
  } finally {
    release.resolve();
    await Promise.allSettled([removing, deleting, closing]);
  }
});

test("a committed export remains authoritative when cancellation discards its late job result", async (t) => {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  t.after(() => release.resolve());
  const f = await fixture(t, {
    wrap:
      (run) =>
      async (op, ...args) => {
        const result = await run(op, ...args);
        if (op === "publication.commit") {
          entered.resolve();
          await release.promise;
        }
        return result;
      },
  });
  const exportId = randomUUID();
  await f.exports.create({
    exportId,
    projectId: f.projectId,
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
      target: { kind: "project", projectId: f.projectId, revisionId: f.placed.revision.id },
      artifact: "export-media",
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
  const f = await fixture(t, {
    wrap:
      (run) =>
      async (op, ...args) => {
        const result = await run(op, ...args);
        if (op === "publication.prepare") {
          entered.resolve();
          await release.promise;
        }
        return result;
      },
  });
  const exportId = randomUUID();
  await f.exports.create({
    exportId,
    projectId: f.projectId,
    kind: "video",
    directory: f.output,
    leaf: "never.mp4",
  });
  await entered.promise;
  const preview = (await f.preview.request({ projectId: f.projectId })).published.preview;
  assert.throws(
    () => f.cache.remove(preview.cacheId),
    (e) => e.code === "CACHE_BUSY",
  );
  let deleted = false;
  const done = f.deletion.delete(f.projectId).then(() => {
    deleted = true;
  });
  await new Promise(setImmediate);
  assert.equal(deleted, false);
  release.resolve();
  await done;
  assert.deepEqual(await readdir(f.output), []);
  assert.equal(f.catalog.catalog.prepare("SELECT COUNT(*) AS n FROM export_intents").get().n, 0);
});
