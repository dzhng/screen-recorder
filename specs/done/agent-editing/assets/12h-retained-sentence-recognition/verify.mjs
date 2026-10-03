import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { evaluateSentence } from "./evaluate.mjs";

const packet = process.argv[2];
assert(packet?.startsWith("/"), "Pass the absolute preserved packet directory");
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const report = await json(join(packet, "report.json"));
const members = await json(join(packet, "members.json"));
for (const [path, expected] of Object.entries(members)) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(join(packet, path))) hash.update(bytes);
  assert.equal(hash.digest("hex"), expected.sha256, path);
  assert.equal((await stat(join(packet, path))).size, expected.bytes, path);
}
assert.equal(report.speechAttempts, 1);
assert.equal(report.networkRequests, 0);
assert.equal(report.preserved, true);
assert.deepEqual(report.before, report.after);
assert.deepEqual(
  report.children.map(({ operation, code, signal }) => ({ operation, code, signal })),
  [
    { operation: "media.probe", code: 0, signal: null },
    { operation: "speech.transcribe", code: 0, signal: null },
  ],
);
assert.equal(members["producer.mjs"].sha256, report.producer.sha256);
assert.equal(members["evaluate.mjs"].sha256, report.evaluator.sha256);
assert.equal(members["raw.jsonl"].sha256, report.transcription.output.sha256);
assert.equal(members["raw.jsonl"].bytes, report.transcription.output.bytes);
const segment = JSON.parse((await readFile(join(packet, "raw.jsonl"), "utf8")).trim());
assert.deepEqual(report.actualAdmission.source, { startUs: 0, endUs: 7140000 });
assert.equal(segment.samples, 114240);
assert.equal(segment.sampleRate, 16000);
assert.equal(segment.state, "transcribed");
const root = report.command.argv[report.command.argv.indexOf("--root") + 1];
const assets = join(root, "specs/agent-editing/assets");
const human = await json(join(assets, "12d-human-marks/human-marks.json"));
const inherited = (await json(join(assets, "12-speech/transcript.json"))).slice(111, 124);
const evaluation = evaluateSentence(segment, human, inherited);
assert.deepEqual(evaluation, report.evaluation);
assert.deepEqual(evaluation, await json(join(packet, "evaluation.json")));
assert.equal(evaluation.openingUm.recognized, true);
assert.equal(evaluation.openingUm.onsetScored, false);
assert.deepEqual(evaluation.protectedAndMiddlePresence, { paragraph: true, this: true, uh: true });
assert.equal(evaluation.inheritedSequence.preserved, true);
assert.equal(evaluation.controls.meetsTiming, false);
assert.equal(evaluation.meetsScopedCase, false);
assert.equal(evaluation.adoption, false);
console.log(
  JSON.stringify({
    membersVerified: Object.keys(members).length,
    inferenceAttempts: 1,
    nativeChildrenClosed: report.children,
    lexicalRepresentation: true,
    timingAcceptance: false,
    noNewInference: true,
  }),
);
