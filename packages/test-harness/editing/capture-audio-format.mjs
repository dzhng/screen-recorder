import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({ options: { out: { type: "string" } } });
assert.ok(values.out);
const root = new URL("../../../", import.meta.url).pathname;
const out = resolve(values.out),
  corpus = join(root, "specs/done/agent-editing/assets/00-corpus");
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), []);
const stereo = join(out, "stereo.wav");
run("ffmpeg", [
  "-v",
  "error",
  "-i",
  join(corpus, "a-audio.wav"),
  "-af",
  "pan=stereo|c0=c0|c1=-0.5*c0",
  "-c:a",
  "pcm_f32le",
  stereo,
]);
run("ffmpeg", ["-v", "error", "-i", stereo, "-c:a", "pcm_f64le", stereo + ".f64.wav"]);
await writeFile(
  join(out, "build.log"),
  run("swift", [
    "build",
    "--build-system",
    "native",
    "--package-path",
    "helpers/mac",
    "--product",
    "YapCaptureTests",
  ]),
);
const binary = join(root, "helpers/mac/.build/debug/YapCaptureTests");
await writeFile(
  join(out, "native.log"),
  run(binary, [], {
    env: {
      ...process.env,
      YAP_AUDIO_FORMAT_OUTPUT: join(out, "native"),
      YAP_CAPTURE_GAP_CORPUS: corpus,
      YAP_CAPTURE_FORMAT_STEREO: stereo,
    },
  }),
);
const modes = [
  "same-format",
  "representation",
  "initial-int16",
  "int16-to-float",
  "rate",
  "channels",
  "stereo-float",
  "stereo-planar",
  "packed24",
  "float64",
];
const report = {
  scope: "Actual CaptureWriter, prerecorded PCM; no capture devices",
  workerSHA256: createHash("sha256")
    .update(await readFile(binary))
    .digest("hex"),
  completed: false,
  modes: {},
};
for (const mode of modes) {
  const directory = join(out, "native", mode);
  const result = JSON.parse(await readFile(join(directory, "result.json"), "utf8"));
  const inputs = JSON.parse(await readFile(join(directory, "inputs.json"), "utf8"));
  const refusal = ["rate", "channels"].includes(mode);
  const track = result.tracks.find((x) => x.role === "narration");
  assert.equal(result.failure?.code, refusal ? "AUDIO_FORMAT_CHANGED" : undefined);
  assert.equal(track.samples, refusal ? 1 : 2);
  if (refusal) assert.equal(track.lastSampleEndUs, inputs[0].sourceUs + inputs[0].durationUs);
  const source = [];
  for (let index = 0; index < (refusal ? 1 : 2); index++) {
    const info = inputs[index];
    let raw = await readFile(join(directory, `input-${index}.raw`));
    const bytes = info.bits / 8;
    assert.equal(raw.length, info.frames * info.channels * bytes);
    if (info.flags & 32) {
      const interleaved = Buffer.alloc(raw.length);
      for (let frame = 0; frame < info.frames; frame++)
        for (let channel = 0; channel < info.channels; channel++)
          raw.copy(
            interleaved,
            (frame * info.channels + channel) * bytes,
            (channel * info.frames + frame) * bytes,
            (channel * info.frames + frame + 1) * bytes,
          );
      raw = interleaved;
    }
    const format = `${info.flags & 1 ? "f" : "s"}${info.bits}le`;
    source.push(
      run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          format,
          "-ar",
          String(info.rate),
          "-ac",
          String(info.channels),
          "-i",
          "pipe:0",
          "-f",
          "f32le",
          "-",
        ],
        { input: raw },
      ),
    );
  }
  const expected = Buffer.concat(source);
  const decoded = run("ffmpeg", [
    "-v",
    "error",
    "-ignore_editlist",
    "1",
    "-i",
    join(directory, track.file),
    "-map",
    "0:a:0",
    "-f",
    "f32le",
    "-",
  ]);
  await writeFile(join(directory, "expected.f32le"), expected);
  await writeFile(join(directory, "decoded.f32le"), decoded);
  assert.deepEqual(decoded, expected, mode);
  const events = (await readFile(join(directory, "capture.journal.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  const format = events.find((x) => x.event === "pcmTrack").data;
  assert.equal(format.rate, inputs[0].rate);
  assert.equal(format.channels, inputs[0].channels);
  assert.equal(Number(format.phaseUs), inputs[0].sourceUs);
  const acquisition = events.filter((x) => x.event === "pcmAppend");
  assert.equal(acquisition.length, refusal ? 1 : 2);
  let frames = 0;
  for (let index = 0; index < acquisition.length; index++) {
    assert.equal(Number(acquisition[index].data.physicalFirstFrame), frames);
    assert.equal(Number(acquisition[index].data.declaredFirstFrame), frames);
    assert.equal(Number(acquisition[index].data.frameCount), inputs[index].frames);
    frames += inputs[index].frames;
  }
  if (inputs[0].channels === 2)
    assert.ok(
      [...Array(expected.length / 8).keys()].some(
        (i) => !expected.subarray(i * 8, i * 8 + 4).equals(expected.subarray(i * 8 + 4, i * 8 + 8)),
      ),
    );
  report.modes[mode] = {
    acceptedBuffers: track.samples,
    decodedFrames: decoded.length / (4 * inputs[0].channels),
    exactInputPCM: true,
    failure: result.failure?.code ?? null,
    sha256: createHash("sha256").update(decoded).digest("hex"),
  };
}
report.completed = true;
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
