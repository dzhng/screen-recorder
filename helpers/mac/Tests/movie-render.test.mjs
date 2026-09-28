import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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
const evidence = process.env.SCREENREC_MOVIE_EVIDENCE;
const dir = evidence ?? mkdtempSync(join(tmpdir(), "screenrec-movie-"));
assert.ok(isAbsolute(dir));
mkdirSync(dir, { recursive: true });
assert.deepEqual(readdirSync(dir), []);
const reports = [];
after(() => {
  if (evidence) writeFileSync(join(dir, "report.json"), JSON.stringify(reports, null, 2));
  else rmSync(dir, { recursive: true, force: true });
});
function run(command, args, input) {
  const r = spawnSync(command, args, {
    input,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(r.error, undefined);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
function request(operation, params) {
  return JSON.parse(run(native, [], JSON.stringify({ id: "movie", operation, params }) + "\n"));
}
function plan(ranges) {
  return renderPlan(
    createRevision(
      createOriginalRevision(6000000),
      ranges.map(([startUs, endUs]) => ({ startUs, endUs })),
      { id: "edited", operation: "cut", createdAt: "fixture" },
    ),
  );
}
function pcm(file) {
  const b = readFileSync(file);
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const frames = renderFrames();
writeFileSync(join(dir, "source.rgb"), Buffer.concat(frames));
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
  "1",
  "-i",
  join(dir, "source.rgb"),
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-an",
  join(dir, "source.mov"),
]);
for (const [name, rate, channels, freq] of [
  ["narration", 44100, 1, 997],
  ["system", 48000, 2, 1511],
]) {
  const signal =
    channels === 1
      ? `0.2*sin(2*PI*(${freq}*t+17*t*t))`
      : `0.2*sin(2*PI*(${freq}*t+7*t*t))|0.2*sin(2*PI*(2111*t+11*t*t))`;
  run("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=${signal}:s=${rate}:d=6`,
    "-c:a",
    "pcm_f32le",
    join(dir, name + ".mov"),
  ]);
}
run("swiftc", [
  "-parse-as-library",
  new URL("MovieTiming/main.swift", import.meta.url).pathname,
  "-o",
  join(dir, "inspect"),
]);
const allTracks = [
  {
    role: "narration",
    source: join(dir, "narration.mov"),
    sourceOffsetUs: 125000,
    available: [
      { startUs: 125000, endUs: 1600000 },
      { startUs: 1800000, endUs: 6000000 },
    ],
  },
  {
    role: "system",
    source: join(dir, "system.mov"),
    sourceOffsetUs: -250000,
    available: [
      { startUs: 0, endUs: 2500000 },
      { startUs: 2800000, endUs: 5750000 },
    ],
  },
];
const cases = [
  ["original", [[0, 6000000]], allTracks],
  [
    "two-cuts",
    [
      [100001, 172751],
      [200000, 1685833],
      [2500000, 5999983],
    ],
    allTracks,
  ],
  [
    "fractional",
    [
      [100001, 110004],
      [1033334, 1053341],
    ],
    allTracks,
  ],
  ["one-sample", [[300000, 300020]], allTracks],
  ["subsample", [[300000, 300002]], allTracks],
  ["mono", [[0, 4000000]], [allTracks[0]]],
  ["silent", [[500000, 1500000]], []],
];
for (const [name, ranges, tracks] of cases)
  test(
    name === "one-sample"
      ? "tiny AAC has exact native endpoint but differs in FFmpeg decoding"
      : `movie preserves ${name} timing and PCM alignment`,
    () => {
      const output = join(dir, name + ".mp4"),
        p = plan(ranges),
        source = join(dir, "source.mov");
      const before = [source, ...tracks.map((t) => t.source)].map((f) => readFileSync(f));
      const result = request("media.renderMovie", { source, output, plan: p, tracks });
      assert.equal(result.ok, true, JSON.stringify(result));
      [source, ...tracks.map((t) => t.source)].forEach((f, i) =>
        assert.deepEqual(readFileSync(f), before[i]),
      );
      const duration = p.at(-1).playback.endUs;
      assert.equal(result.data.durationUs, duration);
      const av = JSON.parse(
        run(join(dir, "inspect"), [
          output,
          join(dir, name + ".av.f32"),
          ...(["two-cuts", "one-sample"].includes(name) ? ["--play"] : []),
        ]),
      );
      assert.ok(Math.abs(av.durationUs - duration) < 0.001);
      const probe = JSON.parse(
        run("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "format=duration:stream=codec_name,start_time,duration,color_space,color_transfer,color_primaries",
          "-of",
          "json",
          output,
        ]),
      );
      // FFmpeg derives format duration from sample-rate ticks; the movie/video presentation
      // remains microsecond-exact while that summary may round up one audio sample.
      assert.ok(
        Math.abs(Number(probe.format.duration) * 1e6 - duration) <=
          (result.data.audio?.sampleRate ? 1e6 / result.data.audio?.sampleRate : 0) + 0.001,
      );
      assert.ok(
        Math.abs(
          Number(probe.streams.find((s) => s.codec_name === "h264").duration) * 1e6 - duration,
        ) < 0.001,
      );
      if (av.playerEndedNotification) assert.ok(Math.abs(av.playerEndUs - duration) < 0.001);
      const video = join(dir, name + ".video.mp4");
      assert.equal(
        request("media.renderMovie", { source, output: video, plan: p, tracks: [] }).ok,
        true,
      );
      const sourceTags = JSON.parse(
        run("ffprobe", [
          "-v",
          "error",
          "-select_streams",
          "v",
          "-show_entries",
          "stream=color_space,color_transfer,color_primaries",
          "-of",
          "json",
          video,
        ]),
      ).streams[0];
      const copiedTags = probe.streams.find((s) => s.codec_name === "h264");
      for (const key of ["color_space", "color_transfer", "color_primaries"])
        assert.equal(copiedTags[key], sourceTags[key]);
      for (const [f, suffix] of [
        [output, "movie"],
        [video, "video"],
      ])
        run("ffmpeg", [
          "-v",
          "error",
          "-i",
          f,
          "-map",
          "0:v",
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgb24",
          "-fps_mode",
          "passthrough",
          join(dir, name + "." + suffix + ".rgb"),
        ]);
      assert.deepEqual(
        readFileSync(join(dir, name + ".movie.rgb")),
        readFileSync(join(dir, name + ".video.rgb")),
      );
      const audio = av.tracks.find((t) => t.type === "soun");
      let comparison;
      if ((result.data.audio?.frames ?? 0) > 0) {
        assert.ok(audio);
        assert.equal(audio.decodedFrames, result.data.audio?.frames ?? 0);
        assert.ok(
          Math.abs(audio.durationUs - duration) <= 1e6 / result.data.audio?.sampleRate / 2 + 0.001,
        );
        assert.equal(audio.decodedStartUs, 0);
        assert.ok(
          Math.abs(audio.decodedEndUs - duration) <= 1e6 / result.data.audio?.sampleRate + 0.001,
        );
        const reference = join(dir, name + ".wav");
        const wave = request("media.audio", {
          output: reference,
          spans: p.map((s) => s.source),
          tracks,
        });
        assert.equal(wave.ok, true, JSON.stringify(wave));
        run("ffmpeg", [
          "-v",
          "error",
          "-i",
          reference,
          "-f",
          "f32le",
          join(dir, name + ".ref.f32"),
        ]);
        run("ffmpeg", [
          "-v",
          "error",
          "-i",
          output,
          "-map",
          "0:a",
          "-f",
          "f32le",
          join(dir, name + ".ff.f32"),
        ]);
        const expected = pcm(join(dir, name + ".ref.f32")),
          actual = pcm(join(dir, name + ".av.f32")),
          ff = pcm(join(dir, name + ".ff.f32"));
        assert.ok(
          actual.length >= expected.length &&
            actual.length <= expected.length + result.data.audio?.channels,
        );
        if (name === "one-sample") {
          assert.equal(expected.length, 2);
          assert.ok(Math.abs(expected[0]) > 0.05);
          assert.ok(Math.abs(actual[0]) > 0.02);
          assert.equal(ff.length, 0);
        } else assert.ok(ff.length >= expected.length);
        assert.ok(ff.length - expected.length < 1024 * result.data.audio?.channels);
        const errors = (decoded, shift) => {
          let sum = 0,
            n = 0;
          for (
            let i = 500 * result.data.audio?.channels;
            i < expected.length - 500 * result.data.audio?.channels;
            i++
          ) {
            const j = i + shift * result.data.audio?.channels;
            if (j >= 0 && j < decoded.length) {
              sum += (decoded[j] - expected[i]) ** 2;
              n++;
            }
          }
          return n ? Math.sqrt(sum / n) : null;
        };
        const rms = errors(actual, 0),
          ffRms = errors(ff, 0);
        if (rms !== null) {
          assert.ok(rms < 0.01, `AAC RMS ${rms}`);
          assert.ok(ffRms < 0.01, `FFmpeg AAC RMS ${ffRms}`);
        }
        if (expected.length > 4000 * result.data.audio?.channels)
          for (const shifted of [-2112, 2112]) {
            assert.ok(errors(ff, shifted) > ffRms * 3, "Priming shift must be distinguishable");
          }
        comparison = {
          avRms: rms,
          ffRms,
          ffDecodedFrames: ff.length / result.data.audio?.channels,
          presentationFrames: result.data.audio?.frames ?? 0,
        };
        if (name === "one-sample") {
          comparison.nonzeroSample = {
            reference: Array.from(expected),
            native: Array.from(actual),
          };
          comparison.ffmpegPackets = JSON.parse(
            run("ffprobe", [
              "-v",
              "error",
              "-select_streams",
              "a",
              "-show_packets",
              "-of",
              "json",
              output,
            ]),
          ).packets;
          comparison.openGate =
            "Native presentation retains nonzero sample; FFmpeg emits no PCM for this sub-packet movie.";
        }
      } else assert.equal(audio, undefined);
      assert.ok(!readdirSync(dir).some((f) => f.startsWith(".screenrec-output-")));
      reports.push({
        name,
        plan: p,
        receipt: { ...result.data, file: name + ".mp4" },
        av,
        probe,
        comparison,
      });
    },
  );

