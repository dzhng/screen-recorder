import { afterEach, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
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
  exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
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
    request: (id, operation = "service.health") =>
      send(JSON.stringify({ id, operation, params: {} }) + "\n"),
    awaiting,
    closeInput: () => child.stdin.end(),
    exit,
  };
}

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp("/tmp/scr-lifetime-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  return home;
}

function results(messages: ControlMessage[]) {
  return messages.flatMap((message) => (message.event === "result" ? [message.response] : []));
}

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
    ids.map((id) => JSON.stringify({ id, operation: "service.health", params: {} })).join("\n") +
      "\n",
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
  service.send(JSON.stringify({ id: "wrong-shape", operation: "service.health" }) + "\n");
  service.send(`{"id":"huge","operation":"service.health","params":{"padding":"`);
  service.send("x".repeat(CONTROL_FRAME_BYTES) + `"}}\n`);
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
  service.request("capture-1", "capture.start");
  expect(results(await service.awaiting(2))).toMatchObject([
    { id: "capture-1", ok: false, error: { code: "UNKNOWN_OPERATION", retryable: false } },
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
