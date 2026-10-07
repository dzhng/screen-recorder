import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const EXPECTED = {
  receiptSha256: "848418ffcb7fa02c65afd4e72e5e2f66b6a0815d688717feabc34a532e3a9ed1",
  compressedSha256: "4b81f5f21b6577eff30f3629bce6d688f26fd412cf3b316870c06c02a9340ca0",
  uncompressedSha256: "a1f378a27a929c10ef51e84f56e534921617d5c0168f9c31225c3b21f6dd5942",
  sourceSha256: "5ce578840a41a665fe10da3c11046ef097b799f3e10a130669ef4081727b9118",
  implementationId:
    "vision-face-rectangles-v1:revision-2:Version 27.0.1 (Build 26A434):landmarks-revision-3",
  failedOrdinals: [63, 64, 65, 66, 67, 68, 69, 70, 71],
  failedIoU: [
    0.4638574688091655,
    0.47135747047916465,
    0.4974980754426482,
    0.48489425981873113,
    0.4771923020989869,
    0.4823791749478889,
    0.4959581780337867,
    0.4959581780337867,
    0.4865336175159853,
  ],
};

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const equalNumber = (actual, expected) => Math.abs(actual - expected) <= 1e-12;

/**
 * Replay the retained Vision revision-2 experiment without rerunning native
 * inference. The experiment is intentionally refused: its nine remaining
 * frames are below the unchanged 0.5 IoU gate and the candidate is not a
 * production detector identity.
 */
export async function replayFaceLocalizationRevisionProbe(reportPath) {
  const resolved = resolve(reportPath);
  const receiptBytes = await readFile(resolved);
  assert.equal(digest(receiptBytes), EXPECTED.receiptSha256, "probe receipt identity changed");
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.kind, "face-localization-revision-probe");
  assert.equal(receipt.status, "refused");
  assert.equal(receipt.promotion, false);
  assert.equal(receipt.recipe?.visionRevision, 2);
  assert.equal(receipt.recipe?.minimumBoxIoU, 0.5);
  assert.equal(receipt.source?.sha256, EXPECTED.sourceSha256);
  assert.equal(receipt.implementationId, EXPECTED.implementationId);
  assert.equal(receipt.candidateReport?.sha256, EXPECTED.compressedSha256);
  assert.equal(receipt.candidateReport?.uncompressedSha256, EXPECTED.uncompressedSha256);
  assert.deepEqual(
    receipt.failedFrames.map(({ ordinal }) => ordinal),
    EXPECTED.failedOrdinals,
  );
  receipt.failedFrames.forEach((row, index) =>
    assert.ok(equalNumber(row.iou, EXPECTED.failedIoU[index]), `IoU changed at ${row.ordinal}`),
  );
  assert.equal(receipt.failureCount, EXPECTED.failedOrdinals.length);
  assert.ok(receipt.additionalRefusal?.reason);

  const compressedPath = join(dirname(resolved), receipt.candidateReport.path);
  const compressed = await readFile(compressedPath);
  assert.equal(digest(compressed), EXPECTED.compressedSha256, "candidate identity changed");
  const uncompressed = gunzipSync(compressed);
  assert.equal(digest(uncompressed), EXPECTED.uncompressedSha256, "candidate payload changed");
  const candidate = JSON.parse(uncompressed);
  assert.equal(candidate.id, "graham");
  assert.equal(candidate.inputSha256, EXPECTED.sourceSha256);
  assert.equal(candidate.source.assetId, EXPECTED.sourceSha256);
  assert.equal(candidate.frames.length, 72);
  assert.equal(candidate.tracks.length, 1);

  const failed = [];
  for (const [ordinal, frame] of candidate.frames.entries()) {
    assert.equal(frame.ordinal, ordinal);
    assert.equal(frame.observations.implementationId, EXPECTED.implementationId);
    assert.deepEqual(frame.receipt.faceObservations, frame.observations);
    assert.equal(frame.localization.passed, ordinal < 63);
    if (!frame.localization.passed) {
      failed.push(ordinal);
      assert.equal(frame.localization.failures.length, 1);
      assert.match(frame.localization.failures[0], /^Independent zone IoU [0-9.]+ below 0.5$/);
    }
  }
  assert.deepEqual(failed, EXPECTED.failedOrdinals);
  return {
    status: receipt.status,
    promotion: receipt.promotion,
    candidateFrames: candidate.frames.length,
    failedOrdinals: failed,
    minFailedIoU: Math.min(...EXPECTED.failedIoU),
    maxFailedIoU: Math.max(...EXPECTED.failedIoU),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node face-localization-revision-probe-replay.mjs <report.json>");
  console.log(JSON.stringify(await replayFaceLocalizationRevisionProbe(process.argv[2])));
}
