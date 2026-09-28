import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { RevisionStore } from "@screenrec/core/library";
import { DerivedCache, recordingCacheOwnerCheck } from "@screenrec/core/cache";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { callLocal } from "@screenrec/client";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("bundled index retains selected images across edits, cache eviction and restart", async () => {
  const home = temporary("/tmp/scr-index-public-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated index fixture",
    sourceDurationUs: 12_000_000,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  const video = join(source, "video.mov");
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x180:r=1:d=12",
      "-an",
      "-c:v",
      "libx264",
      "-bf",
      "0",
      video,
    ],
    { timeout: 20000, encoding: "utf8" },
  );
  assert.equal(encoded.status, 0, encoded.stderr);
  const rows = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: take.sourceId,
        source: { kind: "window", windowID: 1 },
        width: 320,
        height: 180,
        microphone: false,
        systemAudio: false,
      },
    },
    { event: "origin", data: { hostUs: 1_000_000 } },
    {
      event: "geometry",
      data: {
        epoch: 1,
        hostUs: 1_000_000,
        sourceUs: 0,
        geometry: {
          outputWidth: 320,
          outputHeight: 180,
          contentScale: 1,
          scaleFactor: 1,
          contentRect: { x: 0, y: 0, width: 320, height: 180 },
          screenRect: { x: 0, y: 0, width: 320, height: 180 },
        },
      },
    },
    {
      event: "cursorSamples",
      data: {
        samples: Array.from({ length: 120 }, (_, i) => ({
          sourceUs: i * 100000,
          x: -10,
          y: -10,
          globalX: -10,
          globalY: -10,
          buttons: 0,
          eligibility: "outside",
          geometryEpoch: 1,
        })),
      },
    },
    { event: "finished", data: {} },
  ];
  await writeFile(
    join(source, "capture.journal.jsonl"),
    rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row })).join("\n") + "\n",
  );
  const sourceHash = digest(await readFile(video));
  let { instance } = await launchReady(home);
  const call = async (operation, params) => {
    const response = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
    assert.equal(response.ok, true, JSON.stringify(response));
    return response.data;
  };
  const ready = await waitFor(async () => {
    const result = await call("index.get", { recordingId: take.recordingId, limit: 1 });
    if (["failed", "unavailable"].includes(result.state)) throw new Error(JSON.stringify(result));
    return result.state === "ready" && result;
  }, 30000);
  assert.equal(ready.page.metadata.candidateCount, 2);
  const reference = ready.page.entries[0].reference;
  assert.equal(ready.page.entries[0].candidate.requestedSourceUs, 0);
  const read = async (ref) => {
    const result = await call("index.frame", ref);
    try {
      const chunk = await call("artifact.read", {
        token: result.delivery.token,
        offset: 0,
        maxBytes: 524288,
      });
      assert.equal(chunk.eof, true);
      const bytes = Buffer.from(chunk.data, "base64");
      assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      return { bytes, frame: result.published.frame };
    } finally {
      await call("artifact.close", { token: result.delivery.token });
    }
  };
  const first = await read(reference);
  const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
  const output = join(home, "selected.png");
  const command = spawnSync(
    process.execPath,
    [
      cli,
      "index.frame",
      "--socket",
      socketPath(home),
      "--params",
      JSON.stringify(reference),
      "--output",
      output,
    ],
    { timeout: 20000, encoding: "utf8" },
  );
  assert.equal(command.status, 0, command.stdout + command.stderr);
  assert.deepEqual(await readFile(output), first.bytes);
  const client = new Client({ name: "retained-index-proof", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--socket", socketPath(home)],
      }),
    );
    const tool = await client.callTool({ name: "index.frame", arguments: reference });
    const image = tool.content.find((item) => item.type === "image");
    assert.ok(image, "MCP returns selected PNG bytes as image content");
    assert.deepEqual(Buffer.from(image.data, "base64"), first.bytes);
  } finally {
    await client.close();
  }
  assert.equal(first.frame.annotation.trailPoints, 0);
  assert.equal(first.frame.actualSourceUs, 0);
  await call("edit.cut", {
    recordingId: take.recordingId,
    expectedRevisionId: "r0",
    requestId: randomUUID(),
    ranges: [{ startUs: 4_000_000, endUs: 6_000_000 }],
  });
  const next = await call("index.get", {
    recordingId: take.recordingId,
    cursor: ready.page.nextCursor,
    limit: 1,
  });
  assert.equal(next.revisionId, "r0");
  assert.equal(next.page.entries[0].candidate.requestedSourceUs, 11_999_999);
  assert.equal(next.page.nextCursor, null);
  const batch = await call("index.frames", {
    recordingId: reference.recordingId,
    revisionId: reference.revisionId,
    generation: reference.generation,
    ordinals: [0, 2, 0],
  });
  assert.deepEqual(
    batch.items.map((item) => [item.ordinal, item.ok]),
    [
      [0, true],
      [2, false],
      [0, true],
    ],
  );
  for (const item of batch.items)
    if (item.ok) await call("artifact.close", { token: item.data.delivery.token });
  assert.deepEqual(await instance.reap(), []);
  const reopened = new RevisionStore(join(home, "library.sqlite"));
  assert.ok(
    reopened.catalog.prepare("SELECT COUNT(*) AS count FROM derived_cache").get().count > 0,
  );
  await new DerivedCache(reopened, home, recordingCacheOwnerCheck(reopened), 1).reconcile();
  assert.equal(
    reopened.catalog.prepare("SELECT COUNT(*) AS count FROM derived_cache").get().count,
    0,
  );
  reopened.close();
  ({ instance } = await launchReady(home));
  assert.deepEqual((await read(reference)).bytes, first.bytes);
  const historical = await call("index.get", {
    recordingId: take.recordingId,
    revisionId: "r0",
    limit: 1,
  });
  assert.equal(historical.generation, ready.generation);
  assert.deepEqual(historical.page, ready.page);
  assert.equal(digest(await readFile(video)), sourceHash);
  assert.deepEqual(await instance.reap(), []);
});
