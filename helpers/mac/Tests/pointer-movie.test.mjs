import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, after } from "node:test";
const native =
  process.env.SCREENREC_NATIVE ??
  new URL("../.build/debug/screenrec-native", import.meta.url).pathname;
const dir =
  process.env.SCREENREC_POINTER_MOVIE_EVIDENCE ?? mkdtempSync(join(tmpdir(), "pointer-movie-"));
mkdirSync(dir, { recursive: true });
after(() => {
  if (!process.env.SCREENREC_POINTER_MOVIE_EVIDENCE) rmSync(dir, { recursive: true, force: true });
});
function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const source = join(dir, "held.mov");
run("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "color=c=gray:s=320x240:r=1:d=2",
  "-c:v",
  "libx264",
  "-bf",
  "0",
  source,
]);
const plan = [{ source: { startUs: 0, endUs: 2000000 }, playback: { startUs: 0, endUs: 2000000 } }];
function schedule(name, states, moviePlan = plan) {
  const header = {
    version: 1,
    recordingId: "recording",
    sourceId: "source",
    sourceGeneration: "generation",
    revisionId: "revision",
    sourceWidth: 320,
    sourceHeight: 240,
    durationUs: moviePlan.at(-1).playback.endUs,
    spanCount: moviePlan.length,
    trailPolicy: "requested-time-trail-v1",
    scenePolicy: "rgb-spatial-change-v2",
  };
  const bytes = Buffer.from([header, ...states].map((x) => JSON.stringify(x) + "\n").join(""));
  const file = join(dir, name + ".jsonl");
  writeFileSync(file, bytes);
  return {
    ...header,
    file,
    bytes: bytes.length,
    records: states.length,
    events: states.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
const state = (value, timescale, pointer) => ({
  spanIndex: 0,
  at: { value: String(value), timescale },
  pointer,
});
function movie(receipt, name, tracks = [], moviePlan = plan, video = source) {
  const output = join(dir, name + ".mp4");
  const reply = JSON.parse(
    run(
      native,
      [],
      JSON.stringify({
        id: "test",
        operation: "media.renderMovie",
        params: { source: video, output, plan: moviePlan, tracks, pointerSchedule: receipt },
      }) + "\n",
    ),
  );
  return { reply, output };
}
test("current pointer moves and clears over held pixels at exact fractional times", () => {
  const receipt = schedule("moving", [
    state(0, 1, { atSourceUs: 0, x: 30, y: 40 }),
    state(1, 3, { atSourceUs: 333333, x: 150, y: 120 }),
    state(2, 3, null),
  ]);
  const { reply, output } = movie(receipt, "moving");
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const metadata = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_frames",
      "-show_streams",
      "-of",
      "json",
      output,
    ]),
  );
  const [num, den] = metadata.streams[0].time_base.split("/").map(BigInt);
  for (const [index, numerator, denominator] of [
    [0, 0n, 1n],
    [1, 1n, 3n],
    [2, 2n, 3n],
    [3, 1n, 1n],
  ])
    assert.equal(BigInt(metadata.frames[index].pts) * num * denominator, numerator * den);
  const raw = join(dir, "moving.rgb");
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
    stride = 320 * 240 * 3;
  const bright = (frame, x, y) => {
    let count = 0;
    for (let yy = y; yy < y + 16; yy++)
      for (let xx = x; xx < x + 12; xx++)
        if (bytes[frame * stride + (yy * 320 + xx) * 3] > 200) count++;
    return count;
  };
  assert.ok(bright(0, 30, 40) > 10);
  assert.equal(bright(0, 150, 120), 0);
  assert.ok(bright(1, 150, 120) > 10);
  assert.equal(bright(1, 30, 40), 0);
  assert.equal(bright(2, 30, 40) + bright(2, 150, 120), 0);
});

