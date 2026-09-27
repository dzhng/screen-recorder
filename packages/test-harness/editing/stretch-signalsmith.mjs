import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { signalSupport, tonePitch, requirePitchAcceptance } from "./stretch-measurements.mjs";

// Matched-input comparison against the frozen native reproduction, not a new corpus.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const reference = resolve(process.argv[2]),
  out = resolve(process.argv[3]);
assert.ok(!existsSync(out), "Choose a fresh evidence directory");
mkdirSync(out, { recursive: true });
const run = (name, args, input) =>
  execFileSync(name, args, { input, timeout: 60000, maxBuffer: 40 * 1024 * 1024 });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const vendor = join(root, "packages/test-harness/editing/stretch/vendor");
const dependency = JSON.parse(readFileSync(join(vendor, "sources.json")));
for (const file of dependency.files)
  assert.equal(hash(readFileSync(join(vendor, file.path))), file.sha256);
const cpp = join(root, "packages/test-harness/editing/stretch/Signalsmith.cpp"),
  executable = join(out, "signalsmith");
run("clang++", ["-std=c++17", "-O2", "-I", vendor, cpp, "-o", executable]);
const baseline = JSON.parse(readFileSync(join(reference, "report.json")));
function wav(path, bytes) {
  const h = Buffer.alloc(44);
  h.write("RIFF");
  h.writeUInt32LE(bytes.length + 36, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(48000, 24);
  h.writeUInt32LE(192000, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(32, 34);
  h.write("data", 36);
  h.writeUInt32LE(bytes.length, 40);
  writeFileSync(path, Buffer.concat([h, bytes]));
}
function energy(b, first = 0, end = b.length / 4) {
  let sumSquares = 0,
    peak = 0;
  for (let i = first; i < end; i++) {
    const x = b.readFloatLE(i * 4);
    assert.ok(Number.isFinite(x));
    sumSquares += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  return { sumSquares, peak };
}
function render(input, start, end, wanted, id, mode = "exact") {
  const output = join(out, `${id}-${mode}.f32`),
    stats = join(out, `${id}-${mode}-resources.txt`);
  const metadata = JSON.parse(
    run("/usr/bin/time", [
      "-l",
      "-o",
      stats,
      executable,
      input,
      output,
      String(start),
      String(end),
      String(wanted),
      mode,
    ]),
  );
  const bytes = readFileSync(output);
  assert.equal(bytes.length / 4, metadata.frames);
  const peakResidentBytes = Number(
    readFileSync(stats, "utf8").match(/(\d+)\s+maximum resident set size/)[1],
  );
  return { bytes, metadata, peakResidentBytes };
}
const report = {
  sourceCommit: run("git", ["-C", root, "rev-parse", "HEAD"]).toString().trim(),
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  cppSha256: hash(readFileSync(cpp)),
  referenceReportSha256: hash(readFileSync(join(reference, "report.json"))),
  dependency,
  compiler: run("clang++", ["--version"]).toString(),
  flags: ["-std=c++17", "-O2"],
  sampleRate: 48000,
  supportThresholdAmplitude: 1e-7,
  supportScope:
    "Entire admitted exact/raw-tail output; isolated endpoint impulses avoid attributing combined support to one impulse",
  measurementsSha256: hash(readFileSync(new URL("./stretch-measurements.mjs", import.meta.url))),
  recipe:
    "Equal input/output frame counts copy selected PCM exactly. Otherwise presetDefault mono48k, fixed seed0, pitch factor1, exact(selected input, declared output count). Upstream outputSeek handles preroll; flush subtracts reversed residual tail to shape endpoints. No post-hoc crop, extra real source, added output zero padding or wrapper crossfade. Tail mode separately follows upstream seek/process/flush example for support diagnostics.",
  listening: "UNVERIFIED; endpoint impulse spread or attenuation is not missing-speech evidence",
  results: [],
  endpoints: [],
  shortInput: null,
};
for (const base of baseline.results) {
  const input = join(reference, `${base.case}-input.f32`),
    source = readFileSync(input);
  assert.equal(hash(source), base.inputSha256);
  const [start, end] = base.sourceFrames,
    wanted = base.expectedFrames,
    id = `${base.case}-${base.speed}`;
  const exact = render(input, start, end, wanted, id),
    tail = render(input, start, end, wanted, id, "tail");
  assert.equal(exact.bytes.length / 4, wanted);
  if (wanted === end - start) {
    assert.deepEqual(exact.bytes, source.subarray(start * 4, end * 4));
    assert.equal(exact.metadata.identityBypass, true);
  }
  const result = {
    case: base.case,
    speed: base.speed,
    sourceFrames: [start, end],
    inputSha256: hash(source),
    expectedFrames: wanted,
    exact: exact.metadata,
    peakResidentBytes: exact.peakResidentBytes,
    sha256: hash(exact.bytes),
    energy: energy(exact.bytes),
    tail: tail.metadata,
    tailEnergy: energy(tail.bytes, wanted + tail.metadata.outputLatency),
    preRollEnergy: energy(tail.bytes, 0, tail.metadata.outputLatency),
  };
  if (base.case === "tone") {
    result.pitch = tonePitch(exact.bytes, 440, 101);
    requirePitchAcceptance(result.pitch, id);
  }
  if (base.case === "silence") assert.equal(result.energy.peak, 0);
  wav(join(out, `${id}.wav`), exact.bytes);
  if (base.case === "impulses")
    result.support = {
      exact: signalSupport(exact.bytes),
      tail: signalSupport(tail.bytes, { offset: tail.metadata.outputLatency }),
    };
  if (base.case === "local-phrase") {
    const context = Buffer.concat([
      source.subarray(0, start * 4),
      exact.bytes,
      source.subarray(end * 4),
    ]);
    assert.deepEqual(context.subarray(0, start * 4), source.subarray(0, start * 4));
    assert.deepEqual(context.subarray((start + wanted) * 4), source.subarray(end * 4));
    wav(join(out, `${id}-context.wav`), context);
    const poison = Buffer.from(source);
    for (let i = 0; i < source.length / 4; i++)
      if (i < start || i >= end) poison.writeFloatLE(i % 2 ? 0.9 : -0.9, i * 4);
    const path = join(out, `${id}-poison.f32`);
    writeFileSync(path, poison);
    const altered = render(path, start, end, wanted, `${id}-poison`);
    assert.deepEqual(altered.bytes, exact.bytes);
    result.untouchedNeighbors = "bit-identical";
    result.excludedSourcePoison = "bit-identical selected output";
  }
  report.results.push(result);
}
// Endpoint phases are synthetic diagnostics, not a surrogate for protected spoken words.
for (const phase of [0, 1, 17, 137])
  for (const speed of [0.8, 0.9, 1, 1.25]) {
    const frames = 72000,
      input = Buffer.alloc(frames * 4);
    input.writeFloatLE(0.8, phase * 4);
    input.writeFloatLE(0.8, (frames - 1 - phase) * 4);
    const path = join(out, `endpoints-${phase}.f32`);
    writeFileSync(path, input);
    const wanted = Math.floor(frames / speed),
      id = `endpoints-${phase}-${speed}`;
    const exact = render(path, 0, frames, wanted, id),
      tail = render(path, 0, frames, wanted, id, "tail");
    const isolated = [];
    for (const [side, sourceFrame] of [
      ["leading", phase],
      ["trailing", frames - 1 - phase],
    ]) {
      const selected = Buffer.alloc(frames * 4);
      selected.writeFloatLE(0.8, sourceFrame * 4);
      const isolatedPath = join(out, `endpoint-${phase}-${side}.f32`);
      writeFileSync(isolatedPath, selected);
      const alone = render(isolatedPath, 0, frames, wanted, `${id}-${side}`);
      const raw = render(isolatedPath, 0, frames, wanted, `${id}-${side}`, "tail");
      isolated.push({
        side,
        sourceFrame,
        inputSha256: hash(selected),
        exactSha256: hash(alone.bytes),
        tailSha256: hash(raw.bytes),
        exact: signalSupport(alone.bytes, { nominal: sourceFrame / speed }),
        tail: signalSupport(raw.bytes, {
          nominal: sourceFrame / speed,
          offset: raw.metadata.outputLatency,
        }),
      });
    }
    report.endpoints.push({
      phase,
      speed,
      wanted,
      exact: exact.metadata,
      inputSha256: hash(input),
      sha256: hash(exact.bytes),
      tailSha256: hash(tail.bytes),
      combinedSupport: {
        exact: signalSupport(exact.bytes),
        tail: signalSupport(tail.bytes, { offset: tail.metadata.outputLatency }),
      },
      isolated,
      tailEnergy: energy(tail.bytes, wanted + tail.metadata.outputLatency),
    });
  }
const short = join(out, "short.f32");
writeFileSync(short, Buffer.alloc(480 * 4));
try {
  render(short, 0, 480, 600, "short");
  assert.fail("Short exact request must report unsupported");
} catch (error) {
  assert.equal(error.status, 1);
  assert.match(error.stderr.toString(), /too short/);
  report.shortInput = "10ms input explicitly rejected, not returned as silent successful output";
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    out,
    matched: report.results.length,
    endpoints: report.endpoints.length,
    listening: report.listening,
  }),
);
