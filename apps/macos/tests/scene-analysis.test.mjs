import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { analyzeSceneRange } from "@screenrec/core/scenes";

const native = new URL("../../../helpers/mac/.build/debug/screenrec-native", import.meta.url)
  .pathname;

test("shared scene analysis preserves held coverage and exposes a nearest future transition", async (t) => {
  const directory = await mkdtemp("/tmp/scr-scene-timing-");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, "sparse.mov");
  // Three known frames at 0, 2 and 4 seconds: black, white, black.
  const frameBytes = 64 * 64 * 3;
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
      "1/2",
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
      source,
    ],
    {
      input: Buffer.concat([
        Buffer.alloc(frameBytes),
        Buffer.alloc(frameBytes, 255),
        Buffer.alloc(frameBytes),
      ]),
      timeout: 15000,
    },
  );
  assert.equal(generated.status, 0, generated.stderr.toString());
  const original = await readFile(source);
  const sample = async (params, signal) => {
    signal.throwIfAborted();
    const run = spawnSync(native, [], {
      input: JSON.stringify({ id: "scene", operation: "media.visualSamples", params }) + "\n",
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(run.status, 0, run.stderr);
    const response = JSON.parse(run.stdout);
    assert.equal(response.ok, true, JSON.stringify(response));
    return response.data;
  };
  const inspect = (endUs) =>
    analyzeSceneRange(
      {
        source,
        kept: { startUs: 0, endUs: 6000000 },
        range: { startUs: 0, endUs },
      },
      sample,
      new AbortController().signal,
    );
  const held = await inspect(1000000);
  assert.deepEqual(held.comparisons, []);
  assert.deepEqual(
    held.coverage.map((item) => [item.requestedSourceUs, item.actualSourceUs]),
    [
      [0, 0],
      [200000, 0],
      [400000, 0],
      [600000, 0],
      [800000, 0],
      [1000000, 0],
    ],
  );
  const future = await inspect(1500000);
  assert.equal(future.coverage.at(-1).actualSourceUs, 2000000);
  assert.equal(future.coverage.at(-1).distanceUs, 500000);
  assert.deepEqual(
    future.comparisons.map((pair) => [pair.actualSourceUs, pair.boundary]),
    [[2000000, true]],
  );
  assert.deepEqual(future.boundaries, [], "a future decoded transition is not a past reset");
  const through = await inspect(2000000);
  assert.deepEqual(through.boundaries, [{ kind: "scene", atSourceUs: 2000000 }]);
  assert.deepEqual(await readFile(source), original);
});
