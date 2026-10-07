import assert from "node:assert/strict";
import test from "node:test";
import { runRgbaHalfProbeReplay } from "./transition-rgba-half-source-probe.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/27-29-transitions/reference-parity/rgba-half-source-probe.json",
  import.meta.url,
).pathname;

test("replays the retained RGBAHalf source conversion refusal", async () => {
  const result = await runRgbaHalfProbeReplay(receipt);
  assert.equal(result.kind, "transition-rgba-half-source-conversion-probe");
  assert.equal(result.status, "open");
  assert.equal(result.frameCount, 8);
  assert.equal(result.maxChannelDelta, 1);
  assert.equal(result.allFramesRetainResidual, true);
});
