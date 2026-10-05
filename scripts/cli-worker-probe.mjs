import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { compileCliOwner } from "../apps/service/src/cli-owner.fixture.ts";
import { cliWorker } from "../apps/service/dist/worker.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ffmpeg = process.argv[2];
if (!ffmpeg || !isAbsolute(ffmpeg))
  throw new Error("Usage: node scripts/cli-worker-probe.mjs /absolute/pinned/ffmpeg");
const directory = await mkdtemp("/tmp/screenrec-ffmpeg-lifetime-");
const pids = new Set();
const tasks = [];
async function childPid(parent) {
  for (let n = 0; n < 200; n++) {
    const rows = execFileSync("/bin/ps", ["-axo", "pid=,ppid="], { encoding: "utf8" });
    const row = rows
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number))
      .find(([, ppid]) => ppid === parent);
    if (row) {
      pids.add(row[0]);
      return row[0];
    }
    await delay(10);
  }
  throw new Error("Owned child did not start");
}
async function gone(pid) {
  for (let n = 0; n < 200; n++) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    await delay(10);
  }
  throw new Error("Owned process did not retire: " + pid);
}
try {
  const owner = await compileCliOwner(directory);
  const args = [
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-re",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000",
    "-f",
    "null",
    "-",
  ];
  const completed = await cliWorker({
    executable: ffmpeg,
    ownerExecutable: owner,
    args: ["-version"],
  });
  if (!completed.ok || !Buffer.isBuffer(completed.data.stdout) || completed.data.exitCode !== 0)
    throw new Error("Real FFmpeg completion handshake failed");
  const version = completed.data.stdout.toString("utf8").split("\n")[0];
  const controller = new AbortController();
  const pending = cliWorker(
    { executable: ffmpeg, ownerExecutable: owner, args },
    { signal: controller.signal, timeoutMs: 10000 },
  );
  tasks.push(pending);
  const wrapper = await childPid(process.pid);
  const command = await childPid(wrapper);
  controller.abort();
  const canceled = await pending;
  if (canceled.ok || canceled.error.code !== "CANCELED")
    throw new Error("Unexpected cancellation receipt");
  await Promise.all([wrapper, command].map(gone));
  const host = join(directory, "service.mjs");
  await writeFile(
    host,
    `import {cliWorker} from ${JSON.stringify(join(root, "apps/service/dist/worker.js"))};await cliWorker(${JSON.stringify({ executable: ffmpeg, ownerExecutable: owner, args })},{timeoutMs:10000});`,
  );
  const service = spawn(process.execPath, [host], { stdio: "ignore" });
  pids.add(service.pid);
  const orphanWrapper = await childPid(service.pid);
  const orphanCommand = await childPid(orphanWrapper);
  const closed = new Promise((resolve) => service.once("close", resolve));
  service.kill("SIGKILL");
  await closed;
  await Promise.all([orphanWrapper, orphanCommand].map(gone));
  console.log(
    JSON.stringify({
      ffmpeg,
      sha256: createHash("sha256")
        .update(await readFile(ffmpeg))
        .digest("hex"),
      version,
      completed: "zero CLI status; owner group retired",
      cancel: "group retired",
      serviceDeath: "group retired",
      source: "lavfi sine; no user media",
    }),
  );
} finally {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") {
        console.error("Cannot retire probe PID", { pid, code: error.code });
        process.exitCode = 1;
      }
    }
  }
  await Promise.allSettled(tasks);
  await rm(directory, { recursive: true, force: true });
}
