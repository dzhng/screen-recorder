import { test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
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
test("terminal diagnostics survive reopen and duplicate delivery without a video revision", () => {
  const { store, path, providers } = fixture();
  const take = store.allocate().recording;
  const event = {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted" as const,
    reason: "AUDIO_WRITE_FAILED",
    message: "Narration stopped after a disk write failed.",
    sourceDurationUs: null,
  };
  store.ingestLifecycle(take.recordingId, event);
  store.close();
  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  const expected = {
    interruptionReason: event.reason,
    interruptionMessage: event.message,
    currentRevisionId: null,
    sourceDurationUs: null,
  };
  expect(reopened.get(take.recordingId)).toMatchObject(expected);
  expect(reopened.latest()).toMatchObject(expected);
  expect(reopened.list().recordings[0]).toMatchObject(expected);
  expect(
    reopened.ingestLifecycle(take.recordingId, { ...event, message: "duplicate" }),
  ).toMatchObject(expected);
  const withVideo = reopened.allocate().recording;
  reopened.ingestLifecycle(withVideo.recordingId, {
    ...event,
    sourceId: withVideo.sourceId,
    sourceDurationUs: 100,
  });
  expect(reopened.pinPackageSnapshot(withVideo.recordingId).snapshot.capture).toMatchObject({
    interruptionReason: event.reason,
    interruptionMessage: event.message,
  });
});
test("new incomplete allocation remains latest ahead of a finalized older take", () => {
  const { store } = fixture();
  const first = store.allocate().recording;
  store.registerSource(first.recordingId, 20);
  const second = store.allocate().recording;
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
  const rec = store.allocate().recording;
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
  const { recordingId } = store.allocate().recording;
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
  const { recordingId } = store.allocate().recording;
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
  const { recordingId } = store.allocate().recording;
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
  const { recordingId } = store.allocate().recording;
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
  const recording = store.allocate().recording;
  expect(recording.state).toBe("preparing");
  expect(recording.lifecycleSequence).toBe(0);
  expect(store.latest()).toEqual(recording);
  expect(() => store.revision(recording.recordingId)).toThrow(
    expect.objectContaining({ code: "NOT_READY" }),
  );
});

test("a whole take's reported transitions survive reopening and re-delivery of the journal", () => {
  const { store, path, providers } = fixture();
  const { recordingId, sourceId } = store.allocate().recording;
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
  const { recordingId, sourceId } = store.allocate().recording;
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
  const { recordingId, sourceId } = store.allocate().recording;
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
  const { recordingId, sourceId } = store.allocate().recording;
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
  const first = store.allocate().recording;
  const second = store.allocate().recording;
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
  const { recordingId, sourceId } = store.allocate().recording;
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
  const older = store.allocate().recording;
  store.registerSource(older.recordingId, 20);
  const abandoned = store.allocate({ requestId: "start-1", arguments: "{}" }).recording;
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
  const restarted = store.allocate({ requestId: "restart-1", arguments: "{}" }).recording;
  expect(restarted.recordingId).not.toBe(abandoned.recordingId);
  expect(store.latest()).toEqual(restarted);
  expect(store.allocate({ requestId: "restart-1", arguments: "{}" }).recording).toEqual(restarted);
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
  const { recordingId, sourceId } = store.allocate().recording;
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
  const { recordingId, sourceId } = store.allocate().recording;
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
  const oldest = store.allocate().recording;
  store.registerSource(oldest.recordingId, 20);
  const canceled = store.allocate().recording;
  store.ingestLifecycle(canceled.recordingId, {
    sourceId: canceled.sourceId,
    sequence: 1,
    state: "canceled",
  });
  const middle = store.allocate().recording;
  const newest = store.allocate().recording;
  const first = store.list(null, 1);
  expect(first.recordings).toEqual([newest]);
  expect(first.nextCursor).not.toBeNull();
  const added = store.allocate().recording;
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
  const recordings = Array.from({ length: 21 }, () => store.allocate().recording);
  const first = store.list();
  expect(first.recordings).toEqual(recordings.slice(1).reverse());
  expect(store.list(first.nextCursor)).toEqual({ recordings: [recordings[0]], nextCursor: null });
  expect(() => store.list(null, 101)).toThrow(expect.objectContaining({ code: "INVALID_PARAMS" }));
});

test("an allocation request is a durable receipt that replays and refuses different arguments", () => {
  const { store, path, providers } = fixture();
  const window = JSON.stringify(["window", 7, false]);
  const first = store.allocate({ requestId: "take-1", arguments: window });
  expect(first.replay).toBe(false);
  expect(store.allocate({ requestId: "take-1", arguments: window })).toEqual({
    recording: first.recording,
    replay: true,
  });
  // The same request ID asking for a different take is a caller mistake, not a second take.
  expect(() =>
    store.allocate({ requestId: "take-1", arguments: JSON.stringify(["window", 7, true]) }),
  ).toThrow(expect.objectContaining({ code: "REQUEST_CONFLICT" }));
  expect(store.latest()).toEqual(first.recording);
  // A request with no receipt of its own is always a fresh take.
  expect(store.allocate({ requestId: "take-2", arguments: window }).replay).toBe(false);
  expect(store.allocate().replay).toBe(false);

  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  expect(reopened.allocate({ requestId: "take-1", arguments: window })).toEqual({
    recording: first.recording,
    replay: true,
  });
  expect(() =>
    reopened.allocate({ requestId: "take-1", arguments: JSON.stringify(["display", 1, false]) }),
  ).toThrow(expect.objectContaining({ code: "REQUEST_CONFLICT" }));
});

test("a catalog in another format, or unstamped with tables, is refused without migrating its data", () => {
  const { store, path, providers } = fixture();
  const { recording } = store.allocate();
  store.registerSource(recording.recordingId, 20);
  store.close();
  const reopened = new RevisionStore(path, providers);
  expect(reopened.get(recording.recordingId).sourceDurationUs).toBe(20);
  reopened.close();
  for (const format of [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 2147483647,
  ]) {
    const other = new DatabaseSync(path);
    other.exec(`PRAGMA user_version=${format}`);
    other.close();
    const before = readFileSync(path);
    expect(() => new RevisionStore(path, providers)).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_CATALOG" }),
    );
    expect(readFileSync(path).equals(before)).toBe(true);
  }
});

