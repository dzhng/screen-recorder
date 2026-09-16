import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { app, finderEnvironment, launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

// Real worker, service and catalog; capture is restricted to this app's own fixture with no audio.
test("a finalized own-window take publishes pageable source evidence once across edits and relaunch", async () => {
  const preflight = JSON.parse(
    spawnSync(app, ["--capture-preflight"], {
      env: finderEnvironment,
      encoding: "utf8",
      timeout: 20000,
    }).stdout || "{}",
  );
  assert.equal(
    preflight.screen,
    true,
    "The own-window capture gate requires existing screen permission",
  );
  const home = temporary("/tmp/scr-source-processing-");
  const { instance } = await launchReady(home, { SCREENREC_FIXTURE_WINDOW: "1" });
  const [, window] = await instance.waitFor(/capture fixture window=(\d+)/);
  const call = async (operation, params = {}) => {
    const response = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
    assert.equal(response.ok, true, JSON.stringify(response));
    return response.data;
  };
  const take = await call("capture.start", {
    requestId: randomUUID(),
    source: { kind: "window", windowId: Number(window) },
    microphone: false,
    systemAudio: false,
  });
  assert.equal(
    (await call("processing.status", { recordingId: take.recordingId })).state,
    "not_requested",
  );
  await waitFor(async () => (await call("capture.status")).device.elapsedUs >= 1000000, 20000);
  const finished = await call("capture.stop", { recordingId: take.recordingId });
  const ready = await waitFor(async () => {
    const status = await call("processing.status", { recordingId: take.recordingId });
    if (status.state === "failed" || status.state === "unavailable")
      throw new Error(JSON.stringify(status));
    return status.state === "ready" && status;
  }, 20000);
  assert.ok(ready.published.evidence.receipt.cursorSamples > 1);
  const sourceRange = { startUs: 0, endUs: finished.sourceDurationUs };
  const first = await call("cursor.raw", { recordingId: take.recordingId, sourceRange, limit: 1 });
  for (const invalidRange of [
    { startUs: 0, endUs: 60_000_001 },
    { startUs: 1, endUs: 1 },
  ]) {
    const rejected = await callLocal(socketPath(home), {
      id: randomUUID(),
      operation: "cursor.raw",
      params: { recordingId: take.recordingId, sourceRange: invalidRange },
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "INVALID_PARAMS");
  }
  assert.equal(first.samples.length, 1);
  assert.ok(first.nextCursor);
  const second = await call("cursor.raw", {
    recordingId: take.recordingId,
    sourceRange,
    cursor: first.nextCursor,
    limit: 1,
  });
  assert.notEqual(first.samples[0].sequence, second.samples[0].sequence);
  assert.equal(first.generation, second.generation);
  assert.equal(first.integrity.incompleteTail, false);
  for (const cursor of [
    { ...first.nextCursor, generation: "different-attempt" },
    { ...first.nextCursor, sourceId: "different-source" },
    { ...first.nextCursor, sourceRange: { ...sourceRange, startUs: 1 } },
  ]) {
    const rejected = await callLocal(socketPath(home), {
      id: randomUUID(),
      operation: "cursor.raw",
      params: { recordingId: take.recordingId, sourceRange, cursor, limit: 1 },
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "ARTIFACT_CHANGED");
  }

  await call("edit.cut", {
    recordingId: take.recordingId,
    expectedRevisionId: "r0",
    requestId: randomUUID(),
    ranges: [{ startUs: 0, endUs: 100000 }],
  });
  assert.deepEqual(await call("processing.status", { recordingId: take.recordingId }), ready);
  assert.equal(
    (await call("processing.retry", { recordingId: take.recordingId, artifact: "cursor" }))
      .published.evidence.generation,
    first.generation,
  );
  // A real service/app restart reopens the same published index without another export.
  instance.kill("SIGTERM");
  await waitFor(
    () => !instance.running,
    15000,
    () => instance.diagnostics,
  );
  assert.equal((await instance.exited).code, 0);
  const abandoned = join(
    home,
    "recordings",
    take.recordingId,
    "evidence",
    "cursor",
    "abandoned-attempt",
  );
  await mkdir(abandoned);
  await writeFile(join(abandoned, "observations.jsonl"), "unpublished export prefix");
  await launchReady(home, { SCREENREC_FIXTURE_WINDOW: "1" });
  await waitFor(async () => {
    try {
      await access(abandoned);
      return false;
    } catch (error) {
      if (error.code === "ENOENT") return true;
      throw error;
    }
  }, 5000);
  assert.deepEqual(await call("processing.status", { recordingId: take.recordingId }), ready);
  assert.deepEqual(
    await call("cursor.raw", { recordingId: take.recordingId, sourceRange, limit: 1 }),
    first,
  );
});
