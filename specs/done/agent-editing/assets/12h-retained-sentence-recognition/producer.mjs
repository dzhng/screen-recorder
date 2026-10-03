import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { evaluateSentence } from "./evaluate.mjs";

const { values } = parseArgs({
  options: Object.fromEntries(["root", "out", "home"].map((key) => [key, { type: "string" }])),
});
for (const key of ["root", "out", "home"])
  assert(values[key]?.startsWith("/"), `Pass absolute --${key}`);
const root = await realpath(values.root);
const out = values.out;
await mkdir(out, { recursive: false });
await mkdir(values.home, { recursive: false, mode: 0o700 });
const save = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + "\n");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function pin(path) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return { path, bytes: (await stat(path)).size, sha256: hash.digest("hex") };
}
const assets = join(root, "specs/agent-editing/assets");
const input = join(assets, "12d-complete-sentence/original.wav");
const source =
  "/Users/david/.cache/screen-recorder/verification/parakeet-23n-db6b985b/source/parakeet-tdt-0.6b-v2";
const acceptedHome =
  "/Users/david/.cache/screen-recorder/verification/parakeet-23n-db6b985b/home/library/models/parakeet/ee09c569f73759e6d44c9bd16766f477b2b36d39";
const runtime =
  "/Users/david/.cache/screen-recorder/verification/parakeet-23n-db6b985b/runtime/models.mjs";
const worker = "/private/tmp/screenrec-09c-native-presented-worker";
const baseline = JSON.parse(await readFile(join(assets, "12-speech/manifest.json"), "utf8"));
const expectedEngine = baseline.calls[0].response.data.engine;
const report = {
  scope:
    "One additional fixed retained-sentence recognition case; no baseline adoption or historical causal claim",
  command: { executable: process.execPath, argv: process.argv, cwd: process.cwd() },
  producer: await pin(fileURLToPath(import.meta.url)),
  evaluator: await pin(join(dirname(fileURLToPath(import.meta.url)), "evaluate.mjs")),
  node: { version: process.version, pin: await pin(process.execPath) },
  source,
  home: values.home,
  out,
  worker,
  exchanges: [],
  children: [],
  networkRequests: 0,
};
let owner;
let speechAttempts = 0;

async function snapshot() {
  const paths = [
    input,
    worker,
    runtime,
    join(acceptedHome, "receipt.json"),
    join(assets, "12d-complete-sentence/candidate-remove-uh.wav"),
    join(assets, "12e-labeled-cleanup/candidate-remove-marked-fillers.wav"),
    join(assets, "12d-human-marks/human-marks.json"),
    join(assets, "12f-human-marks/human-marks.json"),
    join(assets, "12-speech/raw.jsonl"),
    join(assets, "12-speech/transcript.json"),
  ];
  for (const file of baseline.models.files) {
    paths.push(join(source, file.path));
    paths.push(join(acceptedHome, "parakeet-tdt-0.6b-v2", file.path));
  }
  const result = [];
  for (const path of paths) result.push(await pin(path));
  return result;
}

