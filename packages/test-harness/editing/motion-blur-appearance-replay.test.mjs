import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { replayMotionBlurAppearance } from "./motion-blur-appearance-replay.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/27-29-transitions/motion-blur/appearance-repair-report.json",
  import.meta.url,
).pathname;

test("replays the immutable bounded motion-blur appearance receipt", async () => {
  const result = await replayMotionBlurAppearance(receipt);
  assert.equal(result.status, "passed");
  assert.equal(result.samples, 4);
  assert.equal(result.transparentPixels, 0);
  assert.equal(result.maxEdgeExpansion, 1);
  assert.ok(result.blurChangedPixels > 0);
});

test("refuses a motion-blur appearance receipt with edited bounds", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-motion-blur-replay-"));
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.checks[0].blurredBounds.maxX += 1;
    const path = join(scratch, "report.json");
    await writeFile(path, JSON.stringify(changed));
    await assert.rejects(() => replayMotionBlurAppearance(path), /blurredBounds/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
