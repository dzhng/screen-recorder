import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, hash } from "node:crypto";
import { mkdir, writeFile, readFile, rename, stat, realpath } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { RevisionStore } from "@screenrec/core/library";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";
import { journalRows } from "./fixtures/generated-capture.mjs";

const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
test(
  "bundled export lifecycle pins video through CLI/MCP, restart and recording deletion",
  { timeout: 60000 },
  async () => {
    const home = temporary("/tmp/screenrec-public-export-");
    const directory = temporary("/tmp/screenrec-export-output-");
    const store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    const take = store.allocate().recording;
    store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 1,
      state: "interrupted",
      reason: "generated export fixture",
      sourceDurationUs: 2_000_000,
    });
    store.close();
    const source = join(home, "recordings", take.recordingId, "source");
    await mkdir(source, { recursive: true });
    const original = join(source, "video.mov");
    execFileSync(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=gray:s=160x90:r=1:d=2",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        original,
      ],
      { timeout: 20000 },
    );
    const rows = journalRows({
      sourceId: take.sourceId,
      width: 160,
      height: 90,
      samples: [],
      pauses: [],
    });
    await writeFile(
      join(source, "capture.journal.jsonl"),
      rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
    );
    const originalHash = hash("sha256", await readFile(original));
    let { instance } = await launchReady(home);
    const raw = (operation, params) =>
      callLocal(socketPath(home), { id: randomUUID(), operation, params });
    const call = async (operation, params) => {
      const result = await raw(operation, params);
      assert.equal(result.ok, true, JSON.stringify(result));
      return result.data;
    };
    const cliCall = (operation, params) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [cli, operation, "--socket", socketPath(home), "--params", JSON.stringify(params)],
          { encoding: "utf8", timeout: 10000 },
        ),
      );
    try {
      const request = {
        exportId: randomUUID(),
        recordingId: take.recordingId,
        kind: "video",
        directory,
        leaf: "demo.mp4",
      };
      const initial = cliCall("export.create", request);
      assert.equal(initial.ok, true, JSON.stringify(initial));
      assert.equal(initial.data.snapshot.revisionId, "r0");
      assert.equal(initial.data.kind, "video");
      const edited = await call("edit.cut", {
        recordingId: take.recordingId,
        requestId: randomUUID(),
        expectedRevisionId: "r0",
        ranges: [{ startUs: 500000, endUs: 1000000 }],
      });
      assert.notEqual(edited.revision.id, "r0");
      const replay = await call("export.create", request);
      assert.equal(replay.jobId, initial.data.jobId);
      assert.equal(replay.snapshot.revisionId, "r0");
      const client = new Client({ name: "export-proof", version: "1" });
      let committed;
      try {
        await client.connect(
          new StdioClientTransport({
            command: process.execPath,
            args: [cli, "mcp", "--socket", socketPath(home)],
            stderr: "pipe",
          }),
        );
        const tools = await client.listTools();
        assert.ok(tools.tools.some((tool) => tool.name === "export.create"));
        committed = await waitFor(async () => {
          const response = await client.callTool({
            name: "export.status",
            arguments: { exportId: request.exportId },
          });
          assert.equal(response.isError, false, JSON.stringify(response));
          const status = response.structuredContent.data;
          if (["failed", "unavailable", "canceled"].includes(status.state))
            throw new Error(JSON.stringify(status));
          return status.state === "committed" && status;
        }, 20000);
      } finally {
        await client.close();
      }
      const output = join(directory, request.leaf);
      assert.equal(committed.output, await realpath(output));
      const bytes = await readFile(output);
      assert.equal(committed.receipt.sha256, hash("sha256", bytes));
      const info = JSON.parse(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_entries", "format=duration", "-of", "json", output],
          { encoding: "utf8" },
        ),
      );
      assert.equal(Number(info.format.duration), 2, "export stays pinned before concurrent cut");
      assert.equal(hash("sha256", await readFile(original)), originalHash);
      assert.equal(
        (await raw("export.create", { ...request, kind: "processed-package" })).error.code,
        "REQUEST_CONFLICT",
      );
      const conflict = await call("export.create", { ...request, exportId: randomUUID() });
      await waitFor(
        async () =>
          (await call("export.status", { exportId: conflict.exportId })).state === "failed",
        20000,
      );
      assert.equal(
        hash("sha256", await readFile(output)),
        hash("sha256", bytes),
        "existing external bytes preserved",
      );
      const pendingUsage = await call("storage.usage", { recordingId: take.recordingId });
      assert.ok(pendingUsage.otherBytes > 0, "failed export private bytes contribute to storage");
      await call("export.cancel", { exportId: conflict.exportId });
      await call("export.abandon", { exportId: conflict.exportId });
      await call("export.abandon", { exportId: conflict.exportId });
      assert.equal(
        (await raw("export.status", { exportId: conflict.exportId })).error.code,
        "NOT_FOUND",
      );
      assert.deepEqual(
        (await call("export.recover", { exportId: request.exportId })).receipt,
        committed.receipt,
      );
      const moved = join(directory, "moved.mp4");
      await rename(output, moved);
      instance.kill("SIGTERM");
      await waitFor(() => !instance.running, 15000);
      assert.equal((await instance.exited).code, 0);
      ({ instance } = await launchReady(home));
      const historical = cliCall("export.retry", { exportId: request.exportId });
      assert.equal(historical.ok, true);
      assert.deepEqual(historical.data.receipt, committed.receipt);
      await assert.rejects(stat(output), { code: "ENOENT" });
      assert.equal(hash("sha256", await readFile(moved)), hash("sha256", bytes));
      await call("recording.delete", { recordingId: take.recordingId });
      assert.equal(
        hash("sha256", await readFile(moved)),
        hash("sha256", bytes),
        "deletion preserves committed external file",
      );
      assert.equal(
        (await raw("export.status", { exportId: request.exportId })).error.code,
        "NOT_FOUND",
      );
    } finally {
      instance.kill("SIGTERM");
      await waitFor(() => !instance.running, 15000);
      assert.equal((await instance.exited).code, 0);
    }
  },
);
