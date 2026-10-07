import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSourceAlphaProbeReplay } from "./transition-source-alpha-probe.mjs";

const receipt = new URL(
  "../../../specs/done/video-editing-feedback/assets/27-29-transitions/reference-parity/source-alpha-probe.json",
  import.meta.url,
).pathname;

test("replays the retained source-alpha conversion probe without promoting parity", async () => {
  const result = await runSourceAlphaProbeReplay(receipt);
  assert.equal(result.kind, "transition-source-alpha-conversion-probe");
  assert.equal(result.status, "open");
  assert.equal(result.hypothesis, "non-opaque-alpha-uses-256-normalization");
  assert.equal(result.samples.length, 3);
  assert.ok(result.samples.every((sample) => sample.baseline.differingRatio > 0));
  assert.ok(result.samples.every((sample) => sample.probe.differingRatio > 0));
  assert.ok(result.probeGate.passed === false);
});

test("refuses a source-alpha probe promoted by editing its status", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-transition-source-alpha-"));
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.status = "passed";
    const report = join(scratch, "source-alpha-probe.json");
    await writeFile(report, JSON.stringify(changed));
    await assert.rejects(() => runSourceAlphaProbeReplay(report), /open/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
