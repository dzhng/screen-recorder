import assert from "node:assert/strict";
import { readSync, fstatSync } from "node:fs";
import { readFile, readdir, rename, symlink, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { setImmediate } from "node:timers/promises";
import { openPackageArchive } from "../../../service/dist/package-archive.js";

export async function packageOutputReuse(archive, directory, handle, worker) {
  const params = {
    source: "source/video.mov",
    output: "reused",
    atSourceUs: 1_100_000,
    kept: { startUs: 0, endUs: 4_000_000 },
    overlay: null,
  };
  let context,
    activeWorkers = 0,
    peakWorkers = 0;
  let heldRead = null;
  const trackedWorker = async (...args) => {
    if (args[0] === "archive.removeOutput")
      assert.equal(heldRead, null, "Cleanup must wait for the held read");
    activeWorkers++;
    peakWorkers = Math.max(peakWorkers, activeWorkers);
    try {
      return await worker(...args);
    } finally {
      activeWorkers--;
    }
  };
  try {
    context = await openPackageArchive(archive, { directory, handle }, trackedWorker);
    for (let i = 0; i < 40; i++) {
      await context.run("media.frame", params);
      const read = context.openOutput("reused"),
        size = fstatSync(read.fd).size;
      heldRead = read;
      const releasing = context.releaseOutput("reused");
      await setImmediate();
      assert.equal(context.outputUsage().actualBytes, size);
      assert.throws(() => context.openOutput("reused"));
      const png = Buffer.alloc(8);
      assert.equal(readSync(read.fd, png, 0, 8, 0), 8);
      assert.deepEqual([...png], [137, 80, 78, 71, 13, 10, 26, 10]);
      read.close();
      heldRead = null;
      await releasing;
      assert.deepEqual(context.outputUsage(), { actualBytes: 0, reservedBytes: 0, outputs: 0 });
      assert.deepEqual((await readdir(directory)).sort(), [".input", "content"]);
      await assert.rejects(context.run("media.frame", { ...params, atSourceUs: -1 }));
      assert.deepEqual(context.outputUsage(), { actualBytes: 0, reservedBytes: 0, outputs: 0 });
    }
    for (const output of ["one", "two", "three"])
      await context.run("media.frame", { ...params, output });
    const releases = ["one", "two", "three"].map((label) => context.releaseOutput(label));
    await Promise.all([
      ...releases,
      context.run("media.frame", { ...params, output: "during-release" }),
    ]);
    await context.releaseOutput("during-release");
    assert.equal(
      peakWorkers,
      1,
      "media and concurrent release calls must share one native worker lifetime",
    );
    await context.run("media.frame", params);
    const held = context.openOutput("reused"),
      releasing = context.releaseOutput("reused");
    await Promise.all([context.close(), releasing]);
    assert.throws(() => held.fd);
    held.close();
    assert.deepEqual(context.outputUsage(), { actualBytes: 0, reservedBytes: 0, outputs: 0 });
    assert.deepEqual(await readdir(directory), []);
    const removalStarted = Promise.withResolvers(),
      allowRemoval = Promise.withResolvers();
    let removalCalls = 0;
    context = await openPackageArchive(
      archive,
      { directory, handle },
      async (operation, input, options) => {
        if (operation === "archive.removeOutput") {
          removalCalls++;
          removalStarted.resolve();
          await allowRemoval.promise;
        }
        return worker(operation, input, options);
      },
    );
    const failed = assert.rejects(context.run("media.frame", { ...params, atSourceUs: -1 }));
    try {
      await Promise.race([
        removalStarted.promise,
        failed.then(() => {
          throw new Error("Failed output never entered cleanup");
        }),
      ]);
      const released = context.releaseOutput("reused");
      allowRemoval.resolve();
      await Promise.all([failed, released]);
      assert.equal(removalCalls, 1);
      assert.deepEqual(context.outputUsage(), { actualBytes: 0, reservedBytes: 0, outputs: 0 });
    } finally {
      allowRemoval.resolve();
      await failed;
    }
    await context.close();
    context = await openPackageArchive(
      archive,
      { directory, handle },
      async (operation, input, options) => {
        if (operation === "archive.createOutput") await mkdir(join(directory, input.name));
        return worker(operation, input, options);
      },
    );
    await assert.rejects(context.run("media.frame", params), { code: "OUTPUT_CLEANUP_FAILED" });
    assert.deepEqual(context.outputUsage(), {
      actualBytes: 0,
      reservedBytes: 32 * 1024 ** 2,
      outputs: 1,
    });
    await context.close();
    assert.deepEqual(context.outputUsage(), { actualBytes: 0, reservedBytes: 0, outputs: 0 });
    const sentinel = join(dirname(directory), "output-cleanup-sentinel");
    await writeFile(sentinel, "untouched");
    context = await openPackageArchive(
      archive,
      { directory, handle },
      async (operation, input, options) => {
        if (operation === "archive.removeOutput") {
          await rename(join(directory, input.name), join(directory, input.name + ".retained"));
          await symlink(sentinel, join(directory, input.name));
        }
        return worker(operation, input, options);
      },
    );
    await context.run("media.frame", params);
    const charged = context.outputUsage();
    await assert.rejects(context.releaseOutput("reused"));
    assert.deepEqual(context.outputUsage(), charged, "failed removal must not return credit");
    assert.equal(await readFile(sentinel, "utf8"), "untouched");
    await context.close();
    assert.deepEqual(await readdir(directory), []);
    assert.equal(await readFile(sentinel, "utf8"), "untouched");
    assert.deepEqual(context.outputUsage(), { actualBytes: 0, reservedBytes: 0, outputs: 0 });
    return {
      successfulRequests: 46,
      failedRequests: 41,
      joinedFailedOutputCleanup: true,
      unconfirmedCreationRetainedUntilClose: true,
      peakNativeWorkers: peakWorkers,
      heldReadPreserved: true,
      closeDrainedRelease: true,
      failedRemovalRetainedCredit: true,
      externalSentinelUnchanged: true,
    };
  } finally {
    await context?.close();
  }
}
