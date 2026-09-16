import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  linkSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import { test, after } from "node:test";
import {
  createOriginalRevision,
  createRevision,
  renderPlan,
} from "../../../packages/core/dist/timeline.js";
import { renderFrames } from "./fixtures/render-frames.mjs";
const native =
  process.env.SCREENREC_NATIVE ??
  new URL("../.build/debug/screenrec-native", import.meta.url).pathname;
const evidence = process.env.SCREENREC_VIDEO_RENDER_EVIDENCE;
const directory = evidence ?? mkdtempSync(join(tmpdir(), "screenrec-video-render-"));
assert.ok(isAbsolute(directory));
mkdirSync(directory, { recursive: true });
assert.deepEqual(readdirSync(directory), []);
const receipts = [];
after(() => {
  if (evidence) writeFileSync(join(directory, "report.json"), JSON.stringify(receipts, null, 2));
  else rmSync(directory, { recursive: true, force: true });
});
function run(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    input,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const frames = renderFrames();
writeFileSync(join(directory, "source.rgb"), Buffer.concat(frames));
for (const [name, rate] of [
  ["dense", 30],
  ["sparse", 1],
]) {
  run("ffmpeg", [
    "-v",
    "error",
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgb24",
    "-video_size",
    "320x180",
    "-framerate",
    String(rate),
    "-i",
    join(directory, "source.rgb"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-bf",
    "2",
    "-video_track_timescale",
    "90000",
    "-an",
    join(directory, name + ".mov"),
  ]);
}
run("swiftc", [
  "-parse-as-library",
  new URL("RenderMembership/gap.swift", import.meta.url).pathname,
  "-o",
  join(directory, "gap-maker"),
]);
for (const kind of ["leading", "internal"]) {
  run(join(directory, "gap-maker"), [
    join(directory, "sparse.mov"),
    join(directory, kind + ".mov"),
    kind,
  ]);
}
function planFor(duration, spans) {
  return renderPlan(
    createRevision(createOriginalRevision(duration), spans, {
      id: "fixture",
      operation: "cut",
      createdAt: "fixture",
    }),
  );
}
function request(params) {
  return JSON.parse(
    run(
      native,
      [],
      JSON.stringify({ id: "render", operation: "media.renderVideo", params }) + "\n",
    ),
  );
}
function inspect(output) {
  const metadata = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_entries",
      "frame=pts_time",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      output,
    ]),
  );
  const raw = output + ".rgb";
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    output,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-fps_mode",
    "passthrough",
    raw,
  ]);
  const bytes = readFileSync(raw),
    frameBytes = frames[0].length;
  assert.equal(bytes.length % frameBytes, 0);
  const identities = [];
  for (let offset = 0; offset < bytes.length; offset += frameBytes) {
    const pixels = bytes.subarray(offset, offset + frameBytes);
    if (pixels.every((value) => value <= 2)) {
      identities.push("black");
      continue;
    }
    const errors = frames.map((frame) => {
      let sum = 0;
      for (let index = 0; index < frameBytes; index++)
        sum += Math.abs(pixels[index] - frame[index]);
      return sum / frameBytes;
    });
    const best = Math.min(...errors);
    assert.ok(best < 12, `Unexpected rendered pixels: MAE ${best}`);
    identities.push(errors.indexOf(best));
  }
  return {
    durationUs: Math.round(Number(metadata.format.duration) * 1e6),
    pts: metadata.frames.map((frame) => Math.round(Number(frame.pts_time) * 1e6)),
    identities,
  };
}
const cases = [
  [
    "one-microsecond-spans",
    "dense",
    200000,
    [
      [10000, 10001],
      [20000, 20001],
    ],
    [0, 0],
    [0, 1],
  ],
  ["subframe", "dense", 200000, [[10000, 20000]], [0], [0]],
  [
    "fractional-two-cuts",
    "dense",
    200000,
    [
      [10001, 20002],
      [43334, 53337],
    ],
    [0, 1],
    [0, 10001],
  ],
  [
    "two-middle-cuts",
    "dense",
    200000,
    [
      [0, 40000],
      [70000, 120000],
      [150000, 200000],
    ],
    [0, 1, 2, 3, 4, 5],
    [0, 33333, 40000, 70000, 90000, 106667],
  ],
  [
    "original",
    "dense",
    200000,
    [[0, 200000]],
    [0, 1, 2, 3, 4, 5],
    [0, 33333, 66667, 100000, 133333, 166667],
  ],
  ["sparse-held", "sparse", 6000000, [[500000, 510000]], [0], [0]],
  ["leading-empty", "leading", 3000000, [[0, 3000000]], ["black", 1], [0, 2000000]],
  ["internal-empty", "internal", 4000000, [[0, 4000000]], [0, "black", 1], [0, 1000000, 3000000]],
  ["trailing-empty", "internal", 4000000, [[500000, 2000000]], [0, "black"], [0, 500000]],
  ["empty-only", "internal", 4000000, [[1500000, 1510001]], ["black"], [0]],
];
for (const [name, sourceName, duration, ranges, identities, pts] of cases) {
  test(`video worker preserves ${name} pixels and exact plan duration`, () => {
    const source = join(directory, sourceName + ".mov"),
      output = join(directory, name + ".mp4");
    const before = readFileSync(source);
    const plan = planFor(
      duration,
      ranges.map(([startUs, endUs]) => ({ startUs, endUs })),
    );
    const result = request({ source, output, plan });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(readFileSync(source), before);
    assert.equal(result.data.durationUs, plan.at(-1).playback.endUs);
    const decoded = inspect(output);
    receipts.push({
      name,
      source: sourceName,
      plan,
      receipt: { ...result.data, file: name + ".mp4" },
      decoded,
    });
    assert.equal(decoded.durationUs, result.data.durationUs);
    assert.deepEqual(decoded.identities, identities);
    assert.equal(result.data.frameCount, identities.length);
    assert.equal(decoded.pts.length, pts.length);
    decoded.pts.forEach((value, index) =>
      assert.ok(Math.abs(value - pts[index]) <= 1, `${value} != ${pts[index]}`),
    );
  });
}
test("video worker refuses malformed plans and output aliases without source mutation", () => {
  const source = join(directory, "dense.mov"),
    before = readFileSync(source);
  const plan = planFor(200000, [{ startUs: 0, endUs: 200000 }]);
  symlinkSync(source, join(directory, "link.mp4"));
  linkSync(source, join(directory, "hard.mp4"));
  for (const output of [
    source,
    join(directory, "link.mp4"),
    join(directory, "hard.mp4"),
    directory,
  ]) {
    assert.equal(request({ source, output, plan }).error.code, "INVALID_OUTPUT");
  }
  for (const bad of [
    [],
    [{ source: { startUs: -1, endUs: 1 }, playback: { startUs: 0, endUs: 2 } }],
    [{ source: { startUs: 0, endUs: 10 }, playback: { startUs: 1, endUs: 11 } }],
    [{ source: { startUs: true, endUs: 10 }, playback: { startUs: 0, endUs: 10 } }],
    [{ source: { startUs: 0, endUs: 300000 }, playback: { startUs: 0, endUs: 300000 } }],
  ]) {
    const output = join(directory, "invalid.mp4");
    assert.equal(request({ source, output, plan: bad }).ok, false);
    assert.equal(existsSync(output), false);
  }
  assert.deepEqual(readFileSync(source), before);
});

