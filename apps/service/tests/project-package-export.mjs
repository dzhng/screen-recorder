import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { ResourceReferences } from "@screenrec/core/references";
import { crashFixture } from "./fixtures/project-export-crash.mjs";
import { fixture } from "./fixtures/project-export.mjs";

test("project package export owns resource pins until commit and reopens retained project bytes", async (t) => {
  const f = await fixture(t, { admission: false });
  const request = { ...f.request(), kind: "processed-package", leaf: "project.zip" };
  await f.exports.create(request);
  const references = new ResourceReferences(f.catalog);
  assert.deepEqual(
    references
      .dependencies({ kind: "export", id: request.exportId })
      .map(({ kind, id }) => [kind, id]),
    [["asset", f.asset.id]],
  );
  f.jobs.startAdmission((job) => f.exports.admit(job));
  await f.jobs.idle();
  const status = f.exports.status(request.exportId);
  assert.equal(status.state, "committed", JSON.stringify(status));
  assert.deepEqual(references.dependencies({ kind: "export", id: request.exportId }), []);
  assert.deepEqual(await readdir(f.output), ["project.zip"]);
  assert.ok((await readFile(join(f.output, "project.zip"))).length > 0);
  const admission = await f.packages.open(status.output);
  await f.jobs.idle();
  const opened = f.packages.status(admission.id);
  assert.equal(opened.state, "ready", JSON.stringify(opened));
  assert.equal(opened.project.projectId, f.projectId);
  f.packages.adopt(opened.packageHandle, "adopt");
  await f.jobs.idle();
  const adopted = f.packages.adopt(opened.packageHandle, "adopt");
  assert.equal(adopted.state, "ready", JSON.stringify(adopted));
  assert.notEqual(adopted.result.projectId, f.projectId);
  const document = f.projects.revision(adopted.result.projectId).document;
  assert.equal(document.clips[0].assetId, f.asset.id);
  assert.equal(await readFile(f.assets.path(document.clips[0].assetId), "utf8"), "source identity");
  await f.packages.closeAdmission(admission.id);
});

test("committed project package retains counted private cleanup until retry without republishing", async (t) => {
  let refuse = true,
    publicationCalls = 0;
  const f = await fixture(t, {
    wrap:
      (run) =>
      async (operation, ...args) => {
        if (operation.startsWith("publication.")) publicationCalls++;
        if (operation === "packageWorkspace.remove" && refuse)
          throw new Error("generated private cleanup failure");
        return run(operation, ...args);
      },
  });
  const baseline = await f.storage.usage();
  const request = { ...f.request(), kind: "processed-package", leaf: "historical.zip" };
  await f.exports.create(request);
  await f.jobs.idle();
  const committed = f.exports.status(request.exportId);
  assert.equal(committed.state, "committed", JSON.stringify(committed));
  assert.equal(committed.cleanupPending, true);
  assert.deepEqual(
    f.exports
      .list({ unfinishedOnly: true })
      .exports.map((row) => [row.exportId, row.state, row.cleanupPending]),
    [[request.exportId, "committed", true]],
  );
  const original = await readFile(committed.output);
  const assembly = () =>
    f.catalog.catalog
      .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
      .get(request.exportId).assembly;
  const reservation = JSON.parse(assembly());
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
  const root = join(f.home, "package-exports");
  const owned =
    (await bytes(join(root, reservation.input.name))) +
    (await bytes(join(root, reservation.zip.name)));
  assert.ok(owned > 0);
  const retained = await f.storage.usage();
  assert.equal(retained.sharedBytes, baseline.sharedBytes + owned);
  assert.equal(retained.otherBytes, 0);
  const admitted = () =>
    f.catalog.catalog
      .prepare(
        "SELECT COUNT(*) AS n FROM export_intents WHERE receipt IS NULL OR abandoning=1 OR assembly IS NOT NULL",
      )
      .get().n;
  assert.equal(admitted(), 1);
  const moved = f.output + "-moved";
  await rename(f.output, moved);
  t.after(() => rename(moved, f.output).catch(() => {}));
  refuse = false;
  const before = publicationCalls;
  await f.exports.retry(request.exportId);
  await f.jobs.idle();
  assert.equal(
    publicationCalls,
    before,
    "Acknowledged publication needs no external access for private cleanup",
  );
  assert.equal(f.exports.status(request.exportId).state, "committed");
  assert.equal(assembly(), null);
  assert.equal(admitted(), 0);
  assert.deepEqual(await readdir(root), []);
  assert.equal((await f.storage.usage()).sharedBytes, baseline.sharedBytes);
  assert.deepEqual(f.exports.list({ unfinishedOnly: true }).exports, []);
  assert.equal(f.exports.status(request.exportId).cleanupPending, false);
  assert.deepEqual(await readFile(join(moved, "historical.zip")), original);
  await rename(moved, f.output);
});

for (const gap of ["create", "copy", "write", "commit", "cleanup"]) {
  test(`project package actual owner death at ${gap} retains recoverable workspace identity`, async (t) => {
    const { reopened: f, exportId } = await crashFixture(
      t,
      `package-${gap}`,
      undefined,
      "processed-package",
    );
    const assembly = () =>
      f.catalog.catalog
        .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
        .get(exportId).assembly;
    assert.ok(assembly());
    const destination = join(f.output, "recovered.zip");
    const before = await readFile(destination).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    assert.equal(!!before, ["commit", "cleanup"].includes(gap));
    f.exports.resumeRecovery();
    await f.jobs.idle();
    assert.equal(assembly(), null);
    assert.deepEqual(await readdir(join(f.home, "package-exports")), []);
    if (before) {
      assert.equal(f.exports.status(exportId).state, "committed");
      assert.deepEqual(await readFile(destination), before);
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
    const bytes = await readFile(destination);
    await f.exports.abandon(exportId);
    assert.deepEqual(await readFile(destination), bytes);
    assert.equal(await readFile(f.assets.path(f.asset.id), "utf8"), "source identity");
  });
}
