import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { processingTapSchema } from "../../../packages/composition/dist/index.js";
import { waveformBuckets } from "../../../packages/core/dist/audio-wave.js";
import { spectralWindows } from "../../../packages/core/dist/audio-spectrum.js";
import { acousticImageRequest } from "../../../packages/core/dist/acoustic-image.js";
const native =
  process.env.YAP_NATIVE ??
  new URL("../.build/debug/yap-native", import.meta.url).pathname;
function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    timeout: 60000,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  assert.equal(result.status, 0, String(result.stderr || result.error));
  return result.stdout;
}
test("acoustic measurement files reject oversized data, links and non-files before rendering", () => {
  const dir = mkdtempSync(join(tmpdir(), "acoustic-input-"));
  try {
    const call = (input) =>
      JSON.parse(
        run(native, [], {
          input:
            JSON.stringify({ id: "bounds", operation: "media.acousticImage", params: { input } }) +
            "\n",
          encoding: "utf8",
        }),
      );
    const large = join(dir, "large.json");
    writeFileSync(large, "{}");
    truncateSync(large, 16 * 1024 * 1024 + 1);
    assert.equal(call(large).error.code, "LIMIT_EXCEEDED");
    const target = join(dir, "request.json");
    writeFileSync(target, "{}");
    symlinkSync(target, join(dir, "link.json"));
    assert.equal(call(join(dir, "link.json")).error.code, "INVALID_REQUEST");
    assert.equal(call(dir).error.code, "INVALID_REQUEST");
    assert.equal(call("relative.json").error.code, "INVALID_REQUEST");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("actual waveform and spectral PNGs preserve absolute sample axes, channel identity and narrow energy", async () => {
  const dir =
    process.env.YAP_ACOUSTIC_EVIDENCE ?? mkdtempSync(join(tmpdir(), "acoustic-image-"));
  mkdirSync(dir, { recursive: true });
  try {
    const rate = 48000,
      start = 96013,
      frames = 12000,
      bytes = Buffer.alloc(44 + frames * 8);
    bytes.write("RIFF");
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write("WAVEfmt ", 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(3, 20);
    bytes.writeUInt16LE(2, 22);
    bytes.writeUInt32LE(rate, 24);
    bytes.writeUInt32LE(rate * 8, 28);
    bytes.writeUInt16LE(8, 32);
    bytes.writeUInt16LE(32, 34);
    bytes.write("data", 36);
    bytes.writeUInt32LE(frames * 8, 40);
    for (let i = 0; i < frames; i++) {
      bytes.writeFloatLE(0.125 * Math.cos((2 * Math.PI * 750 * i) / rate), 44 + i * 8);
      bytes.writeFloatLE(
        i + start === 102000 ? 2 : 0.0625 * Math.cos((2 * Math.PI * 3000 * i) / rate),
        48 + i * 8,
      );
    }
    writeFileSync(join(dir, "reference.wav"), bytes);
    const reader = {
      bytes: bytes.length,
      read(buffer, position) {
        buffer.set(bytes.subarray(position, position + buffer.length));
        return buffer.length;
      },
      release() {},
    };
    const audio = {
      bytes: bytes.length,
      channels: 2,
      sampleRate: rate,
      frames,
      sampleRange: { start, end: start + frames },
    };
    const metadata = {
      ...audio,
      domain: "source",
      assetId: "fixture-stereo",
      streamId: "track:1",
      supportDigest: "fixture-support-v1",
      audio: { jobId: "fixture-pcm", generation: 2 },
      unavailable: [{ startUs: 2020000, endUs: 2030000 }],
    };
    let ordinal = 0;
    const calls = [];
    function call(params) {
      const input = join(dir, `request-${ordinal}.json`);
      writeFileSync(input, JSON.stringify(params));
      const reply = JSON.parse(
        run(native, [], {
          input:
            JSON.stringify({
              id: `plot-${ordinal++}`,
              operation: "media.acousticImage",
              params: { input },
            }) + "\n",
          encoding: "utf8",
        }),
      );
      calls.push({ params, reply });
      return reply;
    }
    function raster(reply) {
      assert.equal(reply.ok, true, JSON.stringify(reply));
      assert.equal(reply.data.bytes, readFileSync(reply.data.file).length);
      const pixels = run("ffmpeg", [
        "-v",
        "error",
        "-i",
        reply.data.file,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
      ]);
      assert.equal(pixels.length, reply.data.width * reply.data.height * 3);
      return (x, y) => [
        ...pixels.subarray(
          (Math.floor(y) * reply.data.width + Math.floor(x)) * 3,
          (Math.floor(y) * reply.data.width + Math.floor(x)) * 3 + 3,
        ),
      ];
    }
    const signal = new AbortController().signal;
    const wave = await waveformBuckets(reader, audio, { bucketFrames: 48 }, signal);
    const waveRequest = acousticImageRequest(
      metadata,
      { kind: "waveform", data: wave },
      join(dir, "waveform.png"),
    );
    assert.deepEqual(waveRequest.unavailable, [{ start: 96960, end: 97440 }]);
    const waveReply = call(waveRequest),
      pixel = raster(waveReply);
    assert.equal(waveReply.data.amplitudeLimit, 2.1);
    const impulseX = 92 + ((102000 - start) / frames) * 1080;
    // Top-left raster: second channel's upper lobe contains the known impulse, first stays quiet there.
    assert.ok(
      pixel(impulseX + 1, 420)[2] < 230,
      `missing second-channel impulse: ${pixel(impulseX + 1, 420)}`,
    );
    assert.ok(pixel(impulseX + 1, 176)[0] > 240, "channels were mixed");
    assert.equal(call(waveRequest).error.code, "INVALID_OUTPUT");
    const spectrum = await spectralWindows(
      reader,
      audio,
      { fftFrames: 256, hopFrames: 128 },
      signal,
    );
    const spectrumRequest = acousticImageRequest(
      metadata,
      { kind: "spectrum", data: spectrum },
      join(dir, "spectrum.png"),
    );
    const spectralReply = call(spectrumRequest),
      spectralPixel = raster(spectralReply);
    const y = (channel, hz) => 164 + channel * 244 + 180 * (1 - hz / 24000);
    assert.ok(
      spectralPixel(300, y(0, 750))[0] > spectralPixel(300, y(0, 3000))[0] + 60,
      "left tone frequency moved",
    );
    assert.ok(
      spectralPixel(300, y(1, 3000))[0] > spectralPixel(300, y(1, 750))[0] + 60,
      "right tone frequency moved",
    );
    const range = { start: 101501, end: 103099 };
    const detail = await waveformBuckets(
      reader,
      audio,
      { bucketFrames: 48, sampleRange: range },
      signal,
    );
    const projectMetadata = {
      ...metadata,
      domain: "project",
      projectId: "fixture-project",
      revisionId: "revision-7",
      tap: {
        target: {
          kind: "clip",
          id: "f5b348fd-08dd-4d57-a985-33c635a970bb",
        },
        point: {
          kind: "after-step",
          stepId: "f215024a-95d8-4f54-94ba-72544cad4b16",
        },
      },
      unavailable: [
        { clipId: "first", ranges: [{ start: 101700, end: 101800 }] },
        { clipId: "second", ranges: [{ start: 101750, end: 101850 }] },
      ],
    };
    const detailRequest = acousticImageRequest(
      projectMetadata,
      { kind: "waveform", data: detail },
      join(dir, "detail.png"),
    );
    assert.deepEqual(detailRequest.unavailable, [{ start: 101700, end: 101850 }]);
    assert.equal(detailRequest.domain, "project");
    assert.throws(
      () =>
        acousticImageRequest(
          { ...metadata, sampleRate: 44100 },
          { kind: "waveform", data: detail },
          "unused",
        ),
      /provenance/,
    );
    const detailReply = call(
      acousticImageRequest(
        projectMetadata,
        { kind: "waveform", data: detail },
        join(dir, "detail.png"),
      ),
    );
    const detailPixel = raster(detailReply),
      detailX = 92 + ((102000 - range.start) / (range.end - range.start)) * 1080;
    assert.ok(detailPixel(detailX + 1, 420)[2] < 230, "excerpt impulse lost its absolute clock");
    processingTapSchema.parse(projectMetadata.tap);
    const longMetadata = {
      ...projectMetadata,
      tap: {
        target: { kind: "clip", id: "long-" + "x".repeat(600) + "\nend" },
        point: { kind: "processed" },
      },
    };
    processingTapSchema.parse(longMetadata.tap);
    const longRequest = acousticImageRequest(
      longMetadata,
      { kind: "waveform", data: detail },
      join(dir, "long-provenance.png"),
    );
    const longReply = call(longRequest);
    raster(longReply);
    assert.deepEqual(longReply.data.provenance, longRequest.provenance);
    for (const [name, columns, bins, column, bin] of [
      ["subpixel-time", 4096, 9, 2000, 4],
      ["subpixel-frequency", 9, 4097, 4, 1507],
    ]) {
      const request = {
        ...spectrumRequest,
        output: join(dir, name + ".png"),
        channels: 1,
        range: { start: 0, end: columns },
        bins,
        binHz: rate / 2 / (bins - 1),
        unavailable: [],
        provenance: [
          "Synthetic narrow-cell raster control",
          "One nonzero time/frequency cell; all others zero",
        ],
        columns: Array.from({ length: columns }, (_, c) => ({
          range: { start: c, end: c + 1 },
          partial: false,
          values: [Array.from({ length: bins }, (_, b) => (c === column && b === bin ? 0.01 : 0))],
        })),
      };
      const densePixel = raster(call(request));
      const px = 92 + Math.floor((column / columns) * 1080);
      const py = 164 + 179 - Math.floor((bin / (bins - 1)) * 180);
      assert.ok(
        densePixel(px, py)[0] > 180,
        `${name} lost the only energy cell at ${px},${py}: ${densePixel(px, py)}`,
      );
    }
    const contextSpectrum = await spectralWindows(
      reader,
      audio,
      {
        fftFrames: 512,
        hopFrames: 256,
        sampleRange: { start: 99072, end: 99584 },
      },
      new AbortController().signal,
    );
    const contextRequest = acousticImageRequest(
      {
        ...metadata,
        unavailable: [],
        context: {
          range: metadata.range,
          sampleRange: audio.sampleRange,
          unavailable: [{ startUs: 2061667, endUs: 2063541 }],
        },
      },
      { kind: "spectrum", data: contextSpectrum },
      join(dir, "context-support.png"),
    );
    assert.deepEqual(
      contextRequest.columns.map((c) => c.partial),
      [true, false],
    );
    assert.deepEqual(contextRequest.unavailable, []);
    const contextPixel = raster(call(contextRequest));
    const orange = ([r, g, b]) => r > 200 && g > 90 && g < 160 && b < 50;
    assert.ok(
      orange(contextPixel(300, 166)),
      "Missing surrounding support must mark its spectral column",
    );
    assert.equal(
      orange(contextPixel(900, 166)),
      false,
      "Fully supported neighboring column must remain unmarked",
    );
    const bad = structuredClone(waveRequest);
    bad.output = join(dir, "bad.png");
    bad.columns[1].range.start++;
    assert.equal(call(bad).error.code, "INVALID_REQUEST");
    writeFileSync(join(dir, "requests.json"), JSON.stringify(calls, null, 2));
    writeFileSync(
      join(dir, "report.json"),
      JSON.stringify(
        {
          impulseSample: 102000,
          impulseSeconds: 2.125,
          impulseX,
          detailX,
          waveform: waveReply.data,
          spectrum: spectralReply.data,
        },
        null,
        2,
      ),
    );
  } finally {
    if (!process.env.YAP_ACOUSTIC_EVIDENCE) rmSync(dir, { recursive: true, force: true });
  }
});