test("video publication preserves a destination created during rendering", async () => {
  const source = join(directory, "dense.mov"),
    output = join(directory, "raced.mp4");
  const spans = Array.from({ length: 1000 }, (_, index) => ({
    startUs: index * 100,
    endUs: index * 100 + 1,
  }));
  const child = spawn(native, [], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const closed = new Promise((resolve) => child.once("close", resolve));
  try {
    child.stdin.end(
      JSON.stringify({
        id: "race",
        operation: "media.renderVideo",
        params: { source, output, plan: planFor(200000, spans) },
      }) + "\n",
    );
    const deadline = Date.now() + 5000;
    while (!readdirSync(directory).some((name) => name.startsWith(".video-render-"))) {
      assert.ok(
        Date.now() < deadline && child.exitCode === null,
        "Render must reach staging before publication",
      );
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    writeFileSync(output, "concurrent owner's sentinel", { flag: "wx" });
    assert.equal(await closed, 0, stderr);
    assert.equal(JSON.parse(stdout).error.code, "INVALID_OUTPUT");
    assert.equal(readFileSync(output, "utf8"), "concurrent owner's sentinel");
    assert.equal(
      readdirSync(directory).some((name) => name.startsWith(".video-render-")),
      false,
    );
  } finally {
    child.kill("SIGKILL");
    await closed;
  }
});

test("video output preserves the native source's sRGB presentation across decoders", () => {
  const source = join(directory, "dense.mov");
  const expectedPng = join(directory, "native-source-color.png");
  const frame = JSON.parse(
    run(
      native,
      [],
      JSON.stringify({
        id: "color-source",
        operation: "media.frame",
        params: {
          source,
          output: expectedPng,
          atSourceUs: 35000,
          kept: { startUs: 0, endUs: 200000 },
          maxLongEdge: 320,
        },
      }) + "\n",
    ),
  );
  assert.equal(frame.ok, true, JSON.stringify(frame));
  assert.equal(frame.data.actualSourceUs, 33333);
  const output = join(directory, "color-render.mp4");
  const rendered = request({
    source,
    output,
    plan: planFor(200000, [{ startUs: 0, endUs: 200000 }]),
  });
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const reference = expectedPng + ".rgb";
  const actual = output + ".rgb";
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    expectedPng,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    reference,
  ]);
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    output,
    "-vf",
    "select=eq(n\\,1)",
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    actual,
  ]);
  const expected = readFileSync(reference),
    decoded = readFileSync(actual);
  assert.equal(decoded.length, expected.length);
  let error = 0;
  for (let i = 0; i < expected.length; i++) error += Math.abs(expected[i] - decoded[i]);
  // Native decoding establishes the source's displayed sRGB appearance. An independent
  // decoder must reproduce it from the movie, including its color metadata.
  assert.ok(error / expected.length < 2, `Displayed sRGB error: ${error / expected.length}`);
});

