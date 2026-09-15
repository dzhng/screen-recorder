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
  const lineage = ["r0", a.id, b.id, c.id, d.id, e.id, f.id];
  expect(new Set(lineage).size).toBe(lineage.length);
  expect(
    store
      .history(recordingId)
      .revisions.map((revision) => [revision.id, revision.parentId, revision.ordinal]),
  ).toEqual(lineage.map((id, ordinal) => [id, lineage[ordinal - 1] ?? null, ordinal]));
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

test("allocation is discoverable as preparing before any capture reaches it", () => {
  const { store } = fixture();
  const recording = store.allocate();
  expect(recording.state).toBe("preparing");
  expect(recording.lifecycleSequence).toBe(0);
  expect(store.latest()).toEqual(recording);
  expect(() => store.revision(recording.recordingId)).toThrow(
    expect.objectContaining({ code: "NOT_READY" }),
  );
});

test("a whole take's reported transitions survive reopening and re-delivery of the journal", () => {
  const { store, path, providers } = fixture();
  const { recordingId, sourceId } = store.allocate();
  const journal = [
    { sourceId, sequence: 1, state: "recording" as const },
    { sourceId, sequence: 2, state: "paused" as const },
    { sourceId, sequence: 3, state: "recording" as const },
    { sourceId, sequence: 4, state: "finalizing" as const },
    { sourceId, sequence: 5, state: "complete" as const, sourceDurationUs: 20 },
  ];
  expect(journal.map((event) => store.ingestLifecycle(recordingId, event).state)).toEqual([
    "recording",
    "paused",
    "recording",
    "finalizing",
    "complete",
  ]);
  store.close();
  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  for (const event of journal)
    expect(reopened.ingestLifecycle(recordingId, event)).toEqual(reopened.get(recordingId));
  expect(reopened.get(recordingId)).toEqual(
    expect.objectContaining({ state: "complete", lifecycleSequence: 5, sourceDurationUs: 20 }),
  );
  expect(reopened.history(recordingId).revisions.map((revision) => revision.id)).toEqual(["r0"]);
});

test("a settled take keeps its outcome when late or contradicting reports arrive", () => {
  const { store } = fixture();
  const { recordingId, sourceId } = store.allocate();
  store.ingestLifecycle(recordingId, { sourceId, sequence: 4, state: "recording" });
  store.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 6,
    state: "interrupted",
    reason: "service_died",
    sourceDurationUs: 8,
  });
  const settled = store.get(recordingId);
  expect(settled).toEqual(
    expect.objectContaining({
      state: "interrupted",
      interruptionReason: "service_died",
      sourceDurationUs: 8,
      lifecycleSequence: 6,
    }),
  );
  expect(
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 5,
      state: "complete",
      sourceDurationUs: 20,
    }),
  ).toEqual(settled);
  expect(() =>
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 7,
      state: "complete",
      sourceDurationUs: 20,
    }),
  ).toThrow(
    expect.objectContaining({
      code: "INVALID_STATE",
      details: { state: "interrupted", reportedState: "complete" },
    }),
  );
  expect(() =>
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 8,
      state: "interrupted",
      reason: "no_decodable_video",
      sourceDurationUs: null,
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_STATE", details: { sourceDurationUs: 8 } }));
  expect(store.get(recordingId)).toEqual(settled);
  expect(store.revision(recordingId).sourceDurationUs).toBe(8);
});

test("a discarded take refuses a source registered after the fact", () => {
  const { store } = fixture();
  const { recordingId, sourceId } = store.allocate();
  store.ingestLifecycle(recordingId, { sourceId, sequence: 1, state: "canceled" });
  expect(() => store.registerSource(recordingId, 20)).toThrow(
    expect.objectContaining({ code: "INVALID_STATE", details: { state: "canceled" } }),
  );
  expect(store.get(recordingId)).toEqual(
    expect.objectContaining({ sourceDurationUs: null, currentRevisionId: null }),
  );
});

