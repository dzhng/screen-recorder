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
  type OperationResult,
} from "@screenrec/protocol";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const entry = new URL("../dist/main.js", import.meta.url).pathname;
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function serviceFixture(peer?: (operation: string) => OperationResult) {
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
  const asked: string[] = [];
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
        if (message.event === "call" && peer) {
          asked.push(message.request.operation);
          child.stdin.write(
            JSON.stringify({
              event: "result",
              response: { id: message.request.id, ...peer(message.request.operation) },
            }) + "\n",
          );
        }
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
  return {
    home,
    socket: join(home, "run/service.sock"),
    recordingId: recording.recordingId,
    asked,
  };
}

type AdvertisedTool = {
  name: string;
  description?: string | undefined;
  inputSchema: { required?: string[]; anyOf?: { required?: string[] }[] } & Record<string, unknown>;
};

/** Callers may omit every parameter the service defaults, and every tool says what it does. */
function expectCallableContract(tools: AdvertisedTool[]) {
  expect(JSON.stringify(tools.map((tool) => tool.inputSchema)).includes('"readOnly":true')).toBe(
    false,
  );
  // Each advertised inputSchema must be usable on its own by a CLI or MCP caller.
  for (const tool of tools) {
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      if ("$ref" in value) {
        expect(typeof value.$ref).toBe("string");
        const ref = value.$ref as string;
        expect(ref.startsWith("#/"), `${tool.name}: external schema reference`).toBe(true);
        let target: unknown = tool.inputSchema;
        for (const key of ref
          .slice(2)
          .split("/")
          .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))) {
          target =
            target !== null && typeof target === "object"
              ? (target as Record<string, unknown>)[key]
              : undefined;
        }
        expect(target, `${tool.name}: unresolved ${ref}`).toBeDefined();
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(tool.inputSchema);
  }
  const required = (name: string) => {
    const schema = tools.find((tool) => tool.name === name)?.inputSchema;
    return schema?.anyOf ? schema.anyOf.map((option) => option.required) : schema?.required;
  };
  expect(required("capture.start")).toEqual(["source", "requestId"]);
  expect(required("artifact.read")).toEqual(["token", "offset"]);
  expect(required("processing.status")).toEqual(["recordingId"]);
  expect(required("index.get")).toEqual([
    ["projectId"],
    ["recordingId"],
    ["packageHandle"],
    ["assetId", "streamId"],
  ]);
  expect(required("transcript.get")).toEqual([
    ["projectId"],
    ["recordingId"],
    ["packageHandle"],
    ["assetId", "streamId"],
  ]);
  expect(required("transcript.search")).toEqual([
    ["projectId", "text"],
    ["recordingId", "text"],
    ["packageHandle", "text"],
    ["assetId", "streamId", "text"],
  ]);
  expect(required("transcript.retry")).toEqual([["assetId", "streamId"], ["projectId"]]);
  expect(required("audio.get")).toEqual([
    ["projectId"],
    ["recordingId", "range"],
    ["packageHandle", "range"],
    ["assetId", "streamId"],
  ]);
  expect(required("audio.retry")).toEqual(required("audio.get"));
  expect(required("waveform.get")).toEqual([["projectId"], ["assetId", "streamId"]]);
  expect(required("waveform.retry")).toEqual(required("waveform.get"));
  expect(required("frame.get")).toEqual([
    ["projectId", "atUs"],
    ["recordingId", "atUs"],
    ["packageHandle", "atUs"],
    ["assetId", "streamId", "atUs"],
    ["assetId", "streamId"],
  ]);
  expect(required("frame.retry")).toEqual(required("frame.get"));
  expect(required("frame.batch")).toEqual([
    ["projectId", "atUs"],
    ["recordingId", "atUs"],
    ["packageHandle", "atUs"],
    ["assetId", "streamId", "atUs"],
  ]);
  expect(required("timeline.events")).toEqual([
    ["projectId"],
    ["recordingId"],
    ["packageHandle"],
    ["assetId", "streamId"],
  ]);
  expect(required("cursor.raw")).toEqual([
    ["projectId"],
    ["recordingId", "sourceRange"],
    ["packageHandle", "sourceRange"],
    ["assetId", "streamId"],
  ]);
  expect(required("model.prepare")).toEqual(["modelId"]);
  expect(tools.filter((tool) => !tool.description).map((tool) => tool.name)).toEqual([]);
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
  expectCallableContract(JSON.parse(help.stdout).operations);
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

