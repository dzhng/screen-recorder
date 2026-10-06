import assert from "node:assert/strict";

// Engine processingTime is measured work, not recognized evidence. Every other field stays exact.
export function comparableSpeechRecords(bytes) {
  return bytes
    .toString("utf8")
    .trim()
    .split("\n")
    .map(JSON.parse)
    .map((line) => {
      if (!line.result) return line;
      const { processingTime, ...result } = line.result;
      assert.ok(Number.isFinite(processingTime), "Raw engine processingTime must remain recorded");
      return { ...line, result };
    });
}

// Only historical <=20s whole-support decodes have unchanged inference topology.
// Validate added ownership/candidate evidence, then compare every original operand.
// Bounded/context/seam output cannot use this historical view.
export function historicalWholeSupportRecords(bytes) {
  return comparableSpeechRecords(bytes).map((line) => {
    const { owned, observations, selectedObservationIndexes, boundary, ...original } = line;
    if (owned !== undefined) assert.deepEqual(owned, line.source);
    assert.ok(line.source.endUs - line.source.startUs <= 20_000_000);
    assert.ok(boundary === undefined || boundary === null, "Seam output has different topology");
    if (observations !== undefined || selectedObservationIndexes !== undefined) {
      assert.deepEqual(observations, line.words);
      assert.deepEqual(
        selectedObservationIndexes,
        line.words.map((_, index) => index),
      );
    }
    return original;
  });
}
