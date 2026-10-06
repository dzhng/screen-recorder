import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  comparableSpeechRecords,
  historicalWholeSupportRecords,
} from "./speech-parity-records.mjs";

test("complete speech parity permits measured duration changes and refuses changed evidence", async () => {
  const raw = await readFile(
    new URL(
      "../../../specs/done/agent-editing/assets/10b-native-selection/selected/first-physical-selected.jsonl",
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

test("historical whole-support parity validates new ownership before comparing every original operand", () => {
  const line = {
    ordinal: 0,
    source: { startUs: 0, endUs: 1000000 },
    result: { text: "Hello.", processingTime: 0.2 },
    words: [{ text: "Hello.", source: { startUs: 100, endUs: 900000 }, confidence: 0.8 }],
  };
  const bytes = (value) => Buffer.from(JSON.stringify(value) + "\n");
  const modern = {
    ...line,
    owned: line.source,
    observations: line.words,
    selectedObservationIndexes: [0],
  };
  assert.deepEqual(
    historicalWholeSupportRecords(bytes(modern)),
    comparableSpeechRecords(bytes(line)),
  );
  assert.throws(() =>
    historicalWholeSupportRecords(bytes({ ...modern, owned: { startUs: 1, endUs: 1000000 } })),
  );
  assert.throws(() =>
    historicalWholeSupportRecords(
      bytes({ ...modern, observations: [{ ...line.words[0], text: "changed" }] }),
    ),
  );
  assert.throws(() =>
    historicalWholeSupportRecords(bytes({ ...modern, selectedObservationIndexes: [] })),
  );
  assert.notDeepEqual(
    historicalWholeSupportRecords(
      bytes({ ...modern, result: { ...line.result, text: "Changed." } }),
    ),
    comparableSpeechRecords(bytes(line)),
  );
});
