import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Catalog } from "../../core/dist/catalog.js";
import { TranscriptStore } from "../../core/dist/transcript.js";
import { SourceTranscriptRead } from "../../core/dist/transcript-read.js";

const evidence = new URL(
  "../../../specs/video-editing-feedback/assets/07-speech-timing/",
  import.meta.url,
);
const cases = JSON.parse(await readFile(new URL("replay-cases.json", evidence), "utf8"));
if (process.argv.includes("--help")) {
  console.log(
    `Usage: node packages/test-harness/speech/timing-replay.mjs --case <name>\nCases: ${Object.keys(cases).sort().join(", ")}\nBuild composition and core first. Replays retained native raw evidence through current admission and one-row source pagination in owned scratch. Performs no inference, media acquisition, edit or accuracy certification.`,
  );
  process.exit(0);
}
const args = process.argv.slice(2);
const selected = args.length === 2 && args[0] === "--case" && cases[args[1]];
assert(selected, "Choose one named --case; see --help");
const body = await readFile(new URL(selected.raw, evidence));
const sha256 = createHash("sha256").update(body).digest("hex");
assert.equal(sha256, selected.sha256, "Retained raw identity changed");
const lines = body.toString("utf8").trim().split("\n").map(JSON.parse);
const home = await mkdtemp(join(tmpdir(), "yap-speech-timing-"));
const catalog = new Catalog(join(home, "catalog.sqlite"));
try {
  // This checkpoint isolates native-evidence admission. Source-byte certification belongs to
  // the retained fixture provenance, not a fabricated imported-media descriptor.
  const records = new TranscriptStore(catalog, home, () => {});
  const identity = {
    owner: { kind: "asset", assetId: sha256 },
    sourceId: sha256,
    generation: "replay",
  };
  const output = await records.reserve(identity);
  await writeFile(output, body);
  const metadata = await records.ingest({
    identity,
    source: {
      kind: "asset",
      streamId: "fixture",
      durationUs: selected.durationUs,
      supportDigest: sha256,
    },
    request: {
      models: { directory: home, files: [] },
      track: {
        source: selected.raw,
        streamId: "fixture",
        sourceOffsetUs: 0,
        available: lines.map((line) => line.source),
      },
      output,
    },
    receipt: {
      output: { file: output, bytes: body.length, sha256 },
      engine: {
        runtime: "FluidAudio",
        runtimeVersion: "0.15.7",
        decoder: "parakeet-tdt-batch",
        encoderPrecision: "int8",
        computeUnits: "cpuAndNeuralEngine",
      },
      segments: lines.map((line) => ({
        ordinal: line.ordinal,
        source: line.source,
        state: line.state,
        wordCount: line.words.length,
      })),
      wordCount: selected.wordCount,
    },
    pins: {
      runtime: "FluidAudio",
      runtimeVersion: "0.15.7",
      runtimeRevision: "41540ea237350afe5117a082b5c28eda642d0612",
      decoder: "parakeet-tdt-batch",
      model: "FluidInference/parakeet-tdt-0.6b-v2-coreml",
      modelRevision: "ee09c569f73759e6d44c9bd16766f477b2b36d39",
      modelDigest: "4fe3f59cc82bab4ee7d06349b9a37c92d4b5758553b2cbb87a54ecc2dee6824a",
    },
    signal: new AbortController().signal,
  });
  const reader = new SourceTranscriptRead(records, metadata);
  const rows = [];
  let cursor;
  do {
    const page = reader.page({ limit: 1, cursor });
    rows.push(...page.rows);
    cursor = page.nextCursor;
  } while (cursor);
  const words = rows.filter((row) => row.type === "word");
  assert.deepEqual(
    words.map((row) => ({ text: row.text, source: row.sourceRange })),
    lines.flatMap((line) => line.words.map(({ text, source }) => ({ text, source }))),
  );
  console.log(
    JSON.stringify({
      case: args[1],
      rawSha256: sha256,
      policy: metadata.engine.policy,
      wordCount: words.length,
      rows,
      verdict:
        "retained operands and every lexical occurrence survived admission and one-row pagination",
    }),
  );
} finally {
  catalog.close();
  await rm(home, { recursive: true, force: true });
}