it("operation help returns its canonical schema and refuses unknown names", () => {
  const help = spawnSync(process.execPath, [entry, "--help"], {
    cwd: "/",
    encoding: "utf8",
    timeout: 3_000,
  });
  expect(help.status).toBe(0);
  const selected = spawnSync(process.execPath, [entry, "edit.apply", "--help"], {
    cwd: "/",
    encoding: "utf8",
    timeout: 3_000,
  });
  expect(selected.status).toBe(0);
  expect(JSON.parse(selected.stdout).operations).toEqual(
    JSON.parse(help.stdout).operations.filter((op: { name: string }) => op.name === "edit.apply"),
  );
  const unknown = spawnSync(process.execPath, [entry, "not-an-operation", "--help"], {
    cwd: "/",
    encoding: "utf8",
    timeout: 3_000,
  });
  expect(unknown.status).toBe(1);
  expect(JSON.parse(unknown.stdout).error.code).toBe("UNKNOWN_OPERATION");
});

it("CLI and MCP return the same recording list", async () => {
  const { socket, recordingId } = await serviceFixture();
  const client = new Client({ name: "listing-test", version: "1" });
  cleanup.push(() => client.close());
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [entry, "mcp", "--socket", socket],
      stderr: "pipe",
    }),
  );
  const listed = cli(socket, "recording.list", { limit: 1 });
  expect(listed.exitCode).toBe(0);
  expect(listed.result.data).toMatchObject({ recordings: [{ recordingId }], nextCursor: null });
  const mcpList = await client.callTool({ name: "recording.list", arguments: { limit: 1 } });
  expect(mcpList.isError).toBe(false);
  expect(mcpList.structuredContent).toMatchObject({ ok: true, data: listed.result.data });
});

it("oversized CLI requests preserve their ID and fail before service discovery", () => {
  const oversizedCli = cli("/tmp/nonexistent-screenrec-size.sock", "recording.get", {
    recordingId: "x".repeat(1_050_000),
  });
  expect(oversizedCli.exitCode).toBe(1);
  expect(oversizedCli.result.error.code).toBe("LIMIT_EXCEEDED");
  expect(oversizedCli.result.id).toBe("cli-test");
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
  const help = await runCli(["--help"], env);
  expect(help.status).toBe(0);
  expect((await runCli(["asset.import", "--help"], env)).status).toBe(0);
  expect((await runCli(["not-an-operation", "--help"], env)).status).toBe(1);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, "mcp"],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "discovery-test", version: "1" });
  cleanup.push(() => client.close());
  await client.connect(transport);
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name).sort()).toEqual([...operationNames].sort());
  expectCallableContract(tools as AdvertisedTool[]);
  const advertised = JSON.parse(help.stdout).operations as AdvertisedTool[];
  for (const tool of tools)
    expect(tool.inputSchema).toEqual({
      ...advertised.find((entry) => entry.name === tool.name)!.inputSchema,
      type: "object",
    });
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
  const invalid = await client.callTool({
    name: "edit.trim",
    arguments: { recordingId: "take", typo: true },
  });
  expect(invalid.isError).toBe(true);
  expect(invalid.structuredContent).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
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

