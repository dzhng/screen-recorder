import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { rename, readFile } from "node:fs/promises";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import { DerivedCache, recordingCacheOwnerCheck } from "@screenrec/core/cache";
import { SourceProcessing } from "@screenrec/core/processing";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { SceneProcessing } from "@screenrec/core/scene-processing";
import { SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import { IndexProcessing } from "@screenrec/core/index-processing";
import { ScreenshotIndexStore } from "@screenrec/core/screenshot-index";
import { PreviewInspection } from "@screenrec/core/preview";
import { RecordingExports } from "../../service/dist/exports.js";
import { ManagedFiles } from "../../service/dist/managed-files.js";
import { mediaWorker } from "../../service/dist/worker.js";
import { registerRelocationTest } from "./package-relocation.mjs";
import { publicFrames } from "./package-public-frames.mjs";
const executable = process.env.SCREENREC_NATIVE;
assert.ok(executable);
const worker = mediaWorker({ SCREENREC_NATIVE: executable });
let produced;
async function exportFromLibrary({ store, home, recordingId, revisionId }) {
  const source = new SourceEvidenceStore(store),
    sceneEvidence = new SceneEvidenceStore(store),
    indexEvidence = new ScreenshotIndexStore(store, home);
  const cache = new DerivedCache(store, home, recordingCacheOwnerCheck(store));
  await cache.reconcile();
  let exports, processing, scenes, index, preview;
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
    providers: { newId: randomUUID },
    execute: (execution) => {
      if (["export-recording", "export-recovery"].includes(execution.job.artifact))
        return exports.execute(execution);
      return {
        "source-evidence": processing,
        "source-scenes": scenes,
        "screenshot-index": index,
        preview,
      }[execution.job.artifact].execute(execution);
    },
  });
  const run = async (op, params, signal) => {
    const result = await worker(op, params, { signal });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  const sample = ({ source, kept, atSourceUs }, signal) =>
    run("media.visualSamples", { source, kept, atSourceUs }, signal);
  processing = new SourceProcessing(
    store,
    jobs,
    source,
    home,
    (directory, output, signal) => run("media.sourceEvidence", { directory, output }, signal),
    (recordingId, generation) => exports.retainsSource(recordingId, generation),
  );
  scenes = new SceneProcessing(
    store,
    jobs,
    sceneEvidence,
    home,
    sample,
    (recordingId, generation) => exports.retainsScenes(recordingId, generation),
  );
  index = new IndexProcessing(
    store,
    jobs,
    indexEvidence,
    processing,
    scenes,
    { source, scenes: sceneEvidence },
    home,
    { decode: (params, signal) => run("media.frame", params, signal), sample },
    (recordingId, generation) => exports.retainsIndex(recordingId, generation),
  );
  preview = new PreviewInspection(store, jobs, cache, source, processing, home, (request, signal) =>
    run("media.renderMovie", request, signal),
  );
  exports = new RecordingExports({
    store,
    jobs,
    cache,
    preview,
    processing,
    worker,
    files: new ManagedFiles(home, worker),
    package: { source, scenes, index, sceneEvidence, indexEvidence },
  });
  jobs.startAdmission((job) => exports.admit(job));
  try {
    const requested = await exports.create({
      kind: "processed-package",
      exportId: randomUUID(),
      recordingId,
      revisionId,
      directory: dirname(home),
      leaf: "produced-package.zip",
    });
    await jobs.idle();
    const completed = exports.status(requested.exportId);
    assert.equal(completed.state, "committed", JSON.stringify(completed));
    assert.equal(completed.snapshot.revisionId, revisionId);
    assert.equal(
      store.catalog
        .prepare("SELECT assembly FROM export_intents WHERE exportId=?")
        .get(requested.exportId).assembly,
      null,
    );
    produced = completed.output;
  } finally {
    await Promise.all([jobs.close(), exports.close()]);
  }
}
registerRelocationTest({
  executable,
  narration: false,
  beforeLibraryRemoval: exportFromLibrary,
  reader: async (root, output, native) => {
    assert.ok(produced);
    const relocated = join(dirname(root), "moved-produced.zip");
    await rename(produced, relocated);
    const before = await readFile(relocated);
    const result = await publicFrames(root, output, native, relocated);
    assert.deepEqual(await readFile(relocated), before);
    return { ...result, productionPackageExport: true };
  },
  evidenceScope:
    "Shared RecordingExports complete no-narration producer; relocated actual ZIP public CLI/MCP frames after original library removal; generated source with cursor/geometry/pause/scene/cut/system audio",
});
