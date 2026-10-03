import assert from "node:assert/strict";
import { test } from "node:test";
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, copyFile, rm, writeFile, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Catalog } from "@screenrec/core/catalog";
import { AssetStore } from "@screenrec/core/assets";
import { AcquisitionStore, AcquisitionImporter } from "@screenrec/core/acquisitions";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { callLocal } from "@screenrec/client";
import { ManagedFiles } from "../dist/managed-files.js";
import { createProjectService } from "../dist/project-service.js";
import { mediaWorker } from "../dist/worker.js";
import { waitFor } from "../../macos/tests/harness.mjs";
import { withArchiveCopyBarrier } from "../../macos/tests/fixtures/archive-copy-barrier.mjs";
import {
  seedCapture,
  startPublicService,
  until,
} from "../../macos/tests/fixtures/public-service.mjs";
const native = process.env.SCREENREC_NATIVE ?? resolve("helpers/mac/.build/debug/screenrec-native");
if (process.argv[2] === "--child") {
  const [, , , home, recordingId, mode] = process.argv;
  const library = join(home, "library");
  if (mode === "removal") {
    const marker = join(home, "removal-held"),
      barrier = join(home, "removal-barrier.dylib");
    execFileSync("/usr/bin/clang", [
      "-dynamiclib",
      "-o",
      barrier,
      resolve("apps/service/tests/fixtures/native-start-barrier.c"),
    ]);
    const nativeWorker = mediaWorker({ SCREENREC_NATIVE: native });
    const files = new ManagedFiles(library, (operation, params, options) => {
      if (operation !== "storage.removeRecordingDirectory")
        return nativeWorker(operation, params, options);
      process.env.DYLD_INSERT_LIBRARIES = barrier;
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
    await withArchiveCopyBarrier(
      home,
      native,
      { operation: "media.sourceEvidence", minimumFd: 3 },
      async ({ worker, held }) => {
        const service = await createProjectService({ home, worker });
        const submitted = await callLocal(service.socketPath, {
          id: randomUUID(),
          operation: "acquisition.import",
          params: {
            requestId: randomUUID(),
            path: join(library, "recordings", recordingId, "source"),
          },
        });
        assert.equal(submitted.ok, true, JSON.stringify(submitted));
        const { pid } = await held;
        const db = new DatabaseSync(join(library, "catalog.sqlite"), { readOnly: true });
        let generation;
        try {
          generation = db
            .prepare("SELECT attemptId FROM jobs WHERE jobId=?")
            .get(submitted.data.jobId).attemptId;
        } finally {
          db.close();
        }
        process.send({
          pid,
          generation,
          jobId: submitted.data.jobId,
          acquisitionId: submitted.data.target.acquisitionId,
        });
        await new Promise(() => {});
      },
    );
  }
} else {
  for (const mode of ["cleanup", "delete", "removal"])
    test(`orphan native acquisition protects its workspace and capture donor during ${mode}`, async (t) => {
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
      const take = await seedCapture(home, {
        recordingId: randomUUID(),
        sourceId: "complete",
        sourceDurationUs: 3000000,
      });
      const library = join(home, "library"),
        root = join(library, "recordings", take.recordingId),
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
        ? join(library, "acquisitions", held.acquisitionId, held.generation)
        : null;
      let refusal;
      if (generation) {
        const catalog = new Catalog(join(library, "catalog.sqlite"));
        try {
          const assets = new AssetStore(catalog, library),
            acquisitions = new AcquisitionStore(catalog);
          const evidence = new SourceEvidenceStore(catalog, (identity) =>
            acquisitions.intent(identity.owner.acquisitionId),
          );
          const importer = new AcquisitionImporter(
            catalog,
            acquisitions,
            assets,
            evidence,
            library,
          );
          await assert.rejects(importer.recover(new AbortController().signal), {
            code: "ACQUISITION_BUSY",
            retryable: true,
          });
          await access(generation);
          refusal = "ACQUISITION_BUSY";
        } finally {
          catalog.close();
        }
      }
      if (mode !== "cleanup") {
        const files = new ManagedFiles(library, mediaWorker({ SCREENREC_NATIVE: native }));
        await assert.rejects(files.recordingDirectory(take.recordingId), {
          code: "RECORDING_BUSY",
          retryable: true,
        });
        refusal = "RECORDING_BUSY";
      }
      assert.deepEqual(await readFile(join(source, "capture.journal.jsonl")), journal);
      const report = {
        mode,
        stoppedNativeState: state,
        generation,
        refusal,
        workspaceRetained: generation ? true : null,
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
      service = await startPublicService(home, native);
      if (mode !== "cleanup") {
        report.after = await service.call("recording.delete", { recordingId: take.recordingId });
        assert.equal(report.after.ok, true, JSON.stringify(report.after));
        assert.equal(report.after.data.deleted, true);
        await assert.rejects(access(root), { code: "ENOENT" });
      } else {
        await assert.rejects(access(generation), { code: "ENOENT" });
        const retry = await service.call("job.retry", { jobId: held.jobId });
        assert.equal(retry.ok, true, JSON.stringify(retry));
        report.after = await until(async () => {
          const result = await service.call("job.get", { jobId: held.jobId });
          assert.equal(result.ok, true, JSON.stringify(result));
          assert.ok(
            !["failed", "canceled", "unavailable"].includes(result.data.state),
            JSON.stringify(result),
          );
          return result.data.state === "ready" && result.data;
        }, "Source acquisition retry");
        assert.deepEqual(await readFile(join(source, "capture.journal.jsonl")), journal);
      }
      await save();
    });
}
