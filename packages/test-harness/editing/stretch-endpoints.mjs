import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = resolve(process.argv[2] ?? `/tmp/screenrec-stretch-endpoints-${Date.now()}`);
assert.ok(!existsSync(out), "Choose a fresh evidence directory");
mkdirSync(out, { recursive: true });
const run = (name, args, input) =>
  execFileSync(name, args, { input, timeout: 60000, maxBuffer: 40 * 1024 * 1024 });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const nativeSource = join(root, "packages/test-harness/editing/stretch/OfflineTimePitch.swift");
const executable = join(out, "offline-time-pitch");
run("swiftc", [nativeSource, "-o", executable]);
const rate = 48000,
  frames = 72000;
const narration = run("ffmpeg", [
  "-v",
  "error",
  "-i",
  join(root, "fixtures/narrated-workbench/narration.mov"),
  "-f",
  "f32le",
  "-ac",
  "1",
  "-ar",
  String(rate),
  "-",
]);
const phrase = narration.subarray(Math.floor(73.5 * rate) * 4, 75 * rate * 4);
const edges = Buffer.alloc(frames * 4);
edges.writeFloatLE(0.8, 0);
edges.writeFloatLE(0.8, (frames - 1) * 4);
function energy(bytes, start = 0, end = bytes.length / 4) {
  let sum = 0,
    peak = 0;
  for (let i = start; i < end; i++) {
    let x = bytes.readFloatLE(i * 4);
    sum += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  return { sumSquares: sum, peak };
}
function render(input, name, speed, expected) {
  const path = join(out, `${name}-input.f32`),
    output = join(out, `${name}-raw.f32`);
  writeFileSync(path, input);
  const receipt = JSON.parse(
    run(
      executable,
      [],
      JSON.stringify({
        input: path,
        output,
        startFrame: 0,
        endFrame: input.length / 4,
        speed,
        outputFrames: expected + 9600,
      }),
    ),
  );
  return { receipt, raw: readFileSync(output) };
}
const report = {
  sourceCommit: run("git", ["-C", root, "rev-parse", "HEAD"]).toString().trim(),
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  nativeSha256: hash(readFileSync(nativeSource)),
  description:
    "Probe endpoint support, not an accepted correction. Nominal boundaries use absolute padded-source frame/rate. No shifted crop or fitted correction applied.",
  sampleRate: rate,
  selectedFrames: frames,
  realPhraseFileRangeUs: [73500000, 75000000],
  results: [],
};
for (const [name, selected] of [
  ["edge-impulses", edges],
  ["real-phrase", phrase],
]) {
  for (const speed of [0.8, 0.9, 1, 1.25]) {
    for (const contextSeconds of [0, 0.02, 0.1, 0.25]) {
      const pad = Math.round(contextSeconds * rate),
        input = Buffer.concat([Buffer.alloc(pad * 4), selected, Buffer.alloc(pad * 4)]);
      const lower = Math.floor(pad / speed),
        upper = Math.floor((pad + frames) / speed),
        expected = Math.floor((pad * 2 + frames) / speed);
      const id = `${name}-${speed}-${contextSeconds}`;
      const { receipt, raw } = render(input, id, speed, expected);
      const whole = energy(raw),
        before = energy(raw, 0, lower),
        after = energy(raw, upper),
        inside = energy(raw, lower, upper);
      assert.equal(upper - lower, Math.floor(frames / speed));
      let peaks;
      if (name === "edge-impulses")
        peaks = [lower, (pad + frames - 1) / speed].map((at) => {
          let peak = 0,
            frame = 0;
          for (
            let i = Math.max(0, Math.floor(at) - 1024);
            i < Math.min(raw.length / 4, Math.ceil(at) + 1024);
            i++
          ) {
            let x = Math.abs(raw.readFloatLE(i * 4));
            if (x > peak) {
              peak = x;
              frame = i;
            }
          }
          return { nominalFrame: at, peakFrame: frame, offsetFrames: frame - at, peak };
        });
      report.results.push({
        case: name,
        speed,
        contextSeconds,
        context: "digital silence",
        inputSha256: hash(input),
        nominalOutput: [lower, upper],
        outputSha256: hash(raw),
        receipt,
        inside,
        before,
        after,
        retainedEnergyFraction: inside.sumSquares / whole.sumSquares,
        peaks,
      });
    }
    // Real context is measured explicitly, not silently admitted as selected source.
    const pad = 4800,
      sourceStart = Math.floor(73.5 * rate),
      input = Buffer.from(
        narration.subarray((sourceStart - pad) * 4, (sourceStart + frames + pad) * 4),
      );
    if (name === "real-phrase") {
      const lower = Math.floor(pad / speed),
        upper = Math.floor((pad + frames) / speed),
        expected = Math.floor((pad * 2 + frames) / speed);
      const clean = render(input, `context-${speed}`, speed, expected).raw;
      const poisoned = Buffer.from(input);
      for (let i = 0; i < input.length / 4; i++)
        if (i < pad || i >= pad + frames) poisoned.writeFloatLE(i % 2 ? 0.9 : -0.9, i * 4);
      const poison = render(poisoned, `context-poison-${speed}`, speed, expected).raw;
      let changed = 0,
        first = null,
        last = null,
        peakDifference = 0;
      for (let i = lower; i < upper; i++) {
        let delta = Math.abs(clean.readFloatLE(i * 4) - poison.readFloatLE(i * 4));
        if (delta > 1e-7) {
          changed++;
          first ??= i - lower;
          last = i - lower;
          peakDifference = Math.max(peakDifference, delta);
        }
      }
      report.results.push({
        case: name,
        speed,
        contextSeconds: 0.1,
        context: "real neighboring audio; excluded-source leakage probe",
        nominalOutput: [lower, upper],
        cleanSha256: hash(clean),
        poisonSha256: hash(poison),
        changedSelectedFrames: changed,
        firstChangedSelectedFrame: first,
        lastChangedSelectedFrame: last,
        peakDifference,
      });
    }
  }
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    out,
    results: report.results.length,
    status: "endpoint handling UNACCEPTED; no compensation inferred",
  }),
);
