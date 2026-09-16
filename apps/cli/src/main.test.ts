import { promisify } from "node:util";
import { listenLocal } from "@screenrec/service";
import { afterEach, expect, it } from "vitest";
import { execFile, spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:net";
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
  const recording = store.allocate().recording;
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
  return { home, socket: join(home, "run/service.sock"), recordingId: recording.recordingId };
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
  const bad = spawnSync(process.execPath, [entry, "mcp", "--id", "invalid"], {
    encoding: "utf8",
    timeout: 3_000,
  });
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
  const listed = cli(socket, "recording.list", { limit: 1 });
  expect(listed.exitCode).toBe(0);
  expect(listed.result.data).toMatchObject({ recordings: [{ recordingId }], nextCursor: null });
  const mcpList = await client.callTool({ name: "recording.list", arguments: { limit: 1 } });
  expect(mcpList.isError).toBe(false);
  expect(mcpList.structuredContent).toMatchObject({ ok: true, data: listed.result.data });
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

it("rejects malformed operation parameters before discovering or launching an app", () => {
  const result = spawnSync(process.execPath, [entry, "edit.trim", "--params", "{}"], {
    encoding: "utf8",
    timeout: 3_000,
    env: {
      ...process.env,
      SCREENREC_HOME: "/tmp/no-screenrec-home-invalid-test",
      SCREENREC_APP: "invalid-relative-app",
    },
  });
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
});

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: "/",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("CLI fixture timed out"));
    }, 4_000);
    child.stdout.on("data", (bytes) => {
      stdout += bytes;
    });
    child.stderr.on("data", (bytes) => {
      stderr += bytes;
    });
    child.once("error", reject);
    child.once("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

it("default discovery reaches the actual service layout from outside the checkout", async () => {
  const { home, recordingId } = await serviceFixture();
  const env = { ...process.env, SCREENREC_HOME: home, SCREENREC_APP: "must-not-launch" };
  const results = await Promise.all(
    ["first", "second"].map((id) =>
      runCli(["recording.get", "--params", JSON.stringify({ recordingId }), "--id", id], env),
    ),
  );
  results.forEach((result, index) => {
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      id: ["first", "second"][index],
      ok: true,
      data: { recordingId },
    });
  });
});

it("help, MCP tools/list and invalid tools never contact the default socket", async () => {
  const home = await mkdtemp("/tmp/scr-no-call-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "run"));
  let connections = 0;
  const server = createServer((socket) => {
    connections++;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(join(home, "run/service.sock"), resolve));
  cleanup.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const env = { ...process.env, SCREENREC_HOME: home, SCREENREC_APP: "must-not-launch" };
  expect((await runCli(["--help"], env)).status).toBe(0);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, "mcp"],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "discovery-test", version: "1" });
  cleanup.push(() => client.close());
  await client.connect(transport);
  expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(
    [...operationNames].sort(),
  );
  for (const [name, code] of [
    ["not.an.operation", "UNKNOWN_OPERATION"],
    ["edit.cut", "INVALID_PARAMS"],
  ] as const) {
    const result = await client.callTool({ name, arguments: {} });
    expect(result.structuredContent).toMatchObject({ ok: false, error: { code } });
  }
  const oversized = await client.callTool({
    name: "recording.get",
    arguments: { recordingId: "x".repeat(1_050_000) },
  });
  expect(oversized.structuredContent).toMatchObject({
    ok: false,
    error: { code: "LIMIT_EXCEEDED" },
  });
  expect(connections).toBe(0);
});

it("does not replay a mutation when the discovered service loses its response", async () => {
  const home = await mkdtemp("/tmp/scr-no-replay-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "run"));
  const operations: string[] = [];
  const server = createServer((socket) =>
    socket.once("data", (bytes) => {
      const request = JSON.parse(bytes.toString());
      operations.push(request.operation);
      if (request.operation === "service.health")
        socket.end(JSON.stringify({ id: request.id, ok: true, data: {} }) + "\n");
      else socket.destroy();
    }),
  );
  await new Promise<void>((resolve) => server.listen(join(home, "run/service.sock"), resolve));
  cleanup.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const result = await runCli(
    [
      "edit.cut",
      "--params",
      JSON.stringify({
        recordingId: "r",
        requestId: "once",
        expectedRevisionId: "r0",
        ranges: [{ startUs: 0, endUs: 1 }],
      }),
    ],
    { ...process.env, SCREENREC_HOME: home, SCREENREC_APP: "must-not-launch" },
  );
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: false,
    error: { code: "INVALID_RESPONSE" },
  });
  expect(operations).toEqual(["service.health", "edit.cut"]);
});

