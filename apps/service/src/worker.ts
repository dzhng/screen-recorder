import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
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
import {
  subtract,
  fromTime,
  rational,
  divide,
  ceil,
  type SelectionRange,
} from "@screenrec/composition";

/**
 * Where the packaged app's native worker executable is. The app is the one owner of that path:
 * it launches this service from inside its own bundle and names the sibling executable here, so
 * the service never guesses a bundle layout. A test that runs the service without an app sets it
 * explicitly, and an unset variable is reported rather than searched around.
 */
const NATIVE_EXECUTABLE_VARIABLE = "SCREENREC_NATIVE";
export const MAX_MEDIA_TIMEOUT_MS = 2_147_483_647;

/** Budget selected output, including silence, without charging for discarded source prefixes. */
export function renderWindowDeadlineMs(range: SelectionRange): number {
  return Math.min(
    MAX_MEDIA_TIMEOUT_MS,
    30_000 +
      2 * ceil(divide(subtract(fromTime(range.endUs), fromTime(range.startUs)), rational(1000n))),
  );
}

/** Ten minutes covers a cold model load and verifying its files; inference gets twice the narration
 * the request plans to read. */
export function transcriptionDeadlineMs(available: readonly SelectionRange[]): number {
  // Timeout estimates project each run before summing, keeping varied native timescales bounded.
  const narrationUs = available.reduce(
    (total, range) =>
      total + BigInt(ceil(subtract(fromTime(range.endUs), fromTime(range.startUs)))),
    0n,
  );
  const budget = 600_000n + (2n * narrationUs + 999n) / 1000n;
  return Number(budget < BigInt(MAX_MEDIA_TIMEOUT_MS) ? budget : BigInt(MAX_MEDIA_TIMEOUT_MS));
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
  return (operation, params, options) =>
    jsonWorker({ executable: environment[NATIVE_EXECUTABLE_VARIABLE] }, timeoutMs)(
      operation,
      params,
      options,
    );
}

type WorkerCommand = {
  executable: string | undefined;
  args?: readonly string[];
  environment?: NodeJS.ProcessEnv;
};
type WorkerOptions = { signal?: AbortSignal; timeoutMs?: number; descriptors?: readonly number[] };

/** Process lifetime is shared; each wire protocol owns its decoding and completion rule. */
function ownedProcess(
  command: WorkerCommand,
  operation: string,
  options: WorkerOptions,
  protocol: {
    input?: Buffer;
    group?: boolean;
    stdout: (chunk: Buffer) => OperationResult | undefined;
    stderr?: (chunk: Buffer) => OperationResult | undefined;
    completion?: (chunk: Buffer) => OperationResult | true | undefined;
    completed: (exitCode: number | null) => OperationResult;
  },
): Promise<OperationResult> {
  return new Promise((settle) => {
    const { signal, timeoutMs = MEDIA_WORKER_TIMEOUT_MS, descriptors = [] } = options;
    if (signal?.aborted) {
      settle(operationError("CANCELED", operation + " was canceled"));
      return;
    }
    if (
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > MAX_MEDIA_TIMEOUT_MS ||
      descriptors.some((fd) => !Number.isSafeInteger(fd) || fd < 0)
    ) {
      settle(operationError("INVALID_REQUEST", "Worker deadline/descriptors are invalid"));
      return;
    }
    if (!command.executable || !isAbsolute(command.executable)) {
      settle(
        operationError(
          "MEDIA_WORKER_UNAVAILABLE",
          "Worker must name an absolute packaged executable",
        ),
      );
      return;
    }
    const child = spawn(command.executable, [...(command.args ?? [])], {
      ...(command.environment ? { env: command.environment } : {}),
      cwd: "/",
      detached: protocol.group === true,
      stdio: [
        "pipe",
        "pipe",
        protocol.stderr ? "pipe" : "ignore",
        ...descriptors,
        ...(protocol.completion ? ["pipe" as const] : []),
      ],
    });
    let result: OperationResult | undefined;
    const stop = () => {
      if (protocol.group && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL");
        }
      } else child.kill("SIGKILL");
    };
    const finish = (value: OperationResult) => {
      if (result !== undefined) return;
      result = value;
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
      stop();
    };
    const abort = () => finish(operationError("CANCELED", operation + " was canceled"));
    const deadline = setTimeout(
      () =>
        finish(
          operationError("MEDIA_WORKER_TIMEOUT", operation + " did not answer in time", true, {
            operation,
            timeoutMs,
          }),
        ),
      timeoutMs,
    );
    child.on("error", (error) =>
      finish(operationError("MEDIA_WORKER_UNAVAILABLE", "Cannot run worker: " + error.message)),
    );
    // A killed wrapper can leave descendants holding pipes. Retire its known group
    // at exit, before waiting for close; close alone would deadlock on those pipes.
    child.on("exit", () => {
      if (protocol.group) stop();
    });
    child.on("close", async (exitCode) => {
      clearTimeout(deadline);
      if (protocol.group && child.pid) {
        const started = performance.now();
        let overrun = false;
        for (;;) {
          try {
            process.kill(-child.pid, 0);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ESRCH") break;
          }
          if (!overrun && performance.now() - started >= 5000) {
            overrun = true;
            console.error(
              "screenrec: CLI process group retirement exceeded 5s; retaining owned work",
              { groupId: child.pid },
            );
          }
          // A closed pipe is not descendant retirement. No safe synthetic result
          // can release this slot while the kernel still reports the owned group.
          await delay(overrun ? 1000 : 10);
        }
      }
      signal?.removeEventListener("abort", abort);
      settle(result ?? protocol.completed(exitCode));
    });
    const completion = child.stdio[3 + descriptors.length];
    if (protocol.completion && completion && "on" in completion) {
      completion.on("data", (chunk: Buffer) => {
        const value = protocol.completion!(chunk);
        if (value === true) stop();
        else if (value) finish(value);
      });
    }
    child.stdout!.on("data", (chunk: Buffer) => {
      if (result !== undefined) return;
      try {
        const value = protocol.stdout(chunk);
        if (value) finish(value);
      } catch (error) {
        finish(operationError("MEDIA_WORKER_FAILED", (error as Error).message));
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (result !== undefined) return;
      const value = protocol.stderr?.(chunk);
      if (value) finish(value);
    });
    child.stdin!.on("error", () => {});
    signal?.addEventListener("abort", abort, { once: true });
    child.stdin!.end(protocol.input);
  });
}

