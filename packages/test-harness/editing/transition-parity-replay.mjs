import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";

const expectedIds = [
  "frame-100000",
  "frame-500000",
  "frame-900000",
  "dip-frame-100000",
  "dip-frame-500000",
  "dip-frame-900000",
  "flash-frame-100000",
  "flash-frame-500000",
  "flash-frame-900000",
];

export async function runParityReplay(reportPath) {
  const reportBytes = await readFile(reportPath);
  const report = JSON.parse(reportBytes);
  assert.equal(report.kind, "screenshot-parity-diff", "unexpected parity receipt kind");
  assert.equal(report.pairCount, expectedIds.length, "frozen pair count changed");
  assert.deepEqual(
    report.results.map((result) => result.id),
    expectedIds,
    "frozen transition pair set changed",
  );
  const reportDirectory = dirname(resolve(reportPath));
  const transitionDirectory = dirname(reportDirectory);
  for (const result of report.results) {
    assert.equal(result.dimensions?.width, 64, `${result.id}: width changed`);
    assert.equal(result.dimensions?.height, 48, `${result.id}: height changed`);
    assert.equal(result.parityDistance, 0, `${result.id}: parityDistance`);
    assert.equal(result.grayscale?.pixelmatchRatio, 0, `${result.id}: pixelmatchRatio`);
    assert.equal(result.grayscale?.diffRatio32, 0, `${result.id}: diffRatio32`);
    assert.equal(result.contentProxies?.edgeDiffRatio32, 0, `${result.id}: edgeDiffRatio32`);
    for (const relative of [
      result.current.replace("transition/", ""),
      result.candidate.replace("transition/", ""),
    ]) {
      await access(join(transitionDirectory, relative));
    }
  }
  const midpoint = report.results.find((result) => result.id === "frame-500000");
  assert.equal(midpoint.grayscale.mae, 0.2848, "crossfade midpoint encoding tolerance changed");
  return {
    source: "visual-parity-diff.json",
    sourceSha256: createHash("sha256").update(reportBytes).digest("hex"),
    pairCount: report.results.length,
    maxParityDistance: Math.max(...report.results.map((result) => result.parityDistance)),
    maxPixelmatchRatio: Math.max(
      ...report.results.map((result) => result.grayscale.pixelmatchRatio),
    ),
    maxEdgeDiffRatio32: Math.max(
      ...report.results.map((result) => result.contentProxies.edgeDiffRatio32),
    ),
    crossfadeMidpointMae: midpoint.grayscale.mae,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const reportPath = process.argv[2];
  assert(reportPath, "Usage: node transition-parity-replay.mjs <visual-parity-diff.json>");
  console.log(JSON.stringify(await runParityReplay(reportPath)));
}
