import { RecordingDeletion } from "./deletion.js";
import { CaptureCleanup } from "./capture-cleanup.js";
import { ManagedStorage } from "@screenrec/core/storage";
import { VoiceGenerationJobs } from "@screenrec/core/voice-generation";
import { voiceRenderer } from "./voice.js";
import { AudioExtraction } from "@screenrec/core/audio-extraction";
import { assetProbe } from "./media-probe.js";
import { sourceExporter } from "./source-export.js";
import { PreparedAudioStore } from "@screenrec/core/prepared-audio";
import { projectComposition } from "@screenrec/core/project-window";
import { selectSource } from "@screenrec/core/source-selection";
import { outputCapabilities, audioOutputCapabilities } from "@screenrec/composition";
import { ProjectPackages } from "./project-packages.js";
import { writeFile } from "node:fs/promises";
import { AcousticInspection } from "@screenrec/core/acoustic-inspection";
import { MediaFrameInspection } from "@screenrec/core/frame-inspection";
import { CaptureSourceRead } from "@screenrec/core/capture-source-read";
import { SourceEvents } from "@screenrec/core/source-events";
import { SourceSceneRead } from "@screenrec/core/scene-source-read";
import { SceneEvidenceStore, assetSceneOwner } from "@screenrec/core/scene-evidence";
import { IndexProcessing } from "@screenrec/core/index-processing";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { sourceIndexDomain, type SourceIndexRecords } from "@screenrec/core/source-index";
import { projectIndexDomain, type ProjectIndexRecords } from "@screenrec/core/project-index";
import { SceneProcessing } from "@screenrec/core/scene-processing";
import type { SourceVisualObservations } from "@screenrec/core/source-scenes";
import { MediaAudioInspection } from "@screenrec/core/audio-inspection";
import { ProjectEvidenceInspection } from "@screenrec/core/project-evidence";
import { Models } from "@screenrec/core/models";
import { TranscriptStore, type SpeechTranscriptionReceipt } from "@screenrec/core/transcript";
import { TranscriptProcessing, assetTranscriptOwner } from "@screenrec/core/transcript-processing";
import { SourceTranscriptRead } from "@screenrec/core/transcript-read";
import { AcquisitionStore, AcquisitionImporter } from "@screenrec/core/acquisitions";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { MediaExports } from "./exports.js";
import { PointerPreparation } from "@screenrec/core/pointer-preparation";
import { ProjectPreviewInspection } from "@screenrec/core/project-preview";
import {
  nativeAudioCapabilities,
  projectMovieRenderer,
  projectAudioRenderer,
  projectFrameRenderer,
  projectPointerHistoryRenderer,
} from "./project-render.js";
import { clearRenderWorkspace, withRenderedFile } from "./render.js";
import { DerivativeDelivery } from "./delivery.js";
import { DerivedCache } from "@screenrec/core/cache";
import { ManagedFiles } from "./managed-files.js";
import { ProjectDeletion } from "./project-deletion.js";
import { ProjectStore } from "@screenrec/core/projects";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { AssetStore } from "@screenrec/core/assets";
import { CatalogError } from "@screenrec/core/catalog";
import { CaptureStore, isSettled } from "@screenrec/core/capture-store";
import { CaptureService } from "./capture.js";
import { CaptureSources } from "./capture-sources.js";
import { openControl, type ControlChannel } from "./control.js";
import type { Readable, Writable } from "node:stream";
import { JobQueue, type JobTargets } from "@screenrec/core/jobs";
import {
  operationSchema,
  operationNames,
  operationError,
  serviceSocketPath,
  serviceRuntimeDirectory,
  captureReportSchema,
  type OperationResult,
} from "@screenrec/protocol";
import {
  listenLocal,
  prepareRuntimeDirectory,
  type LocalHandler,
  type LocalListener,
} from "./index.js";
import { claimStartup } from "./startup.js";
import {
  renderWindowDeadlineMs,
  mediaWorker,
  nativeResult,
  transcriptionDeadlineMs,
  type MediaWorker,
} from "./worker.js";
import { operationFailure } from "./operation-errors.js";

