import { connect } from "node:net";
import { homedir } from "node:os";
import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  CONTROL_FRAME_BYTES,
  MAX_PENDING_CONTROL_CALLS,
  JsonLineStream,
  encodeJsonLine,
  requestSchema,
  type ControlMessage,
  type ControlResponse,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";
import { listenLocal, type LocalListener } from "./index.js";

export function serviceHome(environment: NodeJS.ProcessEnv = process.env): string {
  const override = environment.SCREENREC_HOME;
  return override ? resolve(override) : join(homedir(), ".screen-recorder");
}

/**
 * The listener refuses an occupied path, so the app composition is what proves a
 * prior service dead. A refused connection means no listener is bound and the file
 * is a leftover; a successful connection means a live owner that must never be
 * unlinked or killed.
 */
export async function reclaimDeadSocket(socketPath: string): Promise<boolean> {
  const live = await new Promise<boolean>((settle) => {
    const probe = connect(socketPath);
    const finish = (value: boolean) => {
      clearTimeout(timer);
      probe.destroy();
      settle(value);
    };
    const timer = setTimeout(() => finish(true), 1_000);
    probe.on("connect", () => finish(true));
    probe.on("error", (error) =>
      finish(!["ECONNREFUSED", "ENOENT"].includes((error as NodeJS.ErrnoException).code ?? "")),
    );
  });
  if (live) return false;
  await unlink(socketPath).catch(() => {});
  return true;
}

export function healthData(started: number, socketPath: string, home: string): unknown {
  return {
    status: "ready",
    pid: process.pid,
    socketPath,
    home,
    node: process.versions.node,
    uptimeMs: Math.round(performance.now() - started),
  };
}

function failure(code: string, message: string): OperationResult {
  return { ok: false, error: { code, message, retryable: false, details: {} } };
}

function rejection(id: string | null, code: string, message: string): ControlResponse {
  return { id, ok: false, error: { code, message, retryable: false, details: {} } };
}

async function main(): Promise<void> {
  const home = serviceHome();
  const runtimeDirectory = join(home, "run");
  const started = performance.now();
  const emit = (message: ControlMessage) =>
    process.stdout.write(encodeJsonLine(message, CONTROL_FRAME_BYTES));
  const reply = (response: ControlResponse) => emit({ event: "result", response });

  let listener: LocalListener;
  try {
    await reclaimDeadSocket(join(runtimeDirectory, "service.sock"));
    listener = await listenLocal({
      runtimeDirectory,
      handler: (request) => operate(request),
    });
  } catch (error) {
    const occupied = (error as NodeJS.ErrnoException).code === "EADDRINUSE";
    emit({
      event: "failed",
      error: {
        code: occupied ? "SOCKET_IN_USE" : "SERVICE_UNAVAILABLE",
        message: occupied
          ? `Another live service already owns ${runtimeDirectory}/service.sock`
          : `Service could not open ${runtimeDirectory}: ${(error as Error).message}`,
        retryable: false,
        details: {},
      },
    });
    process.exitCode = 1;
    return;
  }

  const socketPath = listener.socketPath;
  function operate(request: OperationRequest): OperationResult {
    if (request.operation !== "service.health")
      return failure("UNKNOWN_OPERATION", `Unknown service operation: ${request.operation}`);
    return { ok: true, data: healthData(started, socketPath, home) };
  }

  const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
  let pending = 0;
  const dispatch = (value: unknown): void => {
    const parsed = requestSchema.safeParse(value);
    if (!parsed.success) {
      const id = (value as { id?: unknown })?.id;
      reply(
        rejection(
          typeof id === "string" && id.length > 0 ? id : null,
          "INVALID_REQUEST",
          "Expected id, operation, and object params.",
        ),
      );
      return;
    }
    if (pending >= MAX_PENDING_CONTROL_CALLS) {
      reply(
        rejection(
          parsed.data.id,
          "LIMIT_EXCEEDED",
          "Too many control requests are already in flight.",
        ),
      );
      return;
    }
    pending += 1;
    void Promise.resolve()
      .then(() => operate(parsed.data))
      .catch(() => failure("INTERNAL_ERROR", "Service handler failed"))
      .then((result) => {
        pending -= 1;
        reply({ id: parsed.data.id, ...result });
      });
  };

  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    process.stdin.pause();
    // libuv unlinks the path it bound; nothing here removes a socket it does not own.
    void listener.close();
  };
  process.stdin.on("data", (chunk: Buffer) => {
    for (const outcome of stream.push(chunk)) {
      if (outcome.ok) dispatch(outcome.value);
      else if (outcome.error.code === "FRAME_TOO_LARGE")
        reply(rejection(null, "LIMIT_EXCEEDED", "Control frame exceeds the byte limit."));
      else reply(rejection(null, "INVALID_REQUEST", "Expected id, operation, and object params."));
    }
  });
  process.stdin.on("end", stop);
  process.stdin.on("close", stop);
  process.stdin.on("error", stop);
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(signal, stop);

  emit({ event: "started", pid: process.pid, socketPath });
}

await main();
