import { Socket } from "node:net";
import {
  REQUEST_FRAME_BYTES,
  RESPONSE_FRAME_BYTES,
  JsonLineReader,
  encodeJsonLine,
  operationDeadlineMs,
  parseRequest,
  responseSchema,
  type OperationRequest,
  type OperationResponse,
} from "@screenrec/protocol";

export class LocalTransportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function callLocal(
  socketPath: string,
  request: OperationRequest,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<OperationResponse> {
  const sent = parseRequest(request);
  const frame = encodeJsonLine(sent, REQUEST_FRAME_BYTES);
  const signal = options.signal;
  const timeoutMs = options.timeoutMs ?? operationDeadlineMs(sent.operation);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)
    throw new RangeError("Timeout must be a positive supported timer interval");
  if (signal?.aborted) throw new LocalTransportError("ABORTED", "Call canceled before connection");
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const reader = new JsonLineReader(RESPONSE_FRAME_BYTES);
    let finished = false;
    const finish = (complete: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      socket.destroy();
      complete();
    };
    const fail = (error: unknown) => finish(() => reject(error));
    const abort = () =>
      fail(
        new LocalTransportError("ABORTED", "Call canceled; committed changes are not rolled back"),
      );
    const timer = setTimeout(
      () =>
        fail(
          new LocalTransportError(
            "TIMEOUT",
            "Service call timed out; committed changes are not rolled back",
          ),
        ),
      timeoutMs,
    );
    signal?.addEventListener("abort", abort, { once: true });
    socket.on("data", (chunk) => {
      try {
        const value = reader.push(chunk);
        if (value === undefined) return;
        const parsed = responseSchema.safeParse(value);
        if (!parsed.success)
          throw new LocalTransportError(
            "INVALID_RESPONSE",
            "Service returned an invalid result envelope",
          );
        if (parsed.data.id !== sent.id)
          throw new LocalTransportError(
            "UNCORRELATED_RESPONSE",
            "Response ID does not match request",
          );
        finish(() => resolve(parsed.data));
      } catch (error) {
        fail(error);
      }
    });
    socket.on("end", () => {
      if (!finished) {
        try {
          reader.finish();
        } catch (error) {
          fail(error);
        }
      }
    });
    socket.on("error", (error) => fail(new LocalTransportError("CONNECTION_ERROR", error.message)));
    socket.on("close", () => {
      if (!finished)
        fail(new LocalTransportError("CONNECTION_CLOSED", "Connection closed without a result"));
    });
    try {
      socket.connect(socketPath, () => socket.write(frame));
    } catch (error) {
      fail(error);
    }
  });
}