test("a lifecycle write that fails after attaching the source leaves nothing behind", () => {
  const { store } = fixture();
  const { recordingId, sourceId } = store.allocate();
  const capturing = store.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 1,
    state: "recording",
  });
  const rejected = {
    sourceId,
    sequence: 2,
    state: "interrupted" as const,
    // An unbindable reason fails the state write only after the original revision was inserted.
    reason: {} as unknown as string,
    sourceDurationUs: 8,
  };
  expect(() => store.ingestLifecycle(recordingId, rejected)).toThrow();
  expect(store.get(recordingId)).toEqual(capturing);
  expect(store.history(recordingId).revisions).toEqual([]);
  expect(store.ingestLifecycle(recordingId, { ...rejected, reason: "writer_died" })).toEqual(
    expect.objectContaining({
      state: "interrupted",
      interruptionReason: "writer_died",
      sourceDurationUs: 8,
      currentRevisionId: "r0",
    }),
  );
});

test("an event stamped with another capture session leaves the recording untouched", () => {
  const { store } = fixture();
  const first = store.allocate();
  const second = store.allocate();
  expect(() =>
    store.ingestLifecycle(first.recordingId, {
      sourceId: second.sourceId,
      sequence: 1,
      state: "recording",
    }),
  ).toThrow(
    expect.objectContaining({
      code: "INVALID_STATE",
      details: { sourceId: first.sourceId, reportedSourceId: second.sourceId },
    }),
  );
  expect(store.get(first.recordingId)).toEqual(first);
});

test("a completion for a take that never started capturing creates no timeline", () => {
  const { store } = fixture();
  const { recordingId, sourceId } = store.allocate();
  expect(() =>
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 1,
      state: "complete",
      sourceDurationUs: 20,
    }),
  ).toThrow(
    expect.objectContaining({
      code: "INVALID_STATE",
      details: { state: "preparing", reportedState: "complete" },
    }),
  );
  expect(store.get(recordingId)).toEqual(
    expect.objectContaining({ state: "preparing", sourceDurationUs: null, lifecycleSequence: 0 }),
  );
  expect(store.history(recordingId).revisions).toEqual([]);
});

test("a discarded take leaves discovery while its restart request still names one new take", () => {
  const { store } = fixture();
  const older = store.allocate();
  store.registerSource(older.recordingId, 20);
  const abandoned = store.allocate("start-1");
  store.ingestLifecycle(abandoned.recordingId, {
    sourceId: abandoned.sourceId,
    sequence: 1,
    state: "recording",
  });
  store.registerSource(abandoned.recordingId, 12);
  const edited = {
    operation: "cut" as const,
    requestId: "before-discard",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 2, endUs: 4 }],
  };
  store.edit(abandoned.recordingId, edited);
  store.ingestLifecycle(abandoned.recordingId, {
    sourceId: abandoned.sourceId,
    sequence: 2,
    state: "canceled",
  });
  expect(store.latest()!.recordingId).toBe(older.recordingId);
  const restarted = store.allocate("restart-1");
  expect(restarted.recordingId).not.toBe(abandoned.recordingId);
  expect(store.latest()).toEqual(restarted);
  expect(store.allocate("restart-1")).toEqual(restarted);
  expect(store.get(abandoned.recordingId).state).toBe("canceled");
  const discarded = expect.objectContaining({
    code: "UNAVAILABLE",
    details: { state: "canceled" },
  });
  expect(() => store.revision(abandoned.recordingId)).toThrow(discarded);
  expect(() => store.history(abandoned.recordingId)).toThrow(discarded);
  expect(() => store.edit(abandoned.recordingId, edited)).toThrow(discarded);
});