test("changed excluded source samples cannot enter tiny or cut AAC output", () => {
  const source = join(dir, "system.mov"),
    raw = join(dir, "system.f32");
  run("ffmpeg", ["-v", "error", "-i", source, "-f", "f32le", raw]);
  for (const [name, ranges] of [
    ["tiny-isolation", [[300000, 300020]]],
    [
      "cut-isolation",
      [
        [0, 500000],
        [2000000, 2500000],
      ],
    ],
  ]) {
    const bytes = Buffer.from(readFileSync(raw));
    const keep = ranges.map(([start, end]) => [
      Math.round((start * 48000) / 1e6),
      Math.round((end * 48000) / 1e6),
    ]);
    for (let frame = 0; frame < bytes.length / 8; frame++)
      if (!keep.some(([start, end]) => frame >= start && frame < end)) {
        bytes.writeFloatLE(0.9, frame * 8);
        bytes.writeFloatLE(-0.9, frame * 8 + 4);
      }
    const modified = join(dir, name + "-changed.mov"),
      data = join(dir, name + "-changed.f32");
    writeFileSync(data, bytes);
    run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-i",
      data,
      "-c:a",
      "pcm_f32le",
      modified,
    ]);
    const decoded = [];
    for (const [index, file] of [source, modified].entries()) {
      const output = join(dir, `${name}-${index}.mp4`),
        rawOutput = join(dir, `${name}-${index}.f32`);
      const result = request("media.renderMovie", {
        source: join(dir, "source.mov"),
        output,
        plan: plan(ranges),
        tracks: [
          {
            role: "system",
            source: file,
            sourceOffsetUs: 0,
            available: [{ startUs: 0, endUs: 6000000 }],
          },
        ],
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      run(join(dir, "inspect"), [output, rawOutput]);
      decoded.push(readFileSync(rawOutput));
    }
    assert.deepEqual(decoded[0], decoded[1]);
    reports.push({
      name,
      changed: "All source samples outside retained intervals replaced by ±0.9",
      decodedBytes: decoded[0].length,
      identicalDecodedAAC: true,
    });
  }
});

