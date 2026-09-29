import { validateComposition, projectToSource } from "@screenrec/composition";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore, compositionAsset } from "./assets.js";
import { ProjectStore } from "./projects.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const run of cleanup.splice(0).reverse()) await run();
});
async function setup() {
  const home = await mkdtemp(join(tmpdir(), "screenrec-projects-"));
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const path = join(home, "catalog.sqlite");
  const catalog = new Catalog(path);
  cleanup.push(async () => catalog.close());
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  return { home, path, catalog, assets, store: new ProjectStore(catalog, assets) };
}
const canvas = {
  width: 160,
  height: 96,
  fps: { numerator: 30, denominator: 1 },
  background: "#000000ff",
};
test("project edits survive restart and replay before stale-head checks with complete receipts", async () => {
  const { home, path, catalog, store } = await setup();
  const created = store.create({ requestId: "create", title: "Tutorial", canvas });
  const request = {
    requestId: "add",
    expectedRevisionId: created.revision.id,
    operations: [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "voice" },
      {
        operation: "processing.set",
        target: { kind: "track", id: { label: "voice" } },
        steps: [{ processor: { type: "gain", gain: 0.5 }, label: "gain" }],
      },
    ],
  };
  const edited = store.apply(created.project.projectId, request);
  expect(edited.edit.labels.gain).toBeTruthy();
  expect(edited.revision.document.processing[0]!.steps[0]!.processor).toEqual({
    type: "gain",
    gain: 0.5,
  });
  expect(store.apply(created.project.projectId, request)).toEqual(edited);
  catalog.close();
  const nextCatalog = new Catalog(path);
  cleanup.push(async () => nextCatalog.close());
  const reopened = new ProjectStore(nextCatalog, new AssetStore(nextCatalog, home));
  expect(reopened.apply(created.project.projectId, request)).toEqual(edited);
  expect(
    reopened.create({ canvas: { ...canvas }, title: "Tutorial", requestId: "create" }),
  ).toEqual(created);
  expect(reopened.revision(created.project.projectId).id).toBe(edited.revision.id);
  expect(() => reopened.apply(created.project.projectId, { ...request, operations: [] })).toThrow(
    /different arguments/,
  );
  expect(() =>
    reopened.apply(created.project.projectId, { ...request, requestId: "other" }),
  ).toThrow(/revision has changed/);
});

