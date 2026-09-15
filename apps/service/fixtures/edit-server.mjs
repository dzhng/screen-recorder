import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { CatalogError, RevisionStore } from "@screenrec/core/library";
import { listenLocal } from "../dist/index.js";

const [runtimeDirectory, database] = process.argv.slice(2);
const store = new RevisionStore(database, {
  now: () => new Date().toISOString(),
  newId: randomUUID,
});
const recording = store.allocate().recording;
store.registerSource(recording.recordingId, 10_000_000);
const listener = await listenLocal({
  runtimeDirectory,
  handler: async (request, signal) => {
    try {
      if (request.operation !== "edit.cut")
        return {
          ok: false,
          error: {
            code: "UNKNOWN_OPERATION",
            message: "Fixture supports cuts only",
            retryable: false,
            details: {},
          },
        };
      const { recordingId, requestId, expectedRevisionId, ranges, delayAfterCommitMs } =
        request.params;
      const revision = store.edit(recordingId, {
        operation: "cut",
        requestId,
        expectedRevisionId,
        ranges,
      });
      if (delayAfterCommitMs) await delay(delayAfterCommitMs, undefined, { signal });
      return { ok: true, data: revision };
    } catch (error) {
      if (error instanceof CatalogError)
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            details: error.details,
          },
        };
      throw error;
    }
  },
});
process.send({ socketPath: listener.socketPath, recordingId: recording.recordingId });
process.once("message", async (message) => {
  if (message === "close") {
    await listener.close();
    store.close();
    process.disconnect();
  }
});
