import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { SpeechModels } from "../../core/dist/speech-models.js";

const { values } = parseArgs({
  options: {
    evidence: { type: "string" },
    out: { type: "string" },
    "model-home": { type: "string" },
    native: { type: "string" },
  },
});
for (const name of ["evidence", "out", "model-home", "native"])
  assert.ok(values[name], `Pass --${name}`);
const evidence = resolve(values.evidence),
  output = resolve(values.out),
  binary = resolve(values.native);
assert.notEqual(evidence, output, "Keep frozen synthesis evidence unchanged");
mkdirSync(output, { recursive: true });
const manifest = JSON.parse(readFileSync(join(evidence, "manifest.json")));
const models = new SpeechModels(resolve(values["model-home"]));
const modelRequest = models.nativeRequest();
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const save = (name, data) =>
  writeFileSync(join(output, name), JSON.stringify(data, null, 2) + "\n");
const normalized = (text) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const report = {
  modelDigest: models.modelDigest,
  nativeSha256: hash(binary),
  normalization:
    "Unicode letters/numbers and internal apostrophes, case folded; punctuation excluded",
  meaning:
    "ASR lexical agreement only. No acceptance of pronunciation, identity, delivery, intelligibility or joins.",
  cases: [],
};
const generated = manifest.runs.filter((run) => run.id.startsWith("same-take-"));
assert.deepEqual(
  generated.map((run) => run.id).sort(),
  ["same-take-phrase", "same-take-word"],
  "Both declared outputs are required",
);
for (const run of generated) {
  const requested = manifest.config.replacements.find((item) => `same-take-${item.id}` === run.id);
  assert.equal(run.text, requested?.text, "Run text differs from frozen request");
}
const cases = [
  ...generated.map((run) => ({
    id: run.id,
    expected: run.text,
    source: join(evidence, run.id + ".wav"),
    sha256: run.rawSha256,
    generated: true,
  })),
  {
    id: "reference",
    expected: manifest.config.reference.text,
    source: join(evidence, "reference.wav"),
    sha256: manifest.runs[0].referenceSha256,
    generated: false,
  },
];
for (const sample of cases) {
  assert.equal(hash(sample.source), sample.sha256, "Frozen audio hash changed");
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "json", sample.source],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(probe.status, 0, probe.stderr);
  const durationUs = Math.round(Number(JSON.parse(probe.stdout).format.duration) * 1e6);
  const raw = join(output, sample.id + ".jsonl");
  const request = {
    id: sample.id,
    operation: "speech.transcribe",
    params: {
      models: modelRequest,
      track: {
        source: sample.source,
        sourceOffsetUs: 0,
        available: [{ startUs: 0, endUs: durationUs }],
      },
      output: raw,
    },
  };
  save(sample.id + "-request.json", request);
  const start = performance.now();
  const result = spawnSync(
    "/usr/bin/sandbox-exec",
    ["-p", "(version 1)(allow default)(deny network*)", binary],
    {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  writeFileSync(join(output, sample.id + ".log"), result.stderr ?? "");
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  save(sample.id + "-response.json", response);
  assert.equal(response.ok, true, JSON.stringify(response));
  const rows = readFileSync(raw, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const recognized = rows
    .flatMap((row) => row.words)
    .map((word) => word.text)
    .join(" ");
  const entry = {
    ...sample,
    durationUs,
    recognized,
    expectedTokens: normalized(sample.expected),
    recognizedTokens: normalized(recognized),
    elapsedSeconds: (performance.now() - start) / 1000,
  };
  entry.agreement = JSON.stringify(entry.expectedTokens) === JSON.stringify(entry.recognizedTokens);
  report.cases.push(entry);
  save("report.json", report);
  console.log(JSON.stringify(entry));
}
report.generatedTextAgrees = report.cases
  .filter((sample) => sample.generated)
  .every((sample) => sample.agreement);
save("report.json", report);

assert.ok(report.generatedTextAgrees, "Generated words disagree with the requested text");
