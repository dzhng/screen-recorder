import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED = {
  reportSha256: "24ce078ed9a82ae328873fd6efb6c226114e9e66408bb9ee93a70661a779339b",
  implementationSha256: "27c063952aa505ff766c68defc246b64eb843c474a02bdbfbcdafd207e09641d",
  sourceSha256: "5ce578840a41a665fe10da3c11046ef097b799f3e10a130669ef4081727b9118",
  frameCount: 72,
  minimumIoU: 0.1690789342863669,
  maximumIoU: 0.18087925908411773,
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const iou = (a, b) => {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / (a.width * a.height + b.width * b.height - intersection);
};
const close = (a, b) => Math.abs(a - b) <= 1e-12;

/** Replay whole-person segmentation as a refusal of complete-head localization. */
export async function replayFacePersonSegmentation(reportPath) {
  const bytes = await readFile(resolve(reportPath));
  assert.equal(digest(bytes), EXPECTED.reportSha256, "person-segmentation probe identity changed");
  const report = JSON.parse(bytes);
  assert.equal(report.kind, "face-localization-person-segmentation-probe");
  assert.equal(report.status, "refused");
  assert.equal(report.promotion, false);
  assert.equal(report.recipe.minimumBoxIoU, 0.5);
  assert.equal(report.recipe.maskThreshold, 128);
  assert.equal(report.source.sha256, EXPECTED.sourceSha256);
  assert.equal(report.source.frames, EXPECTED.frameCount);
  assert.equal(report.implementation.sha256, EXPECTED.implementationSha256);
  assert.equal(report.frames.length, EXPECTED.frameCount);
  const values = [];
  for (const [ordinal, row] of report.frames.entries()) {
    assert.equal(row.ordinal, ordinal);
    assert.equal(row.status, "available");
    assert.equal(row.maskWidth, 2016);
    assert.equal(row.maskHeight, 1512);
    assert.equal(row.candidate.length, 4);
    const candidate = { x: row.candidate[0], y: row.candidate[1], width: row.candidate[2], height: row.candidate[3] };
    const overlap = iou(candidate, report.authoredZone);
    assert.ok(close(overlap, row.iou), `candidate IoU changed at ${ordinal}`);
    assert.ok(overlap < report.recipe.minimumBoxIoU, `unexpected passing candidate at ${ordinal}`);
    values.push(overlap);
  }
  assert.equal(report.candidateFrameCount, EXPECTED.frameCount);
  assert.equal(report.unavailableFrameCount, 0);
  assert.ok(close(Math.min(...values), EXPECTED.minimumIoU));
  assert.ok(close(Math.max(...values), EXPECTED.maximumIoU));
  assert.match(report.additionalRefusal.reason, /whole-person silhouette/);
  return {
    status: report.status,
    promotion: report.promotion,
    candidateFrames: values.length,
    passedFrames: values.filter((value) => value >= report.recipe.minimumBoxIoU).length,
    failedFrames: values.filter((value) => value < report.recipe.minimumBoxIoU).length,
    minimumIoU: Math.min(...values),
    maximumIoU: Math.max(...values),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node face-person-segmentation-replay.mjs <probe.json>");
  console.log(JSON.stringify(await replayFacePersonSegmentation(process.argv[2])));
}
