import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import {
  REQUEST_FRAME_BYTES,
  RESPONSE_FRAME_BYTES,
  JsonLineReader,
  encodeJsonLine,
  resultSchema,
  type OperationResult,
} from "@screenrec/protocol";

/**
 * Where the packaged app's native worker executable is. The app is the one owner of that path:
 * it launches this service from inside its own bundle and names the sibling executable here, so
 * the service never guesses a bundle layout. A test that runs the service without an app sets it
 * explicitly, and an unset variable is reported rather than searched around.
 */
export const NATIVE_EXECUTABLE_VARIABLE = "SCREENREC_NATIVE";
const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_MEDIA_TIMEOUT_MS = 2_147_483_647;

export type MediaWorker = (
  operation: string,
  params: Record<string, unknown>,
  options?: { signal?: AbortSignal; timeoutMs?: number },
) => Promise<OperationResult>;

function failure(code: string, message: string, retryable = false): OperationResult {
  return { ok: false, error: { code, message, retryable, details: {} } };
}

/**
 * Runs one bounded native worker process per call: one JSON line in, one JSON line out, then the
 * child is gone. Arguments never reach a shell, and no call waits without a deadline. This is the
 * service's only way to execute native media work, so later media operations reuse it rather than
 * growing a second child-process owner or a resident daemon.
 */
export function mediaWorker(
  environment: NodeJS.ProcessEnv = process.env,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): MediaWorker {
  return (operation, params, { signal, timeoutMs: callTimeoutMs = timeoutMs } = {}) =>
    new Promise<OperationResult>((settle) => {
      const canceled = () => failure("CANCELED", `${operation} was canceled`);
      if (signal?.aborted) {
        settle(canceled());
        return;
      }
      if (
        !Number.isFinite(callTimeoutMs) ||
        callTimeoutMs <= 0 ||
        callTimeoutMs > MAX_MEDIA_TIMEOUT_MS
      ) {
        settle(failure("INVALID_REQUEST", "Native deadline must be positive and fit a timer"));
        return;
      }
      const executable = environment[NATIVE_EXECUTABLE_VARIABLE];
      if (!executable || !isAbsolute(executable)) {
        settle(
          failure(
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
        settle(failure("INVALID_REQUEST", `Cannot encode ${operation} for the native worker`));
        return;
      }
      const child = spawn(executable, [], { cwd: "/", stdio: ["pipe", "pipe", "ignore"] });
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
        () => finish(failure("MEDIA_WORKER_TIMEOUT", `${operation} did not answer in time`, true)),
        callTimeoutMs,
      );
      child.on("error", (error) =>
        finish(failure("MEDIA_WORKER_UNAVAILABLE", `Cannot run ${executable}: ${error.message}`)),
      );
      // `close` rather than `exit`: a child can exit with its answer still buffered in this
      // process's pipe, and that answer must not be thrown away as a failure.
      child.on("close", () => {
        clearTimeout(deadline);
        signal?.removeEventListener("abort", abort);
        // A scheduler may reuse capacity as soon as this promise settles. Keep the slot
        // until the child and its pipes are closed, even after a successful response.
        settle(result ?? failure("MEDIA_WORKER_FAILED", `${operation} produced no result`, true));
      });
      child.stdout.on("data", (chunk: Buffer) => {
        let value: unknown;
        try {
          value = reader.push(chunk);
        } catch (error) {
          finish(failure("MEDIA_WORKER_FAILED", (error as Error).message));
          return;
        }
        if (value === undefined) return;
        const parsed = resultSchema.safeParse(value);
        finish(
          parsed.success
            ? parsed.data
            : failure("MEDIA_WORKER_FAILED", `${operation} returned an unreadable result`),
        );
      });
      child.stdin.on("error", () => {});
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      child.stdin.end(frame);
    });
}