test("movie accepts 1001 retained/acquired spans while public excerpts retain their cap", () => {
  const spans = Array.from({ length: 1001 }, (_, i) => ({
    startUs: i * 2000,
    endUs: i * 2000 + 1000,
  }));
  const tracks = [
    { role: "system", source: join(dir, "system.mov"), sourceOffsetUs: 0, available: spans },
  ];
  const p = plan(spans.map((s) => [s.startUs, s.endUs]));
  const output = join(dir, "1001-spans.mp4");
  const reply = request("media.renderMovie", {
    source: join(dir, "source.mov"),
    output,
    plan: p,
    tracks,
  });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(reply.data.durationUs, 1001000);
  assert.equal(reply.data.audio.frames, 48048);
  const av = JSON.parse(run(join(dir, "inspect"), [output, join(dir, "1001-spans.f32")]));
  assert.equal(av.tracks.find((t) => t.type === "soun").decodedFrames, 48048);
  const excerpt = request("media.audio", { output: join(dir, "too-many.wav"), spans, tracks });
  assert.equal(excerpt.ok, false);
  assert.equal(excerpt.error.code, "LIMIT_EXCEEDED");
  reports.push({
    name: "1001-spans",
    durationUs: reply.data.durationUs,
    audioFrames: reply.data.audio.frames,
    nativeFrames: av.tracks.find((t) => t.type === "soun").decodedFrames,
    publicExcerptError: excerpt.error.code,
  });
});

