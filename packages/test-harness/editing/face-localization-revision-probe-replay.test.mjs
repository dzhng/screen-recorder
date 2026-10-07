import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { replayFaceLocalizationRevisionProbe } from "./face-localization-revision-probe-replay.mjs";

const root = new URL(
  "../../../specs/video-editing-feedback/assets/15-face-observations/revision-probe/",
  import.meta.url,
).pathname;
const receipt = join(root, "report.json");

test("replays the refused Vision revision-2 face probe", async () => {
  const result = await replayFaceLocalizationRevisionProbe(receipt);
  assert.deepEqual(result, {
    status: "refused",
    promotion: false,
    candidateFrames: 72,
    failedOrdinals: [63, 64, 65, 66, 67, 68, 69, 70, 71],
    minFailedIoU: 0.4638574688091655,
    maxFailedIoU: 0.4974980754426482,
  });
});

test("rejects a probe receipt edited to claim promotion", async () => {
  const scratch = await mkdtemp("/tmp/yap-face-revision-probe-");
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.promotion = true;
    const path = join(scratch, "report.json");
    await writeFile(path, JSON.stringify(changed));
    await assert.rejects(
      () => replayFaceLocalizationRevisionProbe(path),
      /probe receipt identity changed/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
