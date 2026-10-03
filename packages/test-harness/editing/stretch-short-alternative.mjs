import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signalSupport, tonePitch } from "./stretch-measurements.mjs";

assert.ok(
  [7, 8].includes(process.argv.length),
  "source, reference, incumbent, fresh output, standard|short, optional parent report",
);
const [vendor, reference, incumbent, out] = process.argv.slice(2, 6).map((p) => resolve(p));
const window = process.argv[6];
assert.ok(["standard", "short"].includes(window));
const parentPath = process.argv[7] ? resolve(process.argv[7]) : null;
const parent = parentPath ? JSON.parse(readFileSync(parentPath)) : null;
const root = fileURLToPath(new URL("../../../", import.meta.url));
assert.ok(!existsSync(out));
mkdirSync(out, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const run = (command, args) =>
  execFileSync(command, args, { timeout: 60000, maxBuffer: 40 * 1024 * 1024 });
const revision = run("git", ["-C", vendor, "rev-parse", "HEAD"]).toString().trim();
assert.equal(revision, "1d95888bec3ae0a17c0c4af791810d5a63f6bc35");
assert.equal(
  run("git", ["-C", vendor, "status", "--porcelain"]).toString(),
  "",
  "Pinned dependency must be clean",
);
const baseline = JSON.parse(readFileSync(join(incumbent, "evidence.json")));
const signalsmith = join(incumbent, "signalsmith");
assert.equal(hash(readFileSync(signalsmith)), baseline.executableSha256);
const source = join(root, "packages/test-harness/editing/stretch/RubberBand.cpp"),
  executable = join(out, "rubberband");
const flags = [
  "-std=c++17",
  "-O2",
  "-I",
  vendor,
  source,
  join(vendor, "single/RubberBandSingle.cpp"),
  "-framework",
  "Accelerate",
  "-o",
  executable,
];
run("clang++", flags);
const frozen = JSON.parse(readFileSync(join(reference, "report.json")));
function trustedInput(name) {
  const bytes = readFileSync(join(reference, `${name}-input.f32`));
  assert.equal(hash(bytes), frozen.results.find((r) => r.case === name).inputSha256);
  return bytes;
}
function tone(frames, hz) {
  const bytes = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++)
    bytes.writeFloatLE(0.2 * Math.sin((2 * Math.PI * hz * i) / 48000), i * 4);
  return bytes;
}
function impulses(frames, phase) {
  const bytes = Buffer.alloc(frames * 4);
  bytes.writeFloatLE(0.8, phase * 4);
  bytes.writeFloatLE(0.8, (frames - 1 - phase) * 4);
  return bytes;
}
const cases = [
  { id: "tone-120hz-100ms", bytes: tone(4800, 120), hz: 120 },
  { id: "tone-440hz-50ms", bytes: tone(2400, 440), hz: 440 },
  { id: "tone-1000hz-10ms", bytes: tone(480, 1000), hz: 1000 },
  { id: "tone-120hz-10ms", bytes: tone(480, 120), hz: 120 },
  { id: "real-100ms", bytes: trustedInput("local-phrase").subarray(24000 * 4, 28800 * 4) },
  { id: "edges-10ms-phase0", bytes: impulses(480, 0) },
  { id: "edges-10ms-phase17", bytes: impulses(480, 17) },
  { id: "edges-5ms-phase0", bytes: impulses(240, 0) },
  { id: "tone-440hz-3s", bytes: trustedInput("tone"), hz: 440, minimumCrossings: 101 },
];
assert.equal(
  hash(cases[0].bytes),
  baseline.shortPitch.find((r) => r.selectedFrames === 4800).inputSha256,
);
assert.equal(
  hash(cases[3].bytes),
  baseline.shortPitch.find((r) => r.selectedFrames === 480).inputSha256,
);
if (parent) {
  assert.equal(parent.sourceRevision, revision);
  assert.equal(parent.cppSha256, hash(readFileSync(source)));
  assert.equal(
    parent.incumbentEvidenceSha256,
    hash(readFileSync(join(incumbent, "evidence.json"))),
  );
  for (const item of cases) {
    const rows = parent.results.filter((row) => row.case === item.id);
    assert.ok(rows.length > 0);
    for (const row of rows) assert.equal(row.inputSha256, hash(item.bytes));
  }
}
const report = {
  protocol: 1,
  window,
  parentReportSha256: parentPath ? hash(readFileSync(parentPath)) : null,
  sourceRevision: revision,
  sourceURL: "https://github.com/breakfastquay/rubberband",
  license: "GPL-2.0-or-later or commercial; research only, no adoption",
  cppSha256: hash(readFileSync(source)),
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  incumbentEvidenceSha256: hash(readFileSync(join(incumbent, "evidence.json"))),
  signalsmithExecutableSha256: baseline.executableSha256,
  executableSha256: hash(readFileSync(executable)),
  compiler: run("clang++", ["--version"]).toString(),
  flags,
  recipe: `RubberBand4 offline R3 ${window} window, mono48k, pitch1, timeRatio=M/N, threadingNever; study selected PCM then process1024-frame blocks to final; retrieve all output. Equal-count identity copies selected PCM. No wrapper crop/pad/fade; Apple vDSP via unmodified single translation unit.`,
  listening: "UNVERIFIED; real100ms is frozen source excerpt, not independent protected whole word",
  results: [],
};
for (const item of cases) {
  const n = item.bytes.length / 4,
    input = join(out, `${item.id}-input.f32`);
  writeFileSync(input, item.bytes);
  const pad = 2400,
    poison = Buffer.alloc((n + 2 * pad) * 4);
  for (let i = 0; i < poison.length / 4; i++) poison.writeFloatLE(i % 2 ? 0.9 : -0.9, i * 4);
  item.bytes.copy(poison, pad * 4);
  const poisonPath = join(out, `${item.id}-poison.f32`);
  writeFileSync(poisonPath, poison);
  for (const speed of [0.8, 0.9, 1, 1.25])
    for (const algorithm of [
      `rubberband-${window}`,
      ...(parent ? [] : ["signalsmith-default", "signalsmith-256"]),
    ]) {
      const wanted = Math.floor(n / speed),
        id = `${item.id}-${speed}-${algorithm}`,
        output = join(out, `${id}.f32`);
      const command = algorithm.startsWith("rubberband") ? executable : signalsmith;
      const args = (path, start, destination) => [
        path,
        destination,
        String(start),
        String(start + n),
        String(wanted),
        ...(algorithm.startsWith("rubberband")
          ? [window]
          : ["exact", algorithm === "signalsmith-256" ? "256" : "0"]),
      ];
      const execution = spawnSync(command, args(input, 0, output), {
        timeout: 60000,
        encoding: "utf8",
      });
      assert.equal(execution.error, undefined);
      const row = {
        case: item.id,
        algorithm,
        speed,
        selectedFrames: n,
        wanted,
        inputSha256: hash(item.bytes),
        exitCode: execution.status,
      };
      if (execution.status !== 0) {
        assert.ok(algorithm.startsWith("signalsmith"), execution.stderr);
        assert.match(execution.stderr, /Selected input too short/);
        assert.equal(existsSync(output), false);
        row.status = "unsupported";
        row.reason = execution.stderr.trim();
        report.results.push(row);
        continue;
      }
      row.metadata = JSON.parse(execution.stdout);
      const bytes = readFileSync(output);
      row.frames = bytes.length / 4;
      row.sha256 = hash(bytes);
      row.exactCount = row.frames === wanted;
      row.support = signalSupport(bytes);
      if (item.hz) {
        row.pitch = tonePitch(bytes, item.hz, item.minimumCrossings ?? 3);
        row.pitchGatePassed = row.pitch.status === "measured" && row.pitch.errorPercent < 1;
      }
      const poisonOutput = join(out, `${id}-poisoned.f32`),
        changed = spawnSync(command, args(poisonPath, pad, poisonOutput), {
          timeout: 60000,
          encoding: "utf8",
        });
      assert.equal(changed.error, undefined);
      assert.equal(changed.status, 0, changed.stderr);
      assert.deepEqual(readFileSync(poisonOutput), bytes);
      row.sourcePoisonIdentical = true;
      if (wanted === n) assert.deepEqual(bytes, item.bytes);
      row.status = "rendered";
      report.results.push(row);
    }
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    out,
    rows: report.results.length,
    failedGates: report.results
      .filter((r) => r.status === "rendered" && (!r.exactCount || r.pitchGatePassed === false))
      .map((r) => ({
        case: r.case,
        algorithm: r.algorithm,
        speed: r.speed,
        frames: r.frames,
        wanted: r.wanted,
        pitch: r.pitch,
      })),
  }),
);
