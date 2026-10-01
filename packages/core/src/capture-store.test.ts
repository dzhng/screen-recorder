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

test("camera allocation is durable and cannot change on a replay", () => {
  const { store, path, providers } = fixture();
  const request = {
    requestId: "selected-camera",
    arguments: JSON.stringify(["screen", "camera-a"]),
    cameraDeviceId: "camera-a",
  };
  const allocated = store.allocate(request).recording;
  expect(allocated.camera).toEqual({ sourceId: "take-3", deviceId: "camera-a" });
  expect(allocated.camera?.sourceId).not.toBe(allocated.sourceId);
  store.close();
  const reopened = new CaptureStore(path, providers);
  stores.push(reopened);
  expect(reopened.allocate(request)).toEqual({ recording: allocated, replay: true });
  expect(() => reopened.allocate({ ...request, cameraDeviceId: "camera-b" })).toThrowError(
    expect.objectContaining({ code: "REQUEST_CONFLICT" }),
  );
  expect(reopened.get(allocated.recordingId)).toEqual(allocated);
  expect(reopened.allocate().recording.camera).toBeNull();
});

test("physical closure makes a published camera eligible while primary publication is pending", () => {
  const { store, path, providers } = fixture();
  const recording = store.allocate({
    requestId: "independent-camera",
    arguments: "camera-a",
    cameraDeviceId: "camera-a",
  }).recording;
  const { recordingId, sourceId, camera } = recording;
  if (!camera) throw new Error("Missing camera allocation");
  const identity = { bytes: 10, sha256: "a".repeat(64) };
  const receipt = {
    kind: "camera",
    sourceId: camera.sourceId,
    sourceDurationUs: 100,
    originHostUs: 200,
    binding: { recordingId, sourceId: camera.sourceId, deviceId: camera.deviceId },
    journal: { file: "capture.journal.jsonl", ...identity, lastSequence: 3, layout: 1 },
    members: Object.fromEntries(
      ["video.mov", "camera.publication.json", "camera.mapping.jsonl"].map((name) => [
        name,
        { ...identity, bytes: "10" },
      ]),
    ),
  };
  const publication = {
    generation: "native-generation",
    sourceId,
    inputsClosed: false,
    primary: null,
    camera: null,
  };
  store.ingestLifecycle(recordingId, { sourceId, sequence: 1, state: "recording", publication });
  expect(store.isCapturing()).toBe(true);
  expect(() => store.publishedSource(recordingId, camera.sourceId)).toThrowError(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  const closed = {
    ...publication,
    inputsClosed: true,
    primary: {
      state: "pending",
      error: { code: "IO_ERROR", message: "Primary output held", retryable: true },
    },
    camera: { state: "published", source: receipt },
  };
  const finalizing = store.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 2,
    state: "finalizing",
    publication: closed,
  });
  expect(finalizing.state).toBe("finalizing");
  expect(finalizing.sourceDurationUs).toBeNull();
  expect(store.isCapturing()).toBe(false);
  expect(store.publishedSource(recordingId, camera.sourceId)).toEqual(receipt);
  expect(() => store.publishedSource(recordingId, sourceId)).toThrowError(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  store.close();
  const reopened = new CaptureStore(path, providers);
  stores.push(reopened);
  expect(reopened.publishedSource(recordingId, camera.sourceId)).toEqual(receipt);
  expect(reopened.get(recordingId).publication).toEqual(closed);
  expect(reopened.isCapturing()).toBe(false);
  const retrying = {
    ...closed,
    primary: { state: "unavailable", error: { code: "NO_VIDEO", message: "Primary has no video" } },
    camera: {
      state: "pending",
      error: { code: "IO_ERROR", message: "Camera cannot be reread", retryable: true },
    },
  };
  reopened.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 3,
    state: "finalizing",
    publication: retrying,
  });
  expect(() => reopened.publishedSource(recordingId, camera.sourceId)).toThrowError(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  expect(() =>
    reopened.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 4,
      state: "finalizing",
      publication: {
        ...retrying,
        camera: { state: "published", source: { ...receipt, originHostUs: 201 } },
      },
    }),
  ).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
  expect(reopened.get(recordingId).publication).toEqual(retrying);
  reopened.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 4,
    state: "finalizing",
    publication: { ...retrying, camera: closed.camera },
  });
  expect(reopened.publishedSource(recordingId, camera.sourceId)).toEqual(receipt);
  const changed = {
    ...retrying,
    camera: {
      state: "unavailable",
      error: {
        code: "INVALID_JOURNAL_PREFIX",
        message: "Camera authority changed",
      },
    },
  };
  reopened.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 5,
    state: "finalizing",
    publication: changed,
  });
  expect(reopened.get(recordingId).publication).toEqual(changed);
  expect(() => reopened.publishedSource(recordingId, camera.sourceId)).toThrowError(
    expect.objectContaining({ code: "UNAVAILABLE" }),
  );
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
