import test from "node:test";
import assert from "node:assert/strict";
import { replayNemotronV2 } from "./nemotron-v2-replay.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/31-speaker-replication/alternative-evidence/nemotron-v2/protocol.json",
  import.meta.url,
).pathname;

test("replays the Nemotron v2 short-first refusal", async () => {
  const result = await replayNemotronV2(receipt);
  assert.equal(result.status, "refused-short-quality");
  assert.equal(result.promotion, false);
  assert.equal(result.heldOut.passed, false);
});