it.each([
  { operation: "frame.batch", reference: "atUs", scope: "recording" },
  { operation: "frame.batch", reference: "atUs", scope: "project" },
  { operation: "frame.batch", reference: "atUs", scope: "source" },
  { operation: "index.frames", reference: "ordinal", scope: "recording" },
  { operation: "index.frames", reference: "ordinal", scope: "source" },
] as const)(
  "$operation $scope adapters retain partial failures, drain leases and never overwrite outputs",
  async ({ operation, reference, scope }) => {
    const target =
      scope === "project"
        ? { projectId: "project" }
        : scope === "source"
          ? { assetId: "asset", streamId: "video" }
          : { recordingId: "take" };
    const home = await mkdtemp("/tmp/scr-batch-client-");
    cleanup.push(() => rm(home, { recursive: true, force: true }));
    const closed: string[] = [];
    const requested = reference === "ordinal" ? [7, 2, 7] : [0, 1, 2];
    const selectedIdentity =
      reference === "ordinal"
        ? { ...(scope === "source" ? {} : { revisionId: "r0" }), generation: "retained-1" }
        : {};
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
            data: {
              offset: 0,
              nextOffset: bytes.length,
              eof: true,
              data: bytes.toString("base64"),
            },
          };
        }
        return {
          ok: true,
          data: {
            ...target,
            ...(scope === "source" ? {} : { revisionId: "r0" }),
            ...selectedIdentity,
            items: (collideFile ? ["first", "second", "third"] : ["first", "second"]).map(
              (token, index) => ({
                [reference]: requested[index],
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
    const params =
      reference === "ordinal"
        ? { ...target, ...selectedIdentity, ordinals: requested.slice(0, 2) }
        : {
            ...target,
            ...(scope === "recording" ? { clean: true } : {}),
            atUs: requested.slice(0, 2),
          };
    const output = join(home, "frames");
    const run = async (destination = output) =>
      JSON.parse(
        (
          await promisify(execFile)(process.execPath, [
            entry,
            operation,
            "--socket",
            listener.socketPath,
            "--params",
            JSON.stringify({
              ...params,
              [reference === "ordinal" ? "ordinals" : "atUs"]: collideFile
                ? requested
                : requested.slice(0, 2),
            }),
            "--output",
            destination,
          ])
        ).stdout,
      );
    const first = await run();
    expect(first.data.items[0]).toMatchObject({
      [reference]: requested[0],
      ok: false,
      error: { code: "ARTIFACT_EXPIRED" },
    });
    expect(first.data.items.map((item: Record<string, unknown>) => item[reference])).toEqual(
      requested.slice(0, 2),
    );
    expect(first.data).toMatchObject({ ...target, ...selectedIdentity });
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
      const result = await client.callTool({ name: operation, arguments: params });
      expect(result.isError).toBe(false);
      const data = result.structuredContent as typeof first;
      expect(data.data.items[0].error.code).toBe("ARTIFACT_EXPIRED");
      const image = result.content as { type: string; data: string }[];
      expect(Buffer.from(image[data.data.items[1].data.contentIndex]!.data, "base64")).toEqual(
        bytes,
      );
      expect(closed).toEqual(["first", "second", "first", "second", "first", "second"]);
    } finally {
      await client.close();
    }
    // Another writer wins just one filename after our exclusive directory creation.
    collideFile = true;
    const files = await run(collisionOutput);
    expect(files.data.items.map((item: { ok: boolean }) => item.ok)).toEqual([true, false, true]);
    expect(files.data.items.map((item: Record<string, unknown>) => item[reference])).toEqual(
      requested,
    );
    expect(await readFile(join(collisionOutput, "02.png"), "utf8")).toBe("existing");
    expect(await readFile(files.data.items[2].data.output)).toEqual(bytes);
    expect(closed.slice(-3)).toEqual(["first", "second", "third"]);
  },
);

it.each([
  { recordingId: "take", clean: true, atUs: [] },
  { recordingId: "take", clean: true, atUs: Array(9).fill(0) },
  { recordingId: "take", clean: "yes", atUs: [0] },
  { recordingId: "take", trailUs: 10_000_001, atUs: [0] },
])("invalid batch parameters %# are rejected before service discovery", (params) => {
  expect(cli("/tmp/nonexistent-screenrec-batch.sock", "frame.batch", params)).toMatchObject({
    exitCode: 1,
    result: { error: { code: "INVALID_PARAMS" } },
  });
});

it("selected-frame CLI and MCP deliver image bytes while metadata-only responses create no files", async () => {
  const home = await mkdtemp("/tmp/scr-selected-client-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=",
    "base64",
  );
  const identity = { recordingId: "take", revisionId: "r3", generation: "retained-generation" };
  let closes = 0;
  const envelope = (ordinal: number) =>
    ordinal === 9
      ? { state: "processing", published: null }
      : {
          state: "ready",
          published: { frame: { mediaType: "image/png" } },
          delivery: {
            token: `selected-${ordinal}`,
            bytes: bytes.length,
            expiresAt: Date.now() + 30000,
          },
        };
  const listener = await listenLocal({
    runtimeDirectory: home,
    handler: async (request) => {
      if (request.operation === "artifact.close") {
        closes++;
        return { ok: true, data: { closed: true } };
      }
      if (request.operation === "artifact.read")
        return {
          ok: true,
          data: { offset: 0, nextOffset: bytes.length, eof: true, data: bytes.toString("base64") },
        };
      if (request.operation === "index.frame")
        return { ok: true, data: envelope((request.params as { ordinal: number }).ordinal) };
      if (request.operation === "index.frames")
        return {
          ok: true,
          data: {
            ...identity,
            items: (request.params as { ordinals: number[] }).ordinals.map((ordinal) => ({
              ordinal,
              ok: true,
              data: envelope(ordinal),
            })),
          },
        };
      throw new Error(`Unexpected ${request.operation}`);
    },
  });
  cleanup.push(() => listener.close());
  const run = (operation: string, params: Record<string, unknown>, output: string) =>
    promisify(execFile)(process.execPath, [
      entry,
      operation,
      "--socket",
      listener.socketPath,
      "--params",
      JSON.stringify(params),
      "--output",
      output,
    ]);
  const output = join(home, "selected.png");
  const delivered = await run("index.frame", { ...identity, ordinal: 7 }, output);
  expect(JSON.parse(delivered.stdout)).toMatchObject({ ok: true, data: { output } });
  expect(await readFile(output)).toEqual(bytes);
  expect(closes).toBe(1);
  const client = new Client({ name: "selected-image-proof", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [entry, "mcp", "--socket", listener.socketPath],
        stderr: "pipe",
      }),
    );
    const result = await client.callTool({
      name: "index.frame",
      arguments: { ...identity, ordinal: 7 },
    });
    expect(result.isError).toBe(false);
    const images = (result.content as { type: string; data?: string }[]).filter(
      (item) => item.type === "image",
    );
    expect(images).toHaveLength(1);
    expect(Buffer.from(images[0]!.data!, "base64")).toEqual(bytes);
    expect(closes).toBe(2);
    const pending = await client.callTool({
      name: "index.frames",
      arguments: { ...identity, ordinals: [9] },
    });
    expect((pending.content as { type: string }[]).map((item) => item.type)).toEqual(["text"]);
  } finally {
    await client.close();
  }
  for (const operation of ["index.frame", "index.frames"]) {
    const missing = join(home, operation);
    const params =
      operation === "index.frame" ? { ...identity, ordinal: 9 } : { ...identity, ordinals: [9] };
    const pending = await run(operation, params, missing);
    expect(JSON.parse(pending.stdout).ok).toBe(true);
    await expect(readFile(missing)).rejects.toMatchObject({ code: "ENOENT" });
  }
  expect(closes).toBe(2);
});