/** Isolated development entry; production capture switches to these owners at cutover. */
export async function startProjectService(options: {
  home: string;
  worker?: MediaWorker;
  control?: { input: Readable; output: Writable };
}) {
  const started = performance.now();
  const library = join(options.home, "library");
  const runtime = serviceRuntimeDirectory(options.home);
  await prepareRuntimeDirectory(library);
  const ownership = await claimStartup(runtime);
  let catalog: CaptureStore | undefined;
  let jobs: JobQueue | undefined;
  let listenerStarting: Promise<LocalListener> | undefined;
  let deletion: ProjectDeletion | undefined;
  let recordingDeletion: RecordingDeletion | undefined;
  let exports: MediaExports | undefined;
  let packages: ProjectPackages | undefined;
  let storage: ManagedStorage | undefined;
  let controller: ControlChannel | undefined;
  let captureControl: CaptureService | undefined;
  let modelsOwner: Models | undefined;
  let reconciliation: Promise<void> | undefined;
  const delivery = new DerivativeDelivery();
  const modelLifetime = new AbortController();
  const modelPreparations = new Set<Promise<void>>();
  const pending = new Set<Promise<OperationResult>>();
  let closing = false;
  let closed: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (closed) return closed;
    closing = true;
    closed = Promise.resolve().then(async () => {
      controller?.close();
      modelLifetime.abort();
      delivery.dispose();
      // Own the eventual listener before control opens: EOF during bind must not publish a
      // socket after shutdown released the catalog. Every owner drains before that release.
      const results = await Promise.allSettled([
        listenerStarting?.then((bound) => bound.close()),
        captureControl?.close(),
        reconciliation,
        jobs?.close(),
        deletion?.close(),
        recordingDeletion?.close(),
        exports?.close(),
        packages?.close(),
        storage?.close(),
        Promise.allSettled(pending),
        Promise.allSettled(modelPreparations),
        modelsOwner?.settled(),
      ]);
      for (const result of results) if (result.status === "rejected") console.error(result.reason);
      catalog?.close();
      ownership.release();
    });
    return closed;
  };
  try {
    catalog = new CaptureStore(join(library, "catalog.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    const captures = catalog;
    const assets = new AssetStore(catalog, library);
    await assets.recover();
    const acquisitions = new AcquisitionStore(catalog);
    const evidence = new SourceEvidenceStore(catalog, (identity) => {
      if (identity.owner.kind !== "acquisition")
        throw new CatalogError("NOT_FOUND", "Unsupported source evidence owner");
      acquisitions.intent(identity.owner.acquisitionId);
    });
    const acquisitionImports = new AcquisitionImporter(
      catalog,
      acquisitions,
      assets,
      evidence,
      library,
    );
    const capture = new CaptureSourceRead(assets, acquisitions, evidence);
    const sceneRecords = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
    const worker = options.worker ?? mediaWorker();
    const models = new Models(library);
    modelsOwner = models;
    const transcriptStore = new TranscriptStore(
      catalog,
      library,
      assetTranscriptOwner(assets, acquisitions),
    );
    const projects = new ProjectStore(catalog, assets, transcriptStore, acquisitions);
    const files = new ManagedFiles(library, worker);
    const cache = new DerivedCache(catalog, library, (owner) => {
      if (owner.kind === "project") projects.get(owner.projectId);
      else if (owner.kind === "asset") {
        if (!assets.has(owner.assetId))
          throw new CatalogError("NOT_FOUND", "Asset does not exist", { assetId: owner.assetId });
      } else if (owner.kind === "acquisition") acquisitions.get(owner.acquisitionId);
      else throw new CatalogError("NOT_FOUND", "Unsupported derived-file owner");
    });
    await cache.reconcile();
    const workspace = join(library, "render");
    await clearRenderWorkspace(worker, workspace, new AbortController().signal);
    const probe = assetProbe(worker, workspace);
    const targets: JobTargets = {
      pin(target) {
        if (target.kind === "import") assets.intent(target.importId);
        else if (target.kind === "acquisition") {
          if (!captureSources.available(target.acquisitionId))
            throw new CatalogError("NOT_FOUND", "Capture source donor is unavailable");
        } else if (target.kind === "asset") {
          if (!assets.has(target.assetId))
            throw new CatalogError("NOT_FOUND", "Asset does not exist", {
              assetId: target.assetId,
            });
        } else if (target.kind === "project")
          projects.requireRevision(target.projectId, target.revisionId);
        else if (target.kind === "recording" && target.revisionId === null) {
          const recording = captures.get(target.recordingId);
          if (!isSettled(recording.state) || recording.state === "canceled")
            throw new CatalogError(
              "INVALID_STATE",
              "Source-owned work requires a settled available recording",
            );
          return { ...target, revisionId: null };
        } else throw new CatalogError("NOT_READY", "Unsupported project service job target");
        return target;
      },
      isAvailable(target) {
        if (target.kind === "recording") return captures.isAvailable(target.recordingId);
        if (target.kind === "asset") return assets.has(target.assetId);
        if (target.kind === "project")
          return projects.hasRevision(target.projectId, target.revisionId);
        if (target.kind !== "import" && target.kind !== "acquisition") return false;
        try {
          targets.pin(target);
          return true;
        } catch (error) {
          if (error instanceof CatalogError && error.code === "NOT_FOUND") return false;
          throw error;
        }
      },
      isDeleting: (owner) =>
        owner.kind === "recording"
          ? captures.isDeleting(owner.recordingId)
          : owner.kind === "project" && projects.isDeleting(owner.projectId),
      isCapturing: () => captures.isCapturing(),
    };
    await acquisitionImports.recover(new AbortController().signal);
    await sceneRecords.recoverPending("asset", new AbortController().signal);
    await transcriptStore.recoverPendingAssets(new AbortController().signal);
    let captureCleanup: CaptureCleanup;
    let pointers: PointerPreparation;
    let preview: ProjectPreviewInspection;
    let mediaFrames: MediaFrameInspection;
    let transcripts: TranscriptProcessing;
    let projectEvidence: ProjectEvidenceInspection;
    let mediaAudio: MediaAudioInspection;
    let preparedAudio: PreparedAudioStore;
    let extractedAudio: AudioExtraction;
    let generatedVoice: VoiceGenerationJobs;
    let acoustics: AcousticInspection;
    let scenes: SceneProcessing;
    let indexes: IndexProcessing;
    const resumeCaptureSources = () => {
      if (closing) return;
      try {
        captureSources.resume();
      } catch (error) {
        console.error(error);
      }
    };
    const queue = new JobQueue({
      deferExecution: true,
      store: catalog,
      targets,
      providers: { newId: randomUUID },
      onCapacity: () => {
        resumeCaptureSources();
        for (const error of exports?.resumeRecovery() ?? []) console.error(error);
      },
      execute: async ({ job, signal }) => {
        if (job.artifact === "voice-generation") return generatedVoice.execute({ job, signal });
        if (job.artifact === "audio-extract") return extractedAudio.execute({ job, signal });
        if (job.artifact === "prepared-audio") return preparedAudio.execute({ job, signal });
        if (job.artifact === "pointer-presentation") return pointers.execute({ job, signal });
        if (
          (job.target.kind === "asset" || job.target.kind === "project") &&
          job.artifact === "screenshot-index"
        )
          return indexes.execute({ job, signal });
        if (job.target.kind === "asset" && job.artifact === "source-scenes")
          return scenes.execute({ job, signal });
        if (
          (job.target.kind === "asset" || job.target.kind === "project") &&
          ["waveform", "spectrum", "acoustic-image"].includes(job.artifact)
        )
          return acoustics.execute({ job, signal });
        if (
          (job.target.kind === "project" || job.target.kind === "asset") &&
          job.artifact === "frame"
        )
          return mediaFrames.execute({ job, signal });
        if (
          (job.target.kind === "asset" || job.target.kind === "project") &&
          ["audio", "audio-file"].includes(job.artifact)
        )
          return mediaAudio.execute({ job, signal });
        if (job.target.kind === "project" && job.artifact === "project.evidence")
          return projectEvidence.execute({ job, signal });
        if (job.artifact === "transcript") return transcripts.execute({ job, signal });
        if (job.artifact === "export-media" || job.artifact === "export-recovery")
          return exports!.execute({ job, signal });
        if (job.target.kind === "project" && job.artifact === "preview")
          return preview.execute({ job, signal });
        if (job.artifact === "capture-cleanup") return captureCleanup.execute({ job, signal });
        if (job.target.kind === "acquisition" && job.artifact === "acquisition.import") {
          const acquisition = await acquisitionImports.executeImport(
            job.target.acquisitionId,
            job.attemptId,
            {
              probe,
              exportSource: sourceExporter(worker),
            },
            signal,
          );
          return JSON.stringify({ acquisitionId: acquisition.id });
        }
        if (job.target.kind !== "import" || job.artifact !== "asset.import")
          throw new CatalogError("NOT_READY", "Unsupported preparation job");
        const asset = await assets.executeImport(job.target.importId, probe, signal, {
          kind: "job",
          id: job.jobId,
        });
        return JSON.stringify({ assetId: asset.id });
      },
    });
    jobs = queue;
    captureCleanup = new CaptureCleanup(captures, queue, library, worker);
    const captureSources = new CaptureSources(captures, acquisitions, queue, library, files);
    pointers = new PointerPreparation({
      assets,
      acquisitions,
      evidence,
      jobs: queue,
      cache,
      renderer: projectPointerHistoryRenderer(worker, workspace),
    });
    transcripts = new TranscriptProcessing({
      jobs: queue,
      transcripts: transcriptStore,
      models: models.transcription("parakeet"),
      asset: { assets, acquisitions },
      transcribe: async (request, signal) =>
        nativeResult(
          await worker("speech.transcribe", request, {
            signal,
            timeoutMs: transcriptionDeadlineMs(request.track.available),
          }),
        ) as SpeechTranscriptionReceipt,
    });
    const audioCapabilities = await nativeAudioCapabilities(worker);
    const audioRenderer = projectAudioRenderer(
      worker,
      workspace,
      audioCapabilities,
      modelLifetime.signal,
    );
    preparedAudio = new PreparedAudioStore({
      catalog,
      assets,
      projects,
      jobs: queue,
      renderer: audioRenderer,
      probe,
      staging: join(library, "staging", "prepared-audio"),
    });
    await preparedAudio.recover();
    mediaAudio = new MediaAudioInspection({
      assets,
      acquisitions,
      jobs: queue,
      cache,
      project: { projects, renderer: audioRenderer, prepared: preparedAudio },
      sourceRenderer: {
        implementationId: "native-source-audio-v5",
        render: async (request, signal) =>
          withRenderedFile(
            worker,
            { attemptParent: workspace, output: request.output, filename: "audio.wav" },
            signal,
            async (output, execute) =>
              nativeResult(
                await execute(
                  "media.sourceAudio",
                  { ...request, output },
                  {
                    signal,
                    timeoutMs: renderWindowDeadlineMs(request.range),
                  },
                ),
              ),
          ),
      },
    });
    extractedAudio = new AudioExtraction({
      assets,
      acquisitions,
      projects,
      audio: mediaAudio,
      jobs: queue,
      probe,
      staging: join(library, "staging", "audio-extract"),
      converter: {
        implementationId: "native-finite-pcm-v1",
        convert: async ({ input, ...request }, signal) =>
          withRenderedFile(
            worker,
            { attemptParent: workspace, output: request.output, filename: "audio.wav" },
            signal,
            async (output, execute) =>
              nativeResult(
                await execute(
                  "media.convertSelectedAudio",
                  { ...request, output },
                  {
                    signal,
                    timeoutMs: renderWindowDeadlineMs({
                      startUs: 0,
                      endUs: Math.ceil((input.frames * 1000000) / input.sampleRate),
                    }),
                  },
                ),
              ),
          ),
      },
    });
    await extractedAudio.recover();
    generatedVoice = new VoiceGenerationJobs({
      assets,
      jobs: queue,
      models,
      probe,
      staging: join(library, "staging", "voice-generation"),
      generate: (modelId, request, signal) =>
        voiceRenderer(worker, models, modelId, workspace)(request, signal),
    });
    await generatedVoice.recover();
    acoustics = new AcousticInspection({
      audio: mediaAudio,
      jobs: queue,
      cache,
      renderer: {
        implementationId: "native-acoustic-image-v1",
        render: async (request, signal) =>
          withRenderedFile(
            worker,
            { attemptParent: workspace, output: request.output, filename: "frame.png" },
            signal,
            async (output, execute) => {
              const bytes = Buffer.from(JSON.stringify({ ...request, output }));
              if (bytes.length > 16 * 1024 * 1024)
                throw new CatalogError("LIMIT_EXCEEDED", "Acoustic measurements exceed 16 MiB");
              const input = output + ".json";
              await writeFile(input, bytes, { flag: "wx", signal });
              return nativeResult(await execute("media.acousticImage", { input }, { signal }));
            },
          ),
      },
    });
    scenes = new SceneProcessing({
      jobs: queue,
      evidence: sceneRecords,
      asset: {
        assets,
        acquisitions,
        implementationId: "native-source-scenes-v4",
        retained: (assetId, generation) =>
          indexes?.retainsSourceScenes(assetId, generation) ?? false,
        sample: async (request, signal) =>
          nativeResult(
            await worker("media.sourceVisualSamples", request, { signal }),
          ) as SourceVisualObservations,
      },
    });
    const sourceEvents = new SourceEvents({
      assets,
      acquisitions,
      capture,
      scenes: new SourceSceneRead({
        assets,
        acquisitions,
        processing: scenes,
        records: sceneRecords,
      }),
    });
    projectEvidence = new ProjectEvidenceInspection({
      projects,
      assets,
      jobs: queue,
      cache,
      transcripts,
      records: transcriptStore,
      events: sourceEvents,
    });
    preview = new ProjectPreviewInspection(
      projects,
      assets,
      queue,
      cache,
      projectMovieRenderer(
        worker,
        workspace,
        { preparation: pointers, evidence },
        audioCapabilities,
        modelLifetime.signal,
      ),
      preparedAudio,
    );
    const projectPictures = projectFrameRenderer(worker, workspace, {
      preparation: pointers,
      evidence,
    });
    mediaFrames = new MediaFrameInspection({
      assets,
      acquisitions,
      jobs: queue,
      cache,
      project: { projects, renderer: projectPictures },
      imageRenderer: {
        implementationId: "native-source-image-v1",
        render: async (request, signal) =>
          withRenderedFile(
            worker,
            { attemptParent: workspace, output: request.output, filename: "frame.png" },
            signal,
            async (output, execute) =>
              nativeResult(await execute("media.sourceImage", { ...request, output }, { signal })),
          ),
      },
      sourceRenderer: {
        implementationId: "native-source-picture-v5",
        render: async (request, signal) =>
          withRenderedFile(
            worker,
            { attemptParent: workspace, output: request.output, filename: "frame.png" },
            signal,
            async (output, execute) =>
              nativeResult(await execute("media.sourceFrame", { ...request, output }, { signal })),
          ),
      },
    });
    const projectIndex = new ScreenshotIndexStore<ProjectIndexRecords>(
      catalog,
      library,
      projectIndexDomain(
        {
          composition: (identity) => projectComposition(projects, assets, identity),
          source: (selection) => selectSource(assets, acquisitions, selection),
          scenes: sceneRecords,
          isDeleting: (id) => projects.isDeleting(id),
        },
        projectPictures,
      ),
    );
    const sourceIndex = new ScreenshotIndexStore<SourceIndexRecords>(
      catalog,
      library,
      sourceIndexDomain(
        (selection) => selectSource(assets, acquisitions, selection),
        sceneRecords,
        mediaFrames,
      ),
    );
    await sourceIndex.recoverPending("asset", new AbortController().signal);
    await projectIndex.recoverPending("project", new AbortController().signal);
    indexes = new IndexProcessing({
      jobs: queue,
      project: {
        catalog,
        assets,
        acquisitions,
        projects,
        index: projectIndex,
        scenes,
        records: sceneRecords,
        frames: mediaFrames,
        cache,
      },
      asset: {
        catalog,
        assets,
        acquisitions,
        index: sourceIndex,
        scenes,
        records: sceneRecords,
        frames: mediaFrames,
        cache,
      },
    });
    const indexFrame = (
      input:
        | Parameters<IndexProcessing["frameProject"]>[0]
        | Parameters<IndexProcessing["frameSource"]>[0],
    ) =>
      "projectId" in input
        ? {
            ...indexes.frameProject(input),
            delivery: delivery.open({ kind: "project", id: input.projectId }, () =>
              indexes.openReadProject(input),
            ),
          }
        : {
            ...indexes.frameSource(input),
            delivery: delivery.open({ kind: "asset", id: input.assetId }, () =>
              indexes.openReadSource(input),
            ),
          };
    const frameDelivery = (status: ReturnType<MediaFrameInspection["request"]>) => ({
      ...status,
      delivery: status.published
        ? delivery.open(
            "projectId" in status
              ? { kind: "project", id: status.projectId }
              : { kind: "asset", id: status.assetId },
            () => cache.acquire(status.published!.frame.cacheId),
          )
        : null,
    });
    const projectPackages = new ProjectPackages({
      preparedAudio,
      acquisitions: acquisitionImports,
      sceneRecords,
      scenes,
      transcriptRecords: transcriptStore,
      transcripts,
      indexRecords: sourceIndex,
      indexes,
      directory: library,
      projects,
      assets,
      jobs: queue,
      worker,
      delivery,
      projectIndexRecords: projectIndex,
    });
    packages = projectPackages;
    const mediaExports = new MediaExports({
      catalog,
      jobs: queue,
      cache,
      worker,
      files,
      project: { store: projects, preview, audio: mediaAudio, package: projectPackages },
    });
    exports = mediaExports;
    const managedStorage = new ManagedStorage(null, cache, library, (signal) =>
      mediaExports.usage(undefined, signal),
    );
    storage = managedStorage;
    queue.startAdmission((job) => {
      if (job.target.kind === "project") {
        if (job.artifact === "audio-file") return mediaAudio.admitExport(job);
        if (job.artifact === "preview") return preview.admit(job);
        if (job.artifact === "frame") return mediaFrames.admit(job);
        if (job.artifact === "screenshot-index") return indexes.admitProject(job);
      }
      return mediaExports.admit(job);
    });
    await transcripts.cleanup(modelLifetime.signal);
    await scenes.cleanup(modelLifetime.signal);
    await indexes.cleanup(modelLifetime.signal);
    const projectDeletion = new ProjectDeletion(
      projects,
      queue,
      cache,
      files,
      delivery,
      mediaExports,
      projectIndex,
    );
    deletion = projectDeletion;
    await projectDeletion.resume((error) => console.error(error));
    const status = (jobId: string) => queue.inspect(jobId);
    const describeCapture = captureSources.describe.bind(captureSources);
    const handle: LocalHandler = async (request): Promise<OperationResult> => {
      if (closing) return operationError("SERVICE_STOPPED", "Service is closing", true);
      if (!operationNames.has(request.operation))
        return operationError("UNKNOWN_OPERATION", "Unknown service operation");
      const parsed = operationSchema.safeParse({
        operation: request.operation,
        params: request.params,
      });
      if (!parsed.success)
        return operationError("INVALID_PARAMS", "Parameters do not match the operation schema");
      const operation = parsed.data;
      try {
        switch (operation.operation) {
          case "service.health":
            return {
              ok: true,
              data: {
                status: "ready",
                pid: process.pid,
                socketPath: serviceSocketPath(runtime),
                home: options.home,
                node: process.versions.node,
                uptimeMs: Math.round(performance.now() - started),
              },
            };
          case "recording.delete":
            return {
              ok: true,
              data: await recordingDeletion!.delete(operation.params.recordingId),
            };
          case "recording.cleanup":
            return { ok: true, data: captureCleanup.request(operation.params.recordingId) };
          case "capture.sources":
            return { ok: true, data: await requireCaptureControl().sources() };
          case "capture.status": {
            const status = await requireCaptureControl().status();
            return {
              ok: true,
              data: {
                ...status,
                recording: status.recording ? describeCapture(status.recording) : null,
              },
            };
          }
          case "capture.start":
            return {
              ok: true,
              data: describeCapture(await requireCaptureControl().start(operation.params)),
            };
          case "capture.restart":
            return {
              ok: true,
              data: describeCapture(await requireCaptureControl().restart(operation.params)),
            };
          case "capture.pause":
            return {
              ok: true,
              data: describeCapture(
                await requireCaptureControl().pause(operation.params.recordingId),
              ),
            };
          case "capture.resume":
            return {
              ok: true,
              data: describeCapture(
                await requireCaptureControl().resume(operation.params.recordingId),
              ),
            };
          case "capture.stop":
            return {
              ok: true,
              data: describeCapture(
                await requireCaptureControl().stop(operation.params.recordingId),
              ),
            };
          case "capture.cancel":
            return {
              ok: true,
              data: describeCapture(
                await requireCaptureControl().cancel(operation.params.recordingId),
              ),
            };
          case "recording.get":
            return { ok: true, data: describeCapture(captures.get(operation.params.recordingId)) };
          case "recording.list": {
            const page = captures.list(operation.params.cursor, operation.params.limit);
            return {
              ok: true,
              data: { ...page, recordings: page.recordings.map(describeCapture) },
            };
          }
          case "recording.latest": {
            const recording = captures.latest();
            return { ok: true, data: recording ? describeCapture(recording) : null };
          }
          case "index.get": {
            const params = operation.params;
            if ("projectId" in params) return { ok: true, data: indexes.getProject(params) };
            if (!("assetId" in params))
              return operationError(
                "NOT_READY",
                "This service reads project and selected asset indexes",
              );
            return { ok: true, data: indexes.getSource(params) };
          }
          case "index.retry": {
            const params = operation.params;
            if ("projectId" in params) return { ok: true, data: indexes.retryProject(params) };
            if (!("assetId" in params))
              return operationError(
                "NOT_READY",
                "This service reads project and selected asset indexes",
              );
            return { ok: true, data: indexes.retrySource(params) };
          }
          case "index.coverage": {
            const params = operation.params;
            if ("projectId" in params) return { ok: true, data: indexes.coverageProject(params) };
            if (!("assetId" in params))
              return operationError(
                "NOT_READY",
                "This service reads project and selected asset indexes",
              );
            return { ok: true, data: indexes.coverageSource(params) };
          }
          case "index.frame": {
            const params = operation.params;
            if (!("assetId" in params) && !("projectId" in params))
              return operationError(
                "NOT_READY",
                "This service reads project and selected asset indexes",
              );
            return {
              ok: true,
              data: indexFrame(params),
            };
          }
          case "index.frames": {
            const params = operation.params;
            if (!("assetId" in params) && !("projectId" in params))
              return operationError(
                "NOT_READY",
                "This service reads project and selected asset indexes",
              );
            const { ordinals, ...reference } = params;
            return {
              ok: true,
              data: {
                ...reference,
                items: ordinals.map((ordinal) => {
                  try {
                    const input = { ...reference, ordinal };
                    return {
                      ordinal,
                      ok: true as const,
                      data: indexFrame(input),
                    };
                  } catch (error) {
                    return { ordinal, ...operationFailure(error) };
                  }
                }),
              },
            };
          }
          case "model.list":
            return { ok: true, data: models.list() };
          case "model.status":
            return { ok: true, data: await models.status(operation.params.modelId) };
          case "model.prepare": {
            const { modelId } = operation.params;
            const state = await models.status(modelId);
            if (state.state !== "ready" && state.state !== "preparing") {
              const preparing = models
                .prepare(modelId, modelLifetime.signal, operation.params)
                .then(() => {
                  transcripts.resume();
                })
                .catch((error) => {
                  if (!modelLifetime.signal.aborted) console.error(error);
                });
              modelPreparations.add(preparing);
              void preparing.finally(() => modelPreparations.delete(preparing));
            }
            return { ok: true, data: await models.status(modelId) };
          }
          case "transcript.retry":
            return {
              ok: true,
              data:
                "projectId" in operation.params
                  ? projectEvidence.retry(operation.params)
                  : transcripts.retrySource(operation.params),
            };
          case "transcript.get":
          case "transcript.search": {
            const params = operation.params;
            if ("projectId" in params)
              return {
                ok: true,
                data:
                  "text" in params
                    ? await projectEvidence.search(params)
                    : await projectEvidence.get(params),
              };
            if (!("assetId" in params))
              return operationError("NOT_READY", "This service reads selected asset transcripts");
            const selection = {
              assetId: params.assetId,
              streamId: params.streamId,
              ...(params.acquisitionId === undefined
                ? {}
                : { acquisitionId: params.acquisitionId }),
            };
            const current = transcripts.publishedSource(selection);
            if (!current.published) {
              if (params.cursor)
                throw new CatalogError(
                  "ARTIFACT_CHANGED",
                  "Transcript generation is no longer published",
                );
              return { ok: true, data: { ...current, page: null } };
            }
            const metadata = current.published.transcript;
            const read = new SourceTranscriptRead(transcriptStore, metadata);
            const page = "text" in params ? read.search(params) : read.page(params);
            return {
              ok: true,
              data: {
                ...selection,
                state: "ready",
                generation: metadata.generation,
                page: { transcript: metadata, ...page },
              },
            };
          }
          case "timeline.events":
          case "cursor.raw": {
            const params = operation.params;
            const method = operation.operation === "timeline.events" ? "events" : "cursor";
            if ("projectId" in params)
              return { ok: true, data: await projectEvidence[method](params) };
            if ("assetId" in params)
              return {
                ok: true,
                data: method === "events" ? sourceEvents.events(params) : capture.cursor(params),
              };
            return operationError(
              "NOT_READY",
              "This service inspects asset and project capture evidence",
            );
          }
          case "frame.get":
          case "frame.retry": {
            const params = operation.params;
            if (!("projectId" in params) && !("assetId" in params))
              return operationError(
                "NOT_READY",
                "This service renders source and project pictures",
              );
            return {
              ok: true,
              data: frameDelivery(
                mediaFrames[operation.operation === "frame.get" ? "request" : "retry"](params),
              ),
            };
          }
          case "frame.batch": {
            const params = operation.params;
            if (!("projectId" in params) && !("assetId" in params))
              return operationError(
                "NOT_READY",
                "This service renders source and project pictures",
              );
            const identity =
              "projectId" in params
                ? {
                    projectId: params.projectId,
                    revisionId: projects.revision(params.projectId, params.revisionId).id,
                  }
                : {
                    assetId: params.assetId,
                    streamId: params.streamId,
                    ...(params.acquisitionId === undefined
                      ? {}
                      : { acquisitionId: params.acquisitionId }),
                  };
            return {
              ok: true,
              data: {
                ...identity,
                items: params.atUs.map((atUs) => {
                  try {
                    return {
                      atUs,
                      ok: true,
                      data: frameDelivery(
                        mediaFrames.request({
                          ...params,
                          ...identity,
                          atUs,
                        }),
                      ),
                    };
                  } catch (error) {
                    return { atUs, ...operationFailure(error) };
                  }
                }),
              },
            };
          }
          case "waveform.get":
          case "waveform.retry":
          case "spectrogram.get":
          case "spectrogram.retry": {
            const spectrum = operation.operation.startsWith("spectrogram.");
            const status = await acoustics[
              operation.operation.endsWith(".get") ? "request" : "retry"
            ](
              spectrum
                ? { ...operation.params, kind: "spectrum", format: "image" }
                : operation.params,
            );
            return {
              ok: true,
              data: {
                ...status,
                published: status.published
                  ? {
                      generation: status.published.generation,
                      [spectrum ? "spectrogram" : "waveform"]: status.published.artifact,
                    }
                  : null,
                delivery: status.published
                  ? delivery.open(
                      "projectId" in status
                        ? { kind: "project", id: status.projectId }
                        : { kind: "asset", id: status.assetId },
                      () => cache.acquire(status.published!.artifact.cacheId),
                    )
                  : null,
              },
            };
          }
          case "voice.generate": {
            const status = await generatedVoice.request(operation.params);
            return {
              ok: true,
              data: {
                ...operation.params,
                ...status,
                published: status.published
                  ? {
                      generation: status.published.generation,
                      audio: JSON.parse(status.published.result),
                    }
                  : null,
              },
            };
          }
          case "audio.extract": {
            const status = extractedAudio.request(operation.params);
            return {
              ok: true,
              data: {
                ...operation.params,
                ...status,
                published: status.published
                  ? {
                      generation: status.published.generation,
                      excerpt: JSON.parse(status.published.result),
                    }
                  : null,
              },
            };
          }
          case "audio.prepare": {
            const prepared = await preparedAudio.request(operation.params);
            return {
              ok: true,
              data: {
                ...operation.params,
                ...prepared,
                published: prepared.published
                  ? {
                      generation: prepared.published.generation,
                      audio: JSON.parse(prepared.published.result),
                    }
                  : null,
              },
            };
          }
          case "audio.get":
          case "audio.retry": {
            const params = operation.params;
            if (!("assetId" in params) && !("projectId" in params))
              return operationError("NOT_READY", "This service extracts asset and project audio");
            const status =
              await mediaAudio[operation.operation === "audio.get" ? "request" : "retry"](params);
            return {
              ok: true,
              data: {
                ...status,
                delivery: status.published
                  ? delivery.open(
                      "assetId" in params
                        ? { kind: "asset", id: params.assetId }
                        : { kind: "project", id: params.projectId },
                      () => cache.acquire(status.published!.audio.cacheId),
                    )
                  : null,
              },
            };
          }
          case "storage.usage":
            if (operation.params.recordingId !== undefined)
              return operationError(
                "NOT_READY",
                "This service measures aggregate project-library storage",
              );
            return { ok: true, data: await managedStorage.usage() };
          case "project.create":
            return {
              ok: true,
              data: projects.create({
                requestId: operation.params.requestId,
                canvas: operation.params.canvas,
                ...(operation.params.title === undefined ? {} : { title: operation.params.title }),
              }),
            };
          case "project.delete":
            return { ok: true, data: await projectDeletion.delete(operation.params.projectId) };
          case "project.get":
            return { ok: true, data: projects.get(operation.params.projectId) };
          case "project.list":
            return {
              ok: true,
              data: projects.list({
                ...operation.params.cursor,
                ...(operation.params.limit === undefined ? {} : { limit: operation.params.limit }),
              }),
            };
          case "text.seed":
            return {
              ok: true,
              data: projects.seedText(operation.params.projectId, operation.params),
            };
          case "edit.apply":
            return { ok: true, data: projects.apply(operation.params.projectId, operation.params) };
          case "processing.get":
            return {
              ok: true,
              data: projects.processing(
                operation.params.projectId,
                operation.params.revisionId,
                operation.params.target,
              ),
            };
          case "output.capabilities":
            if (operation.params.kind === "audio")
              return { ok: true, data: audioOutputCapabilities };
            return {
              ok: true,
              data: outputCapabilities(
                nativeResult(await worker("media.outputCapabilities", {})) as Record<
                  string,
                  unknown
                >,
              ),
            };
          case "processing.capabilities":
            return { ok: true, data: preview.capabilities() };
          case "revision.get":
            if (!("projectId" in operation.params))
              return operationError("NOT_READY", "This service reads managed project revisions");
            return {
              ok: true,
              data: {
                projectId: operation.params.projectId,
                revision: projects.revision(
                  operation.params.projectId,
                  operation.params.revisionId,
                ),
              },
            };
          case "revision.history":
            if (!("projectId" in operation.params))
              return operationError("NOT_READY", "This service reads managed project history");
            return {
              ok: true,
              data: projects.history(
                operation.params.projectId,
                operation.params.cursor,
                operation.params.limit,
              ),
            };
          case "edit.undo":
            if (!("projectId" in operation.params))
              return operationError("NOT_READY", "This service edits managed projects");
            return { ok: true, data: projects.undo(operation.params.projectId, operation.params) };
          case "edit.restore":
            if (!("projectId" in operation.params))
              return operationError("NOT_READY", "This service edits managed projects");
            return {
              ok: true,
              data: projects.restore(operation.params.projectId, operation.params),
            };
          case "acquisition.import": {
            const prepared = await acquisitionImports.prepareImport(
              operation.params.requestId,
              operation.params.path,
            );
            if (closing) throw new CatalogError("SERVICE_STOPPED", "Service is closing", {}, true);
            const job = queue.submit(() => {
              const intent = acquisitions.admitImport(prepared);
              return {
                target: { kind: "acquisition", acquisitionId: intent.acquisitionId },
                artifact: "acquisition.import",
                lane: "heavy",
                input: JSON.stringify(intent.files),
              };
            });
            return { ok: true, data: status(job.jobId) };
          }
          case "acquisition.get":
            return { ok: true, data: acquisitions.get(operation.params.acquisitionId) };
          case "asset.import": {
            const prepared = await assets.prepareImport(
              operation.params.requestId,
              operation.params.path,
            );
            if (closing) throw new CatalogError("SERVICE_STOPPED", "Service is closing", {}, true);
            const job = queue.submit(() => {
              const intent = assets.admitImport(prepared);
              return {
                target: { kind: "import", importId: intent.importId },
                artifact: "asset.import",
                lane: "heavy",
                input: JSON.stringify(intent.source),
              };
            });
            return { ok: true, data: status(job.jobId) };
          }
          case "asset.get":
            return { ok: true, data: assets.describe(operation.params.assetId) };
          case "asset.segments":
            return {
              ok: true,
              data: assets.segments(operation.params.assetId, operation.params.streamId, {
                ...(operation.params.cursor ? { cursor: operation.params.cursor } : {}),
                ...(operation.params.limit === undefined ? {} : { limit: operation.params.limit }),
              }),
            };
          case "asset.origins":
            return {
              ok: true,
              data: assets.origins(operation.params.assetId, {
                ...operation.params.cursor,
                ...(operation.params.limit === undefined ? {} : { limit: operation.params.limit }),
              }),
            };
          case "asset.list":
            return {
              ok: true,
              data: assets.list({
                ...operation.params.cursor,
                ...(operation.params.limit === undefined ? {} : { limit: operation.params.limit }),
              }),
            };
          case "preview.get":
          case "preview.retry": {
            const params = operation.params;
            if (!("projectId" in params))
              return operationError("NOT_READY", "This service previews managed projects");
            const status =
              await preview[operation.operation === "preview.get" ? "request" : "retry"](params);
            return {
              ok: true,
              data: {
                ...status,
                delivery: status.published
                  ? delivery.open({ kind: "project", id: params.projectId }, () =>
                      cache.acquire(status.published!.preview.cacheId),
                    )
                  : null,
              },
            };
          }
          case "package.open":
            return { ok: true, data: await projectPackages.open(operation.params.path) };
          case "package.status":
            return { ok: true, data: projectPackages.status(operation.params.admissionId) };
          case "package.close":
            return {
              ok: true,
              data: await projectPackages.closeAdmission(operation.params.admissionId),
            };
          case "package.adopt":
            return {
              ok: true,
              data: projectPackages.adopt(
                operation.params.packageHandle,
                operation.params.requestId,
              ),
            };
          case "export.create":
            return { ok: true, data: await mediaExports.create(operation.params) };
          case "export.list":
            return { ok: true, data: mediaExports.list(operation.params) };
          case "export.status":
            return { ok: true, data: mediaExports.status(operation.params.exportId) };
          case "export.retry":
            return { ok: true, data: await mediaExports.retry(operation.params.exportId) };
          case "export.recover":
            return { ok: true, data: await mediaExports.recover(operation.params.exportId) };
          case "export.cancel":
            mediaExports.cancel(operation.params.exportId);
            return { ok: true, data: mediaExports.status(operation.params.exportId) };
          case "export.abandon":
            await mediaExports.abandon(operation.params.exportId);
            return { ok: true, data: { exportId: operation.params.exportId, abandoned: true } };
          case "artifact.read":
            return {
              ok: true,
              data: delivery.read(
                operation.params.token,
                operation.params.offset,
                operation.params.maxBytes,
              ),
            };
          case "artifact.renew":
            return { ok: true, data: delivery.renew(operation.params.token) };
          case "artifact.close":
            delivery.close(operation.params.token);
            return { ok: true, data: { closed: true } };
          case "job.get":
            return { ok: true, data: status(operation.params.jobId) };
          case "job.retry":
            queue.retry(operation.params.jobId);
            return { ok: true, data: status(operation.params.jobId) };
          case "job.cancel":
            await queue.drainJob(operation.params.jobId);
            return { ok: true, data: status(operation.params.jobId) };
          default:
            return operationError("NOT_READY", "Operation is not available in the project service");
        }
      } catch (error) {
        return operationFailure(error);
      }
    };
    const serve: LocalHandler = (request, signal) => {
      const task = Promise.resolve(handle(request, signal));
      pending.add(task);
      void task.then(
        () => pending.delete(task),
        () => pending.delete(task),
      );
      return task;
    };
    function requireCaptureControl(): CaptureService {
      if (!controller) throw new CatalogError("NOT_READY", "No capture controller is connected");
      return captureCoordinator;
    }
    const captureCoordinator = new CaptureService(
      captures,
      library,
      (operation, params) =>
        controller
          ? controller.call(operation, params)
          : Promise.resolve(operationError("NOT_READY", "No capture controller is connected")),
      worker,
      console.error,
      () => {
        try {
          resumeCaptureSources();
        } finally {
          queue.schedule();
        }
      },
      captureSources,
    );
    captureControl = captureCoordinator;
    recordingDeletion = new RecordingDeletion({
      store: captures,
      jobs: queue,
      capture: captureCoordinator,
      delivery,
      files,
      sources: captureSources,
    });
    listenerStarting = listenLocal({ runtimeDirectory: runtime, handler: serve });
    if (options.control)
      controller = openControl({
        ...options.control,
        dispatch: async (request) => {
          if (closing) return operationError("SERVICE_STOPPED", "Service is closing", true);
          if (request.operation !== "capture.report") return serve(request, modelLifetime.signal);
          const report = captureReportSchema.safeParse(request.params);
          if (!report.success) return operationError("INVALID_PARAMS", "Invalid capture report");
          try {
            return { ok: true, data: describeCapture(captureCoordinator.report(report.data)) };
          } catch (error) {
            return operationFailure(error);
          }
        },
        onEnd: () => {
          void close();
        },
      });
    reconciliation = closing
      ? Promise.resolve()
      : (async () => {
          await recordingDeletion!.resume((error) => console.error(error));
          queue.start();
          await captureCoordinator.reconcileStranded();
        })();
    const listener = await listenerStarting;
    if (closing) {
      await close();
      throw new CatalogError(
        "SERVICE_STOPPED",
        "Capture controller closed during startup",
        {},
        true,
      );
    }
    controller?.emit({ event: "started", pid: process.pid, socketPath: listener.socketPath });
    void reconciliation
      .then(() => {
        if (closing) return;
        resumeCaptureSources();
        for (const error of mediaExports.resumeRecovery()) console.error(error);
      })
      .catch(console.error);
    return { socketPath: listener.socketPath, assets, close };
  } catch (error) {
    await close();
    throw error;
  }
}
