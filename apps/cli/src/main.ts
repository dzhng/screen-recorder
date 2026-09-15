#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { z } from "zod";
import { callLocal, LocalTransportError } from "@screenrec/client";
import {
  operationSchema,
  FrameError,
  REQUEST_FRAME_BYTES,
  parseRequest,
  type OperationRequest,
  type OperationResponse,
} from "@screenrec/protocol";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

function failure(id: string, code: string, message: string, retryable = false): OperationResponse {
  return { id, ok: false, error: { code, message, retryable, details: {} } };
}

function capabilities() {
  return operationSchema.options.map((definition) => ({
    name: definition.shape.operation.value,
    description: definition.description ?? "",
    inputSchema: z.toJSONSchema(definition.shape.params),
  }));
}

function errorResult(id: string, error: unknown): OperationResponse {
  if (error instanceof LocalTransportError)
    return failure(
      id,
      error.code,
      error.message,
      error.code === "TIMEOUT" || error.code.startsWith("CONNECTION_"),
    );
  if (error instanceof FrameError)
    return failure(
      id,
      error.code === "FRAME_TOO_LARGE" ? "LIMIT_EXCEEDED" : "INVALID_RESPONSE",
      error.message,
    );
  return failure(id, "INVALID_REQUEST", error instanceof Error ? error.message : "Invalid request");
}

async function invoke(
  socketPath: string,
  request: OperationRequest,
  signal?: AbortSignal,
): Promise<OperationResponse> {
  try {
    return await callLocal(socketPath, request, signal ? { signal } : {});
  } catch (error) {
    return errorResult(request.id, error);
  }
}

async function readParams(value: string): Promise<unknown> {
  if (value !== "-") return JSON.parse(value);
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += data.length;
    if (bytes > REQUEST_FRAME_BYTES)
      throw new FrameError("FRAME_TOO_LARGE", "JSON input exceeds the request byte limit");
    chunks.push(data);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}

async function mcp(socketPath: string) {
  const server = new Server(
    { name: "screenrec", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: capabilities().map((tool) => ({
      ...tool,
      inputSchema: { ...tool.inputSchema, type: "object" as const },
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (call, extra) => {
    const result = await invoke(
      socketPath,
      {
        id: randomUUID(),
        operation: call.params.name,
        params: call.params.arguments ?? {},
      },
      extra.signal,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
      isError: !result.ok,
    };
  });
  await server.connect(new StdioServerTransport());
}

// Before argument parsing succeeds there is no reliable mode or request identity.
// Usage failures go to stderr so they cannot contaminate an MCP protocol stream.
let errorOutput: NodeJS.WritableStream = process.stderr;
let responseId = "cli";

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      socket: { type: "string" },
      params: { type: "string" },
      id: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });
  errorOutput = positionals[0] === "mcp" ? process.stderr : process.stdout;
  responseId = values.id || randomUUID();
  if (values.help || positionals.length === 0) {
    process.stdout.write(
      JSON.stringify(
        {
          usage:
            "screenrec <operation> --socket PATH [--params JSON|-] [--id ID] | screenrec mcp --socket PATH",
          timeUnits:
            "Integer microseconds. Edit ranges are half-open playback ranges in expectedRevisionId.",
          mutations:
            "Supply a stable params.requestId and expectedRevisionId. Retry uncertain writes with the same requestId and arguments.",
          operations: capabilities(),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  if (positionals.length !== 1) throw new Error("Expected one operation name or mcp");
  const socketPath = values.socket;
  if (!socketPath) throw new Error("Use --socket PATH to select the local recorder service");
  if (positionals[0] === "mcp") {
    if (values.params || values.id) throw new Error("mcp accepts --socket only");
    await mcp(socketPath);
    return;
  }
  const request = parseRequest({
    id: values.id ?? responseId,
    operation: positionals[0],
    params: await readParams(values.params ?? "{}"),
  });
  const result = await invoke(socketPath, request);
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!result.ok) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  errorOutput.write(JSON.stringify(errorResult(responseId, error)) + "\n");
  process.exitCode = 1;
}
