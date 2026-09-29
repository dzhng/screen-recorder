import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { validateComposition } from "../../composition/dist/index.js";

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    out: { type: "string" },
    expected: { type: "string" },
  },
});
assert(values.input && values.out);
const out = resolve(values.out);
await mkdir(out);
const bytes = await readFile(resolve(values.input));
const input = JSON.parse(bytes);
const started = performance.now();
const model = validateComposition(input.document, input.assets, input.acquisitions);
const elapsedMs = performance.now() - started;
// Streams are shared objects already retained in assets. Serialize their identity at
// each occurrence instead of duplicating the entire source metadata per clip.
const output = JSON.stringify(
  {
    ...model,
    clips: model.clips.map(({ stream, ...clip }) => ({ ...clip, stream: stream?.id ?? null })),
  },
  (_, value) => (typeof value === "bigint" ? String(value) : value),
);
const digest = (value) => createHash("sha256").update(value).digest("hex");
await writeFile(join(out, "resolved.json"), output);
const report = {
  inputSha256: digest(bytes),
  outputSha256: digest(output),
  outputBytes: Buffer.byteLength(output),
  clips: model.clips.length,
  intervals: model.clips.reduce((sum, clip) => sum + clip.available.length, 0),
  elapsedMs,
  maxRSSKiB: process.resourceUsage().maxRSS,
  scope: "Pure composition validation; no public edit or package acceptance",
  passed: false,
};
if (values.expected) assert.equal(report.outputSha256, values.expected);
report.passed = true;
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
