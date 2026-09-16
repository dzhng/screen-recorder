import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  openSync,
  closeSync,
  readFileSync,
  rmSync,
  renameSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
const native =
  process.env.SCREENREC_NATIVE ??
  new URL("../.build/debug/screenrec-native", import.meta.url).pathname;
function run(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: "utf8", timeout: 30000, ...options });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
function request(operation, params, fds = []) {
  return JSON.parse(
    run(native, [], {
      input: JSON.stringify({ id: "descriptor", operation, params }) + "\n",
      stdio: ["pipe", "pipe", "pipe", ...fds],
    }),
  );
}
test("inherited video and PNG handles preserve ordinary-path frame bytes after source rename", () => {
  const dir = mkdtempSync(join(tmpdir(), "descriptor-frame-"));
  let sourceFD, outputFD;
  try {
    const source = join(dir, "source.mov"),
      pathOutput = join(dir, "ordinary.png"),
      fdOutput = join(dir, "handle.png");
    run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=160x90:rate=10:duration=2",
      "-c:v",
      "libx264",
      source,
    ]);
    const params = {
      source,
      output: pathOutput,
      atSourceUs: 1150000,
      kept: { startUs: 750000, endUs: 1750000 },
      overlay: {
        trailUs: 500000,
        trail: [
          [
            { atSourceUs: 900000, x: 20, y: 40 },
            { atSourceUs: 1100000, x: 60, y: 50 },
          ],
        ],
        pointer: { atSourceUs: 1100000, x: 60, y: 50 },
      },
    };
    const ordinary = request("media.frame", params);
    assert.equal(ordinary.ok, true, JSON.stringify(ordinary));
    sourceFD = openSync(source, "r");
    outputFD = openSync(fdOutput, "w+");
    renameSync(fdOutput, fdOutput + ".moved");
    renameSync(source, join(dir, "moved.mov"));
    const inherited = request(
      "media.frame",
      { ...params, source: "/dev/fd/3", output: "/dev/fd/4" },
      [sourceFD, outputFD],
    );
    assert.equal(inherited.ok, true, JSON.stringify(inherited));
    assert.equal(inherited.data.actualSourceUs, ordinary.data.actualSourceUs);
    assert.deepEqual(readFileSync(fdOutput + ".moved"), readFileSync(pathOutput));
    const alias = request("media.frame", { ...params, source: "/dev/fd/3", output: "/dev/fd/3" }, [
      sourceFD,
    ]);
    assert.equal(alias.error.code, "INVALID_OUTPUT");
  } finally {
    if (sourceFD !== undefined) closeSync(sourceFD);
    if (outputFD !== undefined) closeSync(outputFD);
    rmSync(dir, { recursive: true, force: true });
  }
});
test("inherited audio input and WAVE output preserve concatenated PCM after source unlink", () => {
  const dir = mkdtempSync(join(tmpdir(), "descriptor-audio-"));
  let sourceFD, outputFD;
  try {
    const source = join(dir, "source.wav"),
      ordinaryOutput = join(dir, "ordinary.wav"),
      fdOutput = join(dir, "handle.wav");
    run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=997:sample_rate=44100:duration=2",
      "-c:a",
      "pcm_f32le",
      source,
    ]);
    const params = {
      output: ordinaryOutput,
      spans: [
        { startUs: 750000, endUs: 900000 },
        { startUs: 1100000, endUs: 1350000 },
      ],
      tracks: [
        {
          role: "narration",
          source,
          sourceOffsetUs: 0,
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    };
    const ordinary = request("media.audio", params);
    assert.equal(ordinary.ok, true, JSON.stringify(ordinary));
    sourceFD = openSync(source, "r");
    outputFD = openSync(fdOutput, "w+");
    renameSync(fdOutput, fdOutput + ".moved");
    rmSync(source);
    const inherited = request(
      "media.audio",
      { ...params, output: "/dev/fd/4", tracks: [{ ...params.tracks[0], source: "/dev/fd/3" }] },
      [sourceFD, outputFD],
    );
    assert.equal(inherited.ok, true, JSON.stringify(inherited));
    assert.equal(inherited.data.frames, ordinary.data.frames);
    assert.deepEqual(readFileSync(fdOutput + ".moved"), readFileSync(ordinaryOutput));
    const pcm = (file) =>
      run("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-"], { encoding: null });
    assert.deepEqual(pcm(fdOutput + ".moved"), pcm(ordinaryOutput));
  } finally {
    if (sourceFD !== undefined) closeSync(sourceFD);
    if (outputFD !== undefined) closeSync(outputFD);
    rmSync(dir, { recursive: true, force: true });
  }
});
test("descriptor audio fails explicitly at its delivered-byte budget without publishing a partial WAVE", () => {
  const dir = mkdtempSync(join(tmpdir(), "descriptor-budget-"));
  let fd;
  try {
    const source = join(dir, "large.wav"),
      output = join(dir, "output.wav");
    run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=192000:cl=stereo",
      "-t",
      "30",
      "-c:a",
      "pcm_f64le",
      source,
    ]);
    fd = openSync(source, "r");
    const result = request(
      "media.audio",
      {
        output,
        spans: [{ startUs: 0, endUs: 30000000 }],
        tracks: [
          {
            role: "narration",
            source: "/dev/fd/3",
            sourceOffsetUs: 0,
            available: [{ startUs: 0, endUs: 30000000 }],
          },
        ],
      },
      [fd],
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "LIMIT_EXCEEDED");
    assert.match(result.error.message, /byte budget/);
    assert.equal(existsSync(output), false);
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(dir, { recursive: true, force: true });
  }
});
