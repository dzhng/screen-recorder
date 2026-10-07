import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { replayMotionDelivery } from "./motion-delivery-replay.mjs";

const reportPath = new URL(
  "../../../specs/done/video-editing-feedback/assets/27-29-transitions/motion-delivery-replay.json",
  import.meta.url,
);

test("replays the retained moving trajectory delivery receipt", async () => {
  const result = await replayMotionDelivery(reportPath);
  assert.deepEqual(result, {
    case: "moved-split-zoom",
    pictures: 39,
    wholeCurveRefusals: 0,
    movedPictures: 8,
    splitPictures: 8,
    previewExportExact: true,
  });
});

test("refuses a changed moving trajectory receipt", async () => {
  const directory = await mkdtemp("/tmp/yap-motion-replay-");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.checks.movedPictures = 7;
  const path = join(directory, "report.json");
  try {
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(() => replayMotionDelivery(path), /movedPictures changed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("refuses changed delivered trajectory coverage", async () => {
  const directory = await mkdtemp("/tmp/yap-motion-coverage-replay-");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.checks.coverage[0].bounds[0] += 1;
  const path = join(directory, "report.json");
  try {
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(() => replayMotionDelivery(path), /coverage changed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("refuses retained trajectory output bytes that no longer match the receipt", async () => {
  const directory = await mkdtemp("/tmp/yap-motion-artifact-replay-");
  try {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    for (const key of ["full", "range"]) {
      await copyFile(
        new URL(
          `../../../specs/done/video-editing-feedback/assets/27-29-transitions/${key}.mp4`,
          import.meta.url,
        ),
        join(directory, `${key}.mp4`),
      );
    }
    const full = join(directory, "full.mp4");
    const bytes = await readFile(full);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(full, bytes);
    const path = join(directory, "report.json");
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(() => replayMotionDelivery(path), /full output bytes changed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
