import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, copyFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { RevisionStore } from "@screenrec/core/library";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
import { width, height, page, journalRows } from "./fixtures/generated-capture.mjs";
function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-v", "error", ...args], {
    timeout: 20000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}
const hash = async (file) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
function pixels(file) {
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
  assert.equal(rgb.length, width * height * 3, "Delivered pixels retain full fixture dimensions");
  return rgb;
}
function differences(a, b, region = { x: 0, y: 0, width, height }) {
  let changed = 0;
  for (let y = region.y; y < region.y + region.height; y++)
    for (let x = region.x; x < region.x + region.width; x++) {
      const at = (y * width + x) * 3;
      if ([0, 1, 2].some((channel) => Math.abs(a[at + channel] - b[at + channel]) > 16)) changed++;
    }
  return changed;
}
function compact(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    assert.ok(
      !value.some((item) => item && typeof item === "object" && "x" in item && "y" in item),
      "Public frame metadata must not dump cursor points",
    );
    value.forEach(compact);
  } else
    for (const [key, item] of Object.entries(value)) {
      assert.notEqual(key, "rgbBase64", "Analysis rasters must not enter public tool context");
      compact(item);
    }
}
async function fixture(home, transformRows = (rows) => rows, frameStepUs = 6_000_000) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated gesture fixture",
    sourceDurationUs: 18_000_000,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  const frameCount = 18_000_000 / frameStepUs;
  for (let index = 0; index < frameCount; index++)
    await writeFile(
      join(home, `page-${index}.ppm`),
      Buffer.concat([
        Buffer.from(`P6\n${width} ${height}\n255\n`),
        page(index * frameStepUs >= 12_000_000),
      ]),
    );
  const video = join(source, "video.mov");
  ffmpeg([
    "-framerate",
    `${1_000_000}/${frameStepUs}`,
    "-i",
    join(home, "page-%d.ppm"),
    "-frames:v",
    String(frameCount),
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-bf",
    "0",
    video,
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
      video,
    ],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(truth.status, 0, truth.stderr);
  assert.deepEqual(
    JSON.parse(truth.stdout).frames.map((frame) => Number(frame.pts_time)),
    Array.from({ length: frameCount }, (_, i) => (i * frameStepUs) / 1_000_000),
  );
  const samples = [];
  const point = (sourceUs, x, y) =>
    samples.push({
      sourceUs,
      x,
      y,
      globalX: x,
      globalY: y,
      buttons: 0,
      eligibility: "inside",
      geometryEpoch: 1,
    });
  for (let i = 0; i <= 52; i++)
    point(
      200_000 + i * 25_000,
      490 + 120 * Math.cos((i / 52) * Math.PI * 2),
      360 + 120 * Math.sin((i / 52) * Math.PI * 2),
    );
  for (let i = 0; i <= 18; i++)
    point(
      1_525_000 + i * 25_000,
      650 + (320 * i) / 18,
      455 + 18 * Math.sin((i / 18) * Math.PI * 4),
    );
  for (let i = 0; i <= 11; i++)
    point(2_300_000 + i * 25_000, 340 + i * 22, 568 + 10 * Math.sin((i / 11) * Math.PI * 2));
  for (const base of [3_500_000, 9_500_000])
    for (let i = 0; i <= 19; i++)
      point(base + i * 25_000, 805 + i * 8, 474 + 10 * Math.sin((i / 19) * Math.PI * 2));
  const rows = journalRows({
    sourceId: take.sourceId,
    width,
    height,
    samples,
    pauses: [{ atSourceUs: 2_250_000, elapsedPauseUs: 5_000_000 }],
  });
  const journal = join(source, "capture.journal.jsonl");
  await writeFile(
    journal,
    transformRows(rows)
      .map((row, index) => JSON.stringify({ sequence: index + 1, ...row }))
      .join("\n") + "\n",
  );
  return { take, video, journal };
}