test("two-cuts resampling endpoint excludes neighboring native frames and refuses truncated decode", () => {
  const ranges = cases.find(([name]) => name === "two-cuts")[1];
  const base = Buffer.alloc(6 * 44100 * 4);
  const results = [];
  let original;
  for (const [name, markers] of [
    ["zero", []],
    ["outside", [104737, 259087]],
    ["inside-start", [104738]],
    ["inside-end", [259086]],
  ]) {
    const raw = join(dir, `endpoint-${name}.f32`),
      source = join(dir, `endpoint-${name}.mov`);
    const signal = Buffer.from(base);
    for (const frame of markers) signal.writeFloatLE(0.9, frame * 4);
    writeFileSync(raw, signal);
    run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-i",
      raw,
      "-c:a",
      "pcm_f32le",
      "-movflags",
      "+faststart",
      source,
    ]);
    if (name === "zero") original = source;
    const result = request("media.audio", {
      output: join(dir, `endpoint-${name}.wav`),
      spans: ranges.map(([startUs, endUs]) => ({ startUs, endUs })),
      tracks: [{ ...allTracks[0], source }, allTracks[1]],
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.frames, 242811);
    const binary = spawnSync(
      "ffmpeg",
      ["-v", "error", "-i", result.data.file, "-f", "f32le", "pipe:1"],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
    );
    assert.equal(binary.status, 0, binary.stderr.toString());
    assert.equal(binary.stdout.length, 242811 * 2 * 4);
    results.push(binary.stdout);
  }
  assert.deepEqual(
    results[1],
    results[0],
    "Excluded nearest-start and ceil-end neighbors must never influence PCM",
  );
  for (const selected of results.slice(2))
    assert.notDeepEqual(
      selected,
      results[0],
      "Each selected boundary impulse must survive decoding",
    );
  const damaged = join(dir, "endpoint-truncated.mov");
  const bytes = readFileSync(original);
  writeFileSync(damaged, bytes.subarray(0, bytes.length - 44100 * 4));
  const output = join(dir, "endpoint-truncated.wav");
  const failure = request("media.audio", {
    output,
    spans: ranges.map(([startUs, endUs]) => ({ startUs, endUs })),
    tracks: [{ ...allTracks[0], source: damaged }, allTracks[1]],
  });
  assert.equal(
    failure.error?.code,
    "NATIVE_DECODE_FAILED",
    JSON.stringify(failure),
  );
  assert(!readdirSync(dir).includes("endpoint-truncated.wav"));
  assert(
    !readdirSync(dir).some((name) => name.startsWith(".screenrec-output-")),
  );
  reports.push({
    name: "two-cuts-quantized-endpoint",
    inputRate: 44100,
    outputRate: 48000,
    retainedInput: { start: 104738, end: 259087, frames: 154349 },
    owedIntervalOutput: 167999,
    converterWholeFrames: 167998,
    boundedExtension: 1,
    totalOutputFrames: 242811,
    excludedMarkers: [104737, 259087],
    includedMarkers: [104738, 259086],
    truncatedDecodeRefused: true,
  });
});
