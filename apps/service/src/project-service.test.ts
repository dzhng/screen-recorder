import { mkdtemp, writeFile, rm, readdir, readFile } from "node:fs/promises";
import { fork } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, test } from "vitest";
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
