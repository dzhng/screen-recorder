import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { signalSupport, tonePitch } from "./stretch-measurements.mjs";

// Recover only missing isolated PCM; every plot input is hash checked before admission.
const root = fileURLToPath(new URL("../../../", import.meta.url));
assert.equal(
  process.argv.length,
  5,
  "native reference, Signalsmith reference, fresh output required",
);
const [reference, frozen, destination] = process.argv.slice(2).map((path) => resolve(path));
assert.ok(
  reference && frozen && destination,
  "native reference, Signalsmith reference, fresh output required",
);
assert.ok(!existsSync(destination), "Choose a fresh output directory");
mkdirSync(destination, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const reportPath = join(root, "specs/agent-editing/assets/13a-support-review/report.json");
const corrected = JSON.parse(readFileSync(reportPath));
const vendor = join(root, "helpers/stretch/Sources/CSignalsmith/vendor");
const dependency = JSON.parse(readFileSync(join(vendor, "sources.json")));
for (const file of dependency.files)
  assert.equal(hash(readFileSync(join(vendor, file.path))), file.sha256);
const cpp = join(root, "packages/test-harness/editing/stretch/Signalsmith.cpp");
assert.equal(hash(readFileSync(cpp)), corrected.cppSha256);
const run = (command, args) =>
  execFileSync(command, args, { timeout: 60000, maxBuffer: 40 * 1024 * 1024 });
const executable = join(destination, "signalsmith");
run("clang++", ["-std=c++17", "-O2", "-I", join(vendor, ".."), cpp, "-o", executable]);
const evidence = {
  protocol: 1,
  correctedReportSha256: hash(readFileSync(reportPath)),
  cppSha256: corrected.cppSha256,
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  dependency,
  compiler: run("clang++", ["--version"]).toString(),
  executableSha256: hash(readFileSync(executable)),
  loaded: [],
  endpoints: [],
  tones: [],
  admission: [],
  shortPitch: [],
  listening: "UNVERIFIED",
};
function checked(path, expected) {
  assert.equal(typeof expected, "string", `Missing trusted hash for ${path}`);
  const bytes = readFileSync(path);
  assert.equal(hash(bytes), expected, path);
  evidence.loaded.push({ path, sha256: expected, frames: bytes.length / 4 });
  return bytes;
}
function render(input, output, n, m, mode = "exact", block = 0) {
  return JSON.parse(
    run(executable, [input, output, "0", String(n), String(m), mode, String(block)]),
  );
}
for (const row of corrected.endpoints) {
  const id = `endpoints-${row.phase}-${row.speed}`;
  checked(join(frozen, `endpoints-${row.phase}.f32`), row.inputSha256);
  checked(join(frozen, `${id}-exact.f32`), row.sha256);
  checked(join(frozen, `${id}-tail.f32`), row.tailSha256);
  for (const isolated of row.isolated) {
    const bytes = Buffer.alloc(72000 * 4);
    bytes.writeFloatLE(0.8, isolated.sourceFrame * 4);
    assert.equal(hash(bytes), isolated.inputSha256);
    const input = join(destination, `${id}-${isolated.side}-input.f32`);
    writeFileSync(input, bytes);
    checked(input, isolated.inputSha256);
    const paths = {};
    for (const mode of ["exact", "tail"]) {
      const name = `${id}-${isolated.side}-${mode}.f32`,
        old = join(frozen, name);
      const path = existsSync(old) ? old : join(destination, name);
      if (!existsSync(old)) render(input, path, 72000, row.wanted, mode);
      const output = checked(path, isolated[`${mode}Sha256`]);
      assert.deepEqual(
        signalSupport(output, {
          nominal: isolated.sourceFrame / row.speed,
          offset: mode === "tail" ? row.exact.outputLatency : 0,
        }),
        isolated[mode],
      );
      paths[mode] = path;
    }
    evidence.endpoints.push({
      phase: row.phase,
      speed: row.speed,
      wanted: row.wanted,
      side: isolated.side,
      sourceFrame: isolated.sourceFrame,
      input,
      ...paths,
      exactSupport: isolated.exact,
      tailSupport: isolated.tail,
    });
  }
}
for (const row of corrected.results.filter((row) => row.case === "tone")) {
  const input = join(reference, "tone-input.f32"),
    exact = join(frozen, `tone-${row.speed}-exact.f32`);
  checked(input, row.inputSha256);
  checked(exact, row.sha256);
  evidence.tones.push({ speed: row.speed, input, exact, pitch: row.pitch });
}
// Match the pinned float implementation, including rounded requested output count.
const seekLength = (n, m, latency) =>
  Math.trunc(Math.fround(latency + Math.fround(Math.fround(n / m) * latency)));
for (const block of [5760, 256])
  for (const speed of [0.8, 0.9, 1.25]) {
    const latency = block / 2;
    let boundary = 1;
    while (boundary < seekLength(boundary, Math.floor(boundary / speed), latency)) boundary++;
    for (const n of [boundary - 1, boundary, boundary + 1]) {
      const m = Math.floor(n / speed),
        id = `admission-${block}-${speed}-${n}`;
      const input = join(destination, `${id}.f32`),
        output = join(destination, `${id}-exact.f32`);
      writeFileSync(input, Buffer.alloc(n * 4));
      const execution = spawnSync(
        executable,
        [input, output, "0", String(n), String(m), "exact", String(block)],
        { timeout: 60000 },
      );
      assert.equal(execution.error, undefined);
      const accepted = n >= seekLength(n, m, latency);
      assert.equal(execution.status, accepted ? 0 : 1);
      if (accepted) assert.equal(readFileSync(output).length, m * 4);
      else {
        assert.match(execution.stderr.toString(), /too short/);
        assert.equal(existsSync(output), false);
      }
      evidence.admission.push({
        block,
        speed,
        selectedFrames: n,
        outputFrames: m,
        seekLength: seekLength(n, m, latency),
        accepted,
      });
    }
  }
// Identity has no seek requirement, including a one-frame selection.
evidence.identity = [];
for (const block of [5760, 256]) {
  const input = join(destination, `identity-${block}.f32`);
  const bytes = Buffer.alloc(4);
  bytes.writeFloatLE(0.375);
  writeFileSync(input, bytes);
  const output = join(destination, `identity-${block}-exact.f32`);
  const metadata = render(input, output, 1, 1, "exact", block);
  assert.deepEqual(readFileSync(output), bytes);
  assert.equal(metadata.identityBypass, true);
  evidence.identity.push({
    block,
    selectedFrames: 1,
    outputFrames: 1,
    sha256: hash(bytes),
    metadata,
  });
}
// Duration changes measurement availability even when the native request is admitted.
// These results remain separate from admission and do not enable an automatic fallback.
for (const frames of [4800, 480]) {
  const tone = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++)
    tone.writeFloatLE(0.2 * Math.sin((2 * Math.PI * 120 * i) / 48000), i * 4);
  const lowInput = join(destination, `short-120hz-${frames}frames.f32`);
  writeFileSync(lowInput, tone);
  for (const speed of [0.8, 0.9, 1, 1.25]) {
    const wanted = Math.floor(frames / speed),
      path = join(destination, `short-120hz-${frames}frames-${speed}-exact.f32`);
    const metadata = render(lowInput, path, frames, wanted, "exact", 256),
      bytes = readFileSync(path);
    assert.equal(bytes.length, wanted * 4);
    signalSupport(bytes);
    if (wanted === frames) assert.deepEqual(bytes, tone);
    const pitch = tonePitch(bytes, 120);
    evidence.shortPitch.push({
      block: 256,
      speed,
      selectedFrames: frames,
      outputFrames: wanted,
      inputSha256: hash(tone),
      outputSha256: hash(bytes),
      metadata,
      pitch,
      pitchGatePassed: pitch.status === "measured" && pitch.errorPercent < 1,
    });
  }
}
writeFileSync(join(destination, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(
  JSON.stringify({
    destination,
    endpoints: evidence.endpoints.length,
    admission: evidence.admission.length,
    shortPitch: evidence.shortPitch,
  }),
);