function inspector(home, source) {
  const call = async (operation, params) => {
    const response = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
    assert.equal(response.ok, true, JSON.stringify(response));
    return response.data;
  };
  const base = {
    recordingId: source.take.recordingId,
    atUs: 2_000_000,
    maxLongEdge: width,
  };
  const results = {};
  async function deliver(name, options) {
    const { expectedSourceUs, ...requestOptions } = options ?? {};
    const params = { ...base, ...requestOptions };
    const ready = await waitFor(async () => {
      const status = await call("frame.get", params);
      if (["failed", "unavailable"].includes(status.state)) throw new Error(JSON.stringify(status));
      if (status.state !== "ready") return false;
      await call("artifact.close", { token: status.delivery.token });
      return status;
    }, 30000);
    const output = join(home, `${name}.png`);
    const command = spawnSync(
      process.execPath,
      [
        cli,
        "frame.get",
        "--socket",
        socketPath(home),
        "--params",
        JSON.stringify(params),
        "--output",
        output,
      ],
      { encoding: "utf8", timeout: 20000 },
    );
    assert.equal(command.status, 0, command.stdout + command.stderr);
    const delivered = JSON.parse(command.stdout);
    assert.deepEqual(delivered.data.published, ready.published);
    const frame = ready.published.frame;
    assert.equal(frame.requestedSourceUs, expectedSourceUs ?? params.atUs);
    assert.deepEqual([frame.width, frame.height], [width, height]);
    compact(frame);
    assert.ok(
      JSON.stringify(frame).length < 16_384,
      "Public annotation metadata must stay compact",
    );
    results[name] = { params, output, frame, rgb: pixels(output) };
    return results[name];
  }
  return { call, deliver, results };
}

