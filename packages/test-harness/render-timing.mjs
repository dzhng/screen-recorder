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
import { PresentationEvidence } from "@screenrec/core/presentation-evidence";
import { writePointerSchedule } from "@screenrec/core/pointer-schedule";
import { PreviewInspection } from "@screenrec/core/preview";
import { DerivedCache } from "@screenrec/core/cache";
import { SourceProcessing } from "@screenrec/core/processing";
import { constants } from "node:fs";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { journalRows } from "../../apps/macos/tests/fixtures/generated-capture.mjs";
import { JobQueue } from "@screenrec/core/jobs";
import {
  createOriginalRevision,
  createRevision,
  projectEvents,
  renderPlan,
} from "@screenrec/core/timeline";
import { mediaWorker } from "../../apps/service/dist/worker.js";
import { renderDeadlineMs, withRenderedMedia } from "../../apps/service/dist/render.js";
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
async function ready(jobs, id) {
  await until(() => {
    const job = jobs.job(id);
    if (["failed", "unavailable", "canceled"].includes(job.state))
      throw new Error(job.reason ?? job.state);
    return job.state === "ready";
  });
}
async function staged(parent) {
  for (const child of await readdir(parent)) {
    try {
      if (
        (await readdir(join(parent, child))).some(
          (name) => name.startsWith(".video-render-") || name.startsWith(".movie-render-"),
        )
      )
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
    "-nostdin",
    "-y",
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
async function compareAudio(movie, wave, expectedFrames) {
  const paths = [];
  for (const [file, suffix] of [
    [movie, ".aac.f32"],
    [wave, ".pcm.f32"],
  ]) {
    const output = file + suffix;
    await command("ffmpeg", ["-v", "error", "-i", file, "-map", "0:a:0", "-f", "f32le", output]);
    const bytes = await readFile(output);
    paths.push(
      new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    );
  }
  const [actual, expected] = paths;
  assert.equal(expected.length, expectedFrames);
  assert.ok(actual.length >= expectedFrames && actual.length < expectedFrames + 1024);
  let squared = 0;
  for (let i = 500; i < expectedFrames - 500; i++) squared += (actual[i] - expected[i]) ** 2;
  const rms = Math.sqrt(squared / (expectedFrames - 1000));
  assert.ok(rms < 0.01, `Pinned movie AAC differs from retained PCM: ${rms}`);
  return { presentationFrames: expectedFrames, independentlyDecodedFrames: actual.length, rms };
}
test(
  "pinned movie audio/video plans across pause, undo and terminal render lifetime",
  { timeout: 60000 },
  async () => {
    const evidence = process.env.SCREENREC_RENDER_TIMING_EVIDENCE;
    const home = evidence ?? (await mkdtemp(join(tmpdir(), "screenrec-render-timing-")));
    assert.ok(isAbsolute(home));
    await mkdir(home, { recursive: true });
    assert.deepEqual(await readdir(home), []);
    const attempts = join(home, "attempts");
    await mkdir(attempts, { mode: 0o700 });
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
    for (const [role, expression] of [
      ["narration", "0.1*sin(2*PI*(170*t+31*t*t))"],
      ["system", "0.1*sin(2*PI*400*t)"],
    ])
      await command("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        `aevalsrc=${expression}:s=48000:d=6`,
        "-c:a",
        "pcm_f32le",
        join(home, role + ".mov"),
      ]);
    const audioBefore = await Promise.all(
      ["narration", "system"].map((role) => readFile(join(home, role + ".mov"))),
    );
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
      const raw = join(home, "recordings", recordingId, "source");
      await mkdir(raw, { recursive: true });
      await copyFile(source, join(raw, "video.mov"));
      for (const role of ["narration", "system"])
        await copyFile(join(home, role + ".mov"), join(raw, role + ".mov"));
      const rows = journalRows({ sourceId, width: 320, height: 180, samples: [], pauses: [pause] });
      rows[0].data.microphone = true;
      rows[0].data.systemAudio = true;
      rows.splice(
        rows.length - 1,
        0,
        { event: "audioSamples", data: { role: "narration", startUs: 0, endUs: 3_250_000 } },
        {
          event: "audioSamples",
          data: { role: "narration", startUs: 3_750_000, endUs: 6_000_000 },
        },
        { event: "audioSamples", data: { role: "system", startUs: 0, endUs: 6_000_000 } },
      );
      await writeFile(
        join(raw, "capture.journal.jsonl"),
        rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
      );
      const run = mediaWorker({ SCREENREC_NATIVE: native });
      const sourceEvidence = new SourceEvidenceStore(store);
      const cache = new DerivedCache(store, home);
      await cache.reconcile();
      let processing, preview;
      jobs = new JobQueue({
        store,
        providers: { newId: randomUUID },
        execute: (execution) =>
          execution.job.artifact === "preview"
            ? preview.execute(execution)
            : processing.execute(execution),
      });
      processing = new SourceProcessing(
        store,
        jobs,
        sourceEvidence,
        home,
        async (directory, output, signal) => {
          const exported = await run("media.sourceEvidence", { directory, output }, { signal });
          assert.equal(exported.ok, true, JSON.stringify(exported));
          return exported.data;
        },
      );
      processing.prepare(recordingId);
      await jobs.idle();
      const metadata = processing.status(recordingId).published.evidence;
      assert.deepEqual(
        sourceEvidence
          .pauseBoundaries(metadata, { startUs: 0, endUs: 6_000_000 })
          .map(({ sequence: _sequence, ...event }) => ({ kind: "pause", ...event })),
        [pause],
      );
      report.pause = events;
      const gate = Promise.withResolvers(),
        started = Promise.withResolvers();
      preview = new PreviewInspection(
        store,
        jobs,
        cache,
        sourceEvidence,
        processing,
        home,
        async (request, signal) => {
          started.resolve();
          await gate.promise;
          const { revision, plan, tracks } = request;
          const preparePointer = async (directory, boundWorker, preparationSignal) => {
            const response = await boundWorker(
              "media.presentationEvidence",
              {
                source: request.source,
                plan,
                output: join(directory, "presentation.jsonl"),
                maxBytes: 10_000_000,
              },
              { timeoutMs: renderDeadlineMs(plan) },
            );
            assert.equal(response.ok, true, JSON.stringify(response));
            const presentation = await PresentationEvidence.open(
              response.data,
              revision,
              preparationSignal,
            );
            try {
              return await writePointerSchedule(
                {
                  presentation,
                  evidence: sourceEvidence,
                  identity: request.sourceEvidence,
                  output: join(directory, "pointer.jsonl"),
                  maxBytes: 1_000_000,
                  maxEvents: 100_000,
                },
                preparationSignal,
              );
            } finally {
              await presentation.close();
            }
          };
          if (!report.pointerReceiptChecked) {
            await assert.rejects(
              withRenderedMedia(
                run,
                {
                  source: request.source,
                  plan,
                  tracks,
                  attemptParent: attempts,
                  preparePointer: async (...args) => ({
                    ...(await preparePointer(...args)),
                    sha256: "0".repeat(64),
                  }),
                },
                signal,
                async () => assert.fail("Corrupt schedule receipt was consumed"),
              ),
              { code: "INVALID_REQUEST" },
            );
            report.pointerReceiptChecked = true;
          }
          return withRenderedMedia(
            run,
            {
              source: request.source,
              plan,
              tracks,
              attemptParent: attempts,
              preparePointer,
            },
            signal,
            async (video) => {
              await copyFile(video.file, request.output, constants.COPYFILE_EXCL);
              const file = join(home, revision.id + ".mp4");
              await copyFile(request.output, file);
              const decoded = await decode(request.output, frames);
              assert.ok(video.audio, "Pinned movie must include planned audio");
              assert.equal(video.audio.codec, "aac");
              assert.equal(video.audio.frames, (revision.durationUs * 48_000) / 1_000_000);
              assert.deepEqual(
                video.audio.tracks.map((track) => track.gain),
                [0.5, 0.5],
              );
              const wave = join(home, revision.id + ".wav");
              const reference = await run(
                "media.audio",
                { tracks, spans: revision.spans, output: wave },
                { signal },
              );
              assert.equal(reference.ok, true, JSON.stringify(reference));
              const audio = await compareAudio(file, wave, video.audio.frames);
              report.renders.push({
                revisionId: revision.id,
                plan,
                file: basename(file),
                decoded,
                audio: { ...audio, tracks: video.audio.tracks },
              });
              return { ...video, file: request.output };
            },
          );
        },
      );
      const first = preview.request({ recordingId });
      await started.promise;
      const undo = store.edit(recordingId, {
        operation: "undo",
        requestId: randomUUID(),
        expectedRevisionId: cut.id,
      });
      assert.notEqual(undo.id, first.revisionId);
      gate.resolve();
      await ready(jobs, first.jobId);
      assert.equal(report.renders[0].revisionId, cut.id);
      assert.deepEqual(report.renders[0].decoded, {
        durationUs: 4000000,
        identities: [0, 1, 3, 5],
        pts: [0, 1000000, 2000000, 3000000],
      });
      const second = preview.request({ recordingId });
      await ready(jobs, second.jobId);
      assert.equal(report.renders[1].revisionId, undo.id);
      assert.deepEqual(report.renders[1].decoded, {
        durationUs: 6000000,
        identities: [0, 1, 2, 3, 4, 5],
        pts: [0, 1000000, 2000000, 3000000, 4000000, 5000000],
      });
      assert.deepEqual(await readdir(attempts), []);
      const retained = preview.request({ recordingId, revisionId: first.revisionId }).published
        .preview;
      const held = cache.acquire(retained.cacheId);
      assert.ok(held);
      held.release();
      assert.deepEqual(await decode(retained.file, frames), report.renders[0].decoded);
      report.cache = {
        firstRevision: retained.revisionId,
        bytes: retained.bytes,
        readableAfterAttempt: true,
      };
      const cancelRevision = store.edit(recordingId, {
        operation: "cut",
        requestId: randomUUID(),
        expectedRevisionId: undo.id,
        ranges: Array.from({ length: 500 }, (_, i) => ({
          startUs: i * 1000 + 1,
          endUs: i === 499 ? 6000000 : (i + 1) * 1000,
        })),
      });
      const canceled = preview.request({ recordingId });
      await until(() => staged(attempts));
      jobs.cancel(canceled.jobId);
      await jobs.idle();
      assert.deepEqual(await readdir(attempts), []);
      assert.equal(jobs.job(canceled.jobId).state, "canceled");
      assert.equal(
        preview.request({ recordingId, revisionId: canceled.revisionId }).published,
        null,
      );
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
            kind === "deadline" && operation !== "storage.clearRenderWorkspace"
              ? { ...options, timeoutMs: 750 }
              : options,
          );
          if (kind === "late-abort" && operation !== "storage.clearRenderWorkspace") {
            assert.equal(response.ok, true);
            controller.abort();
          }
          return response;
        };
        const pending = withRenderedMedia(
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
      assert.deepEqual(await readFile(join(raw, "video.mov")), sourceBefore);
      assert.deepEqual(
        await Promise.all(
          ["narration", "system"].map((role) => readFile(join(raw, role + ".mov"))),
        ),
        audioBefore,
      );
      assert.deepEqual(await readFile(source), sourceBefore);
      assert.deepEqual(
        await Promise.all(
          ["narration", "system"].map((role) => readFile(join(home, role + ".mov"))),
        ),
        audioBefore,
      );
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
