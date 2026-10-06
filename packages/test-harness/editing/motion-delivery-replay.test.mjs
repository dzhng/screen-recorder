import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { replayMotionDelivery } from "./motion-delivery-replay.mjs";

const reportPath = new URL(
  "../../../specs/video-editing-feedback/assets/27-29-transitions/motion-delivery-replay.json",
  import.meta.url,
);

test("replays the retained moving trajectory delivery receipt", async () => {
  const result = await replayMotionDelivery(reportPath);
  assert.deepEqual(result, {
    case: "moved-split-zoom",
    pictures: 39,
    wholeCurveRefusals: 0,
    movedPictures: 8,
    splitPictures: 8,
    previewExportExact: true,
  });
});

test("refuses a changed moving trajectory receipt", async () => {
  const directory = await mkdtemp("/tmp/yap-motion-replay-");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.checks.movedPictures = 7;
  const path = join(directory, "report.json");
  try {
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(() => replayMotionDelivery(path), /movedPictures changed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
