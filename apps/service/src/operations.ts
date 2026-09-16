import type { SourceProcessing } from "@screenrec/core/processing";
import { TimelineError } from "@screenrec/core/timeline";
import { CatalogError, type RevisionStore } from "@screenrec/core/library";
import {
  operationNames,
  operationSchema,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";
import { CaptureError, type CaptureService } from "./capture.js";

function failure(code: string, message: string): OperationResult {
  return { ok: false, error: { code, message, retryable: false, details: {} } };
}

/** The service composes owners; edit algebra and every catalog transaction stay in core. */
export async function operate(
  request: OperationRequest,
  store: RevisionStore,
  capture: CaptureService,
  health: () => unknown,
  processing: SourceProcessing,
): Promise<OperationResult> {
  if (!operationNames.has(request.operation))
    return failure(
      "UNKNOWN_OPERATION",
      `Unknown service operation: ${request.operation.slice(0, 120)}`,
    );
  const parsed = operationSchema.safeParse({
    operation: request.operation,
    params: request.params,
  });
  if (!parsed.success)
    return failure("INVALID_PARAMS", "Parameters do not match the operation schema.");
  const operation = parsed.data;
  try {
    switch (operation.operation) {
      case "cursor.raw":
        return { ok: true, data: processing.rawCursor(operation.params) };
      case "processing.status":
        return { ok: true, data: processing.status(operation.params.recordingId) };
      case "processing.retry":
        return { ok: true, data: processing.retry(operation.params.recordingId) };
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
        return {
          ok: true,
          data: {
            recordingId: operation.params.recordingId,
            revision: store.revision(operation.params.recordingId, operation.params.revisionId),
          },
        };
      case "revision.history":
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
 * Turns an owner's refusal into the shared error envelope. Core states the code, retryability and
 * details; the service adds none of its own beyond naming an unexpected failure.
 */
export function operationFailure(error: unknown): OperationResult {
  if (error instanceof CaptureError || error instanceof CatalogError)
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
      },
    };
  if (error instanceof TimelineError) return failure("INVALID_RANGE", error.message);
  throw error;
}
