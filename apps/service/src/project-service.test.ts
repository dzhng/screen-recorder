import { createHash } from "node:crypto";
import { writeSync } from "node:fs";
import { AcquisitionStore } from "@screenrec/core/acquisitions";
import { ProjectStore } from "@screenrec/core/projects";
import { TranscriptStore } from "@screenrec/core/transcript";
import { assetTranscriptOwner } from "@screenrec/core/transcript-processing";
import { ResourceReferences } from "@screenrec/core/references";
import { mkdtemp, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { fork } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, test } from "vitest";
import { AssetStore } from "@screenrec/core/assets";
import { Catalog } from "@screenrec/core/catalog";
import { callLocal } from "@screenrec/client";
import { encodeJsonLine, REQUEST_FRAME_BYTES } from "@screenrec/protocol";
import { startProjectService } from "./project-service.js";
import type { MediaWorker } from "./worker.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const metadata = {
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
};
function probeFileFixture(home: string, worker: MediaWorker): MediaWorker {
  return async (operation, params, options) => {
    // Preserve the real worker's strict wire boundary even when its execution is a fixture.
    encodeJsonLine({ id: "fixture", operation, params }, REQUEST_FRAME_BYTES);
    if (operation === "media.audioCapabilities") return { ok: true, data: {} };
    if (operation === "storage.clearRenderWorkspace") {
      const parent = params.parent as { name: string } | undefined;
      if (parent)
        await rm(join(home, "library", "render", parent.name), { recursive: true, force: true });
      return { ok: true, data: { removed: true } };
    }
    const result = await worker(operation, params, options);
    if (operation !== "media.probe" || !result.ok) return result;
    // Model the native file handoff; each test still supplies its own probe result/error.
    const bytes = Buffer.from(JSON.stringify(result.data));
    const index = Number(String(params.output).split("/").at(-1)) - 3;
    writeSync(options!.descriptors![index]!, bytes, 0, bytes.length, 0);
    return {
      ok: true,
      data: {
        file: params.output,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  };
}
async function setup(worker: MediaWorker) {
  const home = await mkdtemp(join(tmpdir(), "asset-service-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const path = join(home, "source.png");
  await writeFile(path, "image bytes");
  const service = await startProjectService({
    home,
    worker: probeFileFixture(home, worker),
  });
  cleanups.push(() => service.close());
  async function call(operation: string, params: Record<string, unknown>) {
    const result = await callLocal(service.socketPath, { id: "test", operation, params });
    if (result.ok && ["job.get", "job.retry", "job.cancel", "asset.import"].includes(operation)) {
      expect(result.data).not.toHaveProperty("input");
      expect(result.data).toHaveProperty("inputSha256", expect.stringMatching(/^[a-f0-9]{64}$/));
    }
    return result;
  }
  async function job(jobId: string, state: string) {
    const deadline = performance.now() + 3000;
    for (;;) {
      const result = await call("job.get", { jobId });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as {
          state: string;
          result: { assetId: string } | null;
          errorCode: string | null;
        };
        if (data.state === state) return data;
        if (["failed", "unavailable", "canceled"].includes(data.state))
          throw new Error(`Unexpected terminal job: ${JSON.stringify(data)}`);
      }
      if (performance.now() >= deadline)
        throw new Error(`Job never reached ${state}: ${JSON.stringify(result)}`);
      await delay(10);
    }
  }
  return { home, path, service, call, job };
}
test("audio preparation pins its revision and reuses failed work until explicit retry", async () => {
  let attempts = 0;
  const f = await setup(async (operation) => {
    if (operation === "storage.clearRenderWorkspace") return { ok: true, data: { removed: true } };
    expect(operation).toBe("media.mixCompositionAudio");
    attempts++;
    return {
      ok: false,
      error: { code: "MEDIA_WORKER_UNAVAILABLE", message: "offline", retryable: true, details: {} },
    };
  });
  const created = await f.call("project.create", {
    requestId: "prepare",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  if (!created.ok) throw new Error(JSON.stringify(created));
  const initial = created.data as { project: { projectId: string }; revision: { id: string } };
  const edited = await f.call("edit.apply", {
    projectId: initial.project.projectId,
    expectedRevisionId: initial.revision.id,
    requestId: "silence",
    operations: [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      {
        operation: "place",
        clip: {
          trackId: { label: "audio" },
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000 } },
        },
      },
    ],
  });
  if (!edited.ok) throw new Error(JSON.stringify(edited));
  const selection = {
    projectId: initial.project.projectId,
    revisionId: (edited.data as { revision: { id: string } }).revision.id,
  };
  const pending = await f.call("audio.prepare", selection);
  expect(pending.ok).toBe(true);
  if (!pending.ok) return;
  expect(pending.data).toMatchObject(selection);
  const { jobId } = pending.data as { jobId: string };
  await f.job(jobId, "failed");
  const catalog = new Catalog(join(f.home, "library/catalog.sqlite"));
  try {
    const input = catalog.catalog.prepare("SELECT input FROM jobs WHERE jobId=?").get(jobId)!
      .input as string;
    expect(await f.call("job.get", { jobId })).toMatchObject({
      ok: true,
      data: { inputSha256: createHash("sha256").update(input).digest("hex") },
    });
  } finally {
    catalog.close();
  }
  const failed = await f.call("audio.prepare", selection);
  expect(failed).toMatchObject({
    ok: true,
    data: { ...selection, state: "failed", jobId, retryable: true, published: null },
  });
  expect(attempts).toBe(1);
  expect(await f.call("job.retry", { jobId })).toMatchObject({ ok: true, data: { jobId } });
  await f.job(jobId, "failed");
  expect(attempts).toBe(2);
  expect(await f.call("revision.get", selection)).toMatchObject({
    ok: true,
    data: { revision: { id: selection.revisionId } },
  });
  expect(await f.call("audio.prepare", { projectId: selection.projectId })).toMatchObject({
    ok: false,
    error: { code: "INVALID_PARAMS" },
  });
});
test("failed probe retries through the shared job and publishes immutable media once", async () => {
  let attempts = 0;
  const f = await setup(async () =>
    ++attempts === 1
      ? {
          ok: false,
          error: {
            code: "MEDIA_WORKER_UNAVAILABLE",
            message: "worker stopped",
            retryable: true,
            details: {},
          },
        }
      : { ok: true, data: metadata },
  );
  const accepted = await f.call("asset.import", { requestId: "import", path: f.path });
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) return;
  const { jobId } = accepted.data as { jobId: string };
  expect((await f.job(jobId, "failed")).errorCode).toBe("MEDIA_WORKER_UNAVAILABLE");
  expect(await f.call("asset.list", {})).toMatchObject({ ok: true, data: { assets: [] } });
  expect(await f.call("job.retry", { jobId })).toMatchObject({ ok: true, data: { jobId } });
  const ready = await f.job(jobId, "ready");
  expect(ready.result?.assetId).toMatch(/^[a-f0-9]{64}$/);
  expect(attempts).toBe(2);
  await rm(f.path);
  expect(await f.call("asset.import", { requestId: "import", path: f.path })).toMatchObject({
    ok: true,
    data: { jobId, result: ready.result },
  });
});
test("cancel drains probing and refuses changed frozen inputs on retry", async () => {
  let entered!: () => void;
  const started = new Promise<void>((resolve) => (entered = resolve));
  let aborted!: () => void;
  const stopped = new Promise<void>((resolve) => (aborted = resolve));
  const f = await setup(async (_operation, _params, options) => {
    entered();
    await new Promise<void>((resolve) =>
      options!.signal!.addEventListener(
        "abort",
        () => {
          aborted();
          resolve();
        },
        { once: true },
      ),
    );
    return {
      ok: false,
      error: { code: "CANCELED", message: "canceled", retryable: true, details: {} },
    };
  });
  const result = await f.call("asset.import", { requestId: "cancel", path: f.path });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const { jobId } = result.data as { jobId: string };
  await started;
  expect(await f.call("job.cancel", { jobId })).toMatchObject({
    ok: true,
    data: { state: "canceled" },
  });
  await stopped;
  expect(await f.call("asset.list", {})).toMatchObject({ ok: true, data: { assets: [] } });
  await writeFile(f.path, "changed image bytes");
  expect(await f.call("job.retry", { jobId })).toMatchObject({ ok: true });
  expect((await f.job(jobId, "failed")).errorCode).toBe("SOURCE_CHANGED");
});

test("process death after owned copy leaves a retryable job and no visible partial asset", async () => {
  const home = await mkdtemp(join(tmpdir(), "asset-crash-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const path = join(home, "source.png");
  await writeFile(path, "crash pixels");
  const child = fork(new URL("../fixtures/project-service-crash.mjs", import.meta.url), [home], {
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  cleanups.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  });
  const [started] = (await once(child, "message")) as [{ socketPath: string }];
  const probing = once(child, "message");
  const accepted = await callLocal(started.socketPath, {
    id: "import",
    operation: "asset.import",
    params: { requestId: "crash", path },
  });
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) return;
  const { jobId } = accepted.data as { jobId: string };
  expect((await probing)[0]).toEqual({ phase: "owned-copy-probing" });
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
  const service = await startProjectService({
    home,
    worker: probeFileFixture(home, async () => ({ ok: true, data: metadata })),
  });
  cleanups.push(() => service.close());
  expect(await readdir(join(home, "library", "staging", "assets"))).toEqual([]);
  const interrupted = await callLocal(service.socketPath, {
    id: "status",
    operation: "job.get",
    params: { jobId },
  });
  expect(interrupted).toMatchObject({
    ok: true,
    data: { state: "failed", errorCode: "JOB_INTERRUPTED", retryable: true },
  });
  const retried = await callLocal(service.socketPath, {
    id: "retry",
    operation: "job.retry",
    params: { jobId },
  });
  expect(retried.ok).toBe(true);
  const deadline = performance.now() + 3000;
  for (;;) {
    const status = await callLocal(service.socketPath, {
      id: "poll",
      operation: "job.get",
      params: { jobId },
    });
    if (status.ok && (status.data as { state: string }).state === "ready") break;
    if (performance.now() > deadline) throw new Error(JSON.stringify(status));
    await delay(10);
  }
  expect(service.assets.get(service.assets.list().assets[0]!.id).streams).toEqual(metadata.streams);
});

test("queue capacity refusal leaves no frozen import receipt to poison a later admission", async () => {
  let hold = true;
  const f = await setup(async (_operation, _params, options) => {
    if (hold && !options!.signal!.aborted)
      await new Promise<void>((resolve) =>
        options!.signal!.addEventListener("abort", () => resolve(), { once: true }),
      );
    return options!.signal!.aborted
      ? {
          ok: false,
          error: { code: "CANCELED", message: "canceled", retryable: true, details: {} },
        }
      : { ok: true, data: metadata };
  });
  const accepted: string[] = [];
  let refusedRequest: string | undefined;
  for (let index = 0; index < 100; index++) {
    const requestId = `capacity-${index}`;
    const response = await f.call("asset.import", { requestId, path: f.path });
    if (!response.ok) {
      expect(response.error.code).toBe("LIMIT_EXCEEDED");
      refusedRequest = requestId;
      break;
    }
    accepted.push((response.data as { jobId: string }).jobId);
  }
  expect(refusedRequest).toBeDefined();
  for (const jobId of accepted.slice(1).reverse()) await f.call("job.cancel", { jobId });
  hold = false;
  await f.call("job.cancel", { jobId: accepted[0] });
  await writeFile(f.path, "new bytes after capacity refusal");
  const response = await f.call("asset.import", { requestId: refusedRequest, path: f.path });
  expect(response.ok).toBe(true);
  if (!response.ok) return;
  const ready = await f.job((response.data as { jobId: string }).jobId, "ready");
  expect(await readFile(f.service.assets.path(ready.result!.assetId), "utf8")).toBe(
    "new bytes after capacity refusal",
  );
});

test("large provenance history cannot hide metadata and every origin remains pageable", async () => {
  const f = await setup(async () => ({ ok: true, data: metadata }));
  const accepted = await f.call("asset.import", { requestId: "history", path: f.path });
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) return;
  const ready = await f.job((accepted.data as { jobId: string }).jobId, "ready");
  const assetId = ready.result!.assetId;
  await f.service.close();
  // Seed persisted history at scale while no service owns the catalog; public reads are the gate.
  const catalog = new Catalog(join(f.home, "library", "catalog.sqlite"));
  const expected = [{ kind: "import", source: f.path }];
  try {
    const insert = catalog.catalog.prepare("INSERT INTO asset_origins VALUES(?,?)");
    catalog.transaction(() => {
      for (let index = 0; index < 10_000; index++) {
        const origin = {
          kind: "import",
          source:
            "/" +
            ("a".repeat(200) + "/").repeat(4) +
            `source-${String(index).padStart(5, "0")}.png`,
        };
        expected.push(origin);
        insert.run(assetId, JSON.stringify(origin));
      }
    });
  } finally {
    catalog.close();
  }
  expect(Buffer.byteLength(JSON.stringify(expected))).toBeGreaterThan(8 * 1024 * 1024);
  const service = await startProjectService({
    home: f.home,
    worker: probeFileFixture(f.home, async () => ({ ok: true, data: metadata })),
  });
  cleanups.push(() => service.close());
  const get = await callLocal(service.socketPath, {
    id: "metadata",
    operation: "asset.get",
    params: { assetId },
  });
  expect(get).toMatchObject({ ok: true, data: { id: assetId, streams: metadata.streams } });
  expect(Buffer.byteLength(JSON.stringify(get))).toBeLessThan(1024);
  const observed: ReturnType<AssetStore["origins"]>["origins"] = [];
  let cursor: ReturnType<AssetStore["origins"]>["nextCursor"] = null;
  do {
    const response = await callLocal(service.socketPath, {
      id: "page",
      operation: "asset.origins",
      params: { assetId, limit: 37, ...(cursor ? { cursor } : {}) },
    });
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error(JSON.stringify(response));
    expect(Buffer.byteLength(JSON.stringify(response))).toBeLessThan(40_000);
    const page = response.data as ReturnType<AssetStore["origins"]>;
    expect(page.origins.length).toBeGreaterThan(0);
    expect(page.origins.length).toBeLessThanOrEqual(37);
    observed.push(...page.origins);
    expect(observed.length).toBeLessThanOrEqual(expected.length);
    cursor = page.nextCursor;
  } while (cursor);
  expect(observed.map((origin) => JSON.stringify(origin))).toEqual(
    expected.map((origin) => JSON.stringify(origin)).sort(),
  );
});

test("startup resumes a committed project deletion marker before serving requests", async () => {
  const f = await setup(async () => ({ ok: true, data: metadata }));
  const creation = {
    requestId: "resume",
    canvas: {
      width: 160,
      height: 96,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  };
  const created = await f.call("project.create", creation);
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const { project } = created.data as { project: { projectId: string } };
  await f.service.close();
  const catalog = new Catalog(join(f.home, "library/catalog.sqlite"));
  const projects = projectStoreFixture(
    catalog,
    new AssetStore(catalog, join(f.home, "library")),
    join(f.home, "library"),
  );
  expect(projects.markDeleting(project.projectId)).toBe(true);
  catalog.close();
  const restarted = await startProjectService({ home: f.home });
  cleanups.push(() => restarted.close());
  expect(
    await callLocal(restarted.socketPath, {
      id: "get",
      operation: "project.get",
      params: { projectId: project.projectId },
    }),
  ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  await restarted.close();
  const check = new Catalog(join(f.home, "library/catalog.sqlite"));
  try {
    const store = projectStoreFixture(
      check,
      new AssetStore(check, join(f.home, "library")),
      join(f.home, "library"),
    );
    expect(store.deletionsPage().projectIds).toEqual([]);
    expect(store.create(creation)).toEqual(created.data);
    expect(store.list().projects).toEqual([]);
  } finally {
    check.close();
  }
});

test("shutdown aborts an in-flight export destination admission before draining requests", async () => {
  let entered!: () => void;
  const started = new Promise<void>((resolve) => (entered = resolve));
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let aborted!: () => void;
  const canceled = new Promise<boolean>((resolve) => (aborted = () => resolve(true)));
  const f = await setup(async (operation, _params, options) => {
    if (operation === "media.probe") return { ok: true, data: metadata };
    if (operation !== "storage.externalDirectory") throw new Error(`Unexpected ${operation}`);
    entered();
    const onAbort = () => {
      aborted();
      release();
    };
    if (options?.signal?.aborted) onAbort();
    else options?.signal?.addEventListener("abort", onAbort, { once: true });
    await released;
    return {
      ok: false,
      error: { code: "CANCELED", message: "admission canceled", retryable: true, details: {} },
    };
  });
  const imported = await f.call("asset.import", { requestId: "source", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const ready = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const created = await f.call("project.create", {
    requestId: "project",
    canvas: {
      width: 160,
      height: 96,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  if (!created.ok) throw new Error(JSON.stringify(created));
  const { project, revision } = created.data as {
    project: { projectId: string };
    revision: { id: string };
  };
  expect(
    await f.call("edit.apply", {
      projectId: project.projectId,
      requestId: "place",
      expectedRevisionId: revision.id,
      operations: [
        { operation: "track.add", track: { kind: "video", order: 0 }, label: "picture" },
        {
          operation: "place",
          clip: {
            trackId: { label: "picture" },
            assetId: ready.result!.assetId,
            streamId: "image:0",
            source: { kind: "hold", atUs: 0 },
            placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
          },
        },
      ],
    }),
  ).toMatchObject({ ok: true });
  const pending = f
    .call("export.create", {
      projectId: project.projectId,
      exportId: "67a0c032-a3ee-44b9-81f8-7269f0f3195e",
      kind: "video",
      directory: f.home,
      leaf: "output.mp4",
    })
    .catch(() => null); // Shutdown may close the transport before replying.
  await started;
  const closing = f.service.close();
  try {
    expect(await Promise.race([canceled, delay(1000).then(() => false)])).toBe(true);
  } finally {
    release();
    await pending;
    await closing;
  }
  const catalog = new Catalog(join(f.home, "library/catalog.sqlite"));
  try {
    expect(catalog.catalog.prepare("SELECT COUNT(*) AS count FROM export_intents").get()).toEqual({
      count: 0,
    });
    expect(await readdir(f.home)).not.toContain("output.mp4");
  } finally {
    catalog.close();
  }
});

test("selected-source transcript reads report unprepared models without downloading or inventing a recording", async () => {
  const requests: string[] = [];
  const f = await setup(async (operation) => {
    requests.push(operation);
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
            endUs: 1000000,
            segments: [{ startUs: 0, endUs: 1000000, empty: false }],
          },
        ],
      },
    };
  });
  const imported = await f.call("asset.import", { requestId: "speech", path: f.path });
  expect(imported.ok).toBe(true);
  if (!imported.ok) return;
  const ready = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const selection = { assetId: ready.result!.assetId, streamId: "track:1" };
  expect(await f.call("model.status", {})).toMatchObject({ ok: true, data: { state: "absent" } });
  expect(await f.call("transcript.get", selection)).toMatchObject({
    ok: true,
    data: { ...selection, reason: "model_not_prepared", page: null },
  });
  expect(await f.call("transcript.search", { ...selection, text: "hello" })).toMatchObject({
    ok: true,
    data: { reason: "model_not_prepared", page: null },
  });
  expect(await f.call("transcript.retry", selection)).toMatchObject({
    ok: false,
    error: { code: "MODEL_NOT_PREPARED" },
  });
  expect(await f.call("transcript.get", { ...selection, acquisitionId: "missing" })).toMatchObject({
    ok: false,
    error: { code: "NOT_FOUND" },
  });
  expect(await f.call("model.status", {})).toMatchObject({ ok: true, data: { state: "absent" } });
  expect(requests.filter((operation) => operation === "speech.transcribe")).toEqual([]);
});

test("project transcript paging uses shared jobs and returns an empty historical revision", async () => {
  const f = await setup(async (operation) => {
    if (operation === "storage.clearRenderWorkspace") return { ok: true, data: { removed: true } };
    throw new Error(`Empty transcript must not invoke native work: ${operation}`);
  });
  const created = await f.call("project.create", {
    requestId: "empty-transcript",
    canvas: {
      width: 160,
      height: 96,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  if (!created.ok) throw new Error(JSON.stringify(created));
  const { project, revision } = created.data as {
    project: { projectId: string };
    revision: { id: string };
  };
  const params = { projectId: project.projectId, revisionId: revision.id, limit: 1 };
  const pending = await f.call("transcript.get", params);
  if (!pending.ok) throw new Error(JSON.stringify(pending));
  const jobId = (pending.data as { jobId: string }).jobId;
  await f.job(jobId, "ready");
  expect(await f.call("transcript.get", params)).toMatchObject({
    ok: true,
    data: {
      projectId: project.projectId,
      revisionId: revision.id,
      state: "ready",
      dependencies: [],
      page: { rows: [], nextCursor: null },
    },
  });
  const searching = await f.call("transcript.search", { ...params, text: "missing words" });
  if (!searching.ok) throw new Error(JSON.stringify(searching));
  await f.job((searching.data as { jobId: string }).jobId, "ready");
  expect(await f.call("transcript.search", { ...params, text: "missing words" })).toMatchObject({
    ok: true,
    data: {
      projectId: project.projectId,
      revisionId: revision.id,
      state: "ready",
      page: { entries: [], nextCursor: null },
    },
  });
  expect(await f.call("transcript.get", { projectId: "missing" })).toMatchObject({
    ok: false,
    error: { code: "NOT_FOUND" },
  });
});

test("selected-source audio publishes verified WAV bytes through artifact delivery", async () => {
  const wave = Buffer.from(
    "524946462800000057415645666d7420100000000300010080bb000000ee02000400200064617461040000000000803e",
    "hex",
  );
  let renderAttempt: string | undefined;
  const f = await setup(async (operation, params) => {
    if (operation === "storage.clearRenderWorkspace") {
      if (renderAttempt && params.parent) await rm(renderAttempt, { recursive: true, force: true });
      return { ok: true, data: { removed: true } };
    }
    if (operation === "media.probe")
      return {
        ok: true,
        data: {
          originUs: 0,
          streams: [
            {
              id: "audio:1",
              kind: "audio",
              codec: "pcm",
              decodable: true,
              startUs: 0,
              endUs: 1000000,
              sampleRate: 48000,
              channels: 1,
              segments: [{ startUs: 0, endUs: 1000000, empty: false }],
            },
          ],
        },
      };
    if (operation !== "media.sourceAudio") throw new Error(operation);
    renderAttempt = dirname(params.output as string);
    expect(params.source).toMatchObject({
      streamId: "audio:1",
      available: [{ startUs: 0, endUs: 1000000 }],
    });
    expect(params.range).toEqual({ startUs: 0, endUs: 21 });
    await writeFile(params.output as string, wave, { flag: "wx" });
    return {
      ok: true,
      data: {
        file: params.output,
        mediaType: "audio/wav",
        bytes: wave.length,
        sampleRate: 48000,
        channels: 1,
        layout: "mono",
        range: params.range,
        sampleRange: { start: 0, end: 1 },
        frames: 1,
        decodedFrames: 1,
        unavailable: [],
      },
    };
  });
  const imported = await f.call("asset.import", { requestId: "audio", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const admitted = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const selection = {
    assetId: admitted.result!.assetId,
    streamId: "audio:1",
    range: { startUs: 0, endUs: 21 },
  };
  const pending = await f.call("audio.get", selection);
  if (!pending.ok) throw new Error(JSON.stringify(pending));
  await f.job((pending.data as { jobId: string }).jobId, "ready");
  const ready = await f.call("audio.get", selection);
  expect(ready).toMatchObject({
    ok: true,
    data: {
      state: "ready",
      published: {
        audio: {
          ...selection,
          frames: 1,
          sampleRate: 48000,
          channels: 1,
          unavailable: [],
        },
      },
    },
  });
  if (!ready.ok) throw new Error(JSON.stringify(ready));
  const { token } = (ready.data as { delivery: { token: string } }).delivery;
  const read = await f.call("artifact.read", { token, offset: 0 });
  expect(read).toMatchObject({
    ok: true,
    data: { data: wave.toString("base64"), eof: true, nextOffset: wave.length },
  });
  expect(await f.call("artifact.close", { token })).toMatchObject({ ok: true });
});

test("project export refuses a dangling prepared audio reference before native work", async () => {
  const f = await setup(async () => ({ ok: true, data: metadata }));
  const created = await f.call("project.create", {
    requestId: "prepared-project",
    canvas: {
      width: 64,
      height: 48,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  if (!created.ok) throw Error(JSON.stringify(created));
  const { project, revision } = created.data as {
    project: { projectId: string };
    revision: { id: string };
  };
  await f.service.close();
  const catalog = new Catalog(join(f.home, "library/catalog.sqlite"));
  new ResourceReferences(catalog).retain("prepared-audio", { kind: "revision", id: revision.id }, [
    JSON.stringify([project.projectId, "prepared-attempt"]),
  ]);
  catalog.close();
  const service = await startProjectService({
    home: f.home,
    worker: async () => {
      throw Error("Export must refuse before native work");
    },
  });
  cleanups.push(() => service.close());
  const result = await callLocal(service.socketPath, {
    id: "export",
    operation: "export.create",
    params: {
      projectId: project.projectId,
      exportId: "7c3f4225-31f5-4467-9bb5-4f82d2ddf0d5",
      kind: "processed-package",
      directory: f.home,
      leaf: "prepared.zip",
    },
  });
  expect(result).toMatchObject({
    ok: false,
    error: { code: "NOT_FOUND", message: "Prepared audio publication is unavailable" },
  });
});

function projectStoreFixture(catalog: Catalog, assets: AssetStore, home: string) {
  const acquisitions = new AcquisitionStore(catalog);
  return new ProjectStore(
    catalog,
    assets,
    new TranscriptStore(catalog, home, assetTranscriptOwner(assets, acquisitions)),
    acquisitions,
  );
}