test("public default trails preserve held-frame gestures, reset history and reach CLI and MCP as real pixels", async () => {
  const home = temporary("/tmp/scr-trail-public-");
  const source = await fixture(home);
  const hashes = { video: await hash(source.video), journal: await hash(source.journal) };
  const { instance } = await launchReady(home);
  const { deliver, results } = inspector(home, source);
  await deliver("clean", { clean: true });
  await deliver("pointer", { trailUs: 0 });
  await deliver("default", {});
  await deliver("short", { trailUs: 500_000 });
  await deliver("pause-reset", { atUs: 2_600_000 });
  await deliver("future-matching", { atUs: 4_000_000 });
  await deliver("future-changed", { atUs: 10_000_000 });
  await deliver("future-clean", { atUs: 10_000_000, clean: true });
  for (const name of ["clean", "pointer", "default", "short", "pause-reset"])
    assert.equal(
      results[name].frame.actualSourceUs,
      0,
      "Cursor observation time must not be replaced by an old held-frame PTS",
    );
  assert.equal(results["future-matching"].frame.actualSourceUs, 6_000_000);
  assert.equal(results["future-changed"].frame.actualSourceUs, 12_000_000);
  const trail = results.default.frame.annotation;
  assert.equal(trail.trailUs, 2_000_000);
  assert.equal(trail.agedFromUs, 2_000_000);
  assert.equal(trail.pointerObservation.sourceUs, 1_975_000);
  assert.equal(trail.pointer.atSourceUs, 1_975_000);
  assert.deepEqual(trail.interval, { startUs: 200_000, endUs: 1_975_000 });
  assert.equal(results.clean.frame.annotation, null);
  assert.equal(results.pointer.frame.annotation.interval, null);
  assert.equal(results.pointer.frame.annotation.pointer.atSourceUs, 1_975_000);
  assert.deepEqual(results.short.frame.annotation.interval, {
    startUs: 1_500_000,
    endUs: 1_975_000,
  });
  assert.deepEqual(results["pause-reset"].frame.annotation.interval, {
    startUs: 2_300_000,
    endUs: 2_575_000,
  });
  assert.ok(
    results["pause-reset"].frame.annotation.cutoffs.some(
      (cutoff) => cutoff.reason === "pause" && cutoff.atSourceUs === 2_250_000,
    ),
  );
  assert.ok(
    results["future-changed"].frame.annotation.cutoffs.some(
      (cutoff) => cutoff.reason === "future_scene" && cutoff.atSourceUs === 12_000_000,
    ),
  );
  assert.equal(results["future-changed"].frame.annotation.pointer, null);
  assert.equal(results["future-changed"].frame.annotation.interval, null);
  assert.equal(results["future-matching"].frame.annotation.pointer.atSourceUs, 3_975_000);
  assert.equal(results["future-matching"].frame.annotation.scene.futureComparison.boundary, false);
  const counts = {};
  for (const name of ["pointer", "default", "short", "pause-reset", "future-matching"])
    counts[name] = differences(results.clean.rgb, results[name].rgb);
  assert.ok(counts.pointer > 20 && counts.pointer < 1000);
  assert.ok(
    counts.default > 1000 && counts.default > counts.short && counts.short > counts.pointer,
  );
  const oldCircle = { x: 360, y: 240, width: 120, height: 240 };
  assert.ok(differences(results.clean.rgb, results.default.rgb, oldCircle) > 100);
  for (const name of ["pointer", "short", "pause-reset"])
    assert.equal(
      differences(results.clean.rgb, results[name].rgb, oldCircle),
      0,
      `${name} must not retain the old circle arc`,
    );
  assert.equal(
    differences(results["future-clean"].rgb, results["future-changed"].rgb),
    0,
    "A future changed page must not receive an old gesture",
  );
  assert.ok(
    counts["future-matching"] > 20,
    "A matching future image can retain the requested-time pointer",
  );
  const client = new Client({ name: "trail-public-proof", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--socket", socketPath(home)],
        stderr: "pipe",
      }),
    );
    for (const name of ["default", "pause-reset", "future-changed"]) {
      const response = await client.callTool({
        name: "frame.get",
        arguments: results[name].params,
      });
      assert.equal(response.isError, false);
      assert.deepEqual(response.structuredContent.data.published.frame, results[name].frame);
      const image = response.content.find((item) => item.type === "image");
      assert.equal(image?.mimeType, "image/png");
      assert.deepEqual(Buffer.from(image.data, "base64"), await readFile(results[name].output));
    }
  } finally {
    await client.close();
  }
  assert.deepEqual(
    { video: await hash(source.video), journal: await hash(source.journal) },
    hashes,
  );
  if (process.env.SCREENREC_TRAIL_EVIDENCE) {
    await mkdir(process.env.SCREENREC_TRAIL_EVIDENCE, { recursive: true });
    for (const [name, result] of Object.entries(results))
      await copyFile(result.output, join(process.env.SCREENREC_TRAIL_EVIDENCE, `${name}.png`));
    await writeFile(
      join(process.env.SCREENREC_TRAIL_EVIDENCE, "metrics.json"),
      JSON.stringify(
        {
          syntheticObservations: true,
          hashes,
          changedPixels: counts,
          frames: Object.fromEntries(
            Object.entries(results).map(([name, result]) => [name, result.frame]),
          ),
        },
        null,
        2,
      ) + "\n",
    );
  }
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
});

test("public cut clips retained history while a pinned historical revision preserves its gesture", async () => {
  const home = temporary("/tmp/scr-trail-cut-");
  const source = await fixture(home, undefined, 500_000);
  await launchReady(home);
  const { call, deliver } = inspector(home, source);
  const historical = await deliver("before-cut", {});
  const edited = await call("edit.cut", {
    recordingId: source.take.recordingId,
    expectedRevisionId: "r0",
    requestId: randomUUID(),
    ranges: [{ startUs: 0, endUs: 1_500_000 }],
  });
  const options = { revisionId: edited.revision.id, atUs: 500_000, expectedSourceUs: 2_000_000 };
  const cut = await deliver("cut", options);
  const clean = await deliver("cut-clean", { ...options, clean: true });
  assert.equal(cut.frame.annotation.agedFromUs, 2_000_000);
  assert.deepEqual(cut.frame.annotation.interval, { startUs: 1_500_000, endUs: 1_975_000 });
  assert.ok(
    cut.frame.annotation.cutoffs.some(
      (c) => c.reason === "kept_start" && c.atSourceUs === 1_500_000,
    ),
  );
  const oldCircle = { x: 360, y: 240, width: 120, height: 240 };
  assert.equal(differences(clean.rgb, cut.rgb, oldCircle), 0);
  assert.ok(differences(clean.rgb, cut.rgb) > 100, "Retained wave still draws after the cut");
  const current = await deliver("current", { atUs: 500_000, expectedSourceUs: 2_000_000 });
  assert.deepEqual(current.frame, cut.frame);
  assert.deepEqual(current.rgb, cut.rgb);
  assert.deepEqual(cut.frame.sourceEvidence, historical.frame.sourceEvidence);
  const pinned = await deliver("historical", { revisionId: "r0" });
  assert.deepEqual(pinned.frame, historical.frame);
  assert.deepEqual(pinned.rgb, historical.rgb);
  assert.ok(differences(clean.rgb, pinned.rgb, oldCircle) > 100);
});

