import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { assertMatchedInputs } from "./encoded-appearance-inputs.mjs";
const input = new URL(
  "../../../specs/done/agent-editing/assets/15-pointer-chain/input/",
  import.meta.url,
);
const records = async (name) =>
  (await readFile(new URL(name, input), "utf8")).trim().split("\n").map(JSON.parse);
const full = {
  frames: await records("full.frames.jsonl"),
  pointers: await records("full.pointers.jsonl"),
};
const range = {
  frames: await records("range.frames.jsonl"),
  pointers: await records("range.pointers.jsonl"),
};
test("frozen range preserves the matching full visual and pointer program", () =>
  assertMatchedInputs(full, range));
for (const [name, mutate] of Object.entries({
  missing: (value) => value.pointers.shift(),
  extra: (value) => value.pointers.push(value.pointers[0]),
  changed: (value) => (value.pointers[0].overlay = { trail: [], trailUs: 600000 }),
}))
  test(`rejects ${name} range pointer input`, () => {
    const changed = structuredClone(range);
    mutate(changed);
    assert.throws(() => assertMatchedInputs(full, changed), /Range pointer preparation/);
  });
