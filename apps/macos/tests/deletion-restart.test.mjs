import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import { DerivedCache, recordingCacheOwnerCheck } from "@screenrec/core/cache";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=",
  "base64",
);
function file(path, contents) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

// Seeded crash state: this does not claim a process was killed during a deletion operation.
// Source bytes are generated leftovers, not captured media; no screen or audio access is needed.
test(
  "bundled startup resumes durable deletion and preserves unrelated files across restart",
  { timeout: 60_000 },
  async () => {
    const home = temporary("/tmp/screenrec-delete-restart-");
    const outside = temporary("/tmp/screenrec-delete-external-");
    const path = join(home, "library.sqlite");
    const store = new RevisionStore(path, {
      now: () => "seeded deletion restart",
      newId: randomUUID,
    });
    const cache = new DerivedCache(store, home, recordingCacheOwnerCheck(store));
    await cache.reconcile();
    const index = new ScreenshotIndexStore(store, home);
    async function seed(label) {
      const take = store.allocate().recording;
      store.ingestLifecycle(take.recordingId, {
        sourceId: take.sourceId,
        sequence: 1,
        state: "interrupted",
        reason: "generated leftover fixture",
        sourceDurationUs: 1_000_000,
      });
      const directory = join(home, "recordings", take.recordingId);
      const source = file(
        join(directory, "source", "video.mov"),
        `${label}: generated source leftover`,
      );
      const cached = cache.reserve({ kind: "recording", recordingId: take.recordingId });
      writeFileSync(cached.path, `${label}: derivative`);
      await cache.publish(cached.id);
      if (label === "sibling") return { ...take, directory, source, cached };
      const sourceIdentity = {
        recordingId: take.recordingId,
        sourceId: take.sourceId,
        generation: "source-fixture",
      };
      const sceneIdentity = { ...sourceIdentity, generation: "scene-fixture", policy: "scene-v1" };
      const identity = {
        ...sourceIdentity,
        generation: "index-fixture",
        revisionId: "r0",
        sourceIdentity,
        sceneIdentity,
        selectionPolicy: "selection-v1",
        framePolicy: "frame-v2",
        trailPolicy: "trail-v1",
      };
      index.begin(identity);
      const image = index.outputPath(identity, 0);
      writeFileSync(image, png);
      const kept = { startUs: 0, endUs: 1_000_000 };
      const candidate = {
        kind: "candidate",
        ordinal: 0,
        requestedSourceUs: 0,
        requestedPlaybackUs: 0,
        kept,
        reasons: [{ kind: "first", eventSourceUs: 0 }],
        sourceIdentity,
        sceneIdentity,
      };
      index.appendCandidate(identity, candidate, {
        file: image,
        mediaType: "image/png",
        requestedSourceUs: 0,
        actualSourceUs: 0,
        distanceUs: 0,
        width: 1,
        height: 1,
        sourceWidth: 1,
        sourceHeight: 1,
        bytes: png.length,
        recordingId: take.recordingId,
        sourceId: take.sourceId,
        revisionId: "r0",
        requestedPlaybackUs: 0,
        actualPlaybackUs: 0,
        kept,
        clean: true,
        annotation: null,
        sourceEvidence: null,
      });
      index.appendCoverage(identity, {
        kind: "coverage",
        ordinal: 0,
        source: kept,
        playback: kept,
        equality: "sampled",
      });
      await index.finish(identity);
      return { ...take, directory, source, cached, image };
    }
    let target, sibling;
    try {
      target = await seed("target");
      sibling = await seed("sibling");
      store.markDeleting(target.recordingId);
    } finally {
      store.close();
    }
    const external = file(join(outside, "keep.bin"), "external target");
    symlinkSync(outside, join(target.directory, "external-directory"));
    symlinkSync(external, join(target.directory, "external-file"));
    const model = file(join(home, "models", "fixture.bin"), "shared model sentinel");
    const missingId = randomUUID();
    const unowned = file(join(home, "recordings", missingId, "keep.bin"), "no catalog owner");
    const preserved = [sibling.source, sibling.cached.path, external, model, unowned].map(
      (file) => [file, readFileSync(file)],
    );
    const call = async (operation, params = {}) => {
      const result = await callLocal(
        socketPath(home),
        { id: randomUUID(), operation, params },
        { timeoutMs: 30_000 },
      );
      assert.equal(result.ok, true, JSON.stringify(result));
      return result.data;
    };
    let instance;
    try {
      ({ instance } = await launchReady(home));
      // Observe startup cleanup before issuing delete; a public delete must not mask broken resume.
      await waitFor(
        () => !existsSync(target.directory) && !existsSync(target.cached.path),
        20_000,
        () => instance.diagnostics,
      );
      const catalog = new DatabaseSync(path, { readOnly: true });
      try {
        await waitFor(
          () =>
            !catalog
              .prepare("SELECT recordingId FROM recordings WHERE recordingId=?")
              .get(target.recordingId),
          5_000,
          () => instance.diagnostics,
        );
        for (const table of [
          "recording_deletions",
          "derived_cache",
          "screenshot_index_entries",
          "screenshot_index_coverage",
          "screenshot_index_generations",
        ])
          assert.deepEqual(
            catalog.prepare(`SELECT * FROM ${table} WHERE recordingId=?`).all(target.recordingId),
            [],
          );
      } finally {
        catalog.close();
      }
      assert.equal(
        (await call("recording.get", { recordingId: sibling.recordingId })).recordingId,
        sibling.recordingId,
      );
      for (const [file, bytes] of preserved) assert.deepEqual(readFileSync(file), bytes, file);
      for (const recordingId of [target.recordingId, missingId])
        assert.deepEqual(await call("recording.delete", { recordingId }), {
          recordingId,
          deleted: true,
        });
      assert.deepEqual(await instance.reap(), []);
      ({ instance } = await launchReady(home));
      for (const recordingId of [target.recordingId, missingId])
        assert.deepEqual(await call("recording.delete", { recordingId }), {
          recordingId,
          deleted: true,
        });
      for (const [file, bytes] of preserved) assert.deepEqual(readFileSync(file), bytes, file);
    } finally {
      if (instance) assert.deepEqual(await instance.reap(), []);
    }
  },
);
