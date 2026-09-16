import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { DerivedCache } from "../../../packages/core/dist/cache.js";
import { RevisionStore } from "../../../packages/core/dist/library.js";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
const width = 2048,
  height = 1152;

function ffmpeg(args) {
  const run = spawnSync("ffmpeg", ["-v", "error", ...args], {
    timeout: 20000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr.toString());
  return run.stdout;
}

// Independent source truth: three large, labelled frames with binary blocks. The fixture's
// numbered pixels are drawn before encoding; no decoder metadata participates in this oracle.
async function fixture(home) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const recording = store.allocate().recording;
  store.ingestLifecycle(recording.recordingId, {
    sourceId: recording.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated sparse media",
    sourceDurationUs: 6000000,
  });
  store.close();
  const directory = join(home, "recordings", recording.recordingId, "source");
  await mkdir(directory, { recursive: true });
  const glyphs = ["111101101101111", "010110010010111", "111001111100111"];
  for (let index = 0; index < 3; index++) {
    const rgb = Buffer.alloc(width * height * 3, 32);
    const fill = (x, y, w, h, color) => {
      for (let row = y; row < y + h; row++)
        for (let column = x; column < x + w; column++) {
          const at = (row * width + column) * 3;
          rgb[at] = color[0];
          rgb[at + 1] = color[1];
          rgb[at + 2] = color[2];
        }
    };
    fill(0, 0, 80, 80, [255, 20, 20]);
    fill(width - 80, height - 80, 80, 80, [20, 20, 255]);
    for (let bit = 0; bit < 3; bit++)
      fill(120 + bit * 100, 100, 80, 80, Array(3).fill((index >> bit) & 1 ? 240 : 0));
    for (let cell = 0; cell < 15; cell++)
      if (glyphs[index][cell] === "1")
        fill(800 + (cell % 3) * 100, 300 + Math.floor(cell / 3) * 100, 90, 90, [230, 245, 230]);
    await writeFile(
      join(home, `source-${index}.ppm`),
      Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), rgb]),
    );
  }
  const source = join(directory, "video.mov");
  ffmpeg([
    "-framerate",
    "1/2",
    "-i",
    join(home, "source-%d.ppm"),
    "-frames:v",
    "3",
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-bf",
    "0",
    source,
  ]);
  const truth = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=pts_time",
      "-of",
      "json",
      source,
    ],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(truth.status, 0, truth.stderr);
  assert.deepEqual(
    JSON.parse(truth.stdout).frames.map((frame) => Number(frame.pts_time)),
    [0, 2, 4],
  );
  return { recording, source };
}