test("deletion intent hides a take and fences replay and late source publication across restart", () => {
  const { store, path, providers } = fixture();
  const older = store.allocate().recording;
  const request = { requestId: "delete-me", arguments: "capture" };
  const recording = store.allocate(request).recording;
  store.registerSource(recording.recordingId, 20);
  expect(store.markDeleting(recording.recordingId)?.recordingId).toBe(recording.recordingId);
  expect(store.markDeleting(recording.recordingId)?.sourceId).toBe(recording.sourceId);
  expect(store.markDeleting("absent")).toBeNull();
  expect(store.latest()).toEqual(older);
  expect(store.list().recordings).toEqual([older]);
  expect(() => store.get(recording.recordingId)).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  expect(() => store.allocate(request)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  expect(() => store.registerSource(recording.recordingId, 20)).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  expect(() =>
    store.ingestLifecycle(recording.recordingId, {
      sourceId: recording.sourceId,
      sequence: 1,
      state: "recording",
    }),
  ).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  expect(store.settleDeletingCapture(recording.recordingId)).toMatchObject({
    state: "canceled",
    sourceDurationUs: 20,
    currentRevisionId: "r0",
  });
  expect(store.isDeleting(recording.recordingId)).toBe(true);
  expect(store.unsettled()).toEqual([older]);
  store.close();
  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  expect(reopened.deleting(recording.recordingId)?.sourceId).toBe(recording.sourceId);
  expect(() => reopened.revision(recording.recordingId)).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  expect(reopened.latest()).toEqual(older);
});

test("final deletion requires intent and rolls back if another owner retains a reference", () => {
  const { store } = fixture();
  const first = store.allocate().recording,
    sibling = store.allocate().recording;
  store.registerSource(first.recordingId, 20);
  const edited = store.edit(first.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 2, endUs: 4 }],
  });
  expect(edited.id).not.toBe("r0");
  expect(() => store.finishDeletion(first.recordingId)).toThrowError(
    expect.objectContaining({ code: "INVALID_STATE" }),
  );
  store.catalog.exec(
    "CREATE TABLE deletion_sentinel(recordingId TEXT REFERENCES recordings(recordingId))",
  );
  store.catalog.prepare("INSERT INTO deletion_sentinel VALUES(?)").run(first.recordingId);
  store.markDeleting(first.recordingId);
  expect(() => store.finishDeletion(first.recordingId)).toThrow();
  expect(store.deleting(first.recordingId)?.sourceId).toBe(first.sourceId);
  expect(
    store.catalog
      .prepare("SELECT id FROM revisions WHERE recordingId=? ORDER BY ordinal")
      .all(first.recordingId),
  ).toEqual([{ id: "r0" }, { id: edited.id }]);
  store.catalog.exec("DELETE FROM deletion_sentinel");
  store.finishDeletion(first.recordingId);
  store.finishDeletion(first.recordingId);
  expect(store.deleting(first.recordingId)).toBeNull();
  expect(store.isDeleting(first.recordingId)).toBe(false);
  expect(store.get(sibling.recordingId)).toEqual(sibling);
  for (const table of ["recordings", "revisions", "edit_requests", "undo_stack"])
    expect(
      store.catalog
        .prepare(`SELECT count(*) AS n FROM ${table} WHERE recordingId=?`)
        .get(first.recordingId),
    ).toEqual({ n: 0 });
});

