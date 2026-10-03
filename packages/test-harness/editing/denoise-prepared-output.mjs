import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync, gunzipSync } from "node:zlib";
import { applyBatch, createCompiler, validateComposition } from "../../composition/src/index.ts";
import { nativeProcessing } from "../../../apps/service/src/native-processing.ts";
import { waveHeader } from "./audio-project-fixture.mjs";

const { values } = parseArgs({
  options: { out: { type: "string" }, processor: { type: "string" } },
});
assert(values.out && values.processor && process.env.SCREENREC_NATIVE);
const out = resolve(values.out),
  worker = resolve(process.env.SCREENREC_NATIVE);
let processor = resolve(values.processor);
mkdirSync(out);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assets = resolve(import.meta.dirname, "../../../specs/done/agent-editing/assets");
const plan = readFileSync(join(assets, "12c-prepared-output/plan.json"));
writeFileSync(join(out, "plan.json"), plan);
const started = Date.now();
const report = {
  scope: "compiled/native upstream; research-only mono RNNoise",
  productionReady: false,
  planSha256: hash(plan),
  nativeSha256: hash(readFileSync(worker)),
  processorSha256: hash(readFileSync(processor)),
  harnessSha256: hash(readFileSync(import.meta.filename)),
  commands: [],
  cases: {},
  comparisons: {},
  files: {},
};
assert.equal(
  report.processorSha256,
  "697657e249b178c415d379511ba4041687055c7cf5d347af80a2d3a08cb6c5ee",
);
function run(executable, argv, input) {
  assert(Date.now() - started < 180000, "Batch deadline");
  const result = spawnSync(executable, argv, {
    input,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  report.commands.push({ executable, argv, input, stdout: result.stdout, stderr: result.stderr });
  return result.stdout;
}
report.sourceRevision = run("git", ["rev-parse", "HEAD"]).trim();
let id = 0;
function native(operation, params) {
  const response = JSON.parse(
    run(worker, [], JSON.stringify({ id: String(++id), operation, params }) + "\n"),
  );
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.data;
}
function retain(name, bytes) {
  const sha256 = hash(bytes);
  const prior = Object.values(report.files).find((file) => file.sha256 === sha256);
  const storedAs = prior?.storedAs ?? name + ".gz";
  if (!prior) writeFileSync(join(out, storedAs), gzipSync(bytes));
  report.files[name] = { bytes: bytes.length, sha256, storedAs };
}
function wave(pcm, channels = 1) {
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(48000 * channels * 4, 28);
  header.writeUInt16LE(channels * 4, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
function source(name, pcm) {
  const path = join(out, name + ".wav");
  writeFileSync(path, wave(pcm));
  const probe = native("media.probe", { path });
  const stream = probe.streams.find((s) => s.kind === "audio");
  return {
    binding: { assetId: "speech", streamId: stream.id, path, originUs: probe.originUs },
    asset: {
      id: "speech",
      streams: [
        {
          id: stream.id,
          kind: "audio",
          bounds: { startUs: stream.startUs, endUs: stream.endUs },
          available: [{ startUs: stream.startUs, endUs: stream.endUs }],
        },
      ],
    },
  };
}
function render(name, document, src, range) {
  const window = createCompiler(validateComposition(document, [src.asset]), name).window({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  const params = {
    output: join(out, name + "-native.wav"),
    range: window.manifest.sampleRange,
    clips: [...window.audio()],
    processing: nativeProcessing(window.manifest.processing),
    assets: [src.binding],
  };
  const result = native("media.mixCompositionAudio", params);
  const bytes = readFileSync(result.file),
    header = waveHeader(bytes, bytes.length);
  const pcm = Buffer.alloc(header.frames * 4);
  for (let i = 0; i < header.frames; i++) {
    const left = bytes.subarray(header.offset + i * 8, header.offset + i * 8 + 4);
    assert(
      left.equals(bytes.subarray(header.offset + i * 8 + 4, header.offset + i * 8 + 8)),
      "Identical mono-mapped channels only",
    );
    left.copy(pcm, i * 4);
  }
  report.cases[name] = {
    manifest: window.manifest,
    nativeFrames: result.frames,
    monoSha256: hash(pcm),
  };
  retain(name + "-upstream.f32", pcm);
  return pcm;
}
function denoise(name, pcm) {
  const input = join(out, name + "-input.f32"),
    raw = join(out, name + "-raw.f32");
  writeFileSync(input, pcm);
  run("/usr/bin/sandbox-exec", [
    "-p",
    "(version 1)(allow default)(deny network*)",
    processor,
    input,
    raw,
    "2",
  ]);
  const bytes = readFileSync(raw),
    result = Buffer.from(bytes.subarray(960 * 4, 960 * 4 + pcm.length));
  assert.equal(result.length, pcm.length);
  let peak = 0,
    clipped = 0;
  for (let i = 0; i < result.length; i += 4) {
    const value = result.readFloatLE(i);
    assert(Number.isFinite(value));
    peak = Math.max(peak, Math.abs(value));
    clipped += Math.abs(value) >= 1 ? 1 : 0;
  }
  report.cases[name + "-denoise"] = {
    frames: pcm.length / 4,
    peak,
    clipped,
    inputSha256: hash(pcm),
    outputSha256: hash(result),
  };
  retain(name + "-raw.f32", bytes);
  retain(name + "-processed.f32", result);
  return result;
}
function compare(name, a, b, equal) {
  assert.equal(a.length, b.length);
  let differentSamples = 0,
    maximumAbsoluteDifference = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (!a.subarray(i, i + 4).equals(b.subarray(i, i + 4))) differentSamples++;
    maximumAbsoluteDifference = Math.max(
      maximumAbsoluteDifference,
      Math.abs(a.readFloatLE(i) - b.readFloatLE(i)),
    );
  }
  report.comparisons[name] = { differentSamples, maximumAbsoluteDifference, equal: a.equals(b) };
  assert.equal(a.equals(b), equal, name);
}
const mixture = gunzipSync(readFileSync(join(assets, "12c-matched-noise/audio/mixture.f32.gz")));
assert.equal(mixture.length, 240000 * 4);
const frozenReport = JSON.parse(
  gunzipSync(readFileSync(join(assets, "12c-matched-noise/report.json.gz"))),
);
assert.equal(hash(mixture), frozenReport.files["mixture.f32"].sha256);
const padded = Buffer.concat([Buffer.alloc(48000 * 4), mixture, Buffer.alloc(48000 * 4)]);
const src = source("selected-source", padded);
const document = {
  canvas: {
    width: 640,
    height: 480,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "voice", kind: "audio", order: 0 }],
  groups: [],
  syncGroups: [],
  processing: [],
  clips: [
    {
      id: "clip",
      trackId: "voice",
      assetId: "speech",
      streamId: src.binding.streamId,
      source: { kind: "range", range: { startUs: 1000000, endUs: 6000000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 5000000 } },
    },
  ],
};
const fullRange = { startUs: 0, endUs: 5000000 };
const upstream = render("whole", document, src, fullRange);
compare("native-selected-input-vs-frozen", upstream, mixture, true);
const processed = denoise("whole", upstream);
compare(
  "frozen-recipe-parity",
  processed,
  gunzipSync(readFileSync(join(assets, "12c-matched-noise/audio/rnnoise-mixture.f32.gz"))),
  true,
);
const edit = (operation) =>
  applyBatch(document, [operation], { assets: [src.asset], namespace: "noise-proof" }).document;
const split = edit({ operation: "split", clipIds: ["clip"], atUs: 2333375, scope: "selected" });
const splitInput = render("split", split, src, fullRange);
compare("split-upstream", splitInput, upstream, true);
compare("split-prepared", denoise("split", splitInput), processed, true);
const poisoned = Buffer.from(padded);
for (let i = 0; i < 336000; i++)
  if (i < 48000 || i >= 288000) poisoned.writeFloatLE(i % 2 ? -0.9 : 0.9, i * 4);
const poisonInput = render("poison", document, source("poisoned-source", poisoned), fullRange);
compare("excluded-poison-upstream", poisonInput, upstream, true);
compare("excluded-poison-prepared", denoise("poison", poisonInput), processed, true);
const trimRange = { startUs: 1000000, endUs: 4000000 };
const trim = edit({
  operation: "trim",
  clipId: "clip",
  range: trimRange,
  scope: "selected",
  ripple: "none",
});
const trimInput = render("trim", trim, src, trimRange);
compare("trim-upstream-selection", trimInput, upstream.subarray(48000 * 4, 192000 * 4), true);
compare(
  "stale-cropped-output-negative-control",
  denoise("trim", trimInput),
  processed.subarray(48000 * 4, 192000 * 4),
  false,
);
const gain = (doc, enabled = true) => ({
  ...doc,
  processing: [
    {
      target: { kind: "output" },
      steps: [{ id: "gain", enabled, processor: { type: "gain", gain: 2 } }],
    },
  ],
});
const pre = denoise("gain-before", render("gain-before", gain(document), src, fullRange));
const processedSource = source("processed-source", processed);
const postDocument = structuredClone(document);
postDocument.clips[0].streamId = processedSource.binding.streamId;
postDocument.clips[0].source.range = fullRange;
const post = render("gain-after", gain(postDocument), processedSource, fullRange);
compare("gain-order-negative-control", pre, post, false);
compare("bypassed-gain", render("bypass", gain(document, false), src, fullRange), upstream, true);
const retained = join(out, "retained.f32");
writeFileSync(retained, processed);
processor = join(out, "unavailable-processor");
const beforeReadCommands = report.commands.length;
const start = 144017,
  end = 192023,
  excerpt = Buffer.alloc((end - start) * 4);
const fd = openSync(retained, "r");
try {
  assert.equal(readSync(fd, excerpt, 0, excerpt.length, start * 4), excerpt.length);
} finally {
  closeSync(fd);
}
assert.equal(report.commands.length, beforeReadCommands);
compare("bounded-retained-window", excerpt, processed.subarray(start * 4, end * 4), true);
report.lateRead = {
  start,
  end,
  bytesRead: excerpt.length,
  inferenceCalls: 0,
  upstreamRenderCalls: 0,
  prefixBytesRead: 0,
};
retain("late-window.f32", excerpt);
report.auditions = [];
for (const [name, pcm] of [
  ["dry-mixture", upstream],
  ["learned", processed],
]) {
  let energy = 0;
  for (let i = 0; i < pcm.length; i += 4) energy += pcm.readFloatLE(i) ** 2;
  const gain = 0.05 / Math.sqrt(energy / (pcm.length / 4));
  const audition = Buffer.alloc(pcm.length);
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 4) {
    const value = pcm.readFloatLE(i) * gain;
    peak = Math.max(peak, Math.abs(value));
    audition.writeFloatLE(value, i);
  }
  assert(peak < 1, "Audition may not clip");
  for (const [label, first, last] of [
    ["whole", 0, 240000],
    ["split-context", 100002, 124002],
  ]) {
    const bytes = wave(audition.subarray(first * 4, last * 4));
    const file = `${name}-${label}.wav`;
    writeFileSync(join(out, file), bytes);
    report.auditions.push({
      file,
      gain,
      fullCopyPeak: peak,
      first,
      last,
      sha256: hash(bytes),
      purpose:
        "Optional listening only; split context has no protected-phoneme labels or acceptance",
    });
  }
}
report.elapsedSeconds = (Date.now() - started) / 1000;
report.passed = true;
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    { passed: true, comparisons: report.comparisons, elapsedSeconds: report.elapsedSeconds },
    null,
    2,
  ),
);
