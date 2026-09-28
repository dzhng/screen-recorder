import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  rename,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { mediaWorker } from "../../apps/service/dist/worker.js";
import { clearRenderWorkspace, withRenderedMedia } from "../../apps/service/dist/render.js";
const execute = promisify(execFile);
const native = await realpath(
  process.env.SCREENREC_NATIVE ??
    new URL("../../helpers/mac/.build/debug/screenrec-native", import.meta.url).pathname,
);
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
      const file = join(parent, attempt, stage, "movie.mp4");
      try {
        await readFile(file);
        return file;
      } catch {}
    }
}
async function stagingSnapshot(parent) {
  const entries = {};
  async function visit(path, relative = "") {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const name = join(relative, entry.name),
        file = join(path, entry.name);
      if (entry.isDirectory()) {
        entries[name] = "directory";
        await visit(file, name);
      } else
        entries[name] = createHash("sha256")
          .update(await readFile(file))
          .digest("hex");
    }
  }
  await visit(parent);
  return entries;
}
async function nativePid(parent = process.pid) {
  const rows = (await command("ps", ["-axo", "pid=,ppid=,comm="])).split("\n");
  for (const row of rows) {
    const match = row.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (match && Number(match[2]) === parent && match[3] === native) return Number(match[1]);
  }
}
async function orphanedWorker(request, preparation, nativeWorker) {
  const renderURL = new URL("../../apps/service/dist/render.js", import.meta.url).href;
  const workerURL = new URL("../../apps/service/dist/worker.js", import.meta.url).href;
  const code = `
    import {withRenderedMedia} from ${JSON.stringify(renderURL)};
    import {mediaWorker} from ${JSON.stringify(workerURL)};
    import {join} from 'node:path';
    const request=${JSON.stringify(request)};
    if(${preparation}) request.preparePointer=async(directory, worker, signal)=>{
      await worker('media.presentationEvidence',{source:request.source,plan:request.plan,
        output:join(directory,'presentation.jsonl'),maxBytes:64000000},{signal});
      throw new Error('Preparation completed before orphan proof');
    };
    await withRenderedMedia(mediaWorker({SCREENREC_NATIVE:${JSON.stringify(native)}}),
      request,new AbortController().signal,async()=>{throw new Error('Render completed before orphan proof')});
  `;
  const owner = spawn(process.execPath, ["--input-type=module", "-e", code], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let errors = "";
  owner.stderr.on("data", (x) => (errors += x));
  const closed = new Promise((resolve) => owner.once("close", resolve));
  let pid;
  // A worker this lab stops must never be left stopped: a run that is interrupted between the
  // SIGSTOP and its own cleanup would otherwise leave a native process frozen on this person's
  // Mac, holding its workspace open, until they found and killed it themselves.
  const release = () => {
    if (!pid) return;
    try {
      process.kill(pid, "SIGCONT");
      process.kill(pid, "SIGKILL");
    } catch {
      // It has already gone.
    }
    pid = undefined;
  };
  process.once("exit", release);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      release();
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
    });
  }
  try {
    await until(async () => {
      assert.equal(owner.exitCode, null, errors);
      for (const entry of await readdir(request.attemptParent)) {
        const entries = await readdir(join(request.attemptParent, entry), {
          withFileTypes: true,
        }).catch(() => []);
        if (entries.some((value) => value.isDirectory())) {
          pid = await nativePid(owner.pid);
          if (pid) {
            process.kill(pid, "SIGSTOP");
            return true;
          }
        }
      }
    });
    owner.kill("SIGKILL");
    await closed;
    const abandoned = await readdir(request.attemptParent);
    assert.ok(abandoned.length > 0);
    const held = await stagingSnapshot(request.attemptParent);
    const began = Date.now();
    await assert.rejects(
      clearRenderWorkspace(nativeWorker, request.attemptParent, new AbortController().signal),
      { code: "RENDER_WORKSPACE_BUSY", retryable: true },
    );
    const busyMs = Date.now() - began;
    const short = {
      ...request,
      plan: [{ source: { startUs: 0, endUs: 1000000 }, playback: { startUs: 0, endUs: 1000000 } }],
    };
    const concurrentBytes = await withRenderedMedia(
      nativeWorker,
      short,
      new AbortController().signal,
      async (media) => (await readFile(media.file)).length,
    );
    assert.ok(concurrentBytes > 0);
    assert.deepEqual(await readdir(request.attemptParent), abandoned);
    assert.deepEqual(await stagingSnapshot(request.attemptParent), held);
    await assert.rejects(
      clearRenderWorkspace(nativeWorker, request.attemptParent, new AbortController().signal),
      { code: "RENDER_WORKSPACE_BUSY", retryable: true },
    );
    process.kill(pid, "SIGKILL");
    await until(() => {
      try {
        process.kill(pid, 0);
        return false;
      } catch (error) {
        if (error.code === "ESRCH") return true;
        throw error;
      }
    });
    pid = undefined;
    await clearRenderWorkspace(nativeWorker, request.attemptParent, new AbortController().signal);
    assert.deepEqual(await readdir(request.attemptParent), []);
    const bytes = await withRenderedMedia(
      nativeWorker,
      short,
      new AbortController().signal,
      async (media) => (await readFile(media.file)).length,
    );
    assert.ok(bytes > 0);
    assert.deepEqual(await readdir(request.attemptParent), []);
    return {
      preparation,
      parentKilled: true,
      independentAttemptSucceeded: true,
      orphanStagingUnchanged: true,
      startupBarrierBlocked: true,
      busyMs,
      reusedAfterWorkerExit: true,
    };
  } finally {
    owner.kill("SIGKILL");
    release();
    process.removeListener("exit", release);
    await closed;
  }
}

test(
  "real movie worker owns publication, abort/deadline cleanup and native finalization",
  { timeout: 90000 },
  async () => {
    const home = await mkdtemp(join(tmpdir(), "screenrec-movie-lifetime-"));
    try {
      const attempts = join(home, "attempts");
      await mkdir(attempts, { mode: 0o700 });
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
        if (args[0] === "storage.clearRenderWorkspace") return result;
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
          (op, params, options) =>
            run(
              op,
              params,
              op === "storage.clearRenderWorkspace" ? options : { ...options, timeoutMs: 150 },
            ),
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
      const restart = [];
      for (const preparation of [false, true])
        restart.push(await orphanedWorker(request, preparation, run));
      const external = join(home, "external"),
        moved = join(home, "moved-attempts");
      await mkdir(external);
      await writeFile(join(external, "sentinel"), "outside");
      await symlink(external, join(attempts, "abandoned-link"));
      // Only startup admission clears stale siblings; live attempts clean their own child.
      await clearRenderWorkspace(run, attempts, new AbortController().signal);
      await withRenderedMedia(
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
          await rename(attempts, moved);
          await symlink(external, attempts);
        },
      );
      assert.equal(await readFile(join(external, "sentinel"), "utf8"), "outside");
      assert.deepEqual(await readdir(moved), []);
      assert.deepEqual(await readdir(external), ["sentinel"]);
      const terminal = JSON.parse(await command(lifetime, [home]));
      assert.equal(terminal.canceledWhileFinishing, true);
      assert.equal(terminal.failedWithinSeconds, 3);
      assert.deepEqual(await readFile(source), before[0]);
      assert.deepEqual(await readFile(audio), before[1]);
      console.log(
        JSON.stringify({
          nativeFinalization: terminal,
          restart,
          descriptorCleanupSurvivedReplacement: true,
          externalSentinelUnchanged: true,
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
