import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { CaptureStore } from "./capture-store.js";
import { CatalogError } from "./catalog.js";
import { AcquisitionStore, AcquisitionImporter } from "./acquisitions.js";
import { AssetStore } from "./assets.js";
import { SourceEvidenceStore } from "./evidence.js";
import { JobQueue } from "./jobs.js";
import type { SourceExporter } from "./processing.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});
const signal = () => new AbortController().signal;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "capture-acquisition-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const donor = join(root, "donor", "source");
  await mkdir(donor, { recursive: true });
  async function reopen() {
    const captures = new CaptureStore(join(root, "catalog.sqlite"), {
      newId: randomUUID,
      now: () => "2026-10-01T00:00:00.000Z",
    });
    cleanup.push(async () => captures.close());
    const acquisitions = new AcquisitionStore(captures);
    const assets = new AssetStore(captures, root);
    await assets.recover();
    const evidence = new SourceEvidenceStore(captures, (identity) => {
      if (identity.owner.kind !== "acquisition") throw new Error("Wrong domain");
      acquisitions.intent(identity.owner.acquisitionId);
    });
    const importer = new AcquisitionImporter(captures, acquisitions, assets, evidence, root);
    await importer.recover(signal());
    const exportSource: SourceExporter = async (directory, output) => {
      const header = JSON.parse(await readFile(join(directory, "capture.journal.jsonl"), "utf8"));
      await writeFile(output, "");
      return {
        file: output,
        journal: "capture.journal.jsonl",
        header,
        cursorSamples: 0,
        geometryRecords: 0,
        displaySpaces: 0,
        pauseEvents: 0,
        audioIntervals: 0,
        lastSequence: 0,
        incompleteTail: false,
        finished: true,
        bytes: 0,
      };
    };
    const native = {
      exportSource,
      probe: async () => ({
        originUs: 0,
        streams: [
          {
            id: "track:1",
            kind: "video",
            codec: "fixture",
            width: 16,
            height: 16,
            orientedWidth: 16,
            orientedHeight: 16,
            decodable: true,
            startUs: 0,
            endUs: 100,
            segments: [{ startUs: 0, endUs: 100, empty: false }],
          },
        ],
      }),
    };
    const queue = new JobQueue({
      store: captures,
      providers: { newId: randomUUID },
      deferExecution: true,
      targets: {
        pin(target) {
          if (target.kind !== "acquisition") throw new Error("Wrong domain");
          acquisitions.intent(target.acquisitionId);
          return target;
        },
        isAvailable: (target) =>
          target.kind === "acquisition" && !!acquisitions.intent(target.acquisitionId),
        isDeleting: () => false,
        isCapturing: () => captures.unsettled().length > 0,
      },
      execute: async ({ job, signal }) => {
        if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
        const value = await importer.executeImport(
          job.target.acquisitionId,
          job.attemptId,
          native,
          signal,
        );
        return JSON.stringify({ acquisitionId: value.id });
      },
    });
    cleanup.push(async () => {
      if (captures.catalog.isOpen) await queue.close();
    });
    return {
      captures,
      acquisitions,
      assets,
      evidence,
      importer,
      queue,
      native,
      admit: (recordingId: string, admitted?: () => void) =>
        queue.submit(() => {
          const intent = acquisitions.admitCapture(captures, recordingId, donor);
          return {
            target: { kind: "acquisition", acquisitionId: intent.acquisitionId },
            artifact: "acquisition.import",
            lane: "heavy",
            input: "capture",
          };
        }, admitted),
    };
  }
  const state = await reopen();
  const recording = state.captures.allocate().recording;
  state.captures.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "finalizing",
  });
  state.captures.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 2,
    state: "complete",
    sourceDurationUs: 100,
  });
  return { root, donor, recording, reopen, ...state };
}

test("settled capture reserves one acquisition and job atomically before files exist", async () => {
  const f = await fixture();
  expect(() =>
    f.admit(f.recording.recordingId, () => {
      throw new CatalogError("REFUSED", "Refused");
    }),
  ).toThrow("Refused");
  expect(f.captures.catalog.prepare("SELECT id FROM acquisitions").all()).toEqual([]);
  expect(f.captures.catalog.prepare("SELECT jobId FROM jobs").all()).toEqual([]);
  const job = f.admit(f.recording.recordingId);
  expect(f.admit(f.recording.recordingId)).toEqual(job);
  expect(job.state).toBe("queued");
  if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
  expect(f.acquisitions.intent(job.target.acquisitionId)).toMatchObject({
    kind: "capture",
    recordingId: f.recording.recordingId,
    sourceId: f.recording.sourceId,
    path: f.donor,
    files: {},
  });
  expect(
    f.captures.catalog
      .prepare("SELECT name FROM sqlite_master WHERE name IN ('spans','projects')")
      .all(),
  ).toEqual([]);
});

