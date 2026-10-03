import assert from "node:assert/strict";
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const [worker, destination] = process.argv.slice(2);
assert.ok(worker && destination, "usage: node audio-file.mjs WORKER EMPTY_EVIDENCE_DIRECTORY");
const out = resolve(destination);
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), []);
const frames = 96017;
const wav = Buffer.alloc(44 + frames * 8);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(3, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(384000, 28);
wav.writeUInt16LE(8, 32);
wav.writeUInt16LE(32, 34);
wav.write("data", 36);
wav.writeUInt32LE(frames * 8, 40);
const value = (i, c, rate) =>
  c === 0
    ? 0.4 * Math.sin((2 * Math.PI * 440 * i) / rate) +
      0.12 * Math.cos((2 * Math.PI * 1331 * i) / rate)
    : 0.13 * Math.cos((2 * Math.PI * 997 * i) / rate);
for (let i = 0; i < frames; i++)
  for (let c = 0; c < 2; c++) wav.writeFloatLE(value(i, c, 48000), 44 + i * 8 + c * 4);
const source = join(out, "source.wav");
writeFileSync(source, wav);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const originalHash = sha(wav);
const report = { passed: false, workerSha256: sha(readFileSync(worker)), cases: [], invalid: [] };
function processRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function call(id, operation, params, file = source) {
  const fd = openSync(file, "r");
  const request = { id, operation, params };
  let reply;
  try {
    reply = JSON.parse(
      processRun(worker, [], {
        input: JSON.stringify(request) + "\n",
        stdio: ["pipe", "pipe", "pipe", fd],
      }),
    );
  } finally {
    closeSync(fd);
  }
  return { request, reply };
}
function settings(sampleRate = 48000, layout = "stereo", mode = "constant") {
  return {
    container: "m4a",
    audio: {
      codec: "aac",
      sampleRate,
      layout,
      rateControl:
        mode === "variable"
          ? { mode, bitrate: null, quality: "high" }
          : { mode, bitrate: layout === "stereo" ? 192000 : 96000, quality: null },
      quality: "high",
    },
  };
}
const input = { sampleRate: 48000, channels: 2, frames };
try {
  for (const rate of [48000, 44100])
    for (const layout of ["stereo", "mono"])
      for (const mode of ["constant", "long-term-average", "constrained-variable", "variable"])
        for (const quality of mode === "variable"
          ? ["min", "low", "medium", "high", "max"]
          : ["high"]) {
          const id = `${rate}-${layout}-${mode}-${quality}`,
            resolved = settings(rate, layout, mode),
            file = join(out, id + ".m4a");
          if (mode === "variable") resolved.audio.rateControl.quality = quality;
          const validation = call(id + "-validate", "media.validateAudioOutput", {
            settings: resolved,
          });
          assert.equal(validation.reply.ok, true, JSON.stringify(validation.reply));
          const encoding = call(id, "media.encodeAudioFile", {
            source: "/dev/fd/3",
            output: file,
            input,
            settings: resolved,
          });
          assert.equal(encoding.reply.ok, true, JSON.stringify(encoding.reply));
          const result = encoding.reply.data,
            channels = layout === "stereo" ? 2 : 1,
            expectedFrames = Math.floor((frames * rate) / 48000);
          assert.equal(result.inputFrames, frames);
          assert.equal(result.durationUs, 2000354);
          assert.equal(result.sampleRate, rate);
          assert.equal(result.channels, channels);
          assert.equal(result.contentFrames, expectedFrames);
          assert.ok(
            result.encodedFrames >= expectedFrames && result.encodedFrames < expectedFrames + 1024,
            JSON.stringify(result),
          );
          assert.equal(result.bytes, readFileSync(file).length);
          const probe = JSON.parse(
            processRun("ffprobe", [
              "-v",
              "error",
              "-show_format",
              "-show_streams",
              "-of",
              "json",
              file,
            ]),
          );
          writeFileSync(join(out, id + "-probe.json"), JSON.stringify(probe, null, 2) + "\n");
          assert.equal(probe.streams.length, 1);
          const stream = probe.streams[0];
          assert.equal(stream.codec_type, "audio");
          assert.equal(stream.codec_name, "aac");
          assert.equal(stream.profile, "LC");
          assert.equal(Number(stream.sample_rate), rate);
          assert.equal(stream.channels, channels);
          assert.equal(Number(stream.start_time), 0); // Finite rate conversion owes floor(inputFrames * outputRate / inputRate) samples.
          assert.ok(Math.abs(Number(probe.format.duration) - frames / 48000) < 1 / rate + 0.000001);
          const packets = JSON.parse(
            processRun("ffprobe", ["-v", "error", "-show_packets", "-of", "json", file]),
          );
          writeFileSync(join(out, id + "-packets.json"), JSON.stringify(packets, null, 2) + "\n");
          assert.ok(
            packets.packets.some((p) =>
              p.side_data_list?.some(
                (s) => s.side_data_type === "Skip Samples" && s.skip_samples > 0,
              ),
            ),
            "Priming must be signaled",
          );
          const decoded = join(out, id + ".f32");
          processRun("ffmpeg", [
            "-v",
            "error",
            "-i",
            file,
            "-f",
            "f32le",
            "-acodec",
            "pcm_f32le",
            decoded,
          ]);
          const bytes = readFileSync(decoded),
            count = bytes.length / 4 / channels;
          assert.ok(
            count >= expectedFrames && count < expectedFrames + 1024,
            `Decoded packet padding: ${count}/${expectedFrames}`,
          );
          const regions = [
            [0, expectedFrames],
            [0, Math.min(1024, expectedFrames)],
            [expectedFrames - 1024, expectedFrames],
          ];
          const rms = regions.map(([begin, end]) => {
            let error = 0;
            for (let i = begin; i < end; i++)
              for (let c = 0; c < channels; c++) {
                const expected =
                  channels === 2
                    ? value(i, c, rate)
                    : (value(i, 0, rate) + value(i, 1, rate)) * 0.5;
                error += (bytes.readFloatLE((i * channels + c) * 4) - expected) ** 2;
              }
            return Math.sqrt(error / ((end - begin) * channels));
          });
          assert.ok(
            rms[0] < 0.055 && rms[1] < 0.12 && rms[2] < 0.12,
            `PCM channel/endpoint distortion ${rms}`,
          );
          report.cases.push({
            id,
            validation,
            encoding,
            expectedFrames,
            decodedFrames: count,
            packetPaddingFrames: count - expectedFrames,
            rms,
            sha256: sha(readFileSync(file)),
          });
        }
  // Whole-file conversion must exceed the separate 64 MiB inspection allowance.
  const longFrames = 48000 * 180 + 17,
    longer = Buffer.alloc(44 + longFrames * 8);
  wav.copy(longer, 0, 0, 44);
  longer.writeUInt32LE(longer.length - 8, 4);
  longer.writeUInt32LE(longFrames * 8, 40);
  for (let pos = 44; pos < longer.length; pos += wav.length - 44)
    wav.copy(longer, pos, 44, Math.min(wav.length, 44 + longer.length - pos));
  const longSource = join(out, "whole-file-source.wav"),
    longOutput = join(out, "whole-file.m4a");
  writeFileSync(longSource, longer);
  const longHash = sha(longer);
  const full = call(
    "whole-file",
    "media.encodeAudioFile",
    {
      source: "/dev/fd/3",
      output: longOutput,
      input: { sampleRate: 48000, channels: 2, frames: longFrames },
      settings: settings(),
    },
    longSource,
  );
  assert.equal(full.reply.ok, true, JSON.stringify(full.reply));
  assert.equal(full.reply.data.inputFrames, longFrames);
  assert.equal(full.reply.data.contentFrames, longFrames);
  assert.ok(
    full.reply.data.encodedFrames >= longFrames &&
      full.reply.data.encodedFrames < longFrames + 1024,
  );
  const longProbe = JSON.parse(
    processRun("ffprobe", [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      longOutput,
    ]),
  );
  assert.equal(longProbe.streams.length, 1);
  assert.equal(longProbe.streams[0].codec_name, "aac");
  assert.equal(Number(longProbe.streams[0].start_time), 0);
  assert.ok(Math.abs(Number(longProbe.format.duration) - longFrames / 48000) < 0.000002);
  const longDecoded = join(out, "whole-file.f32");
  processRun("ffmpeg", [
    "-v",
    "error",
    "-i",
    longOutput,
    "-f",
    "f32le",
    "-acodec",
    "pcm_f32le",
    longDecoded,
  ]);
  const longPCM = readFileSync(longDecoded),
    longDecodedFrames = longPCM.length / 8;
  assert.ok(longDecodedFrames >= longFrames && longDecodedFrames < longFrames + 1024);
  const endpointRms = [
    [0, 1024],
    [longFrames - 1024, longFrames],
  ].map(([first, end]) => {
    let error = 0;
    for (let i = first; i < end; i++)
      for (let c = 0; c < 2; c++)
        error +=
          (longPCM.readFloatLE(i * 8 + c * 4) - wav.readFloatLE(44 + (i % frames) * 8 + c * 4)) **
          2;
    return Math.sqrt(error / ((end - first) * 2));
  });
  assert.ok(
    endpointRms.every((v) => v < 0.12),
    JSON.stringify(endpointRms),
  );
  assert.equal(sha(readFileSync(longSource)), longHash);
  report.wholeFile = {
    requestReply: full,
    inputBytes: longer.length,
    inputSha256: longHash,
    decodedFrames: longDecodedFrames,
    endpointRms,
    probe: longProbe,
    outputSha256: sha(readFileSync(longOutput)),
  };
  const normal = settings();
  for (const [id, patch, code] of [
    ["mp3", { audio: { ...normal.audio, codec: "mp3" } }, "UNSUPPORTED_FORMAT"],
    ["container", { container: "mp3" }, "UNSUPPORTED_FORMAT"],
    [
      "bitrate",
      { audio: { ...normal.audio, rateControl: { mode: "constant", bitrate: 1, quality: null } } },
      "UNSUPPORTED_FORMAT",
    ],
    ["sample-rate", { audio: { ...normal.audio, sampleRate: 123 } }, "UNSUPPORTED_FORMAT"],
    [
      "vbr-bitrate",
      {
        audio: {
          ...normal.audio,
          rateControl: { mode: "variable", bitrate: 192000, quality: "high" },
        },
      },
      "UNSUPPORTED_FORMAT",
    ],
    [
      "cbr-quality",
      {
        audio: {
          ...normal.audio,
          rateControl: { mode: "constant", bitrate: 192000, quality: "high" },
        },
      },
      "UNSUPPORTED_FORMAT",
    ],
    [
      "invalid-quality",
      { audio: { ...normal.audio, quality: "unadvertised" } },
      "UNSUPPORTED_FORMAT",
    ],
    ["video-field", { video: {} }, "INVALID_REQUEST"],
    ["unknown-control", { audio: { ...normal.audio, arbitrary: true } }, "INVALID_REQUEST"],
  ]) {
    const result = call(id, "media.encodeAudioFile", {
      source: "/dev/fd/3",
      output: join(out, "nonexistent", id + ".m4a"),
      input,
      settings: { ...normal, ...patch },
    });
    report.invalid.push(result);
    assert.equal(result.reply.ok, false);
    assert.equal(result.reply.error.code, code, JSON.stringify(result));
  }
  const occupied = join(out, "occupied.m4a");
  writeFileSync(occupied, "retained destination");
  const occupiedReply = call("occupied", "media.encodeAudioFile", {
    source: "/dev/fd/3",
    output: occupied,
    input,
    settings: normal,
  });
  report.invalid.push(occupiedReply);
  assert.equal(occupiedReply.reply.error.code, "INVALID_OUTPUT");
  assert.equal(readFileSync(occupied, "utf8"), "retained destination");
  const dimensions = call("wrong-frames", "media.encodeAudioFile", {
    source: "/dev/fd/3",
    output: join(out, "wrong.m4a"),
    input: { ...input, frames: frames + 1 },
    settings: normal,
  });
  report.invalid.push(dimensions);
  assert.equal(dimensions.reply.error.code, "ARTIFACT_CHANGED");
  const truncated = join(out, "truncated.wav");
  writeFileSync(truncated, wav.subarray(0, wav.length - 8));
  const bad = call(
    "truncated",
    "media.encodeAudioFile",
    { source: "/dev/fd/3", output: join(out, "truncated.m4a"), input, settings: normal },
    truncated,
  );
  report.invalid.push(bad);
  assert.equal(bad.reply.ok, false);
  assert.equal(sha(readFileSync(source)), originalHash);
  assert.ok(readdirSync(out).every((name) => !name.startsWith(".screenrec-output-")));
  report.passed = true;
} finally {
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    passed: report.passed,
    cases: report.cases.length,
    invalid: report.invalid.length,
  }),
);
