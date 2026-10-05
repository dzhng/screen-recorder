import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({ options: { out: { type: "string" } } });
assert.ok(values.out);
const out = resolve(values.out),
  root = new URL("../../../", import.meta.url).pathname;
const frozen = join(root, "specs/done/agent-editing/assets/20a-capture-owner-gap/run/native");
const binary = join(root, "helpers/mac/.build/debug/CameraReproduction");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const save = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2));
const read = (p) => JSON.parse(readFileSync(p));
function command(exe, args, expected = 0) {
  const r = spawnSync(exe, args, { cwd: root, timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.status, expected, r.stderr?.toString());
  return r.stdout;
}
const pcm = (p) =>
  command("ffmpeg", [
    "-v",
    "error",
    "-i",
    p,
    "-map",
    "0:a:0",
    "-f",
    "f32le",
    "-c:a",
    "pcm_f32le",
    "-",
  ]);
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), []);
writeFileSync(
  join(out, "build.log"),
  command("swift", [
    "build",
    "--build-system",
    "native",
    "--package-path",
    "helpers/mac",
    "--product",
    "CameraReproduction",
  ]),
);
const exact = (value, timescale) => ({ value, timescale });
const run = (firstFrame, frames, sourceStart) => ({ firstFrame, frames, sourceStart });
const omitted = join(frozen, "omitted-buffer/narration.mov");
const first = run(0, 32768, exact(100000, 1000000));
const raw = read(join(frozen, "omitted-buffer/input.json"));
assert.equal(raw.inputs[0].hostUs - raw.originHostUs, 100000);
assert.equal(raw.inputs[5].mediaPTSValue, 40960);
const rationalRuns = [first, run(32768, 55040, exact(4800 + raw.inputs[5].mediaPTSValue, 48000))];
const roundedRuns = [
  first,
  run(32768, 55040, exact(raw.inputs[5].hostUs - raw.originHostUs, 1000000)),
];
function invoke(name, payload, rate, runs, stopAfter, expected = 0) {
  const output = join(out, name),
    request = { payload, output, rate, runs, ...(stopAfter ? { stopAfter } : {}) };
  const requestPath = join(out, `${name}-${stopAfter ?? "finish"}.request.json`);
  save(requestPath, request);
  const r = spawnSync(binary, ["--sparse-storage", requestPath], {
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(r.error);
  writeFileSync(requestPath + ".log", r.stderr ?? "");
  assert.equal(r.status, expected, r.stderr?.toString());
  return output;
}
const report = {
  scope:
    "Offline storage proof with explicitly probe-known frame mapping; no production repair or physical sync",
  binarySha256: hash(readFileSync(binary)),
  checks: [],
  phase: {},
};
function verify(name, payload, rate, runs) {
  const dir = invoke(name, payload, rate, runs),
    receipt = read(join(dir, "complete.json"));
  const full = pcm(join(dir, "full.wav")),
    meta = read(join(dir, "full.json"));
  const lastRun = runs.at(-1);
  const denominator = BigInt(lastRun.sourceStart.timescale) * BigInt(rate);
  const endNumerator =
    BigInt(lastRun.sourceStart.value) * BigInt(rate) +
    BigInt(lastRun.frames) * BigInt(lastRun.sourceStart.timescale);
  const endUs = (endNumerator * 1000000n + denominator / 2n) / denominator;
  const expectedFrames = Number((endUs * BigInt(rate)) / 1000000n);
  assert.equal(meta.sampleRate, rate);
  assert.equal(meta.frames, expectedFrames);
  assert.equal(full.length, expectedFrames * 4);
  const packed = pcm(payload);
  assert.equal(receipt.payloadSha256, hash(readFileSync(payload)));
  const packets = JSON.parse(
    command("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_packets",
      "-show_entries",
      "packet=pts,duration,size:stream=codec_name,sample_rate,time_base,duration_ts",
      "-select_streams",
      "a",
      "-of",
      "json",
      join(dir, "canonical.mov"),
    ]),
  );
  save(join(dir, "packets.json"), packets);
  const physical = command("ffmpeg", [
    "-v",
    "error",
    "-ignore_editlist",
    "1",
    "-i",
    join(dir, "canonical.mov"),
    "-f",
    "f32le",
    "-",
  ]);
  assert.ok(
    physical.equals(packed),
    `${name}: physical media has only exact packed samples, no stored gap padding`,
  );
  if (rate === 48000 || name === "continuous-44100") {
    const expected = Buffer.alloc(expectedFrames * 4);
    for (const r of runs) {
      // Place original frame identities directly from the requested rational source time.
      const start = Number(
        (BigInt(r.sourceStart.value) * BigInt(rate)) / BigInt(r.sourceStart.timescale),
      );
      packed.copy(expected, start * 4, r.firstFrame * 4, (r.firstFrame + r.frames) * 4);
    }
    assert.ok(full.equals(expected), `${name}: exact PCM identities at requested source positions`);
  }
  if (runs.length === 1)
    assert.ok(
      full.equals(pcm(join(dir, "reference.wav"))),
      `${name}: unchanged continuous reader result`,
    );
  if (existsSync(join(dir, "late.wav"))) {
    const late = read(join(dir, "late.json"));
    assert.ok(
      pcm(join(dir, "late.wav")).equals(
        full.subarray(late.sampleRange.start * 4, late.sampleRange.end * 4),
      ),
      `${name}: late seek vs full`,
    );
  }
  report.checks.push({
    name,
    exactSegments: receipt.segments,
    packedFrames: packed.length / 4,
    fullFrames: meta.frames,
    unavailable: meta.unavailable,
    canonicalSha256: receipt.canonicalSha256,
  });
  return full;
}
verify("continuous-owner", join(frozen, "continuous/narration.mov"), 48000, [
  run(0, 96000, exact(100000, 1000000)),
]);
const rounded = verify("omitted-rounded", omitted, 48000, roundedRuns);
const rational = verify("omitted-rational", omitted, 48000, rationalRuns);
assert.ok(
  !rounded.equals(rational),
  "Exact rational placement must remain distinct from the rounded control",
);
const original = pcm(join(root, "specs/done/agent-editing/assets/00-corpus/a-audio.wav"));
assert.ok(
  rational.subarray(57600 * 4, 67200 * 4).equals(original.subarray(52800 * 4, 62400 * 4)),
  "Late rational read preserves the original sample identities",
);
assert.ok(rounded.subarray(57600 * 4, 67200 * 4).equals(original.subarray(52801 * 4, 62401 * 4)));
report.phase = {
  roundedPreservesOriginalSamples: false,
  roundedSecondStartFrame: 45759,
  rationalContainerSecondStartFrame: 45760,
  rationalReadSecondStartFrame: 45760,
  rationalPreservesOriginalSamples: true,
  originalLateFirstFrame: 52800,
  roundedLateFirstFrame: 52801,
};
const pause = read(join(frozen, "pause/capture-result.json")).pauses[0].elapsedPauseUs;
verify("pause-rational", join(frozen, "pause/narration.mov"), 48000, [
  first,
  run(32768, 55040, exact(45760 * 125 - pause * 6, 6000000)),
]);
for (const rate of [44100, 48000]) {
  const rawPath = join(out, `continuous-${rate}.f32`),
    movie = join(out, `continuous-${rate}.mov`);
  const data = Buffer.alloc(rate * 2 * 4);
  for (let i = 0; i < rate * 2; i++) data.writeFloatLE((((i * 97) % 1009) - 504) / 1024, i * 4);
  writeFileSync(rawPath, data);
  command("ffmpeg", [
    "-v",
    "error",
    "-f",
    "f32le",
    "-ar",
    String(rate),
    "-ac",
    "1",
    "-i",
    rawPath,
    "-c:a",
    "pcm_f32le",
    movie,
  ]);
  verify(`continuous-${rate}`, movie, rate, [run(0, rate * 2, exact(0, 1000000))]);
}
for (const boundary of ["export", "rename", "diagnostic"]) {
  const name = `interrupted-${boundary}`,
    dir = invoke(name, omitted, 48000, rationalRuns, boundary, 75);
  assert.equal(existsSync(join(dir, "canonical.mov")), boundary !== "export");
  assert.ok(!existsSync(join(dir, "complete.json")));
  if (boundary === "diagnostic") assert.ok(existsSync(join(dir, "full.wav")));
  invoke(name, omitted, 48000, rationalRuns);
  assert.ok(
    pcm(join(dir, "full.wav")).equals(rational),
    "Restarted diagnostic PCM retains exact measured result",
  );
  const prior = hash(readFileSync(join(dir, "canonical.mov")));
  invoke(name, omitted, 48000, rationalRuns);
  assert.equal(hash(readFileSync(join(dir, "canonical.mov"))), prior);
  invoke(name, omitted, 48000, roundedRuns, undefined, 2);
  report.checks.push({
    name,
    freshProcessResume: true,
    stablePublication: true,
    changedIntentRefused: true,
  });
}
for (const [name, runs] of [
  ["overlap", [first, run(32768, 55040, exact(700000, 1000000))]],
  ["beyond-tail", [run(0, 96000, exact(100000, 1000000))]],
  ["unsupported-phase-scale", [run(0, 8192, exact(1, 2147483647))]],
  ["too-many-runs", Array(9).fill(first)],
]) {
  const dir = invoke(name, omitted, 48000, runs, undefined, 2);
  assert.ok(!existsSync(join(dir, "complete.json")));
  report.checks.push({ name, refused: true });
}
const damaged = invoke("damaged-export", omitted, 48000, rationalRuns, "export", 75);
writeFileSync(join(damaged, "canonical.partial.mov"), "incomplete container");
// AVFoundation failure must refuse without a success marker; original packed payload remains available.
const req = join(out, "damaged-export-finish.request.json");
save(req, { payload: omitted, output: damaged, rate: 48000, runs: rationalRuns });
const refusal = spawnSync(binary, ["--sparse-storage", req], { timeout: 60000 });
assert.equal(refusal.status, 2);
assert.ok(!existsSync(join(damaged, "complete.json")));
writeFileSync(req + ".log", refusal.stderr ?? "");
report.checks.push({
  name: "damaged-export",
  refused: true,
  originalRetained: existsSync(omitted),
});
report.mechanismsVerified = true;
report.productionRepairReady = false;
save(join(out, "report.json"), report);
console.log(JSON.stringify(report, null, 2));
