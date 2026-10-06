import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { replaySceneDelivery } from "./scene-delivery-replay.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/30-delivered-scenes/native/report.json",
  import.meta.url,
).pathname;

test("replays the retained delivered-scene receipt", async () => {
  const result = await replaySceneDelivery(receipt);
  assert.equal(result.kind, "delivered-scene-report");
  assert.deepEqual(result.observedSceneTimes, [1000000, 1200000, 2600000, 3200000]);
  assert.equal(result.exportImmutable, true);
  assert.equal(result.sourceBytesUnchanged, true);
});

test("refuses a delivered-scene receipt with a changed physical gap", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-scene-replay-"));
  try {
    const report = JSON.parse(await readFile(receipt, "utf8"));
    report.checks.visualControls.gap = [1200000, 2500001];
    const path = join(scratch, "report.json");
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(() => replaySceneDelivery(path), /visualControls\.gap/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
