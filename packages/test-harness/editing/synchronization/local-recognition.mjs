import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { lexicalCandidates } from "./lexical.mjs";
import { preparedParakeet, recognize } from "./recognition.mjs";

const usage =
  "node local-recognition.mjs --local <local-operands-dir> --out <fresh-dir> (--native <frozen-worker> --models <Parakeet-ready.json> | --capture <retained-recognition-dir>)\nBounded local recognition or inference-free captured replay; neither mode declares a global clock or an edit.";
const { values } = parseArgs({
  options: {
    ...Object.fromEntries(
      ["local", "out", "native", "models", "capture"].map((name) => [name, { type: "string" }]),
    ),
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(usage);
  process.exit(0);
}
for (const name of ["local", "out"]) assert(values[name], "Pass --" + name);
assert(
  values.capture ? !values.native && !values.models : values.native && values.models,
  "Pass --capture for inference-free replay or --native and --models for recognition",
);
const protocolBytes = readFileSync(
  new URL(
    "../../../../specs/video-editing-feedback/assets/20-synchronization/bridge/local-protocol.json",
    import.meta.url,
  ),
);
const policy = JSON.parse(protocolBytes);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const localBytes = readFileSync(join(values.local, "local.json"));
const local = JSON.parse(localBytes);
assert.equal(local.protocolSha256, hash(protocolBytes));
const selected = local.windows.filter((row) => row.acoustic.state === "local-acoustic-candidate");
assert(selected.length * 2 <= policy.budget.maximumRecognitionCalls);
for (const row of selected)
  for (const side of ["raw", "reference"])
    assert.equal(hash(readFileSync(join(values.local, row[side].path))), row[side].sha256);
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), []);
const prior = values.capture && JSON.parse(readFileSync(join(values.capture, "recognition.json")));
if (prior) {
  const bundle = JSON.parse(
    readFileSync(
      new URL(
        "../../../../specs/video-editing-feedback/assets/20-synchronization/bridge/bundle.json",
        import.meta.url,
      ),
    ),
  );
  assert.equal(
    hash(readFileSync(join(values.capture, "recognition.json"))),
    bundle.files.find((row) => row.owner === "assets" && row.path === "recognition.json").sha256,
    "Capture report differs from the frozen bridge identity",
  );
  assert.equal(prior.localSha256, hash(localBytes));
  assert.equal(prior.protocolSha256, hash(protocolBytes));
}
const models = prior?.models ?? preparedParakeet(values.models);
const report = {
  protocolSha256: hash(protocolBytes),
  localSha256: hash(localBytes),
  nativeSha256: prior?.nativeSha256 ?? hash(readFileSync(values.native)),
  models,
  windows: [],
  globals: [],
  scope:
    "independently recognized local sampled bridge evidence only; no global/raw-to-raw clock or edit declaration",
};
const save = () =>
  writeFileSync(join(out, "recognition.json"), JSON.stringify(report, null, 2) + "\n");
save();
for (const row of selected) {
  const operands = [];
  const observations = [];
  const errors = [];
  for (const side of ["raw", "reference"]) {
    const name = row.name + "-" + side;
    try {
      let raw;
      if (prior) {
        const observation = prior.windows
          .find((entry) => entry.name === row.name)
          ?.observations.find((entry) => entry.side === side);
        assert(observation, "Captured local observation missing");
        raw = readFileSync(join(values.capture, observation.path));
        assert.equal(hash(raw), observation.sha256, "Captured recognition changed");
        assert.equal(raw.length, observation.bytes);
        writeFileSync(join(out, name + ".jsonl"), raw);
      } else {
        raw = recognize({
          native: values.native,
          models,
          source: join(values.local, row[side].path),
          durationUs: 4000000,
          name,
          out,
          secondsPerCall: policy.budget.secondsPerRecognition,
        });
      }
      const records = raw.toString().trim().split("\n").map(JSON.parse);
      const words = records.flatMap((record) => record.words);
      assert(words.length <= policy.budget.maximumWordsPerOperand);
      assert(words.every((word) => typeof word.text === "string"));
      operands.push({
        name,
        originUs: side === "raw" ? row.sourceOriginUs : row.referenceOriginUs,
        words,
      });
      observations.push({ side, path: name + ".jsonl", bytes: raw.length, sha256: hash(raw) });
      console.log(name + ": " + words.map((word) => word.text).join(" "));
    } catch (error) {
      errors.push({ side, message: error.message });
    }
  }
  const candidates = errors.length
    ? { unique: [], ambiguous: [] }
    : lexicalCandidates([operands[0]], [operands[1]]);
  report.windows.push({
    name: row.name,
    source: row.source,
    sourceOriginUs: row.sourceOriginUs,
    referenceOriginUs: row.referenceOriginUs,
    referenceMinusSourceSamples16k: row.referenceMinusSourceSamples16k,
    observations,
    errors,
    ...candidates,
    state:
      candidates.unique.length && !errors.length
        ? "admitted-local-sampled-bridge"
        : "refused-lexical-prerequisite",
  });
  save();
}
for (const source of new Set(local.windows.map((row) => row.source))) {
  const admitted = report.windows.filter(
    (row) => row.source === source && row.state === "admitted-local-sampled-bridge",
  );
  const spread =
    admitted.length === 3
      ? Math.max(...admitted.map((row) => row.referenceMinusSourceSamples16k)) -
        Math.min(...admitted.map((row) => row.referenceMinusSourceSamples16k))
      : null;
  report.globals.push({
    source,
    admittedCheckpoints: admitted.length,
    spreadSamples16k: spread,
    state:
      spread !== null && spread <= 32
        ? "sampled-hypothesis-only-parent-refusals-remain"
        : "refused-global-clock",
  });
}
if (prior) assert.deepEqual(report, prior, "Replay must preserve every frozen local observation");
save();
console.log(
  JSON.stringify({
    out,
    states: report.windows.map(({ name, state }) => ({ name, state })),
    globals: report.globals,
  }),
);