test("deletion replay pages use stable recording IDs and survive restart", () => {
  const { store, path, providers } = fixture();
  const records = Array.from({ length: 5 }, () => store.allocate().recording);
  for (const recording of [records[3]!, records[0]!, records[4]!])
    store.markDeleting(recording.recordingId);
  const expected = [records[0]!, records[3]!, records[4]!].sort((a, b) =>
    a.recordingId.localeCompare(b.recordingId),
  );
  const first = store.deletionsPage(undefined, 2);
  expect(first).toEqual({
    recordings: expected.slice(0, 2),
    nextAfterId: expected[1]!.recordingId,
  });
  store.close();
  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  reopened.finishDeletion(expected[0]!.recordingId);
  expect(reopened.deletionsPage(first.nextAfterId!, 2)).toEqual({
    recordings: [expected[2]],
    nextAfterId: null,
  });
  expect(() => reopened.deletionsPage(undefined, 201)).toThrowError(
    expect.objectContaining({ code: "INVALID_PARAMS" }),
  );
});

test("finalization failure survives reopen and reads until an explicit attempt or terminal result", () => {
  const { store, path, providers } = fixture();
  const take = store.allocate().recording;
  const failure = { code: "RECOVERY_IO", message: "Retained media needs a retry", retryable: true };
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "finalizing",
    finalizationError: failure,
  });
  store.close();
  const reopened = new RevisionStore(path, providers);
  stores.push(reopened);
  expect(reopened.get(take.recordingId).finalizationError).toEqual(failure);
  expect(reopened.latest()!.finalizationError).toEqual(failure);
  expect(reopened.list().recordings[0]!.finalizationError).toEqual(failure);
  reopened.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 2,
    state: "finalizing",
  });
  expect(reopened.get(take.recordingId).finalizationError).toEqual(failure);
  reopened.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 3,
    state: "finalizing",
    finalizationError: null,
  });
  expect(reopened.get(take.recordingId).finalizationError).toBeNull();
  reopened.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 4,
    state: "finalizing",
    finalizationError: failure,
  });
  reopened.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 5,
    state: "interrupted",
    reason: "NO_SOURCE_MEDIA",
    sourceDurationUs: null,
  });
  expect(reopened.get(take.recordingId)).toMatchObject({
    finalizationError: null,
    interruptionReason: "NO_SOURCE_MEDIA",
  });
});
