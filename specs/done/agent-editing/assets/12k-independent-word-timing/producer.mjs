import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = new URL("../../../../", import.meta.url).pathname;
const { evaluate, evaluateLexical, alignWords } = await import(
  pathToFileURL(join(repo, "packages/test-harness/speech/evaluate.mjs"))
);
const corpus =
  "/Users/david/.codex/artifacts/screen-recorder/speech-corpora/l2-arctic-public-example";
const out =
  "/Users/david/.codex/artifacts/screen-recorder/speech-corpora/l2-arctic-word-timing-12k";
await mkdir(out, { recursive: false });
const modelHome = "/Users/david/.cache/screen-recorder/verification/parakeet-23n-db6b985b";
const modelRequest = join(modelHome, "evidence/readiness-final/native-request.json");
const models = JSON.parse(await readFile(modelRequest, "utf8"));
const baseline = JSON.parse(
  await readFile(join(repo, "specs/agent-editing/assets/12-speech/manifest.json"), "utf8"),
);
assert.deepEqual(models.files, baseline.models.files);
const engine = baseline.calls[0].response.data.engine;
const worker = "/tmp/screenrec-09c-native-presented-worker";
const source = join(corpus, "lxc_arctic_a0018.wav");
const qualification = JSON.parse(await readFile(join(corpus, "qualification.json"), "utf8"));
const frozen = JSON.parse(await readFile(join(corpus, "frozen.json"), "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const save = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + "\n");
async function pin(path) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return { path, bytes: (await stat(path)).size, sha256: hash.digest("hex") };
}
const protectedPaths = [
  worker,
  source,
  join(corpus, "lxc_arctic_a0018.TextGrid"),
  join(corpus, "qualification.json"),
  join(corpus, "frozen.json"),
  modelRequest,
  join(dirname(models.directory), "receipt.json"),
  join(repo, "packages/test-harness/speech/evaluate.mjs"),
  join(repo, "packages/core/src/model-registry.ts"),
  join(repo, "helpers/mac/Sources/ScreenRecorderSpeech/SourceTranscript.swift"),
  join(repo, "helpers/mac/Sources/ScreenRecorderSpeech/ParakeetEngine.swift"),
  join(repo, "helpers/mac/Sources/ScreenRecorderSpeech/WordTimingMerger.swift"),
];
async function snapshot() {
  const pins = [];
  for (const path of protectedPaths) pins.push(await pin(path));
  for (const file of models.files) {
    const actual = await pin(join(models.directory, file.path));
    assert.equal(actual.bytes, file.bytes);
    assert.equal(actual.sha256, file.sha256);
    pins.push(actual);
  }
  return pins;
}
const report = {
  scope:
    "One fixed independent manual word-timing characterization; no broad quality/performance/model-exclusion verdict",
  producer: await pin(fileURLToPath(import.meta.url)),
  node: { version: process.version, pin: await pin(process.execPath) },
  command: { executable: process.execPath, argv: process.argv, cwd: process.cwd() },
  models,
  engine,
  exchanges: [],
  attempts: 0,
  bounds: {
    requestSeconds: 60,
    outerSeconds: 360,
    drainSeconds: 15,
    stdioBytes: 8388608,
    retry: false,
  },
};
report.before = await snapshot();
assert.equal(
  report.before[0].sha256,
  "0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928",
);
for (const item of frozen.files) {
  const actual = await pin(item.path);
  assert.equal(actual.bytes, item.bytes);
  assert.equal(actual.sha256, item.sha256);
}
// Private noncommercial reference never enters the banked report or product repository.
const dataset = {
  fillerTerms: ["um", "uh"],
  clips: [
    {
      id: "lxc-arctic-a0018",
      origin: "human",
      kind: "held-out",
      audioPath: source,
      audioSha256: report.before[1].sha256,
      duration: qualification.audio.durationSeconds,
      words: qualification.lexicalWords.map((word) => ({
        text: word.label,
        start: Number(word.startSeconds),
        end: Number(word.endSeconds),
      })),
    },
  ],
};
await save("reference.json", dataset);
await save("frozen-input.json", {
  selection: frozen,
  source: report.before,
  producer: report.producer,
  timing:
    "Production spoken word.source ranges; original human word tier intervals; no source-offset fitting",
  kindMeaning: "held-out from this local run/tuning, not verified model-training exclusion",
});
await save("report.json", report);
const profile =
  '(version 1)(allow default)(deny network*)(deny file-write* (subpath "/Users/david/.cache/screen-recorder/verification"))';
const child = spawn("/usr/bin/sandbox-exec", ["-p", profile, worker], {
  stdio: ["pipe", "pipe", "pipe"],
});
report.pid = child.pid;
report.startedAt = new Date().toISOString();
report.nativeArgv = ["/usr/bin/sandbox-exec", "-p", profile, worker];
console.log(JSON.stringify({ event: "native-started", pid: child.pid }));
let stdout = "",
  stderr = "",
  pending,
  failure;
const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => {
  stdout += line + "\n";
  try {
    assert(Buffer.byteLength(stdout) <= report.bounds.stdioBytes, "stdout bound");
    const value = JSON.parse(line);
    assert(pending, "Unexpected reply");
    const resolve = pending;
    pending = null;
    resolve(value);
  } catch (error) {
    failure = String(error);
    child.kill("SIGKILL");
  }
});
child.stderr.on("data", (bytes) => {
  stderr += bytes.toString();
  if (Buffer.byteLength(stderr) > report.bounds.stdioBytes) {
    failure = "stderr bound";
    child.kill("SIGKILL");
  }
});
const terminal = new Promise((resolve) =>
  child.on("close", (code, signal) => {
    report.terminal = { pid: child.pid, code, signal, closedAt: new Date().toISOString() };
    if (pending) {
      const settle = pending;
      pending = null;
      settle(null);
    }
    resolve();
  }),
);
child.on("error", (error) => {
  failure = String(error);
});
child.stdin.on("error", (error) => {
  failure = String(error);
});
const outer = setTimeout(() => {
  failure = "Outer360s bound";
  child.kill("SIGKILL");
}, 360000);
async function call(operation, params) {
  assert(["media.probe", "speech.transcribe"].includes(operation));
  assert(!pending);
  if (operation === "speech.transcribe")
    assert.equal(report.attempts++, 0, "Only one recognition allowed");
  const request = { id: operation, operation, params };
  report.exchanges.push({ request });
  await save("report.json", report);
  const promise = new Promise((resolve) => {
    pending = resolve;
  });
  const timer = setTimeout(() => {
    failure = "Request60s bound " + operation;
    child.kill("SIGKILL");
  }, 60000);
  child.stdin.write(JSON.stringify(request) + "\n");
  const reply = await promise;
  clearTimeout(timer);
  report.exchanges.at(-1).reply = reply;
  assert(!failure, failure);
  assert(reply?.ok && reply.id === operation, JSON.stringify(reply));
  return reply.data;
}
try {
  const probe = await call("media.probe", { path: source });
  assert.equal(probe.originUs, 0);
  assert.equal(probe.streams.length, 1);
  const stream = probe.streams[0];
  assert.equal(stream.kind, "audio");
  assert.equal(stream.sampleRate, 44100);
  assert.equal(stream.channels, 1);
  assert.equal(stream.startUs, 0);
  const exactEnd =
    typeof stream.endUs === "number" ? { numerator: stream.endUs, denominator: 1 } : stream.endUs;
  assert.equal(
    BigInt(exactEnd.numerator) * 44100n,
    71508n * 1000000n * BigInt(exactEnd.denominator),
  );
  assert.deepEqual(stream.segments, [
    {
      startUs: 0,
      endUs: stream.endUs,
      empty: false,
      mediaStartUs: 0,
      mediaDurationUs: stream.endUs,
    },
  ]);
  const response = await call("speech.transcribe", {
    models,
    track: {
      source,
      streamId: stream.id,
      sourceOffsetUs: 0,
      available: [{ startUs: 0, endUs: stream.endUs }],
    },
    output: join(out, "recognition.raw.jsonl"),
  });
  assert.deepEqual(response.engine, engine);
  const raw = await readFile(join(out, "recognition.raw.jsonl"));
  assert.equal(raw.length, response.output.bytes);
  assert.equal(sha(raw), response.output.sha256);
  const segments = raw.toString().trim().split("\n").map(JSON.parse);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].state, "transcribed");
  const prediction = segments[0].words.map((word) => ({
    text: word.text,
    start: word.source.startUs / 1000000,
    end: word.source.endUs / 1000000,
  }));
  const run = {
    clipId: dataset.clips[0].id,
    audioSha256: dataset.clips[0].audioSha256,
    engine: "parakeet",
    modelRevision: "ee09c569f73759e6d44c9bd16766f477b2b36d39",
    runtimeRevision: engine.runtimeVersion,
    binarySha256: report.before[0].sha256,
    network: "sandbox-deny-network",
    words: prediction,
  };
  await save("normalized-run.json", run);
  report.evaluation = evaluate(dataset, [run]);
  report.lexical = evaluateLexical(dataset.clips[0].words, prediction);
  const matches = alignWords(
    dataset.clips[0].words,
    prediction,
    (a, b) => Math.abs(a.start - b.start) + Math.abs(a.end - b.end),
  );
  const distances = matches.flatMap(([i, j]) => [
    Math.abs(dataset.clips[0].words[i].start - prediction[j].start),
    Math.abs(dataset.clips[0].words[i].end - prediction[j].end),
  ]);
  assert.equal(distances.length, report.evaluation.boundaries.samples);
  report.boundaryMaxSeconds = distances.length ? Math.max(...distances) : null;
  report.raw = { bytes: raw.length, sha256: sha(raw) };
  report.completed = true;
} catch (error) {
  report.error = String(error);
} finally {
  child.stdin.end();
  const drain = setTimeout(() => child.kill("SIGKILL"), 15000);
  await terminal;
  clearTimeout(drain);
  clearTimeout(outer);
  lines.close();
  report.failure = failure ?? null;
  try {
    report.after = await snapshot();
    assert.deepEqual(report.after, report.before);
    report.protectedInputsUnchanged = true;
  } catch (error) {
    report.preservationError = String(error);
  }
  await writeFile(join(out, "native.stdout"), stdout);
  await writeFile(join(out, "native.stderr"), stderr);
  await save("report.json", report);
  console.log(
    JSON.stringify({
      event: "native-closed",
      terminal: report.terminal,
      completed: report.completed ?? false,
      evaluation: report.evaluation?.status,
      error: report.error ?? failure ?? report.preservationError ?? null,
    }),
  );
}
process.exitCode =
  report.completed &&
  !report.error &&
  !failure &&
  !report.preservationError &&
  report.terminal.code === 0
    ? 0
    : 1;
