import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const selectedCase = option("--case", "all");
const out = resolve(option("--out", `/tmp/screenrec-stretch-${Date.now()}`));
assert.ok(
  !existsSync(out),
  "Choose a fresh output directory; frozen evidence is never overwritten",
);
mkdirSync(out, { recursive: true });
const run = (name, args, input) =>
  execFileSync(name, args, { input, timeout: 60000, maxBuffer: 40 * 1024 * 1024 });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const rate = 48000;
const swift = join(root, "packages/test-harness/editing/stretch/OfflineTimePitch.swift");
const executable = join(out, "offline-time-pitch");
run("swiftc", [swift, "-o", executable]);
const floats = (buffer) =>
  new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const pcm = (values) => Buffer.from(values.buffer, values.byteOffset, values.byteLength);
function wav(path, bytes) {
  const h = Buffer.alloc(44);
  h.write("RIFF");
  h.writeUInt32LE(bytes.length + 36, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(32, 34);
  h.write("data", 36);
  h.writeUInt32LE(bytes.length, 40);
  writeFileSync(path, Buffer.concat([h, bytes]));
}
function energy(samples) {
  let squares = 0,
    peak = 0;
  for (const x of samples) {
    assert.ok(Number.isFinite(x));
    squares += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  return { rms: Math.sqrt(squares / Math.max(1, samples.length)), peak };
}
function pitchHz(samples) {
  const crossings = [];
  for (let i = Math.floor(samples.length * 0.25) + 1; i < Math.floor(samples.length * 0.75); i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0)
      crossings.push(i - 1 - samples[i - 1] / (samples[i] - samples[i - 1]));
  }
  assert.ok(crossings.length > 100, "Tone must remain audible");
  return ((crossings.length - 1) * rate) / (crossings.at(-1) - crossings[0]);
}
const narrationPath = join(root, "fixtures/narrated-workbench/narration.mov");
const narration = run("ffmpeg", [
  "-v",
  "error",
  "-i",
  narrationPath,
  "-f",
  "f32le",
  "-ac",
  "1",
  "-ar",
  String(rate),
  "-",
]);
const real = floats(narration);
const tone = Float32Array.from(
  { length: rate * 3 },
  (_, i) => 0.2 * Math.sin((2 * Math.PI * 440 * i) / rate),
);
const impulses = new Float32Array(rate * 3);
for (const t of [0.02, 0.25, 1, 2, 2.98]) impulses[Math.floor(t * rate)] = 0.8;
const phrase = real.slice(73 * rate, 76 * rate);
const clicks = phrase.slice();
clicks[Math.floor(0.6 * rate)] += 0.7;
clicks[Math.floor(2.2 * rate)] -= 0.7;
const cases = [
  { name: "tone", samples: tone, authority: "synthetic 440 Hz" },
  {
    name: "impulses",
    samples: impulses,
    authority: "synthetic isolated transients including both endpoints",
  },
  { name: "silence", samples: new Float32Array(rate * 3), authority: "synthetic digital silence" },
  {
    name: "phrase",
    samples: phrase,
    fileRangeUs: [73000000, 76000000],
    authority: "real narration; no new audition",
  },
  {
    name: "rushed-candidate",
    samples: real.slice(99 * rate, 101 * rate),
    fileRangeUs: [99000000, 101000000],
    authority: "real narration; pace classification UNVERIFIED",
  },
  {
    name: "speech-with-clicks",
    samples: clicks,
    fileRangeUs: [73000000, 76000000],
    authority: "real narration plus synthetic clicks at 0.6s and 2.2s",
  },
  {
    name: "local-phrase",
    samples: phrase,
    start: rate / 2,
    end: rate * 2,
    fileRangeUs: [73000000, 76000000],
    authority:
      "real narration; central 0.5–2s only, untouched neighbors; boundaries NOT auditioned",
  },
].filter((c) => selectedCase === "all" || c.name === selectedCase);
assert.ok(cases.length, `Unknown case ${selectedCase}`);
const report = {
  status: "numerical reproduction only; speech/listening and visual review gates UNVERIFIED",
  sourceCommit: run("git", ["-C", root, "rev-parse", "HEAD"]).toString().trim(),
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  nativeSha256: hash(readFileSync(swift)),
  narration: {
    path: "fixtures/narrated-workbench/narration.mov",
    sha256: hash(readFileSync(narrationPath)),
    fileOriginUs: 48675,
  },
  environment: {
    os: run("sw_vers", []).toString(),
    hardware: run("sysctl", ["-n", "machdep.cpu.brand_string"]).toString().trim(),
    swift: run("swiftc", ["--version"]).toString(),
    ffmpeg: run("ffmpeg", ["-version"]).toString().split("\n")[0],
  },
  invocation: process.argv.slice(1),
  sampleRate: rate,
  channels: 1,
  recipe:
    "Clip source PCM before TimePitch; pitch=0, overlap=8, offline 4096-frame blocks. Render requested length plus 0.1s to observe tail, retain exactly floor(selectedFrames/speed). No inferred latency shift, fades, or hidden crossfades. Unit reports zero latency/tail; transient movement is measured separately.",
  distribution:
    "Native uses system AVFAudio. FFmpeg is a research comparator only, not a product dependency.",
  results: [],
};
for (const c of cases) {
  const input = join(out, `${c.name}-input.f32`),
    start = c.start ?? 0,
    end = c.end ?? c.samples.length;
  const inputBytes = pcm(c.samples);
  writeFileSync(input, inputBytes);
  wav(join(out, `${c.name}-input.wav`), inputBytes);
  for (const speed of [0.8, 0.9, 1, 1.25]) {
    const wanted = Math.floor((end - start) / speed),
      prefix = `${c.name}-${speed}`;
    const output = join(out, `${prefix}-native-raw.f32`),
      stats = join(out, `${prefix}-resources.txt`);
    const native = JSON.parse(
      run(
        "/usr/bin/time",
        ["-l", "-o", stats, executable],
        JSON.stringify({
          input,
          output,
          startFrame: start,
          endFrame: end,
          speed,
          outputFrames: wanted + 4800,
        }),
      ).toString(),
    );
    const raw = readFileSync(output),
      kept = raw.subarray(0, wanted * 4);
    assert.equal(kept.length / 4, wanted);
    const samples = floats(kept);
    const result = {
      case: c.name,
      speed,
      authority: c.authority,
      fileRangeUs: c.fileRangeUs,
      sourceFrames: [start, end],
      inputSha256: hash(inputBytes),
      selectedSha256: hash(inputBytes.subarray(start * 4, end * 4)),
      expectedFrames: wanted,
      native,
      peakResidentBytes: Number(
        readFileSync(stats, "utf8").match(/(\d+)\s+maximum resident set size/)[1],
      ),
      retained: energy(samples),
      discardedTail: energy(floats(raw.subarray(wanted * 4))),
      nativeSha256: hash(kept),
    };
    wav(join(out, `${prefix}-native.wav`), kept);
    if (c.name === "tone") {
      result.pitchHz = pitchHz(samples);
      result.pitchErrorPercent = Math.abs(result.pitchHz / 440 - 1) * 100;
      assert.ok(result.pitchErrorPercent < 1);
    }
    if (c.name === "silence") assert.equal(result.retained.peak, 0);
    if (c.name === "impulses")
      result.impulses = [0.02, 0.25, 1, 2, 2.98].map((t) => {
        const expected = (t * rate) / speed;
        let peak = 0,
          at = 0;
        for (
          let i = Math.max(0, Math.floor(expected) - 768);
          i < Math.min(samples.length, Math.ceil(expected) + 768);
          i++
        )
          if (Math.abs(samples[i]) > peak) {
            peak = Math.abs(samples[i]);
            at = i;
          }
        return {
          sourceSeconds: t,
          expectedFrame: expected,
          peakFrame: at,
          errorFrames: at - expected,
          peak,
        };
      });
    if (c.name === "local-phrase") {
      const assembled = Buffer.concat([
        inputBytes.subarray(0, start * 4),
        kept,
        inputBytes.subarray(end * 4),
      ]);
      assert.deepEqual(assembled.subarray(0, start * 4), inputBytes.subarray(0, start * 4));
      assert.deepEqual(assembled.subarray((start + wanted) * 4), inputBytes.subarray(end * 4));
      wav(join(out, `${prefix}-context.wav`), assembled);
      result.neighbors = "bit-identical";
      const poison = Buffer.from(inputBytes);
      for (let i = 0; i < c.samples.length; i++)
        if (i < start || i >= end) poison.writeFloatLE(i % 2 ? 0.9 : -0.9, i * 4);
      const poisoned = join(out, `${prefix}-poison.f32`),
        poisonOutput = join(out, `${prefix}-poison-output.f32`);
      writeFileSync(poisoned, poison);
      run(
        executable,
        [],
        JSON.stringify({
          input: poisoned,
          output: poisonOutput,
          startFrame: start,
          endFrame: end,
          speed,
          outputFrames: wanted + 4800,
        }),
      );
      assert.deepEqual(readFileSync(poisonOutput), raw);
      result.excludedSourcePoison = "byte-identical native output";
    }
    const comparator = run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "f32le",
        "-ar",
        String(rate),
        "-ac",
        "1",
        "-i",
        "pipe:0",
        "-af",
        `atempo=${speed}`,
        "-f",
        "f32le",
        "pipe:1",
      ],
      inputBytes.subarray(start * 4, end * 4),
    );
    result.ffmpeg = {
      frames: comparator.length / 4,
      frameDifference: comparator.length / 4 - wanted,
      sha256: hash(comparator),
    };
    if (c.name === "tone") result.ffmpeg.pitchHz = pitchHz(floats(comparator));
    wav(join(out, `${prefix}-ffmpeg.wav`), comparator);
    report.results.push(result);
  }
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    out,
    cases: cases.length,
    results: report.results.length,
    status: report.status,
  }),
);
