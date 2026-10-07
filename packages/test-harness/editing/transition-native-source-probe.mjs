import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareRgb,
  composeFrame,
  composeFramePremultiplied,
  decodeRgba,
  expectedSamples,
} from "./transition-reference-parity.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const ffmpeg =
  process.env.YAP_FFMPEG ?? join(root, "helpers/ffmpeg/.build/distribution/bin/ffmpeg");
const swift = join(root, "packages/test-harness/editing/transition-native-source-probe.swift");
const sourcePaths = {
  alpha: join(root, "specs/done/ffmpeg-parity/evidence/motion-alpha/alpha.mov"),
  mirror: join(root, "specs/done/ffmpeg-parity/evidence/motion-alpha/mirror.mov"),
};
const candidateRoot = join(
  root,
  "specs/video-editing-feedback/assets/27-29-transitions/crossfade/moving",
);
const width = 64;
const height = 48;
const frameBytes = width * height * 4;

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command} failed: ${result.stderr?.toString() ?? ""}`);
  return result.stdout;
};

function compareRgba(reference, candidate) {
  assert.equal(reference.length, candidate.length);
  let differingBytes = 0;
  let differingPixels = 0;
  let maxChannelDelta = 0;
  let sum = 0;
  for (let offset = 0; offset < reference.length; offset += 4) {
    let pixelChanged = false;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(reference[offset + channel] - candidate[offset + channel]);
      if (delta) {
        differingBytes += 1;
        pixelChanged = true;
      }
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      sum += delta;
    }
    if (pixelChanged) differingPixels += 1;
  }
  return {
    differingBytes,
    differingPixels,
    differingRatio: differingPixels / (reference.length / 4),
    maxChannelDelta,
    mae: sum / reference.length,
  };
}

function transformNativeBgra(bytes, transform) {
  assert.equal(bytes.length, frameBytes);
  const rgba = Buffer.alloc(frameBytes);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    rgba[offset] = bytes[offset + 2];
    rgba[offset + 1] = bytes[offset + 1];
    rgba[offset + 2] = bytes[offset];
    rgba[offset + 3] = bytes[offset + 3];
  }
  assert.equal(transform.tx, 0);
  assert.equal(transform.ty, 0);
  const horizontalFlip =
    transform.a === -1 && transform.b === 0 && transform.c === 0 && transform.d === 1;
  const identity = transform.a === 1 && transform.b === 0 && transform.c === 0 && transform.d === 1;
  assert.ok(
    horizontalFlip || identity,
    `unsupported frozen transform ${JSON.stringify(transform)}`,
  );
  if (identity) return rgba;
  const flipped = Buffer.alloc(frameBytes);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + (width - 1 - x)) * 4;
      const to = (y * width + x) * 4;
      rgba.copy(flipped, to, from, from + 4);
    }
  }
  return flipped;
}

async function readSourceFixtures(report) {
  const sourceFrames = {};
  for (const [name, source] of Object.entries(report.sources)) {
    const frames = [];
    for (const frame of source.frames) {
      const bytes = await readFile(join(root, frame.path));
      assert.equal(bytes.length, frameBytes, `${name} frame ${frame.index} dimensions`);
      assert.equal(hash(bytes), frame.bgraSHA256, `${name} frame ${frame.index} changed`);
      frames.push(transformNativeBgra(bytes, source.transform));
    }
    sourceFrames[name] = frames;
  }
  return sourceFrames;
}

async function calculate(report, sourceFrames) {
  const decoded = {};
  for (const [name, path] of Object.entries(sourcePaths)) decoded[name] = await decodeRgba(path);
  const sourceComparisons = [];
  for (const [name, source] of Object.entries(report.sources)) {
    for (const frame of source.frames) {
      const nativeFrame = sourceFrames[name][frame.index];
      const ffmpegFrame = decoded[name].subarray(
        frame.index * frameBytes,
        (frame.index + 1) * frameBytes,
      );
      sourceComparisons.push({
        source: name,
        frame: frame.index,
        comparison: compareRgba(ffmpegFrame, nativeFrame),
      });
    }
  }
  const alpha = Buffer.concat(sourceFrames.alpha);
  const mirror = Buffer.concat(sourceFrames.mirror);
  const candidateComparisons = [];
  const premultipliedCandidateComparisons = [];
  for (const sample of expectedSamples) {
    const candidatePath = join(
      candidateRoot,
      `${sample.id.replace("moving-", "moving-frame-")}.png`,
    );
    const candidate = await decodeRgba(candidatePath);
    const nativeOracle = composeFrame(alpha, mirror, sample.atUs);
    const premultipliedOracle = composeFramePremultiplied(alpha, mirror, sample.atUs);
    candidateComparisons.push({
      id: sample.id,
      atUs: sample.atUs,
      comparison: compareRgb(nativeOracle, candidate),
    });
    premultipliedCandidateComparisons.push({
      id: sample.id,
      atUs: sample.atUs,
      comparison: compareRgb(premultipliedOracle, candidate),
    });
  }
  return { sourceComparisons, candidateComparisons, premultipliedCandidateComparisons };
}

async function candidateHashes() {
  const result = {};
  for (const sample of expectedSamples) {
    const path = join(candidateRoot, `${sample.id.replace("moving-", "moving-frame-")}.png`);
    result[sample.id] = { path: relative(root, path), sha256: hash(await readFile(path)) };
  }
  return result;
}

async function nativeFrames(binary, source, out) {
  const result = run(binary, [source, out]);
  assert.equal(result.length, 0);
  return JSON.parse(await readFile(join(out, "frames.json"), "utf8"));
}

export async function generateNativeSourceProbe(outDirectory) {
  const out = resolve(outDirectory);
  await mkdir(out, { recursive: true });
  const scratch = await mkdtemp(join(tmpdir(), "yap-transition-native-source-"));
  try {
    const binary = join(scratch, "probe");
    const compile = spawnSync("swiftc", ["-parse-as-library", swift, "-o", binary], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    assert.equal(compile.status, 0, compile.stderr);
    const nativeRoot = join(out, "native-source");
    await mkdir(nativeRoot, { recursive: true });
    const sources = {};
    for (const [name, sourcePath] of Object.entries(sourcePaths)) {
      const scratchOut = join(scratch, name);
      await mkdir(scratchOut);
      const native = await nativeFrames(binary, sourcePath, scratchOut);
      assert.equal(native.frames.length, 4);
      const fixtureOut = join(nativeRoot, name);
      await mkdir(fixtureOut, { recursive: true });
      const frames = [];
      for (const frame of native.frames) {
        const path = join(fixtureOut, `frame-${frame.index}.bgra`);
        await copyFile(join(scratchOut, `frame-${frame.index}.bgra`), path);
        frames.push({
          index: frame.index,
          width: frame.width,
          height: frame.height,
          ptsValue: frame.ptsValue,
          ptsTimescale: frame.ptsTimescale,
          path: relative(root, path),
          bgraSHA256: hash(await readFile(path)),
        });
      }
      sources[name] = {
        path: relative(root, sourcePath),
        sha256: hash(await readFile(sourcePath)),
        transform: native.transform,
        frameCount: frames.length,
        frames,
      };
    }
    const report = {
      kind: "transition-native-source-conversion-probe",
      status: "open",
      hypothesis: "native-avassetreader-bgra-source-conversion",
      reason:
        "The production path decodes ProRes through AVAssetReader 32BGRA before Core Image. This probe records those native bytes, applies only the retained source display transform, and compares them with the independent FFmpeg source bytes and the moving candidate. Its premultiplied-sRGB oracle models CIImage(cvPixelBuffer:) conversion and matches native delivery; the independent FFmpeg strict gate remains unchanged.",
      sources,
      candidates: await candidateHashes(),
    };
    const sourceFrames = await readSourceFixtures(report);
    const measurements = await calculate(report, sourceFrames);
    report.sourceComparisons = measurements.sourceComparisons;
    report.candidateComparisons = measurements.candidateComparisons;
    report.premultipliedCandidateComparisons = measurements.premultipliedCandidateComparisons;
    report.premultipliedGate = {
      passed: report.premultipliedCandidateComparisons.every(({ comparison }) => comparison.differingRatio === 0),
      rule: "native-source-conditioned premultiplied linear source-over requires zero differing RGB pixels",
      sourceAlphaSemantics: "premultiplied-srgb-8bit",
    };
    report.gate = {
      passed: false,
      rule: "native-source-conditioned moving parity requires zero differing RGB pixels",
    };
    await writeFile(join(out, "native-source-probe.json"), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function runNativeSourceProbeReplay(reportPath) {
  const absolute = resolve(reportPath);
  const reportBytes = await readFile(absolute);
  const report = JSON.parse(reportBytes);
  assert.equal(report.kind, "transition-native-source-conversion-probe");
  assert.equal(report.status, "open");
  assert.equal(report.hypothesis, "native-avassetreader-bgra-source-conversion");
  assert.equal(report.gate.passed, false);
  assert.equal(
    report.gate.rule,
    "native-source-conditioned moving parity requires zero differing RGB pixels",
  );
  for (const [name, source] of Object.entries(report.sources)) {
    const sourceBytes = await readFile(join(root, source.path));
    assert.equal(hash(sourceBytes), source.sha256, `${name} source changed`);
    assert.equal(source.frameCount, source.frames.length);
  }
  for (const [id, candidate] of Object.entries(report.candidates)) {
    assert.equal(
      hash(await readFile(join(root, candidate.path))),
      candidate.sha256,
      `${id} candidate changed`,
    );
  }
  const sourceFrames = await readSourceFixtures(report);
  const measurements = await calculate(report, sourceFrames);
  assert.deepEqual(
    measurements.sourceComparisons,
    report.sourceComparisons,
    "native source measurements changed",
  );
  assert.deepEqual(
    measurements.candidateComparisons,
    report.candidateComparisons,
    "native candidate measurements changed",
  );
  assert.deepEqual(
    measurements.premultipliedCandidateComparisons,
    report.premultipliedCandidateComparisons,
    "premultiplied native candidate measurements changed",
  );
  assert.equal(report.premultipliedGate.passed, true);
  return {
    kind: report.kind,
    status: report.status,
    sources: Object.fromEntries(
      Object.entries(report.sources).map(([name, source]) => [
        name,
        { frameCount: source.frameCount },
      ]),
    ),
    sourceComparisons: report.sourceComparisons,
    candidateComparisons: report.candidateComparisons,
    premultipliedCandidateComparisons: report.premultipliedCandidateComparisons,
    premultipliedGate: report.premultipliedGate,
    gate: report.gate,
    reportSha256: hash(reportBytes),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [command, path] = process.argv.slice(2);
  assert(path, "Usage: node transition-native-source-probe.mjs generate|replay PATH");
  if (command === "generate")
    console.log(JSON.stringify(await generateNativeSourceProbe(path), null, 2));
  else console.log(JSON.stringify(await runNativeSourceProbeReplay(path), null, 2));
}
