import { expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { RevisionStore } from "@screenrec/core/library";
import type { OperationResult } from "@screenrec/protocol";
import { CaptureService, sourceDirectory } from "./capture.js";

// This pins the service half of asynchronous stop. The native termination/publisher and
// full controller deadline gates are separate: this fixture neither captures nor verifies media.
test("finalizing acknowledgment releases control order while cancellation waits for actual unwind", async () => {
  const home = await mkdtemp("/tmp/screenrec-finalizing-queue-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const recording = store.allocate().recording;
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "recording",
  });
  const source = sourceDirectory(home, recording.recordingId);
  await mkdir(source, { recursive: true });
  const sentinel = join(source, "sentinel");
  await writeFile(sentinel, "retain until native unwinds");
  let enterCancel!: () => void;
  const cancelEntered = new Promise<void>((resolve) => {
    enterCancel = resolve;
  });
  let unwind!: (result: OperationResult) => void;
  const terminal = new Promise<OperationResult>((resolve) => {
    unwind = resolve;
  });
  const report = (sequence: number) => ({
    recordingId: recording.recordingId,
    sourceId: recording.sourceId,
    sequence,
    state: "finalizing" as const,
  });
  const service = new CaptureService(
    store,
    home,
    async (operation) => {
      if (operation === "capture.stop") return { ok: true, data: report(2) };
      if (operation === "capture.cancel") {
        enterCancel();
        return terminal;
      }
      if (operation === "capture.status")
        return {
          ok: true,
          data: {
            state: "finalizing",
            recordingId: recording.recordingId,
            sourceId: recording.sourceId,
            elapsedUs: 1,
            selection: null,
            permissions: { screen: true, microphone: "authorized" },
          },
        };
      throw new Error(`Unexpected native operation: ${operation}`);
    },
    async () => {
      throw new Error("This active take must not enter recovery");
    },
  );
  let cancel: ReturnType<CaptureService["cancel"]> | undefined;
  try {
    expect(await service.stop(recording.recordingId)).toMatchObject({ state: "finalizing" });
    expect(await service.status()).toMatchObject({ device: { state: "finalizing" } });
    cancel = service.cancel(recording.recordingId);
    await cancelEntered;
    expect(await readFile(sentinel, "utf8")).toBe("retain until native unwinds");
    expect(store.get(recording.recordingId).state).toBe("finalizing");
    unwind({ ok: true, data: report(3) });
    expect(await cancel).toMatchObject({ state: "canceled" });
    await expect(readFile(sentinel)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    unwind({
      ok: false,
      error: { code: "SERVICE_STOPPED", message: "fixture ended", retryable: true, details: {} },
    });
    await cancel?.catch(() => undefined);
    await service.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  }
});

test("unproved start keeps finalizing media out of recovery until the native terminal report", async () => {
  const home = await mkdtemp("/tmp/screenrec-unproved-finalizing-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const recording = store.allocate().recording;
  let recoveries = 0;
  const service = new CaptureService(
    store,
    home,
    async (operation) => {
      expect(operation).toBe("capture.stop");
      return {
        ok: true,
        data: {
          recordingId: recording.recordingId,
          sourceId: recording.sourceId,
          sequence: 1,
          state: "finalizing",
        },
      };
    },
    async () => {
      recoveries += 1;
      throw new Error("Unfinished media must not be inspected");
    },
  );
  try {
    await expect(service.stop(recording.recordingId)).rejects.toMatchObject({
      code: "UNRESOLVED_START",
      details: { state: "finalizing" },
    });
    expect(recoveries).toBe(0);
    expect(store.get(recording.recordingId).state).toBe("finalizing");
    expect(await service.stop(recording.recordingId)).toMatchObject({ state: "finalizing" });
    expect(
      service.report({
        recordingId: recording.recordingId,
        sourceId: recording.sourceId,
        sequence: 2,
        state: "complete",
        sourceDurationUs: 1234,
      }),
    ).toMatchObject({ state: "complete", sourceDurationUs: 1234 });
    expect(await service.stop(recording.recordingId)).toMatchObject({
      state: "complete",
      sourceDurationUs: 1234,
    });
    expect(recoveries).toBe(0);
  } finally {
    await service.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  }
});
