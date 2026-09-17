import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue } from "@screenrec/core/jobs";
import { PackageInspection } from "../../../service/dist/packages.js";
import { DerivativeDelivery } from "../../../service/dist/delivery.js";
import { mediaWorker } from "../../../service/dist/worker.js";
import { until } from "./public-service.mjs";

export async function packageMediaFailures(archive, native, kind = "frame") {
  const home = await realpath(await mkdtemp("/tmp/scr-frame-failure-"));
  const directory = join(home, "packages"),
    marker = join(home, "held"),
    library = join(home, "hold.dylib");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    execute: async () => {
      throw new Error("No library work expected");
    },
  });
  const delivery = new DerivativeDelivery(),
    nativeWorker = mediaWorker({ SCREENREC_NATIVE: native });
  let fail = true,
    hold = false,
    nativeStarted = false,
    nativeClosed = false,
    pid;
  const worker = async (operation, params, options) => {
    if (
      nativeStarted &&
      ["archive.removeOutput", "archive.cleanup", "packageWorkspace.remove"].includes(operation)
    )
      assert.equal(nativeClosed, true, "Output and workspace cleanup follow actual native closure");
    if (operation !== `media.${kind}`) return nativeWorker(operation, params, options);
    if (fail) {
      fail = false;
      return {
        ok: false,
        error: {
          code: "WORKER_EXIT",
          message: "Injected native failure at the worker boundary",
          retryable: true,
          details: {},
        },
      };
    }
    if (!hold) return nativeWorker(operation, params, options);
    const previousLibrary = process.env.DYLD_INSERT_LIBRARIES,
      previousMarker = process.env.SCREENREC_TEST_NATIVE_HELD;
    process.env.DYLD_INSERT_LIBRARIES = library;
    process.env.SCREENREC_TEST_NATIVE_HELD = marker;
    let pending;
    try {
      pending = nativeWorker(operation, params, { ...options, timeoutMs: 5000 });
      nativeStarted = true;
    } finally {
      if (previousLibrary === undefined) delete process.env.DYLD_INSERT_LIBRARIES;
      else process.env.DYLD_INSERT_LIBRARIES = previousLibrary;
      if (previousMarker === undefined) delete process.env.SCREENREC_TEST_NATIVE_HELD;
      else process.env.SCREENREC_TEST_NATIVE_HELD = previousMarker;
    }
    try {
      return await pending;
    } finally {
      nativeClosed = true;
    }
  };
  const packages = new PackageInspection({ directory, jobs, delivery, worker });
  try {
    await packages.prepare();
    const admitted = await packages.open(archive);
    const ready = await until(() => {
      const state = packages.status(admitted.id);
      assert.ok(!["failed", "cleanup_failed"].includes(state.state), JSON.stringify(state));
      return state.state === "ready" && state;
    }, "Media failure package did not open");
    const inspector = packages[kind === "frame" ? "frames" : "audio"](ready.packageHandle),
      request = {
        packageHandle: ready.packageHandle,
        ...(kind === "frame"
          ? { atUs: 100_000, clean: true, maxLongEdge: 96 }
          : { range: { startUs: 0, endUs: 250_000 }, track: "system" }),
      };
    const failed = await until(() => {
      const value = inspector.request(request);
      return value.state === "failed" && value;
    }, "Injected failure did not settle");
    assert.equal(failed.retryable, true);
    assert.deepEqual((await readdir(join(directory, admitted.id))).sort(), [".input", "content"]);
    inspector.retry(request);
    const result = await until(() => {
      const value = inspector.request(request);
      assert.notEqual(value.state, "failed", JSON.stringify(value));
      return value.state === "ready" && value;
    }, "Explicit retry did not finish");
    assert.equal(result.jobId, failed.jobId);
    assert.equal(result.published.generation, 2);
    const lease = delivery.open({ kind: "package", id: ready.packageHandle }, () =>
      inspector.openRead(result.published[kind]),
    );
    const signature =
      kind === "frame" ? Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) : Buffer.from("RIFF");
    assert.deepEqual(
      Buffer.from(delivery.read(lease.token, 0, signature.length).data, "base64"),
      signature,
    );
    execFileSync("/usr/bin/clang", [
      "-dynamiclib",
      "-o",
      library,
      fileURLToPath(
        new URL("../../../service/tests/fixtures/native-start-barrier.c", import.meta.url),
      ),
    ]);
    hold = true;
    inspector.request({
      ...request,
      ...(kind === "frame" ? { atUs: 200_000 } : { range: { startUs: 100_000, endUs: 350_000 } }),
    });
    pid = await until(async () => {
      const value = await readFile(marker, "utf8").catch((error) => {
        if (error.code === "ENOENT") return "";
        throw error;
      });
      return value && Number(value);
    }, "Actual native media worker did not enter its barrier");
    assert.equal(
      execFileSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,command="], {
        encoding: "utf8",
      }).trim(),
      `${process.pid} ${native}`,
    );
    await until(
      () =>
        execFileSync("/bin/ps", ["-p", String(pid), "-o", "state="], { encoding: "utf8" })
          .trim()
          .startsWith("T"),
      "Native child did not stop",
    );
    const closing = packages.close(admitted.id);
    assert.throws(() => inspector.request(request), { code: "CONTEXT_CLOSED" });
    assert.equal(delivery.read(lease.token, 0, 8).offset, 0);
    await closing;
    assert.equal(nativeClosed, true);
    assert.throws(
      () => process.kill(pid, 0),
      (error) => error.code === "ESRCH",
    );
    assert.ok(Date.now() < lease.expiresAt);
    assert.throws(() => delivery.read(lease.token, 0, 8), { code: "ARTIFACT_EXPIRED" });
    assert.deepEqual(await readdir(directory), []);
    assert.equal(store.catalog.prepare("SELECT COUNT(*) AS count FROM jobs").get().count, 0);
    return {
      injectedFailureRetried: true,
      failedOutputRemoved: true,
      actualNativeCloseDrained: true,
    };
  } finally {
    try {
      await packages.dispose();
    } finally {
      await jobs.close();
      delivery.dispose();
      store.close();
      await rm(home, { recursive: true, force: true });
    }
  }
}
