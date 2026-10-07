import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Replay the retained long-input transport boundary without model loading. */
export async function replaySpeakerLongInputEnvelope(receiptPath) {
  const root = resolve(receiptPath, "..");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const requestPath = resolve(root, receipt.request.path);
  const responsePath = resolve(root, receipt.response.path);
  const transportPath = resolve(root, receipt.transport.path);
  const requestBytes = await readFile(requestPath);
  const responseBytes = await readFile(responsePath);
  const transportBytes = await readFile(transportPath);
  assert.equal(digest(requestBytes), receipt.request.sha256);
  assert.equal(digest(responseBytes), receipt.response.sha256);
  assert.equal(digest(transportBytes), receipt.transport.sha256);
  const request = JSON.parse(requestBytes);
  const response = JSON.parse(responseBytes);
  const transport = JSON.parse(transportBytes);
  const selected = response.ok && response.data.cases.find((value) => value.id === receipt.case);
  assert.equal(request.params.cases[0].frames, receipt.request.frames);
  assert.equal(request.params.cases[0].pcmSha256, receipt.response.pcmSha256);
  assert.equal(selected.audioSeconds, receipt.response.reportedAudioSeconds);
  assert.equal(transport.exitCode, receipt.transport.exitCode);
  assert.equal(transport.networkDenied, receipt.transport.networkDenied);
  assert.equal(receipt.response.reportedAudioSeconds, receipt.gates.audioSecondsMustEqual);
  assert.equal(receipt.response.reportedAudioSeconds, receipt.request.audioSeconds);
  return {
    status: receipt.status,
    completeInput: true,
    audioSeconds: selected.audioSeconds,
    exitCode: transport.exitCode,
    promotion: receipt.gates.promotion,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node speaker-long-input-envelope-replay.mjs <receipt>");
  console.log(JSON.stringify(await replaySpeakerLongInputEnvelope(process.argv[2]), null, 2));
}