test("fractional pointer transitions survive final AAC mux without rounding", () => {
  const audio = join(dir, "tone.wav");
  run("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000:duration=2",
    audio,
  ]);
  const receipt = schedule("audio", [
    state(0, 1, null),
    state(1, 3, { atSourceUs: 333333, x: 30, y: 40 }),
  ]);
  const { reply, output } = movie(receipt, "audio", [
    {
      role: "narration",
      source: audio,
      sourceOffsetUs: 0,
      available: [{ startUs: 0, endUs: 2000000 }],
    },
  ]);
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const metadata = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_frames",
      "-show_streams",
      "-of",
      "json",
      output,
    ]),
  );
  const [num, den] = metadata.streams[0].time_base.split("/").map(BigInt);
  assert.equal(BigInt(metadata.frames[1].pts) * num * 3n, den);
});
test("unsupported exact clock never publishes output or leaves staging", () => {
  const receipt = schedule("unsupported", [state(0, 1, null), state(1, 2147483647, null)]);
  const { reply, output } = movie(receipt, "unsupported");
  assert.equal(reply.ok, false);
  assert.equal(reply.error.code, "UNSUPPORTED_CLOCK");
  assert.equal(existsSync(output), false);
  assert.equal(
    readdirSync(dir).some((x) => x.startsWith(".movie-render-")),
    false,
  );
});
test("schedule hash and initial kept state are required before publication", () => {
  const badHash = schedule("bad-hash", [state(0, 1, null)]);
  badHash.sha256 = "0".repeat(64);
  const missingStart = schedule("missing-start", [state(1, 2, null)]);
  const missingNull = schedule("missing-null", [
    { spanIndex: 0, at: { value: "0", timescale: 1 } },
  ]);
  for (const [name, receipt] of [
    ["bad-hash", badHash],
    ["missing-start", missingStart],
    ["missing-null", missingNull],
  ]) {
    const { reply, output } = movie(receipt, name);
    assert.equal(reply.ok, false, name);
    assert.equal(existsSync(output), false);
  }
});
test("sub-microsecond pointer transitions remain distinct encoded samples", () => {
  const receipt = schedule("tiny", [
    state(0, 1, { atSourceUs: 0, x: 30, y: 40 }),
    state(3, 5000000, null),
    state(1, 1000000, { atSourceUs: 1, x: 150, y: 120 }),
  ]);
  const { reply, output } = movie(receipt, "tiny");
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const metadata = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_frames",
      "-show_streams",
      "-of",
      "json",
      output,
    ]),
  );
  const [num, den] = metadata.streams[0].time_base.split("/").map(BigInt);
  assert.equal(BigInt(metadata.frames[1].pts) * num * 5000000n, 3n * den);
  assert.equal(BigInt(metadata.frames[2].pts) * num * 1000000n, den);
});

test("kept starts reset the current pointer and map fractional source times exactly", () => {
  const cuts = [
    { source: { startUs: 250000, endUs: 750000 }, playback: { startUs: 0, endUs: 500000 } },
    { source: { startUs: 1250000, endUs: 1750000 }, playback: { startUs: 500000, endUs: 1000000 } },
  ];
  const receipt = schedule(
    "cuts",
    [
      state(1, 4, { atSourceUs: 250000, x: 30, y: 40 }),
      state(1, 3, { atSourceUs: 333333, x: 150, y: 120 }),
      { ...state(5, 4, null), spanIndex: 1 },
    ],
    cuts,
  );
  const { reply, output } = movie(receipt, "cuts", [], cuts);
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const metadata = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_frames",
      "-show_streams",
      "-of",
      "json",
      output,
    ]),
  );
  const [num, den] = metadata.streams[0].time_base.split("/").map(BigInt);
  assert.equal(BigInt(metadata.frames[1].pts) * num * 12n, den);
  assert.equal(BigInt(metadata.frames[2].pts) * num * 2n, den);
  const raw = join(dir, "cuts.rgb");
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
  assert.ok(
    readFileSync(raw)
      .subarray(320 * 240 * 3 * 2)
      .every((x) => x > 100 && x < 150),
  );
});

test("changing schedule bytes after preflight prevents movie publication", async () => {
  const receipt = schedule(
    "changing",
    Array.from({ length: 2000 }, (_, i) =>
      state(i, 1000, { atSourceUs: i * 1000, x: 30 + (i % 2) * 100, y: 40 }),
    ),
  );
  const output = join(dir, "changing.mp4");
  const child = spawn(native, [], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (x) => (stdout += x));
  const closed = new Promise((resolve) => child.once("close", resolve));
  try {
    child.stdin.end(
      JSON.stringify({
        id: "changing",
        operation: "media.renderMovie",
        params: { source, output, plan, tracks: [], pointerSchedule: receipt },
      }) + "\n",
    );
    const deadline = Date.now() + 5000;
    while (
      !readdirSync(dir).some(
        (x) =>
          x.startsWith(".movie-render-") &&
          readdirSync(join(dir, x)).some((y) => y.startsWith(".video-render-")),
      )
    ) {
      assert.ok(
        Date.now() < deadline && child.exitCode === null,
        "render must reach video staging",
      );
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const changed = readFileSync(receipt.file, "utf8").replace('"x":30', '"x":31');
    writeFileSync(receipt.file, changed);
    assert.equal(await closed, 0);
    assert.equal(JSON.parse(stdout).ok, false);
    assert.equal(existsSync(output), false);
    assert.equal(
      readdirSync(dir).some((x) => x.startsWith(".movie-render-")),
      false,
    );
  } finally {
    child.kill("SIGKILL");
    await closed;
  }
});

test("proven empty presentation remains black even across a held pointer state", () => {
  const maker = join(dir, "gap-maker");
  run("swiftc", [
    "-parse-as-library",
    new URL("RenderMembership/gap.swift", import.meta.url).pathname,
    "-o",
    maker,
  ]);
  const gap = join(dir, "gap.mov");
  run(maker, [source, gap, "internal"]);
  const p = [{ source: { startUs: 0, endUs: 4000000 }, playback: { startUs: 0, endUs: 4000000 } }];
  const receipt = schedule("empty", [state(0, 1, { atSourceUs: 0, x: 30, y: 40 })], p);
  const { reply, output } = movie(receipt, "empty", [], p, gap);
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const raw = join(dir, "empty.rgb");
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
  const frameBytes = 320 * 240 * 3;
  assert.ok(
    readFileSync(raw)
      .subarray(frameBytes, 2 * frameBytes)
      .every((x) => x <= 2),
  );
});
