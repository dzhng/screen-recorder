import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
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
import { app, finderEnvironment, launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

// This gate records only the app-owned fixture window, with both audio roles disabled.
test(
  "public deletion ends the actual native take before removing its directory",
  { timeout: 60_000 },
  async () => {
    const preflight = spawnSync(app, ["--capture-preflight"], {
      cwd: "/",
      env: finderEnvironment,
      encoding: "utf8",
      timeout: 20_000,
    });
    assert.equal(
      JSON.parse(preflight.stdout || "{}").screen,
      true,
      "Existing screen permission is required; this gate never requests it",
    );
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
    const directory = join(home, "recordings", take.recordingId);
    await waitFor(() => existsSync(join(directory, "source", "capture.journal.jsonl")), 5_000);
    const command = await execute(
      process.execPath,
      [
        cli,
        "recording.delete",
        "--socket",
        socketPath(home),
        "--params",
        JSON.stringify({ recordingId: take.recordingId }),
      ],
      { timeout: 30_000 },
    );
    const cliResult = JSON.parse(command.stdout);
    assert.equal(cliResult.ok, true);
    assert.deepEqual(cliResult.data, { recordingId: take.recordingId, deleted: true });
    assert.equal(existsSync(directory), false);
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
      const result = await client.callTool({
        name: "recording.delete",
        arguments: { recordingId: replacement.recordingId },
      });
      assert.equal(result.structuredContent.ok, true);
      assert.deepEqual(result.structuredContent.data, {
        recordingId: replacement.recordingId,
        deleted: true,
      });
    } finally {
      await client.close();
    }
    assert.equal(existsSync(join(home, "recordings", replacement.recordingId)), false);
  },
);
