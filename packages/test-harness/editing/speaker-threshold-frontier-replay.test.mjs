import test from "node:test";
import assert from "node:assert/strict";

import { replaySpeakerThresholdFrontier } from "./speaker-threshold-frontier-replay.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/31-speaker-replication/threshold-frontier.json",
  import.meta.url,
).pathname;

test("retains the four-speaker threshold frontier refusal", async () => {
  const result = await replaySpeakerThresholdFrontier(receipt);
  assert.equal(result.status, "no-global-threshold-closes-four-speaker-gate");
  assert.equal(result.promotion, false);
  assert.equal(result.bestOverlapAtDerGate.threshold, 0.28);
  assert.equal(result.bestOverlapAtDerGate.der, 0.19851108033241474);
  assert.equal(result.bestDerAtOverlapGate.threshold, 0.08);
  assert.equal(result.bestDerAtOverlapGate.der, 0.3269563711911385);
});