test("no-op receipts do not grow history; undo and restore append identities and history pages stay pinned", async () => {
  const { store } = await setup();
  const original = store.create({ requestId: "create", canvas });
  const id = original.project.projectId;
  const one = store.apply(id, {
    requestId: "one",
    expectedRevisionId: original.revision.id,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  const two = store.apply(id, {
    requestId: "two",
    expectedRevisionId: one.revision.id,
    operations: [{ operation: "canvas.set", canvas: { height: 240 } }],
  });
  const page = store.history(id, null, 1);
  expect(page.revisions.map((r) => r.id)).toEqual([original.revision.id]);
  const nothing = { requestId: "noop", expectedRevisionId: two.revision.id, operations: [] };
  expect(store.apply(id, nothing).revision).toEqual(two.revision);
  expect(store.history(id).revisions.map((r) => r.ordinal)).toEqual([0, 1, 2]);
  const undone = store.undo(id, { requestId: "undo-one", expectedRevisionId: two.revision.id });
  expect(undone.document).toEqual(one.revision.document);
  expect(undone.id).not.toBe(one.revision.id);
  expect(store.apply(id, nothing).revision).toEqual(two.revision);
  const undoneAgain = store.undo(id, { requestId: "undo-two", expectedRevisionId: undone.id });
  expect(undoneAgain.document).toEqual(original.revision.document);
  expect(() =>
    store.undo(id, { requestId: "undo-empty", expectedRevisionId: undoneAgain.id }),
  ).toThrow(/No active edit/);
  const restored = store.restore(id, {
    requestId: "restore",
    expectedRevisionId: undoneAgain.id,
    targetRevisionId: two.revision.id,
  });
  expect(restored.document).toEqual(two.revision.document);
  expect(restored.id).not.toBe(two.revision.id);
  expect(
    store.undo(id, { requestId: "undo-restore", expectedRevisionId: restored.id }).document,
  ).toEqual(original.revision.document);
  expect(store.history(id, page.nextCursor, 100).revisions.map((r) => r.ordinal)).toEqual([1, 2]);
});

test("late failed edits retain no partial state; historical revisions retain admitted media", async () => {
  const { store, assets, home } = await setup();
  const path = join(home, "input.wav");
  await writeFile(path, "fixture admission bytes");
  const asset = await assets.import(path, { kind: "import" }, async () => ({
    originUs: 9000,
    streams: [
      {
        id: "a",
        kind: "audio",
        codec: "pcm",
        decodable: true,
        startUs: 100,
        endUs: 300,
        segments: [
          { startUs: 100, endUs: 180, empty: false },
          { startUs: 180, endUs: 220, empty: true },
          { startUs: 220, endUs: 300, empty: false },
        ],
      },
    ],
  }));
  const created = store.create({ requestId: "create", canvas });
  const id = created.project.projectId;
  const operations = [
    { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
    {
      operation: "place",
      label: "clip",
      clip: {
        trackId: { label: "audio" },
        assetId: asset.id,
        streamId: "a",
        source: { kind: "range", range: { startUs: 100, endUs: 300 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 200 } },
      },
    },
  ];
  expect(() =>
    store.apply(id, {
      requestId: "attempt",
      expectedRevisionId: created.revision.id,
      operations: [...operations, { operation: "track.remove", trackId: { label: "audio" } }],
    }),
  ).toThrow(/clips explicitly/);
  expect(store.revision(id)).toEqual(created.revision);
  expect(assets.references(asset.id)).toEqual([]);
  const placed = store.apply(id, {
    requestId: "attempt",
    expectedRevisionId: created.revision.id,
    operations,
  });
  const mapped = validateComposition(placed.revision.document, [compositionAsset(asset)]);
  expect(projectToSource(mapped, 10)).toMatchObject([{ sourceUs: 110, available: true }]);
  expect(projectToSource(mapped, 100)).toMatchObject([{ sourceUs: 200, available: false }]);
  expect(assets.references(asset.id)).toEqual([{ kind: "revision", id: placed.revision.id }]);
  const removed = store.apply(id, {
    requestId: "remove",
    expectedRevisionId: placed.revision.id,
    operations: [{ operation: "remove", clipIds: [placed.edit.labels.clip], ripple: "none" }],
  });
  expect(removed.revision.document.clips).toEqual([]);
  expect(assets.references(asset.id)).toEqual([{ kind: "revision", id: placed.revision.id }]);
  const restored = store.undo(id, { requestId: "undo", expectedRevisionId: removed.revision.id });
  expect(restored.document).toEqual(placed.revision.document);
  expect(
    assets
      .references(asset.id)
      .map((r) => r.id)
      .sort(),
  ).toEqual([placed.revision.id, restored.id].sort());
});

test("independent catalog writers reject a stale head and keep project pagination scoped", async () => {
  const { store, path, home } = await setup();
  const original = store.create({ requestId: "one", title: "One", canvas });
  const second = store.create({ requestId: "two", title: "Two", canvas });
  const catalog = new Catalog(path);
  cleanup.push(async () => catalog.close());
  const competitor = new ProjectStore(catalog, new AssetStore(catalog, home));
  const request = {
    requestId: "writer-one",
    expectedRevisionId: original.revision.id,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  };
  const changed = store.apply(original.project.projectId, request);
  expect(() =>
    competitor.apply(original.project.projectId, { ...request, requestId: "writer-two" }),
  ).toThrow(/revision has changed/);
  expect(competitor.revision(original.project.projectId)).toEqual(changed.revision);
  expect(() => competitor.revision(second.project.projectId, changed.revision.id)).toThrow(
    /in project/,
  );
  const page = store.list({ limit: 1 });
  expect(page.projects.map((p) => p.title)).toEqual(["One"]);
  expect(store.list({ ...page.nextCursor!, limit: 1 }).projects.map((p) => p.title)).toEqual([
    "Two",
  ]);
  expect(() =>
    store.history(second.project.projectId, {
      projectId: original.project.projectId,
      afterOrdinal: -1,
      throughOrdinal: 0,
    }),
  ).toThrow(/cursor/);
});

test("deletion fences reads and replayed edits, survives restart, and retains creation identity", async () => {
  const { home, path, catalog, store } = await setup();
  const created = store.create({ requestId: "delete-me", canvas });
  const id = created.project.projectId;
  const request = { requestId: "noop", expectedRevisionId: created.revision.id, operations: [] };
  store.apply(id, request);
  expect(store.markDeleting(id)).toBe(true);
  expect(store.list().projects).toEqual([]);
  expect(() => store.get(id)).toThrow(/does not exist/);
  expect(() => store.apply(id, request)).toThrow(/does not exist/);
  catalog.close();
  const reopenedCatalog = new Catalog(path);
  cleanup.push(async () => reopenedCatalog.close());
  const reopened = new ProjectStore(reopenedCatalog, new AssetStore(reopenedCatalog, home));
  expect(reopened.deletionsPage().projectIds).toEqual([id]);
  expect(reopened.isDeleting(id)).toBe(true);
  expect(reopened.finishDeletionPage(id)).toBe(true);
  expect(reopened.deletionsPage().projectIds).toEqual([]);
  expect(reopened.create({ requestId: "delete-me", canvas })).toEqual(created);
  expect(reopened.list().projects).toEqual([]);
  expect(reopened.markDeleting(id)).toBe(false);
  expect(reopened.markDeleting("absent")).toBe(false);
});

test("large deleted histories retire in restartable pages without losing the tombstone", async () => {
  const { store, catalog } = await setup();
  const created = store.create({ requestId: "paged", canvas });
  let head = created.revision.id;
  for (let i = 0; i < 1500; i++) {
    head = store.apply(created.project.projectId, {
      requestId: `edit-${i}`,
      expectedRevisionId: head,
      operations: [{ operation: "canvas.set", canvas: { width: 200 + i } }],
    }).revision.id;
  }
  const id = created.project.projectId;
  store.markDeleting(id);
  let complete = false;
  while (!complete) {
    const before = Number(catalog.catalog.prepare("SELECT total_changes() AS count").get()!.count);
    complete = store.finishDeletionPage(id);
    const after = Number(catalog.catalog.prepare("SELECT total_changes() AS count").get()!.count);
    // Empty-media histories must not retire thousands of rows in one blocking transaction.
    expect(after - before).toBeLessThanOrEqual(1024);
    if (!complete) expect(store.deletionsPage().projectIds).toEqual([id]);
  }
  expect(store.deletionsPage().projectIds).toEqual([]);
  expect(store.isDeleting(id)).toBe(true);
  expect(store.create({ requestId: "paged", canvas })).toEqual(created);
  expect(store.list().projects).toEqual([]);
});

test("portable adoption preserves history and active undo independently and publishes dependencies atomically", async () => {
  const donor = await setup(),
    receiver = await setup();
  const initial = donor.store.create({ requestId: "donor", title: "Portable", canvas });
  const id = initial.project.projectId;
  const first = donor.store.apply(id, {
    requestId: "first",
    expectedRevisionId: initial.revision.id,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  const second = donor.store.apply(id, {
    requestId: "second",
    expectedRevisionId: first.revision.id,
    operations: [{ operation: "canvas.set", canvas: { height: 240 } }],
  });
  donor.store.undo(id, { requestId: "undo-second", expectedRevisionId: second.revision.id });
  const snapshot = donor.store.snapshot(id);
  const input = { requestId: "adopt", packageIdentity: "verified-archive", snapshot };
  expect(() =>
    receiver.store.prepareAdoption(input).publish(() => {
      receiver.catalog.catalog
        .prepare("INSERT INTO assets(id,metadata) VALUES(?,?)")
        .run("partial", "{}");
      throw new Error("dependency canceled");
    }),
  ).toThrow("dependency canceled");
  expect(receiver.assets.list().assets).toEqual([]);
  expect(receiver.store.list().projects).toEqual([]);
  const adopted = receiver.store.prepareAdoption(input).publish(() => {});
  expect(adopted.project.projectId).not.toBe(id);
  expect(
    receiver.store.prepareAdoption(input).publish(() => {
      throw new Error("must not publish twice");
    }),
  ).toEqual(adopted);
  expect(
    receiver.store.history(adopted.project.projectId).revisions.map((r) => r.document),
  ).toEqual(snapshot.revisions.map((r) => r.document));
  donor.store.markDeleting(id);
  const undone = receiver.store.undo(adopted.project.projectId, {
    requestId: "undo-first",
    expectedRevisionId: adopted.revision.id,
  });
  expect(undone.document).toEqual(initial.revision.document);
  expect(() =>
    receiver.store.prepareAdoption({ ...input, packageIdentity: "other" }).publish(() => {}),
  ).toThrow(/another package/);
  const broken = structuredClone(snapshot);
  broken.revisions.splice(1, 1);
  expect(() =>
    receiver.store
      .prepareAdoption({ ...input, requestId: "invalid", snapshot: broken })
      .publish(() => {}),
  ).toThrow(/incomplete/);
});

test("portable adoption retains media used only by a past revision and restores it through undo", async () => {
  const donor = await setup(),
    receiver = await setup();
  const source = join(donor.home, "source.wav");
  await writeFile(source, "lossless fixture bytes");
  const asset = await donor.assets.import(source, { kind: "generated" }, async () => ({
    originUs: 0,
    streams: [
      {
        id: "a",
        kind: "audio",
        codec: "pcm",
        decodable: true,
        startUs: 0,
        endUs: 1000,
        segments: [{ startUs: 0, endUs: 1000, empty: false }],
      },
    ],
  }));
  const created = donor.store.create({ requestId: "create", canvas });
  const placed = donor.store.apply(created.project.projectId, {
    requestId: "place",
    expectedRevisionId: created.revision.id,
    operations: [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      {
        operation: "place",
        label: "voice",
        clip: {
          trackId: { label: "audio" },
          assetId: asset.id,
          streamId: "a",
          source: { kind: "range", range: { startUs: 0, endUs: 1000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000 } },
        },
      },
    ],
  });
  donor.store.apply(created.project.projectId, {
    requestId: "remove",
    expectedRevisionId: placed.revision.id,
    operations: [{ operation: "remove", clipIds: [placed.edit.labels.voice], ripple: "none" }],
  });
  donor.assets.retain({ kind: "revision", id: created.revision.id }, [asset.id]);
  const staged = await receiver.assets.stagePortable(
    donor.assets.portable(asset.id),
    donor.assets.path(asset.id),
    new AbortController().signal,
  );
  const adopted = receiver.store
    .prepareAdoption({
      requestId: "copy",
      packageIdentity: "verified",
      snapshot: donor.store.snapshot(created.project.projectId),
    })
    .publish(() => staged.publish());
  await staged.close();
  expect(adopted.revision.document.clips).toEqual([]);
  expect(
    receiver.assets
      .references(asset.id)
      .map((owner) => owner.id)
      .sort(),
  ).toEqual(
    [adopted.revisionIds[placed.revision.id], adopted.revisionIds[created.revision.id]].sort(),
  );
  expect(receiver.store.snapshot(adopted.project.projectId).references).toContainEqual({
    revisionId: adopted.revisionIds[created.revision.id],
    resources: [{ kind: "asset", id: asset.id }],
  });
  await rm(source);
  await rm(donor.assets.path(asset.id));
  const undone = receiver.store.undo(adopted.project.projectId, {
    requestId: "undo",
    expectedRevisionId: adopted.revision.id,
  });
  expect(undone.document).toEqual(placed.revision.document);
  expect(receiver.assets.get(asset.id)).toEqual(asset);
});

test("prepared adoption stays invisible and concurrent publication uses the winning identities", async () => {
  const donor = await setup(),
    receiver = await setup();
  const created = donor.store.create({ requestId: "donor", canvas });
  const input = {
    requestId: "race",
    packageIdentity: "archive",
    snapshot: donor.store.snapshot(created.project.projectId),
  };
  const first = receiver.store.prepareAdoption(input);
  const second = receiver.store.prepareAdoption(input);
  expect(first.project.projectId).not.toBe(second.project.projectId);
  expect(receiver.store.list().projects).toEqual([]);
  expect(() => receiver.store.revision(first.project.projectId)).toThrow();
  const winner = first.publish(() => {});
  const loser = second.publish(() => {
    throw new Error("loser must not publish dependencies");
  });
  expect(loser).toEqual(winner);
  expect(winner.project).toEqual(first.project);
  expect(winner.revisionIds).toEqual(first.revisionIds);
  expect(receiver.store.list().projects).toEqual([winner.project]);
  const replay = receiver.store.prepareAdoption(input);
  expect(replay.project).toEqual(winner.project);
  expect(
    replay.publish(() => {
      throw new Error("replay must not publish");
    }),
  ).toEqual(winner);
  expect(() => receiver.store.prepareAdoption({ ...input, packageIdentity: "different" })).toThrow(
    /another package/,
  );
});

test("historical snapshots pin their own history and undo before later restore and edits", async () => {
  const donor = await setup(),
    receiver = await setup();
  const initial = donor.store.create({ requestId: "historical", canvas });
  const id = initial.project.projectId;
  const first = donor.store.apply(id, {
    requestId: "one",
    expectedRevisionId: initial.revision.id,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  }).revision;
  const second = donor.store.apply(id, {
    requestId: "two",
    expectedRevisionId: first.id,
    operations: [{ operation: "canvas.set", canvas: { height: 240 } }],
  }).revision;
  const undone = donor.store.undo(id, { requestId: "undo", expectedRevisionId: second.id });
  const restored = donor.store.restore(id, {
    requestId: "restore",
    expectedRevisionId: undone.id,
    targetRevisionId: second.id,
  });
  const later = donor.store.apply(id, {
    requestId: "later",
    expectedRevisionId: restored.id,
    operations: [{ operation: "canvas.set", canvas: { width: 640 } }],
  }).revision;
  for (const [selected, targets] of [
    [initial.revision, []],
    [second, [first, initial.revision]],
    [undone, [initial.revision]],
    [restored, [undone, initial.revision]],
  ] as const) {
    const snapshot = donor.store.snapshot(id, selected.id);
    expect(snapshot.project.currentRevisionId).toBe(selected.id);
    expect(snapshot.revisions.map((r) => r.id)).toEqual(
      [initial.revision, first, second, undone, restored]
        .slice(0, selected.ordinal + 1)
        .map((r) => r.id),
    );
    const adopted = receiver.store
      .prepareAdoption({ requestId: selected.id, packageIdentity: selected.id, snapshot })
      .publish(() => {});
    let head = adopted.revision;
    expect(head.document).toEqual(selected.document);
    for (const target of targets) {
      head = receiver.store.undo(adopted.project.projectId, {
        requestId: target.id,
        expectedRevisionId: head.id,
      });
      expect(head.document).toEqual(target.document);
    }
    expect(() =>
      receiver.store.undo(adopted.project.projectId, {
        requestId: "empty",
        expectedRevisionId: head.id,
      }),
    ).toThrow(/No active edit/);
  }
  expect(donor.store.snapshot(id, later.id)).toEqual(donor.store.snapshot(id));
  expect(donor.store.revision(id)).toEqual(later);
  expect(() => donor.store.snapshot(id, "missing")).toThrow(/Revision does not exist/);
});
