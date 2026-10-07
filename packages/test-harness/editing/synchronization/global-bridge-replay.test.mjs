import assert from "node:assert/strict";
import test from "node:test";
import { runGlobalBridgeReplay } from "./global-bridge-replay.mjs";

const receipt = new URL(
  "../../../../specs/video-editing-feedback/assets/20-synchronization/bridge/global-refusal.json",
  import.meta.url,
).pathname;

test("replays the refusal of one global clock over edited bridge references", async () => {
  const result = await runGlobalBridgeReplay(receipt);
  assert.equal(result.kind, "global-bridge-synchronization-refusal");
  assert.equal(result.status, "refused");
  assert.equal(result.gate.passed, false);
  assert.ok(result.sourceGroups.some((group) => group.source === "grahamRaw"));
  assert.ok(result.sourceGroups
    .filter((group) => group.windows.length > 1)
    .every((group) => group.minimumDifferenceFrames > 32));
  assert.equal(result.nextAction, "piecewise-local-only");
});
