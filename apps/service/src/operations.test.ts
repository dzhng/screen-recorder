import { afterEach, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "@screenrec/core/library";
import { callLocal } from "@screenrec/client";
import { CONTROL_FRAME_BYTES, JsonLineStream, controlMessageSchema } from "@screenrec/protocol";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function seed() {
  const home = await mkdtemp("/tmp/scr-operations-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const recording = store.allocate();
  store.registerSource(recording.recordingId, 10_000_000);
  const unfinished = store.allocate();
  store.close();
  return { home, recordingId: recording.recordingId, unfinishedId: unfinished.recordingId };
}

async function start(home: string) {
  const child = spawn(process.execPath, [new URL("../dist/main.js", import.meta.url).pathname], {
    cwd: "/",
    env: { ...process.env, SCREENREC_HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.stdin.end();
    const kill = setTimeout(() => child.kill("SIGKILL"), 2_000);
    await exit;
    clearTimeout(kill);
  };
  cleanup.push(close);
  let diagnostics = "";
  child.stderr.on("data", (bytes) => {
    diagnostics += bytes;
  });
  const socketPath = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Service not ready: ${diagnostics}`)), 3_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`Service exited: ${diagnostics}`));
    });
    const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
    child.stdout.on("data", (bytes: Buffer) => {
      for (const frame of stream.push(bytes)) {
        if (!frame.ok) {
          clearTimeout(timer);
          reject(frame.error);
          continue;
        }
        const message = controlMessageSchema.parse(frame.value);
        if (message.event === "started") {
          clearTimeout(timer);
          resolve(message.socketPath);
        }
        if (message.event === "failed") {
          clearTimeout(timer);
          reject(new Error(message.error.message));
        }
      }
    });
  });
  return {
    close,
    call: (operation: string, params: Record<string, unknown> = {}) =>
      callLocal(socketPath, { id: randomUUID(), operation, params }),
  };
}

it("serves the actual catalog and persists trim/cut/undo/restore with replay across relaunch", async () => {
  const { home, recordingId, unfinishedId } = await seed();
  let service = await start(home);
  expect(await service.call("recording.latest")).toMatchObject({
    ok: true,
    data: { recordingId: unfinishedId, currentRevisionId: null },
  });
  expect(await service.call("revision.get", { recordingId: unfinishedId })).toMatchObject({
    ok: false,
    error: { code: "NOT_READY" },
  });
  expect(await service.call("recording.get", { recordingId })).toMatchObject({
    ok: true,
    data: { recordingId, sourceDurationUs: 10_000_000 },
  });
  const cutRequest = {
    recordingId,
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 2_000_000, endUs: 3_000_000 }],
  };
  const cut = await service.call("edit.cut", cutRequest);
  expect(cut).toMatchObject({
    ok: true,
    data: {
      recordingId,
      revision: {
        parentId: "r0",
        durationUs: 9_000_000,
        spans: [
          { startUs: 0, endUs: 2_000_000 },
          { startUs: 3_000_000, endUs: 10_000_000 },
        ],
      },
    },
  });
  if (!cut.ok) throw new Error("Cut failed");
  const cutRevision = (cut.data as { revision: { id: string } }).revision;
  const trim = await service.call("edit.trim", {
    recordingId,
    requestId: "trim",
    expectedRevisionId: cutRevision.id,
    range: { startUs: 1_000_000, endUs: 8_000_000 },
  });
  expect(trim).toMatchObject({
    ok: true,
    data: {
      revision: {
        durationUs: 7_000_000,
        spans: [
          { startUs: 1_000_000, endUs: 2_000_000 },
          { startUs: 3_000_000, endUs: 9_000_000 },
        ],
      },
    },
  });
  if (!trim.ok) throw new Error("Trim failed");
  const trimId = (trim.data as { revision: { id: string } }).revision.id;
  const undo = await service.call("edit.undo", {
    recordingId,
    requestId: "undo",
    expectedRevisionId: trimId,
  });
  expect(undo).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 9_000_000, parentId: trimId } },
  });
  if (!undo.ok) throw new Error("Undo failed");
  const undoId = (undo.data as { revision: { id: string } }).revision.id;
  expect(undoId).not.toBe(cutRevision.id);
  const restore = await service.call("edit.restore", {
    recordingId,
    requestId: "restore",
    expectedRevisionId: undoId,
    targetRevisionId: "r0",
  });
  expect(restore).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 10_000_000, spans: [{ startUs: 0, endUs: 10_000_000 }] } },
  });
  expect(
    await service.call("edit.trim", {
      recordingId,
      requestId: "stale",
      expectedRevisionId: trimId,
      range: { startUs: 0, endUs: 1 },
    }),
  ).toMatchObject({ ok: false, error: { code: "STALE_REVISION" } });
  await service.close();
  service = await start(home);
  const replay = await service.call("edit.cut", cutRequest);
  expect(replay.ok && replay.data).toEqual(cut.data);
  expect(await service.call("revision.get", { recordingId })).toMatchObject({
    ok: true,
    data: restore.ok ? restore.data : {},
  });
  expect(await service.call("revision.get", { recordingId, revisionId: "r0" })).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 10_000_000, id: "r0" } },
  });
  expect(await service.call("revision.history", { recordingId, limit: 2 })).toMatchObject({
    ok: true,
    data: {
      recordingId,
      revisions: [{ id: "r0" }, { id: cutRevision.id }],
      nextCursor: { afterOrdinal: 1, throughOrdinal: 4 },
    },
  });
});

it("rejects malformed edits, preserves domain errors, and gives concurrent edits one winner", async () => {
  const { home, recordingId } = await seed();
  const { call } = await start(home);
  const request = {
    recordingId,
    requestId: "valid",
    expectedRevisionId: "r0",
    range: { startUs: 0, endUs: 2_000_000 },
  };
  expect(await call("edit.trim", { ...request, typo: true })).toMatchObject({
    ok: false,
    error: { code: "INVALID_PARAMS" },
  });
  expect(await call("edit.trim", { ...request, range: { startUs: 4, endUs: 2 } })).toMatchObject({
    ok: false,
    error: { code: "INVALID_RANGE" },
  });
  expect(await call("recording.get", { recordingId: "missing" })).toMatchObject({
    ok: false,
    error: { code: "NOT_FOUND" },
  });
  const responses = await Promise.all([
    call("edit.trim", request),
    call("edit.trim", { ...request, requestId: "competing" }),
  ]);
  expect(responses.filter((result) => result.ok)).toHaveLength(1);
  expect(responses.find((result) => !result.ok)).toMatchObject({
    error: { code: "STALE_REVISION" },
  });
  expect(await call("revision.get", { recordingId })).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 2_000_000, spans: [{ startUs: 0, endUs: 2_000_000 }] } },
  });
});
