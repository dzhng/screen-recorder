import test from "node:test";
import assert from "node:assert/strict";
import { replaySpeakerLongInputEnvelope } from "./speaker-long-input-envelope-replay.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/31-speaker-replication/long-input-envelope.json",
  import.meta.url,
).pathname;

test("retains complete transport for the failed four-speaker long input", async () => {
  const result = await replaySpeakerLongInputEnvelope(receipt);
  assert.equal(result.completeInput, true);
  assert.equal(result.audioSeconds, 600);
  assert.equal(result.exitCode, 0);
  assert.equal(result.promotion, false);
});
