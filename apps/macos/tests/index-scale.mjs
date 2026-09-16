import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { arch, cpus, platform, release } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import { app, launchReady, socketPath, temporary } from "./harness.mjs";

// Explicit long-running lab, excluded from the default native test glob. Build first.
// SCREENREC_INDEX_SCALE_EVIDENCE: empty absolute output directory (default: fresh /tmp directory).
// SCREENREC_INDEX_SCALE_VIDEO: optional absolute path to the preserved generated fixture;
// copied read-only into this run's disposable recording. Its hash identifies comparable runs.
const durationUs = 1_800_000_000;
const timeoutMs = 1_800_000;
const hash = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
function run(command, args, timeout = 30_000) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result.stdout;
}

async function fixture(home) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated animated index scale",
    sourceDurationUs: durationUs,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  const video = join(source, "video.mov");
  const input = process.env.SCREENREC_INDEX_SCALE_VIDEO;
  if (input) {
    assert.ok(isAbsolute(input), "Fixture input must be an absolute path");
    await copyFile(input, video);
  } else {
    run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x180:rate=30:duration=1800",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "30",
        "-g",
        "30",
        "-bf",
        "0",
        video,
      ],
      120_000,
    );
  }
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", video]));
  assert.equal(probe.streams.length, 1, "The scale fixture must contain video only");
  const stream = probe.streams[0];
  assert.equal(stream.codec_name, "h264");
  assert.equal(stream.width, 320);
  assert.equal(stream.height, 180);
  assert.equal(stream.avg_frame_rate, "30/1");
  assert.equal(Number(stream.duration), durationUs / 1_000_000);
  const geometry = {
    outputWidth: 320,
    outputHeight: 180,
    contentScale: 1,
    scaleFactor: 1,
    contentRect: { x: 0, y: 0, width: 320, height: 180 },
    screenRect: { x: 0, y: 0, width: 320, height: 180 },
  };
  const rows = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: take.sourceId,
        source: { kind: "window", windowID: 1 },
        width: 320,
        height: 180,
        microphone: false,
        systemAudio: false,
      },
    },
    { event: "origin", data: { hostUs: 1_000_000 } },
    { event: "geometry", data: { epoch: 1, hostUs: 1_000_000, sourceUs: 0, geometry } },
  ];
  for (let start = 0; start < 9000; start += 30)
    rows.push({
      event: "cursorSamples",
      data: {
        samples: Array.from({ length: 30 }, (_, j) => ({
          sourceUs: (start + j) * 200_000,
          x: -10,
          y: -10,
          globalX: -10,
          globalY: -10,
          buttons: 0,
          eligibility: "outside",
          geometryEpoch: 1,
        })),
      },
    });
  rows.push({ event: "finished", data: {} });
  await writeFile(
    join(source, "capture.journal.jsonl"),
    rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row })).join("\n") + "\n",
  );
  return { take, video, input: input ?? "generated:testsrc2" };
}

function catalogMetrics(home) {
  const db = new DatabaseSync(join(home, "library.sqlite"), { readOnly: true });
  try {
    return {
      cacheBytes: db.prepare("SELECT COALESCE(SUM(bytes), 0) AS n FROM derived_cache").get().n,
      retainedCandidates: db.prepare("SELECT COUNT(*) AS n FROM screenshot_index_entries").get().n,
      retainedPngBytes: db
        .prepare("SELECT COALESCE(SUM(bytes), 0) AS n FROM screenshot_index_entries")
        .get().n,
      throughSourceUs: db
        .prepare(
          "SELECT MAX(json_extract(candidate, '$.requestedSourceUs')) AS n FROM screenshot_index_entries",
        )
        .get().n,
      retainedRowBytes: db
        .prepare(
          "SELECT COALESCE(SUM(length(candidate)+length(frame)), 0) AS n FROM screenshot_index_entries",
        )
        .get().n,
    };
  } finally {
    db.close();
  }
}

function sampleMemory(servicePid, report) {
  const processes = run("/bin/ps", ["-axo", "pid=,ppid=,rss="])
    .trim()
    .split("\n")
    .map((row) => row.trim().split(/\s+/).map(Number));
  const serviceRSSKiB = processes.find((row) => row[0] === servicePid)?.[2] ?? null;
  report.servicePeakKiB = Math.max(report.servicePeakKiB, serviceRSSKiB ?? 0);
  const owned = new Set([servicePid]);
  for (let previousSize = 0; previousSize !== owned.size;) {
    previousSize = owned.size;
    for (const [pid, ppid] of processes) if (owned.has(ppid)) owned.add(pid);
  }
  let workerTotalRSSKiB = 0,
    workerCount = 0,
    maxWorkerRSSKiB = 0;
  for (const [pid, , rss] of processes)
    if (pid !== servicePid && owned.has(pid)) {
      workerTotalRSSKiB += rss;
      workerCount++;
      maxWorkerRSSKiB = Math.max(maxWorkerRSSKiB, rss);
      report.workerPeakKiB = Math.max(report.workerPeakKiB, rss);
      report.workerObservations++;
    }
  report.memorySamples++;
  return { serviceRSSKiB, workerTotalRSSKiB, workerCount, maxWorkerRSSKiB };
}

