import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue } from "@screenrec/core/jobs";
import { scenePolicy } from "@screenrec/core/scenes";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { callLocal } from "@screenrec/client";
import { JsonLineStream, CONTROL_FRAME_BYTES } from "../../../../packages/protocol/dist/index.js";
const main = fileURLToPath(new URL("../../../service/dist/main.js", import.meta.url));
const cli = fileURLToPath(new URL("../../../cli/dist/main.js", import.meta.url));
export async function until(read, message) {
  const deadline = Date.now() + 15_000;
  do {
    const value = await read();
    if (value) return value;
    await delay(20);
  } while (Date.now() < deadline);
  throw new Error(message);
}
export async function startPublicService(home, native) {
  const child = spawn(process.execPath, [main], {
    cwd: "/",
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, SCREENREC_HOME: home, SCREENREC_NATIVE: native },
  });
  const terminal = new Promise((resolve) =>
    child.once("close", (code, signal) => resolve({ code, signal })),
  );
  let diagnostics = "",
    socket;
  child.stderr.on("data", (value) => {
    diagnostics = (diagnostics + value).slice(-32000);
  });
  const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
  child.stdout.on("data", (value) => {
    for (const frame of stream.push(value))
      if (frame.ok) {
        if (frame.value.event === "started") socket = frame.value.socketPath;
        else if (frame.value.event === "failed") diagnostics += JSON.stringify(frame.value);
      }
  });
  const group = (signal) => {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      throw error;
    }
  };
  const close = async () => {
    child.stdin.end();
    const timer = setTimeout(() => group("SIGKILL"), 5000);
    const result = await terminal;
    clearTimeout(timer);
    const survived = group(0);
    if (survived) {
      group("SIGKILL");
      await until(() => !group(0), "Owned service group remains live");
    }
    assert.equal(survived, false, "Service left owned native workers");
    assert.equal(result.code, 0, diagnostics);
  };
  try {
    await until(
      () => socket || (child.exitCode !== null && Promise.reject(new Error(diagnostics))),
      "Service did not start",
    );
  } catch (error) {
    group("SIGKILL");
    await terminal;
    throw error;
  }
  return {
    socket,
    close,
    call: async (operation, params = {}) =>
      callLocal(socket, { id: randomUUID(), operation, params }),
  };
}

export function publicCommand(socket, operation, params, extra = []) {
  const result = spawnSync(
    process.execPath,
    [cli, operation, "--socket", socket, "--params", JSON.stringify(params), ...extra],
    { encoding: "utf8", timeout: 15000, maxBuffer: 8 * 1024 ** 2 },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSON.parse(result.stdout).data;
}
export async function connectPublicMcp(socket, name) {
  const client = new Client({ name, version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--socket", socket],
      }),
    );
    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}

// A real library take sharing only package provenance, with no background fixture work.
export async function seedPublicRecording(home, snapshot) {
  const ids = [snapshot.recordingId, snapshot.sourceId];
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: () => ids.shift() ?? randomUUID(),
  });
  const take = store.allocate().recording;
  assert.equal(take.recordingId, snapshot.recordingId);
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "same-ID isolation fixture",
    sourceDurationUs: snapshot.sourceDurationUs,
  });
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    execute: async () => {
      throw new Error("Seeded canceled work must not execute");
    },
  });
  for (const [artifact, input, lane] of [
    ["source-evidence", "native-source-v1", "heavy"],
    ["source-scenes", scenePolicy.id, "frame"],
  ]) {
    const job = jobs.submit({
      recordingId: take.recordingId,
      revisionId: "r0",
      artifact,
      input,
      lane,
    });
    jobs.cancel(job.jobId);
  }
  await jobs.close();
  store.close();
  await mkdir(join(home, "recordings", take.recordingId, "source"), { recursive: true });
  return take;
}
