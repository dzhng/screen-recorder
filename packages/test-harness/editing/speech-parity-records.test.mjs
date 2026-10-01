import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { comparableSpeechRecords } from "./speech-parity-records.mjs";

test("complete speech parity permits measured duration changes and refuses changed evidence", async () => {
  const raw = await readFile(
    new URL(
      "../../../specs/agent-editing/assets/10b-native-selection/selected/first-physical-selected.jsonl",
      import.meta.url,
    ),
  );
  const expected = comparableSpeechRecords(raw);
  const lines = raw.toString("utf8").trim().split("\n").map(JSON.parse);
  const compare = () =>
    assert.deepEqual(
      comparableSpeechRecords(Buffer.from(lines.map(JSON.stringify).join("\n") + "\n")),
      expected,
    );
  lines[0].result.processingTime += 1;
  compare();
  lines[0].words[0].source.startUs += 1;
  assert.throws(compare, assert.AssertionError);
  lines[0].words[0].source.startUs -= 1;
  lines[0].result.text += " changed";
  assert.throws(compare, assert.AssertionError);
});