test("thirty-minute generated native index scale", { timeout: timeoutMs + 150_000 }, async (t) => {
  const output =
    process.env.SCREENREC_INDEX_SCALE_EVIDENCE ??
    (await mkdtemp("/tmp/screenrec-index-scale-evidence-"));
  assert.ok(isAbsolute(output), "Evidence output must be an absolute path");
  await mkdir(output, { recursive: true });
  assert.deepEqual(await readdir(output), [], "Evidence output must be empty");
  const report = {
    state: "preparing",
    generated: true,
    durationUs,
    width: 320,
    height: 180,
    fps: 30,
    host: {
      cpu: cpus()[0]?.model,
      platform: platform(),
      release: release(),
      arch: arch(),
      node: process.version,
    },
    servicePeakKiB: 0,
    workerPeakKiB: 0,
    workerObservations: 0,
    memorySamples: 0,
    memorySampling: "RSS sampled between polls, nominally every second; not a guaranteed peak",
    checkpoints: [],
    foreground: null,
  };
  // Atomic replacement preserves the last complete checkpoint if the run is interrupted.
  const save = async () => {
    await writeFile(join(output, "report.tmp"), JSON.stringify(report, null, 2) + "\n");
    await rename(join(output, "report.tmp"), join(output, "report.json"));
  };
  console.log(JSON.stringify({ evidence: output }));
  await save();
  const home = temporary("/tmp/scr-index-scale-");
  let instance;
  let started;
  try {
    report.revision = run("git", ["rev-parse", "HEAD"]).trim();
    report.ffmpeg = run("ffmpeg", ["-version"]).split("\n")[0];
    report.nativeExecutableSha256 = await hash(app);
    report.serviceBundleSha256 = await hash(join(dirname(app), "../Resources/service/main.mjs"));
    await save();
    const { take, video, input } = await fixture(home);
    report.sourceHash = await hash(video);
    report.input = input;
    const launched = await launchReady(home);
    instance = launched.instance;
    const { servicePid } = launched;
    started = Date.now();
    Object.assign(report, {
      state: "running",
      recordingId: take.recordingId,
      startedAt: new Date(started).toISOString(),
    });
    await save();
    const call = async (operation, params) => {
      t.signal.throwIfAborted();
      assert.ok(
        Date.now() - started < timeoutMs,
        "Thirty-minute index run exceeded its time limit",
      );
      const reply = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
      assert.equal(reply.ok, true, JSON.stringify(reply));
      assert.ok(!["failed", "unavailable"].includes(reply.data.state), JSON.stringify(reply.data));
      return reply.data;
    };
    let ready,
      nextCheckpoint = 0,
      nextMemory = 0,
      lastMemory,
      indexStarted;
    const observe = async (result) => {
      const now = Date.now();
      if (now >= nextMemory) {
        lastMemory = { elapsedMs: now - started, ...sampleMemory(servicePid, report) };
        nextMemory = now + 1000;
      }
      if (now >= nextCheckpoint || result.state === "ready") {
        const checkpoint = {
          elapsedMs: now - started,
          state: result.state,
          phase: indexStarted === undefined ? "dependencies" : "index",
          memory: lastMemory,
          ...catalogMetrics(home),
        };
        report.checkpoints.push(checkpoint);
        await save();
        console.log(JSON.stringify(checkpoint));
        nextCheckpoint = now + 15_000;
      }
    };
    for (;;) {
      const result = await call("index.get", { recordingId: take.recordingId, limit: 1 });
      if (result.jobId && indexStarted === undefined) {
        indexStarted = Date.now();
        report.indexStartedMs = indexStarted - started;
      }
      await observe(result);
      if (indexStarted !== undefined && report.foreground === null) {
        const began = performance.now();
        report.foreground = { state: "running", startedMs: Date.now() - started };
        await save();
        let frame;
        do {
          frame = await call("frame.get", {
            recordingId: take.recordingId,
            atUs: 900_000_000,
            clean: true,
          });
          await observe(result);
          if (frame.state !== "ready") await delay(25, undefined, { signal: t.signal });
        } while (frame.state !== "ready");
        report.foreground = {
          ...report.foreground,
          state: "ready",
          elapsedMs: performance.now() - began,
          frame: frame.published.frame,
        };
        await save();
        await call("artifact.close", { token: frame.delivery.token });
      }
      if (result.state === "ready") {
        ready = result;
        break;
      }
      await delay(1000, undefined, { signal: t.signal });
    }
    report.elapsedMs = Date.now() - started;
    report.indexElapsedMs = indexStarted === undefined ? null : Date.now() - indexStarted;
    let candidates = 0,
      pages = 0,
      cursor;
    for (;;) {
      const page = await call("index.get", {
        recordingId: take.recordingId,
        limit: 200,
        ...(cursor ? { cursor } : { revisionId: "r0" }),
      });
      assert.equal(page.state, "ready");
      pages++;
      candidates += page.page.entries.length;
      if (!page.page.nextCursor) break;
      assert.notDeepEqual(page.page.nextCursor, cursor, "Paging must advance");
      cursor = page.page.nextCursor;
    }
    assert.equal(candidates, ready.page.metadata.candidateCount);
    assert.equal(await hash(video), report.sourceHash);
    Object.assign(report, {
      state: "complete",
      pages,
      candidates,
      ...catalogMetrics(home),
      retainedPngBytes: ready.page.metadata.bytes,
      metadata: ready.page.metadata,
    });
  } catch (error) {
    report.state = "failed";
    report.error = String(error.stack ?? error);
    throw error;
  } finally {
    if (started !== undefined) report.totalElapsedMs = Date.now() - started;
    await save();
    if (instance) {
      report.survivingProcesses = await instance.reap();
      if (report.survivingProcesses.length) report.state = "failed";
      await save();
      assert.deepEqual(report.survivingProcesses, []);
    }
  }
});
