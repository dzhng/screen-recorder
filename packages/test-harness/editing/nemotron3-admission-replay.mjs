import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED = {
  protocolSha256: "c97feedb3749d8ee822c839f567ce97f4e1934c0747f6d31b9f28148a2c9772d",
  modelRevision: "f667ed73aee57d40cc39428eb768b4fd87a0a29e",
  artifactSha256: "867c53f552998f772e5b5e5c082962ae85ee7ca5669c2bc17d7f615133d4e96d",
  artifactBytes: 198676480,
};

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Replay the immutable Nemotron-3 admission boundary without loading the model. */
export async function replayNemotron3Admission(receiptPath) {
  const bytes = await readFile(resolve(receiptPath));
  assert.equal(digest(bytes), EXPECTED.protocolSha256, "Nemotron-3 protocol identity changed");
  const report = JSON.parse(bytes);
  assert.equal(report.status, "refused-before-inference");
  assert.equal(report.candidate.provider, "nvidia");
  assert.equal(report.candidate.repository, "nvidia/Nemotron-3-Diarization");
  assert.equal(report.candidate.revision, EXPECTED.modelRevision);
  assert.equal(report.candidate.artifact, "Nemotron-3-Diarization.nemo");
  assert.equal(report.candidate.artifactBytes, EXPECTED.artifactBytes);
  assert.equal(report.candidate.artifactSha256, EXPECTED.artifactSha256);
  assert.equal(report.candidate.declaredNemoVersion, "3.0.0");
  assert.equal(report.acquisition.state, "downloaded-and-hashed");
  assert.equal(report.acquisition.gitTrackedModel, false);
  assert.equal(report.runtime.nemo, "2.7.3");
  assert.equal(report.runtime.restore.state, "refused");
  assert.match(report.runtime.restore.error, /TransformerEncoder/);
  assert.equal(report.runtime.sourceCompatibilityProbe.state, "refused");
  assert.match(report.runtime.sourceCompatibilityProbe.error, /lhotse/);
  assert.equal(report.qualityGate.state, "not-run");
  assert.equal(report.qualityGate.promotion, false);
  assert.deepEqual(report.qualityGate.longExpansion, "blocked until every short gate passes");
  return {
    status: report.status,
    promotion: report.qualityGate.promotion,
    qualityState: report.qualityGate.state,
    modelRevision: report.candidate.revision,
    artifactSha256: report.candidate.artifactSha256,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node nemotron3-admission-replay.mjs <protocol.json>");
  console.log(JSON.stringify(await replayNemotron3Admission(process.argv[2])));
}
