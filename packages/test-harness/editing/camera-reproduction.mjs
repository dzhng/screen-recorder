import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { case: { type: "string" }, out: { type: "string" }, live: { type: "boolean" } },
});
assert.ok(
  !values.live,
  "Live capture is unsupported: explicit device selection, app permissions and physical test remain pending",
);
assert.equal(values.case, "shared-clock");
assert.ok(values.out, "Select an evidence output directory");
const root = new URL("../../../", import.meta.url).pathname;
const out = resolve(values.out);
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), [], "Evidence output must be empty");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.ifError(result.error);
  return result;
}
let binary = process.env.SCREENREC_CAMERA_PROBE;
if (!binary) {
  const build = run("swift", [
    "build",
    "--package-path",
    "helpers/mac",
    "--product",
    "CameraReproduction",
  ]);
  await writeFile(join(out, "build.log"), build.stdout + build.stderr);
  assert.equal(build.status, 0, build.stderr);
  binary = join(root, "helpers/mac/.build/debug/CameraReproduction");
}
const corpus = join(root, "specs/agent-editing/assets/00-corpus");
const inputs = [
  {
    role: "screen",
    path: join(corpus, "a.mov"),
    offsetUs: 0,
    simulatedRate: 1,
    simulatedAnchorUs: 7000000,
  },
  {
    role: "camera",
    path: join(corpus, "b.mov"),
    offsetUs: 200000,
    simulatedRate: 1.0002,
    simulatedAnchorUs: 23000000,
  },
  {
    role: "microphone",
    path: join(corpus, "a-audio.wav"),
    offsetUs: 100000,
    simulatedRate: 0.9997,
    simulatedAnchorUs: 43000000,
  },
];
const report = {
  completed: false,
  scope: "offline simulations only; no capture APIs activated",
  binarySha256: hash(await readFile(binary)),
  inputs: await Promise.all(
    inputs.map(async (input) => ({ ...input, sha256: hash(await readFile(input.path)) })),
  ),
  runs: [],
};
for (const name of ["offline", "restart", "conversion-bypass", "missing-microphone"]) {
  const request = {
    output: join(out, name),
    inputs:
      name === "missing-microphone"
        ? inputs.map((input) =>
            input.role === "microphone" ? { ...input, path: join(out, "missing.wav") } : input,
          )
        : inputs,
    bypassConversion: name === "conversion-bypass",
  };
  const file = join(out, name + ".request.json");
  await writeFile(file, JSON.stringify(request, null, 2));
  const result = run(binary, [file]);
  await writeFile(join(out, name + ".log"), result.stdout + result.stderr);
  const row = { name, status: result.status };
  report.runs.push(row);
  if (name === "conversion-bypass" || name === "missing-microphone") {
    assert.notEqual(result.status, 0, "Negative control must refuse");
    assert.match(
      result.stderr,
      name === "conversion-bypass" ? /Converted clock differs/ : /SOURCE_UNAVAILABLE/,
    );
    continue;
  }
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(await readFile(join(out, name, "report.json"), "utf8"));
  assert.deepEqual(receipt.pauses, [{ atSourceUs: 800000, elapsedPauseUs: 400000 }]);
  row.roles = [];
  for (const input of inputs) {
    const observations = (await readFile(join(out, name, input.role, "timestamps.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    const admitted = [];
    let omitted = 0;
    for (const observation of observations) {
      const relative =
        Math.round((observation.mediaPTS.value * 1000000) / observation.mediaPTS.timescale) +
        input.offsetUs;
      assert.equal(observation.intendedHostUs, receipt.originHostUs + relative);
      assert.ok(
        Math.abs(
          (observation.convertedHostPTS.value * 1000000) / observation.convertedHostPTS.timescale -
            observation.intendedHostUs,
        ) <= 1,
      );
      const paused = relative < 1200000 && relative + observation.durationUs > 800000;
      const expected = paused ? null : relative - (relative >= 1200000 ? 400000 : 0);
      assert.equal(
        observation.mappedUs ?? null,
        expected,
        "Existing pause map matches independent controlled fixture expectation",
      );
      if (paused) omitted++;
      else admitted.push({ startUs: expected, endUs: expected + observation.durationUs });
    }
    assert.ok(omitted > 0 && admitted.length > 0);
    const role = receipt.roles.find((role) => role.role === input.role);
    assert.equal(role.written, admitted.length);
    assert.equal(role.omitted, omitted);
    assert.equal(role.firstUs, input.offsetUs);
    assert.equal(role.endUs, Math.max(...admitted.map((s) => s.endUs)));
    const recovered = role.recovered.tracks.find(
      (track) => track.role === (input.role === "microphone" ? "narration" : "video"),
    );
    assert.equal(recovered.failure, undefined);
    assert.ok(recovered.decodeReachedEnd && recovered.decodedSamples > 0);
    assert.equal(role.recovered.journalFailure, undefined);
    assert.equal(
      recovered.acquisitionVerified,
      true,
      "Offline journal bounds are checked; this is not physical capture evidence",
    );
    assert.deepEqual(role.recovered.journal.pauses, receipt.pauses);

    if (input.role === "camera") {
      const partial = role.interrupted.tracks.find((track) => track.role === "video");
      assert.ok(partial.decodedSamples > 0 && partial.intervals.at(-1).endUs <= role.endUs);
    }
    const media = join(
      out,
      name,
      input.role,
      input.role === "microphone" ? "narration.mov" : "video.mov",
    );
    const probe = run("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_frames",
      "-of",
      "json",
      media,
    ]);
    assert.equal(probe.status, 0, probe.stderr);
    const delivered = JSON.parse(probe.stdout);
    assert.equal(delivered.streams.length, 1, "One separate source, no flattened presenter");
    assert.equal(delivered.streams[0].codec_type, input.role === "microphone" ? "audio" : "video");
    const times = delivered.frames.map((frame) =>
      Math.round(Number(frame.best_effort_timestamp_time) * 1000000),
    );
    if (input.role !== "microphone")
      assert.deepEqual(
        times,
        admitted.map((s) => s.startUs),
      );
    await writeFile(join(out, name, input.role, "delivered.json"), JSON.stringify(delivered));
    row.roles.push({
      role: input.role,
      admitted: admitted.length,
      omitted,
      firstUs: role.firstUs,
      endUs: role.endUs,
      decodedSamples: recovered.decodedSamples,
      recoveredIntervals: recovered.intervals,
      deliveredEndpointMatches: recovered.intervals.at(-1).endUs === role.endUs,
    });
  }
}
assert.deepEqual(
  report.runs[0].roles,
  report.runs[1].roles,
  "Fresh process repeats mapping/support without stale state",
);
report.deliveredTimelinesPreserved = report.runs[0].roles.every(
  (role) => role.deliveredEndpointMatches,
);
report.completed = true;
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
