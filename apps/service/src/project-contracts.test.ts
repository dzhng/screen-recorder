import { createServer, createConnection, type Socket } from "node:net";
import { once } from "node:events";
import { chmod, mkdir, writeFile, truncate, lstat, readFile, realpath } from "node:fs/promises";
import { join, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { Models, parakeetModel } from "@yap/core/models";
import type { SpeechTranscriptionRequest } from "@yap/core/transcript";
import type { SourceTranscriptRow } from "@yap/core/transcript-read";
import { callLocal } from "@yap/client";
import { REQUEST_FRAME_BYTES, type OperationRequest, type OperationResponse } from "@yap/protocol";
import { projectServiceFixture } from "./project-service.fixture.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
async function save(name: string, value: unknown) {
  const directory = process.env.YAP_CONTRACT_TEST_OUTPUT;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${name}.json`), JSON.stringify(value, null, 2) + "\n");
}
const canvas = {
  width: 16,
  height: 16,
  fps: { numerator: 30, denominator: 1 },
  background: "#000000ff",
};
async function emptyProject() {
  const f = await projectServiceFixture(cleanups, async (operation) => {
    throw new Error(`Unexpected worker operation: ${operation}`);
  });
  const created = await f.call("project.create", { requestId: "create", canvas });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.error.message);
  const { project, revision } = created.data as {
    project: { projectId: string };
    revision: { id: string };
  };
  const request = {
    id: "resize",
    operation: "edit.apply",
    params: {
      projectId: project.projectId,
      requestId: "resize",
      expectedRevisionId: revision.id,
      operations: [{ operation: "canvas.set", canvas: { ...canvas, width: 32 } }],
    },
  };
  const db = new DatabaseSync(join(f.home, "library", "catalog.sqlite"));
  cleanups.push(async () => db.close());
  async function state() {
    return {
      project: await f.call("project.get", { projectId: project.projectId }),
      history: await f.call("revision.history", { projectId: project.projectId }),
      requests: db
        .prepare("SELECT * FROM project_requests WHERE projectId=? ORDER BY requestId")
        .all(project.projectId),
    };
  }
  return { ...f, project, revision, request, state };
}
async function sendRaw(socketPath: string, bytes: Buffer) {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection(socketPath, () => socket.write(bytes));
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Framing refusal did not close socket"));
    }, 1000);
    socket.resume();
    socket.on("error", () => socket.destroy());
    socket.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
test("oversized independently valid project mutation does not dispatch", async () => {
  const f = await emptyProject();
  const before = await f.state();
  // Whitespace, rather than an unknown field, keeps the domain request valid.
  await sendRaw(
    f.service.socketPath,
    Buffer.from(" ".repeat(REQUEST_FRAME_BYTES) + JSON.stringify(f.request) + "\n"),
  );
  const after = await f.state();
  await save("oversized-state", { before, after });
  expect(after).toEqual(before);
  const applied = await callLocal(f.service.socketPath, f.request);
  expect(applied.ok).toBe(true);
  expect(await f.state()).not.toEqual(before);
});

test("invalid UTF-8 in an otherwise valid project mutation does not dispatch", async () => {
  const f = await emptyProject();
  const before = await f.state();
  const bytes = Buffer.from(JSON.stringify(f.request) + "\n");
  const marker = bytes.indexOf(Buffer.from('"requestId":"resize"')) + '"requestId":"'.length;
  expect(marker).toBeGreaterThan(0);
  bytes[marker] = 0xff;
  await sendRaw(f.service.socketPath, bytes);
  const after = await f.state();
  await save("framing-state", { before, after });
  expect(after).toEqual(before);
  expect((await callLocal(f.service.socketPath, f.request)).ok).toBe(true);
  expect(await f.state()).not.toEqual(before);
});

test("client TIMEOUT after a real committed reply preserves same-ID replay and history", async () => {
  const f = await emptyProject();
  const sockets = new Set<Socket>();
  let resolveCommitted!: (value: { response: OperationResponse; at: number }) => void;
  let rejectCommitted!: (error: unknown) => void;
  const committed = new Promise<{ response: OperationResponse; at: number }>((resolve, reject) => {
    resolveCommitted = resolve;
    rejectCommitted = reject;
  });
  const proxy = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.on("close", () => sockets.delete(socket));
    let input = "";
    socket.on("data", (bytes) => {
      input += bytes.toString();
      if (!input.endsWith("\n")) return;
      socket.removeAllListeners("data");
      const request = JSON.parse(input) as OperationRequest;
      void callLocal(f.service.socketPath, request).then(
        (response) => resolveCommitted({ response, at: performance.now() }),
        rejectCommitted,
      );
      // Hold the actual backend reply. The client, not the mutation owner, times out.
    });
  });
  cleanups.push(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) =>
      proxy.close((error) => (error ? reject(error) : resolve())),
    );
  });
  const path = join(f.home, "timeout.sock");
  proxy.listen(path);
  await once(proxy, "listening");
  const started = performance.now();
  const pending = callLocal(path, f.request, { timeoutMs: 250 }).then(
    (response) => ({ response }),
    (error: unknown) => ({ error }),
  );
  const success = await committed;
  const timeout = await pending;
  const after = await f.state();
  await save("timeout-commit", { started, success, timeout, after });
  expect(success.response.ok).toBe(true);
  expect(success.at - started).toBeLessThan(250);
  expect(timeout).toMatchObject({ error: { code: "TIMEOUT" } });
  expect(await callLocal(f.service.socketPath, f.request)).toEqual(success.response);
  expect(await f.state()).toEqual(after);
  expect(after.history).toMatchObject({
    ok: true,
    data: { revisions: [{ id: f.revision.id }, { document: { canvas: { width: 32 } } }] },
  });
  expect(after.requests).toHaveLength(1);
  expect(after.requests[0]).toMatchObject({ projectId: f.project.projectId, requestId: "resize" });
  expect(JSON.parse(after.requests[0]!.result as string)).toEqual(
    success.response.ok ? success.response.data : null,
  );
  expect(JSON.parse(after.requests[0]!.arguments as string)).toEqual({
    operation: "apply",
    expectedRevisionId: f.revision.id,
    operations: f.request.params.operations,
  });
  const stale = await callLocal(f.service.socketPath, {
    ...f.request,
    params: { ...f.request.params, requestId: "stale-resize" },
  });
  expect(stale).toMatchObject({
    ok: false,
    error: {
      code: "STALE_REVISION",
      details: {
        currentRevisionId: (success.response.ok
          ? (success.response.data as { revision: { id: string } })
          : null
        )?.revision.id,
      },
    },
  });
});

test("package-root refusal does not revoke unrelated canonical project dispatch", async () => {
  const f = await emptyProject();
  await mkdir(join(f.home, "library", "packages"), { mode: 0o755 });
  await chmod(join(f.home, "library", "packages"), 0o755);
  const opened = await f.call("package.open", { path: "/absent.zip" });
  await save("package-refusal", opened);
  expect(opened).toMatchObject({
    ok: false,
    error: { code: "INVALID_STORAGE" },
  });
  expect(await f.call("package.status", {})).toEqual({
    id: "test",
    ok: true,
    data: { usage: null, admissions: [] },
  });
  expect(await f.call("project.get", { projectId: f.project.projectId })).toMatchObject({
    ok: true,
    data: { projectId: f.project.projectId, currentRevisionId: f.revision.id },
  });
  expect((await callLocal(f.service.socketPath, f.request)).ok).toBe(true);
});

// Sparse sizes and stat-bound receipts exercise actual Models metadata/readiness only.
// These are not model weights; the controlled transcription edge never reads them.
async function modelMetadata(library: string) {
  const root = join(library, "models", "parakeet", parakeetModel.revision);
  const files: Record<string, { modifiedNs: string; inode: string }> = {};
  for (const file of parakeetModel.files) {
    const path = join(root, parakeetModel.folderName, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "");
    await truncate(path, file.bytes);
    const info = await lstat(path, { bigint: true });
    files[file.path] = { modifiedNs: String(info.mtimeNs), inode: String(info.ino) };
  }
  const receipt = join(root, "receipt.json");
  await writeFile(
    receipt,
    JSON.stringify({
      modelDigest: new Models(library).transcription("parakeet").modelDigest,
      files,
    }),
  );
  return { directory: join(root, parakeetModel.folderName), receipt };
}
const spoken = [
  { text: "Open", startUs: 200000, endUs: 500000 },
  { text: "the", startUs: 500000, endUs: 700000 },
  { text: "Settings", startUs: 800000, endUs: 1400000 },
  { text: "panel.", startUs: 1500000, endUs: 2000000 },
  { text: "Um,", startUs: 4100000, endUs: 4300000 },
  { text: "press", startUs: 4500000, endUs: 5000000 },
  { text: "record", startUs: 5100000, endUs: 5800000 },
];
test("selected-source transcript preserves filler, phrase and ready retry through actual model metadata", async () => {
  const requests: SpeechTranscriptionRequest[] = [];
  const f = await projectServiceFixture(cleanups, async (operation, params) => {
    if (operation === "media.probe")
      return {
        ok: true,
        data: {
          originUs: 48675,
          streams: [
            {
              id: "track:1",
              kind: "audio",
              codec: "pcm",
              decodable: true,
              startUs: 0,
              endUs: 10000000,
              segments: [
                { startUs: 0, endUs: 3000000, empty: false },
                { startUs: 3000000, endUs: 4000000, empty: true },
                { startUs: 4000000, endUs: 6000000, empty: false },
                { startUs: 6000000, endUs: 10000000, empty: true },
              ],
            },
          ],
        },
      };
    expect(operation).toBe("speech.transcribe");
    const request = params as SpeechTranscriptionRequest;
    requests.push(request);
    const lines = request.track.available.map((source, ordinal) => {
      const words = spoken
        .filter(
          (word) => word.startUs >= Number(source.startUs) && word.endUs <= Number(source.endUs),
        )
        .map(({ text, ...range }) => ({
          text,
          source: range,
          confidence: 0.9,
          startSeconds: (range.startUs - Number(source.startUs)) / 1e6,
          endSeconds: (range.endUs - Number(source.startUs)) / 1e6,
        }));
      return { ordinal, source, state: "transcribed" as const, words };
    });
    const raw = lines.map((line) => JSON.stringify(line) + "\n").join("");
    await writeFile(request.output, raw);
    return {
      ok: true,
      data: {
        output: {
          file: request.output,
          bytes: Buffer.byteLength(raw),
          sha256: createHash("sha256").update(raw).digest("hex"),
        },
        engine: {
          ...parakeetModel.engine,
          encoderPrecision: "int8",
          computeUnits: "cpuAndNeuralEngine",
        },
        segments: lines.map(({ ordinal, source, state, words }) => ({
          ordinal,
          source,
          state,
          wordCount: words.length,
        })),
        wordCount: spoken.length,
      },
    };
  });
  const model = await modelMetadata(await realpath(join(f.home, "library")));
  const receipt = await readFile(model.receipt);
  const status = await f.call("model.status", { modelId: "parakeet" });
  expect(status).toMatchObject({ ok: true, data: { state: "ready" } });
  expect(await f.call("model.prepare", { modelId: "parakeet" })).toEqual(status);
  expect(await f.call("model.prepare", { modelId: "parakeet" })).toEqual(status);
  expect(await readFile(model.receipt)).toEqual(receipt);
  const imported = await f.call("asset.import", { requestId: "speech", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const ready = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const selection = { assetId: ready.published!.output.assetId, streamId: "track:1" };
  expect(await f.call("transcript.get", { ...selection, prepare: false })).toMatchObject({
    ok: true,
    data: { state: "not_requested", jobId: null, page: null },
  });
  const created = await f.call("project.create", { requestId: "cached-read", canvas });
  if (!created.ok) throw new Error(JSON.stringify(created));
  const initial = created.data as { project: { projectId: string }; revision: { id: string } };
  const edited = await f.call("edit.apply", {
    projectId: initial.project.projectId,
    expectedRevisionId: initial.revision.id,
    requestId: "cached-place",
    operations: [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "dialogue" },
      {
        operation: "place",
        clip: {
          trackId: { label: "dialogue" },
          ...selection,
          source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 2000000 } },
        },
      },
    ],
  });
  if (!edited.ok) throw new Error(JSON.stringify(edited));
  const projectSelection = {
    projectId: initial.project.projectId,
    revisionId: (edited.data as { revision: { id: string } }).revision.id,
  };
  expect(await f.call("transcript.get", { ...projectSelection, prepare: false })).toMatchObject({
    ok: true,
    data: {
      state: "not_ready",
      reason: "source_evidence_not_ready",
      page: null,
      dependencies: [{ state: "not_requested", jobId: null }],
    },
  });
  const database = new DatabaseSync(join(f.home, "library", "catalog.sqlite"));
  cleanups.push(async () => database.close());
  expect(database.prepare("SELECT artifact FROM jobs WHERE artifact='transcript'").all()).toEqual(
    [],
  );
  expect(requests).toEqual([]);
  const pending = await f.call("transcript.get", selection);
  if (!pending.ok) throw new Error(JSON.stringify(pending));
  const jobId = (pending.data as { jobId: string }).jobId;
  await f.job(jobId, "ready");
  const rows: SourceTranscriptRow[] = [];
  let cursor: unknown;
  let generation: string | undefined;
  do {
    const page = await f.call("transcript.get", {
      ...selection,
      limit: 4,
      ...(cursor ? { cursor } : {}),
    });
    if (!page.ok) throw new Error(JSON.stringify(page));
    const data = page.data as {
      generation: string;
      page: { rows: SourceTranscriptRow[]; nextCursor: unknown };
    };
    generation ??= data.generation;
    expect(data.generation).toBe(generation);
    rows.push(...data.page.rows);
    cursor = data.page.nextCursor;
  } while (cursor);
  await save("source-transcript", { requests, rows, generation });
  expect(
    rows.map((row) => (row.type === "word" ? `${row.id}:${row.text}` : `gap:${row.reason}`)),
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
    sourceRange: { startUs: 4100000, endUs: 4300000 },
  });
  expect(await f.call("transcript.search", { ...selection, text: "settings PANEL" })).toMatchObject(
    {
      ok: true,
      data: {
        generation,
        page: {
          entries: [{ wordIds: ["w2", "w3"], sourceRange: { startUs: 800000, endUs: 2000000 } }],
          nextCursor: null,
        },
      },
    },
  );
  const first = await f.call("transcript.retry", selection);
  expect(first).toMatchObject({
    ok: true,
    data: { state: "ready", jobId, published: { output: { generation } } },
  });
  expect(await f.call("transcript.retry", selection)).toEqual(first);
  expect(await f.call("transcript.get", selection)).toMatchObject({
    ok: true,
    data: { generation },
  });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    models: { directory: model.directory, files: parakeetModel.files },
    track: {
      streamId: "track:1",
      sourceOffsetUs: -48675,
      available: [
        { startUs: 0, endUs: 3000000 },
        { startUs: 4000000, endUs: 6000000 },
      ],
    },
  });
  expect(await readFile(requests[0]!.track.source, "utf8")).toBe("image bytes");
  expect(await f.call("project.list", {})).toMatchObject({
    ok: true,
    data: {
      projects: [
        { projectId: projectSelection.projectId, currentRevisionId: projectSelection.revisionId },
      ],
    },
  });
});

test("ready and canceled source jobs retain identity through public cancel and restart", async () => {
  let holdProbe = false;
  let failProbe = false;
  let announceProbe!: () => void;
  let probeEntry = new Promise<void>((resolve) => {
    announceProbe = resolve;
  });
  const worker: Parameters<typeof projectServiceFixture>[1] = async (...[operation, , options]) => {
    expect(operation).toBe("media.probe");
    if (failProbe)
      return {
        ok: false,
        error: {
          code: "MEDIA_UNAVAILABLE",
          message: "Controlled retained source access failure",
          retryable: true,
          details: {},
        },
      };
    if (holdProbe) {
      announceProbe();
      const signal = options!.signal!;
      signal.throwIfAborted();
      await once(signal, "abort");
      signal.throwIfAborted();
    }
    return {
      ok: true,
      data: {
        originUs: 0,
        streams: [
          {
            id: "image:0",
            kind: "image",
            codec: "public.png",
            decodable: true,
            width: 2,
            height: 1,
            orientedWidth: 2,
            orientedHeight: 1,
            orientation: 1,
          },
        ],
      },
    };
  };
  let f = await projectServiceFixture(cleanups, worker);
  const imported = await f.call("asset.import", { requestId: "ready", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const readyId = (imported.data as { jobId: string }).jobId;
  await f.job(readyId, "ready");
  const ready = await f.call("job.get", { jobId: readyId });
  for (const operation of ["job.get", "job.retry", "job.cancel"])
    expect(await f.call(operation, { jobId: readyId })).toEqual(ready);
  failProbe = true;
  const other = join(f.home, "other.png");
  await writeFile(other, "other source bytes");
  const pending = await f.call("asset.import", { requestId: "canceled", path: other });
  if (!pending.ok) throw new Error(JSON.stringify(pending));
  const jobId = (pending.data as { jobId: string }).jobId;
  await f.job(jobId, "failed");
  const failed = await f.call("job.get", { jobId });
  expect(failed).toMatchObject({
    ok: true,
    data: { state: "failed", errorCode: "MEDIA_UNAVAILABLE", retryable: true, published: null },
  });
  failProbe = false;
  holdProbe = true;
  expect(await f.call("job.retry", { jobId })).toMatchObject({
    ok: true,
    data: { jobId, target: (failed.ok ? (failed.data as { target: unknown }) : null)?.target },
  });
  await probeEntry;
  const canceled = await f.call("job.cancel", { jobId });
  expect(canceled).toMatchObject({
    ok: true,
    data: { jobId, state: "canceled", target: { kind: "import" }, published: null },
  });
  const home = f.home;
  await f.service.close();
  f = await projectServiceFixture(cleanups, worker, home);
  expect(await f.call("job.get", { jobId })).toEqual(canceled);
  probeEntry = new Promise<void>((resolve) => {
    announceProbe = resolve;
  });
  const retried = await f.call("job.retry", { jobId });
  expect(retried).toMatchObject({
    ok: true,
    data: { jobId, target: (canceled.ok ? (canceled.data as { target: unknown }) : null)?.target },
  });
  if (!retried.ok || !canceled.ok) throw new Error("Job operation failed");
  expect((retried.data as { attemptId: string }).attemptId).not.toBe(
    (canceled.data as { attemptId: string }).attemptId,
  );
  await probeEntry;
  const stopped = await f.call("job.cancel", { jobId });
  expect(stopped).toMatchObject({
    ok: true,
    data: { jobId, state: "canceled", target: (canceled.data as { target: unknown }).target },
  });
  expect(await f.call("job.get", { jobId })).toEqual(stopped);
  for (const operation of ["job.get", "job.retry", "job.cancel"])
    expect(await f.call(operation, { jobId: "missing-job" })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  await save("source-jobs", { ready, failed, canceled, retried, stopped });
  expect(await f.call("project.list", {})).toMatchObject({ ok: true, data: { projects: [] } });
});
