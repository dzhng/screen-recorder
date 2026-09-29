import { sourcePolicy } from "@screenrec/core/processing";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile, realpath, rename, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import { SourceEvidenceStore, recordingEvidenceOwner } from "@screenrec/core/evidence";
import {
  SceneEvidenceStore,
  recordingSceneOwner,
  recordingSceneIdentity,
  recordingSceneMetadata,
} from "@screenrec/core/scene-evidence";
import { FileSceneEvidence } from "@screenrec/core/scene-pages";
import { scenePolicy } from "@screenrec/core/scenes";
import { mediaWorker } from "../../service/dist/worker.js";
import { archiveFixture } from "./fixtures/retained-archive.mjs";
import { writeArchiveFixture } from "./fixtures/write-archive.mjs";
import { registerRelocationTest, relocatedReader } from "./package-relocation.mjs";
import {
  until,
  startPublicService,
  publicCommand,
  connectPublicMcp,
} from "./fixtures/public-service.mjs";

const native = process.env.SCREENREC_NATIVE;
assert.ok(native, "SCREENREC_NATIVE must name the pinned native build");
async function seed(home, portable, context) {
  const ids = [context.snapshot.recordingId, context.snapshot.sourceId];
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: () => ids.shift() ?? randomUUID(),
  });
  const recording = store.allocate().recording;
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated timeline fixture",
    sourceDurationUs: context.snapshot.sourceDurationUs,
  });
  const sourceRoot = join(home, "recordings", recording.recordingId, "source");
  await mkdir(sourceRoot, { recursive: true, mode: 0o700 });
  for (const name of ["video.mov", "system.mov", "capture.journal.jsonl"])
    await cp(join(portable, "source", name), join(sourceRoot, name));
  const source = new SourceEvidenceStore(store, recordingEvidenceOwner(store)),
    scenes = new SceneEvidenceStore(store, recordingSceneOwner(store));
  const retained = new FileSceneEvidence(
    join(portable, "scene-pages"),
    recordingSceneIdentity(context.scenes),
  );
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
    providers: { newId: randomUUID },
    execute: async ({ job, signal }) => {
      const identity = {
        recordingId: recording.recordingId,
        sourceId: recording.sourceId,
        generation: job.attemptId,
      };
      if (job.artifact === "source-evidence") {
        const file = join(
          home,
          "recordings",
          recording.recordingId,
          "evidence/source",
          job.attemptId,
          "observations.jsonl",
        );
        await mkdir(dirname(file), { recursive: true, mode: 0o700 });
        await cp(join(portable, "source/normalized.jsonl"), file);
        return JSON.stringify(
          await source.ingest({
            owner: { kind: "recording", recordingId: identity.recordingId },
            sourceId: identity.sourceId,
            generation: identity.generation,
            file,
            receipt: { ...context.source.receipt, file },
            signal,
          }),
        );
      }
      const sceneIdentity = { ...identity, policy: scenePolicy.id };
      let afterStartUs;
      for (;;) {
        const page = retained.page({
          identity: recordingSceneIdentity(context.scenes),
          afterStartUs,
        });
        for (const chunk of page.chunks)
          scenes.append(
            recordingSceneIdentity(sceneIdentity),
            { kind: "recording", durationUs: context.snapshot.sourceDurationUs },
            chunk,
          );
        if (page.nextStartUs === null) break;
        afterStartUs = page.nextStartUs;
      }
      return JSON.stringify(
        recordingSceneMetadata(scenes.finish(recordingSceneIdentity(sceneIdentity))),
      );
    },
  });
  try {
    for (const [artifact, input] of [
      ["source-evidence", sourcePolicy],
      ["source-scenes", scenePolicy.id],
    ])
      jobs.submit({
        target: { kind: "recording", recordingId: recording.recordingId, revisionId: "r0" },
        artifact,
        input,
        lane: "heavy",
      });
    await jobs.idle();
    for (const [artifact, input] of [
      ["source-evidence", sourcePolicy],
      ["source-scenes", scenePolicy.id],
    ])
      assert.equal(
        jobs.status({
          target: { kind: "recording", recordingId: recording.recordingId, revisionId: "r0" },
          artifact,
          input,
        }).state,
        "ready",
      );
  } finally {
    await jobs.close();
    store.close();
  }
  return recording;
}
async function publicReader(portable, output, executable) {
  const parent = await realpath(dirname(portable)),
    directory = join(parent, "timeline-package"),
    archive = join(parent, "timeline.zip"),
    moved = join(parent, "timeline-moved.zip"),
    home = await mkdtemp("/tmp/scr-public-timeline-");
  const context = JSON.parse(await readFile(join(portable, "context.json"), "utf8"));
  let service, client;
  const receipts = {};
  try {
    await archiveFixture(portable, directory);
    await writeArchiveFixture(directory, archive, mediaWorker({ SCREENREC_NATIVE: native }));
    await rename(archive, moved);
    await rm(directory, { recursive: true });
    const recording = await seed(home, portable, context);
    service = await startPublicService(home, native);
    const ok = async (operation, params) => {
      const result = await service.call(operation, params);
      assert.equal(result.ok, true, JSON.stringify(result));
      return result.data;
    };
    const command = (operation, params) => publicCommand(service.socket, operation, params);
    const open = async () => {
      const admitted = command("package.open", { path: await realpath(moved) });
      return until(async () => {
        const value = await ok("package.status", { admissionId: admitted.id });
        assert.ok(
          !["failed", "cleanup_failed", "canceled"].includes(value.state),
          JSON.stringify(value),
        );
        return value.state === "ready" && value;
      }, "Timeline package admission failed");
    };
    const first = await open(),
      second = await open(),
      target = { packageHandle: first.packageHandle };
    const collect = async (params) => {
      const rows = [];
      let cursor;
      for (let calls = 0; calls < 100; calls++) {
        const page = await ok("timeline.events", {
          ...params,
          ...(cursor ? { cursor } : {}),
          limit: 1,
        });
        rows.push(...page.rows);
        if (page.nextCursor === null) return rows;
        cursor = page.nextCursor;
      }
      throw new Error("Timeline pagination failed to advance");
    };
    const pinned = command("timeline.events", { ...target, limit: 1 });
    assert.equal(pinned.revisionId, context.snapshot.revisionId);
    assert.ok(pinned.nextCursor);
    const libraryFirst = command("timeline.events", {
      recordingId: recording.recordingId,
      limit: 1,
    });
    const r0 = await collect({ ...target, revisionId: "r0" });
    assert.deepEqual(await collect({ recordingId: recording.recordingId }), r0);
    const edited = await ok("edit.cut", {
      recordingId: recording.recordingId,
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 500_000, endUs: 1_000_000 }],
    });
    const continued = await ok("timeline.events", {
      recordingId: recording.recordingId,
      cursor: libraryFirst.nextCursor,
      limit: 1,
    });
    assert.equal(continued.revisionId, "r0");
    assert.equal(continued.rows[0].ordinal, 1);
    const packageRows = await collect(target),
      libraryRows = await collect({ recordingId: recording.recordingId });
    assert.deepEqual(libraryRows, packageRows);
    assert.ok(
      packageRows.some(
        (row) =>
          row.atUs === 2_500_000 &&
          row.event.kind === "pause" &&
          row.event.elapsedPauseUs === 400_000,
      ),
    );
    assert.ok(
      packageRows.some(
        (row) =>
          row.atUs === 500_000 &&
          row.event.kind === "cut" &&
          row.event.removedSourceSpans[0].endUs === 1_000_000,
      ),
    );
    assert.ok(
      packageRows.some(
        (row) =>
          row.atUs === 2_100_000 &&
          row.event.kind === "geometry" &&
          row.event.atSourceUs === 2_600_000,
      ),
    );
    assert.ok(
      packageRows.some((row) => row.atUs === 3_500_000 && row.event.kind === "interruption"),
    );
    const later = context.history.at(-1).id,
      laterRows = await collect({ ...target, revisionId: later });
    assert.ok(!laterRows.some((row) => row.event.kind === "pause"));
    assert.ok(laterRows.some((row) => row.atUs === 1_000_000 && row.event.kind === "cut"));
    for (const params of [
      { packageHandle: second.packageHandle, cursor: pinned.nextCursor },
      { ...target, revisionId: later, cursor: pinned.nextCursor },
      { recordingId: recording.recordingId, cursor: pinned.nextCursor },
    ])
      assert.equal((await service.call("timeline.events", params)).error.code, "ARTIFACT_CHANGED");
    assert.equal(
      (await service.call("timeline.events", { ...target, limit: 501 })).error.code,
      "INVALID_PARAMS",
    );
    assert.equal(
      (await service.call("timeline.events", { ...target, recordingId: recording.recordingId }))
        .error.code,
      "INVALID_PARAMS",
    );
    assert.equal(
      (await service.call("timeline.events", { ...target, revisionId: "not-in-history" })).error
        .code,
      "NOT_FOUND",
    );
    client = await connectPublicMcp(service.socket, "public-timeline-proof");
    const tool = await client.callTool({
      name: "timeline.events",
      arguments: { ...target, limit: 500 },
    });
    assert.equal(tool.structuredContent.ok, true, JSON.stringify(tool));
    assert.deepEqual(tool.structuredContent.data.rows, packageRows);
    const malformed = await client.callTool({
      name: "timeline.events",
      arguments: { ...target, cursor: "not-a-cursor" },
    });
    assert.equal(malformed.isError, true);
    assert.equal(malformed.structuredContent.error.code, "INVALID_PARAMS");
    await ok("recording.delete", { recordingId: recording.recordingId });
    assert.equal(
      (await service.call("timeline.events", { recordingId: recording.recordingId })).error.code,
      "NOT_FOUND",
    );
    assert.deepEqual(await collect(target), packageRows);
    await ok("package.close", { admissionId: first.id });
    assert.equal(
      (await service.call("timeline.events", { ...target, cursor: pinned.nextCursor })).error.code,
      "CONTEXT_CLOSED",
    );
    await client.close();
    client = undefined;
    await service.close();
    service = undefined;
    service = await startPublicService(home, native);
    assert.equal(
      (await service.call("timeline.events", { packageHandle: second.packageHandle })).error.code,
      "CONTEXT_CLOSED",
    );
    Object.assign(receipts, {
      defaultRevision: pinned.revisionId,
      historicalRevision: later,
      libraryEditedRevision: edited.revision.id,
      packageRows,
      historyRows: laterRows,
      cliMcpParity: true,
      cursorScope: true,
      libraryDeletionIsolation: true,
      closeAndRestartRevocation: true,
    });
  } finally {
    await client?.close();
    await service?.close();
    await rm(home, { recursive: true, force: true });
  }
  await relocatedReader(portable, output, executable);
  if (process.env.SCREENREC_TIMELINE_EVIDENCE)
    await writeFile(
      process.env.SCREENREC_TIMELINE_EVIDENCE,
      JSON.stringify(receipts, null, 2) + "\n",
    );
  return { publicTimeline: true, ownedServiceGroupsReaped: true };
}
registerRelocationTest({
  reader: publicReader,
  narration: false,
  executable: native,
  evidenceScope:
    "Actual CLI/MCP timeline inspection across library, relocated package and included historical revisions; no speech claim",
});
