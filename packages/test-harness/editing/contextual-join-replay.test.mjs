import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { discoverContextualRepair } from "./contextual-join-replay.mjs";

const receipt = JSON.parse(
  await readFile(
    new URL(
      "../../../specs/done/video-editing-feedback/assets/12-contextual-joins/media-fixture-report.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("fresh contextual discovery chooses the energetic clipped Parakeet edge and authors a bounded repair", () => {
  const plan = discoverContextualRepair(receipt);
  assert.equal(plan.caseName, "clipped");
  assert.equal(plan.expectedText, "fortunate");
  assert.equal(plan.assetId, receipt.fixtures.clipped.join.boundary.before.assetId);
  assert.equal(plan.streamId, receipt.fixtures.clipped.join.boundary.before.streamId);
  assert.equal(plan.clipId, receipt.fixtures.clipped.join.boundary.before.clipId);
  assert.equal(plan.sourceRange.startUs, 0);
  assert.equal(plan.sourceRange.endUs, receipt.fixtures.intact.join.boundary.before.sourceAtUs);
  assert.equal(plan.projectRange.endUs, plan.sourceRange.endUs);
  assert.ok(plan.tailRMS > receipt.fixtures.clipped.join.thresholdRMS);
  assert.notEqual(plan.observedText, "Fortunately,");
});

test("fresh contextual discovery refuses a receipt without a complete control", () => {
  const broken = structuredClone(receipt);
  delete broken.fixtures.intact;
  delete broken.fixtures.repaired;
  assert.throws(() => discoverContextualRepair(broken), /complete intact control/i);
});
