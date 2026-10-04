// Opt-in: transcribes generated narration through the worker with network denied and compares each
// interval with the pinned FluidAudio CLI. Needs a cache from `node scripts/speech-eval.mjs prepare
// parakeet CACHE`: SCREENREC_SPEECH_CACHE=CACHE node helpers/mac/Tests/speech-lab.mjs
// Synthetic speech proves plumbing only; it says nothing about accuracy on real narration.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  constants,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const cache = process.env.SCREENREC_SPEECH_CACHE;
assert.ok(cache && isAbsolute(cache), "Set SCREENREC_SPEECH_CACHE to a prepared speech-eval cache");
const out =
  process.env.SCREENREC_SPEECH_LAB_EVIDENCE ?? mkdtempSync(join(tmpdir(), "screenrec-speech-lab-"));
assert.ok(isAbsolute(out));
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), [], "Evidence directory must start empty");
const executable =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));
const selectedReference =
  process.env.SCREENREC_SOURCE_AUDIO_TESTS ??
  fileURLToPath(new URL("../.build/debug/ScreenRecorderSourceAudioTests", import.meta.url));
const cli = join(cache, "source", ".build", "release", "fluidaudiocli");
const pinned = JSON.parse(
  readFileSync(
    new URL(
      "../../../specs/done/recording-for-ai/assets/speech/parakeet-synthetic.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const offline = ["/usr/bin/sandbox-exec", "-p", "(version 1)(allow default)(deny network*)"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  assert.equal(result.error, undefined, `${command}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stderr}`);
  return result;
}

function worker(operation, params) {
  const started = performance.now();
  // A ping after the work proves nothing the engine printed reached the response channel.
  const result = run(offline[0], [...offline.slice(1), executable], {
    input:
      JSON.stringify({ id: operation, operation, params }) +
      "\n" +
      JSON.stringify({ id: "ping", operation: "system.ping", params: {} }) +
      "\n",
  });
  const lines = result.stdout.split("\n");
  assert.equal(lines.length, 3, result.stdout);
  assert.equal(lines[2], "");
  assert.deepEqual(JSON.parse(lines[1]), { id: "ping", ok: true, data: { platform: "macos" } });
  const response = JSON.parse(lines[0]);
  assert.equal(response.ok, true, JSON.stringify(response.error));
  return { data: response.data, elapsedSeconds: (performance.now() - started) / 1000 };
}

// Stage exactly the evaluated files, so the worker's directory check sees nothing unpinned.
const directory = join(out, "models", "parakeet-tdt-0.6b-v2");
const files = Object.entries(pinned.modelFiles).map(([path, digest]) => {
  const target = join(directory, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(cache, "parakeet-tdt-0.6b-v2", path), target, constants.COPYFILE_FICLONE);
  return { path, bytes: statSync(target).size, sha256: digest };
});

// Narration: two spoken phrases and a fragment too short for the engine, separated by empty edits.
const phrases = [
  "Open the settings panel and choose the second display.",
  "Then press record and describe the change you made.",
];
const pieces = [];
for (const [index, text] of phrases.entries()) {
  const aiff = join(out, `phrase-${index}.aiff`);
  run("say", ["-o", aiff, text]);
  pieces.push(aiff);
}
const fragment = join(out, "fragment.aiff");
run("say", ["-o", fragment, "Stop."]);
const pcm = pieces.concat(fragment).map((input, index) => {
  const output = join(out, `piece-${index}.wav`);
  const trim = index === pieces.length ? ["-t", "0.2"] : [];
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    input,
    ...trim,
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "pcm_f32le",
    output,
  ]);
  return output;
});
const maker = join(out, "narration-maker");
run("swiftc", [
  "-parse-as-library",
  fileURLToPath(new URL("SpeechLab/narration.swift", import.meta.url)),
  "-o",
  maker,
]);
const narration = join(out, "narration.mov");
const gaps = [2, 1];
run(maker, [narration, pcm[0], `gap:${gaps[0]}`, pcm[1], `gap:${gaps[1]}`, pcm[2]]);

// Expected occupied time, from each piece's own frame count, shifted by a non-zero track start.
const offsetUs = 1_500_000;
const durationUs = (wav) => {
  const probe = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=duration_ts,sample_rate",
    "-of",
    "json",
    wav,
  ]);
  const [stream] = JSON.parse(probe.stdout).streams;
  return Math.round((Number(stream.duration_ts) * 1_000_000) / Number(stream.sample_rate));
};
const expected = [];
let cursor = offsetUs;
for (const [index, wav] of pcm.entries()) {
  const length = durationUs(wav);
  expected.push({ startUs: cursor, endUs: cursor + length });
  cursor += length + (gaps[index] ?? 0) * 1_000_000;
}
const track = {
  source: narration,
  sourceOffsetUs: offsetUs,
  available: [{ startUs: offsetUs, endUs: cursor }],
};

const output = join(out, "raw.jsonl");
const transcription = worker("speech.transcribe", {
  models: { directory, files },
  track,
  output,
});
const { data } = transcription;
const raw = readFileSync(output);
assert.equal(data.output.sha256, sha256(raw));
assert.equal(data.output.bytes, raw.length);
const lines = raw.toString("utf8").trim().split("\n").map(JSON.parse);
assert.equal(lines.length, data.segments.length);

