import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_CALL_TIMEOUT_MS } from "@screenrec/protocol";
import { callLocal, LocalTransportError } from "./transport.js";

export const DISCOVERY_BUDGET_MS = DEFAULT_CALL_TIMEOUT_MS;
const LAUNCHER = "/usr/bin/open";

export type ServiceSelection = {
  /** Explicit sockets bypass discovery and never launch the app. */
  socketPath?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  signal?: AbortSignal | undefined;
  budgetMs?: number | undefined;
};

export function defaultSocketPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(personalHome(env), "run", "service.sock");
}

function personalHome(env: NodeJS.ProcessEnv): string {
  return env.SCREENREC_HOME ? resolve(env.SCREENREC_HOME) : join(homedir(), ".screen-recorder");
}

/** Discovery sends only health probes. The caller sends its operation once after this returns. */
export async function resolveServiceSocket(options: ServiceSelection = {}): Promise<string> {
  if (options.socketPath !== undefined) return options.socketPath;
  const env = options.env ?? process.env;
  const budgetMs = options.budgetMs ?? DISCOVERY_BUDGET_MS;
  if (!Number.isSafeInteger(budgetMs) || budgetMs <= 0 || budgetMs > 2_147_483_647)
    throw new RangeError("Discovery budget must be a positive supported timer interval");
  const controller = new AbortController();
  const abort = () =>
    controller.abort(
      new LocalTransportError("ABORTED", "Service discovery canceled; no request was sent"),
    );
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const socketPath = defaultSocketPath(env);
  const timer = setTimeout(
    () =>
      controller.abort(
        new LocalTransportError(
          "TIMEOUT",
          `Service at ${socketPath} did not become ready within ${budgetMs} ms. No request was sent. ` +
            "Check the app's service status, or pass an explicit socket.",
        ),
      ),
    budgetMs,
  );
  const signal = controller.signal;
  try {
    signal.throwIfAborted();
    // The race also bounds filesystem inspection, which has no AbortSignal API. The
    // discovery branch checks cancellation again before it can launch anything late.
    return await Promise.race([
      discover(socketPath, env, signal),
      new Promise<never>((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      ),
    ]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

async function discover(
  socketPath: string,
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
): Promise<string> {
  if (await answering(socketPath, signal)) return socketPath;
  signal.throwIfAborted();
  const bundle = env.SCREENREC_APP ?? join(homedir(), "Applications", "ScreenRecorder.app");
  if (!isAbsolute(bundle))
    throw new LocalTransportError(
      "APP_NOT_FOUND",
      `SCREENREC_APP must be an absolute path to a .app bundle; received ${JSON.stringify(bundle)}`,
    );
  const executables = await stat(join(bundle, "Contents", "MacOS")).catch(() => undefined);
  signal.throwIfAborted();
  if (!executables?.isDirectory())
    throw new LocalTransportError(
      "APP_NOT_FOUND",
      `No recorder app bundle at ${JSON.stringify(bundle)}. ` +
        "Install the personal app there, set SCREENREC_APP to its absolute path, or pass --socket PATH.",
    );
  // Always carry the resolved home, including the default/empty-env case. LaunchServices
  // may inherit a different environment; an already-running app retains its original home.
  await launch(bundle, personalHome(env), signal);
  while (true) {
    await delay(100, undefined, { signal });
    if (await answering(socketPath, signal)) return socketPath;
  }
}

async function answering(socketPath: string, signal: AbortSignal): Promise<boolean> {
  try {
    await callLocal(
      socketPath,
      { id: randomUUID(), operation: "service.health", params: {} },
      { timeoutMs: 1_000, signal },
    );
    return true;
  } catch {
    signal.throwIfAborted();
    return false;
  }
}

function launch(bundle: string, home: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolveLaunch, reject) => {
    // No --args: ordinary launch starts the menu-bar service, never a capture probe.
    const child = spawn(LAUNCHER, ["-g", "-a", bundle, "--env", `SCREENREC_HOME=${home}`], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let diagnostic = "";
    const abort = () => {
      child.kill("SIGKILL");
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    child.stderr.on("data", (bytes: Buffer) => {
      diagnostic = (diagnostic + bytes.toString("utf8")).slice(0, 2_000);
    });
    child.once("error", (error) => {
      signal.removeEventListener("abort", abort);
      reject(
        new LocalTransportError("LAUNCH_FAILED", `Could not run ${LAUNCHER}: ${error.message}`),
      );
    });
    child.once("close", (code) => {
      signal.removeEventListener("abort", abort);
      if (code === 0) resolveLaunch();
      else
        reject(
          new LocalTransportError(
            "LAUNCH_FAILED",
            `Could not launch ${JSON.stringify(bundle)}: ${diagnostic.trim() || `exit code ${code}`}`,
          ),
        );
    });
  });
}
