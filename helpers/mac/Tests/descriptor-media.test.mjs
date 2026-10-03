import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  existsSync,
  writeFileSync,
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
test("descriptor audio fails explicitly at its inspection-byte budget without publishing a partial WAVE", () => {
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

test("inherited audio containers preserve selected PCM after unlink, including ID3 and bare MP3", () => {
  const dir = mkdtempSync(join(tmpdir(), "descriptor-formats-"));
  try {
    for (const [extension, codec] of [["wav", "pcm_f32le"], ["aiff", "pcm_s16be"], ["caf", "pcm_f32le"], ["m4a", "aac"], ["mp3", "libmp3lame"], ["flac", "flac"]]) {
      const source = join(dir, "source." + extension);
      run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=997:sample_rate=48000:duration=2", "-ac", "2", "-c:a", codec, source]);
      const variants = [source];
      if (extension === "mp3") {
        const b = readFileSync(source);
        assert.equal(b.subarray(0, 3).toString(), "ID3");
        const count = 10 + [...b.subarray(6, 10)].reduce((n, v) => n * 128 + v, 0);
        const bare = join(dir, "bare.mp3"); writeFileSync(bare, b.subarray(count)); variants.push(bare);
      }
      if (extension === "flac") {
        const tagged = join(dir, "tagged.flac");
        writeFileSync(tagged, Buffer.concat([Buffer.from([73,68,51,4,0,0,0,0,0,0]), readFileSync(source)])); variants.push(tagged);
      }
      for (const path of variants) {
        const selection = { source: path, sourceOffsetUs: 0, available: [{ startUs: 0, endUs: 2000000 }] };
        const output = path + ".wav", inheritedOutput = path + ".inherited.wav";
        const ordinary = request("media.sourceAudio", { source: selection, range: { startUs: 500000, endUs: 750000 }, output });
        assert.equal(ordinary.ok, true, JSON.stringify(ordinary));
        const fd = openSync(path, "r"); rmSync(path);
        try {
          const inherited = request("media.sourceAudio", { source: { ...selection, source: "/dev/fd/3" }, range: { startUs: 500000, endUs: 750000 }, output: inheritedOutput }, [fd]);
          assert.equal(inherited.ok, true, `${extension}: ${JSON.stringify(inherited)}`);
          assert.deepEqual(readFileSync(inheritedOutput), readFileSync(output));
        } finally { closeSync(fd); }
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("malformed ID3 and sync-looking input fail without publishing selected audio", () => {
  const dir = mkdtempSync(join(tmpdir(), "descriptor-malformed-audio-"));
  try {
    for (const [name, bytes] of [
      ["empty-tag", [73, 68, 51, 4, 0, 0, 0, 0, 0, 0, 0, 0]],
      ["oversize-tag", [73, 68, 51, 4, 0, 0, 127, 127, 127, 127, 0, 0]],
      ["false-sync", [255, 251, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ]) {
      const path = join(dir, name), output = path + ".wav";
      writeFileSync(path, Buffer.from(bytes));
      const fd = openSync(path, "r");
      rmSync(path);
      try {
        const result = request("media.sourceAudio", {
          source: { source: "/dev/fd/3", sourceOffsetUs: 0, available: [] },
          range: { startUs: 0, endUs: 20000 }, output,
        }, [fd]);
        assert.equal(result.ok, false, name);
        assert.equal(result.error.code, "NATIVE_DECODE_FAILED", JSON.stringify(result));
        assert.equal(existsSync(output), false);
      } finally { closeSync(fd); }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("selected source audio fills a renamed WAVE handle after its input is unlinked", () => {
  const dir = mkdtempSync(join(tmpdir(), "descriptor-selected-wave-"));
  let sourceFD, outputFD;
  try {
    const source = join(dir, "source.wav"),
      output = join(dir, "ordinary.wav"),
      inheritedOutput = join(dir, "handle.wav");
    run("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=997:sample_rate=44100:duration=2",
      "-c:a",
      "pcm_f32le",
      source,
    ]);
    const before = readFileSync(source);
    const params = {
      source: { source, sourceOffsetUs: 0, available: [{ startUs: 0, endUs: 2000000 }] },
      range: { startUs: 750000, endUs: 1350000 },
      output,
    };
    const ordinary = request("media.sourceAudio", params);
    assert.equal(ordinary.ok, true, JSON.stringify(ordinary));
    assert.equal(ordinary.data.frames, 26460);
    assert.equal(ordinary.data.sampleRate, 44100);
    assert.equal(ordinary.data.channels, 1);
    sourceFD = openSync(source, "r");
    outputFD = openSync(inheritedOutput, "w+");
    renameSync(inheritedOutput, inheritedOutput + ".moved");
    rmSync(source);
    const inherited = request(
      "media.sourceAudio",
      {
        ...params,
        source: { ...params.source, source: "/dev/fd/3" },
        output: "/dev/fd/4",
      },
      [sourceFD, outputFD],
    );
    assert.equal(inherited.ok, true, JSON.stringify(inherited));
    assert.equal(inherited.data.frames, ordinary.data.frames);
    assert.deepEqual(inherited.data.sampleRange, ordinary.data.sampleRange);
    assert.deepEqual(readFileSync(inheritedOutput + ".moved"), readFileSync(output));
    const pcm = run(
      "ffmpeg",
      ["-v", "error", "-i", inheritedOutput + ".moved", "-f", "f32le", "-"],
      { encoding: null },
    );
    assert.equal(pcm.length, 26460 * 4);
    let peak = 0;
    for (let offset = 0; offset < pcm.length; offset += 4) {
      const sample = pcm.readFloatLE(offset);
      assert.ok(Number.isFinite(sample));
      peak = Math.max(peak, Math.abs(sample));
    }
    assert.ok(peak > 0.05, "Selected WAVE must contain the source tone");
    assert.deepEqual(readFileSync(sourceFD), before);
  } finally {
    if (sourceFD !== undefined) closeSync(sourceFD);
    if (outputFD !== undefined) closeSync(outputFD);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("selected source audio refuses inherited input beyond its inspection byte budget", () => {
  const dir = mkdtempSync(join(tmpdir(), "descriptor-source-budget-"));
  let sourceFD;
  try {
    const source = join(dir, "large.wav"),
      output = join(dir, "output.wav");
    run("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
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
    sourceFD = openSync(source, "r");
    const result = request(
      "media.sourceAudio",
      {
        source: {
          source: "/dev/fd/3",
          sourceOffsetUs: 0,
          available: [{ startUs: 0, endUs: 30000000 }],
        },
        range: { startUs: 0, endUs: 30000000 },
        output,
      },
      [sourceFD],
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "LIMIT_EXCEEDED");
    assert.match(result.error.message, /byte budget/);
    assert.equal(existsSync(output), false);
    assert.deepEqual(readdirSync(dir), ["large.wav"]);
  } finally {
    if (sourceFD !== undefined) closeSync(sourceFD);
    rmSync(dir, { recursive: true, force: true });
  }
});
