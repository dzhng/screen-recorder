import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { mediaWorker } from "../../apps/service/dist/worker.js";
import { withRenderedMedia } from "../../apps/service/dist/render.js";
const execute = promisify(execFile);
const native =
  process.env.SCREENREC_NATIVE ??
  new URL("../../helpers/mac/.build/debug/screenrec-native", import.meta.url).pathname;
const lifetime = new URL("../../helpers/mac/.build/debug/ScreenRecorderMovieTests", import.meta.url)
  .pathname;
async function command(file, args) {
  return (await execute(file, args, { timeout: 60000, maxBuffer: 4 * 1024 * 1024 })).stdout;
}
async function until(check) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await delay(5);
  }
  throw new Error("Native assembly made no observed progress");
}
async function assemblyFile(parent) {
  for (const attempt of await readdir(parent))
    for (const stage of await readdir(join(parent, attempt)).catch(() => [])) {
      if (stage.startsWith(".movie-render-")) {
        const file = join(parent, attempt, stage, "movie.mp4");
        try {
          await readFile(file);
          return file;
        } catch {}
      }
    }
}
async function nativePid() {
  const rows = (await command("ps", ["-axo", "pid=,ppid=,comm="])).split("\n");
  for (const row of rows) {
    const match = row.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (match && Number(match[2]) === process.pid && match[3] === native) return Number(match[1]);
  }
}
test(
  "real movie worker owns publication, abort/deadline cleanup and native finalization",
  { timeout: 90000 },
  async () => {
    const home = await mkdtemp(join(tmpdir(), "screenrec-movie-lifetime-"));
    try {
      const attempts = join(home, "attempts");
      await mkdir(attempts);
      const source = join(home, "video.mp4"),
        audio = join(home, "audio.mov");
      await command("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x180:rate=10:duration=60",
        "-c:v",
        "libx264",
        "-bf",
        "0",
        "-movflags",
        "+faststart",
        "-an",
        source,
      ]);
      await command("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "aevalsrc=0.2*sin(2*PI*997*t)|0.2*sin(2*PI*1511*t):s=48000:d=60",
        "-c:a",
        "pcm_f32le",
        audio,
      ]);
      const before = await Promise.all([readFile(source), readFile(audio)]);
      const plan = [
        { source: { startUs: 0, endUs: 60000000 }, playback: { startUs: 0, endUs: 60000000 } },
      ];
      const request = {
        source,
        plan,
        tracks: [{ role: "system", source: audio, sourceOffsetUs: 0, available: [plan[0].source] }],
        attemptParent: attempts,
      };
      const run = mediaWorker({ SCREENREC_NATIVE: native });
      const controller = new AbortController();
      let observedPid, partial;
      const checked = async (...args) => {
        const result = await run(...args);
        assert.ok(observedPid);
        assert.throws(() => process.kill(observedPid, 0), { code: "ESRCH" });
        await readFile(partial);
        return result;
      };
      const pending = withRenderedMedia(checked, request, controller.signal, async () =>
        assert.fail("Canceled movie consumed"),
      );
      const rejected = assert.rejects(pending, { code: "CANCELED" });
      partial = await until(() => assemblyFile(attempts));
      observedPid = await until(nativePid);
      controller.abort();
      await rejected;
      assert.deepEqual(await readdir(attempts), []);
      await assert.rejects(
        withRenderedMedia(
          (op, params, options) => run(op, params, { ...options, timeoutMs: 150 }),
          request,
          new AbortController().signal,
          async () => assert.fail("Timed out movie consumed"),
        ),
        { code: "MEDIA_WORKER_TIMEOUT" },
      );
      assert.deepEqual(await readdir(attempts), []);
      const receipt = await withRenderedMedia(
        run,
        {
          ...request,
          plan: [
            { source: { startUs: 0, endUs: 1000000 }, playback: { startUs: 0, endUs: 1000000 } },
          ],
        },
        new AbortController().signal,
        async (media) => {
          assert.ok((await readFile(media.file)).length > 0);
          return media;
        },
      );
      assert.equal(receipt.audio.frames, 48000);
      assert.equal(receipt.audio.codec, "aac");
      assert.deepEqual(await readdir(attempts), []);
      await assert.rejects(
        withRenderedMedia(
          run,
          { ...request, tracks: [{ ...request.tracks[0], source: join(home, "missing.mov") }] },
          new AbortController().signal,
          async () => assert.fail("Failed movie consumed"),
        ),
        { code: "NATIVE_DECODE_FAILED" },
      );
      assert.deepEqual(await readdir(attempts), []);
      const terminal = JSON.parse(await command(lifetime, [home]));
      assert.equal(terminal.canceledWhileFinishing, true);
      assert.equal(terminal.failedWithinSeconds, 3);
      assert.deepEqual(await readFile(source), before[0]);
      assert.deepEqual(await readFile(audio), before[1]);
      console.log(
        JSON.stringify({
          nativeFinalization: terminal,
          abortAfterAssemblyStarted: true,
          closedBeforeReclaim: true,
          deadlineReclaimed: true,
          successfulAudioFrames: receipt.audio.frames,
        }),
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  },
);