/** Native answers one JSON line; answering still retires the child before resolving. */
export function jsonWorker(
  command: WorkerCommand,
  timeoutMs = MEDIA_WORKER_TIMEOUT_MS,
): MediaWorker {
  return (operation, params, options = {}) => {
    let frame: Buffer;
    try {
      frame = encodeJsonLine({ id: "worker-" + operation, operation, params }, REQUEST_FRAME_BYTES);
    } catch {
      return Promise.resolve(
        operationError("INVALID_REQUEST", "Cannot encode " + operation + " for the native worker"),
      );
    }
    const reader = new JsonLineReader(RESPONSE_FRAME_BYTES);
    return ownedProcess(
      command,
      operation,
      { ...options, timeoutMs: options.timeoutMs ?? timeoutMs },
      {
        input: frame,
        stdout: (chunk) => {
          const value = reader.push(chunk);
          if (value === undefined) return;
          const parsed = resultSchema.safeParse(value);
          return parsed.success
            ? parsed.data
            : operationError("MEDIA_WORKER_FAILED", operation + " returned an unreadable result");
        },
        completed: () =>
          operationError("MEDIA_WORKER_FAILED", operation + " produced no result", true),
      },
    );
  };
}

/** The existing native executable watches service death for this private CLI mode. */
export function cliWorker(
  command: {
    executable: string;
    ownerExecutable: string;
    args: readonly string[];
    environment?: NodeJS.ProcessEnv;
  },
  options: WorkerOptions & { maxBytes?: number; output?: "bytes" | "json" } = {},
): Promise<OperationResult> {
  const maximum = options.maxBytes ?? RESPONSE_FRAME_BYTES;
  if (!isAbsolute(command.executable) || !Number.isSafeInteger(maximum) || maximum < 1)
    return Promise.resolve(
      operationError("INVALID_REQUEST", "CLI executable/output bound is invalid"),
    );
  const stdout: Buffer[] = [],
    stderr: Buffer[] = [];
  let size = 0;
  let completion = Buffer.alloc(0);
  let commandExit: number | undefined;
  const capture = (chunks: Buffer[], chunk: Buffer) => {
    size += chunk.length;
    if (size > maximum)
      return operationError("MEDIA_WORKER_FAILED", "CLI output exceeds its byte bound");
    chunks.push(chunk);
  };
  return ownedProcess(
    {
      executable: command.ownerExecutable,
      args: [
        "--run-cli",
        String(3 + (options.descriptors?.length ?? 0)),
        command.executable,
        ...command.args,
      ],
      ...(command.environment ? { environment: command.environment } : {}),
    },
    "CLI",
    options,
    {
      group: true,
      completion: (chunk) => {
        if (completion.length + chunk.length > 4 || commandExit !== undefined)
          return operationError("MEDIA_WORKER_FAILED", "CLI completion is malformed or duplicated");
        completion = Buffer.concat([completion, chunk]);
        if (!completion.includes(10)) return;
        const text = completion.toString("utf8");
        if (!/^(0|[1-9][0-9]{0,2})\n$/.test(text) || Number(text) > 255)
          return operationError("MEDIA_WORKER_FAILED", "CLI completion is malformed or duplicated");
        commandExit = Number(text);
        return true;
      },
      stdout: (chunk) => capture(stdout, chunk),
      stderr: (chunk) => capture(stderr, chunk),
      completed: (wrapperExit) => {
        const exitCode = commandExit;
        const diagnostic = Buffer.concat(stderr).toString("utf8");
        if (exitCode === undefined)
          return operationError(
            "MEDIA_WORKER_FAILED",
            "CLI owner exited without command completion",
            true,
            { exitCode: wrapperExit, stderr: diagnostic },
          );
        if (exitCode !== 0)
          return operationError("MEDIA_WORKER_FAILED", "CLI exited unsuccessfully", true, {
            exitCode,
            stderr: diagnostic,
          });
        const bytes = Buffer.concat(stdout);
        if (options.output === "json") {
          try {
            return {
              ok: true,
              data: {
                output: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
                stderr: diagnostic,
                exitCode,
              },
            };
          } catch {
            return operationError("MEDIA_WORKER_FAILED", "CLI returned malformed JSON", false, {
              stderr: diagnostic,
            });
          }
        }
        return { ok: true, data: { stdout: bytes, stderr: diagnostic, exitCode } };
      },
    },
  );
}
