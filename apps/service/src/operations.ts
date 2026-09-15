import { TimelineError } from "@screenrec/core/timeline";
import { CatalogError, type RevisionStore } from "@screenrec/core/library";
import {
  operationNames,
  operationSchema,
  type OperationRequest,
  type OperationResult,
} from "@screenrec/protocol";

function failure(code: string, message: string): OperationResult {
  return { ok: false, error: { code, message, retryable: false, details: {} } };
}

/** The service composes owners; edit algebra and every catalog transaction stay in core. */
export function operate(
  request: OperationRequest,
  store: RevisionStore,
  health: () => unknown,
): OperationResult {
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
      case "service.health":
        return { ok: true, data: health() };
      case "recording.latest":
        return { ok: true, data: store.latest() };
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
    if (error instanceof CatalogError)
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
}