it("batch adapters retain partial failures, drain every lease and never overwrite output directories", async () => {
  const home = await mkdtemp("/tmp/scr-batch-client-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const closed: string[] = [];
  const bytes = Buffer.from("image fixture bytes");
  let collideFile = false;
  const collisionOutput = join(home, "file-collision");
  const listener = await listenLocal({
    runtimeDirectory: home,
    handler: async (request) => {
      const params = request.params as { token: string };
      if (request.operation === "artifact.close") {
        closed.push(params.token);
        return { ok: true, data: {} };
      }
      if (request.operation === "artifact.read") {
        if (collideFile && params.token === "second")
          await writeFile(join(collisionOutput, "02.png"), "existing");
        if (!collideFile && params.token === "first")
          return {
            ok: false,
            error: { code: "ARTIFACT_EXPIRED", message: "expired", retryable: true, details: {} },
          };
        return {
          ok: true,
          data: { offset: 0, nextOffset: bytes.length, eof: true, data: bytes.toString("base64") },
        };
      }
      return {
        ok: true,
        data: {
          recordingId: "take",
          revisionId: "r0",
          items: (collideFile ? ["first", "second", "third"] : ["first", "second"]).map(
            (token, atUs) => ({
              atUs,
              ok: true,
              data: {
                state: "ready",
                published: { frame: { mediaType: "image/png" } },
                delivery: { token, bytes: bytes.length, expiresAt: Date.now() + 30000 },
              },
            }),
          ),
        },
      };
    },
  });
  cleanup.push(() => listener.close());
  const params = { recordingId: "take", clean: true, atUs: [0, 1] };
  const output = join(home, "frames");
  const run = async (destination = output) =>
    JSON.parse(
      (
        await promisify(execFile)(process.execPath, [
          entry,
          "frame.batch",
          "--socket",
          listener.socketPath,
          "--params",
          JSON.stringify({ ...params, atUs: collideFile ? [0, 1, 2] : params.atUs }),
          "--output",
          destination,
        ])
      ).stdout,
    );
  const first = await run();
  expect(first.data.items[0]).toMatchObject({
    atUs: 0,
    ok: false,
    error: { code: "ARTIFACT_EXPIRED" },
  });
  expect(await readFile(first.data.items[1].data.output)).toEqual(bytes);
  expect(closed).toEqual(["first", "second"]);
  const collision = await run();
  expect(collision.data.items.every((item: { ok: boolean }) => !item.ok)).toBe(true);
  expect(closed).toEqual(["first", "second", "first", "second"]);
  expect(await readFile(first.data.items[1].data.output)).toEqual(bytes);
  const client = new Client({ name: "batch-failure-proof", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [entry, "mcp", "--socket", listener.socketPath],
        stderr: "pipe",
      }),
    );
    const result = await client.callTool({ name: "frame.batch", arguments: params });
    expect(result.isError).toBe(false);
    const data = result.structuredContent as typeof first;
    expect(data.data.items[0].error.code).toBe("ARTIFACT_EXPIRED");
    const image = result.content as { type: string; data: string }[];
    expect(Buffer.from(image[data.data.items[1].data.contentIndex]!.data, "base64")).toEqual(bytes);
    expect(closed).toEqual(["first", "second", "first", "second", "first", "second"]);
  } finally {
    await client.close();
  }
  // Another writer wins just one filename after our exclusive directory creation.
  collideFile = true;
  const files = await run(collisionOutput);
  expect(files.data.items.map((item: { ok: boolean }) => item.ok)).toEqual([true, false, true]);
  expect(await readFile(join(collisionOutput, "02.png"), "utf8")).toBe("existing");
  expect(await readFile(files.data.items[2].data.output)).toEqual(bytes);
  expect(closed.slice(-3)).toEqual(["first", "second", "third"]);
});

it("batch cardinality and explicit clean mode are rejected before service discovery", () => {
  for (const params of [
    { recordingId: "take", clean: true, atUs: [] },
    { recordingId: "take", clean: true, atUs: Array(9).fill(0) },
    { recordingId: "take", atUs: [0] },
  ])
    expect(cli("/tmp/nonexistent-screenrec-batch.sock", "frame.batch", params)).toMatchObject({
      exitCode: 1,
      result: { error: { code: "INVALID_PARAMS" } },
    });
});
