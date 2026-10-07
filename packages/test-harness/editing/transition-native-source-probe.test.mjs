import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runNativeSourceProbeReplay } from "./transition-native-source-probe.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/27-29-transitions/reference-parity/native-source-probe.json",
  import.meta.url,
).pathname;

test("replays native AVAssetReader source evidence without promoting moving parity", async () => {
  const result = await runNativeSourceProbeReplay(receipt);
  assert.equal(result.kind, "transition-native-source-conversion-probe");
  assert.equal(result.status, "open");
  assert.equal(result.sources.alpha.frameCount, 4);
  assert.equal(result.sources.mirror.frameCount, 4);
  assert.ok(result.sourceComparisons.every(({ comparison }) => comparison.differingRatio > 0));
  assert.ok(result.candidateComparisons.every(({ comparison }) => comparison.differingRatio > 0));
  assert.ok(result.premultipliedCandidateComparisons.every(({ comparison }) => comparison.differingRatio === 0));
  assert.equal(result.premultipliedGate.passed, true);
  assert.equal(result.gate.passed, false);
});

test("refuses a native source probe promoted by editing its status", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-transition-native-source-"));
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.status = "passed";
    const report = join(scratch, "native-source-probe.json");
    await writeFile(report, JSON.stringify(changed));
    await assert.rejects(() => runNativeSourceProbeReplay(report), /open/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
