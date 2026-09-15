import { afterEach, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "@screenrec/core/library";
import {
  operationNames,
  JsonLineStream,
  CONTROL_FRAME_BYTES,
  controlMessageSchema,
} from "@screenrec/protocol";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const entry = new URL("../dist/main.js", import.meta.url).pathname;
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function serviceFixture() {
  const home = await mkdtemp("/tmp/scr-cli-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const recording = store.allocate();
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "recording",
  });
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 2,
    state: "finalizing",
  });
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 3,
    state: "complete",
    sourceDurationUs: 10_000_000,
  });
  store.close();
  const child = spawn(
    process.execPath,
    [new URL("../../service/dist/main.js", import.meta.url).pathname],
    { cwd: "/", env: { ...process.env, SCREENREC_HOME: home }, stdio: ["pipe", "pipe", "pipe"] },
  );
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  cleanup.push(async () => {
    child.stdin.end();
    const timer = setTimeout(() => child.kill("SIGKILL"), 2_000);
    await exited;
    clearTimeout(timer);
  });
  let diagnostic = "";
  child.stderr.on("data", (bytes) => {
    diagnostic += bytes;
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Service not ready: ${diagnostic}`)), 3_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
    child.stdout.on("data", (bytes: Buffer) => {
      for (const frame of stream.push(bytes)) {
        if (!frame.ok) {
          clearTimeout(timer);
          reject(frame.error);
          continue;
        }
        const message = controlMessageSchema.parse(frame.value);
        if (message.event === "started") {
          clearTimeout(timer);
          resolve();
        }
        if (message.event === "failed") {
          clearTimeout(timer);
          reject(new Error(message.error.message));
        }
      }
    });
  });
  return { socket: join(home, "run/service.sock"), recordingId: recording.recordingId };
}

function cli(socket: string, operation: string, params: Record<string, unknown> = {}) {
  const result = spawnSync(
    process.execPath,
    [entry, operation, "--socket", socket, "--params", "-", "--id", "cli-test"],
    { cwd: "/", encoding: "utf8", timeout: 10_000, input: JSON.stringify(params) },
  );
  expect(result.error).toBeUndefined();
  return { exitCode: result.status, result: JSON.parse(result.stdout) };
}

it("help lists registry schemas without opening an app or service, and MCP startup errors stay off stdout", () => {
  const help = spawnSync(process.execPath, [entry, "--help"], {
    cwd: "/",
    encoding: "utf8",
    timeout: 3_000,
  });
  expect(help.status).toBe(0);
  expect(
    JSON.parse(help.stdout)
      .operations.map((op: { name: string }) => op.name)
      .sort(),
  ).toEqual([...operationNames].sort());
  expect(help.stdout).toContain("microseconds");
  const bad = spawnSync(process.execPath, [entry, "mcp"], { encoding: "utf8", timeout: 3_000 });
  expect(bad.status).toBe(1);
  expect(bad.stdout).toBe("");
  expect(JSON.parse(bad.stderr).error.code).toBe("INVALID_REQUEST");
  const reordered = spawnSync(
    process.execPath,
    [entry, "--socket", "/tmp/unused.sock", "mcp", "--unknown"],
    { encoding: "utf8", timeout: 3_000 },
  );
  expect(reordered.status).toBe(1);
  expect(reordered.stdout).toBe("");
  expect(JSON.parse(reordered.stderr).error.code).toBe("INVALID_REQUEST");
});

it("CLI and real MCP transport share edits, replay, history and structured failures", async () => {
  const { socket, recordingId } = await serviceFixture();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, "mcp", "--socket", socket],
    stderr: "pipe",
  });
  const client = new Client({ name: "screenrec-adapter-test", version: "1" });
  cleanup.push(() => client.close());
  await client.connect(transport);
  expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(
    [...operationNames].sort(),
  );
  const params = {
    recordingId,
    requestId: "cut-one",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 2_000_000, endUs: 4_000_000 }],
  };
  const first = cli(socket, "edit.cut", params);
  expect(first.exitCode).toBe(0);
  expect(first.result.data.revision.spans).toEqual([
    { startUs: 0, endUs: 2_000_000 },
    { startUs: 4_000_000, endUs: 10_000_000 },
  ]);
  const replay = await client.callTool({ name: "edit.cut", arguments: params });
  expect(replay.isError).toBe(false);
  expect(replay.structuredContent).toMatchObject({ ok: true, data: first.result.data });
  const staleArgs = { ...params, requestId: "stale" };
  const staleCli = cli(socket, "edit.cut", staleArgs);
  const staleMcp = await client.callTool({ name: "edit.cut", arguments: staleArgs });
  expect(staleCli.exitCode).toBe(1);
  expect(staleMcp.isError).toBe(true);
  expect(staleMcp.structuredContent).toMatchObject({ ok: false, error: staleCli.result.error });
  expect(staleCli.result.error.code).toBe("STALE_REVISION");
  const undo = await client.callTool({
    name: "edit.undo",
    arguments: {
      recordingId,
      requestId: "undo-one",
      expectedRevisionId: first.result.data.revision.id,
    },
  });
  expect(undo.structuredContent).toMatchObject({
    ok: true,
    data: { revision: { durationUs: 10_000_000, spans: [{ startUs: 0, endUs: 10_000_000 }] } },
  });
  const history = cli(socket, "revision.history", { recordingId });
  expect(
    history.result.data.revisions.map((revision: { operation: string }) => revision.operation),
  ).toEqual(["original", "cut", "undo"]);
  const oversizedParams = { recordingId: "x".repeat(1_050_000) };
  const oversizedCli = cli(socket, "recording.get", oversizedParams);
  const oversizedMcp = await client.callTool({ name: "recording.get", arguments: oversizedParams });
  expect(oversizedCli.exitCode).toBe(1);
  expect(oversizedCli.result.error.code).toBe("LIMIT_EXCEEDED");
  expect(oversizedCli.result.id).toBe("cli-test");
  expect(oversizedMcp.structuredContent).toMatchObject({
    ok: false,
    error: { code: "LIMIT_EXCEEDED" },
  });
  const invalid = await client.callTool({
    name: "edit.trim",
    arguments: { recordingId, typo: true },
  });
  expect(invalid.isError).toBe(true);
  expect(invalid.structuredContent).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
});

it("preserves the parsed request ID on local JSON validation failure", () => {
  const invalid = spawnSync(
    process.execPath,
    [
      entry,
      "recording.get",
      "--socket",
      "/tmp/unused.sock",
      "--id",
      "correlate-me",
      "--params",
      "{",
    ],
    { encoding: "utf8", timeout: 3_000 },
  );
  expect(invalid.status).toBe(1);
  expect(JSON.parse(invalid.stdout)).toMatchObject({
    id: "correlate-me",
    ok: false,
    error: { code: "INVALID_REQUEST" },
  });
  const invalidUtf8 = spawnSync(
    process.execPath,
    [entry, "recording.get", "--socket", "/tmp/unused.sock", "--id", "utf8-id", "--params", "-"],
    {
      encoding: "utf8",
      timeout: 3_000,
      input: Buffer.concat([
        Buffer.from('{"recordingId":"'),
        Buffer.from([255]),
        Buffer.from('"}'),
      ]),
    },
  );
  expect(JSON.parse(invalidUtf8.stdout)).toMatchObject({
    id: "utf8-id",
    ok: false,
    error: { code: "INVALID_REQUEST" },
  });
});
