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