it(
  "CLI and MCP preserve public camera discovery and permission facts without activating devices",
  { timeout: 20_000 },
  async () => {
    let cameras = [
      { id: "camera-2", name: "External camera" },
      { id: "camera-1", name: "Built-in camera" },
    ];
    let cameraPermission = "denied";
    const f = await serviceFixture((operation) => {
      if (operation === "capture.sources")
        return { ok: true, data: { displays: [], windows: [], microphones: [], cameras } };
      if (operation === "capture.status")
        return {
          ok: true,
          data: {
            state: "idle",
            recordingId: null,
            sourceId: null,
            elapsedUs: null,
            selection: null,
            permissions: { screen: true, microphone: "authorized", camera: cameraPermission },
          },
        };
      throw Error(`Unexpected device action: ${operation}`);
    });
    const read = async (operation: string) => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [entry, operation, "--socket", f.socket, "--id", "camera-discovery"],
        { cwd: "/", encoding: "utf8", timeout: 10_000 },
      );
      const response = JSON.parse(stdout);
      expect(response.ok).toBe(true);
      return response.data;
    };
    const client = new Client({ name: "camera-discovery-test", version: "1" });
    cleanup.push(() => client.close());
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [entry, "mcp", "--socket", f.socket],
        stderr: "pipe",
      }),
    );
    const sources = await read("capture.sources");
    expect(sources.cameras).toEqual(cameras);
    const mcpSources = await client.callTool({ name: "capture.sources", arguments: {} });
    expect(mcpSources.structuredContent).toMatchObject({ ok: true, data: sources });
    for (const authorization of [
      "denied",
      "authorized",
      "restricted",
      "not_determined",
      "unknown",
    ]) {
      cameraPermission = authorization;
      const status = await read("capture.status");
      expect(status).toMatchObject({
        device: { state: "idle", selection: null, permissions: { camera: authorization } },
        recording: null,
      });
      const mcpStatus = await client.callTool({ name: "capture.status", arguments: {} });
      expect(mcpStatus.structuredContent).toMatchObject({ ok: true, data: status });
    }
    cameras = [];
    expect((await read("capture.sources")).cameras).toEqual([]);
    expect(
      (await client.callTool({ name: "capture.sources", arguments: {} })).structuredContent,
    ).toMatchObject({ ok: true, data: { cameras: [] } });
    const unsupported = {
      requestId: "unsupported-camera",
      source: { kind: "window", windowId: 1 },
      cameraDeviceId: "camera-2",
    };
    expect(cli(f.socket, "capture.start", unsupported).result).toMatchObject({
      ok: false,
      error: { code: "INVALID_PARAMS" },
    });
    expect(
      (await client.callTool({ name: "capture.start", arguments: unsupported })).structuredContent,
    ).toMatchObject({ ok: false, error: { code: "INVALID_PARAMS" } });
    expect(
      f.asked.every(
        (operation) => operation === "capture.sources" || operation === "capture.status",
      ),
    ).toBe(true);
  },
);
