import { afterEach, expect, it } from "vitest";
import { fork, execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { createConnection } from "node:net";
import { RevisionStore } from "@screenrec/core/library";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const execute = promisify(execFile);

async function startFixture() {
  const directory = await mkdtemp("/tmp/scr-edit-");
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const database = directory + "/catalog.sqlite";
  const child = fork(
    new URL("../fixtures/edit-server.mjs", import.meta.url),
    [directory + "/run", database],
    { silent: true },
  );
  let diagnostics = "";
  child.stderr?.on("data", (chunk) => {
    diagnostics += chunk;
  });
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  cleanup.push(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.send("close");
    const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
    await exited;
    clearTimeout(timer);
  });
  const ready = await new Promise<{ socketPath: string; recordingId: string }>(
    (resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Fixture did not become ready: " + diagnostics)),
        3000,
      );
      child.once("message", (value) => {
        clearTimeout(timer);
        resolve(value as { socketPath: string; recordingId: string });
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Fixture exited ${code}: ${diagnostics}`));
      });
    },
  );
  const store = new RevisionStore(database, { now: () => "test", newId: () => "unused" });
  cleanup.push(async () => store.close());
  return { ...ready, store };
}

it("persists a cut through subprocess client/server, replays its ID, and rejects a new stale edit", async () => {
  const { socketPath, recordingId, store } = await startFixture();
  const request = {
    id: "cut-1",
    operation: "edit.cut",
    params: {
      recordingId,
      requestId: "cut-1",
      expectedRevisionId: "r0",
      ranges: [{ startUs: 2_000_000, endUs: 3_000_000 }],
    },
  };
  const invoke = async (value: unknown) =>
    JSON.parse(
      (
        await execute(process.execPath, [
          new URL("../fixtures/call.mjs", import.meta.url).pathname,
          socketPath,
          JSON.stringify(value),
        ])
      ).stdout,
    );
  const first = await invoke(request);
  expect(first.ok).toBe(true);
  expect(first.data.spans).toEqual([
    { startUs: 0, endUs: 2_000_000 },
    { startUs: 3_000_000, endUs: 10_000_000 },
  ]);
  expect(store.revision(recordingId).spans).toEqual(first.data.spans);
  expect(await invoke(request)).toEqual(first);
  const stale = await invoke({
    ...request,
    id: "cut-2",
    params: { ...request.params, requestId: "cut-2" },
  });
  expect(stale).toMatchObject({
    id: "cut-2",
    ok: false,
    error: { code: "STALE_REVISION", details: { currentRevisionId: first.data.id } },
  });
  expect(store.history(recordingId).revisions).toHaveLength(2);
});

it("rejects an oversized valid cut frame before it reaches SQLite", async () => {
  const { socketPath, recordingId, store } = await startFixture();
  const oversized =
    JSON.stringify({
      id: "too-large",
      operation: "edit.cut",
      params: {
        recordingId,
        requestId: "too-large",
        expectedRevisionId: "r0",
        ranges: [{ startUs: 2_000_000, endUs: 3_000_000 }],
        padding: "x".repeat(1024 * 1024),
      },
    }) + "\n";
  await sendRaw(socketPath, oversized);
  expect(store.revision(recordingId)).toMatchObject({
    id: "r0",
    spans: [{ startUs: 0, endUs: 10_000_000 }],
  });
});

async function sendRaw(socketPath: string, payload: string | Buffer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = createConnection(socketPath, () => socket.write(payload));
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Connection was not closed"));
    }, 1000);
    socket.resume();
    socket.on("error", () => {});
    socket.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

it("rejects invalid UTF-8 before an otherwise valid cut reaches SQLite", async () => {
  const { socketPath, recordingId, store } = await startFixture();
  const payload = Buffer.from(
    JSON.stringify({
      id: "invalid-text",
      operation: "edit.cut",
      params: {
        recordingId,
        requestId: "invalid-text",
        expectedRevisionId: "r0",
        ranges: [{ startUs: 2_000_000, endUs: 3_000_000 }],
        padding: "x",
      },
    }) + "\n",
  );
  payload[payload.lastIndexOf("x")] = 0xff;
  await sendRaw(socketPath, payload);
  expect(store.revision(recordingId)).toMatchObject({
    id: "r0",
    spans: [{ startUs: 0, endUs: 10_000_000 }],
  });
});

it("a timed-out reply leaves the committed cut replayable with the same request ID", async () => {
  const { socketPath, recordingId, store } = await startFixture();
  const { callLocal } = await import("@screenrec/client");
  const request = {
    id: "lost-reply",
    operation: "edit.cut",
    params: {
      recordingId,
      requestId: "lost-reply",
      expectedRevisionId: "r0",
      ranges: [{ startUs: 2_000_000, endUs: 3_000_000 }],
      delayAfterCommitMs: 500,
    },
  };
  await expect(callLocal(socketPath, request, { timeoutMs: 250 })).rejects.toMatchObject({
    code: "TIMEOUT",
  });
  const committed = store.revision(recordingId);
  expect(committed.spans).toEqual([
    { startUs: 0, endUs: 2_000_000 },
    { startUs: 3_000_000, endUs: 10_000_000 },
  ]);
  expect(await callLocal(socketPath, request, { timeoutMs: 1500 })).toEqual({
    id: "lost-reply",
    ok: true,
    data: committed,
  });
  expect(store.history(recordingId).revisions).toHaveLength(2);
});
