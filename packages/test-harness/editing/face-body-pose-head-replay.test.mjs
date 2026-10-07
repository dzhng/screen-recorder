import test from "node:test";
import assert from "node:assert/strict";
import { replayFaceBodyPoseHead } from "./face-body-pose-head-replay.mjs";

const root = new URL("../../../specs/done/video-editing-feedback/assets/15-face-observations/", import.meta.url).pathname;

test("replays the body-pose head geometry as an explicit refusal", async () => {
  const result = await replayFaceBodyPoseHead(`${root}body-pose-head-probe.json`);
  assert.equal(result.status, "refused");
  assert.equal(result.candidateFrames, 22);
  assert.equal(result.unavailableFrames, 50);
  assert.equal(result.passedFrames, 0);
  assert.equal(result.failedFrames, 22);
  assert.equal(result.minimumIoU < 0.5, true);
});
