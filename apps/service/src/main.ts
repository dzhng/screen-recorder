import { RecordingExports } from "./exports.js";
import { PackageInspection } from "./packages.js";
import { copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { PreviewInspection } from "@screenrec/core/preview";
import {
  PresentationEvidence,
  type PresentationReceipt,
} from "@screenrec/core/presentation-evidence";
import { writePointerSchedule } from "@screenrec/core/pointer-schedule";
import { clearRenderWorkspace, renderDeadlineMs, withRenderedMedia } from "./render.js";
import { RecordingStorage } from "@screenrec/core/storage";
import { IndexProcessing } from "@screenrec/core/index-processing";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { randomUUID } from "node:crypto";
import { CatalogError, RevisionStore } from "@screenrec/core/library";
import { JobQueue } from "@screenrec/core/jobs";
import { SourceEvidenceStore, type SourceEvidenceReceipt } from "@screenrec/core/evidence";
import { DerivedCache } from "@screenrec/core/cache";
import type { VisualObservations } from "@screenrec/core/scenes";
import { VisualObservationCache } from "@screenrec/core/visual-cache";
import { AudioInspection, type NativeAudio } from "@screenrec/core/audio";
import { LibraryFrameInspection } from "@screenrec/core/frames";
import type { NativeFrame } from "@screenrec/core/frame-materialization";
import { RecordingDeletion } from "./deletion.js";
import { ManagedFiles } from "./managed-files.js";
import { DerivativeDelivery } from "./delivery.js";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { SceneProcessing } from "@screenrec/core/scene-processing";
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
import { mediaWorker, type MediaWorker } from "./worker.js";
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
  const renderWorkspace = join(runtimeDirectory, "render");
  const started = performance.now();

  let claim: StartupClaim | undefined;
  let store: RevisionStore | undefined;
  let listener: LocalListener;
  let jobs: JobQueue | undefined;
  let evidence: SourceEvidenceStore;
  let sceneEvidence: SceneEvidenceStore;
  let indexEvidence: ScreenshotIndexStore;
  let processing: SourceProcessing;
  let scenes: SceneProcessing;
  let index: IndexProcessing;
  let frames: LibraryFrameInspection;
  let audio: AudioInspection;
  let preview: PreviewInspection;
  let files: ManagedFiles;
  let exports: RecordingExports | undefined;
  let delivery: DerivativeDelivery | undefined;
  let cache: DerivedCache;
  let storage: RecordingStorage | undefined;
  let packages: PackageInspection | undefined;
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
    execute: MediaWorker = worker,
    timeoutMs?: number,
  ): Promise<T> {
    const result = await execute(operation, params, {
      signal,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
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
    await clearRenderWorkspace(worker, renderWorkspace, cleanupLifetime.signal);
    store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    evidence = new SourceEvidenceStore(store);
    cache = new DerivedCache(store, home);
    storage = new RecordingStorage(store, cache, home, (recordingId, signal) =>
      exports!.usage(recordingId, signal),
    );
    cacheReady = cache.reconcile(cleanupLifetime.signal).catch((error) => {
      cacheFailure = error;
      if (!cleanupLifetime.signal.aborted)
        log(`cache reconciliation failed: ${(error as Error).message}`);
    });
    delivery = new DerivativeDelivery();
    jobs = new JobQueue({
      store,
      providers: { newId: randomUUID },
      execute: async (execution) => {
        if (execution.job.artifact === "export-recovery") return exports!.execute(execution);
        if (
          execution.job.artifact === "export-video" ||
          execution.job.artifact === "frame" ||
          execution.job.artifact === "audio" ||
          execution.job.artifact === "preview" ||
          execution.job.artifact === "source-scenes" ||
          execution.job.artifact === "screenshot-index"
        ) {
          await cacheReady;
          if (cacheFailure) throw cacheFailure;
          if (execution.job.artifact === "export-video") return exports!.execute(execution);
          if (execution.job.artifact === "preview") return preview.execute(execution);
          if (execution.job.artifact === "source-scenes") return scenes.execute(execution);
          if (execution.job.artifact === "screenshot-index") return index.execute(execution);
          return execution.job.artifact === "frame"
            ? frames.execute(execution)
            : audio.execute(execution);
        }
        return processing.execute(execution);
      },
      onCapacity: () => resumeProcessing(),
    });
    packages = new PackageInspection({
      directory: join(runtimeDirectory, "packages"),
      jobs,
      worker,
      delivery,
    });
    void packages
      .prepare()
      .catch((error) => log(`package recovery unavailable: ${(error as Error).message}`));
    processing = new SourceProcessing(
      store,
      jobs,
      evidence,
      home,
      (directory, output, signal) =>
        nativeData<SourceEvidenceReceipt>("media.sourceEvidence", { directory, output }, signal),
      (recordingId, generation) => exports!.retainsSource(recordingId, generation),
    );
    const visual = new VisualObservationCache(
      store,
      cache,
      ({ source, kept, atSourceUs }, signal) =>
        nativeData<VisualObservations>("media.visualSamples", { source, kept, atSourceUs }, signal),
    );
    sceneEvidence = new SceneEvidenceStore(store);
    indexEvidence = new ScreenshotIndexStore(store, home);
    scenes = new SceneProcessing(store, jobs, sceneEvidence, home, visual.sample);
    index = new IndexProcessing(
      store,
      jobs,
      indexEvidence,
      processing,
      scenes,
      { source: evidence, scenes: sceneEvidence },
      home,
      {
        sample: visual.sample,
        decode: (request, signal) => nativeData<NativeFrame>("media.frame", request, signal),
      },
    );
    frames = new LibraryFrameInspection(
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
    preview = new PreviewInspection(
      store,
      jobs,
      cache,
      evidence,
      processing,
      home,
      async (request, signal) => {
        await mkdir(renderWorkspace, { recursive: true, mode: 0o700 });
        return withRenderedMedia(
          worker,
          {
            source: request.source,
            plan: request.plan,
            tracks: request.tracks,
            attemptParent: renderWorkspace,
            preparePointer: async (attempt, execute, signal) => {
              const receipt = await nativeData<PresentationReceipt>(
                "media.presentationEvidence",
                {
                  source: request.source,
                  plan: request.plan,
                  output: join(attempt, "presentation.jsonl"),
                  maxBytes: 1024 ** 3,
                },
                signal,
                execute,
                renderDeadlineMs(request.plan),
              );
              const presentation = await PresentationEvidence.open(
                receipt,
                request.revision,
                signal,
              );
              try {
                return await writePointerSchedule(
                  {
                    presentation,
                    evidence,
                    identity: request.sourceEvidence,
                    output: join(attempt, "pointer.jsonl"),
                    maxBytes: 128 * 1024 ** 2,
                    maxEvents: 1_000_000,
                  },
                  signal,
                );
              } finally {
                await presentation.close();
              }
            },
          },
          signal,
          async (movie) => {
            await copyFile(movie.file, request.output, constants.COPYFILE_EXCL);
            return { ...movie, file: request.output };
          },
        );
      },
    );
    files = new ManagedFiles(home, worker);
    exports = new RecordingExports({
      store,
      jobs,
      cache,
      preview,
      processing,
      worker,
      files,
    });
    void cacheReady.then(() => {
      if (cleanupLifetime.signal.aborted) return;
      jobs!.startAdmission((job) => {
        if (cacheFailure) throw cacheFailure;
        return exports!.admit(job);
      });
    });
    listener = await listenLocal({
      runtimeDirectory,
      handler: (request) => serve(request),
    });
  } catch (error) {
    cleanupLifetime.abort();
    delivery?.dispose();
    await Promise.allSettled([
      packages?.dispose(),
      exports?.close(),
      jobs?.close(),
      cacheReady,
      storage?.close(),
    ]);
    store?.close();
    claim?.release();
    const startup = error instanceof StartupFailure;
    const catalogFailure = error instanceof CatalogError;
    const occupied = startup
      ? error.code === "SOCKET_IN_USE"
      : (error as NodeJS.ErrnoException).code === "EADDRINUSE";
    process.stdout.write(
      encodeJsonLine(
        {
          event: "failed",
          error: {
            code: occupied ? "SOCKET_IN_USE" : catalogFailure ? error.code : "SERVICE_UNAVAILABLE",
            message: (startup || catalogFailure
              ? error.message
              : `Service could not open ${runtimeDirectory}: ${(error as Error).message}`
            ).slice(0, 2_000),
            retryable: catalogFailure ? error.retryable : false,
            details: catalogFailure ? error.details : {},
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
  const storageOwner = storage;
  const packageOwner = packages;
  const exportOwner = exports;
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
        resumeProcessing();
      } finally {
        queue.schedule();
      }
    },
  );

  const deletion = new RecordingDeletion({
    store: catalog,
    jobs: queue,
    cache,
    source: evidence,
    scenes: sceneEvidence,
    index: indexEvidence,
    capture,
    delivery: transfers,
    files,
    exports: exportOwner,
    cleanupReady: async () => {
      await Promise.all([cacheReady, evidenceCleanup]);
      if (cacheFailure) throw cacheFailure;
      await clearRenderWorkspace(worker, renderWorkspace, cleanupLifetime.signal);
    },
  });

  function resumeProcessing(): void {
    if (stopping) return;
    try {
      processing.resume();
      scenes.resume();
    } catch (error) {
      log(`processing admission failed: ${(error as Error).message}`);
    }
    for (const error of exports?.resumeRecovery() ?? [])
      log(`export recovery admission failed: ${(error as Error).message}`);
  }

  /** Every public operation, for a local client on the socket and for the app alike. */
  async function serve(request: OperationRequest): Promise<OperationResult> {
    try {
      return await operate(request, {
        index,
        packages: packageOwner,
        exports: exportOwner,
        storage: storageOwner,
        deletion,
        store: catalog,
        capture,
        health: () => healthData(started, socketPath, home),
        processing,
        frames,
        audio,
        preview,
        delivery: transfers,
        scenes,
        cache,
      });
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
      packageOwner
        .dispose()
        .catch((error) => log(`package shutdown cleanup failed: ${(error as Error).message}`)),
      storageOwner.close(),
      deletion.close(),
      exportOwner.close(),
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
  evidenceCleanup = Promise.allSettled([
    index.cleanup(cleanupLifetime.signal),
    processing.cleanup(cleanupLifetime.signal),
    scenes.cleanup(cleanupLifetime.signal),
  ]).then((results) => {
    for (const result of results)
      if (result.status === "rejected" && !cleanupLifetime.signal.aborted)
        log(`evidence cleanup failed: ${(result.reason as Error).message}`);
  });
  void deletion.resume((error) => log(`recording deletion failed: ${(error as Error).message}`));
  await reconciled;
  resumeProcessing();
  log("reconciliation complete");
}

await main();
