import { test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
const roots: string[] = [];
const stores: RevisionStore[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "screenrec-store-"));
  roots.push(root);
  let id = 0;
  const path = join(root, "library.sqlite");
  const providers = { now: () => "2026-09-15T00:00:00.000Z", newId: () => `id-${++id}` };
  const store = new RevisionStore(path, providers);
  stores.push(store);
  return { store, path, providers };
}
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
test("new incomplete allocation remains latest ahead of a finalized older take", () => {
  const { store } = fixture();
  const first = store.allocate();
  store.registerSource(first.recordingId, 20);
  const second = store.allocate();
  expect(store.latest()).toEqual({ ...second, sourceDurationUs: null, currentRevisionId: null });
  expect(store.get(first.recordingId)).toEqual({
    ...first,
    sourceDurationUs: 20,
    currentRevisionId: "r0",
  });
  expect(second.creationSequence).toBeGreaterThan(first.creationSequence);
});

test("cut persists exact spans and successful request replays before stale checks after reopen", () => {
  const { store, path, providers } = fixture();
  const rec = store.allocate();
  store.registerSource(rec.recordingId, 20);
  const request = {
    operation: "cut" as const,
    requestId: "first",
    expectedRevisionId: "r0",
    ranges: [
      { startUs: 3, endUs: 4 },
      { startUs: 10, endUs: 12 },
    ],
  };
  const a = store.edit(rec.recordingId, request);
  expect(a.spans).toEqual([
    { startUs: 0, endUs: 3 },
    { startUs: 4, endUs: 10 },
    { startUs: 12, endUs: 20 },
  ]);
  const b = store.edit(rec.recordingId, {
    operation: "trim",
    requestId: "second",
    expectedRevisionId: a.id,
    range: { startUs: 0, endUs: 10 },
  });
  store.close();
  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  expect(reopened.edit(rec.recordingId, request)).toEqual(a);
  expect(reopened.revision(rec.recordingId)).toEqual(b);
  expect(() =>
    reopened.edit(rec.recordingId, { ...request, ranges: [{ startUs: 1, endUs: 2 }] }),
  ).toThrow(expect.objectContaining({ code: "REQUEST_CONFLICT" }));
  expect(() => reopened.edit(rec.recordingId, { ...request, requestId: "stale" })).toThrow(
    expect.objectContaining({ code: "STALE_REVISION", details: { currentRevisionId: b.id } }),
  );
  expect(reopened.registerSource(rec.recordingId, 20).currentRevisionId).toBe(b.id);
  expect(() => reopened.registerSource(rec.recordingId, 21)).toThrow(
    expect.objectContaining({ code: "INVALID_STATE" }),
  );
});

test("two undos exhaust edits; restoring a historical revision is itself undoable", () => {
  const { store } = fixture();
  const { recordingId } = store.allocate();
  store.registerSource(recordingId, 20);
  const a = store.edit(recordingId, {
    operation: "cut",
    requestId: "a",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 3, endUs: 5 }],
  });
  const b = store.edit(recordingId, {
    operation: "cut",
    requestId: "b",
    expectedRevisionId: a.id,
    ranges: [{ startUs: 0, endUs: 2 }],
  });
  const c = store.edit(recordingId, {
    operation: "undo",
    requestId: "c",
    expectedRevisionId: b.id,
  });
  expect(c.spans).toEqual([
    { startUs: 0, endUs: 3 },
    { startUs: 5, endUs: 20 },
  ]);
  const d = store.edit(recordingId, {
    operation: "undo",
    requestId: "d",
    expectedRevisionId: c.id,
  });
  expect(d.spans).toEqual([{ startUs: 0, endUs: 20 }]);
  expect(() =>
    store.edit(recordingId, { operation: "undo", requestId: "empty", expectedRevisionId: d.id }),
  ).toThrow(expect.objectContaining({ code: "NOTHING_TO_UNDO" }));
  const e = store.edit(recordingId, {
    operation: "restore",
    requestId: "e",
    expectedRevisionId: d.id,
    targetRevisionId: b.id,
  });
  expect(e.spans).toEqual([
    { startUs: 2, endUs: 3 },
    { startUs: 5, endUs: 20 },
  ]);
  const f = store.edit(recordingId, {
    operation: "undo",
    requestId: "f",
    expectedRevisionId: e.id,
  });
  expect(f.spans).toEqual([{ startUs: 0, endUs: 20 }]);
  expect(() =>
    store.edit(recordingId, { operation: "undo", requestId: "empty2", expectedRevisionId: f.id }),
  ).toThrow(expect.objectContaining({ code: "NOTHING_TO_UNDO" }));
  expect([a.id, b.id, c.id, d.id, e.id, f.id]).toEqual([
    "id-2",
    "id-3",
    "id-4",
    "id-5",
    "id-6",
    "id-7",
  ]);
  expect(
    store
      .history(recordingId)
      .revisions.map((revision) => [revision.id, revision.parentId, revision.ordinal]),
  ).toEqual([
    ["r0", null, 0],
    ["id-2", "r0", 1],
    ["id-3", "id-2", 2],
    ["id-4", "id-3", 3],
    ["id-5", "id-4", 4],
    ["id-6", "id-5", 5],
    ["id-7", "id-6", 6],
  ]);
});

