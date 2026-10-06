import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runReferenceParityReplay } from "./transition-reference-parity.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/27-29-transitions/reference-parity/report.json",
  import.meta.url,
).pathname;
const referenceRoot = new URL(
  "../../../specs/video-editing-feedback/assets/27-29-transitions/reference-parity/",
  import.meta.url,
).pathname;

test("replays the retained moving transition reference parity audit", async () => {
  const result = await runReferenceParityReplay(receipt);
  assert.equal(result.kind, "reference-conditioned-transition-parity");
  assert.equal(result.status, "open");
  assert.equal(result.sampleCount, 3);
  assert.ok(result.maxMae > 0);
  assert.ok(result.maxDifferingRatio > 0);
});

test("refuses a parity audit promoted by editing its status", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-transition-reference-parity-"));
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.status = "passed";
    await writeFile(join(scratch, "report.json"), JSON.stringify(changed));
    await assert.rejects(
      () => runReferenceParityReplay(join(scratch, "report.json")),
      /failed parity audit|open/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("refuses a parity audit with edited comparison metrics", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-transition-reference-metrics-"));
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.samples[0].comparison.mae = 0;
    await mkdir(join(scratch, "reference"));
    for (const sample of changed.samples) {
      await copyFile(
        join(referenceRoot, sample.reference.path),
        join(scratch, sample.reference.path),
      );
    }
    await writeFile(join(scratch, "report.json"), JSON.stringify(changed));
    await assert.rejects(
      () => runReferenceParityReplay(join(scratch, "report.json")),
      /comparison metrics changed/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