test("presentation evidence holds the displayed frame instead of nearest future still", () => {
  const source = join(directory, "sparse.mov"),
    output = join(directory, "held.jsonl");
  const plan = planFor(6000000, [{ startUs: 750000, endUs: 1250000 }]);
  const result = JSON.parse(
    run(
      native,
      [],
      JSON.stringify({
        id: "support",
        operation: "media.presentationEvidence",
        params: { source, output, plan, maxBytes: 1048576 },
      }) + "\n",
    ),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  const [header, ...records] = readFileSync(output, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(header.version, 1);
  assert.deepEqual(
    records.map((r) => r.actualSourceUs),
    [0, 1000000],
  );
  assert.deepEqual(
    records.map((r) => Number(r.start.value) / r.start.timescale),
    [0.75, 1],
  );
  assert.deepEqual(
    records.map((r) => Number(r.end.value) / r.end.timescale),
    [1, 1.25],
  );
  const nearest = JSON.parse(
    run(
      native,
      [],
      JSON.stringify({
        id: "nearest",
        operation: "media.visualSamples",
        params: { source, kept: { startUs: 0, endUs: 6000000 }, atSourceUs: [750000] },
      }) + "\n",
    ),
  );
  assert.equal(nearest.ok, true, JSON.stringify(nearest));
  assert.equal(nearest.data.samples[0].actualSourceUs, 1000000);
  assert.notEqual(records[0].rgbBase64, nearest.data.samples[0].rgbBase64);
  assert.equal(records[1].rgbBase64, nearest.data.samples[0].rgbBase64);
});

function supportRequest(sourceName, name, ranges, maxBytes = 16 * 1024 * 1024) {
  const source = join(directory, sourceName + ".mov"),
    output = join(directory, name + ".jsonl");
  const plan = planFor(
    6000000,
    ranges.map(([startUs, endUs]) => ({ startUs, endUs })),
  );
  return {
    output,
    result: JSON.parse(
      run(
        native,
        [],
        JSON.stringify({
          id: name,
          operation: "media.presentationEvidence",
          params: { source, output, plan, maxBytes },
        }) + "\n",
      ),
    ),
  };
}
function supportRows(output) {
  return readFileSync(output, "utf8").trim().split("\n").map(JSON.parse).slice(1);
}
const seconds = (t) => Number(t.value) / t.timescale;
test("presentation evidence clips exact rational supports across cuts and empty edits", () => {
  const cut = supportRequest("dense", "support-cuts", [
    [10001, 20002],
    [33334, 100001],
  ]);
  assert.equal(cut.result.ok, true, JSON.stringify(cut.result));
  const rows = supportRows(cut.output);
  assert.deepEqual(
    rows.map((r) => r.spanIndex),
    [0, 1, 1, 1],
  );
  assert.deepEqual(
    rows.map((r) => r.actualSourceUs),
    [0, 33333, 66667, 100000],
  );
  assert.equal(seconds(rows[0].start), 0.010001);
  assert.equal(seconds(rows[0].end), 0.020002);
  assert.equal(seconds(rows[1].end), 2 / 30);
  assert.equal(seconds(rows.at(-1).end), 0.100001);
  const empty = supportRequest("internal", "support-empty", [[500000, 3500000]]);
  assert.equal(empty.result.ok, true, JSON.stringify(empty.result));
  assert.deepEqual(
    supportRows(empty.output).map((r) => [seconds(r.start), seconds(r.end), r.empty]),
    [
      [0.5, 1, false],
      [1, 3, true],
      [3, 3.5, false],
    ],
  );
  const black = supportRows(empty.output)[1];
  assert.equal(black.rgbBase64, undefined);
  assert.equal(black.sampleTime, undefined);
});

test("presentation evidence refuses unsupported video tail and partial byte-budget output", () => {
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    join(directory, "dense.mov"),
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=400:duration=1",
    "-c:v",
    "copy",
    "-c:a",
    "pcm_f32le",
    join(directory, "unsupported.mov"),
  ]);
  const unsupported = supportRequest("unsupported", "unsupported-evidence", [[0, 500000]]);
  assert.equal(unsupported.result.ok, false);
  assert.equal(unsupported.result.error.code, "UNAVAILABLE");
  assert.match(unsupported.result.error.message, /support/);
  assert.equal(existsSync(unsupported.output), false);
  const limited = supportRequest("sparse", "limited-evidence", [[0, 2000000]], 1000);
  assert.equal(limited.result.ok, false);
  assert.equal(limited.result.error.code, "LIMIT_EXCEEDED");
  assert.equal(existsSync(limited.output), false);
  assert.ok(!readdirSync(directory).some((name) => name.startsWith(".presentation-evidence-")));
});

