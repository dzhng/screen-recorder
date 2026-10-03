#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  artifactFile,
  artifactOperations,
  batchReferences,
  ArtifactDeliveryError,
  consumeBatch,
} from "./artifact-delivery.js";
import { mcpContent, mcpInlineBytes, mcpResult } from "./mcp-result.js";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  callLocal,
  resolveServiceSocket,
  LocalTransportError,
  type ServiceSelection,
} from "@screenrec/client";
import {
  operationNames,
  operationSchema,
  FrameError,
  REQUEST_FRAME_BYTES,
  parseRequest,
  encodeJsonLine,
  operationError,
  isArtifactMaintenance,
  type OperationRequest,
  type OperationResponse,
  type OperationWireResponse,
} from "@screenrec/protocol";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const previewOperations = new Set(["preview.get", "preview.retry"]);

function failure(
  id: string,
  code: string,
  message: string,
  retryable = false,
): Extract<OperationResponse, { ok: false }> {
  return { id, ...operationError(code, message, retryable) };
}

function capabilities(operation?: string) {
  return operationSchema.options
    .filter(
      (definition) => operation === undefined || definition.shape.operation.value === operation,
    )
    .map((definition) => ({
      name: definition.shape.operation.value,
      description: definition.description ?? "",
      // What a caller must send, so a parameter the service defaults stays optional.
      inputSchema: z.toJSONSchema(definition.shape.params, {
        io: "input",
        reused: "ref",
        override: ({ jsonSchema }) => {
          // Runtime freezing does not make caller-authored inputs read-only.
          delete jsonSchema.readOnly;
        },
      }),
    }));
}

class UsageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function errorResult(id: string, error: unknown): Extract<OperationResponse, { ok: false }> {
  if (error instanceof ArtifactDeliveryError)
    return failure(id, error.code, error.message, error.retryable);
  if (error instanceof UsageError) return failure(id, error.code, error.message);
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

// Validate before discovery, because discovery can launch the personal app.
function request(id: string, operation: string, params: unknown): OperationRequest {
  if (!operationNames.has(operation))
    throw new UsageError(
      "UNKNOWN_OPERATION",
      `Unknown service operation: ${operation.slice(0, 120)}`,
    );
  const sending = parseRequest({ id, operation, params });
  encodeJsonLine(sending, REQUEST_FRAME_BYTES);
  if (!operationSchema.safeParse({ operation, params }).success)
    throw new UsageError("INVALID_PARAMS", "Parameters do not match the operation schema.");
  return sending;
}

// The caller retains this socket for delivery; dispatch must not rediscover or replay.
function invoke(
  selection: ServiceSelection & { socketPath: string },
  sending: OperationRequest,
  deliverResult: number,
): Promise<OperationWireResponse>;
function invoke(
  selection: ServiceSelection & { socketPath: string },
  sending: OperationRequest,
): Promise<OperationResponse>;
async function invoke(
  selection: ServiceSelection & { socketPath: string },
  sending: OperationRequest,
  deliverResult?: number,
): Promise<OperationWireResponse> {
  try {
    if (deliverResult && !isArtifactMaintenance(sending.operation))
      return await callLocal(
        selection.socketPath,
        {
          ...sending,
          resultDelivery: { inlineBytes: deliverResult },
        },
        selection.signal ? { signal: selection.signal } : {},
      );
    return await callLocal(
      selection.socketPath,
      sending,
      selection.signal ? { signal: selection.signal } : {},
    );
  } catch (error) {
    return errorResult(sending.id, error);
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

async function mcp(selection: ServiceSelection) {
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
    const id = randomUUID();
    try {
      const sending = request(id, call.params.name, call.params.arguments ?? {});
      const selected = {
        socketPath: await resolveServiceSocket({ ...selection, signal: extra.signal }),
        signal: extra.signal,
      };
      const answer = await invoke(selected, sending, mcpInlineBytes(extra.requestId));
      return await mcpResult(selected, sending.operation, answer, extra.requestId, (error) =>
        errorResult(id, error),
      );
    } catch (error) {
      return mcpContent(errorResult(id, error));
    }
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
      output: { type: "string" },
      id: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });
  errorOutput = positionals[0] === "mcp" ? process.stderr : process.stdout;
  responseId = values.id || randomUUID();
  if (values.help || positionals.length === 0) {
    if (positionals.length > 1) throw new Error("Expected one operation name or mcp");
    const operation = positionals[0] === "mcp" ? undefined : positionals[0];
    if (operation !== undefined && !operationNames.has(operation))
      throw new UsageError(
        "UNKNOWN_OPERATION",
        `Unknown service operation: ${operation.slice(0, 120)}`,
      );
    process.stdout.write(
      JSON.stringify(
        {
          usage:
            "screenrec <operation> [--socket PATH] [--params JSON|-] [--id ID] [--output FILE|NEW_DIRECTORY] | screenrec mcp [--socket PATH]",
          service:
            "Without --socket, calls use $SCREENREC_HOME/run/service.sock (default ~/.screen-recorder) and launch the personal app once, within ten seconds, when nothing answers there. --socket connects to that path directly and never launches an app.",
          timeUnits:
            "Microseconds. Endpoints accept integers or exact reduced fractions where the operation's input schema permits them. Ranges are half-open in the selected anchor domain and expectedRevisionId.",
          mutations:
            "When the operation schema accepts requestId, supply a stable value and reuse it with identical arguments after an uncertain write. Supply expectedRevisionId only where its schema requires it.",
          operations: capabilities(operation),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  const [operation] = positionals;
  if (positionals.length !== 1 || operation === undefined)
    throw new Error("Expected one operation name or mcp");
  const selection: ServiceSelection = { socketPath: values.socket };
  if (operation === "mcp") {
    if (values.params || values.id || values.output) throw new Error("mcp accepts --socket only");
    // Listing tools describes the registry; only a called tool looks for a service.
    await mcp(selection);
    return;
  }
  if (values.output && !artifactOperations.has(operation) && !previewOperations.has(operation))
    throw new Error("--output applies only to artifact inspection operations");
  const sending = request(responseId, operation, await readParams(values.params ?? "{}"));
  const selected = { ...selection, socketPath: await resolveServiceSocket(selection) };
  let result = await invoke(selected, sending);
  const batchReference = batchReferences.get(operation);
  if (batchReference) {
    let directory: string | undefined;
    let outputError: unknown;
    result = await consumeBatch(
      selected,
      result,
      batchReference,
      async (media, index) => {
        if (outputError) throw outputError;
        if (!directory) {
          try {
            directory = values.output
              ? resolve(values.output)
              : await mkdtemp(join(tmpdir(), "screenrec-frames-"));
            if (values.output) await mkdir(directory);
          } catch (error) {
            outputError = error;
            throw error;
          }
        }
        const output = join(directory, `${String(index + 1).padStart(2, "0")}.png`);
        await writeFile(output, media.bytes, { flag: "wx" });
        return { output };
      },
      (error) => errorResult(sending.id, error).error,
    );
  } else if (artifactOperations.has(operation) || previewOperations.has(operation)) {
    try {
      const media = await artifactFile(selected, result, values.output);
      if (media && result.ok)
        result = {
          ...result,
          data: { ...(result.data as Record<string, unknown>), output: media.output },
        };
    } catch (error) {
      result = errorResult(sending.id, error);
    }
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!result.ok) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  errorOutput.write(JSON.stringify(errorResult(responseId, error)) + "\n");
  process.exitCode = 1;
}
