import { afterEach, expect, it } from "vitest";
import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  truncate,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import { CatalogError } from "@screenrec/core/catalog";
import { RevisionStore } from "@screenrec/core/library";
import { parakeetModel, SpeechModels } from "@screenrec/core/speech-models";
import type { TranscriptProcessing } from "@screenrec/core/transcript-processing";
import type { TranscriptRow } from "@screenrec/core/transcript-read";
import { callLocal } from "@screenrec/client";
import {
  CONTROL_FRAME_BYTES,
  JsonLineStream,
  controlMessageSchema,
  type OperationResponse,
} from "@screenrec/protocol";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function seed() {
  const home = await mkdtemp("/tmp/scr-operations-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const recording = store.allocate().recording;
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "recording",
  });
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 2,
    state: "finalizing",
  });
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 3,
    state: "complete",
    sourceDurationUs: 10_000_000,
  });
  const failed = store.allocate().recording;
  store.ingestLifecycle(failed.recordingId, {
    sourceId: failed.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "START_FAILED",
    sourceDurationUs: null,
  });
  const unfinished = store.allocate().recording;
  const canceled = store.allocate().recording;
  store.ingestLifecycle(canceled.recordingId, {
    sourceId: canceled.sourceId,
    sequence: 1,
    state: "canceled",
  });
  store.close();
  return {
    home,
    recordingId: recording.recordingId,
    unfinishedId: unfinished.recordingId,
    failedId: failed.recordingId,
    canceledId: canceled.recordingId,
  };
}

