import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultEvidenceRoot = fileURLToPath(
  new URL(
    "../../../specs/video-editing-feedback/assets/31-speaker-replication/handoff-evidence/",
    import.meta.url,
  ),
);

const readJSON = async (root, relative) =>
  JSON.parse(await readFile(join(root, relative), "utf8"));

/**
 * Verify the measured native streaming envelope without running inference.
 * The 600-second receipt is research evidence; it is not a public promotion.
 */
export async function readSpeakerStreamingEnvelope(root = defaultEvidenceRoot) {
  const protocol = await readJSON(root, "three-long/protocol.json");
  const transport = await readJSON(root, "three-long/transport.json");
  const longScores = await readJSON(root, "three-long/scores.json");
  const continuityProtocol = await readJSON(root, "continuity/protocol.json");
  const scores = await readJSON(root, "continuity/scores.json");
  const expectedRecipe = {
    chunk_len: 340,
    chunk_right_context: 40,
    fifo_len: 40,
    spkcache_update_period: 300,
    spkcache_len: 188,
  };
  const protocolState =
    "single native diarize call per selected input, persistent across internal27.2s chunks, resets between selections";
  const transportState =
    "one fresh state per selected input; persistent across all native internal chunks";

  assert.equal(protocol.status, "frozen-before-inference");
  assert.deepEqual(protocol.recipe, expectedRecipe);
  assert.equal(protocol.stateScope, protocolState, "cross-selection state contract");
  assert.equal(continuityProtocol.stateScope, protocolState, "cross-selection state contract");
  assert.deepEqual(transport.result?.data?.recipe, expectedRecipe);
  assert.equal(transport.result?.data?.stateScope, transportState, "cross-selection state contract");
  assert.equal(transport.networkDenied, true);

  const longCase = transport.result.data.cases.find((candidate) => candidate.id === "three-speaker600");
  assert(longCase, "three-speaker streaming receipt is missing");
  assert.equal(longCase.audioSeconds, 600);
  assert.equal(
    longCase.pcmSha256,
    protocol.cases.find((candidate) => candidate.id === "three-speaker600")?.pcmSha256,
  );
  assert(longCase.inferenceSeconds <= 600 * protocol.gates.inferenceWallAudioRatioMaximum);
  assert(longCase.peakProcessRSSBytes <= protocol.gates.RSSBytesMaximum);

  const retainedLong = longScores.cases.find((candidate) => candidate.id === "three-speaker600");
  const retainedOverlapFailure = scores.cases.find((candidate) => candidate.id === "four-speaker600");
  assert(retainedLong, "three-speaker continuity result is missing");
  assert(retainedOverlapFailure, "four-speaker overlap result is missing");
  assert.equal(retainedLong.passed, true);
  assert.equal(retainedOverlapFailure.passed, false);
  assert(retainedOverlapFailure.overlap.recall < protocol.gates.overlapRecallMinimum);

  return {
    kind: "speaker-native-streaming-envelope",
    stateScope: "single native diarize call per selected input",
    internalState: "persistent across native internal chunks",
    crossSelectionState: "reset between selections",
    publicWindowMaximumSeconds: 30,
    researchLongControl: {
      id: retainedLong.id,
      passed: retainedLong.passed,
      audioSeconds: longCase.audioSeconds,
    },
    requiredOverlapControl: {
      id: retainedOverlapFailure.id,
      passed: retainedOverlapFailure.passed,
      overlapRecall: retainedOverlapFailure.overlap.recall,
    },
    promotion: false,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await readSpeakerStreamingEnvelope(), null, 2));
}
