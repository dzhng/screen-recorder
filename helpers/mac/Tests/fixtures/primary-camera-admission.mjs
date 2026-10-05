import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CaptureStore } from "../../../../packages/core/dist/capture-store.js";
import {
  SourceEvidenceStore,
  recordingEvidenceOwner,
} from "../../../../packages/core/dist/evidence.js";

// Consume the actual native fixture's publication and normalized evidence through core owners.
const input = process.argv[2];
if (!input) throw Error("Usage: node primary-camera-admission.mjs NATIVE_FIXTURE_DIRECTORY");
const root = resolve(input);
const read = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));
const observation = read("finished-publication.json");
const receipt = read("finished-evidence-receipt.json");
const scratch = mkdtempSync(join(tmpdir(), "primary-camera-core-"));
const catalog = join(scratch, "catalog.sqlite");
let allocationOrdinal = 0;
const providers = {
  now: () => "2026-10-05T00:00:00Z",
  newId: () => (++allocationOrdinal === 1 ? "primary-camera-take" : observation.sourceId),
};
let store;
try {
  store = new CaptureStore(catalog, providers);
  const recording = store.allocate().recording;
  assert.equal(recording.sourceId, observation.sourceId);
  assert.equal(recording.camera, null);
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "finalizing",
    publication: observation,
  });
  const source = store.publishedSource(recording.recordingId, recording.sourceId);
  assert.deepEqual(source, observation.primary.source);
  assert.equal(source.kind, "primary");
  assert.equal(source.binding, undefined);
  const identity = {
    owner: { kind: "recording", recordingId: recording.recordingId },
    sourceId: recording.sourceId,
    generation: observation.generation,
  };
  const evidence = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
  const admitted = await evidence.ingest({
    ...identity,
    file: join(root, "finished-evidence.jsonl"),
    receipt: { ...receipt, file: join(root, "finished-evidence.jsonl") },
  });
  assert.equal(admitted.receipt.header.source.kind, "camera");
  assert.equal(admitted.receipt.header.cameraBinding, undefined);
  store.close();
  store = new CaptureStore(catalog, providers);
  assert.deepEqual(store.publishedSource(recording.recordingId, recording.sourceId), source);
  assert.equal(store.get(recording.recordingId).camera, null);
  const reopened = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
  assert.deepEqual(
    reopened.page({ ...identity, range: { startUs: 0, endUs: source.sourceDurationUs } }),
    { samples: [], nextSequence: null },
  );
  writeFileSync(
    join(root, "core-admission-report.json"),
    JSON.stringify(
      {
        sourceId: source.sourceId,
        role: source.kind,
        journalLayout: source.journal.layout,
        companion: null,
        deviceKind: admitted.receipt.header.source.kind,
        publicationAndEvidenceReopened: true,
        script: fileURLToPath(import.meta.url),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS actual primary-camera publication/evidence admitted and reopened through core owners",
  );
} finally {
  store?.close();
  rmSync(scratch, { recursive: true, force: true });
}