async function start(home: string, environment: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [new URL("../dist/main.js", import.meta.url).pathname], {
    cwd: "/",
    env: { ...process.env, SCREENREC_HOME: home, ...environment },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.stdin.end();
    const kill = setTimeout(() => child.kill("SIGKILL"), 2_000);
    await exit;
    clearTimeout(kill);
  };
  cleanup.push(close);
  let diagnostics = "";
  child.stderr.on("data", (bytes) => {
    diagnostics += bytes;
  });
  const socketPath = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Service not ready: ${diagnostics}`)), 3_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`Service exited: ${diagnostics}`));
    });
    const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
    child.stdout.on("data", (bytes: Buffer) => {
      for (const frame of stream.push(bytes)) {
        if (!frame.ok) {
          clearTimeout(timer);
          reject(frame.error);
          continue;
        }
        const message = controlMessageSchema.parse(frame.value);
        if (message.event === "started") {
          clearTimeout(timer);
          resolve(message.socketPath);
        }
        if (message.event === "failed") {
          clearTimeout(timer);
          reject(new Error(message.error.message));
        }
      }
    });
  });
  return {
    close,
    call: (operation: string, params: Record<string, unknown> = {}) =>
      callLocal(socketPath, { id: randomUUID(), operation, params }),
  };
}

it("serves the actual catalog and persists trim/cut/undo/restore with replay across relaunch", async () => {
  const { home, recordingId, unfinishedId, failedId, canceledId } = await seed();
  let service = await start(home);
  expect(await service.call("recording.latest")).toMatchObject({
    ok: true,
    data: { recordingId: unfinishedId, state: "preparing", currentRevisionId: null },
  });
  expect(await service.call("revision.get", { recordingId: unfinishedId })).toMatchObject({
    ok: false,
    error: { code: "NOT_READY" },
  });
  expect(await service.call("revision.get", { recordingId: failedId })).toMatchObject({
    ok: false,
    error: { code: "UNAVAILABLE", details: { interruptionReason: "START_FAILED" } },
  });
  expect(await service.call("revision.history", { recordingId: canceledId })).toMatchObject({
    ok: false,
    error: { code: "UNAVAILABLE" },
  });
  expect(await service.call("recording.get", { recordingId })).toMatchObject({
    ok: true,
    data: { recordingId, state: "complete", sourceDurationUs: 10_000_000 },
  });
  const cutRequest = {
    recordingId,
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 2_000_000, endUs: 3_000_000 }],
  };
  const cut = await service.call("edit.cut", cutRequest);
  expect(cut).toMatchObject({
    ok: true,
    data: {
      recordingId,
      revision: {
        parentId: "r0",
        durationUs: 9_000_000,
        spans: [
          { startUs: 0, endUs: 2_000_000 },
          { startUs: 3_000_000, endUs: 10_000_000 },
        ],
      },
    },
  });
  if (!cut.ok) throw new Error("Cut failed");
  const cutRevision = (cut.data as { revision: { id: string } }).revision;
  const trim = await service.call("edit.trim", {
    recordingId,
    requestId: "trim",
    expectedRevisionId: cutRevision.id,
    range: { startUs: 1_000_000, endUs: 8_000_000 },
  });
  expect(trim).toMatchObject({
    ok: true,
    data: {
      revision: {
        durationUs: 7_000_000,
        spans: [
          { startUs: 1_000_000, endUs: 2_000_000 },
          { startUs: 3_000_000, endUs: 9_000_000 },
        ],
      },
    },
  });
  if (!trim.ok) throw new Error("Trim failed");
  const trimId = (trim.data as { revision: { id: string } }).revision.id;
  const undo = await service.call("edit.undo", {
    recordingId,
    requestId: "undo",
    expectedRevisionId: trimId,
  });
  expect(undo).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 9_000_000, parentId: trimId } },
  });
  if (!undo.ok) throw new Error("Undo failed");
  const undoId = (undo.data as { revision: { id: string } }).revision.id;
  expect(undoId).not.toBe(cutRevision.id);
  const restore = await service.call("edit.restore", {
    recordingId,
    requestId: "restore",
    expectedRevisionId: undoId,
    targetRevisionId: "r0",
  });
  expect(restore).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 10_000_000, spans: [{ startUs: 0, endUs: 10_000_000 }] } },
  });
  expect(
    await service.call("edit.trim", {
      recordingId,
      requestId: "stale",
      expectedRevisionId: trimId,
      range: { startUs: 0, endUs: 1 },
    }),
  ).toMatchObject({ ok: false, error: { code: "STALE_REVISION" } });
  await service.close();
  service = await start(home);
  const replay = await service.call("edit.cut", cutRequest);
  expect(replay.ok && replay.data).toEqual(cut.data);
  expect(await service.call("revision.get", { recordingId })).toMatchObject({
    ok: true,
    data: restore.ok ? restore.data : {},
  });
  expect(await service.call("revision.get", { recordingId, revisionId: "r0" })).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 10_000_000, id: "r0" } },
  });
  expect(await service.call("revision.history", { recordingId, limit: 2 })).toMatchObject({
    ok: true,
    data: {
      recordingId,
      revisions: [{ id: "r0" }, { id: cutRevision.id }],
      nextCursor: { afterOrdinal: 1, throughOrdinal: 4 },
    },
  });
});

it("rejects malformed edits, preserves domain errors, and gives concurrent edits one winner", async () => {
  const { home, recordingId } = await seed();
  const { call } = await start(home);
  const request = {
    recordingId,
    requestId: "valid",
    expectedRevisionId: "r0",
    range: { startUs: 0, endUs: 2_000_000 },
  };
  expect(await call("edit.trim", { ...request, typo: true })).toMatchObject({
    ok: false,
    error: { code: "INVALID_PARAMS" },
  });
  expect(await call("edit.trim", { ...request, range: { startUs: 4, endUs: 2 } })).toMatchObject({
    ok: false,
    error: { code: "INVALID_RANGE" },
  });
  expect(await call("recording.get", { recordingId: "missing" })).toMatchObject({
    ok: false,
    error: { code: "NOT_FOUND" },
  });
  const responses = await Promise.all([
    call("edit.trim", request),
    call("edit.trim", { ...request, requestId: "competing" }),
  ]);
  expect(responses.filter((result) => result.ok)).toHaveLength(1);
  expect(responses.find((result) => !result.ok)).toMatchObject({
    error: { code: "STALE_REVISION" },
  });
  expect(await call("revision.get", { recordingId })).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 2_000_000, spans: [{ startUs: 0, endUs: 2_000_000 }] } },
  });
});

it("pages discoverable recordings over the real transport and resumes after service relaunch", async () => {
  const { home, unfinishedId, failedId, recordingId } = await seed();
  let service = await start(home);
  const first = await service.call("recording.list", { limit: 1 });
  expect(first).toMatchObject({
    ok: true,
    data: {
      recordings: [{ recordingId: unfinishedId }],
      nextCursor: { beforeSequence: 3 },
    },
  });
  await service.close();
  service = await start(home);
  expect(
    await service.call("recording.list", { limit: 2, cursor: { beforeSequence: 3 } }),
  ).toMatchObject({
    ok: true,
    data: {
      recordings: [{ recordingId: failedId }, { recordingId }],
      nextCursor: null,
    },
  });
  for (const params of [{ limit: 101 }, { cursor: { beforeSequence: 0 } }]) {
    expect(await service.call("recording.list", params)).toMatchObject({
      ok: false,
      error: { code: "INVALID_PARAMS" },
    });
  }
});

it("package root failure leaves the library available and returns an explicit package error", async () => {
  const { home, recordingId } = await seed();
  await mkdir(join(home, "run"), { mode: 0o700 });
  await mkdir(join(home, "run", "packages"), { mode: 0o755 });
  const service = await start(home);
  expect(await service.call("package.open", { path: "/absent.zip" })).toMatchObject({
    ok: false,
    error: { code: "INVALID_STORAGE" },
  });
  expect(await service.call("package.status")).toMatchObject({
    ok: true,
    data: { state: "recovery" },
  });
  expect(await service.call("recording.get", { recordingId })).toMatchObject({
    ok: true,
    data: { recordingId, state: "complete" },
  });
  expect(
    await service.call("revision.get", { recordingId, packageHandle: "foreign" }),
  ).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
});

/** Fake native media and speech; see the fixture for the narration and words it reports. */
const speechWorker = fileURLToPath(new URL("../fixtures/speech-worker.mjs", import.meta.url));
const narration = [
  { startUs: 0, endUs: 3_000_000 },
  { startUs: 4_000_000, endUs: 6_000_000 },
];

async function startTranscribing(home: string) {
  const log = join(home, "transcribe-requests.jsonl");
  const service = await start(home, { SCREENREC_NATIVE: speechWorker, SCREENREC_FIXTURE_LOG: log });
  return { ...service, log };
}

/**
 * An installed model the service reads as ready without downloading: sparse files of the pinned
 * sizes and the receipt a prepare writes last. The fake worker never reads their bytes.
 */
async function installedModel(home: string) {
  const { modelDigest } = new SpeechModels(home);
  const root = join(home, "models", "parakeet", parakeetModel.revision);
  const receipt: { modelDigest: string; files: Record<string, unknown> } = {
    modelDigest,
    files: {},
  };
  for (const file of parakeetModel.files) {
    const path = join(root, parakeetModel.folderName, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "");
    await truncate(path, file.bytes);
    const stat = await lstat(path, { bigint: true });
    receipt.files[file.path] = { modifiedNs: String(stat.mtimeNs), inode: String(stat.ino) };
  }
  await writeFile(join(root, "receipt.json"), JSON.stringify(receipt));
}

async function narratedTakes(home: string, microphones: boolean[]) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const takes = microphones.map((microphone) => {
    const { recordingId, sourceId } = store.allocate().recording;
    for (const [sequence, state] of (["recording", "finalizing"] as const).entries())
      store.ingestLifecycle(recordingId, { sourceId, sequence: sequence + 1, state });
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 3,
      state: "complete",
      sourceDurationUs: 10_000_000,
    });
    return { recordingId, sourceId, microphone };
  });
  store.close();
  for (const { recordingId, sourceId, microphone } of takes) {
    const source = join(home, "recordings", recordingId, "source");
    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "capture.journal.jsonl"),
      JSON.stringify({ sequence: 1, event: "header", data: { sessionID: sourceId, microphone } }) +
        "\n",
    );
  }
  return takes.map((take) => take.recordingId);
}

type TranscriptStatus = ReturnType<TranscriptProcessing["status"]>;

async function settled<T>(call: () => Promise<OperationResponse>, done: (data: T) => boolean) {
  let data!: T;
  await expect
    .poll(
      async () => {
        const result = await call();
        expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
        data = (result as { data: T }).data;
        return done(data);
      },
      { timeout: 10_000, interval: 50 },
    )
    .toBe(true);
  return data;
}

it("transcripts prepare, page, search, project cuts and retry through the service", async () => {
  const home = await mkdtemp("/tmp/scr-transcript-operations-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const [narrated, silent] = await narratedTakes(home, [true, false]);
  await installedModel(home);
  const { call, log } = await startTranscribing(home);

  expect(await call("model.status")).toMatchObject({ ok: true, data: { state: "ready" } });
  expect(await call("model.prepare")).toMatchObject({ ok: true, data: { state: "ready" } });
  const status = (recordingId: string) =>
    call("processing.status", { recordingId, artifact: "transcript" });
  // A ready model lets startup admit every narrated take once its source evidence is published.
  const ready = await settled<TranscriptStatus>(
    () => status(narrated!),
    (data) => data.state === "ready",
  );
  expect(
    await settled<TranscriptStatus>(
      () => status(silent!),
      (data) => data.state !== "queued" && data.state !== "processing",
    ),
  ).toMatchObject({ state: "unavailable", reason: "no_narration", retryable: false });
  const generation = ready.published!.transcript.generation;

  const rows: TranscriptRow[] = [];
  let cursor: unknown;
  do {
    const page = await call("transcript.get", {
      recordingId: narrated,
      limit: 4,
      ...(cursor ? { cursor } : {}),
    });
    expect(page).toMatchObject({
      ok: true,
      data: { state: "ready", revisionId: "r0", generation },
    });
    const data = (page as { data: { page: { rows: TranscriptRow[]; nextCursor: unknown } } }).data;
    rows.push(...data.page.rows);
    cursor = data.page.nextCursor;
  } while (cursor);
  expect(
    rows.map((row) => (row.type === "gap" ? `gap:${row.reason}` : `${row.id}:${row.text}`)),
  ).toEqual([
    "w0:Open",
    "w1:the",
    "w2:Settings",
    "w3:panel.",
    "gap:not_acquired",
    "w4:Um,",
    "w5:press",
    "w6:record",
    "gap:not_acquired",
  ]);
  expect(rows[5]).toMatchObject({
    kind: "filler",
    sourceRange: { startUs: 4_100_000, endUs: 4_300_000 },
  });

  expect(
    await call("transcript.search", { recordingId: narrated, text: "settings PANEL" }),
  ).toMatchObject({
    ok: true,
    data: {
      generation,
      page: {
        entries: [{ wordIds: ["w2", "w3"], sourceRange: { startUs: 800_000, endUs: 2_000_000 } }],
        nextCursor: null,
      },
    },
  });

  const cut = await call("edit.cut", {
    recordingId: narrated,
    requestId: "cut-inside-settings",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 1_000_000, endUs: 1_200_000 }],
  });
  const revisionId = (cut as { data: { revision: { id: string } } }).data.revision.id;
  const edited = await call("transcript.get", { recordingId: narrated, revisionId, limit: 3 });
  expect(edited).toMatchObject({
    ok: true,
    data: {
      revisionId,
      generation,
      page: {
        rows: [
          { id: "w0", partial: false },
          { id: "w1", partial: false },
          {
            id: "w2",
            text: "Settings",
            partial: true,
            fragments: [
              {
                source: { startUs: 800_000, endUs: 1_000_000 },
                playback: { startUs: 800_000, endUs: 1_000_000 },
              },
              {
                source: { startUs: 1_200_000, endUs: 1_400_000 },
                playback: { startUs: 1_000_000, endUs: 1_200_000 },
              },
            ],
          },
        ],
      },
    },
  });

  expect(
    await call("processing.retry", { recordingId: narrated, artifact: "transcript" }),
  ).toMatchObject({
    ok: true,
    data: { state: "ready", jobId: ready.jobId, published: ready.published },
  });
  const requests = (await readFile(log, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    models: {
      directory: join(
        await realpath(home),
        "models",
        "parakeet",
        parakeetModel.revision,
        parakeetModel.folderName,
      ),
    },
    track: { available: narration },
  });
  expect(requests[0].models.files).toEqual(parakeetModel.files);
});

it("an unprepared model starts no transcript and says how to proceed", async () => {
  const home = await mkdtemp("/tmp/scr-transcript-unprepared-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const [recordingId] = await narratedTakes(home, [true]);
  const { call, log } = await startTranscribing(home);
  expect(await call("model.status")).toMatchObject({ ok: true, data: { state: "absent" } });
  const blocked = {
    state: "unavailable",
    reason: "model_not_prepared",
    retryable: true,
    jobId: null,
  };
  expect(
    await settled<TranscriptStatus>(
      () => call("processing.status", { recordingId, artifact: "transcript" }),
      (data) => data.state === "unavailable",
    ),
  ).toMatchObject(blocked);
  expect(await call("transcript.get", { recordingId })).toMatchObject({
    ok: true,
    data: { ...blocked, revisionId: "r0", page: null },
  });
  expect(await call("processing.retry", { recordingId, artifact: "transcript" })).toMatchObject({
    ok: false,
    error: { code: "MODEL_NOT_PREPARED", retryable: true },
  });
  await expect(lstat(log)).rejects.toMatchObject({ code: "ENOENT" });
});

it("public recording jobs preserve source-owned continuation and revision jobs across restart", async () => {
  const { home, failedId, recordingId } = await seed();
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const queue = new JobQueue({
    store,
    targets: { ...recordingJobTargets(store), isCapturing: () => false },
    providers: { newId: randomUUID },
    execute: async ({ job }) => {
      if (job.target.kind === "recording" && job.target.revisionId === null)
        throw new CatalogError("MEDIA_UNAVAILABLE", "fixture retained access error", {}, true);
      return JSON.stringify({ fixture: "ready revision job" });
    },
  });
  const source = queue.submit({
    target: { kind: "recording", recordingId: failedId, revisionId: null },
    artifact: "target-contract-proof",
    lane: "heavy",
    input: "source",
  });
  const revision = queue.submit({
    target: { kind: "recording", recordingId },
    artifact: "target-contract-proof",
    lane: "heavy",
    input: "revision",
  });
  await queue.idle();
  await queue.close();
  store.close();
  let service = await start(home);
  expect(await service.call("job.get", { jobId: source.jobId })).toMatchObject({
    ok: true,
    data: { state: "failed", target: source.target, retryable: true },
  });
  expect(await service.call("job.retry", { jobId: source.jobId })).toMatchObject({
    ok: true,
    data: { state: "queued", target: source.target },
  });
  expect(await service.call("job.cancel", { jobId: source.jobId })).toMatchObject({
    ok: true,
    data: { state: "canceled", target: source.target },
  });
  for (const operation of ["job.get", "job.retry", "job.cancel"])
    expect(await service.call(operation, { jobId: revision.jobId })).toMatchObject({
      ok: true,
      data: {
        state: "ready",
        attemptId: revision.attemptId,
        target: { kind: "recording", recordingId, revisionId: "r0" },
      },
    });
  expect(await service.call("job.get", { jobId: "absent-job" })).toMatchObject({
    ok: false,
    error: { code: "NOT_FOUND" },
  });
  await service.close();
  service = await start(home);
  expect(await service.call("job.get", { jobId: source.jobId })).toMatchObject({
    ok: true,
    data: { state: "canceled", target: source.target },
  });
  expect(await service.call("job.retry", { jobId: source.jobId })).toMatchObject({
    ok: true,
    data: { state: "queued", target: source.target },
  });
  expect(await service.call("job.cancel", { jobId: source.jobId })).toMatchObject({
    ok: true,
    data: { state: "canceled", target: source.target },
  });
});
