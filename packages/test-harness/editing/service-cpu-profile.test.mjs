import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { installServiceProfiler, profileLimits } from "./service-cpu-profile.mjs";

if (process.argv[2] === "synthetic-child") {
  const limits = { ...profileLimits, ...JSON.parse(process.argv[4]) };
  const close = installServiceProfiler({ directory: process.argv[3], limits });
  process.on("message", async (message) => {
    if (message.type === "synthetic.work") {
      const until = performance.now() + 30;
      let iterations = 0;
      while (performance.now() < until) iterations++;
      process.send({ ...message, iterations });
    }
    if (message === "close") {
      await close();
      process.disconnect();
    }
  });
  process.send({ ready: true });
} else {
  async function childFixture(t, limits = {}) {
    const directory = await mkdtemp(join(tmpdir(), "sr-synthetic-cpu-profile-"));
    const child = fork(
      new URL(import.meta.url),
      ["synthetic-child", directory, JSON.stringify(limits)],
      { stdio: ["ignore", "ignore", "inherit", "ipc"] },
    );
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit");
        const timer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }, 2000);
        if (child.connected) child.send("close", () => {});
        await exit;
        clearTimeout(timer);
      }
      await rm(directory, { recursive: true, force: true });
    });
    const [ready] = await once(child, "message");
    assert(ready.ready);
    let sequence = 0;
    const request = (type, arm = 512) => {
      const id = String(++sequence);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          child.off("message", listener);
          reject(new Error("Synthetic IPC deadline"));
        }, 2000);
        const listener = (message) => {
          if (message.id !== id) return;
          clearTimeout(timer);
          child.off("message", listener);
          resolve(message);
        };
        child.on("message", listener);
        child.send({ type, id, arm });
      });
    };
    return { child, request, directory };
  }
  test(
    "child IPC profiles its own CPU, flushes raw samples and refuses another attempt",
    { timeout: 5000 },
    async (t) => {
      const { child, request } = await childFixture(t);
      assert.equal((await request("cpu.start")).result.pid, child.pid);
      assert.match((await request("cpu.stop", 1024)).error, /No matching active CPU profile/);
      assert((await request("synthetic.work")).iterations > 0);
      const stopped = (await request("cpu.stop")).result;
      assert.equal(stopped.reason, "complete");
      assert(stopped.cpu.user + stopped.cpu.system > 0);
      const raw = JSON.parse(await readFile(stopped.file, "utf8"));
      assert(raw.samples.length > 0 && raw.nodes.length > 0 && raw.endTime > raw.startTime);
      assert.deepEqual((await request("cpu.stop")).result, stopped);
      assert.match((await request("cpu.start")).error, /Only one CPU profile per arm/);
    },
  );
  test(
    "child shutdown flushes an interrupted profile before disconnect",
    { timeout: 5000 },
    async (t) => {
      const { child, request, directory } = await childFixture(t);
      await request("cpu.start");
      await request("synthetic.work");
      const exit = once(child, "exit");
      child.send("close", () => {});
      await exit;
      const report = JSON.parse(
        await readFile(join(directory, "service-512-profile.json"), "utf8"),
      );
      assert.equal(report.reason, "service_closed");
      assert(JSON.parse(await readFile(report.file, "utf8")).samples.length > 0);
    },
  );
  for (const [reason, limits] of [
    ["rss_limit", { rssBytes: 1 }],
    ["arm_deadline", { armMs: 30 }],
  ])
    test(`child guard preserves a terminal ${reason} profile`, { timeout: 5000 }, async (t) => {
      const { child, request } = await childFixture(t, limits);
      const guard = new Promise((resolve) =>
        child.on("message", (message) => {
          if (message.type === "cpu.guard") resolve(message);
        }),
      );
      await request("cpu.start");
      const message = await guard;
      assert.equal(message.reason, reason);
      assert.equal(message.profile.reason, reason);
      assert.equal((await request("cpu.stop")).result.file, message.profile.file);
      assert(JSON.parse(await readFile(message.profile.file, "utf8")).nodes.length > 0);
    });
}
