import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  opendir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import { DerivedCache } from "@screenrec/core/cache";
import { CONTROL_FRAME_BYTES, JsonLineStream } from "@screenrec/protocol";

const execute = promisify(execFile);
const cli = new URL("../../apps/cli/dist/main.js", import.meta.url).pathname;
const service = new URL("../../apps/service/dist/main.js", import.meta.url).pathname;
const withoutTime = ({ observedAt, ...usage }) => {
  assert.ok(Number.isFinite(Date.parse(observedAt)));
  return usage;
};

// Explicit scratch-only public usage checkpoint. Deletion remains a separate capability/gate.
test("storage usage through the real service, CLI and MCP", { timeout: 30_000 }, async (t) => {
  const output = process.env.SCREENREC_STORAGE_EVIDENCE;
  if (output) {
    assert.ok(isAbsolute(output));
    await mkdir(output, { recursive: true });
    assert.deepEqual(await readdir(output), [], "Evidence output must be empty");
  }
  const home = await mkdtemp("/tmp/screenrec-storage-lab-");
  const external = await mkdtemp("/tmp/screenrec-storage-export-");
  let closeService;
  t.after(async () => {
    await closeService?.();
    await rm(home, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  });
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const cache = new DerivedCache(store, home);
  await cache.reconcile();
  const owned = store.allocate().recording;
  const sibling = store.allocate().recording;
  const deleting = store.allocate().recording;
  for (const take of [owned, sibling, deleting])
    store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "GENERATED_NO_VIDEO",
      sourceDurationUs: null,
    });
  const source = join(home, "recordings", owned.recordingId, "source");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "partial.bin"), Buffer.alloc(17));
  const evidence = join(home, "recordings", owned.recordingId, "evidence", "fixture");
  await mkdir(evidence, { recursive: true });
  for (let i = 0; i < 2500; i++) await writeFile(join(evidence, `${i}.json`), "1234567890");
  await writeFile(join(home, "recordings", owned.recordingId, "other.bin"), Buffer.alloc(7));
  const reservation = cache.reserve(owned.recordingId);
  await writeFile(reservation.path, Buffer.alloc(23));
  await cache.publish(reservation.id);
  await mkdir(join(home, "recordings", deleting.recordingId, "source"), { recursive: true });
  await writeFile(
    join(home, "recordings", deleting.recordingId, "source", "remaining.bin"),
    Buffer.alloc(31),
  );
  store.markDeleting(deleting.recordingId);
  await mkdir(join(home, "models"));
  await writeFile(join(home, "models", "weights.bin"), Buffer.alloc(1000));
  const sentinel = join(external, "export.mp4");
  await writeFile(sentinel, "external exported video");
  await symlink(external, join(source, "external-link"));
  store.close();

  const child = spawn(process.execPath, [service], {
    cwd: "/",
    env: { ...process.env, SCREENREC_HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const exited = new Promise((resolve) => child.once("close", resolve));
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.stdin.end();
    const kill = setTimeout(() => child.kill("SIGKILL"), 3000);
    try {
      await exited;
    } finally {
      clearTimeout(kill);
    }
  };
  closeService = close;
  let diagnostics = "";
  child.stderr.on("data", (bytes) => {
    diagnostics += bytes;
  });
  const socket = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Service startup timeout: ${diagnostics}`)),
      5000,
    );
    const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
    const finish = (error, value) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    child.once("error", (error) => finish(error));
    child.once("exit", () => finish(new Error(`Service exited before ready: ${diagnostics}`)));
    child.stdout.on("data", (bytes) => {
      for (const frame of stream.push(bytes)) {
        if (!frame.ok) {
          finish(frame.error);
          continue;
        }
        if (frame.value.event === "started") finish(null, frame.value.socketPath);
        if (frame.value.event === "failed") finish(new Error(frame.value.error.message));
      }
    });
  });
  const call = async (operation, params = {}) => {
    const reply = await callLocal(socket, { id: randomUUID(), operation, params });
    assert.equal(reply.ok, true, JSON.stringify(reply));
    return reply.data;
  };
  const params = { recordingId: owned.recordingId };
  let scanning = true;
  const start = performance.now();
  const pending = call("storage.usage", params).finally(() => {
    scanning = false;
  });
  const latencies = [];
  while (scanning && latencies.length < 1000) {
    const began = performance.now();
    await call("service.health");
    assert.equal(
      (await call("recording.get", { recordingId: sibling.recordingId })).recordingId,
      sibling.recordingId,
    );
    latencies.push(performance.now() - began);
  }
  const direct = await pending;
  const scanMs = performance.now() - start;
  assert.ok(latencies.length > 1, "Health and sibling reads progress during the inventory scan");
  assert.deepEqual(withoutTime(direct), {
    recordingId: owned.recordingId,
    measurement: "live",
    sourceBytes: 17,
    evidenceBytes: 25000,
    cacheBytes: 23,
    otherBytes: 7,
    sharedBytes: 0,
    totalBytes: 25047,
  });
  const command = await execute(
    process.execPath,
    [cli, "storage.usage", "--socket", socket, "--params", JSON.stringify(params)],
    { timeout: 10_000 },
  );
  const cliResult = JSON.parse(command.stdout);
  assert.equal(cliResult.ok, true);
  assert.deepEqual(withoutTime(cliResult.data), withoutTime(direct));
  const client = new Client({ name: "storage-usage-lab", version: "1" });
  let mcpResult;
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--socket", socket],
      }),
    );
    assert.ok((await client.listTools()).tools.some((tool) => tool.name === "storage.usage"));
    const result = await client.callTool({ name: "storage.usage", arguments: params });
    mcpResult = result.structuredContent;
    assert.equal(mcpResult.ok, true);
    assert.deepEqual(withoutTime(mcpResult.data), withoutTime(direct));
    const absent = await client.callTool({
      name: "storage.usage",
      arguments: { recordingId: "absent" },
    });
    assert.equal(absent.structuredContent.error.code, "NOT_FOUND");
  } finally {
    await client.close();
  }
  const marked = await call("storage.usage", { recordingId: deleting.recordingId });
  assert.equal(marked.sourceBytes, 31);
  const aggregate = await call("storage.usage");
  // Independent fixture inventory: ordinary file lengths only, models excluded, no symlink following.
  const inventory = async (directory) => {
    let bytes = 0;
    for await (const entry of await opendir(directory)) {
      if (directory === home && entry.name === "models") continue;
      const path = join(directory, entry.name),
        stat = await lstat(path);
      if (stat.isFile()) bytes += stat.size;
      else if (stat.isDirectory()) bytes += await inventory(path);
    }
    return bytes;
  };
  assert.equal(aggregate.totalBytes, await inventory(home));
  assert.equal(
    aggregate.totalBytes,
    aggregate.sourceBytes +
      aggregate.evidenceBytes +
      aggregate.cacheBytes +
      aggregate.otherBytes +
      aggregate.sharedBytes,
  );
  assert.equal(await readFile(sentinel, "utf8"), "external exported video");
  const report = {
    generated: true,
    files: 2500,
    scanMs,
    concurrentCalls: latencies.length,
    worstHealthAndSiblingReadMs: Math.max(...latencies),
    direct,
    cli: cliResult.data,
    mcp: mcpResult.data,
    marked,
    aggregate,
    scope: "Storage usage only; no public delete, physical capture or native media execution.",
  };
  if (output) await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  await close();
});
