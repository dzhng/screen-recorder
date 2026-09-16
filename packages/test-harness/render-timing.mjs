import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, basename } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue } from "@screenrec/core/jobs";
import {
  createOriginalRevision,
  createRevision,
  projectEvents,
  renderPlan,
} from "@screenrec/core/timeline";
import { mediaWorker } from "../../apps/service/dist/worker.js";
import { withRenderedVideo } from "../../apps/service/dist/render.js";
import { renderFrames } from "../../helpers/mac/Tests/fixtures/render-frames.mjs";
const execute = promisify(execFile);
const native =
  process.env.SCREENREC_NATIVE ??
  new URL("../../helpers/mac/.build/debug/screenrec-native", import.meta.url).pathname;
async function command(executable, args) {
  return (await execute(executable, args, { timeout: 30000, maxBuffer: 8 * 1024 * 1024 })).stdout;
}
async function until(check) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(5);
  }
  throw new Error("Timing lab made no progress");
}
async function staged(parent) {
  for (const child of await readdir(parent)) {
    try {
      if ((await readdir(join(parent, child))).some((name) => name.startsWith(".video-render-")))
        return true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return false;
}
async function decode(file, frames) {
  const raw = file + ".rgb";
  const metadata = JSON.parse(
    await command("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-show_entries",
      "frame=pts_time",
      "-select_streams",
      "v",
      "-of",
      "json",
      file,
    ]),
  );
  await command("ffmpeg", [
    "-v",
    "error",
    "-i",
    file,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-fps_mode",
    "passthrough",
    raw,
  ]);
  const pixels = await readFile(raw),
    size = frames[0].length,
    identities = [];
  for (let offset = 0; offset < pixels.length; offset += size) {
    const errors = frames.map((frame) => {
      let sum = 0;
      for (let i = 0; i < size; i++) sum += Math.abs(frame[i] - pixels[offset + i]);
      return sum / size;
    });
    const best = Math.min(...errors);
    assert.ok(best < 12);
    identities.push(errors.indexOf(best));
  }
  return {
    durationUs: Math.round(Number(metadata.format.duration) * 1e6),
    identities,
    pts: metadata.frames.map((frame) => Math.round(Number(frame.pts_time) * 1e6)),
  };
}
test(
  "pinned pause/undo plans and terminal render-attempt lifetime",
  { timeout: 60000 },
  async () => {
    const evidence = process.env.SCREENREC_RENDER_TIMING_EVIDENCE;
    const home = evidence ?? (await mkdtemp(join(tmpdir(), "screenrec-render-timing-")));
    assert.ok(isAbsolute(home));
    await mkdir(home, { recursive: true });
    assert.deepEqual(await readdir(home), []);
    const attempts = join(home, "attempts");
    await mkdir(attempts);
    const source = join(home, "source.mov"),
      frames = renderFrames();
    await writeFile(join(home, "source.rgb"), Buffer.concat(frames));
    await command("ffmpeg", [
      "-v",
      "error",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgb24",
      "-video_size",
      "320x180",
      "-framerate",
      "1",
      "-i",
      join(home, "source.rgb"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-bf",
      "2",
      "-an",
      source,
    ]);
    const sourceBefore = await readFile(source);
    const store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    let jobs;
    const report = {
      kind: "pinned native render timing and terminal cleanup",
      renders: [],
      lifetime: [],
    };
    try {
      const { recordingId, sourceId } = store.allocate().recording;
      for (const [sequence, state] of [
        [1, "recording"],
        [2, "finalizing"],
      ])
        store.ingestLifecycle(recordingId, { sourceId, sequence, state });
      store.ingestLifecycle(recordingId, {
        sourceId,
        sequence: 3,
        state: "complete",
        sourceDurationUs: 6000000,
      });
      const cut = store.edit(recordingId, {
        operation: "cut",
        requestId: randomUUID(),
        expectedRevisionId: "r0",
        ranges: [
          { startUs: 2000000, endUs: 3000000 },
          { startUs: 4000000, endUs: 5000000 },
        ],
      });
      const pause = { kind: "pause", atSourceUs: 3000000, elapsedPauseUs: 60000000 };
      const events = projectEvents(cut, [pause]);
      assert.ok(
        events.some(
          (group) =>
            group.atUs === 2000000 &&
            group.events.some(
              (event) => event.kind === "pause" && event.elapsedPauseUs === 60000000,
            ),
        ),
      );
      report.pause = events;
      const gate = Promise.withResolvers(),
        started = Promise.withResolvers();
      const run = mediaWorker({ SCREENREC_NATIVE: native });
      jobs = new JobQueue({
        store,
        providers: { newId: randomUUID },
        execute: async ({ job, signal }) => {
          started.resolve();
          await gate.promise;
          const revision = store.revision(recordingId, job.revisionId),
            plan = renderPlan(revision);
          return withRenderedVideo(
            run,
            { source, plan, attemptParent: attempts },
            signal,
            async (video) => {
              const file = join(home, job.revisionId + ".mp4");
              await copyFile(video.file, file);
              const decoded = await decode(file, frames);
              const summary = { revisionId: job.revisionId, plan, file: basename(file), decoded };
              report.renders.push(summary);
              return JSON.stringify(summary);
            },
          );
        },
      });
      const first = jobs.submit({
        recordingId,
        artifact: "render-timing-proof",
        lane: "heavy",
        input: "generated",
      });
      await started.promise;
      const undo = store.edit(recordingId, {
        operation: "undo",
        requestId: randomUUID(),
        expectedRevisionId: cut.id,
      });
      assert.notEqual(undo.id, first.revisionId);
      gate.resolve();
      await until(() => jobs.job(first.jobId).state === "ready");
      assert.equal(report.renders[0].revisionId, cut.id);
      assert.deepEqual(report.renders[0].decoded, {
        durationUs: 4000000,
        identities: [0, 1, 3, 5],
        pts: [0, 1000000, 2000000, 3000000],
      });
      const second = jobs.submit({
        recordingId,
        artifact: "render-timing-proof",
        lane: "heavy",
        input: "generated",
      });
      await until(() => jobs.job(second.jobId).state === "ready");
      assert.equal(report.renders[1].revisionId, undo.id);
      assert.deepEqual(report.renders[1].decoded, {
        durationUs: 6000000,
        identities: [0, 1, 2, 3, 4, 5],
        pts: [0, 1000000, 2000000, 3000000, 4000000, 5000000],
      });
      assert.deepEqual(await readdir(attempts), []);
      const cancelRevision = store.edit(recordingId, {
        operation: "cut",
        requestId: randomUUID(),
        expectedRevisionId: undo.id,
        ranges: Array.from({ length: 500 }, (_, i) => ({
          startUs: i * 1000 + 1,
          endUs: i === 499 ? 6000000 : (i + 1) * 1000,
        })),
      });
      const canceled = jobs.submit({
        recordingId,
        artifact: "render-timing-proof",
        lane: "heavy",
        input: "generated",
      });
      await until(() => staged(attempts));
      jobs.cancel(canceled.jobId);
      await until(async () => (await readdir(attempts)).length === 0);
      assert.equal(jobs.job(canceled.jobId).state, "canceled");
      assert.equal(jobs.status(canceled).published, null);
      assert.equal(
        report.renders.some((render) => render.revisionId === cancelRevision.id),
        false,
      );
      report.lifetime.push({
        kind: "queued-job-cancel",
        nativeStagingObserved: true,
        consumed: false,
        attemptsRemaining: 0,
      });
      // Enough tiny retained spans to keep a real encoder active while observing its stage.
      const tiny = renderPlan(
        createRevision(
          createOriginalRevision(6000000),
          Array.from({ length: 4000 }, (_, i) => ({ startUs: i * 1000, endUs: i * 1000 + 1 })),
          { id: "tiny", operation: "cut", createdAt: "fixture" },
        ),
      );
      for (const kind of ["abort", "deadline", "late-abort"]) {
        const controller = new AbortController();
        let observed = false,
          consumed = false;
        const worker = async (operation, params, options) => {
          const response = await run(
            operation,
            params,
            kind === "deadline" ? { ...options, timeoutMs: 750 } : options,
          );
          if (kind === "late-abort") {
            assert.equal(response.ok, true);
            controller.abort();
          }
          return response;
        };
        const pending = withRenderedVideo(
          worker,
          {
            source,
            plan: kind === "late-abort" ? renderPlan(undo) : tiny,
            attemptParent: attempts,
          },
          controller.signal,
          async () => {
            consumed = true;
          },
        );
        const rejected = assert.rejects(
          pending,
          (error) => error.code === (kind === "deadline" ? "MEDIA_WORKER_TIMEOUT" : "CANCELED"),
        );
        if (kind !== "late-abort") {
          await until(() => staged(attempts));
          observed = true;
          if (kind === "abort") controller.abort();
        }
        await rejected;
        assert.equal(consumed, false);
        assert.deepEqual(await readdir(attempts), []);
        report.lifetime.push({
          kind,
          nativeStagingObserved: observed,
          consumed,
          attemptsRemaining: 0,
        });
      }
      assert.deepEqual(await readFile(source), sourceBefore);
      await writeFile(join(home, "report.json"), JSON.stringify(report, null, 2));
      console.log(
        JSON.stringify({
          home,
          renders: report.renders.map((x) => x.decoded),
          lifetime: report.lifetime,
        }),
      );
    } finally {
      await jobs?.close();
      store.close();
      if (!evidence) await rm(home, { recursive: true, force: true });
    }
  },
);
