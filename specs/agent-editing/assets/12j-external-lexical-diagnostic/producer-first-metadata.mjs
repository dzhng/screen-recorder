import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import {
  evaluateLexical,
  normalizeWord,
} from "/Users/david/dev/screen-recorder/packages/test-harness/speech/evaluate.mjs";
const root = "/tmp/screenrec-12-external-corpus-qualification";
const q = JSON.parse(await readFile(root + "/qualification.json", "utf8"));
const worker = "/tmp/screenrec-09c-native-presented-worker";
const models = JSON.parse(
  await readFile(
    "/Users/david/.cache/screen-recorder/verification/sentence-12h-2591aa28/packet/speech.transcribe-request.json",
    "utf8",
  ),
).params.models;
const engine = JSON.parse(
  await readFile(
    "/Users/david/dev/screen-recorder/specs/agent-editing/assets/12-speech/manifest.json",
    "utf8",
  ),
).calls[0].response.data.engine;
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  sha(await readFile(worker)),
  "0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928",
);
const before = [];
for (const file of models.files) {
  const bytes = await readFile(models.directory + "/" + file.path);
  assert.equal(bytes.length, file.bytes);
  assert.equal(sha(bytes), file.sha256);
  before.push(file);
}
const out = root + "/inference";
await mkdir(out, { recursive: false });
const report = {
  scope:
    "Fixed density-enriched human acted lexical diagnostic; no word-time or full quality verdict",
  qualificationSHA256: sha(await readFile(root + "/qualification.json")),
  producerSHA256: sha(await readFile(import.meta.filename)),
  workerSHA256: sha(await readFile(worker)),
  models,
  engine,
  cases: [],
  requests: [],
  replies: [],
  bounds: { outerSeconds: 360, requestSeconds: 60, stdioBytes: 8388608, retry: false },
};
// Freeze every parsed lexical reference before dispatch; only published F uh/um labels count.
for (const row of q.selectedRows) {
  const words = row.transcriptA
    .split(/\s+/)
    .filter((text) => normalizeWord(text))
    .map((text) => ({ text, filler: ["um", "uh"].includes(normalizeWord(text)) }));
  for (const term of ["um", "uh"])
    assert.equal(
      words.filter((w) => w.filler && normalizeWord(w.text) === term).length,
      row.fillers[term],
    );
  row.referenceWords = words;
  assert.equal(
    sha(await readFile(root + `/cohort/${String(row.rowIndex).padStart(3, "0")}.wav`)),
    row.wavSHA256,
  );
}
await writeFile(
  out + "/frozen-input.json",
  JSON.stringify({ qualification: q, models, engine, producer: report.producerSHA256 }, null, 2) +
    "\n",
  { flag: "wx" },
);
const profile =
  '(version 1)(allow default)(deny network*)(deny file-write* (subpath "/Users/david/.cache/screen-recorder/verification"))';
const child = spawn("/usr/bin/sandbox-exec", ["-p", profile, worker], {
  stdio: ["pipe", "pipe", "pipe"],
});
report.pid = child.pid;
report.startedAt = new Date().toISOString();
console.log(JSON.stringify({ event: "native-started", pid: child.pid }));
let stdout = "",
  stderr = "",
  pending,
  failed;
