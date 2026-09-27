import { afterEach, expect, it } from "vitest";
import { chmod, mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { MAX_MEDIA_TIMEOUT_MS, mediaWorker, type MediaWorker } from "./worker.js";
import { CatalogError } from "@screenrec/core/catalog";
import { clearRenderWorkspace, renderDeadlineMs, withRenderedMedia } from "./render.js";

const homes: string[] = [];
afterEach(async () => {
  for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true });
});
const plan = [
  {
    source: { startUs: 90_000_000, endUs: 120_000_000 },
    playback: { startUs: 0, endUs: 30_000_000 },
  },
];
async function fixture() {
  const home = await mkdtemp("/tmp/screenrec-render-attempt-");
  homes.push(home);
  const executable = join(home, "worker");
  const parent = join(home, "attempts");
  await mkdir(parent, { mode: 0o700 });
  await writeFile(
    executable,
    `#!${process.execPath}
import {mkdirSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {dirname,join} from 'node:path';
let text=''; process.stdin.on('data',x=>text+=x); process.stdin.on('end',()=>{
 const {operation,params}=JSON.parse(text);
 if(operation==='storage.clearRenderWorkspace') {
  const parent=${JSON.stringify(parent)};
  for(const name of readdirSync(parent)) rmSync(join(parent,name),{recursive:true,force:true});
  process.stdout.write(JSON.stringify({ok:true,data:{removed:true}})+'\\n'); return;
 }
 const dir=dirname(params.output);
 mkdirSync(join(dir,'.movie-render-held')); writeFileSync(join(dir,'.movie-render-held','partial'),'partial');
 writeFileSync(join(dir,'pid'),String(process.pid));
 if(params.source==='success') {
  writeFileSync(params.output,'finished');
  process.stdout.write(JSON.stringify({ok:true,data:{file:params.output,mediaType:'video/mp4',codec:'h264',durationUs:30000000,width:2,height:2,frameCount:1,bytes:8}})+'\\n');
 }
 setInterval(()=>{},1000);
});`,
  );
  await chmod(executable, 0o755);
  return { parent, run: mediaWorker({ SCREENREC_NATIVE: executable }) };
}
async function ready(parent: string) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    for (const dir of await readdir(parent)) {
      try {
        return {
          pid: Number(await readFile(join(parent, dir, "pid"), "utf8")),
          dir: join(parent, dir),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await delay(5);
  }
  throw new Error("Worker never reached staging");
}
it("budgets the decoded source prefix instead of the shorter edited output", () => {
  expect(renderDeadlineMs(plan)).toBe(150_000);
  expect(renderDeadlineMs(plan, true)).toBe(180_000);
  const largest = [
    {
      source: { startUs: Number.MAX_SAFE_INTEGER - 1, endUs: Number.MAX_SAFE_INTEGER },
      playback: { startUs: 0, endUs: 1 },
    },
  ];
  expect(renderDeadlineMs(largest)).toBe(MAX_MEDIA_TIMEOUT_MS);
  const boundary = (MAX_MEDIA_TIMEOUT_MS - 30_000) * 1000;
  expect(
    renderDeadlineMs([
      { source: { startUs: boundary, endUs: boundary + 1 }, playback: { startUs: 0, endUs: 1 } },
    ]),
  ).toBe(MAX_MEDIA_TIMEOUT_MS);
});
it("abort waits for actual close before reclaiming native partial staging", async () => {
  const { parent, run } = await fixture();
  const controller = new AbortController();
  const worker: MediaWorker = async (...args) => {
    const result = await run(...args);
    if (args[0] === "storage.clearRenderWorkspace") return result;
    const current = await ready(parent);
    expect(() => process.kill(current.pid, 0)).toThrowError(
      expect.objectContaining({ code: "ESRCH" }),
    );
    expect(await readFile(join(current.dir, ".movie-render-held", "partial"), "utf8")).toBe(
      "partial",
    );
    return result;
  };
  const pending = withRenderedMedia(
    worker,
    { source: "hold", plan, tracks: [], attemptParent: parent },
    controller.signal,
    async () => {
      throw new Error("must not consume");
    },
  );
  const rejected = expect(pending).rejects.toMatchObject({ code: "CANCELED" });
  await ready(parent);
  controller.abort();
  await rejected;
  expect(await readdir(parent)).toEqual([]);
});
it("deadline failure reclaims the closed attempt and preserves its reason", async () => {
  const { parent, run } = await fixture();
  const worker: MediaWorker = (operation, params, options) =>
    run(
      operation,
      params,
      operation === "storage.clearRenderWorkspace" ? options : { ...options, timeoutMs: 250 },
    );
  await expect(
    withRenderedMedia(
      worker,
      { source: "hold", plan, tracks: [], attemptParent: parent },
      new AbortController().signal,
      async () => null,
    ),
  ).rejects.toMatchObject({ code: "MEDIA_WORKER_TIMEOUT", retryable: true });
  expect(await readdir(parent)).toEqual([]);
});
it("abort after native publication but before receipt prevents consumption", async () => {
  const { parent, run } = await fixture();
  const controller = new AbortController();
  const worker: MediaWorker = async (...args) => {
    const result = await run(...args);
    if (args[0] === "storage.clearRenderWorkspace") return result;
    expect(result.ok).toBe(true);
    controller.abort();
    return result;
  };
  await expect(
    withRenderedMedia(
      worker,
      { source: "success", plan, tracks: [], attemptParent: parent },
      controller.signal,
      async () => {
        throw new Error("must not consume");
      },
    ),
  ).rejects.toMatchObject({ code: "CANCELED" });
  expect(await readdir(parent)).toEqual([]);
});
it("successful consumption and consumer failure both end their attempt lifetime", async () => {
  const { parent, run } = await fixture();
  const request = { source: "success", plan, tracks: [], attemptParent: parent };
  expect(
    await withRenderedMedia(run, request, new AbortController().signal, async (video) =>
      readFile(video.file, "utf8"),
    ),
  ).toBe("finished");
  await expect(
    withRenderedMedia(run, request, new AbortController().signal, async () => {
      throw new Error("consumer failed");
    }),
  ).rejects.toThrow("consumer failed");
  expect(await readdir(parent)).toEqual([]);
});

it("carries a rendition's bound to the native render and omits it at capture resolution", async () => {
  const { parent, run } = await fixture();
  const rendered: Record<string, unknown>[] = [];
  const worker: MediaWorker = (operation, params, options) => {
    if (operation === "media.renderMovie") rendered.push(params as Record<string, unknown>);
    return run(operation, params, options);
  };
  const request = { source: "success", plan, tracks: [], attemptParent: parent };
  const consume = async () => null;
  const signal = new AbortController().signal;
  await withRenderedMedia(worker, { ...request, maxLongEdge: 1600 }, signal, consume);
  await withRenderedMedia(worker, request, signal, consume);
  expect(rendered.map((params) => params.maxLongEdge)).toEqual([1600, undefined]);
  // Absent, not null: the native default is "render every captured pixel".
  expect(Object.keys(rendered[1]!)).not.toContain("maxLongEdge");
});

it("abort during consumption preserves consumer-owned effects while reclaiming the attempt", async () => {
  const { parent, run } = await fixture();
  const controller = new AbortController();
  await expect(
    withRenderedMedia(
      run,
      { source: "success", plan, tracks: [], attemptParent: parent },
      controller.signal,
      async () => {
        await writeFile(join(parent, "..", "consumer-owned"), "committed by consumer");
        controller.abort();
        return "late";
      },
    ),
  ).rejects.toMatchObject({ code: "CANCELED" });
  expect(await readFile(join(parent, "..", "consumer-owned"), "utf8")).toBe(
    "committed by consumer",
  );
  expect(await readdir(parent)).toEqual([]);
});

it("refuses busy workspace immediately without touching live staging", async () => {
  const { parent, run } = await fixture();
  const controller = new AbortController();
  const first = withRenderedMedia(
    run,
    { source: "hold", plan, tracks: [], attemptParent: parent },
    controller.signal,
    async () => null,
  );
  const stopped = expect(first).rejects.toMatchObject({ code: "CANCELED" });
  const active = await ready(parent);
  let called = false;
  await expect(
    withRenderedMedia(
      async () => {
        called = true;
        throw new Error("must not spawn");
      },
      { source: "hold", plan, tracks: [], attemptParent: parent },
      new AbortController().signal,
      async () => null,
    ),
  ).rejects.toMatchObject({ code: "RENDER_WORKSPACE_BUSY", retryable: true });
  await expect(
    clearRenderWorkspace(run, parent, new AbortController().signal),
  ).rejects.toMatchObject({ code: "RENDER_WORKSPACE_BUSY", retryable: true });
  expect(called).toBe(false);
  expect(await readFile(join(active.dir, ".movie-render-held", "partial"), "utf8")).toBe("partial");
  controller.abort();
  await stopped;
});

it("does not retry a failed cleanup or admit rendering behind it", async () => {
  const { parent } = await fixture();
  await writeFile(join(parent, "abandoned"), "retain");
  let calls = 0;
  const failed: MediaWorker = async () => {
    calls++;
    return {
      ok: false,
      error: {
        code: "DELETE_FAILED",
        message: "owned cleanup failed",
        retryable: true,
        details: {},
      },
    };
  };
  await expect(
    withRenderedMedia(
      failed,
      { source: "success", plan, tracks: [], attemptParent: parent },
      new AbortController().signal,
      async () => null,
    ),
  ).rejects.toMatchObject({ code: "DELETE_FAILED" });
  expect(calls).toBe(1);
  expect(await readFile(join(parent, "abandoned"), "utf8")).toBe("retain");
});

it("refuses non-private and linked workspaces without native cleanup", async () => {
  const { parent } = await fixture();
  const sentinel = join(parent, "sentinel");
  await writeFile(sentinel, "retain");
  const unused: MediaWorker = async () => {
    throw new Error("must not run native cleanup");
  };
  await chmod(parent, 0o755);
  await expect(
    withRenderedMedia(
      unused,
      { source: "success", plan, tracks: [], attemptParent: parent },
      new AbortController().signal,
      async () => null,
    ),
  ).rejects.toMatchObject({ code: "INVALID_STORAGE" });
  await chmod(parent, 0o700);
  const linked = join(parent, "..", "linked");
  await symlink(parent, linked);
  await expect(
    withRenderedMedia(
      unused,
      { source: "success", plan, tracks: [], attemptParent: linked },
      new AbortController().signal,
      async () => null,
    ),
  ).rejects.toMatchObject({ code: "INVALID_STORAGE" });
  expect(await readFile(sentinel, "utf8")).toBe("retain");
});

it("preparation cancellation waits for its bound worker before cleanup", async () => {
  const { parent, run } = await fixture();
  const controller = new AbortController();
  const pending = withRenderedMedia(
    run,
    {
      source: "success",
      plan,
      tracks: [],
      attemptParent: parent,
      preparePointer: async (directory, worker) => {
        const result = await worker("media.presentationEvidence", {
          source: "hold",
          plan,
          output: join(directory, "preparation.mp4"),
        });
        if (!result.ok) throw new CatalogError(result.error.code, result.error.message);
        throw new Error("Unexpected preparation success");
      },
    },
    controller.signal,
    async () => {
      throw new Error("must not consume");
    },
  );
  const rejected = expect(pending).rejects.toMatchObject({ code: "CANCELED" });
  const current = await ready(parent);
  controller.abort();
  await rejected;
  expect(() => process.kill(current.pid, 0)).toThrowError(
    expect.objectContaining({ code: "ESRCH" }),
  );
  expect(await readdir(parent)).toEqual([]);
});

it("startup admission skips absent workspaces and clears existing stale staging once", async () => {
  const { parent, run } = await fixture();
  let calls = 0;
  const counted: MediaWorker = async (...args) => {
    calls++;
    return run(...args);
  };
  const missing = join(parent, "..", "not-created");
  await clearRenderWorkspace(counted, missing, new AbortController().signal);
  expect(calls).toBe(0);
  await expect(readdir(missing)).rejects.toMatchObject({ code: "ENOENT" });
  await writeFile(join(parent, "abandoned"), "staging");
  await clearRenderWorkspace(counted, parent, new AbortController().signal);
  expect(calls).toBe(1);
  expect(await readdir(parent)).toEqual([]);
});

it("startup cancellation during cleanup settles after cleanup and releases authority", async () => {
  const { parent, run } = await fixture();
  const controller = new AbortController();
  await writeFile(join(parent, "abandoned"), "staging");
  const worker: MediaWorker = async (...args) => {
    const result = await run(...args);
    controller.abort();
    return result;
  };
  await expect(clearRenderWorkspace(worker, parent, controller.signal)).rejects.toMatchObject({
    code: "CANCELED",
  });
  expect(await readdir(parent)).toEqual([]);
  await clearRenderWorkspace(run, parent, new AbortController().signal);
});
