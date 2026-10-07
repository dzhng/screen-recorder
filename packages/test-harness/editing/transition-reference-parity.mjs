import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = new URL("../../../", import.meta.url).pathname;
const ffmpeg = process.env.YAP_FFMPEG ?? join(root, "helpers/ffmpeg/.build/distribution/bin/ffmpeg");
const width = 64;
const height = 48;
const frameDurationUs = 250000;
const transitionStartUs = 250000;
const transitionEndUs = 750000;
export const expectedSamples = [
  { id: "moving-100000", atUs: 100000, frame: 0 },
  { id: "moving-500000", atUs: 500000, frame: 2 },
  { id: "moving-900000", atUs: 900000, frame: 3 },
];

export function movingCandidatePath(sample) {
  return join(
    root,
    "specs/video-editing-feedback/assets/27-29-transitions/crossfade/moving",
    `${sample.id.replace("moving-", "moving-frame-")}.png`,
  );
}

const sources = {
  alpha: join(root, "specs/done/ffmpeg-parity/evidence/motion-alpha/alpha.mov"),
  mirror: join(root, "specs/done/ffmpeg-parity/evidence/motion-alpha/mirror.mov"),
};

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function decodeRgba(path) {
  const { stdout } = await exec(
    ffmpeg,
    ["-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
    { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(stdout.length % (width * height * 4), 0, `${path}: decoded RGBA size`);
  return stdout;
}

function srgbToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  const clamped = Math.min(1, Math.max(0, value));
  const encoded =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

function opacityAt(atUs) {
  const phase = (atUs - transitionStartUs) / (transitionEndUs - transitionStartUs);
  if (phase <= 0 || phase >= 1) return [1, 1];
  return [1 - phase, phase];
}

export function composeFrameWithAlpha(alpha, mirror, atUs, alphaValue = (value) => value / 255) {
  const frame = Math.min(3, Math.floor(atUs / frameDurationUs));
  const [alphaOpacity, mirrorOpacity] = opacityAt(atUs);
  const output = Buffer.alloc(width * height * 4);
  const sourcesAtFrame = [
    [alpha, alphaOpacity],
    [mirror, mirrorOpacity],
  ];
  for (let offset = 0; offset < output.length; offset += 4) {
    let red = 0,
      green = 0,
      blue = 0;
    for (const [source, opacity] of sourcesAtFrame) {
      const sourceOffset = (frame * width * height * 4) + offset;
      const sourceAlpha = alphaValue(source[sourceOffset + 3]) * opacity;
      const remaining = 1 - sourceAlpha;
      red = srgbToLinear(source[sourceOffset]) * sourceAlpha + red * remaining;
      green = srgbToLinear(source[sourceOffset + 1]) * sourceAlpha + green * remaining;
      blue = srgbToLinear(source[sourceOffset + 2]) * sourceAlpha + blue * remaining;
    }
    output[offset] = linearToSrgb(red);
    output[offset + 1] = linearToSrgb(green);
    output[offset + 2] = linearToSrgb(blue);
    output[offset + 3] = 255;
  }
  return output;
}

export function composeFrame(alpha, mirror, atUs) {
  return composeFrameWithAlpha(alpha, mirror, atUs);
}

async function writePng(rgba, path) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(
      ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${width}x${height}`,
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-y",
        path,
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    const errors = [];
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg PNG encode failed (${code}): ${Buffer.concat(errors)}`));
    });
    child.stdin.end(rgba);
  });
}

export function compareRgb(expected, candidate) {
  assert.equal(expected.length, candidate.length, "reference/candidate byte length");
  let sum = 0;
  let max = 0;
  let different = 0;
  let pixels = 0;
  for (let offset = 0; offset < expected.length; offset += 4) {
    let changed = false;
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(expected[offset + channel] - candidate[offset + channel]);
      sum += delta;
      max = Math.max(max, delta);
      changed ||= delta > 0;
    }
    if (changed) different++;
    pixels++;
  }
  return {
    mae: sum / (pixels * 3),
    maxChannelDelta: max,
    differingRatio: different / pixels,
  };
}

