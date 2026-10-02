import { afterEach, expect, it } from "vitest";
import { closeSync, constants, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { callLocal } from "@screenrec/client";
import {
  CONTROL_FRAME_BYTES,
  MAX_PENDING_CONTROL_CALLS,
  JsonLineStream,
  controlMessageSchema,
  type ControlMessage,
} from "@screenrec/protocol";
import { listenLocal } from "./index.js";
import { claimStartup } from "./startup.js";

const entry = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

type Service = {
  pid: number;
  socketPath: string;
  send(payload: string | Buffer): void;
  request(id: string, operation?: string): void;
  awaiting(count: number): Promise<ControlMessage[]>;
  closeInput(): void;
  dropOutput(): void;
  exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  readonly diagnostics: string;
};

/** Starts the real packaged entrypoint as its own process, outside the repository. */
async function startService(home: string): Promise<Service> {
  const child = spawn(process.execPath, [entry], {
    cwd: "/",
    env: { ...process.env, SCREENREC_HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const messages: ControlMessage[] = [];
  const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
  let diagnostics = "";
  let announce = () => {};
  child.stderr.on("data", (chunk) => (diagnostics += chunk));
  child.stdout.on("data", (chunk: Buffer) => {
    for (const outcome of stream.push(chunk)) {
      if (!outcome.ok) throw outcome.error;
      messages.push(controlMessageSchema.parse(outcome.value));
    }
    announce();
  });
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exit;
  });
  const awaiting = (count: number) =>
    new Promise<ControlMessage[]>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(`Expected ${count} control messages, saw ${messages.length}: ${diagnostics}`),
          ),
        5_000,
      );
      announce = () => {
        if (messages.length < count) return;
        clearTimeout(timer);
        announce = () => {};
        resolve(messages);
      };
      announce();
    });
  const send = (payload: string | Buffer) => void child.stdin.write(payload);
  return {
    get pid() {
      return child.pid ?? -1;
    },
    get socketPath() {
      const started = messages.find((message) => message.event === "started");
      return started?.event === "started" ? started.socketPath : "";
    },
    send,
    request: (id, operation = "service.health") => send(controlLine({ id, operation, params: {} })),
    awaiting,
    closeInput: () => child.stdin.end(),
    dropOutput: () => child.stdout.destroy(),
    exit,
    get diagnostics() {
      return diagnostics;
    },
  };
}

/** One app-to-service control line: the app labels what it is sending on this channel. */
function controlLine(request: Record<string, unknown>): string {
  return JSON.stringify({ event: "request", request }) + "\n";
}

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp("/tmp/scr-lifetime-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  return home;
}

function results(messages: ControlMessage[]) {
  return messages.flatMap((message) => (message.event === "result" ? [message.response] : []));
}

