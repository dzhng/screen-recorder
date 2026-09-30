import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hash, root } from "./source-evidence-fixture.mjs";

// A frozen first segment supplies known words; synthetic PCM only supplies real admitted support.
// This is a query fixture, not a claim that a recognizer transcribed the synthetic audio.
export async function transcriptDurationFixture(out, source) {
  const frozen = join(root, "specs/agent-editing/assets/10b-native-selection/selected");
  const raw = await readFile(join(frozen, "first-physical-selected.jsonl"));
  const receipt = await readFile(join(frozen, "first-physical-selected-response.json"));
  const original = JSON.parse(receipt).data;
  assert.equal(hash(raw), original.output.sha256);
  const selected = Buffer.from(raw.toString("utf8").split("\n")[0] + "\n");
  const segment = JSON.parse(selected);
  assert.deepEqual(segment.source, { startUs: 0, endUs: 6000000 });
  assert.equal(segment.words.length, original.segments[0].wordCount);
  const rawFile = join(out, "frozen-segment.jsonl"),
    receiptFile = join(out, "frozen-receipt.json");
  await writeFile(rawFile, selected);
  const selectedReceipt = Buffer.from(
    JSON.stringify({
      data: {
        ...original,
        output: { file: rawFile, bytes: selected.length, sha256: hash(selected) },
        segments: [original.segments[0]],
        wordCount: segment.words.length,
      },
    }),
  );
  await writeFile(receiptFile, selectedReceipt);
  const prior = JSON.parse(
    await readFile(
      join(root, "specs/agent-editing/assets/10c-public-phrases/project.json"),
      "utf8",
    ),
  );
  const engine = prior.transcript.dependencies[0].transcript.engine;
  const definition = {
    sha256: hash(await readFile(source)),
    streamId: "track:1",
    sourceOffsetUs: 0,
    available: [{ startUs: 0, endUs: 6000000 }],
    rawFile,
    rawSha256: hash(selected),
    receiptFile,
    receiptSha256: hash(selectedReceipt),
  };
  return {
    words: segment.words.slice(0, 5),
    engine,
    evidence: {
      originalRawSha256: hash(raw),
      originalReceiptSha256: hash(receipt),
      selectedRawSha256: hash(selected),
      selectedReceiptSha256: hash(selectedReceipt),
      engine,
      boundary:
        "Declared model readiness and frozen inference; fresh native asset admission, transcript ingestion and public queries",
    },
    configure: async (trial, index) => {
      const file = join(out, `transcript-fixture-${index}.json`);
      trial.nativeOperationsFile = join(out, `native-operations-${index}.jsonl`);
      await writeFile(
        file,
        JSON.stringify(
          {
            sources: [definition],
            engine,
            allowedOperations: ["media.probe", "speech.transcribe", "storage.clearRenderWorkspace"],
            operationsFile: trial.nativeOperationsFile,
            observationsFile: join(out, `frozen-calls-${index}.json`),
          },
          null,
          2,
        ),
      );
      return file;
    },
  };
}
