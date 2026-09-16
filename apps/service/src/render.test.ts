import { afterEach, expect, it } from "vitest";
import { chmod, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { MAX_MEDIA_TIMEOUT_MS, mediaWorker, type MediaWorker } from "./worker.js";
import { renderDeadlineMs, withRenderedMedia } from "./render.js";

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
  await mkdir(parent);
  await writeFile(
    executable,
    `#!${process.execPath}
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
let text=''; process.stdin.on('data',x=>text+=x); process.stdin.on('end',()=>{
 const {params}=JSON.parse(text); const dir=dirname(params.output);
 mkdirSync(join(dir,'.video-render-held')); writeFileSync(join(dir,'.video-render-held','partial'),'partial');
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
    const current = await ready(parent);
    expect(() => process.kill(current.pid, 0)).toThrowError(
      expect.objectContaining({ code: "ESRCH" }),
    );
    expect(await readFile(join(current.dir, ".video-render-held", "partial"), "utf8")).toBe(
      "partial",
    );
    return result;
  };
  const pending = withRenderedMedia(
    worker,
    { source: "hold", plan, attemptParent: parent },
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
    run(operation, params, { ...options, timeoutMs: 250 });
  await expect(
    withRenderedMedia(
      worker,
      { source: "hold", plan, attemptParent: parent },
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
    expect(result.ok).toBe(true);
    controller.abort();
    return result;
  };
  await expect(
    withRenderedMedia(
      worker,
      { source: "success", plan, attemptParent: parent },
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
  const request = { source: "success", plan, attemptParent: parent };
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

it("abort during consumption preserves consumer-owned effects while reclaiming the attempt", async () => {
  const { parent, run } = await fixture();
  const controller = new AbortController();
  await expect(
    withRenderedMedia(
      run,
      { source: "success", plan, attemptParent: parent },
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