for (const resized of [false, true])
  test(`public ${resized ? "resize vetoes" : "window move preserves"} held-raster coordinates`, async () => {
    const home = temporary("/tmp/scr-trail-geometry-");
    const source = await fixture(home, (rows) => {
      const moved = structuredClone(rows.find((row) => row.event === "geometry"));
      moved.data.epoch = 2;
      moved.data.sourceUs = 1_500_000;
      moved.data.hostUs += 1_500_000;
      moved.data.geometry.screenRect.x = 500;
      moved.data.geometry.screenRect.y = 300;
      if (resized) moved.data.geometry.contentRect.width -= 200;
      rows.splice(3, 0, moved);
      for (const row of rows)
        if (row.event === "cursorSamples")
          for (const sample of row.data.samples)
            if (sample.sourceUs >= moved.data.sourceUs) {
              sample.geometryEpoch = 2;
              sample.globalX += 500;
              sample.globalY += 300;
            }
      return rows;
    });
    await launchReady(home);
    const { deliver } = inspector(home, source);
    const clean = await deliver("clean", { clean: true });
    const annotated = await deliver("geometry", {});
    const annotation = annotated.frame.annotation;
    assert.equal(annotated.frame.actualSourceUs, 0);
    assert.deepEqual(annotation.geometry, { requestedEpoch: 2, selectedEpoch: 1 });
    assert.ok(
      annotation.cutoffs.some((c) => c.reason === "geometry" && c.atSourceUs === 1_500_000),
    );
    assert.equal(
      differences(clean.rgb, annotated.rgb, { x: 360, y: 240, width: 120, height: 240 }),
      0,
    );
    if (resized) {
      assert.equal(
        differences(annotated.rgb, clean.rgb),
        0,
        "Incompatible geometry cannot draw on the held raster",
      );
      assert.equal(annotation.pointer, null);
      assert.equal(annotation.interval, null);
    } else {
      assert.equal(annotation.pointer.atSourceUs, 1_975_000);
      assert.deepEqual(annotation.interval, { startUs: 1_500_000, endUs: 1_975_000 });
      assert.ok(
        differences(clean.rgb, annotated.rgb, { x: 640, y: 420, width: 350, height: 70 }) > 100,
        "The new wave stays in output coordinates despite movement on the desktop",
      );
      assert.equal(
        differences(clean.rgb, annotated.rgb, { x: 1000, y: 650, width: 280, height: 150 }),
        0,
      );
    }
  });

