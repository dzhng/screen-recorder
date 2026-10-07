import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const EXPECTED = {
  reportSha256: "a32cf78ff577af187106ebd84863de91bb7b41ca48133ae0c40aabd9c617fa0d",
  implementationSha256: "8e211369611816a9efc77eff755711191f0f8efb3158534fb5d2014671ea051f",
  hosts: ["graham", "madison", "lily"],
  framesPerHost: 72,
  minimumIoU: 0.6243931370520276,
  maximumIoU: 0.8618868907825812,
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const iou = (a, b) => {
  const width = Math.max(0, Math.min(a[0] + a[2], b.x + b.width) - Math.max(a[0], b.x));
  const height = Math.max(0, Math.min(a[1] + a[3], b.y + b.height) - Math.max(a[1], b.y));
  const intersection = width * height;
  return intersection / (a[2] * a[3] + b.width * b.height - intersection);
};
const close = (a, b) => Math.abs(a - b) <= 1e-12;

/** Replay the temporal tracker hypothesis and keep its contract refusal executable. */
export async function replayFaceTrackingRefusal(reportPath) {
  const resolved = resolve(reportPath);
  const bytes = await readFile(resolved);
  assert.equal(digest(bytes), EXPECTED.reportSha256, "tracker probe identity changed");
  const report = JSON.parse(bytes);
  assert.equal(report.schema, "face-localization-tracking-probe-v1");
  assert.equal(report.status, "refused");
  assert.equal(report.promotion, false);
  assert.equal(report.recipe.tracker, "VNTrackObjectRequest");
  assert.equal(report.recipe.trackingLevel, "accurate");
  assert.equal(report.recipe.minimumBoxIoU, 0.5);
  assert.equal(report.sourceFrames, EXPECTED.framesPerHost);
  const implementation = await readFile(join(dirname(resolved), "tracking-probe", "probe.swift"));
  assert.equal(digest(implementation), EXPECTED.implementationSha256, "tracker implementation changed");
  assert.match(report.reason, /temporal prediction/);
  assert.match(report.reason, /occlusion/);
  assert.match(report.reason, /explicit contract/);
  assert.deepEqual(report.cases.map((item) => item.id), EXPECTED.hosts);

  const all = [];
  for (const host of report.cases) {
    assert.equal(host.frames.length, EXPECTED.framesPerHost, `${host.id} frame count changed`);
    const zone = {
      graham: { x: 280, y: 68, width: 116, height: 164 },
      madison: { x: 234, y: 56, width: 167, height: 210 },
      lily: { x: 242, y: 134, width: 141, height: 203 },
    }[host.id];
    for (const [ordinal, frame] of host.frames.entries()) {
      assert.equal(frame.ordinal, ordinal, `${host.id}/${ordinal} ordinal changed`);
      assert.equal(frame.status ?? "tracked", "tracked");
      assert.equal(frame.box.length, 4);
      const measured = iou(frame.box, zone);
      assert.ok(close(measured, frame.iou), `${host.id}/${ordinal} IoU changed`);
      assert.ok(frame.iou >= report.recipe.minimumBoxIoU, `${host.id}/${ordinal} tracker no longer passes`);
      all.push(frame.iou);
    }
  }
  assert.equal(all.length, EXPECTED.hosts.length * EXPECTED.framesPerHost);
  assert.equal(all.filter((value) => value >= report.recipe.minimumBoxIoU).length, 216);
  assert.ok(close(Math.min(...all), EXPECTED.minimumIoU));
  assert.ok(close(Math.max(...all), EXPECTED.maximumIoU));
  return {
    status: report.status,
    promotion: report.promotion,
    hosts: EXPECTED.hosts,
    framesPerHost: EXPECTED.framesPerHost,
    passedFrames: all.length,
    failedFrames: 0,
    minimumIoU: Math.min(...all),
    maximumIoU: Math.max(...all),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node face-tracking-refusal-replay.mjs <probe.json>");
  console.log(JSON.stringify(await replayFaceTrackingRefusal(process.argv[2])));
}
