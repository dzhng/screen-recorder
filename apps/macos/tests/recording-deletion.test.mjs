import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const execute = promisify(execFile);
const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
import { callLocal } from "@screenrec/client";
import {
  launchReady,
  socketPath,
  temporary,
  waitFor,
  requireScreenPermission,
} from "./harness.mjs";

// This gate records only the app-owned fixture window, with both audio roles disabled.
test(
  "public deletion ends the actual native take before removing its directory",
  { timeout: 60_000 },
  async () => {
    requireScreenPermission();
    const home = temporary("/tmp/screenrec-public-delete-");
    const { instance } = await launchReady(home, { SCREENREC_FIXTURE_WINDOW: "1" });
    const [, windowId] = await instance.waitFor(/capture fixture window=(\d+)/);
    const call = (operation, params = {}) =>
      callLocal(socketPath(home), { id: randomUUID(), operation, params }, { timeoutMs: 30_000 });
    const succeeds = async (operation, params) => {
      const answer = await call(operation, params);
      assert.equal(answer.ok, true, `${operation}: ${JSON.stringify(answer)}`);
      return answer.data;
    };
    const start = () =>
      succeeds("capture.start", {
        requestId: randomUUID(),
        source: { kind: "window", windowId: Number(windowId) },
        microphone: false,
        systemAudio: false,
      });
    const take = await start();
    const directory = join(home, "library", "recordings", take.recordingId);
    await waitFor(() => existsSync(join(directory, "source", "capture.journal.jsonl")), 5_000);
    const cliCall = async (operation, params) => {
      try {
        const command = await execute(
          process.execPath,
          [cli, operation, "--socket", socketPath(home), "--params", JSON.stringify(params)],
          { timeout: 30_000 },
        );
        return JSON.parse(command.stdout);
      } catch (error) {
        if (!error.stdout) throw error;
        return JSON.parse(error.stdout);
      }
    };
    const reference = { recordingId: take.recordingId };
    const before = await cliCall("storage.usage", reference);
    assert.equal(before.ok, true);
    assert.equal(before.data.recordingId, take.recordingId);
    assert.ok(before.data.totalBytes > 0);
    const cliResult = await cliCall("recording.delete", reference);
    assert.equal(cliResult.ok, true);
    assert.deepEqual(cliResult.data, { recordingId: take.recordingId, deleted: true });
    assert.equal(existsSync(directory), false);
    assert.equal((await cliCall("storage.usage", reference)).error.code, "NOT_FOUND");
    assert.equal(
      (await call("recording.get", { recordingId: take.recordingId })).error.code,
      "NOT_FOUND",
    );
    assert.equal(
      (await succeeds("recording.delete", { recordingId: take.recordingId })).deleted,
      true,
    );
    // Native capture capacity and the service's durable capture priority must both be released.
    const replacement = await start();
    assert.notEqual(replacement.recordingId, take.recordingId);
    assert.equal(replacement.state, "recording");
    const client = new Client({ name: "recording-deletion-test", version: "1" });
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [cli, "mcp", "--socket", socketPath(home)],
        }),
      );
      assert.ok((await client.listTools()).tools.some((tool) => tool.name === "recording.delete"));
      const usage = await client.callTool({
        name: "storage.usage",
        arguments: { recordingId: replacement.recordingId },
      });
      assert.equal(usage.structuredContent.ok, true);
      assert.equal(usage.structuredContent.data.recordingId, replacement.recordingId);
      assert.ok(usage.structuredContent.data.totalBytes > 0);
      const result = await client.callTool({
        name: "recording.delete",
        arguments: { recordingId: replacement.recordingId },
      });
      assert.equal(result.structuredContent.ok, true);
      assert.deepEqual(result.structuredContent.data, {
        recordingId: replacement.recordingId,
        deleted: true,
      });
      const absent = await client.callTool({
        name: "storage.usage",
        arguments: { recordingId: replacement.recordingId },
      });
      assert.equal(absent.structuredContent.error.code, "NOT_FOUND");
    } finally {
      await client.close();
    }
    assert.equal(existsSync(join(home, "library", "recordings", replacement.recordingId)), false);
  },
);
