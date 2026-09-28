import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import { DerivedCache, recordingCacheOwnerCheck } from "@screenrec/core/cache";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import { SourceProcessing } from "@screenrec/core/processing";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { SceneProcessing } from "@screenrec/core/scene-processing";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

// Optional companion to lab:index-scale; never regenerates or edits the supplied input.
// SCREENREC_FRAME_CACHE_VIDEO names an existing generated 30-minute video, copied into scratch.
// SCREENREC_FRAME_CACHE_EVIDENCE optionally names a new JSON receipt file.
const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
const durationUs = 1_800_000_000;
async function hash(path) {
  const value = createHash("sha256");
  for await (const bytes of createReadStream(path)) value.update(bytes);
  return value.digest("hex");
}
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20_000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

async function fixture(home, input) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  let jobs;
  try {
    // The existing capture priority holds admissions while owner APIs seed canceled dependencies.
    const blocker = store.allocate().recording,
      take = store.allocate().recording;
    store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "generated clean-frame cache companion",
      sourceDurationUs: durationUs,
    });
    jobs = new JobQueue({
      store,
      targets: recordingJobTargets(store),
      providers: { newId: randomUUID },
      execute: async () => {
        throw new Error("Fixture seeding must not execute media");
      },
    });
    const source = new SourceProcessing(
      store,
      jobs,
      new SourceEvidenceStore(store),
      home,
      async () => {
        throw new Error("No fixture exporter");
      },
    );
    const scenes = new SceneProcessing(
      store,
      jobs,
      new SceneEvidenceStore(store),
      home,
      async () => {
        throw new Error("No fixture sampler");
      },
    );
    for (const owner of [source, scenes]) {
      owner.prepare(take.recordingId);
      const status = owner.status(take.recordingId);
      assert.equal(status.state, "queued");
      assert.equal(jobs.cancel(status.jobId).state, "canceled");
    }
    store.ingestLifecycle(blocker.recordingId, {
      sourceId: blocker.sourceId,
      sequence: 1,
      state: "canceled",
    });
    const directory = join(home, "recordings", take.recordingId, "source");
    await mkdir(directory, { recursive: true });
    const video = join(directory, "video.mov");
    await copyFile(input, video);
    return { ...take, video };
  } finally {
    await jobs?.close();
    store.close();
  }
}

async function fileIdentity(path) {
  const stat = await lstat(path, { bigint: true });
  return {
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    size: stat.size.toString(),
    mtimeNs: stat.mtimeNs.toString(),
  };
}