const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => {
  stdout += line + "\n";
  if (Buffer.byteLength(stdout) > 8388608) {
    failed = "stdout bound";
    child.kill("SIGKILL");
    return;
  }
  try {
    const value = JSON.parse(line);
    assert(pending, "Unexpected reply");
    const resolve = pending;
    pending = null;
    resolve(value);
  } catch (error) {
    failed = String(error);
    child.kill("SIGKILL");
  }
});
child.stderr.on("data", (bytes) => {
  stderr += bytes.toString();
  if (Buffer.byteLength(stderr) > 8388608) {
    failed = "stderr bound";
    child.kill("SIGKILL");
  }
});
const terminal = new Promise((resolve) =>
  child.on("close", (code, signal) => {
    report.terminal = { code, signal, closedAt: new Date().toISOString() };
    if (pending) {
      const resolvePending = pending;
      pending = null;
      resolvePending(null);
    }
    resolve();
  }),
);
child.on("error", (error) => {
  failed = String(error);
});
child.stdin.on("error", (error) => {
  failed = String(error);
});
const outer = setTimeout(() => {
  failed = "Outer360s bound";
  child.kill("SIGKILL");
}, 360000);
async function call(operation, params, id) {
  assert(["media.probe", "speech.transcribe"].includes(operation));
  assert(!pending);
  assert(child.exitCode === null && child.signalCode === null, "Native is already terminal");
  const request = { id, operation, params };
  report.requests.push(request);
  const replyPromise = new Promise((resolve) => {
    pending = resolve;
  });
  const timer = setTimeout(() => {
    failed = "Request60s bound " + id;
    child.kill("SIGKILL");
  }, 60000);
  child.stdin.write(JSON.stringify(request) + "\n");
  const reply = await replyPromise;
  clearTimeout(timer);
  assert(!failed, failed);
  assert(reply && reply.ok && reply.id === id, JSON.stringify(reply));
  report.replies.push(reply);
  return reply.data;
}
try {
  for (const row of q.selectedRows) {
    const key = String(row.rowIndex).padStart(3, "0"),
      source = root + "/cohort/" + key + ".wav";
    const probe = await call("media.probe", { path: source }, "probe-" + key);
    assert.equal(probe.originUs, 0);
    assert.equal(probe.streams.length, 1);
    const stream = probe.streams[0];
    assert.equal(stream.kind, "audio");
    assert.equal(stream.sampleRate, 22050);
    assert.equal(stream.channels, 1);
    assert.equal(stream.startUs, 0);
    assert.equal(stream.endUs, Math.round(row.durationSeconds * 1000000));
    assert.deepEqual(stream.segments, [{ startUs: 0, endUs: stream.endUs, empty: false }]);
    const output = out + "/" + key + ".raw.jsonl";
    const value = await call(
      "speech.transcribe",
      {
        models,
        track: {
          source,
          streamId: stream.id,
          sourceOffsetUs: 0,
          available: [{ startUs: 0, endUs: stream.endUs }],
        },
        output,
      },
      "speech-" + key,
    );
    assert.deepEqual(value.engine, engine);
    const raw = await readFile(output);
    assert.equal(raw.length, value.output.bytes);
    assert.equal(sha(raw), value.output.sha256);
    const segments = raw.toString().trim().split("\n").map(JSON.parse);
    assert.equal(segments.length, 1);
    const segment = segments[0];
    assert.equal(segment.state, "transcribed");
    assert(segment.words.every((w) => normalizeWord(w.text)));
    const lexical = evaluateLexical(row.referenceWords, segment.words);
    report.cases.push({
      rowIndex: row.rowIndex,
      sourceSHA256: row.wavSHA256,
      probe,
      response: value,
      rawSHA256: sha(raw),
      rawBytes: raw.length,
      lexical,
      referenceWords: row.referenceWords,
      predictedWords: segment.words,
      annotationFragmentAmbiguity:
        row.rowIndex === 84
          ? "Annotated bo- versus transcriptA b-; both original references retained, not repaired from output"
          : null,
    });
    await writeFile(out + "/report.json", JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        event: "case",
        rowIndex: row.rowIndex,
        words: lexical.matchedWords + "/" + lexical.referenceWords,
        fillers: lexical.fillers,
      }),
    );
  }
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
  report.failed = failed ?? null;
  for (const file of before) {
    const bytes = await readFile(models.directory + "/" + file.path);
    assert.equal(sha(bytes), file.sha256);
  }
  report.modelFilesUnchanged = true;
  await writeFile(out + "/native.stdout", stdout);
  await writeFile(out + "/native.stderr", stderr);
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      event: "native-closed",
      pid: child.pid,
      terminal: report.terminal,
      completed: report.completed ?? false,
      error: report.error ?? failed ?? null,
    }),
  );
}
process.exitCode =
  report.completed && !report.error && !failed && report.terminal.code === 0 ? 0 : 1;
