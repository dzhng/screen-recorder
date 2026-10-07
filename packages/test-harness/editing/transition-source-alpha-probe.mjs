import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import {
  composeFrame,
  composeFrameWithAlpha,
  compareRgb,
  decodeRgba,
  expectedSamples,
  movingCandidatePath,
} from "./transition-reference-parity.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const sources = {
  alpha: join(root, "specs/done/ffmpeg-parity/evidence/motion-alpha/alpha.mov"),
  mirror: join(root, "specs/done/ffmpeg-parity/evidence/motion-alpha/mirror.mov"),
};
const samples = expectedSamples;

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Core Video's 8-bit BGRA path can represent non-opaque alpha with a 256-step
// normalization while keeping the opaque sentinel at one. This is a bounded
// source-conversion hypothesis, not a production color policy.
const videoRangeAlpha = (value) => (value === 255 ? 1 : value / 256);

async function sourceHashes() {
  const result = {};
  for (const [name, path] of Object.entries(sources)) {
    result[name] = { path: relative(root, path), sha256: hash(await readFile(path)) };
  }
  return result;
}

async function calculate(alpha, mirror) {
  const output = [];
  for (const sample of samples) {
    const candidate = await decodeRgba(movingCandidatePath(sample));
    const baseline = compareRgb(composeFrame(alpha, mirror, sample.atUs), candidate);
    const probe = compareRgb(
      composeFrameWithAlpha(alpha, mirror, sample.atUs, videoRangeAlpha),
      candidate,
    );
    output.push({ ...sample, baseline, probe });
  }
  return output;
}

export async function generateSourceAlphaProbe(outDirectory) {
  const out = resolve(outDirectory);
  await mkdir(out, { recursive: true });
  const [alpha, mirror] = await Promise.all([
    decodeRgba(sources.alpha),
    decodeRgba(sources.mirror),
  ]);
  const report = {
    kind: "transition-source-alpha-conversion-probe",
    status: "open",
    hypothesis: "non-opaque-alpha-uses-256-normalization",
    reason:
      "The moving mismatch is concentrated on semi-transparent source edges. A bounded replay tests the Core Video 8-bit BGRA hypothesis that non-opaque alpha uses a 256-step normalization while opaque alpha remains one. The strict zero-difference gate stays unchanged.",
    sources: await sourceHashes(),
    candidates: Object.fromEntries(
      await Promise.all(
        samples.map(async (sample) => {
          const path = movingCandidatePath(sample);
          return [sample.id, { path: relative(root, path), sha256: hash(await readFile(path)) }];
        }),
      ),
    ),
    samples: await calculate(alpha, mirror),
    probeGate: {
      passed: false,
      rule: "source-conversion probe still requires zero differing RGB pixels",
    },
  };
  await writeFile(join(out, "source-alpha-probe.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export async function runSourceAlphaProbeReplay(reportPath) {
  const absolute = resolve(reportPath);
  const reportBytes = await readFile(absolute);
  const report = JSON.parse(reportBytes);
  assert.equal(report.kind, "transition-source-alpha-conversion-probe");
  assert.equal(report.status, "open");
  assert.equal(report.hypothesis, "non-opaque-alpha-uses-256-normalization");
  assert.equal(report.probeGate.passed, false);
  assert.equal(
    report.probeGate.rule,
    "source-conversion probe still requires zero differing RGB pixels",
  );
  for (const [name, source] of Object.entries(report.sources)) {
    assert.equal(
      hash(await readFile(join(root, source.path))),
      source.sha256,
      `${name} source changed`,
    );
  }
  for (const sample of samples) {
    const candidate = report.candidates[sample.id];
    assert.ok(candidate, `${sample.id}: candidate missing`);
    assert.equal(
      hash(await readFile(join(root, candidate.path))),
      candidate.sha256,
      `${sample.id}: candidate changed`,
    );
  }
  const [alpha, mirror] = await Promise.all([
    decodeRgba(sources.alpha),
    decodeRgba(sources.mirror),
  ]);
  const calculated = await calculate(alpha, mirror);
  assert.deepEqual(calculated, report.samples, "source-alpha probe measurements changed");
  assert.ok(calculated.every((sample) => sample.baseline.differingRatio > 0));
  assert.ok(calculated.every((sample) => sample.probe.differingRatio > 0));
  return {
    kind: report.kind,
    status: report.status,
    hypothesis: report.hypothesis,
    samples: calculated,
    probeGate: report.probeGate,
    reportSha256: hash(reportBytes),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [command, directory] = process.argv.slice(2);
  assert(directory, "Usage: node transition-source-alpha-probe.mjs generate|replay PATH");
  if (command === "generate")
    console.log(JSON.stringify(await generateSourceAlphaProbe(directory), null, 2));
  else console.log(JSON.stringify(await runSourceAlphaProbeReplay(directory), null, 2));
}
