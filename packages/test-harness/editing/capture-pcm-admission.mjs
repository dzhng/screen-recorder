import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({ options: { out: { type: "string" } } });
assert.ok(values.out);
const root = new URL("../../../", import.meta.url).pathname,
  out = resolve(values.out);
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), []);
const save = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2));
const hash = (b) => createHash("sha256").update(b).digest("hex");
function run(exe, args, options = {}) {
  const result = spawnSync(exe, args, {
    cwd: root,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
for (const product of ["ScreenRecorderCaptureTests", "CameraReproduction"])
  writeFileSync(
    join(out, product + "-build.log"),
    run("swift", ["build", "--package-path", "helpers/mac", "--product", product]),
  );
const binary = join(root, "helpers/mac/.build/debug/ScreenRecorderCaptureTests");
const storage = join(root, "helpers/mac/.build/debug/CameraReproduction");
const reference = join(
  root,
  "specs/agent-editing/assets/20a-sparse-storage/run/omitted-rational/canonical.mov",
);
run(binary, [], {
  env: {
    ...process.env,
    SCREENREC_PCM_ADMISSION_OUTPUT: join(out, "owner"),
    SCREENREC_PCM_ADMISSION_CANONICAL: reference,
  },
});
const owner = JSON.parse(readFileSync(join(out, "owner/report.json")));
let physical = 0;
function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}
const runs = owner.bankedPlacements.map((p) => {
  let n = BigInt(p.anchorUs) * BigInt(p.rate) + BigInt(p.firstFrame) * 1000000n,
    d = BigInt(p.rate) * 1000000n;
  const g = gcd(n, d);
  n /= g;
  d /= g;
  assert.ok(n <= BigInt(Number.MAX_SAFE_INTEGER) && d <= 2147483647n);
  const r = {
    firstFrame: physical,
    frames: p.frames,
    sourceStart: { value: Number(n), timescale: Number(d) },
  };
  physical += p.frames;
  return r;
});
const request = {
  payload: join(
    root,
    "specs/agent-editing/assets/20a-capture-owner-gap/run/native/omitted-buffer/narration.mov",
  ),
  output: join(out, "canonical"),
  rate: 48000,
  runs,
};
save(join(out, "storage.request.json"), request);
run(storage, ["--sparse-storage", join(out, "storage.request.json")]);
const pcm = (p) => run("ffmpeg", ["-v", "error", "-i", p, "-f", "f32le", "-"]);
const original = pcm(join(root, "specs/agent-editing/assets/00-corpus/a-audio.wav"));
const full = pcm(join(out, "canonical/full.wav")),
  late = pcm(join(out, "canonical/late.wav"));
assert.equal(full.length, 100800 * 4);
assert.equal(late.length, 9600 * 4);
assert.ok(
  late.equals(full.subarray(57600 * 4, 67200 * 4)) &&
    late.equals(original.subarray(52800 * 4, 62400 * 4)),
);
const baseline = pcm(join(out, "owner/baseline.wav")),
  masked = pcm(join(out, "owner/masked.wav"));
assert.ok(baseline.equals(late));
assert.equal(masked.length, baseline.length);
assert.notEqual(baseline.readFloatLE(4), 0, "Excluded output sample must have observable signal");
const expected = Buffer.from(baseline);
expected.fill(0, 4, 8);
assert.ok(masked.equals(expected), "Declared1us mask must exclude exactly output frame57601");
const preservationEnv = { ...process.env };
delete preservationEnv.SCREENREC_PCM_ADMISSION_OUTPUT;
delete preservationEnv.SCREENREC_CAPTURE_GAP_OUTPUT;
writeFileSync(join(out, "preservation.log"), run(binary, [], { env: preservationEnv }));
save(join(out, "report.json"), {
  scope: "offline admitted-time candidate; production writer not connected",
  owner: owner.cases,
  fullFrames: full.length / 4,
  lateFrames: late.length / 4,
  lateOriginalFirstFrame: 52800,
  fullLateOriginalPCMExact: true,
  explicitMask: {
    startUs: 1200041,
    endUs: 1200042,
    excludedAbsoluteOutputFrame: 57601,
    allOtherSamplesExact: true,
  },
  captureWorkerSha256: hash(readFileSync(binary)),
  storageWorkerSha256: hash(readFileSync(storage)),
  rolloutReady: false,
});
console.log(
  "Admitted-time owner, actual canonical PCM, explicit1us mask and capture preservation verified within candidate scope",
);