async function invoke(operation, params) {
  assert(
    ["media.probe", "speech.transcribe"].includes(operation),
    "Undeclared native operation refused",
  );
  if (operation === "speech.transcribe") {
    assert.equal(speechAttempts++, 0, "Only one speech inference attempt permitted");
    await writeFile(
      join(out, "inference-started.json"),
      JSON.stringify({ operation, producer: report.producer }) + "\n",
      { flag: "wx" },
    );
  }
  const request = { id: operation, operation, params };
  await save(operation + "-request.json", request);
  const child = spawn(
    "/usr/bin/sandbox-exec",
    ["-p", "(version 1)(allow default)(deny network*)", worker],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const event = {
    operation,
    pid: child.pid,
    executable: "/usr/bin/sandbox-exec",
    args: ["-p", "(version 1)(allow default)(deny network*)", worker],
    startedAt: new Date().toISOString(),
  };
  report.children.push(event);
  console.log(JSON.stringify({ event: "native-launched", ...event }));
  const buffers = [[], []],
    counts = [0, 0];
  let failure;
  const timer = setTimeout(() => {
    failure = "Existing180000ms native ceiling exceeded";
    child.kill("SIGKILL");
  }, 180000);
  for (const [index, stream] of [child.stdout, child.stderr].entries())
    stream.on("data", (bytes) => {
      counts[index] += bytes.length;
      if (counts[index] > 8 * 1024 * 1024) {
        failure = "Existing8MiB stdio bound exceeded";
        child.kill("SIGKILL");
      } else buffers[index].push(bytes);
    });
  child.stdin.on("error", (error) => {
    failure ??= error.message;
  });
  const terminal = new Promise((resolve) => {
    child.on("error", (error) => {
      failure ??= error.message;
    });
    child.on("close", (code, signal) =>
      resolve({ code, signal, closedAt: new Date().toISOString() }),
    );
  });
  child.stdin.end(JSON.stringify(request) + "\n");
  Object.assign(event, await terminal);
  clearTimeout(timer);
  const stdout = Buffer.concat(buffers[0]).toString(),
    stderr = Buffer.concat(buffers[1]).toString();
  await writeFile(join(out, operation + ".stdout"), stdout);
  await writeFile(join(out, operation + ".stderr"), stderr);
  report.exchanges.push({ request, stdout, stderr, terminal: event });
  console.log(JSON.stringify({ event: "native-closed", ...event }));
  assert.equal(failure, undefined, failure);
  assert.equal(event.code, 0, stderr);
  const response = JSON.parse(stdout);
  await save(operation + "-response.json", response);
  assert.equal(response.ok, true, JSON.stringify(response));
  assert.equal(response.id, request.id);
  return response.data;
}

try {
  report.before = await snapshot();
  assert.equal(
    report.before.find((x) => x.path === input).sha256,
    "38ad96206360f48ece6ded712f0a1d72b18efb9eae3dfd5e01b49721e67c8dfb",
  );
  assert.equal(
    report.before.find((x) => x.path === worker).sha256,
    "0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928",
  );
  assert.equal(
    report.before.find((x) => x.path === runtime).sha256,
    "78b46942c08a66f77e3db886281a00c636e2e7248e7fcee1ce64974ff9a79354",
  );
  for (const file of baseline.models.files)
    for (const folder of [source, join(acceptedHome, "parakeet-tdt-0.6b-v2")]) {
      const actual = report.before.find((x) => x.path === join(folder, file.path));
      assert.equal(actual.bytes, file.bytes);
      assert.equal(actual.sha256, file.sha256);
    }
  const wav = await readFile(input);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  let format, data;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const name = wav.toString("ascii", offset, offset + 4),
      bytes = wav.readUInt32LE(offset + 4);
    assert(offset + 8 + bytes <= wav.length);
    if (name === "fmt ")
      format = {
        code: wav.readUInt16LE(offset + 8),
        channels: wav.readUInt16LE(offset + 10),
        rate: wav.readUInt32LE(offset + 12),
        align: wav.readUInt16LE(offset + 20),
        bits: wav.readUInt16LE(offset + 22),
      };
    if (name === "data")
      data = {
        offset: offset + 8,
        bytes,
        sha256: sha(wav.subarray(offset + 8, offset + 8 + bytes)),
      };
    offset += 8 + bytes + (bytes & 1);
  }
  assert.deepEqual(format, { code: 3, channels: 1, rate: 48000, align: 4, bits: 32 });
  assert.equal(data.bytes / format.align, 342720);
  report.input = {
    file: report.before.find((x) => x.path === input),
    format,
    payload: data,
    frames: 342720,
    localSupport: { startUs: 0, endUs: 7140000 },
    originalSourceOffsetUs: 50518675,
  };
  const sourceAuthority = JSON.parse(
    await readFile(join(dirname(fileURLToPath(import.meta.url)), "native-source.json"), "utf8"),
  );
  report.nativeSource = [];
  for (const [relative, expected] of Object.entries(sourceAuthority.files)) {
    const actual = await pin(join(root, relative));
    assert.equal(actual.bytes, expected.bytes);
    assert.equal(actual.sha256, expected.sha256);
    report.nativeSource.push(actual);
  }
  report.nativeSourceAuthority = sourceAuthority.authority;
  const { Models, parakeetModel } = await import(pathToFileURL(runtime).href);
  assert.deepEqual(parakeetModel.files, baseline.models.files);
  owner = new Models(values.home, async () => {
    report.networkRequests++;
    throw new Error("No downloads authorized");
  });
  report.modelBefore = await owner.status("parakeet");
  assert.deepEqual(report.modelBefore, { state: "absent" });
  await owner.prepare("parakeet", AbortSignal.timeout(180000), { modelSource: source });
  report.modelAfter = await owner.status("parakeet");
  assert.deepEqual(report.modelAfter, { state: "ready" });
  const model = owner.transcription("parakeet");
  assert.equal(model.modelDigest, baseline.models.digest);
  assert.deepEqual(model.pins, baseline.models.pins);
  report.modelRequest = await model.nativeRequest();
  report.managed = [];
  for (const file of report.modelRequest.files)
    report.managed.push(await pin(join(report.modelRequest.directory, file.path)));
  report.modelReceipt = JSON.parse(
    await readFile(join(report.modelRequest.directory, "../receipt.json"), "utf8"),
  );
  await writeFile(
    join(out, "prepared-receipt.json"),
    await readFile(join(report.modelRequest.directory, "../receipt.json")),
  );
  report.probe = await invoke("media.probe", { path: input });
  assert.equal(report.probe.originUs, 0);
  assert.equal(report.probe.streams.length, 1);
  const stream = report.probe.streams[0];
  assert.equal(stream.kind, "audio");
  assert.equal(stream.decodable, true);
  assert.equal(stream.sampleRate, 48000);
  assert.equal(stream.channels, 1);
  assert.equal(stream.startUs, 0);
  assert.equal(stream.endUs, 7140000);
  assert.deepEqual(
    stream.segments.map((x) => [x.startUs, x.endUs, x.empty]),
    [[0, 7140000, false]],
  );
  report.preInference = {
    recipe: expectedEngine,
    expected16kSamples: 114240,
    preparedPCMHash: null,
    limitation:
      "Unchanged shared audio owner exposes neither16k admission bytes nor a pre-engine sample receipt. WAV/support/code binding is qualified; actual admitted count is reported in the raw result after this one black-box inference.",
  };
  await save("qualification.json", report);
  report.transcription = await invoke("speech.transcribe", {
    models: report.modelRequest,
    track: {
      source: input,
      streamId: stream.id,
      sourceOffsetUs: 0,
      available: [{ startUs: 0, endUs: 7140000 }],
    },
    output: join(out, "raw.jsonl"),
  });
  assert.deepEqual(report.transcription.engine, expectedEngine);
  const segments = (await readFile(join(out, "raw.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  report.raw = await pin(join(out, "raw.jsonl"));
  assert.equal(report.raw.sha256, report.transcription.output.sha256);
  assert.equal(report.raw.bytes, report.transcription.output.bytes);
  assert.equal(segments.length, 1);
  const segment = segments[0];
  assert.equal(segment.state, "transcribed");
  assert.equal(segment.sampleRate, 16000);
  assert.equal(segment.samples, 114240);
  assert.deepEqual(segment.source, { startUs: 0, endUs: 7140000 });
  report.actualAdmission = {
    source: segment.source,
    sampleRate: segment.sampleRate,
    samples: segment.samples,
    preparedPCMHash: null,
    inputBytesPinned: true,
  };
  const human = JSON.parse(
    await readFile(join(assets, "12d-human-marks/human-marks.json"), "utf8"),
  );
  const inherited = JSON.parse(
    await readFile(join(assets, "12-speech/transcript.json"), "utf8"),
  ).slice(111, 124);
  report.evaluation = evaluateSentence(segment, human, inherited);
  await save("evaluation.json", report.evaluation);
  report.state = "complete fixed case; no retry/adoption";
} catch (error) {
  report.state = "failed or invalid case; no retry";
  report.error = { name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (owner) await owner.settled();
  report.speechAttempts = speechAttempts;
  try {
    report.after = await snapshot();
    report.preserved = JSON.stringify(report.before) === JSON.stringify(report.after);
  } catch (error) {
    report.preserved = false;
    report.preservationError = error.message;
  }
  await save("report.json", report);
  assert.equal(report.preserved, true, "Original/reference bytes changed");
  assert.equal(report.networkRequests, 0);
  console.log(
    JSON.stringify({
      event: "case-terminal",
      state: report.state,
      speechAttempts,
      preserved: report.preserved,
      openingUm: report.evaluation?.openingUm,
      controls: report.evaluation?.controls,
      error: report.error,
    }),
  );
}
