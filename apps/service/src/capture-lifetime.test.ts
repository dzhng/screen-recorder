import { expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { RevisionStore } from "@screenrec/core/library";
import type { OperationResult } from "@screenrec/protocol";
import { CaptureService } from "./capture.js";

test("closing capture aborts recovery and waits for its worker before releasing the catalog", async () => {
  const home = await mkdtemp("/tmp/screenrec-capture-close-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const recording = store.allocate().recording;
  let signal: AbortSignal | undefined;
  let finish!: (result: OperationResult) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const service = new CaptureService(
    store,
    home,
    async () => {
      throw new Error("Recovery must not call the capture device");
    },
    async (_operation, _params, options) => {
      signal = options?.signal;
      entered();
      return new Promise<OperationResult>((resolve) => {
        finish = resolve;
      });
    },
  );
  try {
    const recovery = service.reconcileStranded();
    await started;
    let closed = false;
    const closing = service.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(closed).toBe(false);
    finish({
      ok: false,
      error: { code: "CANCELED", message: "worker closed", retryable: true, details: {} },
    });
    await closing;
    await recovery;
    expect(store.get(recording.recordingId).state).toBe("preparing");
    await expect(service.reconcileStranded()).rejects.toMatchObject({ code: "SERVICE_STOPPED" });
  } finally {
    store.close();
    await rm(home, { recursive: true, force: true });
  }
});
