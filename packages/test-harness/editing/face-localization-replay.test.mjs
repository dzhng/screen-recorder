import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { replayFaceLocalization } from "./face-localization-replay.mjs";

const root = new URL("../../../specs/done/video-editing-feedback/assets/15-face-observations/", import.meta.url).pathname;
const evidence = join(root, "native-evidence.json");

test("replays the retained face localization failure without promoting it", async () => {
  const result = await replayFaceLocalization(evidence);
  assert.deepEqual(result, {
    hosts: ["graham", "madison", "lily"],
    framesPerHost: 72,
    passingFrames: 189,
    failedFrames: 27,
    failedHost: "graham",
    failedOrdinals: [44, 45, ...Array.from({ length: 25 }, (_, i) => i + 47)],
    minFailedIoU: 0.32805929352396973,
    maxFailedIoU: 0.49199874490116097,
    allFailedCentersInsideAuthoredZones: true,
    status: "open",
  });
});

test("rejects a retained face report whose failed box was edited", async () => {
  const scratch = await mkdtemp("/tmp/yap-face-localization-replay-");
  try {
    const report = JSON.parse(await readFile(evidence, "utf8"));
    report.cases[0].frames.find((frame) => frame.ordinal === 44).observations.faces[0].boundingBox.width += 1;
    const changed = join(scratch, "native-evidence.json");
    await writeFile(changed, JSON.stringify(report));
    await assert.rejects(() => replayFaceLocalization(changed), /IoU mismatch|failed ordinal set|native evidence identity/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