function assertNumberedPixels(file, expected) {
  const rgb = ffmpeg([
    "-i",
    file,
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
  assert.equal(rgb.length, width * height * 3);
  let actual = 0;
  for (let bit = 0; bit < 3; bit++) {
    const at = (140 * width + 160 + bit * 100) * 3;
    if (rgb[at] > 128) actual |= 1 << bit;
  }
  assert.equal(
    actual,
    expected,
    "delivered pixels must carry the independently expected frame number",
  );
  assert.ok(rgb[0] > 200 && rgb[1] < 60, "red corner must remain top-left");
  const bottom = ((height - 1) * width + width - 1) * 3;
  assert.ok(rgb[bottom + 2] > 200 && rgb[bottom] < 60, "blue corner must remain bottom-right");
}

test("sparse numbered frames preserve public timing, full resolution, cuts and regeneration after restart", async () => {
  const home = temporary("/tmp/scr-sparse-public-");
  const { recording, source } = await fixture(home);
  const hash = async () =>
    createHash("sha256")
      .update(await readFile(source))
      .digest("hex");
  const originalHash = await hash();
  let { instance } = await launchReady(home);
  const call = async (operation, params = {}) => {
    const response = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
    assert.equal(response.ok, true, JSON.stringify(response));
    return response.data;
  };
  const frame = async (params) =>
    waitFor(async () => {
      const response = await call("frame.get", params);
      if (["failed", "unavailable"].includes(response.state))
        throw new Error(JSON.stringify(response));
      if (response.state !== "ready") return false;
      await call("artifact.close", { token: response.delivery.token });
      return response;
    }, 20000);
  const params = {
    recordingId: recording.recordingId,
    revisionId: "r0",
    atUs: 1000000,
    clean: true,
    maxLongEdge: 8192,
  };
  const tie = await frame(params);
  assert.equal(tie.published.frame.requestedSourceUs, 1000000);
  assert.equal(tie.published.frame.actualSourceUs, 0);
  assert.equal(tie.published.frame.actualPlaybackUs, 0);
  assert.equal(tie.published.frame.distanceUs, 1000000);
  assert.deepEqual([tie.published.frame.width, tie.published.frame.height], [width, height]);
  assert.deepEqual(
    [tie.published.frame.sourceWidth, tie.published.frame.sourceHeight],
    [width, height],
  );
  const start = await frame({ ...params, atUs: 0 });
  assert.equal(start.published.frame.actualSourceUs, 0);
  const end = await frame({ ...params, atUs: 5999999 });
  assert.equal(end.published.frame.actualSourceUs, 4000000);
  assert.equal(end.published.frame.distanceUs, 1999999);
  const resized = await frame({ ...params, maxLongEdge: 1600 });
  assert.deepEqual([resized.published.frame.width, resized.published.frame.height], [1600, 900]);

  const edited = await call("edit.cut", {
    recordingId: recording.recordingId,
    expectedRevisionId: "r0",
    requestId: randomUUID(),
    ranges: [{ startUs: 1000000, endUs: 3000000 }],
  });
  const boundaryParams = { ...params, revisionId: edited.revision.id, atUs: 1000000 };
  const boundary = await frame(boundaryParams);
  assert.deepEqual(boundary.published.frame.kept, { startUs: 3000000, endUs: 6000000 });
  assert.equal(boundary.published.frame.requestedPlaybackUs, 1000000);
  assert.equal(boundary.published.frame.requestedSourceUs, 3000000);
  assert.equal(boundary.published.frame.actualSourceUs, 4000000);
  assert.equal(boundary.published.frame.actualPlaybackUs, 2000000);
  assert.equal(boundary.published.frame.distanceUs, 1000000);

  const output = join(home, "full-resolution.png");
  const cliResult = spawnSync(
    process.execPath,
    [
      cli,
      "frame.get",
      "--socket",
      socketPath(home),
      "--params",
      JSON.stringify(boundaryParams),
      "--output",
      output,
    ],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(cliResult.status, 0, cliResult.stdout + cliResult.stderr);
  assert.deepEqual(JSON.parse(cliResult.stdout).data.published, boundary.published);
  const png = await readFile(output);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height]);
  assertNumberedPixels(output, 2);
  const client = new Client({ name: "sparse-frame-proof", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--socket", socketPath(home)],
        stderr: "pipe",
      }),
    );
    const response = await client.callTool({ name: "frame.get", arguments: boundaryParams });
    assert.equal(response.isError, false);
    assert.deepEqual(response.structuredContent.data.published, boundary.published);
    assert.deepEqual(
      Buffer.from(response.content.find((item) => item.type === "image").data, "base64"),
      png,
    );
  } finally {
    await client.close();
  }

  // Change current revision before restart; regeneration must stay with the explicitly pinned one.
  const newer = await call("edit.cut", {
    recordingId: recording.recordingId,
    expectedRevisionId: edited.revision.id,
    requestId: randomUUID(),
    ranges: [{ startUs: 0, endUs: 500000 }],
  });
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
  // Exercise actual cache eviction under a smaller budget while the service is stopped.
  const catalog = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  try {
    const cache = new DerivedCache(catalog, home);
    await cache.reconcile();
    for (const retained of [tie, start, end, resized]) {
      const read = cache.acquire(retained.published.frame.cacheId);
      assert.ok(read);
      read.release();
    }
    const constrained = new DerivedCache(
      catalog,
      home,
      cache.bytes - boundary.published.frame.bytes,
    );
    await constrained.reconcile();
    assert.equal(constrained.acquire(boundary.published.frame.cacheId), null);
    await assert.rejects(readFile(boundary.published.frame.file), { code: "ENOENT" });
  } finally {
    catalog.close();
  }
  ({ instance } = await launchReady(home));
  const regenerated = await frame(boundaryParams);
  assert.equal(regenerated.revisionId, edited.revision.id);
  assert.equal(regenerated.published.generation, boundary.published.generation + 1);
  assert.notEqual(regenerated.published.frame.cacheId, boundary.published.frame.cacheId);
  assert.equal(regenerated.published.frame.actualSourceUs, 4000000);
  assert.equal(regenerated.published.frame.actualPlaybackUs, 2000000);
  assert.equal(
    (await call("revision.get", { recordingId: recording.recordingId })).revision.id,
    newer.revision.id,
  );
  assert.deepEqual(await readFile(regenerated.published.frame.file), png);
  const replay = await frame(boundaryParams);
  assert.deepEqual(replay.published, regenerated.published);
  assert.deepEqual((await frame(params)).published, tie.published);
  assert.equal(await hash(), originalHash);
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
});
