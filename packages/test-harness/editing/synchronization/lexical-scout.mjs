import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { lexicalCandidates } from "./lexical.mjs";
import { preparedParakeet, recognize } from "./recognition.mjs";

const usage =
  "node lexical-scout.mjs --fixtures <retained-WAV-dir> --out <fresh-dir> (--native <frozen-worker> --models <Parakeet-ready.json> | --capture <existing-scout-dir>)\nRecognition runs at most nine bounded20s calls. Replay reads captured observations without inference. Neither mode estimates or declares synchronization.";
const { values } = parseArgs({
  options: {
    fixtures: { type: "string" },
    out: { type: "string" },
    native: { type: "string" },
    models: { type: "string" },
    capture: { type: "string" },
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(usage);
  process.exit(0);
}
assert(values.fixtures && values.out, usage);
assert(values.capture ? !values.native && !values.models : values.native && values.models, usage);
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), [], "Use a fresh output directory");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + "\n");
const protocolBytes = readFileSync(
  new URL(
    "../../../../specs/video-editing-feedback/assets/20-synchronization/lexical/protocol.json",
    import.meta.url,
  ),
);
const protocol = JSON.parse(protocolBytes);
const manifestBytes = readFileSync(join(values.fixtures, "manifest.json"));
const expectedManifest = readFileSync(
  new URL(
    "../../../../fixtures/video-editing-feedback/synchronization/manifest.json",
    import.meta.url,
  ),
);
assert.equal(
  hash(manifestBytes),
  hash(expectedManifest),
  "Use the complete frozen synchronization input manifest",
);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.cases.length, protocol.budget.maximumRecognitionCalls);
for (const entry of manifest.cases) {
  const bytes = readFileSync(join(values.fixtures, entry.path));
  assert.equal(bytes.length, entry.bytes, "Complete WAV bytes required before work");
  assert.equal(hash(bytes), entry.sha256, "Frozen WAV identity changed");
}
const observations = [];
const identities = [];
const prior = values.capture && JSON.parse(readFileSync(join(values.capture, "report.json")));
if (prior) {
  const banked = JSON.parse(
    readFileSync(
      new URL(
        "../../../../specs/video-editing-feedback/assets/20-synchronization/lexical/bundle.json",
        import.meta.url,
      ),
    ),
  );
  assert.equal(
    hash(readFileSync(join(values.capture, "report.json"))),
    banked.files.find((row) => row.path === "report.json").sha256,
    "Capture report differs from the frozen research identity",
  );
  assert.equal(prior.protocolSha256, hash(protocolBytes));
  assert.equal(prior.manifestSha256, hash(manifestBytes));
}
const models = !prior && preparedParakeet(values.models);
const frozen = {
  protocolSha256: hash(protocolBytes),
  manifestSha256: hash(manifestBytes),
  nativeSha256: prior?.nativeSha256 ?? hash(readFileSync(values.native)),
  models: prior?.models ?? models,
};
save("frozen.json", frozen);
for (const entry of manifest.cases) {
  const filename = entry.name + ".jsonl";
  let raw;
  if (prior) {
    const identity = prior.observations.find((row) => row.name === entry.name);
    assert(identity, "Captured window missing");
    raw = readFileSync(join(values.capture, filename));
    assert.equal(hash(raw), identity.sha256, "Captured recognition changed");
  } else {
    raw = recognize({
      native: values.native,
      models,
      source: resolve(values.fixtures, entry.path),
      durationUs: 20000000,
      name: entry.name,
      out,
      secondsPerCall: protocol.budget.secondsPerCall,
    });
  }
  const records = raw.toString().trim().split("\n").map(JSON.parse);
  const words = records.flatMap((record) => record.words);
  assert(
    words.length <= protocol.budget.maximumWordsPerWindow,
    "Recognition exceeds frozen word budget",
  );
  assert(
    words.every((word) => typeof word.text === "string"),
    "Raw recognition needs literal word observations",
  );
  observations.push({
    name: entry.name,
    source: entry.source,
    originUs: entry.range.startUs,
    words,
  });
  identities.push({ name: entry.name, sha256: hash(raw), bytes: raw.length });
  if (prior) writeFileSync(join(out, filename), raw);
  console.log(entry.name + ": " + words.map((word) => word.text).join(" "));
}
const pairs = [];
const sources = Object.keys(manifest.sources);
for (let a = 0; a < sources.length; a++)
  for (let b = a + 1; b < sources.length; b++) {
    const candidates = lexicalCandidates(
      observations.filter((row) => row.source === sources[a]),
      observations.filter((row) => row.source === sources[b]),
      protocol.lexicalGate.minimumContiguousWords,
      protocol.lexicalGate.minimumDistinctWords,
    );
    const coverage = (side) =>
      [...new Set(candidates.unique.map((row) => row[side].originUs))].sort((a, b) => a - b);
    const covered = { left: coverage("left"), right: coverage("right") };
    const lexicalAvailable = [covered.left, covered.right].every((origins) =>
      protocol.lexicalGate.checkpointsUs.every((origin) => origins.includes(origin)),
    );
    pairs.push({
      sources: [sources[a], sources[b]],
      ...candidates,
      covered,
      lexicalAvailable,
      synchronization: "not-established",
      refusal: lexicalAvailable
        ? "timing-controls-and-independent-alignment-required"
        : "insufficient-unambiguous-shared-checkpoints",
    });
  }
const report = {
  ...frozen,
  observations: identities,
  pairs,
  verdict: "no-synchronization-promotion",
  timingInferenceCalls: 0,
};
if (prior)
  assert.deepEqual(
    report,
    prior,
    "Replay must preserve every frozen numerical and lexical operand",
  );
save("report.json", report);
console.log(
  JSON.stringify({
    out,
    verdict: report.verdict,
    pairs: pairs.map(({ sources, lexicalAvailable, refusal }) => ({
      sources,
      lexicalAvailable,
      refusal,
    })),
  }),
);
