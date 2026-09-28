import { CompositionError } from "@screenrec/composition";
import type { LibraryTimelineInspection } from "./timeline-inspection.js";
import type { PackageFrameInspection } from "./package-frames.js";
import type { MediaExports } from "./exports.js";
import type { PackageInspection } from "./packages.js";
import type { RecordingStorage } from "@screenrec/core/storage";
import type { RecordingDeletion } from "./deletion.js";
import type { IndexProcessing } from "@screenrec/core/index-processing";
import type { DerivedCache } from "@screenrec/core/cache";
import type { PreviewInspection } from "@screenrec/core/preview";
import type { LibraryAudioInspection } from "@screenrec/core/audio";
import type { LibraryFrameInspection } from "@screenrec/core/frames";
import type { DerivativeDelivery } from "./delivery.js";
import type { SceneProcessing } from "@screenrec/core/scene-processing";
import type { SourceProcessing } from "@screenrec/core/processing";
import type { SpeechModelStatus } from "@screenrec/core/speech-models";
import type { TranscriptProcessing } from "@screenrec/core/transcript-processing";
import { TimelineError } from "@screenrec/core/timeline";
import { type RevisionStore } from "@screenrec/core/library";
import { CatalogError } from "@screenrec/core/catalog";
import {
  operationError,
  operationNames,
  operationSchema,
  type OperationFailure,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";
import type { CaptureService } from "./capture.js";

export type OperationContext = {
  exports: MediaExports;
  packages: PackageInspection;
  deletion: RecordingDeletion;
  index: IndexProcessing;
  storage: RecordingStorage;
  store: RevisionStore;
  capture: CaptureService;
  health: () => unknown;
  processing: SourceProcessing;
  timeline: LibraryTimelineInspection;
  frames: LibraryFrameInspection;
  audio: LibraryAudioInspection;
  preview: PreviewInspection;
  delivery: DerivativeDelivery;
  scenes: SceneProcessing;
  transcripts: TranscriptProcessing;
  models: { status(): SpeechModelStatus; prepare(): SpeechModelStatus };
  cache: DerivedCache;
};

function indexReader(
  reference: { revisionId: string; generation: string } & (
    | { recordingId: string }
    | { packageHandle: string }
  ),
  index: IndexProcessing,
  packages: PackageInspection,
) {
  if ("packageHandle" in reference) {
    const reader = packages.index(reference);
    return {
      owner: { kind: "package" as const, id: reference.packageHandle },
      frame: (ordinal: number) => reader.frame(ordinal),
      openRead: (ordinal: number) => reader.openRead(ordinal),
    };
  }
  index.published(reference);
  return {
    owner: { kind: "recording" as const, id: reference.recordingId },
    frame: (ordinal: number) => index.frame({ ...reference, ordinal }),
    openRead: (ordinal: number) => index.openRead({ ...reference, ordinal }),
  };
}

function frameDelivery(
  data:
    | ReturnType<LibraryFrameInspection["request"]>
    | ReturnType<PackageFrameInspection["request"]>,
  delivery: DerivativeDelivery,
  cache: DerivedCache,
  packages: PackageInspection,
) {
  if (!data.published) return { ...data, delivery: null };
  if ("packageHandle" in data) {
    const frame = data.published.frame;
    return {
      ...data,
      delivery: delivery.open({ kind: "package", id: data.packageHandle }, () =>
        packages.frames(data.packageHandle).openRead(frame),
      ),
    };
  }
  const frame = data.published.frame;
  return {
    ...data,
    delivery: delivery.open({ kind: "recording", id: data.recordingId }, () =>
      cache.acquire(frame.cacheId),
    ),
  };
}

/** The service composes owners; edit algebra and every catalog transaction stay in core. */
export async function operate(
  request: OperationRequest,
  {
    store,
    packages,
    exports,
    deletion,
    capture,
    health,
    processing,
    timeline,
    frames,
    audio,
    preview,
    delivery,
    scenes,
    transcripts,
    models,
    cache,
    index,
    storage,
  }: OperationContext,
  signal: AbortSignal,
): Promise<OperationResult> {
  if (!operationNames.has(request.operation))
    return operationError(
      "UNKNOWN_OPERATION",
      `Unknown service operation: ${request.operation.slice(0, 120)}`,
    );
  const parsed = operationSchema.safeParse({
    operation: request.operation,
    params: request.params,
  });
  if (!parsed.success)
    return operationError("INVALID_PARAMS", "Parameters do not match the operation schema.");
  const operation = parsed.data;
  try {
    switch (operation.operation) {
      case "project.delete":
      case "project.create":
      case "project.get":
      case "project.list":
      case "edit.apply":
      case "processing.get":
      case "processing.capabilities":
      case "transcript.retry":
      case "acquisition.import":
      case "acquisition.get":
      case "asset.import":
      case "asset.get":
      case "asset.origins":
      case "asset.list":
      case "job.get":
      case "job.retry":
      case "job.cancel":
        return operationError(
          "NOT_READY",
          "Project operations require the isolated project service until production cutover",
        );
      case "export.create":
        return { ok: true, data: await exports.create(operation.params) };
      case "export.list":
        return { ok: true, data: exports.list(operation.params) };
      case "export.status":
        return { ok: true, data: exports.status(operation.params.exportId) };
      case "export.retry":
        return { ok: true, data: await exports.retry(operation.params.exportId) };
      case "export.recover":
        return { ok: true, data: await exports.recover(operation.params.exportId) };
      case "export.cancel":
        exports.cancel(operation.params.exportId);
        return { ok: true, data: exports.status(operation.params.exportId) };
      case "export.abandon":
        await exports.abandon(operation.params.exportId);
        return { ok: true, data: { exportId: operation.params.exportId, abandoned: true } };
      case "package.open":
        return { ok: true, data: await packages.open(operation.params.path) };
      case "package.status":
        return { ok: true, data: packages.status(operation.params.admissionId) };
      case "package.close":
        return { ok: true, data: await packages.close(operation.params.admissionId) };
      case "storage.usage":
        return { ok: true, data: await storage.usage(operation.params.recordingId) };
      case "recording.delete":
        return { ok: true, data: await deletion.delete(operation.params.recordingId) };
      case "timeline.events":
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Asset and project capture evidence requires the project service until cutover",
          );
        return {
          ok: true,
          data: await ("packageHandle" in operation.params
            ? packages.timeline(operation.params.packageHandle).get(operation.params, signal)
            : timeline.get(operation.params, signal)),
        };
      case "index.get":
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Source and project screenshot indexes require the project service until cutover",
          );
        return {
          ok: true,
          data:
            "packageHandle" in operation.params
              ? packages.index(operation.params).get(operation.params)
              : index.get(operation.params),
        };
      case "index.retry":
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Source and project screenshot indexes require the project service until cutover",
          );
        return { ok: true, data: index.retry(operation.params) };
      case "index.coverage":
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Source and project screenshot indexes require the project service until cutover",
          );
        return {
          ok: true,
          data:
            "packageHandle" in operation.params
              ? packages.index(operation.params).coverage(operation.params)
              : index.coverage(operation.params),
        };
      case "index.frame": {
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Source and project screenshot indexes require the project service until cutover",
          );
        const { ordinal, ...reference } = operation.params;
        const read = indexReader(reference, index, packages);
        return {
          ok: true,
          data: {
            ...read.frame(ordinal),
            delivery: delivery.open(read.owner, () => read.openRead(ordinal)),
          },
        };
      }
      case "index.frames": {
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Source and project screenshot indexes require the project service until cutover",
          );
        const { ordinals, ...reference } = operation.params;
        const read = indexReader(reference, index, packages);
        return {
          ok: true,
          data: {
            ...reference,
            items: ordinals.map((ordinal) => {
              try {
                return {
                  ordinal,
                  ok: true as const,
                  data: {
                    ...read.frame(ordinal),
                    delivery: delivery.open(read.owner, () => read.openRead(ordinal)),
                  },
                };
              } catch (error) {
                return { ordinal, ...operationFailure(error) };
              }
            }),
          },
        };
      }
      case "frame.batch": {
        const params = operation.params;
        if ("projectId" in params || "assetId" in params)
          return operationError(
            "NOT_READY",
            "Source and project frames require the project service until cutover",
          );
        const batch =
          "packageHandle" in params
            ? packages.frames(params.packageHandle).batch(params)
            : frames.batch(params);
        return {
          ok: true,
          data: {
            ...batch,
            items: batch.items.map((item) => {
              if (!item.ok) return item;
              try {
                return {
                  ...item,
                  data: frameDelivery(item.data, delivery, cache, packages),
                };
              } catch (error) {
                return { atUs: item.atUs, ...operationFailure(error) };
              }
            }),
          },
        };
      }
      case "frame.get":
      case "frame.retry": {
        const params = operation.params;
        if ("projectId" in params || "assetId" in params)
          return operationError(
            "NOT_READY",
            "Source and project frames require the project service until cutover",
          );
        const method = operation.operation === "frame.get" ? "request" : "retry";
        const status =
          "packageHandle" in params
            ? packages.frames(params.packageHandle)[method](params)
            : frames[method](params);
        return { ok: true, data: frameDelivery(status, delivery, cache, packages) };
      }

      case "preview.get":
      case "preview.retry": {
        const params = operation.params;
        if ("projectId" in params)
          return operationError("NOT_READY", "Project previews require the project service");
        const method = operation.operation === "preview.get" ? "request" : "retry";
        // A package renders its own media into the same cache, so both answer the same way; only
        // whose lifetime holds the delivery open differs.
        if ("packageHandle" in params) {
          const inspector = packages.preview(params.packageHandle);
          const status = inspector[method](params);
          return {
            ok: true,
            data: {
              ...status,
              delivery: status.published
                ? delivery.open({ kind: "package", id: params.packageHandle }, () =>
                    inspector.openRead(status.published!.preview),
                  )
                : null,
            },
          };
        }
        const status = preview[method](params);
        return {
          ok: true,
          data: {
            ...status,
            delivery: status.published
              ? delivery.open({ kind: "recording", id: params.recordingId }, () =>
                  cache.acquire(status.published!.preview.cacheId),
                )
              : null,
          },
        };
      }
      case "audio.get":
      case "audio.retry": {
        const params = operation.params;
        if ("assetId" in params || "projectId" in params)
          return operationError(
            "NOT_READY",
            "Asset and project audio require the project service until cutover",
          );
        const method = operation.operation === "audio.get" ? "request" : "retry";
        if ("packageHandle" in params) {
          const inspector = packages.audio(params.packageHandle);
          const status = inspector[method](params);
          return {
            ok: true,
            data: {
              ...status,
              delivery: status.published
                ? delivery.open({ kind: "package", id: params.packageHandle }, () =>
                    inspector.openRead(status.published!.audio),
                  )
                : null,
            },
          };
        }
        const status = audio[method](params);
        return {
          ok: true,
          data: {
            ...status,
            delivery: status.published
              ? delivery.open({ kind: "recording", id: params.recordingId }, () =>
                  cache.acquire(status.published!.audio.cacheId),
                )
              : null,
          },
        };
      }
      case "artifact.read":
        return {
          ok: true,
          data: delivery.read(
            operation.params.token,
            operation.params.offset,
            operation.params.maxBytes,
          ),
        };
      case "waveform.get":
      case "waveform.retry":
      case "spectrogram.get":
      case "spectrogram.retry":
        return operationError(
          "NOT_READY",
          "Acoustic inspection requires the project service until cutover",
        );
      case "artifact.renew":
        return { ok: true, data: delivery.renew(operation.params.token) };
      case "artifact.close":
        delivery.close(operation.params.token);
        return { ok: true, data: { closed: true } };
      case "cursor.raw": {
        const params = operation.params;
        if ("assetId" in params || "projectId" in params)
          return operationError(
            "NOT_READY",
            "Asset and project capture evidence requires the project service until cutover",
          );
        return {
          ok: true,
          data:
            "packageHandle" in params ? packages.rawCursor(params) : processing.rawCursor(params),
        };
      }
      case "processing.status":
      case "processing.retry": {
        const method = operation.operation === "processing.status" ? "status" : "retry";
        const owner = { source: processing, scenes, transcript: transcripts }[
          operation.params.artifact
        ];
        return { ok: true, data: owner[method](operation.params.recordingId) };
      }
      case "transcript.get":
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Asset and project transcripts require the project service until cutover",
          );
        return {
          ok: true,
          data:
            "packageHandle" in operation.params
              ? packages.transcript(operation.params.packageHandle).get(operation.params)
              : transcripts.get(operation.params),
        };
      case "transcript.search":
        if ("assetId" in operation.params || "projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Asset and project transcripts require the project service until cutover",
          );
        return {
          ok: true,
          data:
            "packageHandle" in operation.params
              ? packages.transcript(operation.params.packageHandle).search(operation.params)
              : transcripts.search(operation.params),
        };
      case "model.status":
        return { ok: true, data: models.status() };
      case "model.prepare":
        return { ok: true, data: models.prepare() };
      case "service.health":
        return { ok: true, data: health() };
      case "capture.sources":
        return { ok: true, data: await capture.sources() };
      case "capture.status":
        return { ok: true, data: await capture.status() };
      case "capture.start":
        return { ok: true, data: await capture.start(operation.params) };
      case "capture.restart":
        return { ok: true, data: await capture.restart(operation.params) };
      case "capture.pause":
        return { ok: true, data: await capture.pause(operation.params.recordingId) };
      case "capture.resume":
        return { ok: true, data: await capture.resume(operation.params.recordingId) };
      case "capture.stop":
        return { ok: true, data: await capture.stop(operation.params.recordingId) };
      case "capture.cancel":
        return { ok: true, data: await capture.cancel(operation.params.recordingId) };
      case "recording.latest":
        return { ok: true, data: store.latest() };
      case "recording.list":
        return { ok: true, data: store.list(operation.params.cursor, operation.params.limit) };
      case "recording.get":
        return { ok: true, data: store.get(operation.params.recordingId) };
      case "revision.get":
        if ("projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Project revisions require the isolated project service until cutover",
          );
        if ("packageHandle" in operation.params)
          return { ok: true, data: packages.revision(operation.params) };
        return {
          ok: true,
          data: {
            recordingId: operation.params.recordingId,
            revision: store.revision(operation.params.recordingId, operation.params.revisionId),
          },
        };
      case "revision.history":
        if ("projectId" in operation.params)
          return operationError(
            "NOT_READY",
            "Project history requires the isolated project service until cutover",
          );
        if ("packageHandle" in operation.params)
          return {
            ok: true,
            data: packages.history(operation.params),
          };
        return {
          ok: true,
          data: {
            recordingId: operation.params.recordingId,
            ...store.history(
              operation.params.recordingId,
              operation.params.cursor,
              operation.params.limit,
            ),
          },
        };
      case "edit.trim":
      case "edit.cut":
      case "edit.undo":
      case "edit.restore": {
        const params = operation.params;
        if ("projectId" in params)
          return operationError(
            "NOT_READY",
            "Project edits require the isolated project service until cutover",
          );
        const identity = {
          requestId: params.requestId,
          expectedRevisionId: params.expectedRevisionId,
        };
        const edit =
          operation.operation === "edit.trim"
            ? { ...identity, operation: "trim" as const, range: operation.params.range }
            : operation.operation === "edit.cut"
              ? { ...identity, operation: "cut" as const, ranges: operation.params.ranges }
              : operation.operation === "edit.restore"
                ? {
                    ...identity,
                    operation: "restore" as const,
                    targetRevisionId: operation.params.targetRevisionId,
                  }
                : { ...identity, operation: "undo" as const };
        return {
          ok: true,
          data: { recordingId: params.recordingId, revision: store.edit(params.recordingId, edit) },
        };
      }
    }
  } catch (error) {
    return operationFailure(error);
  }
}

/**
 * Turns an owner's refusal into the shared error envelope. Owners state the code, retryability and
 * details; anything else is an unexpected failure whose message stays inside the service.
 */
export function operationFailure(error: unknown): OperationFailure {
  if (error instanceof CatalogError)
    return operationError(error.code, error.message, error.retryable, error.details);
  if (error instanceof CompositionError)
    return operationError(error.code, error.message, false, error.details);
  if (error instanceof TimelineError) return operationError("INVALID_RANGE", error.message);
  return operationError("INTERNAL_ERROR", "Service handler failed");
}
