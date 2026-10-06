import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runParityReplay } from "./transition-parity-replay.mjs";

const receipt = new URL(
  "../../../specs/video-editing-feedback/assets/27-29-transitions/crossfade/comparator/transition/report/visual-parity-diff.json",
  import.meta.url,
).pathname;

test("replays the frozen transition parity receipt", async () => {
  const result = await runParityReplay(receipt);
  assert.equal(result.source, "visual-parity-diff.json");
  assert.match(result.sourceSha256, /^[0-9a-f]{64}$/);
  assert.equal(result.pairCount, 9);
  assert.equal(result.maxParityDistance, 0);
  assert.equal(result.maxPixelmatchRatio, 0);
  assert.equal(result.maxEdgeDiffRatio32, 0);
  assert.equal(result.crossfadeMidpointMae, 0.2848);
});

test("refuses a frozen receipt with a mismatched pair", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-transition-parity-"));
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.results[0].grayscale.pixelmatchRatio = 0.01;
    const path = join(scratch, "report.json");
    await writeFile(path, JSON.stringify(changed));
    await assert.rejects(() => runParityReplay(path), /pixelmatchRatio/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
