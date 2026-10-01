import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CaptureStore } from "./capture-store.js";

const roots: string[] = [];
const stores: CaptureStore[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "screenrec-capture-facts-"));
  roots.push(root);
  let id = 0;
  const path = join(root, "catalog.sqlite");
  const providers = { now: () => "2026-10-01T00:00:00.000Z", newId: () => `take-${++id}` };
  const store = new CaptureStore(path, providers);
  stores.push(store);
  return { store, path, providers };
}
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("fresh capture settles and reopens without creating a revision or project", () => {
  const { store, path, providers } = fixture();
  const request = { requestId: "capture-one", arguments: "selected-screen-and-audio" };
  const allocated = store.allocate(request).recording;
  const { recordingId, sourceId } = allocated;
  store.ingestLifecycle(recordingId, { sourceId, sequence: 1, state: "recording" });
  store.ingestLifecycle(recordingId, { sourceId, sequence: 2, state: "finalizing" });
  const terminal = { sourceId, sequence: 3, state: "complete" as const, sourceDurationUs: 1200 };
  const expected = {
    ...allocated,
    state: "complete",
    lifecycleSequence: 3,
    sourceDurationUs: 1200,
    currentRevisionId: null,
  };
  expect(store.ingestLifecycle(recordingId, terminal)).toEqual(expected);
  store.close();
  const reopened = new CaptureStore(path, providers);
  stores.push(reopened);
  expect(reopened.allocate(request)).toEqual({ recording: expected, replay: true });
  expect(() => reopened.allocate({ ...request, arguments: "another-screen" })).toThrowError(
    expect.objectContaining({ code: "REQUEST_CONFLICT" }),
  );
  expect(reopened.ingestLifecycle(recordingId, terminal)).toEqual(expected);
  expect(() =>
    reopened.ingestLifecycle(recordingId, { ...terminal, sequence: 4, sourceDurationUs: 1300 }),
  ).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  expect(reopened.get(recordingId)).toEqual(expected);
  expect(reopened.latest()).toEqual(expected);
  expect(reopened.list()).toEqual({ recordings: [expected], nextCursor: null });
  expect(reopened.unsettled()).toEqual([]);
  expect(
    reopened.catalog
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('revisions','edit_requests','undo_stack','projects','project_revisions')",
      )
      .all(),
  ).toEqual([]);
});

test("invalid source durations leave capture facts unchanged and no-video remains final", () => {
  const { store } = fixture();
  const recording = store.allocate().recording;
  for (const duration of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => store.registerSource(recording.recordingId, duration)).toThrowError(
      expect.objectContaining({ code: "INVALID_RANGE" }),
    );
    expect(store.get(recording.recordingId)).toEqual(recording);
  }
  const terminal = store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "NO_VIDEO",
    sourceDurationUs: null,
  });
  expect(terminal).toEqual({
    ...recording,
    state: "interrupted",
    lifecycleSequence: 1,
    interruptionReason: "NO_VIDEO",
  });
  expect(() => store.registerSource(recording.recordingId, 1200)).toThrowError(
    expect.objectContaining({ code: "INVALID_STATE" }),
  );
  expect(store.get(recording.recordingId)).toEqual(terminal);
});

test("fresh deletion fences replay across reopen and removes only the named capture", () => {
  const { store, path, providers } = fixture();
  const sibling = store.allocate().recording;
  const request = { requestId: "discard-one", arguments: "screen" };
  const take = store.allocate(request).recording;
  expect(() => store.finishDeletion(take.recordingId)).toThrowError(
    expect.objectContaining({ code: "INVALID_STATE" }),
  );
  expect(store.markDeleting(take.recordingId)).toEqual(take);
  const canceled = store.settleDeletingCapture(take.recordingId);
  expect(canceled).toEqual({ ...take, state: "canceled" });
  store.close();
  const reopened = new CaptureStore(path, providers);
  stores.push(reopened);
  expect(reopened.deleting(take.recordingId)).toEqual(canceled);
  expect(reopened.unsettled()).toEqual([sibling]);
  expect(reopened.list()).toEqual({ recordings: [sibling], nextCursor: null });
  expect(() => reopened.allocate(request)).toThrowError(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  reopened.finishDeletion(take.recordingId);
  reopened.finishDeletion(take.recordingId);
  expect(reopened.deleting(take.recordingId)).toBeNull();
  expect(reopened.deletionsPage()).toEqual({ recordings: [], nextAfterId: null });
  expect(reopened.get(sibling.recordingId)).toEqual(sibling);
});
