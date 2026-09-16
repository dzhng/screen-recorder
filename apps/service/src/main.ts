import { randomUUID } from "node:crypto";
import { CatalogError, RevisionStore } from "@screenrec/core/library";
import { JobQueue } from "@screenrec/core/jobs";
import { SourceEvidenceStore, type SourceEvidenceReceipt } from "@screenrec/core/evidence";
import { DerivedCache } from "@screenrec/core/cache";
import type { VisualObservations } from "@screenrec/core/scenes";
import { VisualObservationCache } from "@screenrec/core/visual-cache";
import { AudioInspection, type NativeAudio } from "@screenrec/core/audio";
import { FrameInspection, type NativeFrame } from "@screenrec/core/frames";
import { DerivativeDelivery } from "./delivery.js";
import { SourceProcessing } from "@screenrec/core/processing";
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
  let jobs: JobQueue | undefined;
  let processing: SourceProcessing;
  let frames: FrameInspection;
  let audio: AudioInspection;
  let delivery: DerivativeDelivery | undefined;
  let cacheReady: Promise<void> = Promise.resolve();
  let cacheFailure: unknown;
  let stopping = false;
  const cleanupLifetime = new AbortController();
  let evidenceCleanup: Promise<void> = Promise.resolve();
  const worker = mediaWorker();
  async function nativeData<T>(
    operation: string,
    params: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<T> {
    const result = await worker(operation, params, { signal });
    if (!result.ok)
      throw new CatalogError(
        result.error.code,
        result.error.message,
        result.error.details,
        result.error.retryable,
      );
    return result.data as T;
  }
  try {
    claim = await claimStartup(runtimeDirectory);
    store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    const evidence = new SourceEvidenceStore(store);
    const cache = new DerivedCache(store, home);
    cacheReady = cache.reconcile(cleanupLifetime.signal).catch((error) => {
      cacheFailure = error;
      if (!cleanupLifetime.signal.aborted)
        log(`cache reconciliation failed: ${(error as Error).message}`);
    });
    delivery = new DerivativeDelivery(cache);
    jobs = new JobQueue({
      store,
      providers: { newId: randomUUID },
      execute: async (execution) => {
        if (execution.job.artifact === "frame" || execution.job.artifact === "audio") {
          await cacheReady;
          if (cacheFailure) throw cacheFailure;
          return execution.job.artifact === "frame"
            ? frames.execute(execution)
            : audio.execute(execution);
        }
        return processing.execute(execution);
      },
      onCapacity: () => resumeProcessing(),
    });
    processing = new SourceProcessing(store, jobs, evidence, home, (directory, output, signal) =>
      nativeData<SourceEvidenceReceipt>("media.sourceEvidence", { directory, output }, signal),
    );
    const visual = new VisualObservationCache(store, cache, (request, signal) =>
      nativeData<VisualObservations>("media.visualSamples", request, signal),
    );
    frames = new FrameInspection(
      store,
      jobs,
      cache,
      home,
      (request, signal) => nativeData<NativeFrame>("media.frame", request, signal),
      {
        processing,
        evidence,
        sample: visual.sample,
      },
    );
    audio = new AudioInspection(store, jobs, cache, evidence, processing, home, (request, signal) =>
      nativeData<NativeAudio>("media.audio", request, signal),
    );
    listener = await listenLocal({
      runtimeDirectory,
      handler: (request) => serve(request),
    });
  } catch (error) {
    cleanupLifetime.abort();
    delivery?.dispose();
    await Promise.all([jobs?.close(), cacheReady]);
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
  const queue = jobs;
  const transfers = delivery;
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
    worker,
    log,
    () => {
      try {
        processing.resume();
      } finally {
        queue.schedule();
      }
    },
  );

  function resumeProcessing(): void {
    if (stopping) return;
    try {
      processing.resume();
    } catch (error) {
      log(`processing admission failed: ${(error as Error).message}`);
    }
  }

  /** Every public operation, for a local client on the socket and for the app alike. */
  async function serve(request: OperationRequest): Promise<OperationResult> {
    try {
      return await operate(
        request,
        catalog,
        capture,
        () => healthData(started, socketPath, home),
        processing,
        frames,
        audio,
        transfers,
      );
    } finally {
      queue.schedule();
    }
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
    cleanupLifetime.abort();
    transfers.dispose();
    void Promise.all([
      listener.close(),
      capture.close(),
      queue.close(),
      evidenceCleanup,
      cacheReady,
    ]).finally(() => {
      catalog.close();
      ownership.release();
    });
  };
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(signal, stop);

  // Takes the catalog still calls live outlived their previous service. Settling them needs the
  // native worker, so it takes the capture order here — ahead of every mutation this listener
  // can accept — and then runs outside the app's startup budget rather than inside it.
  const reconciled = capture.reconcileStranded();
  control.emit({ event: "started", pid: process.pid, socketPath });
  evidenceCleanup = processing.cleanup(cleanupLifetime.signal).catch((error) => {
    if (!cleanupLifetime.signal.aborted)
      log(`evidence cleanup failed: ${(error as Error).message}`);
  });
  await reconciled;
  resumeProcessing();
  log("reconciliation complete");
}

await main();
