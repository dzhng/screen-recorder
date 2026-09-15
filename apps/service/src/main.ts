import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  CONTROL_FRAME_BYTES,
  MAX_PENDING_CONTROL_CALLS,
  FrameError,
  JsonLineStream,
  encodeJsonLine,
  requestSchema,
  type ControlMessage,
  type ControlResponse,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";
import { listenLocal, type LocalListener } from "./index.js";
import { StartupFailure, claimStartup, type StartupClaim } from "./startup.js";

/** How much of an unknown operation name an error message may quote back. */
const ECHOED_OPERATION_CHARS = 120;

export function serviceHome(environment: NodeJS.ProcessEnv = process.env): string {
  const override = environment.SCREENREC_HOME;
  return override ? resolve(override) : join(homedir(), ".screen-recorder");
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

/** Health is a no-argument operation, so nonempty params describe a caller mistake. */
function operate(request: OperationRequest, health: () => unknown): OperationResult {
  if (request.operation !== "service.health")
    return failure(
      "UNKNOWN_OPERATION",
      `Unknown service operation: ${request.operation.slice(0, ECHOED_OPERATION_CHARS)}`,
    );
  if (Object.keys(request.params).length > 0)
    return failure("INVALID_PARAMS", "service.health accepts no params");
  return { ok: true, data: health() };
}

async function main(): Promise<void> {
  const home = serviceHome();
  const runtimeDirectory = join(home, "run");
  const started = performance.now();

  // A frame this process cannot encode, and a peer that stopped reading, both have to
  // stay reportable: neither may become an uncaught failure that skips listener cleanup.
  const write = (message: ControlMessage): boolean => {
    let frame: Buffer;
    try {
      frame = encodeJsonLine(message, CONTROL_FRAME_BYTES);
    } catch (error) {
      if (error instanceof FrameError) return false;
      throw error;
    }
    try {
      process.stdout.write(frame);
    } catch {
      // The stream is already torn down, so there is nowhere to put this frame. Its
      // error event, or stdin reaching EOF, owns closing the listener.
    }
    return true;
  };
  const emit = (message: ControlMessage) => void write(message);
  const oversized = "Response exceeds the control byte limit.";
  const reply = (response: ControlResponse): void => {
    if (write({ event: "result", response })) return;
    const bounded = rejection(response.id, "LIMIT_EXCEEDED", oversized);
    if (write({ event: "result", response: bounded })) return;
    // Even the bounded form does not fit, so the correlation ID itself is the excess.
    emit({ event: "result", response: rejection(null, "LIMIT_EXCEEDED", oversized) });
  };

  let claim: StartupClaim;
  let listener: LocalListener;
  try {
    claim = await claimStartup(runtimeDirectory);
    listener = await listenLocal({
      runtimeDirectory,
      handler: (request) => answer(request),
    });
  } catch (error) {
    const startup = error instanceof StartupFailure;
    const occupied = startup
      ? error.code === "SOCKET_IN_USE"
      : (error as NodeJS.ErrnoException).code === "EADDRINUSE";
    emit({
      event: "failed",
      error: {
        code: occupied ? "SOCKET_IN_USE" : "SERVICE_UNAVAILABLE",
        message: startup
          ? error.message
          : `Service could not open ${runtimeDirectory}: ${(error as Error).message}`,
        retryable: false,
        details: {},
      },
    });
    process.exitCode = 1;
    return;
  }

  const socketPath = listener.socketPath;
  function answer(request: OperationRequest): OperationResult {
    return operate(request, () => healthData(started, socketPath, home));
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
      .then(() => answer(parsed.data))
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
    // The startup lock outlives the listener so no other starter can claim the
    // directory until this process is actually gone.
    void listener.close().finally(() => claim.release());
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
  // A dead reader breaks control output before EOF reaches stdin. Closing the listener
  // here is what keeps the promised parent-death cleanup from being skipped.
  process.stdout.on("error", stop);
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(signal, stop);

  emit({ event: "started", pid: process.pid, socketPath });
}

await main();
