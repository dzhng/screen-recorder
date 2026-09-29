import assert from "node:assert/strict";
import { test } from "node:test";
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, copyFile, rm, writeFile, access, chmod } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import { SourceEvidenceStore, recordingEvidenceOwner } from "@screenrec/core/evidence";
import { SourceProcessing } from "@screenrec/core/processing";
import { ManagedFiles } from "../dist/managed-files.js";
import { mediaWorker } from "../dist/worker.js";
import { sourceExporter } from "../dist/source-export.js";
import { waitFor } from "../../macos/tests/harness.mjs";
import { withArchiveCopyBarrier } from "../../macos/tests/fixtures/archive-copy-barrier.mjs";
import {
  seedPublicRecording,
  startPublicService,
} from "../../macos/tests/fixtures/public-service.mjs";
const native = process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native");
if (process.argv[2] === "--child") {
  const [, , , home, recordingId, mode] = process.argv;
  if (mode === "removal") {
    const marker = join(home, "removal-held"),
      library = join(home, "removal-barrier.dylib");
    execFileSync("/usr/bin/clang", [
      "-dynamiclib",
      "-o",
      library,
      resolve("apps/service/tests/fixtures/native-start-barrier.c"),
    ]);
    const nativeWorker = mediaWorker({ SCREENREC_NATIVE: native });
    const files = new ManagedFiles(home, (operation, params, options) => {
      if (operation !== "storage.removeRecordingDirectory")
        return nativeWorker(operation, params, options);
      process.env.DYLD_INSERT_LIBRARIES = library;
      process.env.SCREENREC_TEST_NATIVE_HELD = marker;
      try {
        return nativeWorker(operation, params, { ...options, timeoutMs: 5000 });
      } finally {
        delete process.env.DYLD_INSERT_LIBRARIES;
        delete process.env.SCREENREC_TEST_NATIVE_HELD;
      }
    });
    const lifetime = await files.recordingDirectory(recordingId);
    const pending = files.removeRecordingDirectory(
      recordingId,
      new AbortController().signal,
      lifetime.handle,
    );
    const pid = await waitFor(
      async () => Number(await readFile(marker, "utf8").catch(() => "")),
      4000,
    );
    process.send({ pid, generation: null });
    await pending;
    await lifetime.handle.close();
  } else {
    const store = new RevisionStore(join(home, "library.sqlite"));
    const evidence = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
    await withArchiveCopyBarrier(
      home,
      native,
      { operation: "media.sourceEvidence", minimumFd: 3 },
      async ({ worker, held, drain }) => {
        let processing;
        const jobs = new JobQueue({
          store,
          targets: recordingJobTargets(store),
          providers: { newId: randomUUID },
          execute: (work) => processing.execute(work),
        });
        processing = new SourceProcessing(store, jobs, evidence, home, sourceExporter(worker));
        const status = processing.retry(recordingId);
        drain(jobs.idle());
        const { pid } = await held;
        const generation = jobs.job(status.jobId).attemptId;
        process.send({ pid, generation, jobId: status.jobId });
        await new Promise(() => {});
      },
    );
  }
} else {
  for (const mode of ["cleanup", "delete", "removal"])
    test(`orphan native worker protects generation and recording ${mode}`, async (t) => {
      const home = await mkdtemp("/tmp/source-lifetime-");
      let child, pid, service;
      t.after(async () => {
        child?.kill("SIGKILL");
        if (pid) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {}
        }
        await service?.close();
        await rm(home, { recursive: true, force: true });
      });
      const take = await seedPublicRecording(home, {
        recordingId: randomUUID(),
        sourceId: "complete",
        sourceDurationUs: 3000000,
      });
      const root = join(home, "recordings", take.recordingId),
        source = join(root, "source");
      execFileSync("tar", [
        "-xzf",
        resolve("specs/agent-editing/assets/20d-canonical-admission/evidence.tar.gz"),
        "-C",
        source,
        "--strip-components=1",
        "canonical-input",
      ]);
      await copyFile(
        resolve("specs/agent-editing/assets/00-corpus/video-only.mov"),
        join(source, "video.mov"),
      );
      const journal = await readFile(join(source, "capture.journal.jsonl"));
      child = fork(fileURLToPath(import.meta.url), ["--child", home, take.recordingId, mode], {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
      let received,
        diagnostics = "";
      child.on("message", (value) => {
        received = value;
      });
      child.stderr.on("data", (value) => {
        diagnostics += value;
      });
      const held = await waitFor(() => received, 10000).catch((error) => {
        throw new Error(`${error}: ${diagnostics}`);
      });
      pid = held.pid;
      const state = execFileSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,state="], {
        encoding: "utf8",
      }).trim();
      assert.match(state, new RegExp(`^${child.pid}\\s+T`));
      const exit = once(child, "exit");
      child.kill("SIGKILL");
      await exit;
      const generation = held.generation
        ? join(root, "evidence", "source", held.generation)
        : undefined;
      const unrelated = join(root, "evidence", "source", "abandoned-unrelated");
      await mkdir(unrelated, { recursive: true });
      await writeFile(join(unrelated, "partial"), "unpublished");
      service = await startPublicService(home, native);
      if (mode !== "removal")
        await waitFor(
          () =>
            access(unrelated).then(
              () => false,
              (error) => error.code === "ENOENT",
            ),
          10000,
        );
      const generationPresent = generation
        ? await access(generation).then(
            () => true,
            () => false,
          )
        : null;
      const before = await service.call("processing.status", {
        recordingId: take.recordingId,
        artifact: "source",
      });
      let refusal;
      if (mode !== "cleanup")
        refusal = await service.call("recording.delete", { recordingId: take.recordingId });
      const report = {
        mode,
        stoppedNativeState: state,
        generationPresent,
        before,
        refusal,
        unrelatedReclaimed: await access(unrelated).then(
          () => false,
          () => true,
        ),
      };
      const save = async () => {
        if (!process.env.SCREENREC_SOURCE_LIFETIME_OUTPUT) return;
        await mkdir(process.env.SCREENREC_SOURCE_LIFETIME_OUTPUT, { recursive: true });
        await writeFile(
          join(process.env.SCREENREC_SOURCE_LIFETIME_OUTPUT, `${mode}.json`),
          JSON.stringify(report, null, 2),
        );
      };
      await save();
      if (generation)
        assert(generationPresent, "Startup cleanup must preserve a generation owned by the orphan");
      if (mode !== "cleanup") {
        assert.equal(refusal.ok, false, JSON.stringify(refusal));
        assert.equal(refusal.error.code, "RECORDING_BUSY");
        assert.equal(refusal.error.retryable, true);
        assert.deepEqual(await readFile(join(source, "capture.journal.jsonl")), journal);
        if (generation) await access(generation);
        else await access(unrelated);
      }
      process.kill(pid, "SIGKILL");
      await waitFor(() => {
        try {
          process.kill(pid, 0);
          return false;
        } catch {
          return true;
        }
      }, 5000);
      pid = undefined;
      if (mode !== "cleanup") {
        report.after = await service.call("recording.delete", { recordingId: take.recordingId });
        assert.equal(report.after.ok, true, JSON.stringify(report.after));
        assert.equal(report.after.data.deleted, true);
        await assert.rejects(access(root), { code: "ENOENT" });
      } else {
        const retry = await service.call("processing.retry", {
          recordingId: take.recordingId,
          artifact: "source",
        });
        assert.equal(retry.ok, true, JSON.stringify(retry));
        report.after = await waitFor(async () => {
          const result = await service.call("processing.status", {
            recordingId: take.recordingId,
            artifact: "source",
          });
          assert(result.ok, JSON.stringify(result));
          if (result.data.state === "failed") throw new Error(JSON.stringify(result));
          return result.data.state === "ready" && result.data;
        }, 10000);
        await assert.rejects(access(generation), { code: "ENOENT" });
        assert.notEqual(report.after.published.generation, held.generation);
        assert.equal(report.after.published.evidence.receipt.audioIntervals, 2);
        assert.deepEqual(await readFile(join(source, "capture.journal.jsonl")), journal);
      }
      report.passed = true;
      await save();
    });
}