test("a take whose capture produced no video keeps its identity and reports video unavailable", () => {
  const { store } = fixture();
  const { recordingId, sourceId } = store.allocate();
  const failed = store.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "screen_permission_denied",
    sourceDurationUs: null,
  });
  expect(failed).toEqual(
    expect.objectContaining({
      state: "interrupted",
      interruptionReason: "screen_permission_denied",
      sourceDurationUs: null,
      currentRevisionId: null,
    }),
  );
  expect(store.latest()).toEqual(failed);
  expect(store.history(recordingId).revisions).toEqual([]);
  const unavailable = expect.objectContaining({
    code: "UNAVAILABLE",
    details: { state: "interrupted", interruptionReason: "screen_permission_denied" },
  });
  expect(() => store.revision(recordingId)).toThrow(unavailable);
  expect(() =>
    store.edit(recordingId, {
      operation: "trim",
      requestId: "after-failure",
      expectedRevisionId: "r0",
      range: { startUs: 0, endUs: 1 },
    }),
  ).toThrow(unavailable);
  const contradicted = expect.objectContaining({
    code: "INVALID_STATE",
    details: { state: "interrupted", interruptionReason: "screen_permission_denied" },
  });
  expect(() =>
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 2,
      state: "interrupted",
      reason: "recovered_prefix",
      sourceDurationUs: 8,
    }),
  ).toThrow(contradicted);
  expect(() => store.registerSource(recordingId, 8)).toThrow(contradicted);
  expect(store.get(recordingId)).toEqual(failed);
  expect(store.history(recordingId).revisions).toEqual([]);
});

test("repeating a validated finalization keeps exactly one original revision", () => {
  const { store } = fixture();
  const { recordingId, sourceId } = store.allocate();
  store.ingestLifecycle(recordingId, { sourceId, sequence: 1, state: "recording" });
  store.ingestLifecycle(recordingId, { sourceId, sequence: 2, state: "finalizing" });
  const complete = store.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 3,
    state: "complete",
    sourceDurationUs: 20,
  });
  expect(
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 4,
      state: "complete",
      sourceDurationUs: 20,
    }),
  ).toEqual({ ...complete, lifecycleSequence: 4 });
  expect(store.history(recordingId).revisions).toEqual([store.revision(recordingId, "r0")]);
  expect(store.revision(recordingId)).toEqual(
    expect.objectContaining({ id: "r0", spans: [{ startUs: 0, endUs: 20 }] }),
  );
  expect(() =>
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 5,
      state: "complete",
      sourceDurationUs: 21,
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_STATE", details: { sourceDurationUs: 20 } }));
  expect(store.get(recordingId).lifecycleSequence).toBe(4);
});

test("recording pages keep newest-first identity across new takes, edits and relaunch", () => {
  const { store, path, providers } = fixture();
  const oldest = store.allocate();
  store.registerSource(oldest.recordingId, 20);
  const canceled = store.allocate();
  store.ingestLifecycle(canceled.recordingId, {
    sourceId: canceled.sourceId,
    sequence: 1,
    state: "canceled",
  });
  const middle = store.allocate();
  const newest = store.allocate();
  const first = store.list(null, 1);
  expect(first.recordings).toEqual([newest]);
  expect(first.nextCursor).not.toBeNull();
  const added = store.allocate();
  const edited = store.edit(oldest.recordingId, {
    requestId: "list-edit",
    expectedRevisionId: "r0",
    operation: "cut",
    ranges: [{ startUs: 1, endUs: 2 }],
  });
  store.close();
  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  const rest = reopened.list(first.nextCursor, 2);
  expect(rest.recordings.map((recording) => recording.recordingId)).toEqual([
    middle.recordingId,
    oldest.recordingId,
  ]);
  expect(rest.recordings[1]?.currentRevisionId).toBe(edited.id);
  expect(rest.nextCursor).toBeNull();
  expect(reopened.list(null, 1).recordings).toEqual([added]);
});

test("recording discovery has an empty end page and the specified default page bound", () => {
  const { store } = fixture();
  expect(store.list()).toEqual({ recordings: [], nextCursor: null });
  const recordings = Array.from({ length: 21 }, () => store.allocate());
  const first = store.list();
  expect(first.recordings).toEqual(recordings.slice(1).reverse());
  expect(store.list(first.nextCursor)).toEqual({ recordings: [recordings[0]], nextCursor: null });
  expect(() => store.list(null, 101)).toThrow(expect.objectContaining({ code: "INVALID_PARAMS" }));
});
