import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { JsonLineStream, CONTROL_FRAME_BYTES } from "../../protocol/dist/index.js";

export async function withReadinessProcesses(
  { report, env, serviceObserver, runtime, observer, cliLog, childLog },
  verify,
  save,
) {
  let service, client, mcpClosed, recordMcp;
  async function start() {
    const child = spawn(process.execPath, [serviceObserver], {
      env: {
        ...env,
        SCREENREC_READINESS_SERVICE: join(runtime, "service.mjs"),
        SCREENREC_READINESS_CHILD_LOG: childLog,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const record = {
      label: "source service",
      pid: child.pid,
      control: [],
      stdout: "",
      stderr: "",
      exit: null,
    };
    report.processes.push(record);
    const terminal = new Promise((resolveExit) =>
      child.once("close", (code, signal) => {
        record.exit = { code, signal };
        resolveExit(record.exit);
        if (!startedReceived)
          rejectReady(
            new Error(`Source service exited before started: ${JSON.stringify(record.exit)}`),
          );
      }),
    );
    const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
    let resolveReady, rejectReady;
    let startedReceived = false;
    const ready = new Promise((resolveValue, reject) => {
      resolveReady = resolveValue;
      rejectReady = reject;
    });
    const fail = (error) => {
      record.error ??= { message: error.message, stack: error.stack };
      rejectReady(error);
    };
    child.once("error", fail);
    child.stdin.on("error", fail);
    child.stderr.on("data", (bytes) => (record.stderr += bytes));
    child.stdout.on("data", (bytes) => {
      record.stdout += bytes;
      try {
        for (const frame of stream.push(bytes)) {
          if (!frame.ok) throw frame.error;
          record.control.push(frame.value);
          if (frame.value.event === "started") {
            startedReceived = true;
            resolveReady(frame.value);
          }
          if (frame.value.event === "failed") throw new Error(JSON.stringify(frame.value));
        }
      } catch (error) {
        fail(error);
      }
    });
    child.stdout.on("end", () => {
      const error = stream.finish();
      if (error) fail(error);
    });
    service = { child, terminal, record };
    const started = await ready;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [observer, "mcp", "--socket", started.socketPath],
      env: {
        ...env,
        SCREENREC_READINESS_CLI: join(runtime, "cli.mjs"),
        SCREENREC_READINESS_CLI_LOG: cliLog,
      },
      stderr: "pipe",
    });
    client = new Client({ name: "parakeet-readiness", version: "1" });
    recordMcp = { label: "default SDK child close", pid: null, closeObserved: false, stderr: "" };
    report.processes.push(recordMcp);
    transport.stderr.on("data", (bytes) => (recordMcp.stderr += bytes));
    mcpClosed = new Promise((resolveClose) => {
      transport.onclose = () => {
        recordMcp.closeObserved = true;
        resolveClose();
      };
    });
    const connectionError = Promise.withResolvers();
    client.onerror = (error) => {
      recordMcp.error ??= { message: error.message, stack: error.stack };
      connectionError.reject(error);
    };
    const connected = client.connect(transport);
    recordMcp.pid = transport.pid;
    await Promise.race([connected, connectionError.promise]);
    return started.socketPath;
  }
  async function stop() {
    const failures = [];
    if (client) {
      try {
        await client.close();
        await mcpClosed;
        assert.equal(recordMcp.error, undefined, recordMcp.error?.message);
      } catch (error) {
        failures.push(error);
      } finally {
        client = undefined;
      }
    }
    if (service) {
      const selected = service;
      service = undefined;
      selected.child.stdin.end();
      const exit = await selected.terminal;
      try {
        assert.deepEqual(exit, { code: 0, signal: null }, selected.record.stderr);
        assert.equal(selected.record.error, undefined, selected.record.error?.message);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(failures, failures.map((error) => error.message).join("; "));
  }
  let failure;
  try {
    await verify({
      start,
      stop,
      get client() {
        return client;
      },
    });
  } catch (error) {
    report.error = { message: error.message, stack: error.stack };
    failure = error;
  } finally {
    try {
      await stop();
    } catch (error) {
      report.passed = false;
      report.cleanupError = { message: error.message, stack: error.stack };
      failure ??= error;
    }
    await save("report.json", report);
  }
  if (failure) throw failure;
}
