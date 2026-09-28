import { ProjectStore } from "@screenrec/core/projects";
import { mkdtemp, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { fork } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, test } from "vitest";
import { AssetStore } from "@screenrec/core/assets";
import { Catalog } from "@screenrec/core/catalog";
import { callLocal } from "@screenrec/client";
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
async function setup(worker: MediaWorker) {
  const home = await mkdtemp(join(tmpdir(), "asset-service-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const path = join(home, "source.png");
  await writeFile(path, "image bytes");
  const service = await startProjectService({ home, worker });
  cleanups.push(() => service.close());
  async function call(operation: string, params: Record<string, unknown>) {
    return callLocal(service.socketPath, { id: "test", operation, params });
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
    worker: async () => ({ ok: true, data: metadata }),
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
    worker: async () => ({ ok: true, data: metadata }),
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
  const projects = new ProjectStore(catalog, new AssetStore(catalog, join(f.home, "library")));
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
    const store = new ProjectStore(check, new AssetStore(check, join(f.home, "library")));
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
