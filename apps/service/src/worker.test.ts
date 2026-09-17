import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { chmod, mkdtemp, readFile, rm, writeFile, open } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { mediaWorker } from "./worker.js";

const homes: string[] = [];
afterEach(async () => {
  for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true });
});

// macOS assesses a newly written executable on its first launch, which can take longer than the
// deadlines below. One shared worker pays that once, so each test times the worker itself.
let executable: string;
beforeAll(async () => {
  const directory = await mkdtemp("/tmp/scr-worker-bin-");
  executable = join(directory, "worker");
  await writeFile(
    executable,
    `#!${process.execPath}
import { writeFileSync } from 'node:fs';
let input = '';
process.stdin.on('data', bytes => input += bytes);
process.stdin.on('end', () => {
  const request = JSON.parse(input);
  if (request.operation === 'inherited') writeFileSync(3, 'owned bytes');
  if (request.params.ready) writeFileSync(request.params.ready, String(process.pid));
  if (request.operation === 'answer') process.stdout.write(JSON.stringify({ok:true,data:{pid:process.pid}})+'\\n');
  setInterval(() => {}, 1000);
});
`,
  );
  await chmod(executable, 0o755);
  expect((await mediaWorker({ SCREENREC_NATIVE: executable }, 30_000)("answer", {})).ok).toBe(true);
});
afterAll(async () => {
  await rm(join(executable, ".."), { recursive: true, force: true });
});

async function fixture() {
  const home = await mkdtemp("/tmp/scr-worker-");
  homes.push(home);
  return { home, run: mediaWorker({ SCREENREC_NATIVE: executable }, 2000) };
}

async function readyPid(path: string) {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    try {
      return Number(await readFile(path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await delay(10);
  }
  throw new Error("Worker did not acknowledge its request");
}

function expectGone(pid: number) {
  expect(() => process.kill(pid, 0)).toThrowError(expect.objectContaining({ code: "ESRCH" }));
}

it("successful work releases its child before returning capacity", async () => {
  const { run } = await fixture();
  const result = await run("answer", {});
  expect(result.ok).toBe(true);
  if (result.ok) expectGone((result.data as { pid: number }).pid);
});

it("cancellation waits for the acknowledged worker to exit", async () => {
  const { home, run } = await fixture();
  const ready = join(home, "ready");
  const controller = new AbortController();
  const pending = run("hold", { ready }, { signal: controller.signal });
  const pid = await readyPid(ready);
  controller.abort();
  expect(await pending).toMatchObject({ ok: false, error: { code: "CANCELED" } });
  expectGone(pid);
});

it("a deadline terminates work before reporting failure", async () => {
  const { home, run } = await fixture();
  const ready = join(home, "ready");
  const pending = run("hold", { ready });
  const pid = await readyPid(ready);
  expect(await pending).toMatchObject({
    ok: false,
    error: { code: "MEDIA_WORKER_TIMEOUT", retryable: true },
  });
  expectGone(pid);
});

it("pre-canceled work never starts and spawn failure settles", async () => {
  const controller = new AbortController();
  controller.abort();
  const run = mediaWorker({ SCREENREC_NATIVE: "/nonexistent/screenrec-test-worker" });
  expect(await run("hold", {}, { signal: controller.signal })).toMatchObject({
    ok: false,
    error: { code: "CANCELED" },
  });
  expect(await run("hold", {})).toMatchObject({
    ok: false,
    error: { code: "MEDIA_WORKER_UNAVAILABLE" },
  });
});

it("rejects invalid per-call deadlines before starting work", async () => {
  const run = mediaWorker({ SCREENREC_NATIVE: "/nonexistent/worker" });
  for (const timeoutMs of [0, -1, NaN, Infinity, 2_147_483_648]) {
    expect(await run("hold", {}, { timeoutMs })).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
  }
});

it("one short call deadline does not change later calls on the worker", async () => {
  const { run } = await fixture();
  expect(await run("hold", {}, { timeoutMs: 1 })).toMatchObject({
    ok: false,
    error: { code: "MEDIA_WORKER_TIMEOUT" },
  });
  const result = await run("answer", {});
  expect(result.ok).toBe(true);
  if (result.ok) expectGone((result.data as { pid: number }).pid);
});

it("inherited descriptor remains owned by parent after canceled worker closes", async () => {
  const { home, run } = await fixture();
  const file = await open(join(home, "inherited"), "w+");
  try {
    const controller = new AbortController();
    const ready = join(home, "ready");
    const pending = run(
      "inherited",
      { ready },
      { descriptors: [file.fd], signal: controller.signal },
    );
    const pid = await readyPid(ready);
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, error: { code: "CANCELED" } });
    expectGone(pid);
    expect((await file.stat()).size).toBe(11);
    expect(await readFile(join(home, "inherited"), "utf8")).toBe("owned bytes");
  } finally {
    await file.close();
  }
});
