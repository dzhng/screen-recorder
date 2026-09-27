import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const reference = resolve(process.argv[2]),
  out = resolve(process.argv[3]);
assert.ok(!existsSync(out));
mkdirSync(out, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const source = join(root, "packages/test-harness/editing/stretch/Signalsmith.cpp"),
  executable = join(out, "signalsmith");
execFileSync(
  "clang++",
  [
    "-std=c++17",
    "-O2",
    "-I",
    join(root, "packages/test-harness/editing/stretch/vendor"),
    source,
    "-o",
    executable,
  ],
  { timeout: 60000 },
);
const rate = 48000;
const tone = (frames, hz) => {
  const b = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++)
    b.writeFloatLE(0.2 * Math.sin((2 * Math.PI * hz * i) / rate), i * 4);
  return b;
};
const edges = (frames) => {
  const b = Buffer.alloc(frames * 4);
  b.writeFloatLE(0.8, 0);
  b.writeFloatLE(0.8, (frames - 1) * 4);
  return b;
};
const cases = [
  ["tone-10ms", tone(480, 1000)],
  ["edge-10ms", edges(480)],
  ["edge-5ms", edges(240)],
  ["tone-100ms", tone(4800, 440)],
  [
    "real-100ms",
    readFileSync(join(reference, "local-phrase-input.f32")).subarray(24000 * 4, 28800 * 4),
  ],
  ["tone-3s", readFileSync(join(reference, "tone-input.f32"))],
  ["impulses-3s", readFileSync(join(reference, "impulses-input.f32"))],
];
const report = {
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  cppSha256: hash(readFileSync(source)),
  sourceCommit: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  hypothesis:
    "A fixed256sample analysis window can process10ms selected inputs without real neighboring context. Compare unchanged default preset; test long-tone regression before considering adoption.",
  configuration:
    "Portable FFT, fixedseed0, block256 interval64 versus default5760/1440; equal-count identity bypass",
  listening: "UNVERIFIED; short tones/impulses do not establish protected-word quality",
  results: [],
};
for (const [name, selected] of cases)
  for (const speed of [0.8, 0.9, 1, 1.25])
    for (const block of [0, 256]) {
      const n = selected.length / 4,
        wanted = Math.floor(n / speed),
        pad = 4800;
      const poison = Buffer.alloc((n + pad * 2) * 4);
      for (let i = 0; i < poison.length / 4; i++) poison.writeFloatLE(i % 2 ? 0.9 : -0.9, i * 4);
      selected.copy(poison, pad * 4);
      const input = join(out, `${name}-input.f32`),
        changed = join(out, `${name}-poison.f32`);
      writeFileSync(input, selected);
      writeFileSync(changed, poison);
      const path = join(out, `${name}-${speed}-${block}.f32`);
      const call = (file, start, end, output) =>
        spawnSync(
          executable,
          [file, output, String(start), String(end), String(wanted), "exact", String(block)],
          { encoding: "utf8", timeout: 60000 },
        );
      const run = call(input, 0, n, path),
        result = {
          case: name,
          speed,
          block,
          inputSha256: hash(selected),
          wanted,
          status: run.status,
        };
      assert.equal(run.error, undefined);
      if (run.status !== 0) {
        assert.match(run.stderr, /too short/);
        assert.equal(existsSync(path), false);
        result.reason = run.stderr.trim();
        report.results.push(result);
        continue;
      }
      result.metadata = JSON.parse(run.stdout);
      const bytes = readFileSync(path);
      assert.equal(bytes.length, wanted * 4);
      let peak = 0,
        sum = 0,
        crossings = [];
      for (let i = 0; i < wanted; i++) {
        let x = bytes.readFloatLE(i * 4);
        assert.ok(Number.isFinite(x));
        peak = Math.max(peak, Math.abs(x));
        sum += x * x;
        if (i > Math.floor(wanted * 0.25) && i < Math.floor(wanted * 0.75)) {
          let before = bytes.readFloatLE((i - 1) * 4);
          if (before <= 0 && x > 0) crossings.push(i - 1 - before / (x - before));
        }
      }
      result.peak = peak;
      result.rms = Math.sqrt(sum / wanted);
      result.sha256 = hash(bytes);
      if (name.startsWith("tone") && crossings.length > 2) {
        result.pitchHz = ((crossings.length - 1) * rate) / (crossings.at(-1) - crossings[0]);
        const hz = name === "tone-10ms" ? 1000 : 440;
        result.pitchErrorPercent = Math.abs(result.pitchHz / hz - 1) * 100;
      }
      if (wanted === n) assert.deepEqual(bytes, selected);
      const poisonPath = join(out, `${name}-${speed}-${block}-poison-output.f32`),
        altered = call(changed, pad, pad + n, poisonPath);
      assert.equal(altered.status, 0, altered.stderr);
      assert.deepEqual(readFileSync(poisonPath), bytes);
      result.excludedPoison = "bit-identical";
      report.results.push(result);
    }
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ out, results: report.results.length, listening: report.listening }));
