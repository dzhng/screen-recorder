import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSentence } from "./evaluate.mjs";

const [packet, out] = process.argv.slice(2);
assert(packet?.startsWith("/") && out?.startsWith("/"));
await mkdir(out, { recursive: false });
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const report = await json(join(packet, "report.json"));
const raw = JSON.parse((await readFile(join(packet, "raw.jsonl"), "utf8")).trim());
const root = report.command.argv[report.command.argv.indexOf("--root") + 1];
const human = await json(join(root, "specs/agent-editing/assets/12d-human-marks/human-marks.json"));
const inherited = (
  await json(join(root, "specs/agent-editing/assets/12-speech/transcript.json"))
).slice(111, 124);
const reordered = structuredClone(raw);
[reordered.words[9], reordered.words[10]] = [reordered.words[10], reordered.words[9]];
const orderOutcome = evaluateSentence(reordered, human, inherited);
assert.equal(report.evaluation.inheritedSequence.preserved, true);
assert.equal(orderOutcome.inheritedSequence.preserved, false);
const shifted = structuredClone(raw);
for (const word of shifted.words) {
  word.source.startUs += 48675;
  word.source.endUs += 48675;
}
const coordinateOutcome = evaluateSentence(shifted, human, inherited);
assert.notDeepEqual(coordinateOutcome, report.evaluation);
for (let i = 0; i < report.evaluation.words.length; i++)
  assert.equal(
    coordinateOutcome.words[i].sourceRange.startUs - report.evaluation.words[i].sourceRange.startUs,
    48675,
  );
const outcomes = {
  scope: "Saved-file/scorer corruption controls only; no native operation, model or inference",
  orderOutcome,
  coordinateOutcome,
  children: [],
};
for (const name of ["missing-raw", "altered-raw"]) {
  const copy = join(out, name);
  await cp(packet, copy, { recursive: true });
  if (name === "missing-raw") await rm(join(copy, "raw.jsonl"));
  else await writeFile(join(copy, "raw.jsonl"), JSON.stringify(reordered) + "\n");
  const args = [fileURLToPath(new URL("./verify.mjs", import.meta.url)), copy];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert(result.stderr.includes("raw.jsonl"));
  outcomes.children.push({
    name,
    executable: process.execPath,
    args,
    pid: result.pid,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}
await writeFile(join(out, "outcomes.json"), JSON.stringify(outcomes, null, 2) + "\n");
console.log(
  JSON.stringify({
    orderRejected: true,
    doubleOriginDetected: true,
    rawMissingRejected: true,
    rawAlterationRejected: true,
    allChildrenTerminal: outcomes.children.map(({ pid, status, signal }) => ({
      pid,
      status,
      signal,
    })),
  }),
);
