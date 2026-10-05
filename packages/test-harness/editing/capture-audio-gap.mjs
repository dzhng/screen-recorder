import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { out: { type: "string" } },
});
assert.ok(values.out);
const out = resolve(values.out),
  root = new URL("../../../", import.meta.url).pathname;
const corpus = join(root, "specs/done/agent-editing/assets/00-corpus");
const binary = join(root, "helpers/mac/.build/debug/ScreenRecorderCaptureTests");
const hash = (b) => createHash("sha256").update(b).digest("hex");
function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    cwd: root,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr?.toString());
  return r.stdout;
}
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), []);
await writeFile(
  join(out, "build.log"),
  run("swift", [
    "build",
    "--build-system",
    "native",
    "--package-path",
    "helpers/mac",
    "--product",
    "ScreenRecorderCaptureTests",
  ]),
);
run(binary, [], {
  env: {
    ...process.env,
    SCREENREC_CAPTURE_GAP_OUTPUT: join(out, "native"),
    SCREENREC_CAPTURE_GAP_CORPUS: corpus,
  },
});
const native = join(out, "native");
function pcm(path) {
  return run("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-map",
    "0:a:0",
    "-f",
    "f32le",
    "-c:a",
    "pcm_f32le",
    "-",
  ]);
}
const original = pcm(join(corpus, "a-audio.wav"));
const report = {
  completed: false,
  scope: "Actual CaptureWriter callbacks with prerecorded buffers; no live capture",
  binarySha256: hash(await readFile(binary)),
  inputSha256: hash(await readFile(join(corpus, "a-audio.wav"))),
  modes: [],
};
for (const mode of ["continuous", "omitted-buffer", "pause"]) {
  const directory = join(native, mode);
  const input = JSON.parse(await readFile(join(directory, "input.json"), "utf8"));
  const result = JSON.parse(await readFile(join(directory, "capture-result.json"), "utf8"));
  const recovery = JSON.parse(await readFile(join(directory, "recovery.json"), "utf8"));
  const journal = (await readFile(join(directory, "capture.journal.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  const acquired = journal.filter((e) => e.event === "audioSamples").map((e) => e.data);
  const narration = result.tracks.find((t) => t.role === "narration");
  assert.equal(
    narration.droppedSamples,
    0,
    "Backpressure must not confound the omission experiment",
  );
  assert.equal(narration.samples, acquired.length);
  const admitted = [],
    omitted = [];
  for (const sample of input.inputs) {
    const relative = sample.hostUs - input.originHostUs;
    const crossesPause = result.pauses.some(
      (p) =>
        relative < p.atSourceUs + p.elapsedPauseUs && relative + sample.durationUs > p.atSourceUs,
    );
    if (sample.deliveredToWriter && !crossesPause) admitted.push(sample);
    else omitted.push(sample);
  }
  assert.equal(acquired.length, admitted.length);
  const chunks = admitted.map((sample) => {
    const first = (sample.mediaPTSValue * sample.sampleRate) / sample.mediaPTSTimescale;
    assert.ok(Number.isInteger(first));
    return original.subarray(first * 4, (first + sample.frames) * 4);
  });
  const expectedPacked = Buffer.concat(chunks);
  const delivered = pcm(join(directory, "narration.mov"));
  await writeFile(join(directory, "decoded.f32"), delivered);
  const packedIdentity = delivered.equals(expectedPacked);
  assert.ok(
    packedIdentity,
    "Decoded PCM must identify exactly which admitted input samples survived",
  );
  const metadata = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_packets",
      "-select_streams",
      "a",
      "-of",
      "json",
      join(directory, "narration.mov"),
    ]).toString(),
  );
  await writeFile(join(directory, "packets.json"), JSON.stringify(metadata));
  const first = metadata.packets[0],
    last = metadata.packets.at(-1);
  const actualStartUs = Math.round(Number(first.pts_time) * 1000000);
  const actualEndUs = Math.round((Number(last.pts_time) + Number(last.duration_time)) * 1000000);
  assert.equal(actualStartUs, narration.firstSampleUs);
  const requestedEndUs = narration.lastSampleEndUs;
  report.modes.push({
    mode,
    suppliedBuffers: input.inputs.length,
    submittedBuffers: input.inputs.filter((s) => s.deliveredToWriter).length,
    admittedBuffers: acquired.length,
    omittedIndices: omitted.map((s) => s.index),
    productionDropped: narration.droppedSamples,
    productionOmitted: narration.omittedSamples,
    pauses: result.pauses,
    requestedEndUs,
    actualStartUs,
    actualEndUs,
    deficitUs: requestedEndUs - actualEndUs,
    decodedFrames: delivered.length / 4,
    packedIdentity,
    decodedSha256: hash(delivered),
    recoveredSupport: recovery.tracks.find((t) => t.role === "narration").intervals,
    timelineEndpointPreserved: Math.abs(requestedEndUs - actualEndUs) <= 1,
  });
}
assert.equal(report.modes[0].timelineEndpointPreserved, true, "Continuous input is the control");
assert.deepEqual(report.modes[1].omittedIndices, [4]);
assert.equal(
  report.modes[1].productionOmitted,
  0,
  "Known missing callback was omitted by the fixture",
);
assert.equal(
  report.modes[2].productionOmitted,
  report.modes[2].omittedIndices.length,
  "Real pause owner omitted crossing samples",
);
report.completed = true;
report.deliveredTimelinesPreserved = report.modes.every((m) => m.timelineEndpointPreserved);
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
