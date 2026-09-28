import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import {
  MEDIA_WORKER_TIMEOUT_MS,
  REQUEST_FRAME_BYTES,
  RESPONSE_FRAME_BYTES,
  JsonLineReader,
  encodeJsonLine,
  operationError,
  resultSchema,
  type OperationResult,
} from "@screenrec/protocol";
import { CatalogError } from "@screenrec/core/catalog";
import type { TimeRange } from "@screenrec/core/timeline";

/**
 * Where the packaged app's native worker executable is. The app is the one owner of that path:
 * it launches this service from inside its own bundle and names the sibling executable here, so
 * the service never guesses a bundle layout. A test that runs the service without an app sets it
 * explicitly, and an unset variable is reported rather than searched around.
 */
const NATIVE_EXECUTABLE_VARIABLE = "SCREENREC_NATIVE";
export const MAX_MEDIA_TIMEOUT_MS = 2_147_483_647;

/** Budget selected output, including silence, without charging for discarded source prefixes. */
export function renderWindowDeadlineMs(range: TimeRange): number {
  return Math.min(
    MAX_MEDIA_TIMEOUT_MS,
    30_000 + 2 * Math.ceil((range.endUs - range.startUs) / 1000),
  );
}

/** Ten minutes covers a cold model load and verifying its files; inference gets twice the narration
 * the request plans to read. */
export function transcriptionDeadlineMs(available: readonly TimeRange[]): number {
  const narrationUs = available.reduce((total, range) => total + range.endUs - range.startUs, 0);
  return Math.min(MAX_MEDIA_TIMEOUT_MS, 600_000 + Math.ceil((2 * narrationUs) / 1000));
}

export type MediaWorker = (
  operation: string,
  params: Record<string, unknown>,
  options?: { signal?: AbortSignal; timeoutMs?: number; descriptors?: readonly number[] },
) => Promise<OperationResult>;

/** A refused native call surfaces native's own code, details and retryability. */
export function nativeResult(result: OperationResult): unknown {
  if (!result.ok)
    throw new CatalogError(
      result.error.code,
      result.error.message,
      result.error.details,
      result.error.retryable,
    );
  return result.data;
}

/** Native answers `{ [field]: true }` only after it has finished; any other success is not proof. */
export function nativeConfirmed(
  result: OperationResult,
  field: "removed" | "empty",
  message: string,
): void {
  const data = nativeResult(result);
  if (
    !data ||
    typeof data !== "object" ||
    !(field in data) ||
    (data as Record<string, unknown>)[field] !== true
  )
    throw new CatalogError("INVALID_NATIVE_RESPONSE", message);
}

/**
 * Runs one bounded native worker process per call: one JSON line in, one JSON line out, then the
 * child is gone. Arguments never reach a shell, and no call waits without a deadline. This is the
 * service's only way to execute native media work, so later media operations reuse it rather than
 * growing a second child-process owner or a resident daemon.
 */
export function mediaWorker(
  environment: NodeJS.ProcessEnv = process.env,
  timeoutMs: number = MEDIA_WORKER_TIMEOUT_MS,
): MediaWorker {
  return (
    operation,
    params,
    { signal, timeoutMs: callTimeoutMs = timeoutMs, descriptors = [] } = {},
  ) =>
    new Promise<OperationResult>((settle) => {
      const canceled = () => operationError("CANCELED", `${operation} was canceled`);
      if (signal?.aborted) {
        settle(canceled());
        return;
      }
      if (
        !Number.isFinite(callTimeoutMs) ||
        callTimeoutMs <= 0 ||
        callTimeoutMs > MAX_MEDIA_TIMEOUT_MS
      ) {
        settle(
          operationError("INVALID_REQUEST", "Native deadline must be positive and fit a timer"),
        );
        return;
      }
      const executable = environment[NATIVE_EXECUTABLE_VARIABLE];
      if (!executable || !isAbsolute(executable)) {
        settle(
          operationError(
            "MEDIA_WORKER_UNAVAILABLE",
            `${NATIVE_EXECUTABLE_VARIABLE} must name the packaged native worker executable`,
          ),
        );
        return;
      }
      let frame: Buffer;
      try {
        frame = encodeJsonLine(
          { id: `worker-${operation}`, operation, params },
          REQUEST_FRAME_BYTES,
        );
      } catch {
        settle(
          operationError("INVALID_REQUEST", `Cannot encode ${operation} for the native worker`),
        );
        return;
      }
      if (descriptors.some((fd) => !Number.isSafeInteger(fd) || fd < 0)) {
        settle(
          operationError("INVALID_REQUEST", "Inherited descriptors must be open file descriptors"),
        );
        return;
      }
      const child = spawn(executable, [], {
        cwd: "/",
        stdio: ["pipe", "pipe", "ignore", ...descriptors] as [
          "pipe",
          "pipe",
          "ignore",
          ...number[],
        ],
      });
      const reader = new JsonLineReader(RESPONSE_FRAME_BYTES);
      let result: OperationResult | undefined;
      const finish = (value: OperationResult) => {
        if (result !== undefined) return;
        result = value;
        clearTimeout(deadline);
        signal?.removeEventListener("abort", abort);
        child.kill("SIGKILL");
      };
      const abort = () => finish(canceled());
      const deadline = setTimeout(
        () =>
          finish(
            operationError("MEDIA_WORKER_TIMEOUT", `${operation} did not answer in time`, true),
          ),
        callTimeoutMs,
      );
      child.on("error", (error) =>
        finish(
          operationError("MEDIA_WORKER_UNAVAILABLE", `Cannot run ${executable}: ${error.message}`),
        ),
      );
      // `close` rather than `exit`: a child can exit with its answer still buffered in this
      // process's pipe, and that answer must not be thrown away as a failure.
      child.on("close", () => {
        clearTimeout(deadline);
        signal?.removeEventListener("abort", abort);
        // A scheduler may reuse capacity as soon as this promise settles. Keep the slot
        // until the child and its pipes are closed, even after a successful response.
        settle(
          result ?? operationError("MEDIA_WORKER_FAILED", `${operation} produced no result`, true),
        );
      });
      child.stdout!.on("data", (chunk: Buffer) => {
        let value: unknown;
        try {
          value = reader.push(chunk);
        } catch (error) {
          finish(operationError("MEDIA_WORKER_FAILED", (error as Error).message));
          return;
        }
        if (value === undefined) return;
        const parsed = resultSchema.safeParse(value);
        finish(
          parsed.success
            ? parsed.data
            : operationError("MEDIA_WORKER_FAILED", `${operation} returned an unreadable result`),
        );
      });
      child.stdin!.on("error", () => {});
      signal?.addEventListener("abort", abort, { once: true });
      child.stdin!.end(frame);
    });
}
