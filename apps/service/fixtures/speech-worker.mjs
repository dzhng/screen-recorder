#!/usr/bin/env node
// A native worker that answers source evidence and speech.transcribe the way the real one does: it
// reports acquired narration, then writes one raw line per interval whose words carry source ranges.
// It is a checked-in executable because macOS assesses every newly written executable on first run,
// which stalls unrelated worker tests running beside a test that writes its own.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parakeetModel } from "@screenrec/core/speech-models";

const narration = [
  { startUs: 0, endUs: 3_000_000 },
  { startUs: 4_000_000, endUs: 6_000_000 },
];
const spoken = [
  { text: "Open", startUs: 200_000, endUs: 500_000 },
  { text: "the", startUs: 500_000, endUs: 700_000 },
  { text: "Settings", startUs: 800_000, endUs: 1_400_000 },
  { text: "panel.", startUs: 1_500_000, endUs: 2_000_000 },
  { text: "Um,", startUs: 4_100_000, endUs: 4_300_000 },
  { text: "press", startUs: 4_500_000, endUs: 5_000_000 },
  { text: "record", startUs: 5_100_000, endUs: 5_800_000 },
];

function answer(data) {
  process.stdout.write(JSON.stringify({ ok: true, data }) + "\n");
}

function sourceEvidence({ directory, output }) {
  const [header] = readFileSync(`${directory}/capture.journal.jsonl`, "utf8").split("\n");
  const { sessionID, microphone } = JSON.parse(header).data;
  const acquired = microphone ? narration : [];
  const text = acquired
    .map((data) => JSON.stringify({ event: "audioAcquired", data: { role: "narration", ...data } }))
    .map((line) => `${line}\n`)
    .join("");
  writeFileSync(output, text);
  answer({
    file: output,
    journal: "capture.journal.jsonl",
    header: { sessionID, microphone, systemAudio: false },
    cursorSamples: 0,
    geometryRecords: 0,
    displaySpaces: 0,
    pauseEvents: 0,
    audioIntervals: acquired.length,
    lastSequence: acquired.length,
    incompleteTail: false,
    finished: true,
    bytes: Buffer.byteLength(text),
  });
}

function transcribe(params) {
  appendFileSync(process.env.SCREENREC_FIXTURE_LOG, JSON.stringify(params) + "\n");
  const segments = [];
  const text = params.track.available
    .map((source, ordinal) => {
      const words = spoken
        .filter((word) => word.startUs >= source.startUs && word.endUs <= source.endUs)
        .map(({ text, ...range }) => ({
          text,
          startSeconds: (range.startUs - source.startUs) / 1e6,
          endSeconds: (range.endUs - source.startUs) / 1e6,
          confidence: 0.9,
          source: range,
        }));
      segments.push({ ordinal, source, state: "transcribed", wordCount: words.length });
      return `${JSON.stringify({ ordinal, source, state: "transcribed", words })}\n`;
    })
    .join("");
  writeFileSync(params.output, text);
  answer({
    output: {
      file: params.output,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    },
    engine: {
      runtime: parakeetModel.engine.runtime,
      runtimeVersion: parakeetModel.engine.runtimeVersion,
      decoder: parakeetModel.engine.decoder,
      encoderPrecision: "int8",
      computeUnits: "cpuAndNeuralEngine",
    },
    segments,
    wordCount: segments.reduce((total, segment) => total + segment.wordCount, 0),
    details: { peakResidentBytes: 1 },
  });
}

let input = "";
process.stdin.on("data", (bytes) => (input += bytes));
process.stdin.on("end", () => {
  const { operation, params } = JSON.parse(input);
  if (operation === "media.sourceEvidence") return sourceEvidence(params);
  if (operation === "speech.transcribe") return transcribe(params);
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: { code: "UNSUPPORTED_FIXTURE", message: operation, retryable: false, details: {} },
    }) + "\n",
  );
});