test("no-op trim persists replay without history and rejected edits leave no mutation", () => {
  const { store } = fixture();
  const { recordingId } = store.allocate();
  store.registerSource(recordingId, 20);
  const request = {
    operation: "trim" as const,
    requestId: "noop",
    expectedRevisionId: "r0",
    range: { startUs: 0, endUs: 20 },
  };
  expect(store.edit(recordingId, request).id).toBe("r0");
  expect(() =>
    store.edit(recordingId, {
      operation: "cut",
      requestId: "bad",
      expectedRevisionId: "r0",
      ranges: [
        { startUs: 1, endUs: 2 },
        { startUs: 0, endUs: 21 },
      ],
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_RANGE" }));
  expect(store.history(recordingId).revisions.map((rev) => rev.id)).toEqual(["r0"]);
  const changed = store.edit(recordingId, {
    operation: "cut",
    requestId: "bad",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 1, endUs: 2 }],
  });
  expect(store.edit(recordingId, request).id).toBe("r0");
  expect(store.revision(recordingId).id).toBe(changed.id);
  const page = store.history(recordingId, null, 1);
  expect(page.revisions.map((rev) => rev.id)).toEqual(["r0"]);
  expect(store.history(recordingId, page.nextCursor, 1).revisions.map((rev) => rev.id)).toEqual([
    changed.id,
  ]);
});

test("two processes competing on one expected revision commit one cut", async () => {
  const { store, path } = fixture();
  const { recordingId } = store.allocate();
  store.registerSource(recordingId, 20);
  const { spawn } = await import("node:child_process");
  const { EventEmitter } = await import("node:events");
  const workerScript = `
 import {RevisionStore} from ${JSON.stringify(new URL("../dist/library.js", import.meta.url).href)};
 const store=new RevisionStore(process.argv[1],{now:()=>new Date().toISOString(),newId:()=>process.argv[2]},1000);
 process.send('ready');
 process.on('message',()=>{
  try{const revision=store.edit(${JSON.stringify(recordingId)},{operation:'cut',requestId:process.argv[2],expectedRevisionId:'r0',ranges:[{startUs:3,endUs:5}]});process.send({ok:true,revision});}
  catch(error){process.send({ok:false,code:error.code,details:error.details});}
  finally{store.close();process.disconnect();}
 });`;
  const workers = ["race-a", "race-b"].map((id) =>
    spawn(process.execPath, ["--input-type=module", "-e", workerScript, path, id], {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    }),
  );
  try {
    await Promise.all(workers.map((worker) => EventEmitter.once(worker, "message")));
    const results = workers.map((worker) => EventEmitter.once(worker, "message"));
    for (const worker of workers) worker.send("go");
    const messages = (await Promise.all(results)).map(([message]) => message);
    const winner = messages.find((message) => message.ok);
    expect(
      messages.filter((message) => message.ok).map((message) => message.revision.spans),
    ).toEqual([
      [
        { startUs: 0, endUs: 3 },
        { startUs: 5, endUs: 20 },
      ],
    ]);
    expect(messages.filter((message) => !message.ok)).toEqual([
      { ok: false, code: "STALE_REVISION", details: { currentRevisionId: winner.revision.id } },
    ]);
    expect(store.history(recordingId).revisions.map((revision) => revision.id)).toEqual([
      "r0",
      winner.revision.id,
    ]);
  } finally {
    for (const worker of workers) worker.kill();
  }
}, 5000);

test("history continuation excludes revisions appended after its first page", () => {
  const { store } = fixture();
  const { recordingId } = store.allocate();
  store.registerSource(recordingId, 20);
  const a = store.edit(recordingId, {
    operation: "cut",
    requestId: "a",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 3, endUs: 5 }],
  });
  const first = store.history(recordingId, null, 1);
  expect(first.revisions.map((revision) => revision.id)).toEqual(["r0"]);
  const b = store.edit(recordingId, {
    operation: "cut",
    requestId: "b",
    expectedRevisionId: a.id,
    ranges: [{ startUs: 0, endUs: 2 }],
  });
  const second = store.history(recordingId, first.nextCursor, 1);
  expect(second.revisions.map((revision) => revision.id)).toEqual([a.id]);
  expect(second.nextCursor).toBeNull();
  expect(store.history(recordingId).revisions.map((revision) => revision.id)).toEqual([
    "r0",
    a.id,
    b.id,
  ]);
});