// Segments are exactly the occupied intervals, within a microsecond of container rounding.
assert.equal(data.segments.length, expected.length, JSON.stringify(data.segments));
for (const [index, segment] of data.segments.entries()) {
  assert.ok(
    Math.abs(segment.source.startUs - expected[index].startUs) <= 1,
    JSON.stringify(segment),
  );
  assert.ok(Math.abs(segment.source.endUs - expected[index].endUs) <= 1, JSON.stringify(segment));
}
assert.deepEqual(
  data.segments.map((segment) => [segment.state, segment.reason ?? null]),
  [
    ["transcribed", null],
    ["transcribed", null],
    ["skipped", "too_short"],
  ],
);
const gapSpans = data.segments.slice(1).map((segment, index) => ({
  startUs: data.segments[index].source.endUs,
  endUs: segment.source.startUs,
}));
const words = lines.flatMap((line) =>
  line.words.map((word) => ({ ...word, segment: line.ordinal })),
);
for (const word of words) {
  const segment = data.segments[word.segment].source;
  assert.ok(word.source.startUs >= segment.startUs && word.source.endUs <= segment.endUs);
  for (const gap of gapSpans)
    assert.ok(word.source.endUs <= gap.startUs || word.source.startUs >= gap.endUs);
}
assert.ok(data.segments.slice(0, 2).every((segment) => segment.wordCount > 0));
assert.equal(data.segments[2].wordCount, 0);

// Parity: the same selected interval and conditioning, through the pinned CLI.
const cliSha256 = sha256(readFileSync(cli));
const provenance = JSON.parse(readFileSync(join(cache, "provenance.json"), "utf8"));
assert.equal(cliSha256, provenance.binarySha256, "Pinned CLI changed since preparation");
const encoderFrameSeconds = 0.08;
const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
const parity = [];
for (const line of lines.filter((line) => line.state === "transcribed")) {
  const wav = join(out, `interval-${line.ordinal}.wav`);
  const referencePlan = join(out, `interval-${line.ordinal}-source.json`);
  await writeFile(
    referencePlan,
    JSON.stringify({ output: wav, spans: [line.source], source: track }),
  );
  run(offline[0], [...offline.slice(1), selectedReference], {
    env: { ...process.env, SCREENREC_AUDIO_SELECTED_PLAN: referencePlan },
  });
  const report = join(out, `cli-${line.ordinal}.json`);
  run(offline[0], [
    ...offline.slice(1),
    cli,
    "transcribe",
    wav,
    "--model-version",
    "v2",
    "--model-dir",
    directory,
    "--word-timestamps",
    "--output-json",
    report,
  ]);
  const upstream = JSON.parse(readFileSync(report, "utf8"));
  const pairs = line.words.map((word, index) => [word, upstream.wordTimings[index]]);
  const startDelta = Math.max(
    0,
    ...pairs.map(([a, b]) => Math.abs(a.startSeconds - (b?.startTime ?? Infinity))),
  );
  const endDelta = Math.max(
    0,
    ...pairs.map(([a, b]) => Math.abs(a.endSeconds - (b?.endTime ?? Infinity))),
  );
  const entry = {
    ordinal: line.ordinal,
    source: line.source,
    workerText: line.result.text,
    cliText: upstream.text,
    identicalText: line.result.text === upstream.text,
    identicalWords:
      line.words.length === upstream.wordTimings.length &&
      pairs.every(([a, b]) => a.text === b.word),
    maxStartDeltaSeconds: startDelta,
    maxEndDeltaSeconds: endDelta,
    withinEncoderFrame: startDelta <= encoderFrameSeconds && endDelta <= encoderFrameSeconds,
    script: phrases[line.ordinal],
    matchesScript:
      JSON.stringify(normalize(line.result.text)) ===
      JSON.stringify(normalize(phrases[line.ordinal])),
  };
  parity.push(entry);
  assert.ok(entry.identicalText, JSON.stringify(entry));
  assert.ok(entry.identicalWords, JSON.stringify(entry));
  assert.ok(entry.withinEncoderFrame, JSON.stringify(entry));
}

const evidence = {
  kind: "native speech.transcribe plumbing lab",
  claim:
    "TTS narration proves plumbing only: offline loading, interval mapping and CLI parity, not accuracy",
  network: "sandbox-exec (deny network*) for the worker and the CLI",
  hardware: { arch: process.arch, platform: process.platform },
  runtimeRevision: provenance.revision,
  modelRevision: provenance.modelRevision,
  cliSha256,
  selectedReferenceSha256: sha256(readFileSync(selectedReference)),
  modelFiles: files,
  narration: {
    sourceOffsetUs: offsetUs,
    available: track.available,
    occupied: expected,
    emptyEditsSeconds: gaps,
    sha256: sha256(readFileSync(narration)),
  },
  response: data,
  elapsedSeconds: transcription.elapsedSeconds,
  segments: lines.map((line) => ({
    ordinal: line.ordinal,
    source: line.source,
    state: line.state,
    reason: line.reason ?? null,
    samples: line.samples,
    text: line.result?.text ?? null,
    words: line.words.map((word) => ({ text: word.text, source: word.source })),
  })),
  gapSpans,
  parity,
};
await writeFile(join(out, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(join(out, "evidence.json"));
