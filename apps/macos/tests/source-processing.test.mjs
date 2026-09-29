import { finishCapture } from "./harness.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, access, readFile, realpath } from "node:fs/promises";
import { join, dirname } from "node:path";
import { test } from "node:test";
import { RevisionStore } from "@screenrec/core/library";
import { startPublicService, until } from "./fixtures/public-service.mjs";
import { journalRows } from "./fixtures/generated-capture.mjs";
import { callLocal } from "@screenrec/client";
import {
  app,
  launchReady,
  socketPath,
  temporary,
  waitFor,
  requireScreenPermission,
} from "./harness.mjs";

// Real worker, service and catalog; capture is restricted to this app's own fixture with no audio.
test("a finalized own-window take publishes pageable source evidence once across edits and relaunch", async () => {
  requireScreenPermission();
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
  const finished = await finishCapture(call, take.recordingId);
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
    (await call("processing.retry", { recordingId: take.recordingId, artifact: "source" }))
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
    "source",
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

test("generated source processing supports both spellings of an absolute temporary home", async () => {
  const native = process.env.SCREENREC_NATIVE ?? join(dirname(app), "screenrec-native");
  for (const canonical of [false, true]) {
    const aliased = temporary("/tmp/scr-source-locator-"),
      home = canonical ? await realpath(aliased) : aliased;
    assert.ok(home.startsWith(canonical ? "/private/tmp/" : "/tmp/"));
    const store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => "fixture",
      newId: randomUUID,
    });
    const take = store.allocate().recording;
    store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "generated source locator fixture",
      sourceDurationUs: 1_000_000,
    });
    store.close();
    const source = join(home, "recordings", take.recordingId, "source");
    await mkdir(source, { recursive: true });
    const movie = spawnSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=64x48:r=10:d=1",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        join(source, "video.mov"),
      ],
      { encoding: "utf8", timeout: 30_000 },
    );
    assert.equal(movie.status, 0, movie.stderr);
    const samples = [0, 100_000, 800_000].map((sourceUs) => ({
      sourceUs,
      x: 10,
      y: 10,
      globalX: 10,
      globalY: 10,
      buttons: 0,
      eligibility: "inside",
      geometryEpoch: 1,
    }));
    const rows = journalRows({ sourceId: take.sourceId, width: 64, height: 48, samples });
    await writeFile(
      join(source, "capture.journal.jsonl"),
      rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
    );
    const service = await startPublicService(home, native);
    try {
      const ready = await until(async () => {
        const result = await service.call("processing.status", {
          recordingId: take.recordingId,
          artifact: "source",
        });
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.ok(!["failed", "unavailable"].includes(result.data.state), JSON.stringify(result));
        return result.data.state === "ready" && result.data;
      }, "Source locator processing did not become ready");
      assert.ok(
        ready.published.evidence.receipt.file.startsWith(home + "/"),
        ready.published.evidence.receipt.file,
      );
      assert.ok(
        (await readFile(ready.published.evidence.receipt.file, "utf8")).includes('"cursorSample"'),
      );
      const raw = await service.call("cursor.raw", {
        recordingId: take.recordingId,
        sourceRange: { startUs: 0, endUs: 1_000_000 },
        limit: 10,
      });
      assert.equal(raw.ok, true, JSON.stringify(raw));
      assert.deepEqual(
        raw.data.samples.map((sample) => sample.sourceUs),
        [0, 100_000, 800_000],
      );
    } finally {
      await service.close();
    }
  }
});
