import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

test("rejects a threshold frontier with a missing retained threshold row", async () => {
  const directory = await mkdtemp("/tmp/yap-threshold-frontier-");
  try {
    const report = JSON.parse(await readFile(receipt, "utf8"));
    report.sweep.rows.pop();
    const path = join(directory, "threshold-frontier.json");
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(() => replaySpeakerThresholdFrontier(path), /every threshold row/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
