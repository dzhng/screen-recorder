import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signalSupport } from "./stretch-measurements.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
assert.equal(
  process.argv.length,
  4,
  "verified endpoint evidence directory and fresh output required",
);
const evidenceRoot = resolve(process.argv[2]),
  out = resolve(process.argv[3]);
assert.ok(!existsSync(out), "Choose a fresh directory");
mkdirSync(out, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (command, args) =>
  execFileSync(command, args, { timeout: 60000, maxBuffer: 40 * 1024 * 1024 });
const evidence = JSON.parse(readFileSync(join(evidenceRoot, "evidence.json")));
const executable = join(evidenceRoot, "signalsmith");
assert.equal(hash(readFileSync(executable)), evidence.executableSha256);
const marksPath = join(root, "specs/recording-for-ai/assets/speech/boundaries/marks.json");
assert.equal(
  hash(readFileSync(marksPath)),
  "23e893cae933ca9c9a0947b40cd09c26143c7de845cad57ecfe333e2582e96ad",
);
const marks = JSON.parse(readFileSync(marksPath));
const report = {
  protocol: 1,
  recipeEvidenceSha256: hash(readFileSync(join(evidenceRoot, "evidence.json"))),
  runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  boundaryAuthority:
    "Manual outer phrase-edge marks, ±25ms visual uncertainty; ASR-derived word names. No independent complete word spans or protected neighbor labels.",
  guardUs: 25000,
  sourceClockOriginUs: 48675,
  contextFrames: 12000,
  ffmpeg: run("ffmpeg", ["-version"]).toString().split("\n")[0],
  sources: [],
  selections: [],
  results: [],
  listening: "UNVERIFIED; these are labeled auditions, not protected-word acceptance",
};
function decode(relative, expected, id) {
  const path = join(root, relative);
  assert.equal(hash(readFileSync(path)), expected);
  const bytes = run("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-map",
    "0:a:0",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-f",
    "f32le",
    "pipe:1",
  ]);
  signalSupport(bytes);
  const output = join(out, `${id}-source.f32`);
  writeFileSync(output, bytes);
  report.sources.push({
    id,
    path: relative,
    sha256: expected,
    pcmSha256: hash(bytes),
    frames: bytes.length / 4,
  });
  return bytes;
}
const narration = decode(
  "fixtures/narrated-workbench/narration.mov",
  "2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c",
  "narration",
);
const clean = decode(
  "specs/done/agent-editing/assets/12c-clean-reference/1272-128104-0000.flac",
  "4e25e22555cd16e90edb0a3b49fdcf1fe652b2a1250ab643634db33895c75b41",
  "clean",
);
for (const phrase of [...new Set(marks.boundaries.map((mark) => mark.phrase))].sort(
  (a, b) => a - b,
)) {
  const paired = marks.boundaries.filter(
    (mark) => mark.phrase === phrase && mark.markedOffsetMs !== null,
  );
  const start = paired.find((mark) => mark.side === "start"),
    end = paired.find((mark) => mark.side === "end");
  if (!start || !end) continue;
  const fileUs = (mark) =>
    mark.reportedUs + mark.markedOffsetMs * 1000 - report.sourceClockOriginUs;
  const first = Math.floor((fileUs(start) - report.guardUs) * 0.048),
    last = Math.ceil((fileUs(end) + report.guardUs) * 0.048);
  report.selections.push({
    id: `phrase-${phrase}`,
    source: "narration",
    frames: [first, last],
    markedFileUs: [fileUs(start), fileUs(end)],
    firstWord: start.text,
    lastWord: end.text,
    authority: report.boundaryAuthority,
  });
}
assert.equal(report.selections.length, 7);
report.selections.push({
  id: "clean-whole-utterance",
  source: "clean",
  frames: [0, clean.length / 4],
  firstWord: "MISTER",
  lastWord: "GOSPEL",
  authority: "Whole-file utterance transcript, no word timing; no external neighbor context",
});
function wav(path, bytes) {
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(bytes.length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(192000, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(bytes.length, 40);
  writeFileSync(path, Buffer.concat([header, bytes]));
}
// Freeze selection manifest before any candidate render.
writeFileSync(
  join(out, "selections.json"),
  JSON.stringify(
    { sources: report.sources, selections: report.selections, guardUs: report.guardUs },
    null,
    2,
  ) + "\n",
);
for (const selection of report.selections) {
  const source = selection.source === "narration" ? narration : clean,
    [start, end] = selection.frames;
  assert.ok(start >= 0 && end <= source.length / 4 && end > start);
  const contextStart = Math.max(0, start - 12000),
    contextEnd = Math.min(source.length / 4, end + 12000);
  const selected = source.subarray(start * 4, end * 4),
    before = source.subarray(contextStart * 4, start * 4),
    after = source.subarray(end * 4, contextEnd * 4);
  wav(join(out, `${selection.id}-reference.wav`), Buffer.concat([before, selected, after]));
  const input = join(out, `${selection.id}-input.f32`),
    context = Buffer.concat([before, selected, after]);
  writeFileSync(input, context);
  const poison = Buffer.from(context);
  for (let i = 0; i < before.length; i += 4) poison.writeFloatLE(0.9, i);
  for (let i = before.length + selected.length; i < poison.length; i += 4)
    poison.writeFloatLE(-0.9, i);
  const poisonPath = join(out, `${selection.id}-poison.f32`);
  writeFileSync(poisonPath, poison);
  for (const speed of [0.8, 0.9, 1, 1.25]) {
    const wanted = Math.floor(selected.length / 4 / speed),
      id = `${selection.id}-${speed}`;
    const render = (path, suffix) => {
      const output = join(out, `${id}-${suffix}.f32`);
      const metadata = JSON.parse(
        run(executable, [
          path,
          output,
          String(before.length / 4),
          String((before.length + selected.length) / 4),
          String(wanted),
          "exact",
        ]),
      );
      return { bytes: readFileSync(output), metadata };
    };
    const exact = render(input, "exact"),
      poisoned = render(poisonPath, "poisoned");
    assert.equal(exact.bytes.length, wanted * 4);
    signalSupport(exact.bytes);
    assert.deepEqual(exact.bytes, poisoned.bytes);
    if (speed === 1) assert.deepEqual(exact.bytes, selected);
    const joined = Buffer.concat([before, exact.bytes, after]);
    assert.deepEqual(joined.subarray(0, before.length), before);
    assert.deepEqual(joined.subarray(before.length + exact.bytes.length), after);
    const output = join(out, `${id}-context.wav`);
    wav(output, joined);
    report.results.push({
      id: selection.id,
      speed,
      sourceFrames: selection.frames,
      selectedSha256: hash(selected),
      outputFrames: wanted,
      outputSha256: hash(exact.bytes),
      contextSha256: hash(joined),
      wavSha256: hash(readFileSync(output)),
      file: output,
      joins: [before.length / 4, before.length / 4 + wanted],
      prefixFrames: before.length / 4,
      suffixFrames: after.length / 4,
      sourcePoisonIdentical: true,
      untouchedNeighborsIdentical: true,
      metadata: exact.metadata,
    });
  }
}
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    out,
    selections: report.selections.length,
    renders: report.results.length,
    listening: report.listening,
  }),
);
