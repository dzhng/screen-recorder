import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createCompiler, validateComposition } from "../../composition/dist/index.js";
const native = process.env.SCREENREC_NATIVE;
assert(native);
const scratch = mkdtempSync(join(tmpdir(), "sr-composition-movie-"));
let sequence = 0;
function run(command, args, input) {
  const r = spawnSync(command, args, {
    input,
    timeout: 60000,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr.toString());
  return r.stdout;
}
function call(operation, params, expected) {
  const response = JSON.parse(
    run(native, [], JSON.stringify({ id: String(++sequence), operation, params }) + "\n"),
  );
  if (expected) {
    assert.equal(response.error?.code, expected, JSON.stringify(response));
    return;
  }
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.data;
}
function ff(...args) {
  return run("ffmpeg", ["-v", "error", "-nostdin", ...args]);
}
function movieClock(path, durationUs) {
  let scale, duration;
  const edits = [];
  function boxes(bytes) {
    for (let i = 0; i + 8 <= bytes.length;) {
      let size = bytes.readUInt32BE(i),
        header = 8;
      const type = bytes.toString("ascii", i + 4, i + 8);
      if (size === 1) {
        size = Number(bytes.readBigUInt64BE(i + 8));
        header = 16;
      }
      if (size === 0) size = bytes.length - i;
      assert(size >= header && i + size <= bytes.length);
      const body = bytes.subarray(i + header, i + size);
      if (["moov", "trak", "edts"].includes(type)) boxes(body);
      if (type === "mvhd") {
        const offset = body[0] ? 20 : 12;
        scale = BigInt(body.readUInt32BE(offset));
        duration = body[0]
          ? body.readBigUInt64BE(offset + 4)
          : BigInt(body.readUInt32BE(offset + 4));
      }
      if (type === "elst") {
        let total = 0n;
        for (let entry = 0; entry < body.readUInt32BE(4); entry++) {
          const offset = 8 + entry * (body[0] ? 20 : 12);
          total += body[0] ? body.readBigUInt64BE(offset) : BigInt(body.readUInt32BE(offset));
        }
        edits.push(total);
      }
      i += size;
    }
  }
  boxes(readFileSync(path));
  assert(scale && duration && edits.length > 0);
  assert.equal(duration * 1000000n, BigInt(durationUs) * scale);
  for (const edit of edits) assert.equal(edit, duration);
  return {
    timescale: Number(scale),
    durationTicks: Number(duration),
    editLists: edits.length,
  };
}
const checks = [];
try {
  const tone = join(scratch, "tone.wav");
  ff("-f", "lavfi", "-i", "aevalsrc=0.1*sin(2*PI*997*t):s=44100:d=2", "-c:a", "pcm_s16le", tone);
  const picture = new URL("../../../specs/agent-editing/assets/00-corpus/a.mov", import.meta.url)
    .pathname;
  const bindings = [],
    assets = [];
  for (const [id, path, kind] of [
    ["picture", picture, "video"],
    ["tone", tone, "audio"],
  ]) {
    const probe = call("media.probe", { path });
    assets.push({
      id,
      streams: probe.streams.map((s) => ({
        id: s.id,
        kind: s.kind,
        ...(s.kind === "video" ? { width: s.orientedWidth, height: s.orientedHeight } : {}),
        bounds: { startUs: s.startUs, endUs: s.endUs },
        available: s.segments
          ?.filter((segment) => !segment.empty)
          .map(({ startUs, endUs }) => ({ startUs, endUs })) ?? [
          { startUs: s.startUs, endUs: s.endUs },
        ],
      })),
    });
    bindings.push({
      assetId: id,
      streamId: probe.streams.find((s) => s.kind === kind).id,
      path,
      originUs: probe.originUs,
    });
  }
  const document = {
    canvas: {
      width: 160,
      height: 128,
      fps: { numerator: 20, denominator: 1 },
      background: "#000000ff",
    },
    tracks: [
      { id: "v", kind: "video", order: 0 },
      { id: "a", kind: "audio", order: 0 },
    ],
    groups: [],
    syncGroups: [],
    captions: [],
    clips: bindings.map((b, i) => ({
      id: b.assetId,
      assetId: b.assetId,
      streamId: b.streamId,
      trackId: i ? "a" : "v",
      source: {
        kind: "range",
        range: { startUs: i ? 500001 : 0, endUs: i ? 1500001 : 1000000 },
      },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    })),
    processing: [
      {
        target: { kind: "output" },
        steps: [{ id: "gain", enabled: true, processor: { type: "gain", gain: 0.5 } }],
      },
    ],
  };
  for (const range of [
    { startUs: 0, endUs: 1000000 },
    { startUs: 123457, endUs: 812349 },
    { startUs: 1, endUs: 2 },
  ]) {
    const compiler = createCompiler(validateComposition(document, assets), "movie-fixture");
    const window = compiler.window({
      range,
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    const frames = join(scratch, `frames-${sequence}.jsonl`);
    writeFileSync(
      frames,
      [...window.frames()].map((frame) => JSON.stringify(frame) + "\n").join(""),
    );
    const base = {
      frames,
      range,
      canvas: document.canvas,
      profile: "h264-rec709",
      processing: window.manifest.processing,
      assets: bindings,
    };
    const audio = {
      range: {
        start: Math.floor((range.startUs * 48000) / 1000000),
        end: Math.floor((range.endUs * 48000) / 1000000),
      },
      clips: [...window.audio()],
    };
    const output = join(scratch, `movie-${sequence}.mp4`);
    const result = call("media.renderCompositionMovie", {
      ...base,
      output,
      audio,
    });
    assert.equal(result.durationUs, range.endUs - range.startUs);
    if (audio.range.start === audio.range.end) {
      assert.equal(result.audio, undefined);
      const probe = JSON.parse(
        run("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_name",
          "-of",
          "json",
          output,
        ]),
      );
      assert.deepEqual(
        probe.streams.map((s) => s.codec_name),
        ["h264"],
      );
      checks.push({
        range,
        frames: 0,
        videoOnly: true,
        clock: movieClock(output, result.durationUs),
      });
      continue;
    }
    assert.equal(result.audio.frames, audio.range.end - audio.range.start);
    const standaloneVideo = call("media.renderCompositionVideo", {
      ...base,
      output: join(scratch, `video-${sequence}.mp4`),
    });
    const compressed = (path) =>
      ff(
        "-i",
        path,
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
        "-bsf:v",
        "filter_units=remove_types=6",
        "-f",
        "data",
        "pipe:1",
      );
    assert.deepEqual(
      compressed(output),
      compressed(standaloneVideo.file),
      "Movie picture NAL units must match independent H264 render (excluding encoder SEI timestamps)",
    );
    const standaloneAudio = call("media.mixCompositionAudio", {
      ...audio,
      output: join(scratch, `audio-${sequence}.wav`),
      processing: base.processing,
      assets: bindings,
    });
    const decode = (path) =>
      ff("-i", path, "-map", "0:a:0", "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1");
    const reference = decode(standaloneAudio.file),
      decoded = decode(output);
    assert(decoded.length >= reference.length, "AAC must cover the requested PCM samples");
    let error = 0,
      energy = 0;
    for (let i = 2048; i < reference.length / 4 - 2048; i++) {
      const expected = reference.readFloatLE(i * 4),
        actual = decoded.readFloatLE(i * 4);
      error += (actual - expected) ** 2;
      energy += expected ** 2;
    }
    assert(Math.sqrt(error / energy) < 0.08, `AAC signal error ${Math.sqrt(error / energy)}`);
    const probe = JSON.parse(
      run("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_name,codec_type,sample_rate,channels,duration,duration_ts,time_base",
        "-of",
        "json",
        output,
      ]),
    );
    const clock = movieClock(output, result.durationUs);
    assert.equal(
      Number(probe.streams.find((s) => s.codec_type === "video").duration),
      result.durationUs / 1000000,
    );
    assert(Math.abs(Number(probe.format.duration) - result.durationUs / 1000000) <= 1 / 48000);
    assert.deepEqual(probe.streams.map((s) => s.codec_name).sort(), ["aac", "h264"]);
    checks.push({
      range,
      frames: result.audio.frames,
      aacRelativeRmsError: Math.sqrt(error / energy),
      unchangedPictureNALUnits: true,
      clock,
      externalProbe: probe,
    });
    const invalidOutput = join(scratch, `invalid-${sequence}.mp4`);
    call(
      "media.renderCompositionMovie",
      {
        ...base,
        output: invalidOutput,
        audio: {
          ...audio,
          range: { ...audio.range, start: audio.range.start + 1 },
        },
      },
      "INVALID_REQUEST",
    );
    assert(!existsSync(invalidOutput));
    call(
      "media.renderCompositionMovie",
      { ...base, output: invalidOutput, audio: { ...audio, unexpected: true } },
      "INVALID_REQUEST",
    );
    assert(!existsSync(invalidOutput));
  }
  const cancelRange = { startUs: 0, endUs: 100000000 };
  const empty = { ...document, tracks: [], clips: [], processing: [] };
  const cancelWindow = createCompiler(validateComposition(empty, []), "cancel").window({
    range: cancelRange,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  const cancelFrames = join(scratch, "cancel-frames.jsonl"),
    cancelRequest = join(scratch, "cancel-request.json");
  writeFileSync(
    cancelFrames,
    [...cancelWindow.frames()].map((frame) => JSON.stringify(frame) + "\n").join(""),
  );
  writeFileSync(
    cancelRequest,
    JSON.stringify({
      output: join(scratch, "cancel.mp4"),
      frames: cancelFrames,
      range: cancelRange,
      canvas: empty.canvas,
      profile: "h264-rec709",
      processing: cancelWindow.manifest.processing,
      assets: [],
      audio: { range: { start: 0, end: 4800000 }, clips: [] },
    }),
  );
  const cancellation = run(join(dirname(native), "ScreenRecorderCompositionVideoTests"), [
    cancelRequest,
    "media.renderCompositionMovie",
  ])
    .toString()
    .trim();
  assert(cancellation.startsWith("PASS"));
  checks.push({ cancellation });
  assert(
    readdirSync(scratch).every((name) => !name.startsWith(".screenrec-output-")),
    "Attempt scratch must be cleaned",
  );
  console.log(
    JSON.stringify({ nativeProductionEntry: true, liveMediaJourney: false, checks }, null, 2),
  );
} finally {
  if (process.env.SCREENREC_KEEP_TEST_FILES) console.error(scratch);
  else rmSync(scratch, { recursive: true, force: true });
}
