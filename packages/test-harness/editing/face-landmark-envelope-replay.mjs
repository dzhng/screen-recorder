import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED = {
  reportSha256: "373acc3dabe4f7ba68a241429a94783e67802357f7bfa7145ea7523e3060d48b",
  implementationSha256: "264d620e3fab74cd943019742b560d263515f3d0d800433b76b375ba4b7ec50e",
  sourceSha256: "5ce578840a41a665fe10da3c11046ef097b799f3e10a130669ef4081727b9118",
  frameCount: 72,
  minimumIoU: 0.19111696551037993,
  maximumIoU: 0.44963950726011126,
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const iou = (a, b) => {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / (a.width * a.height + b.width * b.height - intersection);
};
const close = (a, b) => Math.abs(a - b) <= 1e-12;

/** Replay the independent landmark-envelope hypothesis and keep its refusal executable. */
export async function replayFaceLandmarkEnvelope(reportPath) {
  const bytes = await readFile(resolve(reportPath));
  assert.equal(digest(bytes), EXPECTED.reportSha256, "landmark probe identity changed");
  const report = JSON.parse(bytes);
  assert.equal(report.kind, "face-localization-landmark-envelope-probe");
  assert.equal(report.status, "refused");
  assert.equal(report.promotion, false);
  assert.equal(report.recipe.minimumBoxIoU, 0.5);
  assert.equal(report.recipe.landmarks, "VNDetectFaceLandmarksRequest faceContour");
  assert.equal(report.source.sha256, EXPECTED.sourceSha256);
  assert.equal(report.source.frames, EXPECTED.frameCount);
  assert.equal(report.implementation.sha256, EXPECTED.implementationSha256);
  assert.equal(report.candidateFrames.length, EXPECTED.frameCount);
  const zone = report.authoredZone;
  const values = [];
  for (const [ordinal, row] of report.candidateFrames.entries()) {
    assert.equal(row.ordinal, ordinal);
    assert.equal(row.detector.length, 4);
    assert.equal(row.candidate.length, 4);
    assert.equal(row.contour.length, 4);
    row.candidate.forEach((value) => assert.ok(Number.isFinite(value)));
    const candidate = { x: row.candidate[0], y: row.candidate[1], width: row.candidate[2], height: row.candidate[3] };
    const overlap = iou(candidate, zone);
    assert.ok(close(overlap, row.iou), `candidate IoU changed at ${ordinal}`);
    assert.ok(overlap < report.recipe.minimumBoxIoU, `unexpected passing candidate at ${ordinal}`);
    values.push(overlap);
  }
  assert.equal(report.failureCount, EXPECTED.frameCount);
  assert.ok(close(Math.min(...values), EXPECTED.minimumIoU));
  assert.ok(close(Math.max(...values), EXPECTED.maximumIoU));
  assert.match(report.additionalRefusal.reason, /visible-face envelope/);
  return {
    status: report.status,
    promotion: report.promotion,
    candidateFrames: report.candidateFrames.length,
    passedFrames: values.filter((value) => value >= report.recipe.minimumBoxIoU).length,
    failedFrames: values.filter((value) => value < report.recipe.minimumBoxIoU).length,
    minimumIoU: Math.min(...values),
    maximumIoU: Math.max(...values),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node face-landmark-envelope-replay.mjs <probe.json>");
  console.log(JSON.stringify(await replayFaceLandmarkEnvelope(process.argv[2])));
}