test("partial freeze survives relaunch; replay keeps failure and explicit retry publishes the same acquisition", async () => {
  const f = await fixture();
  await writeFile(
    join(f.donor, "capture.journal.jsonl"),
    JSON.stringify({ sessionID: f.recording.sourceId }),
  );
  const job = f.admit(f.recording.recordingId);
  f.queue.start();
  await f.queue.idle();
  expect(f.queue.inspect(job.jobId)).toMatchObject({
    state: "failed",
    errorCode: "NOT_FOUND",
    retryable: true,
  });
  if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
  const frozen = f.acquisitions.intent(job.target.acquisitionId);
  expect(frozen).toMatchObject({
    files: { "capture.journal.jsonl": { bytes: expect.any(Number) } },
  });
  await f.queue.close();
  f.captures.close();
  const reopened = await f.reopen();
  expect(reopened.acquisitions.intent(job.target.acquisitionId)).toEqual(frozen);
  await writeFile(join(f.donor, "video.mov"), "video");
  expect(reopened.admit(f.recording.recordingId)).toMatchObject({
    jobId: job.jobId,
    state: "failed",
  });
  reopened.queue.start();
  await reopened.queue.idle();
  expect(reopened.queue.inspect(job.jobId).state).toBe("failed");
  reopened.queue.retry(job.jobId);
  await reopened.queue.idle();
  expect(reopened.queue.inspect(job.jobId)).toMatchObject({
    state: "ready",
    result: { acquisitionId: job.target.acquisitionId },
  });
  const value = reopened.acquisitions.get(job.target.acquisitionId);
  expect(value.sourceId).toBe(f.recording.sourceId);
  expect(value.bindings.map((binding) => binding.sourceRoles)).toEqual([["video"]]);
  await rm(f.donor, { recursive: true });
  expect(reopened.admit(f.recording.recordingId)).toMatchObject({
    jobId: job.jobId,
    state: "ready",
  });
  expect(
    await reopened.importer.executeImport(value.id, "ready-replay", reopened.native, signal()),
  ).toEqual(value);
});

test("a changed frozen journal refuses before observing newly available video", async () => {
  const f = await fixture();
  const journal = join(f.donor, "capture.journal.jsonl");
  await writeFile(journal, JSON.stringify({ sessionID: f.recording.sourceId }));
  const job = f.admit(f.recording.recordingId);
  f.queue.start();
  await f.queue.idle();
  expect(f.queue.inspect(job.jobId)).toMatchObject({ state: "failed", errorCode: "NOT_FOUND" });
  if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
  const frozen = f.acquisitions.intent(job.target.acquisitionId);
  await writeFile(journal, JSON.stringify({ sessionID: "changed" }));
  await writeFile(join(f.donor, "video.mov"), "video");
  f.queue.retry(job.jobId);
  await f.queue.idle();
  expect(f.queue.inspect(job.jobId)).toMatchObject({
    state: "failed",
    errorCode: "SOURCE_CHANGED",
    retryable: false,
  });
  expect(f.acquisitions.intent(job.target.acquisitionId)).toEqual(frozen);
  expect(f.acquisitions.ready(job.target.acquisitionId)).toBe(false);
});

test("observed optional absence cannot be replaced after a failed native attempt", async () => {
  const f = await fixture();
  await writeFile(
    join(f.donor, "capture.journal.jsonl"),
    JSON.stringify({ sessionID: f.recording.sourceId }),
  );
  await writeFile(join(f.donor, "video.mov"), "video");
  const exportSource = f.native.exportSource;
  f.native.exportSource = async () => {
    throw new Error("Native unavailable");
  };
  const job = f.admit(f.recording.recordingId);
  f.queue.start();
  await f.queue.idle();
  expect(f.queue.inspect(job.jobId)).toMatchObject({ state: "failed", retryable: true });
  if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
  const frozen = f.acquisitions.intent(job.target.acquisitionId);
  expect(frozen).toMatchObject({ files: { "narration.mov": null } });
  f.native.exportSource = exportSource;
  await writeFile(join(f.donor, "narration.mov"), "late audio");
  f.queue.retry(job.jobId);
  await f.queue.idle();
  expect(f.queue.inspect(job.jobId)).toMatchObject({
    state: "failed",
    errorCode: "SOURCE_CHANGED",
    retryable: false,
  });
  expect(f.acquisitions.intent(job.target.acquisitionId)).toEqual(frozen);
});

