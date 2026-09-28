import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import {
  SceneEvidenceStore,
  recordingSceneOwner,
  recordingSceneIdentity,
} from "@screenrec/core/scene-evidence";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
test("bundled canonical scene scan retains sparse actual-time transitions and survives restart", async () => {
  const home = temporary("/tmp/scr-scenes-public-");
  const open = () =>
    new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
  const store = open(),
    take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated sparse source",
    sourceDurationUs: 120_000_000,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  const video = join(source, "video.mov");
  const generated = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgb24",
      "-video_size",
      "64x64",
      "-framerate",
      "1/40",
      "-i",
      "pipe:0",
      "-frames:v",
      "3",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-bf",
      "0",
      video,
    ],
    {
      input: Buffer.concat([
        Buffer.alloc(64 * 64 * 3),
        Buffer.alloc(64 * 64 * 3, 255),
        Buffer.alloc(64 * 64 * 3),
      ]),
      timeout: 15000,
    },
  );
  assert.equal(generated.status, 0, generated.stderr.toString());
  const hash = async () =>
    createHash("sha256")
      .update(await readFile(video))
      .digest("hex");
  const original = await hash();
  const { instance } = await launchReady(home);
  const request = {
    id: randomUUID(),
    operation: "processing.status",
    params: { recordingId: take.recordingId, artifact: "scenes" },
  };
  let ready;
  await waitFor(async () => {
    const response = await callLocal(socketPath(home), request);
    assert.equal(response.ok, true, JSON.stringify(response));
    if (response.data.state === "failed") throw new Error(JSON.stringify(response.data));
    if (response.data.state !== "ready") return false;
    ready = response.data;
    return true;
  }, 20000);
  const inspect = open();
  try {
    const evidence = new SceneEvidenceStore(inspect, recordingSceneOwner(inspect)),
      identity = recordingSceneIdentity(ready.published.evidence);
    let afterStartUs,
      total = 0;
    const transitions = [];
    for (;;) {
      const page = evidence.page({
        identity,
        limit: 2,
        ...(afterStartUs === undefined ? {} : { afterStartUs }),
      });
      total += page.chunks.length;
      transitions.push(
        ...page.chunks
          .flatMap((chunk) => chunk.comparisons)
          .filter((pair) => pair.boundary)
          .map((pair) => pair.actualSourceUs),
      );
      if (page.nextStartUs === null) break;
      afterStartUs = page.nextStartUs;
    }
    assert.equal(total, 12);
    assert.deepEqual(transitions, [40_000_000, 80_000_000]);
  } finally {
    inspect.close();
  }
  const run = spawnSync(
    process.execPath,
    [
      cli,
      "processing.status",
      "--socket",
      socketPath(home),
      "--params",
      JSON.stringify(request.params),
    ],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).data, ready);
  const client = new Client({ name: "scene-processing-proof", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--socket", socketPath(home)],
        stderr: "pipe",
      }),
    );
    const response = await client.callTool({
      name: "processing.status",
      arguments: request.params,
    });
    assert.equal(response.isError, false);
    assert.deepEqual(response.structuredContent.data, ready);
  } finally {
    await client.close();
  }
  instance.kill("SIGTERM");
  await instance.exited;
  const { instance: restarted } = await launchReady(home);
  const again = await callLocal(socketPath(home), { ...request, id: randomUUID() });
  assert.equal(again.ok, true);
  assert.deepEqual(again.data, ready);
  assert.equal(await hash(), original);
  restarted.kill("SIGTERM");
  await restarted.exited;
});
