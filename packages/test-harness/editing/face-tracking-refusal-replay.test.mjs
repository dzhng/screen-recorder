import test from "node:test";
import assert from "node:assert/strict";
import { replayFaceTrackingRefusal } from "./face-tracking-refusal-replay.mjs";

const root = new URL("../../../specs/video-editing-feedback/assets/15-face-observations/", import.meta.url).pathname;

test("replays the high-IoU tracker hypothesis as refused evidence", async () => {
  assert.deepEqual(await replayFaceTrackingRefusal(`${root}tracking-probe.json`), {
    status: "refused",
    promotion: false,
    hosts: ["graham", "madison", "lily"],
    framesPerHost: 72,
    passedFrames: 216,
    failedFrames: 0,
    minimumIoU: 0.6243931370520276,
    maximumIoU: 0.8618868907825812,
  });
});

test("rejects edited tracker evidence", async () => {
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const scratch = await mkdtemp("/tmp/yap-face-tracker-refusal-");
  try {
    const report = JSON.parse(await readFile(`${root}tracking-probe.json`, "utf8"));
    report.cases[0].frames[44].iou = 0;
    const changed = join(scratch, "tracking-probe.json");
    await writeFile(changed, JSON.stringify(report));
    await assert.rejects(() => replayFaceTrackingRefusal(changed), /identity changed|IoU|refusal/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
