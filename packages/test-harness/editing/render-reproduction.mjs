import assert from "node:assert/strict";
import { mask, classify, codecChannelTolerance } from "./render-membership.mjs";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = join(root, "packages/test-harness/editing/RenderReproduction.swift");
const timing = join(root, "helpers/mac/Sources/ScreenRecorderMedia/SampleTiming.swift");
const corpus = join(root, "specs/agent-editing/assets/00-corpus");
const args = process.argv.slice(2);
const platformRate = args.at(-1) === "--platform-rate";
if (platformRate) args.pop();
assert.equal(args[0], "--case");
assert.equal(args[1], "av-replacement");
assert.ok(args.length === 2 || (args.length === 4 && args[2] === "--out"));
const out = args[3]
  ? resolve(args[3])
  : await mkdtemp(join(tmpdir(), "screenrec-render-reproduction-"));
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), [], "Evidence output must be empty");
const scratch = await mkdtemp(join(tmpdir(), "screenrec-render-build-"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function run(command, args, { allowFailure = false, input } = {}) {
  const result = spawnSync(command, args, { input, maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
  assert.ifError(result.error);
  if (!allowFailure)
    assert.equal(result.status, 0, result.stderr.toString() + result.stdout.toString());
  return result;
}
function ff(args, options = {}) {
  return run("ffmpeg", ["-v", "error", "-nostdin", ...args], options).stdout;
}
function probe(file) {
  return JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_frames",
      "-show_format",
      "-of",
      "json",
      file,
    ]).stdout,
  );
}
const writeJSON = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
function timed(binary, method, requestFile) {
  const result = run("/usr/bin/time", ["-l", binary, method, requestFile], { allowFailure: true });
  const resource = result.stderr.toString();
  let resultJSON;
  try {
    resultJSON = JSON.parse(result.stdout);
  } catch {
    resultJSON = { error: result.stdout.toString() };
  }
  return {
    status: result.status,
    ...resultJSON,
    peakRSSBytes: Number(resource.match(/(\d+)\s+maximum resident set size/)?.[1]),
    peakFootprintBytes: Number(resource.match(/(\d+)\s+peak memory footprint/)?.[1]),
  };
}
const range = (startUs, endUs) => ({ startUs, endUs });
const picture = (id, file, sourceStart, sourceEnd, start, end, holdUs = null) => ({
  id,
  file,
  source: range(sourceStart, sourceEnd),
  project: range(start, end),
  holdUs,
});
const sound = (id, start, end, at, gain = 1) => ({
  file: join(corpus, `${id}-audio.wav`),
  source: range(start, end),
  atUs: at,
  gain,
});
const repeat = (...groups) => groups.flatMap(([id, count]) => Array(count).fill(id));
const frameBytes = 160 * 128 * 3;
function pad(bytes, width, height, frame) {
  const output = Buffer.alloc(frameBytes);
  for (let y = 0; y < height; y++) {
    const begin = (frame * height + y) * width * 3;
    bytes.copy(
      output,
      ((y + (128 - height) / 2) * 160 + (160 - width) / 2) * 3,
      begin,
      begin + width * 3,
    );
  }
  return output;
}
function inspectMovie(file, expected, startUs, endUs, references) {
  const metadata = probe(file);
  const raw = ff([
    "-i",
    file,
    "-map",
    "0:v:0",
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  const frames = metadata.frames.filter((frame) => frame.media_type === "video");
  assert.equal(raw.length, frames.length * frameBytes);
  const observations = frames.map((frame, index) => ({
    atUs: Math.round(Number(frame.best_effort_timestamp_time) * 1e6),
    durationUs: Math.round(Number(frame.duration_time) * 1e6),
    ...classify(raw.subarray(index * frameBytes, (index + 1) * frameBytes), references),
  }));
  const wanted = [];
  for (let k = Math.floor(startUs / 50000); k * 50000 < endUs; k++) {
    for (const atUs of [
      Math.max(startUs, k * 50000) - startUs,
      Math.min(endUs, (k + 1) * 50000) - startUs - 1,
    ]) {
      const actual = observations.findLast(
        (frame) => frame.atUs <= atUs && atUs < frame.atUs + frame.durationUs,
      );
      wanted.push({
        atUs,
        expected: expected[k],
        actual: actual?.id ?? null,
        passed: actual?.id === expected[k],
      });
    }
  }
  const durationUs = Math.round(Number(metadata.format.duration) * 1e6);
  return {
    observations,
    wanted,
    membershipPassed: wanted.every((row) => row.passed),
    durationUs,
    durationPassed: durationUs === endUs - startUs,
    streams: metadata.streams,
    raw,
  };
}
function audioExpected(request, sources) {
  const start = (request.range.startUs * 48000) / 1e6;
  const count = ((request.range.endUs - request.range.startUs) * 48000) / 1e6;
  const samples = new Float64Array(count);
  for (const sound of request.audio) {
    const source = sources.get(sound.file);
    const projectBegin = (sound.atUs * 48000) / 1e6;
    const sourceBegin = (sound.source.startUs * 48000) / 1e6;
    const length = ((sound.source.endUs - sound.source.startUs) * 48000) / 1e6;
    for (let i = 0; i < count; i++) {
      const offset = start + i - projectBegin;
      if (offset >= 0 && offset < length)
        samples[i] += (source.readInt16LE(44 + (sourceBegin + offset) * 2) / 32768) * sound.gain;
    }
  }
  return samples;
}
function compareAudio(actual, expected, tolerance) {
  let maxError = 0,
    squareError = 0;
  const frames = actual.length / 8;
  for (let i = 0; i < Math.min(frames, expected.length); i++)
    for (let channel = 0; channel < 2; channel++) {
      const error = Math.abs(actual.readFloatLE(i * 8 + channel * 4) - expected[i]);
      maxError = Math.max(maxError, error);
      squareError += error * error;
    }
  return {
    frames,
    expectedFrames: expected.length,
    paddingFrames: frames - expected.length,
    maxError,
    rmse: Math.sqrt(squareError / expected.length / 2),
    passed: tolerance === null ? null : frames === expected.length && maxError <= tolerance,
  };
}
function impulseTiming(actual, expected) {
  const rows = [];
  const impulses = [...expected.keys()].filter((index) => Math.abs(expected[index]) > 0.3);
  for (const [ordinal, i] of impulses.entries()) {
    const previous = impulses[ordinal - 1] ?? -Infinity;
    const next = impulses[ordinal + 1] ?? Infinity;
    const radius = Math.min(2400, Math.floor((i - previous) / 2), Math.floor((next - i) / 2));
    let strongest = 0,
      strongestAt = -1;
    for (let j = Math.max(0, i - radius); j < Math.min(actual.length / 8, i + radius + 1); j++) {
      const value = Math.abs(actual.readFloatLE(j * 8));
      if (value > strongest) {
        strongest = value;
        strongestAt = j;
      }
    }
    rows.push({
      expectedSample: i,
      actualSample: strongestAt,
      amplitude: strongest,
      offsetUs: ((strongestAt - i) * 1e6) / 48000,
      passed: strongest > 0.3 && Math.abs(strongestAt - i) <= 2400,
    });
  }
  return rows;
}

try {
  const binary = join(scratch, "probe");
  const built = run("swiftc", ["-parse-as-library", timing, source, "-o", binary]);
  await writeFile(join(out, "build.log"), built.stderr);
  const references = [
    { id: "black", rgb: Buffer.alloc(frameBytes), mask: new Uint8Array(160 * 128) },
  ];
  const inputs = [];
  for (const [id, width, height, count] of [
    ["a", 160, 96, 8],
    ["b", 96, 128, 10],
  ]) {
    const file = join(corpus, `${id}.mov`);
    const tagged = join(out, `tagged-${id}.mov`);
    ff([
      "-i",
      file,
      "-map",
      "0:v:0",
      "-c",
      "copy",
      "-bsf:v",
      "h264_metadata=colour_primaries=1:transfer_characteristics=13:matrix_coefficients=6",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "iec61966-2-1",
      "-colorspace",
      "smpte170m",
      tagged,
    ]);
    const raw = ff([
      "-i",
      file,
      "-map",
      "0:v:0",
      "-fps_mode",
      "passthrough",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ]);
    for (let i = 0; i < count; i++) {
      const rgb = pad(raw, width, height, i);
      references.push({ id: `${id.toUpperCase()}${i}`, rgb, mask: mask(rgb) });
    }
    inputs.push(
      { path: file, sha256: hash(await readFile(file)) },
      { path: tagged, sha256: hash(await readFile(tagged)) },
    );
  }
  const colors = {};
  for (const [name, file] of [
    ["untagged", join(corpus, "a.mov")],
    ["declared-srgb", join(out, "tagged-a.mov")],
  ]) {
    const directory = join(out, "color-" + name);
    await mkdir(directory);
    const report = JSON.parse(run(binary, ["color", file, directory]).stdout);
    for (const policy of ["native", "assume-srgb"]) {
      const raw = ff([
        "-i",
        join(directory, policy + ".png"),
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      report[policy] = [...raw.subarray((4 * 160 + 4) * 3, (4 * 160 + 4) * 3 + 3)];
    }
    colors[name] = report;
  }
  const a = join(out, "tagged-a.mov"),
    b = join(out, "tagged-b.mov");
  const gap = join(out, "empty-edit.mov");
  run(binary, ["gap", a, gap]);
  const avPictures = [
    picture("a-first", a, 0, 500000, 0, 500000),
    picture("b-middle", b, 400000, 1000000, 500000, 1100000),
    picture("a-last", a, 1000000, 1500000, 1100000, 1600000),
  ];
  const avExpected = repeat(
    ["A0", 5],
    ["A1", 5],
    ["B2", 4],
    ["B3", 4],
    ["B4", 4],
    ["A4", 5],
    ["A5", 5],
  );
  const avAudio = [sound("a", 0, 1600000, 0), sound("b", 200000, 1200000, 400000, 0.5)];
  const cases = [
    {
      name: "av-replacement",
      pictures: avPictures,
      audio: avAudio,
      expected: avExpected,
      range: range(0, 1600000),
    },
    {
      name: "nonzero-preview",
      pictures: avPictures,
      audio: avAudio,
      expected: avExpected,
      range: range(375000, 1375000),
    },
    {
      name: "audio-replacement",
      pictures: [picture("retained-video", a, 0, 1600000, 0, 1600000)],
      audio: [
        sound("a", 0, 400000, 0),
        sound("b", 600000, 1200000, 400000),
        sound("a", 1000000, 1600000, 1000000),
      ],
      expected: repeat(["A0", 5], ["A1", 5], ["A2", 5], ["A3", 5], ["A4", 5], ["A5", 5], ["A6", 2]),
      range: range(0, 1600000),
    },
    {
      name: "held-frame",
      pictures: [picture("held", a, 375000, 375001, 0, 500000, 375000)],
      audio: [],
      expected: repeat(["A1", 10]),
      range: range(0, 500000),
    },
    {
      name: "subframe-source",
      pictures: [picture("subframe", a, 370000, 870000, 0, 500000)],
      audio: [],
      expected: repeat(["A1", 3], ["A2", 5], ["A3", 2]),
      range: range(0, 500000),
    },
    {
      name: "vfr-held-tail",
      pictures: [picture("vfr", join(corpus, "timestamp-gap.mov"), 0, 2000000, 0, 2000000)],
      audio: [],
      expected: repeat(["A0", 5], ["A1", 15], ["A4", 5], ["A5", 5], ["A6", 5], ["A7", 5]),
      range: range(0, 2000000),
    },
    {
      name: "empty-edit",
      pictures: [picture("gapped", gap, 0, 1250000, 0, 1250000)],
      audio: [],
      expected: repeat(["A0", 5], ["black", 10], ["A1", 5], ["A2", 5]),
      range: range(0, 1250000),
    },
    {
      name: "empty-edit-preview",
      pictures: [picture("gapped", gap, 0, 1250000, 0, 1250000)],
      audio: [],
      expected: repeat(["A0", 5], ["black", 10], ["A1", 5], ["A2", 5]),
      range: range(375000, 1025000),
    },
    {
      name: "unavailable-acquisition",
      pictures: [
        {
          ...picture("unknown-content", join(corpus, "timestamp-gap.mov"), 0, 2000000, 0, 2000000),
          unavailable: [range(500000, 1000000)],
        },
      ],
      audio: [],
      expected: [],
      range: range(0, 2000000),
      rejects: "UNAVAILABLE_ACQUISITION",
    },
  ];
  inputs.push({
    path: join(corpus, "timestamp-gap.mov"),
    sha256: hash(await readFile(join(corpus, "timestamp-gap.mov"))),
  });
  const sounds = new Map();
  for (const id of ["a", "b"]) {
    const file = join(corpus, `${id}-audio.wav`);
    sounds.set(file, await readFile(file));
    inputs.push({ path: file, sha256: hash(await readFile(file)) });
  }
  const results = [];
  for (const scenario of cases) {
    const directory = join(out, scenario.name);
    await mkdir(directory);
    const request = {
      width: 160,
      height: 128,
      fps: 20,
      colorPolicy: "native",
      ...(platformRate ? { platformRate: true } : {}),
      pictures: scenario.pictures,
      audio: scenario.audio,
      range: scenario.range,
      output: directory,
    };
    const requestFile = join(directory, "request.json");
    await writeJSON(requestFile, request);
    await writeJSON(join(directory, "expected.json"), {
      frameIDsOnFullProjectGrid: scenario.expected,
      range: scenario.range,
      rejects: scenario.rejects ?? null,
    });
    const result = { name: scenario.name, methods: {} };
    for (const method of ["composition", "bounded"]) {
      process.stderr.write(`${scenario.name}: ${method}\n`);
      const measurement = timed(binary, method, requestFile);
      if (scenario.rejects)
        measurement.expectedRefusalPassed =
          measurement.status !== 0 && measurement.error?.includes(scenario.rejects);
      else if (measurement.status === 0) {
        const file = join(directory, `${method}.mov`);
        const inspected = inspectMovie(
          file,
          scenario.expected,
          scenario.range.startUs,
          scenario.range.endUs,
          references,
        );
        const { raw, streams, ...observations } = inspected;
        Object.assign(measurement, observations, {
          realTimeFactor:
            measurement.elapsedSeconds / ((scenario.range.endUs - scenario.range.startUs) / 1e6),
          outputSha256: hash(await readFile(file)),
          streams: streams.map(
            ({
              codec_name,
              codec_type,
              width,
              height,
              sample_rate,
              channels,
              color_space,
              color_transfer,
              color_primaries,
            }) => ({
              codec_name,
              codec_type,
              width,
              height,
              sample_rate,
              channels,
              color_space,
              color_transfer,
              color_primaries,
            }),
          ),
        });
        if (scenario.name === "av-replacement") {
          const chosen = [0, 5, 10, 14, 18, 22, 27, 31];
          ff(
            [
              "-f",
              "rawvideo",
              "-pix_fmt",
              "rgb24",
              "-s",
              "160x128",
              "-r",
              "1",
              "-i",
              "pipe:0",
              "-vf",
              "tile=4x2",
              "-frames:v",
              "1",
              join(directory, `${method}-sheet.png`),
            ],
            {
              input: Buffer.concat(
                chosen.map((index) => raw.subarray(index * frameBytes, (index + 1) * frameBytes)),
              ),
            },
          );
          const redOffset = (20 * 160 + 4) * 3;
          const target = references
            .find((frame) => frame.id === "A0")
            .rgb.subarray(redOffset, redOffset + 3);
          measurement.redRgb = [...raw.subarray(redOffset, redOffset + 3)];
          measurement.sourceColorTolerance = codecChannelTolerance;
          measurement.sourceColorPassed = measurement.redRgb.every(
            (value, channel) => Math.abs(value - target[channel]) <= codecChannelTolerance,
          );
          if (method === "composition")
            ff(
              [
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgb24",
                "-s",
                "160x128",
                "-r",
                "1",
                "-i",
                "pipe:0",
                "-vf",
                "tile=4x2",
                "-frames:v",
                "1",
                join(directory, "target-sheet.png"),
              ],
              {
                input: Buffer.concat(
                  chosen.map(
                    (index) =>
                      references.find((frame) => frame.id === scenario.expected[index]).rgb,
                  ),
                ),
              },
            );
        }
        if (["nonzero-preview", "empty-edit"].includes(scenario.name)) {
          const atUs = scenario.name === "nonzero-preview" ? 125000 : 250000;
          const index = inspected.observations.findLastIndex(
            (frame) => frame.atUs <= atUs && atUs < frame.atUs + frame.durationUs,
          );
          if (index >= 0)
            ff(
              [
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgb24",
                "-s",
                "160x128",
                "-i",
                "pipe:0",
                "-frames:v",
                "1",
                join(directory, `${method}-at-${atUs}.png`),
              ],
              { input: raw.subarray(index * frameBytes, (index + 1) * frameBytes) },
            );
        }
        if (scenario.audio.length) {
          const expectedAudio = audioExpected(request, sounds);
          const audioData = ff([
            "-i",
            file,
            "-map",
            "0:a:0",
            "-ac",
            "2",
            "-ar",
            "48000",
            "-f",
            "f32le",
            "pipe:1",
          ]);
          measurement.audio = compareAudio(
            audioData,
            expectedAudio,
            method === "bounded" ? 1 / 32768 : null,
          );
          measurement.impulses = impulseTiming(audioData, expectedAudio);
          if (method === "bounded")
            measurement.mixPCM = compareAudio(
              await readFile(join(directory, "audio.f32le")),
              expectedAudio,
              1e-6,
            );
        }
      }
      result.methods[method] = measurement;
      measurement.temporalPassed = scenario.rejects
        ? measurement.expectedRefusalPassed
        : measurement.membershipPassed === true && measurement.durationPassed === true;
      await writeJSON(join(directory, method + ".json"), measurement);
    }
    results.push(result);
  }
  const outputFiles = [];
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await inventory(path);
      else
        outputFiles.push({ path: path.slice(out.length + 1), sha256: hash(await readFile(path)) });
    }
  }
  await inventory(out);
  const report = {
    sourceCommit: run("git", ["rev-parse", "HEAD"]).stdout.toString().trim(),
    invocation:
      "node packages/test-harness/editing/render-reproduction.mjs --case av-replacement --out EMPTY_DIRECTORY" +
      (platformRate ? " --platform-rate" : ""),
    sourceHashes: [
      { path: source, sha256: hash(await readFile(source)) },
      { path: timing, sha256: hash(await readFile(timing)) },
      {
        path: fileURLToPath(new URL("./render-membership.mjs", import.meta.url)),
        sha256: hash(await readFile(new URL("./render-membership.mjs", import.meta.url))),
      },
      {
        path: fileURLToPath(import.meta.url),
        sha256: hash(await readFile(fileURLToPath(import.meta.url))),
      },
      {
        path: fileURLToPath(new URL("./render-reproduction-verify.mjs", import.meta.url)),
        sha256: hash(await readFile(new URL("./render-reproduction-verify.mjs", import.meta.url))),
      },
    ],
    versions: {
      swift: run("swiftc", ["--version"]).stdout.toString().trim(),
      os: run("sw_vers", []).stdout.toString().trim(),
      hardware: run("sysctl", ["-n", "machdep.cpu.brand_string"]).stdout.toString().trim(),
      ffmpeg: run("ffmpeg", ["-version"]).stdout.toString().split("\n")[0],
    },
    inputs,
    colors,
    results,
    outputs: outputFiles,
    limitations: [
      "Research supports one visible video occurrence at a time; general layer composition belongs to slice15.",
      "Color tags on tagged-a/b declare the known generator's sRGB primaries/transfer and BT.601 encoding matrix; original bytes are untouched.",
      "No general untagged-input color policy is selected by this experiment.",
      "Full captured-source preservation and production-entry-point parity remain adoption gates.",
      "Resource measurements cover tiny fixtures and the native worker only, not the JS verifier, compiler or long-project scaling.",
      "Audio probes are numerical, not independent listening evidence.",
      "Composition exporter AAC waveform errors are reported without an invented quality threshold; bounded PCM has an exact sample-domain gate.",
    ],
  };
  await writeJSON(join(out, "report.json"), report);
  run(process.execPath, [
    fileURLToPath(new URL("./render-reproduction-verify.mjs", import.meta.url)),
    "--out",
    out,
  ]);
  console.log(
    JSON.stringify(
      {
        out,
        cases: results.map((result) => ({
          name: result.name,
          composition: result.methods.composition.temporalPassed,
          bounded: result.methods.bounded.temporalPassed,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
