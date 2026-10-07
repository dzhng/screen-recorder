import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Replay a frozen probability-threshold sweep without model loading or inference. */
export async function replaySpeakerThresholdFrontier(receiptPath) {
  const bytes = await readFile(resolve(receiptPath));
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.input.protocolSha256, "8f6ca56aefe8ce002679ae0c5d184b044d1c15d80639d51bbda06e530ecffb53");
  assert.equal(receipt.input.rawSha256, "a4e19b51a185bea9244802d4e4aca384ad229006f99f8dc44378af08eaba840f");
  assert.equal(receipt.input.nativeSha256, "d25e722d03386cc719cb526af65ca880fb0db61a8ba78fa3f5019f702a7860e3");
  assert.equal(receipt.sweep.kind, "independent-slot-global-threshold");
  assert.equal(receipt.sweep.frames, 7500);
  assert.equal(receipt.sweep.frameSeconds, 0.08);
  assert.equal(receipt.sweep.gates.derMaximum, 0.2);
  assert.equal(receipt.sweep.gates.overlapRecallMinimum, 0.8);
  assert(receipt.sweep.rows.length >= 40);
  assert(receipt.sweep.rows.every((row) => Number.isFinite(row.der) && Number.isFinite(row.overlapRecall)));

  const bestOverlapAtDerGate = receipt.sweep.rows
    .filter((row) => row.der <= receipt.sweep.gates.derMaximum)
    .sort((a, b) => b.overlapRecall - a.overlapRecall || a.threshold - b.threshold)[0] ?? null;
  const bestDerAtOverlapGate = receipt.sweep.rows
    .filter((row) => row.overlapRecall >= receipt.sweep.gates.overlapRecallMinimum)
    .sort((a, b) => a.der - b.der || a.threshold - b.threshold)[0] ?? null;
  assert.deepEqual(bestOverlapAtDerGate, receipt.summary.bestOverlapAtDerGate);
  assert.deepEqual(bestDerAtOverlapGate, receipt.summary.bestDerAtOverlapGate);
  assert(receipt.summary.bestDerAtOverlapGate.der > receipt.sweep.gates.derMaximum);
  assert.equal(receipt.summary.promotion, false);
  assert.equal(receipt.status, "no-global-threshold-closes-four-speaker-gate");
  return {
    status: receipt.status,
    promotion: receipt.summary.promotion,
    bestOverlapAtDerGate,
    bestDerAtOverlapGate,
    inputDigest: digest(bytes),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node speaker-threshold-frontier-replay.mjs <threshold-frontier.json>");
  console.log(JSON.stringify(await replaySpeakerThresholdFrontier(process.argv[2]), null, 2));
}
