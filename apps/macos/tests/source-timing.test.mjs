import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import { SourceEvidenceStore } from "@screenrec/core/evidence";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

test("native timing evidence publishes through the service and survives indexed range reads", async () => {
  const home = temporary("/tmp/scr-source-timing-");
  let store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "recording",
  });
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 2,
    state: "finalizing",
  });
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 3,
    state: "complete",
    sourceDurationUs: 1000,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  const records = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: take.sourceId,
        source: { kind: "display", displayID: 1 },
        width: 100,
        height: 80,
        microphone: true,
        systemAudio: true,
      },
    },
    { event: "origin", data: { hostUs: 1000 } },
    { event: "audioSamples", data: { role: "narration", startUs: 0, endUs: 100 } },
    { event: "audioSamples", data: { role: "system", startUs: 10, endUs: 300 } },
    { event: "audioSamples", data: { role: "narration", startUs: 100, endUs: 200 } },
    { event: "pauseBegan", data: { hostUs: 1200 } },
    {
      event: "pauseEnded",
      data: { hostUs: 6200, pause: { atSourceUs: 200, elapsedPauseUs: 5000 } },
    },
    { event: "audioSamples", data: { role: "narration", startUs: 250, endUs: 500 } },
    { event: "finished", data: {} },
  ];
  const text = records.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join("");
  const journal = join(source, "capture.journal.jsonl");
  await writeFile(journal, text);
  const original = createHash("sha256").update(text).digest("hex");
  // Generated journal only: no screen or audio capture is started by this test.
  const { instance } = await launchReady(home);
  const ready = await waitFor(async () => {
    const response = await callLocal(socketPath(home), {
      id: randomUUID(),
      operation: "processing.status",
      params: { recordingId: take.recordingId },
    });
    assert.equal(response.ok, true, JSON.stringify(response));
    const status = response.data;
    if (status.state === "failed" || status.state === "unavailable")
      throw new Error(JSON.stringify(status));
    return status.state === "ready" && status;
  }, 20000);
  assert.equal(ready.published.evidence.receipt.pauseEvents, 1);
  assert.equal(ready.published.evidence.receipt.audioIntervals, 3);
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
  store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  try {
    const evidence = new SourceEvidenceStore(store);
    const identity = ready.published.evidence;
    assert.deepEqual(evidence.audio(identity, "narration", { startUs: 50, endUs: 350 }), [
      { startUs: 50, endUs: 200 },
      { startUs: 250, endUs: 350 },
    ]);
    assert.deepEqual(evidence.audio(identity, "system", { startUs: 50, endUs: 350 }), [
      { startUs: 50, endUs: 300 },
    ]);
    assert.deepEqual(
      evidence
        .pauseBoundaries(identity, { startUs: 0, endUs: 200 })
        .map(({ atSourceUs, elapsedPauseUs }) => ({ atSourceUs, elapsedPauseUs })),
      [{ atSourceUs: 200, elapsedPauseUs: 5000 }],
    );
  } finally {
    store.close();
  }
  assert.equal(
    createHash("sha256")
      .update(await readFile(journal))
      .digest("hex"),
    original,
  );
});
