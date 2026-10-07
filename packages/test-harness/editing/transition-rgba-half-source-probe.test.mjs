import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runRgbaHalfProbeReplay } from "./transition-rgba-half-source-probe.mjs";

const receipt = new URL(
  "../../../specs/done/video-editing-feedback/assets/27-29-transitions/reference-parity/rgba-half-source-probe.json",
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

test("rejects duplicated RGBAHalf frame indices", async () => {
  const directory = await mkdtemp("/tmp/yap-rgba-half-replay-");
  try {
    const report = JSON.parse(await readFile(receipt, "utf8"));
    report.sources.alpha.frames[1].index = 0;
    const path = join(directory, "rgba-half-source-probe.json");
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(() => runRgbaHalfProbeReplay(path), /unique frame indices/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
