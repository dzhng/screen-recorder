import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createCompiler,
  validateComposition,
  resolveOutputSettings,
} from "../../../packages/composition/dist/index.js";

function verifyOutput(t, name) {
  const evidence = process.env.SCREENREC_HEVC_EVIDENCE;
  const directory = evidence
    ? join(evidence, name)
    : mkdtempSync(join(tmpdir(), "screenrec-hevc-"));
  if (evidence) mkdirSync(directory, { recursive: true });
  else t.after(() => rmSync(directory, { recursive: true, force: true }));
  let source = new URL(
    `../../../specs/done/agent-editing/assets/00-corpus/${name === "bframes" ? "a" : name}.mov`,
    import.meta.url,
  ).pathname;
  if (name === "bframes") {
    const encoded = join(directory, "bframes.mp4");
    const result = spawnSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-i",
        source,
        "-map",
        "0:v:0",
        "-c:v",
        "libx264",
        "-bf",
        "2",
        "-g",
        "24",
        encoded,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    source = encoded;
  }
  const native =
    process.env.SCREENREC_NATIVE ??
    new URL("../.build/debug/screenrec-native", import.meta.url).pathname;
  const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
  const before = hash(source);
  const report = { sourceSha256: before, nativeSha256: hash(native), operands: {} };
  const invoke = (command, args, options = {}) => {
    const value = spawnSync(command, args, {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
      ...options,
    });
    assert.ifError(value.error);
    assert.equal(value.status, 0, value.stderr);
    return value.stdout;
  };
  let sequence = 0;
  const call = (operation, params) => {
    const request = JSON.stringify({ id: String(++sequence), operation, params }) + "\n";
    writeFileSync(join(directory, `request-${sequence}.json`), request);
    const response = invoke(native, [], { input: request });
    writeFileSync(join(directory, `reply-${sequence}.json`), response);
    const result = JSON.parse(response);
    assert.equal(result.ok, true, response);
    return result.data;
  };
  const audioFile = join(directory, "impulse.wav");
  const wave = Buffer.alloc(44 + 48000 * 8);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(3, 20);
  wave.writeUInt16LE(2, 22);
  wave.writeUInt32LE(48000, 24);
  wave.writeUInt32LE(48000 * 8, 28);
  wave.writeUInt16LE(8, 32);
  wave.writeUInt16LE(32, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(wave.length - 44, 40);
  wave.writeFloatLE(0.8, 44 + 4800 * 8);
  wave.writeFloatLE(0.4, 44 + 4800 * 8 + 4);
  writeFileSync(audioFile, wave);
  const assets = [],
    bindings = [];
  for (const [id, path, kind] of [
    ["v", source, "video"],
    ["a", audioFile, "audio"],
  ]) {
    const probe = call("media.probe", { path });
    const stream = probe.streams.find((stream) => stream.kind === kind);
    assets.push({
      id,
      streams: [
        {
          id: stream.id,
          kind,
          ...(kind === "video"
            ? { width: stream.orientedWidth, height: stream.orientedHeight }
            : { sampleRate: stream.sampleRate, channels: stream.channels }),
          bounds: { startUs: stream.startUs, endUs: stream.endUs },
          available: stream.segments
            .filter((segment) => !segment.empty)
            .map(({ startUs, endUs }) => ({ startUs, endUs })),
        },
      ],
    });
    bindings.push({ assetId: id, streamId: stream.id, path, originUs: probe.originUs });
  }
  const sourceMetadata = JSON.parse(
    invoke("ffprobe", ["-v", "error", "-show_streams", "-of", "json", source]),
  );
  report.sourceMetadata = sourceMetadata;
  if (name === "bframes") assert.ok(sourceMetadata.streams[0].has_b_frames > 0);
  const capabilities = call("media.outputCapabilities", {});
  assert.equal(capabilities.hevc.ready, true);
  report.capabilities = capabilities;
  const picture = assets[0].streams[0];
  const canvas = {
    width: picture.width,
    height: picture.height,
    fps: { numerator: 8, denominator: 1 },
    background: "#000000ff",
  };
  const document = {
    canvas,
    tracks: [
      { id: "v", kind: "video", order: 0 },
      { id: "a", kind: "audio", order: 0 },
    ],
    groups: [],
    syncGroups: [],
    processing: [],
    clips: bindings.map((binding, i) => ({
      id: binding.assetId,
      assetId: binding.assetId,
      streamId: binding.streamId,
      trackId: binding.assetId,
      source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
      placement: {
        kind: "project",
        range: { startUs: i ? 250000 : 0, endUs: i ? 1250000 : 1000000 },
      },
    })),
  };
  const range = { startUs: 160001, endUs: 610007 };
  const window = createCompiler(validateComposition(document, assets), "hevc-fixture").window({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  const frames = [...window.frames()];
  const frameFile = join(directory, "frames.jsonl");
  writeFileSync(frameFile, frames.map((frame) => JSON.stringify(frame)).join("\n") + "\n");
  for (const codec of ["h264", "hevc"]) {
    const output = join(directory, codec + ".mp4");
    const request = {
      output,
      frames: frameFile,
      range,
      canvas,
      settings: resolveOutputSettings({ video: { codec } }),
      processing: window.processing(),
      assets: bindings,
      audio: { range: window.manifest.sampleRange, clips: [...window.audio()] },
    };
    const requestFile = join(directory, codec + "-request.json");
    writeFileSync(requestFile, JSON.stringify(request, null, 2));
    const receipt = call("media.renderCompositionMovie", request);
    writeFileSync(output + ".json", JSON.stringify(receipt, null, 2));
    const probe = JSON.parse(
      invoke("ffprobe", ["-v", "error", "-show_streams", "-show_frames", "-of", "json", output]),
    );
    report.operands[codec] = { request, receipt, probe, sha256: hash(output) };
    writeFileSync(join(directory, "report.json"), JSON.stringify(report, null, 2));
    const stream = probe.streams.find((stream) => stream.codec_type === "video");
    assert.equal(stream.codec_name, codec);
    assert.equal(stream.profile, codec === "hevc" ? "Main" : "High");
    assert.equal(stream.color_primaries, "bt709");
    assert.equal(stream.color_transfer, "bt709");
    assert.equal(stream.color_space, "bt709");
    assert.equal(Math.round(Number(stream.duration) * 1000000), 450006);
    assert.deepEqual(
      probe.frames
        .filter((frame) => frame.media_type === "video")
        .map((frame) => Math.round(Number(frame.best_effort_timestamp_time) * 1000000)),
      [0, 89999, 214999, 339999],
    );
    assert.deepEqual(resolveOutputSettings(receipt.settings), request.settings);
    assert.equal(receipt.encodedVideo.profile, request.settings.video.profile);
    assert.equal(receipt.durationUs, 450006);
    assert.equal(receipt.frameCount, 4);
    assert.equal(receipt.codec, codec);
    const audioStream = probe.streams.find((stream) => stream.codec_type === "audio");
    assert.equal(audioStream.codec_name, "aac");
    assert.equal(audioStream.duration_ts, 21600);
    const pcm = invoke(
      "ffmpeg",
      ["-v", "error", "-i", output, "-map", "0:a:0", "-f", "f32le", "-"],
      { encoding: "buffer" },
    );
    assert.ok(pcm.length / 8 >= 21600 && pcm.length / 8 - 21600 < 1024);
    const markers = [0, 1].map((channel) => {
      let peak = 0,
        position = -1;
      for (let i = 0; i < pcm.length / 8; i++) {
        const value = Math.abs(pcm.readFloatLE(i * 8 + channel * 4));
        if (value > peak) {
          peak = value;
          position = i;
        }
      }
      assert.ok(peak > (channel ? 0.1 : 0.2));
      assert.ok(Math.abs(position - 9120) <= 2, `${codec} channel ${channel} marker ${position}`);
      return { peak, position };
    });
    report.operands[codec].audioMarkers = markers;
    report.operands[codec].decodedAudioFrames = pcm.length / 8;
    writeFileSync(join(directory, "report.json"), JSON.stringify(report, null, 2));
    invoke("ffmpeg", [
      "-v",
      "error",
      "-i",
      output,
      "-frames:v",
      "1",
      join(directory, codec + ".png"),
    ]);
  }
  assert.equal(hash(source), before);
}
for (const name of ["a", "orientation", "timestamp-gap", "bframes"])
  test(`native HEVC Main ${name} preserves clipped frames, delayed AAC and SDR`, (t) =>
    verifyOutput(t, name));
