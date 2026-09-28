import { LibraryTimelineInspection } from "./timeline-inspection.js";
import { MediaExports } from "./exports.js";
import { PackageInspection } from "./packages.js";
import { PreviewInspection } from "@screenrec/core/preview";
import { clearRenderWorkspace, previewRenderer } from "./render.js";
import { RecordingStorage } from "@screenrec/core/storage";
import { IndexProcessing } from "@screenrec/core/index-processing";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "@screenrec/core/library";
import { CatalogError } from "@screenrec/core/catalog";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import {
  recordingEvidenceOwner,
  SourceEvidenceStore,
  type SourceEvidenceReceipt,
} from "@screenrec/core/evidence";
import { DerivedCache, recordingCacheOwnerCheck } from "@screenrec/core/cache";
import type { VisualObservations } from "@screenrec/core/scenes";
import { VisualObservationCache } from "@screenrec/core/visual-cache";
import { LibraryAudioInspection, type NativeAudio } from "@screenrec/core/audio";
import { LibraryFrameInspection } from "@screenrec/core/frames";
import type { NativeFrame } from "@screenrec/core/frame-materialization";
import { RecordingDeletion } from "./deletion.js";
import { ManagedFiles } from "./managed-files.js";
import { DerivativeDelivery } from "./delivery.js";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { SceneProcessing } from "@screenrec/core/scene-processing";
import { SourceProcessing } from "@screenrec/core/processing";
import { SpeechModels } from "@screenrec/core/speech-models";
import { TranscriptStore, type SpeechTranscriptionReceipt } from "@screenrec/core/transcript";
import { TranscriptProcessing } from "@screenrec/core/transcript-processing";
import { operate, operationFailure } from "./operations.js";
import { join } from "node:path";
import {
  CONTROL_FRAME_BYTES,
  captureReportSchema,
  encodeJsonLine,
  operationError,
  personalHome,
  serviceRuntimeDirectory,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";
import { CaptureService } from "./capture.js";
import { openControl } from "./control.js";
import { mediaWorker, nativeResult, transcriptionDeadlineMs } from "./worker.js";
import { listenLocal, type LocalListener } from "./index.js";
import { StartupFailure, claimStartup, type StartupClaim } from "./startup.js";

function healthData(started: number, socketPath: string, home: string): unknown {
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
  const home = personalHome();
  const runtimeDirectory = serviceRuntimeDirectory(home);
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
  let models: SpeechModels;
  let transcriptStore: TranscriptStore;
  let transcripts: TranscriptProcessing;
  let timeline: LibraryTimelineInspection;
  let index: IndexProcessing;
  let frames: LibraryFrameInspection;
  let audio: LibraryAudioInspection;
  let preview: PreviewInspection;
  let files: ManagedFiles;
  let exports: MediaExports | undefined;
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
    timeoutMs?: number,
  ): Promise<T> {
    return nativeResult(
      await worker(operation, params, {
        signal,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      }),
    ) as T;
  }
  try {
    claim = await claimStartup(runtimeDirectory);
    await clearRenderWorkspace(worker, renderWorkspace, cleanupLifetime.signal);
    store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    evidence = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
    cache = new DerivedCache(store, home, recordingCacheOwnerCheck(store));
    storage = new RecordingStorage(store, cache, home, (recordingId, signal) =>
      exports!.usage(
        recordingId === undefined ? undefined : { kind: "recording", recordingId },
        signal,
      ),
    );
    cacheReady = cache.reconcile(cleanupLifetime.signal).catch((error) => {
      cacheFailure = error;
      if (!cleanupLifetime.signal.aborted)
        log(`cache reconciliation failed: ${(error as Error).message}`);
    });
    delivery = new DerivativeDelivery();
    jobs = new JobQueue({
      store,
      targets: recordingJobTargets(store),
      providers: { newId: randomUUID },
      execute: async (execution) => {
        if (execution.job.artifact === "export-recovery") return exports!.execute(execution);
        if (execution.job.artifact === "transcript") return transcripts.execute(execution);
        if (
          execution.job.artifact === "export-media" ||
          execution.job.artifact === "frame" ||
          execution.job.artifact === "audio" ||
          execution.job.artifact === "preview" ||
          execution.job.artifact === "source-scenes" ||
          execution.job.artifact === "screenshot-index"
        ) {
          await cacheReady;
          if (cacheFailure) throw cacheFailure;
          if (execution.job.artifact === "export-media") return exports!.execute(execution);
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
      render: (packageEvidence) => previewRenderer(worker, renderWorkspace, packageEvidence),
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
    models = new SpeechModels(home);
    transcriptStore = new TranscriptStore(store, home);
    transcripts = new TranscriptProcessing(
      store,
      jobs,
      transcriptStore,
      processing,
      evidence,
      models,
      home,
      (request, signal) =>
        nativeData<SpeechTranscriptionReceipt>(
          "speech.transcribe",
          request,
          signal,
          transcriptionDeadlineMs(request.track.available),
        ),
      (recordingId, generation) => exports!.retainsTranscript(recordingId, generation),
    );
    const visual = new VisualObservationCache(
      store,
      cache,
      ({ source, kept, atSourceUs }, signal) =>
        nativeData<VisualObservations>("media.visualSamples", { source, kept, atSourceUs }, signal),
    );
    sceneEvidence = new SceneEvidenceStore(store);
    indexEvidence = new ScreenshotIndexStore(store, home);
    scenes = new SceneProcessing(
      store,
      jobs,
      sceneEvidence,
      home,
      visual.sample,
      (recordingId, generation) => exports!.retainsScenes(recordingId, generation),
    );
    timeline = new LibraryTimelineInspection(store, processing, scenes, evidence, sceneEvidence);
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
      (recordingId, generation) => exports!.retainsIndex(recordingId, generation),
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
    audio = new LibraryAudioInspection(
      store,
      jobs,
      cache,
      evidence,
      processing,
      home,
      (request, signal) => nativeData<NativeAudio>("media.audio", request, signal),
    );
    preview = new PreviewInspection(
      store,
      jobs,
      cache,
      evidence,
      processing,
      home,
      previewRenderer(worker, renderWorkspace, evidence),
    );
    files = new ManagedFiles(home, worker);
    exports = new MediaExports({
      catalog: store,
      jobs,
      cache,
      worker,
      files,
      recording: {
        store,
        preview,
        processing,
        files,
        package: {
          source: evidence,
          scenes,
          index,
          transcript: transcripts,
          sceneEvidence,
          indexEvidence,
          transcriptEvidence: transcriptStore,
        },
      },
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
      handler: (request, signal) => serve(request, signal),
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
    transcripts: transcriptStore,
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
      transcripts.resume();
    } catch (error) {
      log(`processing admission failed: ${(error as Error).message}`);
    }
    for (const error of exports?.resumeRecovery() ?? [])
      log(`export recovery admission failed: ${(error as Error).message}`);
  }

  /**
   * A download outlives the client that asked for it, so asking again while it runs only reports its
   * progress. A ready model admits the transcripts that were waiting for it.
   */
  function prepareModels() {
    const status = models.status();
    if (status.state === "ready" || status.state === "preparing") return status;
    void models.prepare(cleanupLifetime.signal).then(resumeProcessing, (error: Error) => {
      if (!cleanupLifetime.signal.aborted) log(`speech model preparation failed: ${error.message}`);
    });
    return models.status();
  }

  /**
   * Every public operation, for a local client on the socket and for the app alike. The signal ends
   * a caller's interest: a socket client's disconnect, or this service stopping for the app.
   */
  async function serve(request: OperationRequest, signal: AbortSignal): Promise<OperationResult> {
    try {
      return await operate(
        request,
        {
          index,
          packages: packageOwner,
          exports: exportOwner,
          storage: storageOwner,
          deletion,
          store: catalog,
          capture,
          health: () => healthData(started, socketPath, home),
          processing,
          timeline,
          frames,
          audio,
          preview,
          delivery: transfers,
          scenes,
          transcripts,
          models: { status: () => models.status(), prepare: prepareModels },
          cache,
        },
        signal,
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
        return Promise.resolve(
          operationError(
            "INVALID_PARAMS",
            "Capture reports carry a take, a sequence and a reported state.",
          ),
        );
      try {
        return Promise.resolve({ ok: true, data: capture.report(report.data) });
      } catch (error) {
        return Promise.resolve(operationFailure(error));
      }
    }
    return serve(request, cleanupLifetime.signal);
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
    // One owner's failure to close must not release the catalog under the others still closing.
    void Promise.allSettled([
      listener.close(),
      packageOwner.dispose(),
      storageOwner.close(),
      deletion.close(),
      exportOwner.close(),
      capture.close(),
      queue.close(),
      evidenceCleanup,
      cacheReady,
    ]).then((results) => {
      for (const result of results)
        if (result.status === "rejected")
          log(`shutdown failed: ${(result.reason as Error).message}`);
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
    transcripts.cleanup(cleanupLifetime.signal),
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