export async function generateReferenceParity(outDirectory) {
  const out = resolve(outDirectory);
  const referenceDirectory = join(out, "reference");
  await mkdir(referenceDirectory, { recursive: true });
  const [alphaBytes, mirrorBytes] = await Promise.all([
    decodeRgba(sources.alpha),
    decodeRgba(sources.mirror),
  ]);
  const report = {
    kind: "reference-conditioned-transition-parity",
    status: "open",
    oracle: "independent-linear-rgba-compositor-v1",
    reason:
      "The retained native moving transition had no frozen visual reference. This audit supplies a standard opposing-opacity crossfade oracle; its strict mismatch is evidence, not a permission to recalibrate the gate.",
    recipe: {
      transition: "crossfade",
      sourceOrder: ["alpha.mov", "mirror.mov"],
      window: { startUs: transitionStartUs, endUs: transitionEndUs },
      sourceFrameSelection: "floor(atUs / 250000), capped at frame 3",
      colorSpace: "sRGB source-over in linear light, black canvas",
    },
    sources: {},
    samples: [],
  };
  for (const [name, path] of Object.entries(sources)) {
    report.sources[name] = { path: relative(root, path), sha256: hash(await readFile(path)) };
  }
  for (const sample of expectedSamples) {
    const reference = composeFrame(alphaBytes, mirrorBytes, sample.atUs);
    const referencePath = join(referenceDirectory, `${sample.id}.png`);
    await writePng(reference, referencePath);
    const candidatePath = movingCandidatePath(sample);
    const candidate = await decodeRgba(candidatePath);
    report.samples.push({
      ...sample,
      reference: { path: relative(out, referencePath), sha256: hash(await readFile(referencePath)) },
      candidate: { path: relative(root, candidatePath), sha256: hash(await readFile(candidatePath)) },
      comparison: compareRgb(reference, candidate),
    });
  }
  report.gate = {
    passed: false,
    rule: "reference-conditioned visual parity requires zero differing RGB pixels",
    maxMae: Math.max(...report.samples.map((sample) => sample.comparison.mae)),
    maxDifferingRatio: Math.max(
      ...report.samples.map((sample) => sample.comparison.differingRatio),
    ),
    maxChannelDelta: Math.max(
      ...report.samples.map((sample) => sample.comparison.maxChannelDelta),
    ),
  };
  await writeFile(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export async function runReferenceParityReplay(reportPath) {
  const absolute = resolve(reportPath);
  const reportBytes = await readFile(absolute);
  const report = JSON.parse(reportBytes);
  assert.equal(report.kind, "reference-conditioned-transition-parity");
  assert.equal(report.status, "open", "a failed parity audit cannot be promoted by editing JSON");
  assert.equal(report.oracle, "independent-linear-rgba-compositor-v1");
  assert.deepEqual(
    report.samples.map(({ id }) => id),
    expectedSamples.map(({ id }) => id),
  );
  assert.equal(report.samples.length, expectedSamples.length);
  assert.equal(report.gate.passed, false);
  assert.equal(
    report.gate.rule,
    "reference-conditioned visual parity requires zero differing RGB pixels",
  );
  const directory = dirname(absolute);
  for (const [name, source] of Object.entries(report.sources)) {
    const bytes = await readFile(join(root, source.path));
    assert.equal(hash(bytes), source.sha256, `${name} source changed`);
  }
  const comparisons = [];
  for (const sample of report.samples) {
    const referenceFile = join(directory, sample.reference.path);
    const candidateFile = join(root, sample.candidate.path);
    const referenceBytes = await readFile(referenceFile);
    const candidateBytes = await readFile(candidateFile);
    assert.equal(hash(referenceBytes), sample.reference.sha256, `${sample.id}: reference changed`);
    assert.equal(hash(candidateBytes), sample.candidate.sha256, `${sample.id}: candidate changed`);
    const referenceRgba = await decodeRgba(referenceFile);
    const candidateRgba = await decodeRgba(candidateFile);
    assert.equal(referenceRgba.length, width * height * 4, `${sample.id}: reference dimensions`);
    assert.equal(candidateRgba.length, width * height * 4, `${sample.id}: candidate dimensions`);
    const comparison = compareRgb(referenceRgba, candidateRgba);
    assert.deepEqual(
      comparison,
      sample.comparison,
      `${sample.id}: comparison metrics changed`,
    );
    comparisons.push(comparison);
  }
  assert.equal(report.gate.maxMae, Math.max(...comparisons.map(({ mae }) => mae)));
  assert.equal(
    report.gate.maxDifferingRatio,
    Math.max(...comparisons.map(({ differingRatio }) => differingRatio)),
  );
  assert.equal(
    report.gate.maxChannelDelta,
    Math.max(...comparisons.map(({ maxChannelDelta }) => maxChannelDelta)),
  );
  return {
    kind: report.kind,
    status: report.status,
    sourceSha256: hash(reportBytes),
    sampleCount: report.samples.length,
    maxMae: report.gate.maxMae,
    maxDifferingRatio: report.gate.maxDifferingRatio,
    maxChannelDelta: report.gate.maxChannelDelta,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [command, directory] = process.argv.slice(2);
  if (command === "generate") {
    assert(directory, "Usage: node transition-reference-parity.mjs generate OUTPUT_DIRECTORY");
    console.log(JSON.stringify(await generateReferenceParity(directory), null, 2));
  } else {
    assert(directory, "Usage: node transition-reference-parity.mjs replay REPORT_PATH");
    console.log(JSON.stringify(await runReferenceParityReplay(directory), null, 2));
  }
}