it("validates project composition requests at the canonical wire boundary", async () => {
  const service = await startService(await temporaryHome());
  expect((await service.awaiting(1))[0]).toMatchObject({ event: "started" });
  const call = (operation: string, params: Record<string, unknown>) =>
    callLocal(service.socketPath, { id: operation, operation, params });
  const created = await call("project.create", {
    requestId: "caller",
    canvas: {
      width: 64,
      height: 32,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  if (!created.ok) throw new Error(JSON.stringify(created));
  const project = (created.data as { project: { projectId: string; currentRevisionId: string } })
    .project;
  const responses = {
    project: await call("revision.get", { projectId: project.projectId }),
    recording: await call("revision.get", { recordingId: "same-id" }),
    package: await call("preview.get", { packageHandle: "open" }),
    removed: await call("edit.cut", {
      recordingId: "same-id",
      requestId: "cut",
      expectedRevisionId: "r0",
      ranges: [{ startUs: 0, endUs: 1 }],
    }),
    deletion: await call("recording.delete", { recordingId: "same-id" }),
  };
  const output = process.env.SCREENREC_CONTRACT_OUTPUT;
  if (output)
    await writeFile(output, JSON.stringify({ pid: service.pid, project, responses }, null, 2));
  expect(responses.project).toMatchObject({
    ok: true,
    data: { projectId: project.projectId, revision: { id: project.currentRevisionId } },
  });
  expect(responses.recording).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  expect(responses.package).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
  expect(responses.removed).toMatchObject({ ok: false, error: { code: "UNKNOWN_OPERATION" } });
  expect(responses.deletion).toMatchObject({
    ok: true,
    data: { recordingId: "same-id", deleted: true },
  });
  service.closeInput();
  const exit = await service.exit;
  expect(exit).toEqual({ code: 0, signal: null });
  await expect(lstat(service.socketPath)).rejects.toMatchObject({ code: "ENOENT" });
  if (output)
    await writeFile(
      output + ".terminal.json",
      JSON.stringify({ pid: service.pid, exit, socket: "ENOENT" }, null, 2),
    );
});

it("starts the canonical fresh composition without interpreting retained recording history", async () => {
  const home = await temporaryHome();
  const legacyCatalog = join(home, "library.sqlite");
  const legacyMedia = join(home, "recordings", "retained.mov");
  const catalogBytes = Buffer.from("retained catalog: never open or migrate\n");
  const mediaBytes = Buffer.from("retained original media\n");
  await mkdir(join(home, "recordings"));
  await writeFile(legacyCatalog, catalogBytes);
  await writeFile(legacyMedia, mediaBytes);
  const service = await startService(home);
  const first = (await service.awaiting(1))[0];
  const output = process.env.SCREENREC_SERVICE_ENTRY_OUTPUT;
  if (output) await mkdir(output);
  const record = async (name: string, value: unknown) => {
    if (output) await writeFile(join(output, name + ".json"), JSON.stringify(value, null, 2));
  };
  await record("before", {
    pid: service.pid,
    first,
    diagnostics: service.diagnostics,
    catalog: (await readFile(legacyCatalog)).toString(),
    media: (await readFile(legacyMedia)).toString(),
  });
  expect(first).toMatchObject({ event: "started" });
  const call = (operation: string, params: Record<string, unknown> = {}) =>
    callLocal(service.socketPath, { id: operation, operation, params });
  expect(await call("project.list")).toMatchObject({
    ok: true,
    data: { projects: [], nextCursor: null },
  });
  expect(await call("recording.list")).toMatchObject({ ok: true, data: { recordings: [] } });
  const creation = await call("project.create", {
    requestId: "explicit-caller-project",
    title: "Caller fixture",
    canvas: {
      width: 64,
      height: 32,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  expect(creation).toMatchObject({ ok: true, data: { project: { title: "Caller fixture" } } });
  const pendingStatus = call("capture.status");
  const nativeCall = (await service.awaiting(2))[1];
  expect(nativeCall).toMatchObject({ event: "call", request: { operation: "capture.status" } });
  const device = {
    state: "idle",
    recordingId: null,
    sourceId: null,
    elapsedUs: null,
    selection: null,
    permissions: { screen: true, microphone: "authorized", camera: "not_determined" },
  };
  if (nativeCall?.event !== "call") throw new Error("Missing capture status peer request");
  service.send(
    JSON.stringify({
      event: "result",
      response: { id: nativeCall.request.id, ok: true, data: device },
    }) + "\n",
  );
  const status = await pendingStatus;
  expect(status).toMatchObject({ ok: true, data: { device, recording: null } });
  const listed = await call("project.list");
  expect(listed).toMatchObject({
    ok: true,
    data: { projects: [{ title: "Caller fixture" }], nextCursor: null },
  });
  await record("after", { creation, status, listed });
  expect(await readFile(legacyCatalog)).toEqual(catalogBytes);
  expect(await readFile(legacyMedia)).toEqual(mediaBytes);
  expect((await stat(join(home, "library/catalog.sqlite"))).isFile()).toBe(true);
  service.closeInput();
  const exit = await service.exit;
  const socket = await stat(service.socketPath).then(
    () => "present",
    (error: NodeJS.ErrnoException) => error.code,
  );
  await record("terminal", { pid: service.pid, exit, socket });
  expect(exit).toEqual({ code: 0, signal: null });
  expect(socket).toBe("ENOENT");
});

it("announces its listener and answers health over both the pipe and the socket", async () => {
  const home = await temporaryHome();
  const service = await startService(home);
  const [started] = await service.awaiting(1);
  expect(started).toEqual({
    event: "started",
    pid: service.pid,
    socketPath: join(home, "run/service.sock"),
  });
  expect((await stat(service.socketPath)).mode & 0o777).toBe(0o600);

  service.request("pipe-1");
  const [, piped] = await service.awaiting(2);
  const socketed = await callLocal(service.socketPath, {
    id: "socket-1",
    operation: "service.health",
    params: {},
  });
  expect(piped).toEqual({
    event: "result",
    response: { id: "pipe-1", ok: true, data: expect.objectContaining({ status: "ready" }) },
  });
  expect(socketed).toMatchObject({ id: "socket-1", ok: true });
  // Both legs describe the same live process; neither invents capture state.
  expect(socketed.ok && socketed.data).toEqual({
    status: "ready",
    pid: service.pid,
    socketPath: service.socketPath,
    home,
    node: process.versions.node,
    uptimeMs: expect.any(Number),
  });
});

it("correlates a burst of control requests and rejects the ones past the in-flight bound", async () => {
  const service = await startService(await temporaryHome());
  await service.awaiting(1);
  const ids = Array.from({ length: MAX_PENDING_CONTROL_CALLS + 3 }, (_, index) => `burst-${index}`);
  service.send(
    ids.map((id) => controlLine({ id, operation: "service.health", params: {} })).join(""),
  );
  const answered = new Map(results(await service.awaiting(1 + ids.length)).map((r) => [r.id, r]));
  expect([...answered.keys()]).toHaveLength(ids.length);
  expect(ids.filter((id) => answered.get(id)?.ok)).toHaveLength(MAX_PENDING_CONTROL_CALLS);
  for (const id of ids.slice(MAX_PENDING_CONTROL_CALLS))
    expect(answered.get(id)).toMatchObject({ ok: false, error: { code: "LIMIT_EXCEEDED" } });
});

it("answers unreadable and oversized control data without losing the next request", async () => {
  const service = await startService(await temporaryHome());
  await service.awaiting(1);
  service.send("{\n");
  service.send(controlLine({ id: "wrong-shape", operation: "service.health" }));
  service.send(
    `{"event":"request","request":{"id":"huge","operation":"service.health","params":{"padding":"`,
  );
  service.send("x".repeat(CONTROL_FRAME_BYTES) + `"}}}\n`);
  service.request("survivor");
  const answered = results(await service.awaiting(5));
  expect(answered.filter((response) => response.id === null)).toMatchObject([
    { ok: false, error: { code: "INVALID_REQUEST" } },
    { ok: false, error: { code: "LIMIT_EXCEEDED" } },
  ]);
  expect(answered.find((response) => response.id === "wrong-shape")).toMatchObject({
    ok: false,
    error: { code: "INVALID_REQUEST" },
  });
  expect(answered.find((response) => response.id === "survivor")).toMatchObject({ ok: true });
});

it("reports an unknown operation instead of pretending to own it", async () => {
  const service = await startService(await temporaryHome());
  await service.awaiting(1);
  service.request("unknown-1", "library.invent");
  expect(results(await service.awaiting(2))).toMatchObject([
    { id: "unknown-1", ok: false, error: { code: "UNKNOWN_OPERATION", retryable: false } },
  ]);
});

it("closes its listener and removes its own socket when the control pipe reaches EOF", async () => {
  const home = await temporaryHome();
  const service = await startService(home);
  await service.awaiting(1);
  const socketPath = service.socketPath;
  service.closeInput();
  expect(await service.exit).toEqual({ code: 0, signal: null });
  await expect(stat(socketPath)).rejects.toMatchObject({ code: "ENOENT" });
});

it("finishes every owner's shutdown when one of them fails to close", async () => {
  const home = await temporaryHome();
  const service = await startService(home);
  await service.awaiting(1);
  const socketPath = service.socketPath;
  // Another writer holds the catalog, so the job queue cannot record its interrupted attempts.
  const writer = new DatabaseSync(join(home, "library/catalog.sqlite"));
  cleanup.push(async () => writer.close());
  // Startup announces availability before background recovery finishes its short transactions.
  writer.exec("PRAGMA busy_timeout=1000");
  writer.exec("BEGIN IMMEDIATE");
  service.closeInput();
  expect(await service.exit).toEqual({ code: 0, signal: null });
  expect(service.diagnostics).toMatch(/Catalog is locked/);
  await expect(stat(socketPath)).rejects.toMatchObject({ code: "ENOENT" });
  writer.exec("ROLLBACK");
});

it("refuses a live socket owned by another service and leaves it serving", async () => {
  const home = await temporaryHome();
  const owner = await listenLocal({
    runtimeDirectory: join(home, "run"),
    handler: () => ({ ok: true, data: "owner" }),
  });
  cleanup.push(owner.close);
  const before = await stat(owner.socketPath);
  const intruder = await startService(home);
  const [failed] = await intruder.awaiting(1);
  expect(failed).toMatchObject({ event: "failed", error: { code: "SOCKET_IN_USE" } });
  expect(await intruder.exit).toMatchObject({ code: 1 });
  expect((await stat(owner.socketPath)).ino).toBe(before.ino);
  expect(
    await callLocal(owner.socketPath, { id: "still-here", operation: "test", params: {} }),
  ).toEqual({ id: "still-here", ok: true, data: "owner" });
});

it("reclaims a socket path whose owner was killed without closing it", async () => {
  const home = await temporaryHome();
  const killed = await startService(home);
  await killed.awaiting(1);
  const stale = killed.socketPath;
  process.kill(killed.pid, "SIGKILL");
  await killed.exit;
  // A killed listener cannot unlink its path, so the leftover would otherwise block
  // every later launch; a refused connection is what proves nobody still owns it.
  expect((await stat(stale)).isSocket()).toBe(true);
  const service = await startService(home);
  expect((await service.awaiting(1))[0]).toMatchObject({ event: "started", socketPath: stale });
  expect(
    await callLocal(stale, { id: "reclaimed", operation: "service.health", params: {} }),
  ).toMatchObject({ id: "reclaimed", ok: true });
});

it("refuses a starter while another is still between probing and binding", async () => {
  const home = await temporaryHome();
  const claim = await claimStartup(join(home, "run"));
  cleanup.push(async () => claim.release());
  // Nothing is bound yet. This is exactly the window a check-then-unlink starter left
  // open: it saw no socket, and so did everyone else who then bound over it.
  await expect(stat(join(home, "run/service.sock"))).rejects.toMatchObject({ code: "ENOENT" });
  const contender = await startService(home);
  expect((await contender.awaiting(1))[0]).toMatchObject({
    event: "failed",
    error: { code: "SOCKET_IN_USE" },
  });
  expect(await contender.exit).toMatchObject({ code: 1 });
  // Releasing the claim the way an abrupt death releases it lets the next starter in.
  claim.release();
  const next = await startService(home);
  expect((await next.awaiting(1))[0]).toMatchObject({ event: "started" });
});

it("gives one live owner to a burst of simultaneous cold starts", async () => {
  const home = await temporaryHome();
  // Every starter races through the reclaim path, not just the bind: a killed owner
  // leaves the socket that each of them has to prove dead before removing it.
  const killed = await startService(home);
  await killed.awaiting(1);
  process.kill(killed.pid, "SIGKILL");
  await killed.exit;
  expect((await stat(join(home, "run/service.sock"))).isSocket()).toBe(true);
  const starters = await Promise.all(Array.from({ length: 12 }, () => startService(home)));
  const announced = await Promise.all(starters.map((starter) => starter.awaiting(1)));
  const owners = announced.flat().filter((message) => message.event === "started");
  const refused = announced.flat().filter((message) => message.event === "failed");
  // Proving a previous owner gone is not the same as becoming the next one. Without
  // mutual exclusion every starter that saw a refused connection went on to unlink and
  // bind, and several announced themselves as the owner of one path.
  expect(owners).toHaveLength(1);
  expect(refused.map((message) => message.event === "failed" && message.error.code)).toEqual(
    Array.from({ length: 11 }, () => "SOCKET_IN_USE"),
  );
  const owner = owners[0];
  expect(owner?.event === "started" && owner.socketPath).toBe(join(home, "run/service.sock"));
  expect(
    await callLocal(join(home, "run/service.sock"), {
      id: "sole-owner",
      operation: "service.health",
      params: {},
    }),
  ).toMatchObject({ ok: true, data: { pid: owner?.event === "started" && owner.pid } });
});

it.each([
  ["a regular file", async (path: string) => writeFile(path, "not a socket", { mode: 0o600 })],
  ["a symlink", async (path: string) => symlink("/etc/passwd", path)],
])("refuses a socket path occupied by %s", async (_kind, occupy) => {
  const home = await temporaryHome();
  const runtimeDirectory = join(home, "run");
  await mkdir(runtimeDirectory, { recursive: true, mode: 0o700 });
  const occupied = join(runtimeDirectory, "service.sock");
  await occupy(occupied);
  const before = await lstat(occupied);
  const service = await startService(home);
  const [failed] = await service.awaiting(1);
  expect(failed).toMatchObject({
    event: "failed",
    error: { code: "SERVICE_UNAVAILABLE", message: expect.stringContaining("is not a socket") },
  });
  expect(await service.exit).toMatchObject({ code: 1 });
  // Startup never removes a path this lifecycle did not create and cannot identify.
  expect((await lstat(occupied)).ino).toBe(before.ino);
});

it("refuses health parameters it does not take", async () => {
  const service = await startService(await temporaryHome());
  await service.awaiting(1);
  service.send(
    controlLine({ id: "extra", operation: "service.health", params: { verbose: true } }),
  );
  service.request("plain");
  const answered = results(await service.awaiting(3));
  expect(answered.find((response) => response.id === "extra")).toMatchObject({
    ok: false,
    error: { code: "INVALID_PARAMS", retryable: false },
  });
  expect(answered.find((response) => response.id === "plain")).toMatchObject({ ok: true });
});

it("bounds a reply that cannot fit the control frame instead of dying on it", async () => {
  const home = await temporaryHome();
  const service = await startService(home);
  await service.awaiting(1);
  // An accepted request can name an operation long enough that quoting it back does not
  // fit the same frame. That must stay a correlated answer, not an unhandled failure
  // that skips listener cleanup and abandons the socket.
  const operation = "x".repeat(CONTROL_FRAME_BYTES - 200);
  service.send(controlLine({ id: "unquotable", operation, params: {} }));
  service.request("after-the-limit");
  const answered = results(await service.awaiting(3));
  expect(answered.find((response) => response.id === "unquotable")).toMatchObject({
    ok: false,
    error: { code: "UNKNOWN_OPERATION" },
  });
  expect(answered.find((response) => response.id === "after-the-limit")).toMatchObject({
    ok: true,
  });
  expect((await stat(service.socketPath)).isSocket()).toBe(true);
});

it("closes its listener when control output breaks before the pipe reaches EOF", async () => {
  const home = await temporaryHome();
  const service = await startService(home);
  await service.awaiting(1);
  const socketPath = service.socketPath;
  service.dropOutput();
  for (let index = 0; index < 200; index += 1) service.request(`unread-${index}`);
  expect(await service.exit).toEqual({ code: 0, signal: null });
  await expect(stat(socketPath)).rejects.toMatchObject({ code: "ENOENT" });
});

it("reports an orphan-held render workspace as retryable before announcing readiness", async () => {
  const home = await temporaryHome();
  const directory = join(home, "library", "render");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const sentinel = join(directory, "abandoned");
  await writeFile(sentinel, "still owned");
  const descriptor = openSync(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK | 0x20,
  ); // Darwin O_EXLOCK, held by a different process than service.
  cleanup.push(async () => closeSync(descriptor));
  const service = await startService(home);
  const [message] = await service.awaiting(1);
  expect(message).toEqual({
    event: "failed",
    error: {
      code: "RENDER_WORKSPACE_BUSY",
      message: "Another render still owns this workspace",
      retryable: true,
      details: {},
    },
  });
  expect(await service.exit).toEqual({ code: 1, signal: null });
  expect(await readFile(sentinel, "utf8")).toBe("still owned");
  await expect(stat(join(home, "run", "service.sock"))).rejects.toMatchObject({ code: "ENOENT" });
});
