import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED = {
  reportSha256: "2c46f4d212ee0c0261880613496779583ea1c945195d5173d1a9f7f1bca7b006",
  implementationSha256: "13364e0957e0e976cbf652a00d41d0e437fe83cfa6c2182fbe2cde215f2a8b62",
  sourceSha256: "5ce578840a41a665fe10da3c11046ef097b799f3e10a130669ef4081727b9118",
  frameCount: 72,
  candidateFrameCount: 22,
  unavailableFrameCount: 50,
  minimumIoU: 0.3734864641896303,
  maximumIoU: 0.48382841091381407,
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const iou = (a, b) => {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / (a.width * a.height + b.width * b.height - intersection);
};
const close = (a, b) => Math.abs(a - b) <= 1e-12;

/** Replay the body-pose head hypothesis and keep its refusal executable. */
export async function replayFaceBodyPoseHead(reportPath) {
  const bytes = await readFile(resolve(reportPath));
  assert.equal(digest(bytes), EXPECTED.reportSha256, "body-pose probe identity changed");
  const report = JSON.parse(bytes);
  assert.equal(report.kind, "face-localization-body-pose-head-probe");
  assert.equal(report.status, "refused");
  assert.equal(report.promotion, false);
  assert.equal(report.recipe.minimumBoxIoU, 0.5);
  assert.deepEqual(report.recipe.joints, ["nose", "left_eye", "right_eye", "left_ear", "right_ear", "neck"]);
  assert.equal(report.source.sha256, EXPECTED.sourceSha256);
  assert.equal(report.source.frames, EXPECTED.frameCount);
  assert.equal(report.implementation.sha256, EXPECTED.implementationSha256);
  assert.equal(report.frames.length, EXPECTED.frameCount);
  const values = [];
  for (const [ordinal, row] of report.frames.entries()) {
    assert.equal(row.ordinal, ordinal);
    assert.ok(["available", "no_body", "no_head_joints"].includes(row.status));
    if (row.candidate === undefined) {
      assert.equal(row.iou, undefined);
      assert.deepEqual(row.joints, []);
      assert.ok(row.status !== "available");
      continue;
    }
    assert.equal(row.status, "available");
    assert.equal(row.candidate.length, 4);
    assert.ok(row.joints.length > 0);
    for (const joint of row.joints) {
      assert.ok(report.recipe.joints.includes(joint.name));
      assert.ok(Number.isFinite(joint.x) && Number.isFinite(joint.y));
      assert.ok(joint.confidence > 0 && joint.confidence <= 1);
    }
    const candidate = { x: row.candidate[0], y: row.candidate[1], width: row.candidate[2], height: row.candidate[3] };
    const overlap = iou(candidate, report.authoredZone);
    assert.ok(close(overlap, row.iou), `candidate IoU changed at ${ordinal}`);
    assert.ok(overlap < report.recipe.minimumBoxIoU, `unexpected passing candidate at ${ordinal}`);
    values.push(overlap);
  }
  assert.equal(report.candidateFrameCount, EXPECTED.candidateFrameCount);
  assert.equal(report.unavailableFrameCount, EXPECTED.unavailableFrameCount);
  assert.equal(values.length, EXPECTED.candidateFrameCount);
  assert.ok(close(Math.min(...values), EXPECTED.minimumIoU));
  assert.ok(close(Math.max(...values), EXPECTED.maximumIoU));
  assert.match(report.additionalRefusal.reason, /unavailable on 50 of 72 frames/);
  return {
    status: report.status,
    promotion: report.promotion,
    candidateFrames: values.length,
    unavailableFrames: report.unavailableFrameCount,
    passedFrames: values.filter((value) => value >= report.recipe.minimumBoxIoU).length,
    failedFrames: values.filter((value) => value < report.recipe.minimumBoxIoU).length,
    minimumIoU: Math.min(...values),
    maximumIoU: Math.max(...values),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node face-body-pose-head-replay.mjs <probe.json>");
  console.log(JSON.stringify(await replayFaceBodyPoseHead(process.argv[2])));
}
