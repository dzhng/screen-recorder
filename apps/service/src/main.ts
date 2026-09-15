import { randomUUID } from "node:crypto";
import { RevisionStore } from "@screenrec/core/library";
import { operate, operationFailure } from "./operations.js";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  CONTROL_FRAME_BYTES,
  captureReportSchema,
  encodeJsonLine,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";
import { CaptureService } from "./capture.js";
import { openControl } from "./control.js";
import { mediaWorker } from "./worker.js";
import { listenLocal, type LocalListener } from "./index.js";
import { StartupFailure, claimStartup, type StartupClaim } from "./startup.js";

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

function log(message: string): void {
  process.stderr.write(`screenrec-service: ${message}\n`);
}

async function main(): Promise<void> {
  const home = serviceHome();
  const runtimeDirectory = join(home, "run");
  const started = performance.now();

  let claim: StartupClaim | undefined;
  let store: RevisionStore | undefined;
  let listener: LocalListener;
  try {
    claim = await claimStartup(runtimeDirectory);
    store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    listener = await listenLocal({
      runtimeDirectory,
      handler: (request) => serve(request),
    });
  } catch (error) {
    store?.close();
    claim?.release();
    const startup = error instanceof StartupFailure;
    const occupied = startup
      ? error.code === "SOCKET_IN_USE"
      : (error as NodeJS.ErrnoException).code === "EADDRINUSE";
    process.stdout.write(
      encodeJsonLine(
        {
          event: "failed",
          error: {
            code: occupied ? "SOCKET_IN_USE" : "SERVICE_UNAVAILABLE",
            message: (startup
              ? error.message
              : `Service could not open ${runtimeDirectory}: ${(error as Error).message}`
            ).slice(0, 2_000),
            retryable: false,
            details: {},
          },
        },
        CONTROL_FRAME_BYTES,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const socketPath = listener.socketPath;
  const catalog = store;
  const ownership = claim;
  let stopping = false;
  const control = openControl({
    input: process.stdin,
    output: process.stdout,
    dispatch: (request) => answer(request),
    onEnd: () => stop(),
  });
  const capture = new CaptureService(
    catalog,
    home,
    (operation, params) => control.call(operation, params),
    mediaWorker(),
    log,
  );

  /** Every public operation, for a local client on the socket and for the app alike. */
  function serve(request: OperationRequest): Promise<OperationResult> {
    return operate(request, catalog, capture, () => healthData(started, socketPath, home));
  }

  /**
   * The private pipe additionally carries the app's own capture reports. They stay off the public
   * operation registry: this is the channel's half of capture ownership, not a capability a local
   * client may call.
   */
  function answer(request: OperationRequest): Promise<OperationResult> {
    if (request.operation === "capture.report") {
      const report = captureReportSchema.safeParse(request.params);
      if (!report.success)
        return Promise.resolve({
          ok: false,
          error: {
            code: "INVALID_PARAMS",
            message: "Capture reports carry a take, a sequence and a reported state.",
            retryable: false,
            details: {},
          },
        });
      try {
        return Promise.resolve({ ok: true, data: capture.report(report.data) });
      } catch (error) {
        return Promise.resolve(operationFailure(error));
      }
    }
    return serve(request);
  }

  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    control.close();
    // libuv unlinks the path it bound; nothing here removes a socket it does not own.
    // The startup lock outlives both the listener and catalog, so a replacement
    // cannot become the metadata writer before this owner has closed them.
    void listener.close().finally(() => {
      catalog.close();
      ownership.release();
    });
  };
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(signal, stop);

  control.emit({ event: "started", pid: process.pid, socketPath });
  // Takes the catalog still calls live outlived their previous service. Settling them needs the
  // native worker and the same control order as fresh capture, so it runs once the listener is
  // announced rather than inside the app's startup budget.
  await capture.reconcileStranded();
  log("reconciliation complete");
}

await main();