test("a foreign source journal fails before publishing evidence or assets", async () => {
  const f = await fixture();
  await writeFile(
    join(f.donor, "capture.journal.jsonl"),
    JSON.stringify({ sessionID: "foreign-source" }),
  );
  await writeFile(join(f.donor, "video.mov"), "video");
  const job = f.admit(f.recording.recordingId);
  f.queue.start();
  await f.queue.idle();
  expect(f.queue.inspect(job.jobId)).toMatchObject({
    state: "failed",
    errorCode: "SOURCE_CHANGED",
    retryable: false,
    result: null,
  });
  if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
  expect(f.acquisitions.ready(job.target.acquisitionId)).toBe(false);
  expect(f.captures.catalog.prepare("SELECT id FROM assets").all()).toEqual([]);
  expect(f.captures.catalog.prepare("SELECT * FROM source_evidence_generations").all()).toEqual([]);
});

test("capture authority refuses live, canceled, no-video and foreign-connection inputs without jobs", async () => {
  const f = await fixture();
  for (const state of ["preparing", "canceled", "interrupted"] as const) {
    const recording = f.captures.allocate().recording;
    if (state === "canceled")
      f.captures.ingestLifecycle(recording.recordingId, {
        sourceId: recording.sourceId,
        sequence: 1,
        state,
      });
    if (state === "interrupted")
      f.captures.ingestLifecycle(recording.recordingId, {
        sourceId: recording.sourceId,
        sequence: 1,
        state,
        reason: "no-video",
        sourceDurationUs: null,
      });
    expect(() => f.admit(recording.recordingId)).toThrow(
      state === "preparing" ? "Capture has not settled" : "Capture has no usable video source",
    );
  }
  const other = await fixture();
  expect(() =>
    f.captures.transaction(() =>
      f.acquisitions.admitCapture(other.captures, other.recording.recordingId, other.donor),
    ),
  ).toThrow("shared catalog connection");
  expect(f.captures.catalog.prepare("SELECT id FROM acquisitions").all()).toEqual([]);
  expect(f.captures.catalog.prepare("SELECT jobId FROM jobs").all()).toEqual([]);
});

test("an interrupted take with video retains canceled work and refuses a changed path", async () => {
  const f = await fixture();
  const recording = f.captures.allocate().recording;
  f.captures.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "device-disconnected",
    sourceDurationUs: 100,
  });
  const job = f.admit(recording.recordingId);
  f.queue.cancel(job.jobId);
  expect(f.admit(recording.recordingId)).toMatchObject({ jobId: job.jobId, state: "canceled" });
  expect(() =>
    f.captures.transaction(() =>
      f.acquisitions.admitCapture(f.captures, recording.recordingId, join(f.root, "other")),
    ),
  ).toThrow("already names another input");
  if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
  expect(f.acquisitions.intent(job.target.acquisitionId)).toMatchObject({
    sourceId: recording.sourceId,
    path: f.donor,
    files: {},
  });
  expect(f.captures.catalog.prepare("SELECT id FROM acquisitions").all()).toEqual([
    { id: job.target.acquisitionId },
  ]);
});

test.each(["source", "parent"])(
  "temporary %s directory access refusal retains frozen identity and permits explicit retry",
  async (directory) => {
    const f = await fixture();
    await writeFile(
      join(f.donor, "capture.journal.jsonl"),
      JSON.stringify({ sessionID: f.recording.sourceId }),
    );
    const job = f.admit(f.recording.recordingId);
    f.queue.start();
    await f.queue.idle();
    expect(f.queue.inspect(job.jobId)).toMatchObject({ state: "failed", errorCode: "NOT_FOUND" });
    if (job.target.kind !== "acquisition") throw new Error("Wrong domain");
    const frozen = f.acquisitions.intent(job.target.acquisitionId);
    await writeFile(join(f.donor, "video.mov"), "video");
    const refusedDirectory = directory === "source" ? f.donor : dirname(f.donor);
    await chmod(refusedDirectory, 0);
    try {
      f.queue.retry(job.jobId);
      await f.queue.idle();
      expect(f.queue.inspect(job.jobId)).toMatchObject({
        state: "failed",
        errorCode: "INVALID_PATH",
        retryable: true,
      });
      expect(f.acquisitions.intent(job.target.acquisitionId)).toEqual(frozen);
    } finally {
      await chmod(refusedDirectory, 0o700);
    }
    expect(f.admit(f.recording.recordingId)).toMatchObject({ jobId: job.jobId, state: "failed" });
    f.queue.retry(job.jobId);
    await f.queue.idle();
    expect(f.queue.inspect(job.jobId)).toMatchObject({
      state: "ready",
      result: { acquisitionId: job.target.acquisitionId },
    });
    expect(f.acquisitions.intent(job.target.acquisitionId)).toMatchObject(frozen);
  },
);