test("presentation evidence memory stays bounded while streamed output grows", async () => {
  const peaks = [];
  for (const count of [100, 5000]) {
    const source = join(directory, "dense.mov"),
      output = join(directory, `stream-${count}.jsonl`);
    const plan = planFor(
      200000,
      Array.from({ length: count }, (_, index) => ({
        startUs: index * 20,
        endUs: index * 20 + 1,
      })),
    );
    const statistics = join(directory, `memory-${count}.txt`);
    const result = JSON.parse(
      run(
        "/usr/bin/time",
        ["-l", "-o", statistics, native],
        JSON.stringify({
          id: "stream",
          operation: "media.presentationEvidence",
          params: { source, output, plan, maxBytes: 128 * 1024 * 1024 },
        }) + "\n",
      ),
    );
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.records, count);
    const peak = Number(
      readFileSync(statistics, "utf8").match(/(\d+)\s+maximum resident set size/)[1],
    );
    peaks.push(peak);
    const { createReadStream } = await import("node:fs");
    const { createInterface } = await import("node:readline");
    let ordinal = -1;
    for await (const line of createInterface({ input: createReadStream(output) })) {
      assert.ok(Buffer.byteLength(line) + 1 <= 65536);
      const row = JSON.parse(line);
      if (ordinal >= 0) {
        assert.equal(row.spanIndex, ordinal);
        assert.equal(seconds(row.start), (ordinal * 20) / 1000000);
      }
      ordinal++;
    }
    assert.equal(ordinal, count);
    receipts.push({
      name: `support-stream-${count}`,
      receipt: { ...result.data, file: `stream-${count}.jsonl` },
      peakResidentBytes: peak,
    });
  }
  // Retaining the ~46 MB large result would exceed this allowance; decoder/startup
  // variation gets 24 MB while the output grows fiftyfold.
  assert.ok(peaks[1] - peaks[0] < 24 * 1024 * 1024, JSON.stringify(peaks));
});
