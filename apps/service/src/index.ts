import { createServer, type Socket } from "node:net";
import { chmod, lstat, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEFAULT_CALL_TIMEOUT_MS,
  REQUEST_FRAME_BYTES,
  RESPONSE_FRAME_BYTES,
  FrameError,
  JsonLineReader,
  encodeJsonLine,
  operationError,
  parseRequest,
  resultSchema,
  serviceSocketPath,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";

export type LocalHandler = (
  request: OperationRequest,
  signal: AbortSignal,
) => OperationResult | Promise<OperationResult>;
export type LocalListener = { socketPath: string; close(): Promise<void> };

/**
 * Creates a missing runtime directory privately and refuses an existing one that is not
 * already the current user's own 0700 directory. Startup never repairs permissions on a
 * path it did not create, and never follows a symlink into one.
 */
export async function prepareRuntimeDirectory(runtimeDirectory: string): Promise<string> {
  const resolved = resolve(runtimeDirectory);
  await mkdir(resolved, { recursive: true, mode: 0o700 });
  const directory = await lstat(resolved);
  if (
    !directory.isDirectory() ||
    directory.uid !== process.getuid?.() ||
    (directory.mode & 0o777) !== 0o700
  )
    throw new Error("Runtime directory must be private (0700) and owned by this user");
  return resolved;
}

export async function listenLocal(options: {
  runtimeDirectory: string;
  handler: LocalHandler;
  readTimeoutMs?: number;
  maxConnections?: number;
  maxInFlight?: number;
}): Promise<LocalListener> {
  const maxConnections = options.maxConnections ?? 64;
  const maxInFlight = options.maxInFlight ?? 32;
  const readTimeoutMs = options.readTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
  const runtimeDirectory = await prepareRuntimeDirectory(options.runtimeDirectory);
  const socketPath = serviceSocketPath(runtimeDirectory);
  const sockets = new Set<Socket>();
  let accepting = false;
  let inFlight = 0;
  const server = createServer((socket) => {
    if (!accepting || sockets.size >= maxConnections) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    const reader = new JsonLineReader(REQUEST_FRAME_BYTES);
    const controller = new AbortController();
    const deadline = setTimeout(() => socket.destroy(), readTimeoutMs);
    socket.on("close", () => {
      clearTimeout(deadline);
      controller.abort();
      sockets.delete(socket);
    });
    socket.on("error", () => socket.destroy());
    socket.on("end", () => socket.destroy());
    socket.on("data", (chunk) => {
      let request: OperationRequest;
      try {
        const value = reader.push(chunk);
        if (value === undefined) return;
        request = parseRequest(value);
      } catch {
        socket.destroy();
        return;
      }
      clearTimeout(deadline);
      const reply = (result: OperationResult) => {
        if (socket.destroyed || controller.signal.aborted) return;
        let frame: Buffer;
        try {
          frame = encodeJsonLine(
            { id: request.id, ...resultSchema.parse(result) },
            RESPONSE_FRAME_BYTES,
          );
        } catch (error) {
          const oversized = error instanceof FrameError && error.code === "FRAME_TOO_LARGE";
          frame = encodeJsonLine(
            {
              id: request.id,
              ...(oversized
                ? operationError("LIMIT_EXCEEDED", "Response exceeds the transport byte limit")
                : operationError("INTERNAL_ERROR", "Handler returned an invalid result")),
            },
            RESPONSE_FRAME_BYTES,
          );
        }
        socket.setTimeout(readTimeoutMs, () => socket.destroy());
        socket.end(frame);
      };
      if (inFlight >= maxInFlight) {
        reply(
          operationError(
            "LIMIT_EXCEEDED",
            "Local service request capacity is full; retry after existing work finishes",
            true,
          ),
        );
        return;
      }
      inFlight += 1;
      void Promise.resolve()
        .then(() => options.handler(request, controller.signal))
        .finally(() => {
          // Disconnecting cancels interest, but a non-cooperative handler still owns work.
          // Keep its slot until it settles so reconnects cannot bypass the admission bound.
          inFlight -= 1;
        })
        .then(reply, () => reply(operationError("INTERNAL_ERROR", "Service handler failed")));
    });
  });
  let closePromise: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (!closePromise)
      closePromise = new Promise((resolve, reject) => {
        accepting = false;
        // libuv owns unlink. Recovery must never unlink a live listener's path.
        server.close((error) => (error ? reject(error) : resolve()));
        for (const socket of sockets) socket.destroy();
      });
    return closePromise;
  };
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  try {
    await chmod(socketPath, 0o600);
  } catch (error) {
    await close();
    throw error;
  }
  accepting = true;
  return { socketPath, close };
}