for (const eligibility of ["outside", "unknownGeometry"])
  test(`public ${eligibility} observation wins a duplicate timestamp without reviving the previous pointer`, async () => {
    const home = temporary("/tmp/scr-trail-eligibility-");
    const source = await fixture(home, (rows) => {
      for (const row of rows)
        if (row.event === "cursorSamples") {
          const index = row.data.samples.findIndex((sample) => sample.sourceUs === 1_975_000);
          if (index >= 0)
            row.data.samples.splice(index + 1, 0, {
              ...row.data.samples[index],
              eligibility,
              x: null,
              y: null,
              geometryEpoch: eligibility === "unknownGeometry" ? 0 : 1,
            });
        }
      return rows;
    });
    await launchReady(home);
    const { deliver } = inspector(home, source);
    const clean = await deliver("clean", { clean: true });
    const pointer = await deliver("pointer", { trailUs: 0 });
    assert.equal(pointer.frame.annotation.pointerObservation.sourceUs, 1_975_000);
    assert.equal(pointer.frame.annotation.pointerObservation.eligibility, eligibility);
    assert.equal(pointer.frame.annotation.pointer, null);
    assert.equal(pointer.frame.annotation.interval, null);
    assert.ok(
      pointer.frame.annotation.cutoffs.some(
        (c) =>
          c.reason === (eligibility === "outside" ? "outside" : "unknown_geometry") &&
          c.atSourceUs === 1_975_000,
      ),
    );
    assert.deepEqual(
      pointer.rgb,
      clean.rgb,
      "The earlier eligible duplicate must not draw a pointer",
    );
    const trail = await deliver("trail", {});
    assert.equal(trail.frame.annotation.pointer, null);
    assert.deepEqual(trail.frame.annotation.interval, { startUs: 200_000, endUs: 1_950_000 });
    assert.ok(
      differences(clean.rgb, trail.rgb, { x: 360, y: 240, width: 120, height: 240 }) > 100,
      "Earlier eligible history remains visible even though the current pointer is unknown",
    );
  });

test("public missing geometry is explicit unavailability while clean delivery remains usable", async () => {
  const home = temporary("/tmp/scr-trail-missing-geometry-");
  const source = await fixture(home, (rows) => rows.filter((row) => row.event !== "geometry"));
  await launchReady(home);
  const { call, deliver } = inspector(home, source);
  const params = { recordingId: source.take.recordingId, revisionId: "r0", atUs: 2_000_000 };
  const unavailable = await waitFor(async () => {
    const status = await call("frame.get", params);
    assert.notEqual(
      status.state,
      "ready",
      "Missing geometry must not silently become clean success",
    );
    return ["unavailable", "failed"].includes(status.state) && status;
  }, 30000);
  assert.equal(unavailable.state, "unavailable");
  assert.match(unavailable.reason, /No timed geometry/);
  assert.equal(unavailable.published, null);
  assert.equal(unavailable.delivery, null);
  assert.equal(unavailable.dependency, null);
  const clean = await deliver("clean", { clean: true });
  assert.equal(clean.frame.annotation, null);
  assert.equal(clean.frame.actualSourceUs, 0);
});

test("public frame retry leaves a failed source dependency for explicit processing retry", async (t) => {
  const home = temporary("/tmp/scr-trail-source-retry-");
  const source = await fixture(home);
  const journal = await readFile(source.journal);
  const blockedOutput = join(home, "recordings", source.take.recordingId, "evidence", "source");
  await mkdir(blockedOutput, { recursive: true });
  await chmod(blockedOutput, 0o500);
  t.after(() => chmod(blockedOutput, 0o700));
  await launchReady(home);
  const { call, deliver } = inspector(home, source);
  const params = { recordingId: source.take.recordingId, revisionId: "r0", atUs: 2_000_000 };
  const failed = await waitFor(async () => {
    const status = await call("frame.get", params);
    assert.notEqual(status.state, "ready");
    return ["failed", "unavailable"].includes(status.state) && status;
  }, 30000);
  assert.equal(failed.state, "failed");
  assert.equal(failed.retryable, true);
  assert.equal(failed.jobId, null);
  assert.equal(failed.published, null);
  assert.equal(failed.delivery, null);
  const sourceFailure = await call("processing.status", { recordingId: source.take.recordingId });
  assert.deepEqual(failed.dependency, { artifact: "source", jobId: sourceFailure.jobId });
  const clean = await deliver("clean", { clean: true });
  await chmod(blockedOutput, 0o700);
  assert.deepEqual(await call("frame.retry", params), failed);
  assert.deepEqual(await call("frame.get", params), failed);
  assert.deepEqual(
    await call("processing.status", { recordingId: source.take.recordingId }),
    sourceFailure,
  );
  await call("processing.retry", { recordingId: source.take.recordingId, artifact: "source" });
  const recovered = await deliver("recovered", {});
  assert.equal(recovered.frame.annotation.pointer.atSourceUs, 1_975_000);
  assert.ok(differences(clean.rgb, recovered.rgb) > 1000);
  assert.deepEqual(await readFile(source.journal), journal);
});
