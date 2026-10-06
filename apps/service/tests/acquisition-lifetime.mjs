import assert from "node:assert/strict";
import { test } from "node:test";
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, copyFile, rm, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Catalog } from "@yap/core/catalog";
import { AssetStore } from "@yap/core/assets";
import { AcquisitionStore, AcquisitionImporter } from "@yap/core/acquisitions";
import { SourceEvidenceStore } from "@yap/core/evidence";
import { mediaWorker, nativeResult } from "../dist/worker.js";
import { sourceExporter } from "../dist/source-export.js";
import { waitFor } from "../../macos/tests/harness.mjs";
const binary = process.env.YAP_NATIVE ?? resolve("helpers/mac/.build/debug/yap-native");
function owners(root) {
  const catalog = new Catalog(join(root, "catalog.sqlite"));
  const assets = new AssetStore(catalog, root);
  const store = new AcquisitionStore(catalog);
  const evidence = new SourceEvidenceStore(catalog, () => {});
  return {
    catalog,
    assets,
    store,
    importer: new AcquisitionImporter(catalog, store, assets, evidence, root),
  };
}
if (process.argv[2] === "--child") {
  const [, , , root, donor, operation, marker, library] = process.argv;
  const f = owners(root);
  await f.assets.recover();
  await f.importer.recover(new AbortController().signal);
  const prepared = await f.importer.prepareImport("orphan", donor);
  const intent = f.store.admitImport(prepared);
  f.store.admitPortable("pending-package", "fixture-package");
  const native = mediaWorker({ YAP_NATIVE: binary });
  const worker = (name, params, options) => {
    if (name !== operation) return native(name, params, options);
    process.env.DYLD_INSERT_LIBRARIES = library;
    process.env.YAP_TEST_COPY_BARRIER = marker;
    process.env.YAP_TEST_COPY_MIN_FD = "3";
    try {
      return native(name, params, options);
    } finally {
      delete process.env.DYLD_INSERT_LIBRARIES;
      delete process.env.YAP_TEST_COPY_BARRIER;
      delete process.env.YAP_TEST_COPY_MIN_FD;
    }
  };
  process.send({ acquisitionId: intent.acquisitionId });
  await f.importer.executeImport(
    intent.acquisitionId,
    "attempt",
    {
      exportSource: sourceExporter(worker),
      probe: async (path, signal, lifetime) =>
        nativeResult(
          await worker(
            "media.probe",
            { path },
            { signal, descriptors: lifetime ? [lifetime.fd] : [] },
          ),
        ),
    },
    new AbortController().signal,
  );
  throw new Error("Expected the selected native operation to remain held");
} else {
  for (const operation of ["media.sourceEvidence", "media.probe"])
    test(`orphan ${operation} retains acquisition recovery ownership`, async (t) => {
      const root = await mkdtemp("/tmp/acquisition-lifetime-");
      let child, pid, f;
      t.after(async () => {
        child?.kill("SIGKILL");
        if (pid) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {}
        }
        f?.catalog.close();
        await rm(root, { recursive: true, force: true });
      });
      const donor = join(root, "donor");
      await mkdir(donor);
      execFileSync("tar", [
        "-xzf",
        resolve("specs/done/agent-editing/assets/20d-canonical-admission/evidence.tar.gz"),
        "-C",
        donor,
        "--strip-components=1",
        "canonical-input",
      ]);
      await copyFile(
        resolve("specs/done/agent-editing/assets/00-corpus/video-only.mov"),
        join(donor, "video.mov"),
      );
      const marker = join(root, "held"),
        library = join(root, "barrier.dylib");
      execFileSync("/usr/bin/clang", [
        "-dynamiclib",
        "-o",
        library,
        resolve("apps/macos/tests/fixtures/archive-copy-barrier.c"),
      ]);
      child = fork(
        fileURLToPath(import.meta.url),
        ["--child", root, donor, operation, marker, library],
        { stdio: ["ignore", "pipe", "pipe", "ipc"] },
      );
      let diagnostics = "",
        received;
      child.on("message", (value) => {
        received = value;
      });
      child.stderr.on("data", (data) => {
        diagnostics += data;
      });
      const admission = await waitFor(() => received, 10000).catch((error) => {
        throw new Error(`${error}: ${diagnostics}`);
      });
      pid = await waitFor(
        async () => Number(await readFile(marker, "utf8").catch(() => "")),
        10000,
      );
      assert(pid, diagnostics);
      const state = execFileSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,state="], {
        encoding: "utf8",
      });
      assert.match(state, new RegExp(`\\b${child.pid}\\s+T`));
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
      f = owners(root);
      const before = f.catalog.catalog.prepare("SELECT * FROM acquisitions ORDER BY id").all();
      const source = join(
        root,
        "acquisitions",
        admission.acquisitionId,
        "attempt",
        "source",
        "capture.journal.jsonl",
      );
      const journal = await readFile(source);
      let recoveryFailure;
      try {
        await f.importer.recover(new AbortController().signal);
      } catch (error) {
        recoveryFailure = error;
      }
      if (process.env.YAP_ACQUISITION_LIFETIME_OUTPUT) {
        await mkdir(process.env.YAP_ACQUISITION_LIFETIME_OUTPUT, { recursive: true });
        await writeFile(
          join(process.env.YAP_ACQUISITION_LIFETIME_OUTPUT, `${operation}-held.json`),
          JSON.stringify(
            {
              operation,
              stoppedNativeState: state.trim(),
              before,
              after: f.catalog.catalog.prepare("SELECT * FROM acquisitions ORDER BY id").all(),
              journalStillPresent: await readFile(source).then(
                (value) => value.equals(journal),
                () => false,
              ),
              recovery: recoveryFailure
                ? { code: recoveryFailure.code, retryable: recoveryFailure.retryable }
                : "completed",
            },
            null,
            2,
          ),
        );
      }
      assert.equal(recoveryFailure?.code, "ACQUISITION_BUSY");
      assert.equal(recoveryFailure.retryable, true);
      assert.deepEqual(
        f.catalog.catalog.prepare("SELECT * FROM acquisitions ORDER BY id").all(),
        before,
      );
      assert.deepEqual(await readFile(source), journal);
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
      await f.importer.recover(new AbortController().signal);
      assert.equal(
        f.catalog.catalog.prepare("SELECT 1 FROM acquisitions WHERE id='pending-package'").get(),
        undefined,
      );
      assert.deepEqual(await readdir(join(root, "acquisitions")), []);
      if (process.env.YAP_ACQUISITION_LIFETIME_OUTPUT) {
        await mkdir(process.env.YAP_ACQUISITION_LIFETIME_OUTPUT, { recursive: true });
        await writeFile(
          join(process.env.YAP_ACQUISITION_LIFETIME_OUTPUT, `${operation}.json`),
          JSON.stringify(
            {
              operation,
              stoppedNativeState: state.trim(),
              preservedAcquisitions: before,
              preservedJournalBytes: journal.length,
              busy: true,
              recoveredAfterChildExit: true,
            },
            null,
            2,
          ),
        );
      }
    });
}