test(
  "30-minute clean frame hits cache, survives LRU eviction, and leaves source unchanged",
  { timeout: 90_000 },
  async () => {
    const input = process.env.SCREENREC_FRAME_CACHE_VIDEO;
    assert.ok(
      input && isAbsolute(input),
      "Set SCREENREC_FRAME_CACHE_VIDEO to the preserved generated 30-minute video",
    );
    const probe = JSON.parse(
      run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", input]),
    );
    assert.equal(Math.round(Number(probe.format.duration) * 1_000_000), durationUs);
    const originalHash = await hash(input);
    const home = temporary("/tmp/scr-frame-cache-scale-");
    const take = await fixture(home, input);
    assert.equal(await hash(take.video), originalHash);
    let { instance } = await launchReady(home);
    const call = async (operation, params = {}) => {
      const result = await callLocal(
        socketPath(home),
        { id: randomUUID(), operation, params },
        { timeoutMs: 20_000 },
      );
      assert.equal(result.ok, true, JSON.stringify(result));
      return result.data;
    };
    const params = {
      recordingId: take.recordingId,
      revisionId: "r0",
      atUs: 1_200_000_000,
      clean: true,
    };
    const ready = () =>
      waitFor(async () => {
        const result = await call("frame.get", params);
        assert.ok(!["failed", "unavailable"].includes(result.state), JSON.stringify(result));
        if (result.state !== "ready") return false;
        await call("artifact.close", { token: result.delivery.token });
        return result;
      }, 20_000);
    const first = await ready(),
      firstFrame = first.published.frame;
    const firstIdentity = await fileIdentity(firstFrame.file),
      firstBytes = await readFile(firstFrame.file);
    const output = join(home, "cache-hit.png");
    const repeated = JSON.parse(
      run(process.execPath, [
        cli,
        "frame.get",
        "--socket",
        socketPath(home),
        "--params",
        JSON.stringify(params),
        "--output",
        output,
      ]),
    );
    assert.equal(repeated.ok, true);
    assert.deepEqual(repeated.data.published, first.published);
    assert.deepEqual(await fileIdentity(firstFrame.file), firstIdentity);
    assert.deepEqual(await readFile(output), firstBytes);
    assert.equal(await hash(take.video), originalHash);
    assert.deepEqual(await instance.reap(), []);

    const catalog = new RevisionStore(join(home, "library.sqlite"));
    let states;
    try {
      states = catalog.catalog
        .prepare(
          "SELECT artifact,state FROM jobs WHERE targetKind='recording' AND targetId=? ORDER BY artifact",
        )
        .all(take.recordingId)
        .map((row) => ({ ...row }));
      assert.deepEqual(states, [
        { artifact: "frame", state: "ready" },
        { artifact: "source-evidence", state: "canceled" },
        { artifact: "source-scenes", state: "canceled" },
      ]);
      const cache = new DerivedCache(catalog, home, recordingCacheOwnerCheck(catalog), 1);
      await cache.reconcile();
      const stale = cache.acquire(firstFrame.cacheId);
      stale?.release();
      assert.equal(stale, null);
      assert.equal(existsSync(firstFrame.file), false, "LRU must remove the cached derivative");
    } finally {
      catalog.close();
    }
    assert.equal(await hash(take.video), originalHash);
    ({ instance } = await launchReady(home));
    const retry = await call("frame.retry", params);
    if (retry.delivery) await call("artifact.close", { token: retry.delivery.token });
    const regenerated = await ready();
    assert.equal(regenerated.jobId, first.jobId);
    assert.equal(regenerated.published.generation, first.published.generation + 1);
    assert.notEqual(regenerated.published.frame.cacheId, firstFrame.cacheId);
    assert.deepEqual(await readFile(regenerated.published.frame.file), firstBytes);
    assert.equal(await hash(take.video), originalHash);
    assert.equal(await hash(input), originalHash);
    for (const artifact of ["source", "scenes"])
      assert.equal(
        (await call("processing.status", { recordingId: take.recordingId, artifact })).reason,
        "canceled",
      );
    assert.deepEqual(await instance.reap(), []);
    const report = {
      generated: true,
      durationUs,
      requestedSourceUs: params.atUs,
      actualSourceUs: firstFrame.actualSourceUs,
      inputSha256: originalHash,
      sourceUnchanged: true,
      cacheHit: {
        cacheId: firstFrame.cacheId,
        generation: first.published.generation,
        identity: firstIdentity,
        bytes: firstBytes.length,
        sha256: createHash("sha256").update(firstBytes).digest("hex"),
      },
      evicted: true,
      regenerated: {
        cacheId: regenerated.published.frame.cacheId,
        generation: regenerated.published.generation,
        bytesEqual: true,
      },
      backgroundJobs: states,
      ownedProcessesReaped: true,
      scope:
        "Clean-frame cache companion only; source/scene jobs deliberately canceled through owners, no full index rerun, capture devices or user media.",
    };
    console.log(JSON.stringify(report));
    if (process.env.SCREENREC_FRAME_CACHE_EVIDENCE)
      await writeFile(
        process.env.SCREENREC_FRAME_CACHE_EVIDENCE,
        JSON.stringify(report, null, 2) + "\n",
        { flag: "wx" },
      );
  },
);
