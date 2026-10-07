import test from "node:test";
import assert from "node:assert/strict";
import { replayFacePersonSegmentation } from "./face-person-segmentation-replay.mjs";

const root = new URL("../../../specs/done/video-editing-feedback/assets/15-face-observations/", import.meta.url).pathname;

test("replays the person-segmentation candidate as an explicit refusal", async () => {
  const result = await replayFacePersonSegmentation(`${root}person-segmentation-probe.json`);
  assert.equal(result.status, "refused");
  assert.equal(result.candidateFrames, 72);
  assert.equal(result.passedFrames, 0);
  assert.equal(result.failedFrames, 72);
  assert.equal(result.minimumIoU < 0.5, true);
});
