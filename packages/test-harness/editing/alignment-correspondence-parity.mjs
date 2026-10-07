import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { foldWord } from "../../core/src/word-kind.ts";

const [binary, reference] = process.argv.slice(2);
if (!binary || !reference || process.argv.length !== 4) {
  console.error("Usage: bun alignment-correspondence-parity.mjs <yap-native> <frozen09-reference>");
  process.exit(2);
}
const rows = [];
for (const name of readdirSync(join(reference, "nemo-ctc110-correspondence")).sort()) {
  if (!/\.json(?:\.gz)?$/.test(name) || name.startsWith("protocol")) continue;
  const bytes = readFileSync(join(reference, "nemo-ctc110-correspondence", name));
  const evidence = JSON.parse((name.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString());
  if (!evidence.candidates) continue;
  for (const [candidate, expected] of evidence.candidates.entries()) {
    rows.push({
      case: evidence.id,
      candidate,
      expected,
      request: {
        id: `${evidence.id}-${candidate}`,
        operation: "speech.correspond",
        params: {
          supplied: expected.requested.map((word) => foldWord(word.text)),
          observed: expected.observed.map((word) => foldWord(word.text)),
        },
      },
    });
  }
}
assert.ok(rows.length, "No frozen correspondence operands");
const processResult = spawnSync(resolve(binary), [], {
  input: rows.map((row) => JSON.stringify(row.request)).join("\n") + "\n",
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
  timeout: 10_000,
});
assert.equal(processResult.status, 0, processResult.stderr);
const responses = processResult.stdout
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
assert.equal(responses.length, rows.length);
for (const [index, row] of rows.entries()) {
  const response = responses[index];
  assert.equal(response.id, row.request.id);
  assert.equal(response.ok, true, JSON.stringify(response.error));
  assert.deepEqual(
    response.data,
    {
      optimum: row.expected.optimum,
      left: row.expected.requested.map((word) => ({
        indices: word.observedIndices,
        omissionPossible: word.omissionPossible,
      })),
      right: row.expected.observed.map((word) => ({
        indices: word.suppliedIndices,
        omissionPossible: word.extraPossible,
      })),
    },
    `${row.case} supplied candidate ${row.candidate}`,
  );
}
console.log(
  JSON.stringify({ ok: true, cases: rows.map(({ case: id, candidate }) => ({ id, candidate })) }),
);
