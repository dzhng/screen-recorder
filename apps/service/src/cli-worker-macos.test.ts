import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, open } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { cliWorker } from "./worker.js";
import { compileCliOwner } from "./cli-owner.fixture.js";
let directory: string;
let owner: string;
let tool: string;
const ownedPids: number[] = [];
beforeAll(async () => {
  directory = await mkdtemp("/tmp/screenrec-cli-native-");
  owner = await compileCliOwner(directory);
  tool = join(directory, "tool.cjs");
  await writeFile(
    tool,
    `const {writeFileSync}=require('node:fs');const {spawn}=require('node:child_process');
    const child=spawn(process.argv[3]==='no-pipes'?'/bin/sleep':process.execPath,process.argv[3]==='no-pipes'?['1000']:['-e','setInterval(()=>{},1000)'],{stdio:process.argv[3]==='no-pipes'?'ignore':'inherit'});
    if(process.argv[3]==='no-pipes')for(let n=0;n<31;n++)spawn('/bin/sleep',['1000'],{stdio:'ignore'});
    if(process.argv[3]==='descriptor')writeFileSync(3,'inherited bytes');
    writeFileSync(process.argv[2],JSON.stringify({pid:process.pid,owner:process.ppid,child:child.pid}));setInterval(()=>{},1000);`,
  );
});
afterAll(async () => {
  for (const pid of ownedPids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  await rm(directory, { recursive: true, force: true });
});
async function ready(path: string) {
  for (let n = 0; n < 200; n++) {
    try {
      const pids = JSON.parse(await readFile(path, "utf8")) as {
        pid: number;
        owner: number;
        child: number;
      };
      ownedPids.push(...Object.values(pids));
      return pids;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await delay(10);
  }
  throw new Error("CLI did not start");
}
async function gone(pid: number) {
  for (let n = 0; n < 200; n++) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
      return;
    }
    await delay(10);
  }
  throw new Error("Owned PID remains: " + pid);
}
it("cancel retires native owner, CLI descendants and inherited pipes before resolving", async () => {
  const readyFile = join(directory, "cancel-ready");
  const file = await open(join(directory, "inherited"), "w+");
  const controller = new AbortController();
  const pending = cliWorker(
    { executable: process.execPath, ownerExecutable: owner, args: [tool, readyFile, "descriptor"] },
    { signal: controller.signal, descriptors: [file.fd] },
  );
  const pids = await ready(readyFile);
  controller.abort();
  expect(await pending).toMatchObject({ ok: false, error: { code: "CANCELED" } });
  for (const pid of Object.values(pids))
    expect(() => process.kill(pid, 0)).toThrowError(expect.objectContaining({ code: "ESRCH" }));
  expect(await readFile(join(directory, "inherited"), "utf8")).toBe("inherited bytes");
  await file.close();
});
it("unexpected owner death retires descendants holding output pipes", async () => {
  const readyFile = join(directory, "wrapper-ready");
  const pending = cliWorker({
    executable: process.execPath,
    ownerExecutable: owner,
    args: [tool, readyFile],
  });
  const pids = await ready(readyFile);
  process.kill(pids.owner, "SIGKILL");
  expect(await pending).toMatchObject({ ok: false, error: { code: "MEDIA_WORKER_FAILED" } });
  await Promise.all(Object.values(pids).map(gone));
});
it("service death triggers existing native parent watcher to retire the whole CLI group", async () => {
  const readyFile = join(directory, "service-ready");
  const host = join(directory, "service.mjs");
  await writeFile(
    host,
    `import {cliWorker} from ${JSON.stringify(resolve("src/worker.ts"))};await cliWorker({executable:${JSON.stringify(process.execPath)},ownerExecutable:${JSON.stringify(owner)},args:${JSON.stringify([tool, readyFile])}});`,
  );
  const service = spawn(process.execPath, [host], { stdio: "ignore" });
  if (service.pid) ownedPids.push(service.pid);
  const pids = await ready(readyFile);
  const closed = new Promise<void>((resolve) => service.once("close", () => resolve()));
  service.kill("SIGKILL");
  await closed;
  await Promise.all(Object.values(pids).map(gone));
});

it("cancellation also drains descendants that close every inherited pipe", async () => {
  for (let index = 0; index < 12; index++) {
    const readyFile = join(directory, "no-pipes-" + index);
    const controller = new AbortController();
    const pending = cliWorker(
      { executable: process.execPath, ownerExecutable: owner, args: [tool, readyFile, "no-pipes"] },
      { signal: controller.signal },
    );
    const pids = await ready(readyFile);
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, error: { code: "CANCELED" } });
    for (const pid of [-pids.owner, ...Object.values(pids)])
      expect(() => process.kill(pid, 0)).toThrowError(expect.objectContaining({ code: "ESRCH" }));
  }
});

it("service death after CLI exit still retires descendants while service events are paused", async () => {
  const readyFile = join(directory, "finished-cli-ready");
  const host = join(directory, "finished-service.mjs");
  await writeFile(
    host,
    `import {cliWorker} from ${JSON.stringify(resolve("src/worker.ts"))};await cliWorker({executable:${JSON.stringify(process.execPath)},ownerExecutable:${JSON.stringify(owner)},args:${JSON.stringify([tool, readyFile])}});`,
  );
  const service = spawn(process.execPath, [host], { stdio: "ignore" });
  if (service.pid) ownedPids.push(service.pid);
  const pids = await ready(readyFile);
  process.kill(service.pid!, "SIGSTOP");
  process.kill(pids.pid, "SIGKILL");
  await gone(pids.pid);
  await delay(200);
  const closed = new Promise<void>((resolve) => service.once("close", () => resolve()));
  service.kill("SIGKILL");
  await closed;
  await Promise.all(Object.values(pids).map(gone));
});
