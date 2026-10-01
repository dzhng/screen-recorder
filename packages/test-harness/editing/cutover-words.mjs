import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { constants, appendFileSync, readFileSync } from "node:fs";
import {
  chmod,
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), "../../..");
const duration = 134025574;
const origin = 48675;
const cut = { startUs: 1800000, endUs: 1850000 };
const recordingId = "862bfdeb-4074-4fa0-b003-57e5a9e2f975";
const narration = "2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c";
const video = "ade26eacf8dce118e4fe16dcf261e7d3445d115e2b92721f0a01b8a4511de17a";
const nativeAllowed = new Set([
  "packageWorkspace.recover",
  "media.audioCapabilities",
  "media.sourceEvidence",
]);

if (process.argv[2] === "--native-gate") {
  const request = JSON.parse(readFileSync(0));
  const log = (value) =>
    appendFileSync(process.env.SCREENREC_WORD_NATIVE_LOG, JSON.stringify(value) + "\n");
  log({ event: "request", request });
  if (request.operation === "speech.transcribe") {
    const fixture = JSON.parse(readFileSync(process.env.SCREENREC_WORD_REPLAY));
    const { track, models, output } = request.params;
    assert.equal(hash(readFileSync(track.source)), narration);
    assert.deepEqual({ ...track, source: null }, fixture.track);
    assert.deepEqual(models.files, fixture.model.files);
    assert.equal(await realpath(models.directory), await realpath(fixture.model.directory));
    const raw = readFileSync(fixture.rawFile);
    assert.equal(hash(raw), fixture.rawSha256);
    assert(
      output.startsWith(fixture.outputRoot + "/"),
      "Frozen output escaped owned transcript storage",
    );
    await writeFile(output, raw);
    const response = {
      id: request.id,
      ok: true,
      data: { ...fixture.receipt, output: { file: output, bytes: raw.length, sha256: hash(raw) } },
    };
    log({
      event: "frozen-reply",
      response,
      forwarded: false,
      authority:
        "Reconstructed fixture receipt; immutable raw/segment bytes and retained public engine metadata",
    });
    process.stdout.write(JSON.stringify(response) + "\n");
  } else if (!nativeAllowed.has(request.operation)) {
    log({ event: "refused", operation: request.operation });
    process.stdout.write(
      JSON.stringify({
        id: request.id,
        ok: false,
        error: {
          code: "UNREQUESTED_NATIVE_OPERATION",
          message: request.operation,
          retryable: false,
          details: {},
        },
      }) + "\n",
    );
  } else {
    const count = Number(process.env.SCREENREC_WORD_DESCRIPTOR_COUNT);
    assert(Number.isInteger(count) && count >= 0 && count <= 32);
    const child = spawn(process.env.SCREENREC_WORD_WORKER, [], {
      cwd: "/",
      stdio: ["pipe", "pipe", "pipe", ...Array.from({ length: count }, (_, i) => i + 3)],
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (bytes) => {
      stdout += bytes;
    });
    child.stderr.on("data", (bytes) => {
      stderr += bytes;
    });
    child.stdin.end(JSON.stringify(request) + "\n");
    const [code, signal] = await once(child, "close");
    log({
      event: "forwarded-close",
      pid: child.pid,
      operation: request.operation,
      descriptors: count,
      code,
      signal,
      stdout,
      stderr,
    });
    assert.equal(code, 0, stderr);
    process.stdout.write(stdout);
  }
  process.exit(0);
}

const { values } = parseArgs({
  options: {
    "verify-report": { type: "string" },
    "lifecycle-controls": { type: "string" },
    out: { type: "string" },
    "old-home": { type: "string" },
    "old-catalog": { type: "string" },
    "project-home": { type: "string" },
    "source-bundle": { type: "string" },
    "legacy-app": { type: "string" },
    "saved-report": { type: "string" },
    "raw-file": { type: "string" },
    "readiness-report": { type: "string" },
    "legacy-worker": { type: "string" },
    mutant: { type: "boolean", default: false },
  },
});
if (values["lifecycle-controls"]) {
  await lifecycleControls(resolve(values["lifecycle-controls"]));
  process.exit(0);
}
if (values["verify-report"]) {
  const packet = JSON.parse(await readFile(values["verify-report"], "utf8"));
  const original = JSON.parse(await readFile(values["saved-report"], "utf8"));
  verifyPublicFields(packet, original);
  console.log(
    JSON.stringify({
      passed: true,
      scope: "Saved complete metadata/cursor/lifetime verification; no service or model execution",
    }),
  );
  process.exit(0);
}
for (const name of [
  "out",
  "old-home",
  "old-catalog",
  "project-home",
  "source-bundle",
  "legacy-app",
  "saved-report",
  "raw-file",
  "readiness-report",
  "legacy-worker",
])
  assert(values[name], `Name --${name} explicitly`);
assert(process.env.SCREENREC_NATIVE, "Name the unchanged current worker");
const out = resolve(values.out);
await mkdir(out, { mode: 0o700 });
const save = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + "\n");
const pin = async (path) => {
  const bytes = await readFile(path);
  return { path: await realpath(path), bytes: bytes.length, sha256: hash(bytes) };
};
const report = {
  passed: false,
  scope:
    "Paired public partial words and not_requested role; frozen ASR, no inference/quality/media verdict",
  fixtureReceipt:
    "Reconstructed from immutable 23a raw segment values and retained public engine metadata; not original native RPC bytes",
  inputs: {},
  exchanges: [],
  processes: [],
  checks: [],
  model: {},
  pages: {},
  comparisons: {},
};
const saved = JSON.parse(await readFile(values["saved-report"], "utf8"));
const readiness = JSON.parse(await readFile(values["readiness-report"], "utf8"));
report.inputs.readiness = await pin(values["readiness-report"]);
assert.equal(
  report.inputs.readiness.sha256,
  "6e1684fb5d4bb076bbc6d417b28d533d9a91ded7d443c6f3617d3a19b6a4de47",
);
assert.equal(readiness.passed, true);
report.inputs.saved = await pin(values["saved-report"]);
assert.equal(
  report.inputs.saved.sha256,
  "caf571d7f4d2ad8048fcb1084e5adb330c68f94b1d240faefadf0034a4335122",
);
report.inputs.raw = await pin(values["raw-file"]);
assert.equal(
  report.inputs.raw.sha256,
  "45a5ceb1c79225e3e35651dfb38de498df7843cdea222913fd113c2c82a6b885",
);
const raw = (await readFile(values["raw-file"], "utf8")).trim().split("\n").map(JSON.parse);
const rawWords = raw.flatMap((line) => line.words);
assert.equal(rawWords.length, 306);
assert.equal(raw.flatMap((line) => line.result.tokenTimings).length, 629);
assert.equal(
  raw.reduce((n, line) => n + line.samples, 0),
  2143573,
);
const oldHome = join(out, "recording-home"),
  newHome = join(out, "project-home");
await mkdir(oldHome, { mode: 0o700 });
await mkdir(join(newHome, "library/assets"), { recursive: true, mode: 0o700 });
report.inputs.oldCatalog = await pin(values["old-catalog"]);
assert.equal(
  report.inputs.oldCatalog.sha256,
  "7f882c348f248e79ad4efaa609f3e36092a037876ef566ac7b36927dd18715eb",
);
await copyFile(values["old-catalog"], join(oldHome, "library.sqlite"));
await mkdir(join(oldHome, "recordings"));
await cp(
  join(values["old-home"], "recordings", recordingId),
  join(oldHome, "recordings", recordingId),
  { recursive: true, force: false },
);
report.inputs.projectCatalog = await pin(join(values["project-home"], "library/catalog.sqlite"));
assert.equal(
  report.inputs.projectCatalog.sha256,
  "ba8be18f32048ab4ed94917a1df719716f51547d17c4d133e4e9fd7df16f9a9f",
);
await copyFile(report.inputs.projectCatalog.path, join(newHome, "library/catalog.sqlite"));
for (const name of await readdir(join(values["project-home"], "library/assets")))
  await copyFile(
    join(values["project-home"], "library/assets", name),
    join(newHome, "library/assets", name),
    constants.COPYFILE_FICLONE,
  );
for (const [path, format] of [
  [join(oldHome, "library.sqlite"), 1],
  [join(newHome, "library/catalog.sqlite"), 22],
]) {
  const db = new DatabaseSync(path, { readOnly: true });
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, format);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
}
report.inputs.sources = [];
for (const [name, digest] of [
  ["video.mov", video],
  ["narration.mov", narration],
  ["capture.journal.jsonl", "d44ff9028b14c533b78db6bf944b63cfc46e84b5f8d8e92299a36d4e1d986698"],
]) {
  const source = join(root, "fixtures/narrated-workbench", name);
  const original = await pin(source),
    copied = await pin(join(oldHome, "recordings", recordingId, "source", name));
  assert.equal(original.sha256, digest);
  assert.equal(copied.sha256, digest);
  report.inputs.sources.push({ original, copied });
}
const sourceBundle = await realpath(values["source-bundle"]);
const legacyApp = await realpath(values["legacy-app"]);
const currentWorker = await realpath(process.env.SCREENREC_NATIVE);
const legacyWorker = await realpath(values["legacy-worker"]);
report.inputs.currentWorker = await pin(currentWorker);
report.inputs.legacyWorker = await pin(legacyWorker);
assert.equal(
  report.inputs.currentWorker.sha256,
  "0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928",
);
assert.equal(
  report.inputs.legacyWorker.sha256,
  "c3402dd667a46da62da7603102ce6f9bbdbebe04442bcaf6e7fe45157e18ff4b",
);
report.inputs.node = { ...(await pin(process.execPath)), version: process.version };
const observer = join(out, "process-observer.mjs");
await writeFile(
  observer,
  `import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {appendFileSync} from 'node:fs';
const log=v=>appendFileSync(process.env.SCREENREC_WORD_PROCESS_LOG,JSON.stringify(v)+'\\n');
const spawn=childProcess.spawn;
childProcess.spawn=function(command,args,options={}) {
  const count=Array.isArray(options.stdio)?Math.max(0,options.stdio.length-3):0;
  if(command===process.env.SCREENREC_NATIVE) options={...options,env:{...(options.env??process.env),SCREENREC_WORD_DESCRIPTOR_COUNT:String(count)}};
  const child=spawn.call(this,command,args,options);
  log({event:'spawn',parentPid:process.pid,pid:child.pid,command,args,descriptors:count});
  child.on('close',(code,signal)=>log({event:'close',parentPid:process.pid,pid:child.pid,code,signal}));
  return child;
};
syncBuiltinESMExports();
process.on('exit',code=>log({event:'node-exit',pid:process.pid,code}));
`,
);
const gate = join(out, "native-gate.mjs");
await writeFile(
  gate,
  `#!${process.execPath}\nprocess.argv[2]='--native-gate';await import(${JSON.stringify(script)});\n`,
);
await chmod(gate, 0o700);
const profile = join(out, "read-only-authorities.sb");
await writeFile(
  profile,
  `(version 1)\n(allow default)\n(deny network-outbound)\n(deny file-write* ${[
    values["old-home"],
    values["project-home"],
    values["old-catalog"],
    legacyApp,
    join(root, "fixtures"),
    currentWorker,
    legacyWorker,
    dirname(values["readiness-report"]),
    readiness.source,
    readiness.home,
  ]
    .map((p) => `(subpath ${JSON.stringify(resolve(p))})`)
    .join(" ")})\n`,
);
const processLog = join(out, "processes.jsonl"),
  nativeLog = join(out, "native.jsonl");
process.env.SCREENREC_WORD_PROCESS_LOG = processLog;
await import(observer);
const replay = join(out, "replay.json");
const live = new Set(),
  exited = new Map();
async function run(args, env) {
  const child = spawn(process.execPath, args, { env, cwd: "/", stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (bytes) => {
    stdout += bytes;
  });
  child.stderr.on("data", (bytes) => {
    stderr += bytes;
  });
  const timer = setTimeout(() => child.kill("SIGKILL"), 30000);
  try {
    const [code, signal] = await once(child, "close");
    return { pid: child.pid, code, signal, stdout, stderr };
  } finally {
    clearTimeout(timer);
  }
}
async function start(side, entryOverride) {
  const old = side === "recording";
  const entry =
    entryOverride ??
    (old
      ? join(legacyApp, "Contents/Resources/service/main.mjs")
      : join(sourceBundle, "service.mjs"));
  const cli = old
    ? join(legacyApp, "Contents/Resources/cli/main.mjs")
    : join(sourceBundle, "cli.mjs");
  const entryPin = await pin(entry),
    cliPin = await pin(cli);
  const env = {
    ...process.env,
    SCREENREC_HOME: old ? oldHome : newHome,
    SCREENREC_NATIVE: gate,
    SCREENREC_WORD_WORKER: old ? legacyWorker : currentWorker,
    SCREENREC_WORD_REPLAY: replay,
    SCREENREC_WORD_NATIVE_LOG: nativeLog,
    SCREENREC_WORD_PROCESS_LOG: processLog,
    NODE_OPTIONS: `--import=${observer}`,
  };
  const child = spawn("/usr/bin/sandbox-exec", ["-f", profile, process.execPath, entry], {
    env,
    cwd: "/",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const { record, close: closed } = observeChild(child);
  Object.assign(record, { side, entry: entryPin, cli: cliPin });
  report.processes.push(record);
  live.add(child);
  const close = closed.then((exit) => {
    live.delete(child);
    return exit;
  });
  exited.set(child, close);
  const mcp = new Client({ name: "paired-partial-words", version: "1" });
  let socket;
  try {
    await duringStartup(child, async () => {
      socket = await serviceSocket(record);
      await mcp.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [cli, "mcp", "--socket", socket],
          env,
          stderr: "pipe",
        }),
      );
    });
  } catch (error) {
    try {
      await mcp.close();
    } catch (cleanup) {
      record.startupCleanupFailure = String(cleanup);
    }
    throw error;
  }
  return {
    side,
    async call(operation, params, { via = "cli", error } = {}) {
      const request = { operation, params };
      const response =
        via === "cli"
          ? await run([cli, operation, "--socket", socket, "--params", JSON.stringify(params)], env)
          : await mcp.callTool({ name: operation, arguments: params });
      report.exchanges.push({ side, via, request, response });
      const result =
        via === "cli"
          ? JSON.parse(response.stdout)
          : (response.structuredContent ?? JSON.parse(response.content[0].text));
      if (via === "cli") {
        assert.equal(response.signal, null);
        assert.equal(response.code, result.ok ? 0 : 1);
      } else {
        const text = JSON.parse(response.content.find((item) => item.type === "text").text);
        if (response.structuredContent) assert.deepEqual(text, response.structuredContent);
      }
      assert.equal(result.ok, !error, JSON.stringify(result));
      if (error) {
        assert.equal(result.error.code, error);
        return result.error;
      }
      return result.data;
    },
    async stop() {
      await mcp.close();
      child.stdin.end();
      const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
      try {
        assert.deepEqual(await close, { code: 0, signal: null }, record.stderr);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
async function poll(read, done, label) {
  const deadline = performance.now() + 180000;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    assert(
      !["failed", "canceled", "unavailable"].includes(value.state),
      `${label}: ${JSON.stringify(value)}`,
    );
    assert(performance.now() < deadline, label);
    await new Promise((finish) => setTimeout(finish, 100));
  }
}
async function drain(service, operation, params, name, via = "cli") {
  const pages = [];
  let cursor;
  do {
    const value = await poll(
      () =>
        service.call(
          operation,
          { ...params, ...(cursor ? { cursor } : {}), limit: cursor ? 250 : 2 },
          { via },
        ),
      (reply) => reply.state === "ready",
      operation,
    );
    pages.push(value);
    cursor = value.page.nextCursor;
  } while (cursor);
  report.pages[name] = pages;
  return pages.flatMap((value) => value.page.rows ?? value.page.entries);
}
const baselineOld = saved.receipts.legacySelectedTranscript.page.rows;
const baselineProject = saved.projectTranscriptPages.flatMap((page) => page.page.rows);
function projectedOld(before, edited) {
  return before.flatMap((row) => {
    const range = row.sourceRange;
    const retained = edited
      ? [
          { startUs: 0, endUs: cut.startUs },
          { startUs: cut.endUs, endUs: duration },
        ]
      : [{ startUs: 0, endUs: duration }];
    const fragments = retained.flatMap((span) => {
      const left = Math.max(range.startUs, span.startUs),
        right = Math.min(range.endUs, span.endUs);
      const shift = span.startUs === cut.endUs ? 50000 : 0;
      return left < right
        ? [
            {
              source: { startUs: left, endUs: right },
              playback: { startUs: left - shift, endUs: right - shift },
            },
          ]
        : [];
    });
    return fragments.length
      ? [
          {
            ...row,
            partial:
              fragments.reduce((n, f) => n + f.source.endUs - f.source.startUs, 0) !==
              range.endUs - range.startUs,
            fragments,
          },
        ]
      : [];
  });
}
function expectedProject(document, generation, acquisitionId) {
  const trackRank = document.tracks.findIndex((track) => track.kind === "audio");
  return document.clips
    .filter((clip) => clip.assetId === narration)
    .flatMap((clip) =>
      baselineProject.flatMap((row) => {
        const left = Math.max(row.sourceRange.startUs, clip.source.range.startUs),
          right = Math.min(row.sourceRange.endUs, clip.source.range.endUs);
        if (left >= right) return [];
        const shift = clip.placement.range.startUs - clip.source.range.startUs;
        return [
          {
            ...row,
            clipId: clip.id,
            trackId: clip.trackId,
            trackRank,
            acquisitionId,
            generation,
            partial: left !== row.sourceRange.startUs || right !== row.sourceRange.endUs,
            fragments: [
              {
                source: { startUs: left, endUs: right },
                project: { startUs: left + shift, endUs: right + shift },
              },
            ],
          },
        ];
      }),
    )
    .sort(
      (a, b) =>
        a.fragments[0].project.startUs - b.fragments[0].project.startUs || a.ordinal - b.ordinal,
    );
}
function expectedOldSearch(pairs) {
  return pairs.map((ordinals) => {
    const words = ordinals.map((ordinal) => baselineOld.find((row) => row.ordinal === ordinal));
    const sourceRange = {
      startUs: words[0].sourceRange.startUs,
      endUs: words.at(-1).sourceRange.endUs,
    };
    const [{ partial, fragments }] = projectedOld([{ sourceRange }], true);
    return { wordIds: ordinals.map((ordinal) => `w${ordinal}`), sourceRange, partial, fragments };
  });
}
function expectedProjectSearch(rows, pairs) {
  return pairs.map((ordinals) => {
    const words = ordinals.map((ordinal) => rows.findLast((row) => row.ordinal === ordinal));
    return {
      trackId: words[0].trackId,
      trackRank: words[0].trackRank,
      words,
      projectRange: {
        startUs: words[0].fragments[0].project.startUs,
        endUs: words.at(-1).fragments.at(-1).project.endUs,
      },
    };
  });
}
let old, modern;
let failure;
try {
  old = await start("recording");
  modern = await start("project");
  report.model.list = await modern.call("model.list", {});
  const registered = report.model.list.find((model) => model.modelId === "parakeet");
  assert.equal(
    registered.modelDigest,
    "4fe3f59cc82bab4ee7d06349b9a37c92d4b5758553b2cbb87a54ecc2dee6824a",
  );
  report.model.preparation = await modern.call("model.prepare", {
    modelId: "parakeet",
    modelSource: readiness.source,
  });
  report.model.ready = await poll(
    () => modern.call("model.status", { modelId: "parakeet" }),
    (reply) => reply.state === "ready",
    "model preparation",
  );
  assert.deepEqual(
    await modern.call("model.status", { modelId: "parakeet" }, { via: "mcp" }),
    report.model.ready,
  );
  const modelDirectory = join(
    newHome,
    "library/models/parakeet",
    registered.pins.modelRevision,
    "parakeet-tdt-0.6b-v2",
  );
  report.model.receipt = await pin(join(dirname(modelDirectory), "receipt.json"));
  const source = join(root, "fixtures/narrated-workbench");
  const importing = await modern.call("acquisition.import", {
    requestId: "23m-source",
    path: source,
  });
  const imported = await poll(
    () => modern.call("job.get", { jobId: importing.jobId }),
    (reply) => reply.state === "ready",
    "source admission",
  );
  const acquisition = await modern.call("acquisition.get", {
    acquisitionId: imported.target.acquisitionId,
  });
  report.acquisition = acquisition;
  assert.deepEqual(
    await modern.call("acquisition.get", { acquisitionId: acquisition.id }, { via: "mcp" }),
    acquisition,
  );
  assert.equal(acquisition.evidence.receipt.header.systemAudio, false);
  assert.equal(acquisition.evidence.receipt.header.microphone, true);
  assert(!acquisition.bindings.some((binding) => binding.sourceRoles.includes("system")));
  const voice = acquisition.bindings.find((binding) => binding.sourceRoles.includes("narration"));
  assert.equal(voice.assetId, narration);
  assert.equal(voice.sourceToAssetOffsetUs, -origin);
  const sourceSelector = {
    assetId: narration,
    streamId: voice.streamId,
    acquisitionId: acquisition.id,
  };
  const engine = saved.receipts.projectTranscript.dependencies.find(
    (dep) => dep.selection.assetId === narration,
  ).transcript.engine;
  const fixture = {
    track: {
      source: null,
      streamId: voice.streamId,
      sourceOffsetUs: -origin,
      available: raw.map((line) => line.source),
    },
    model: { directory: modelDirectory, files: readiness.nativeRequest.files },
    rawFile: report.inputs.raw.path,
    rawSha256: report.inputs.raw.sha256,
    outputRoot: join(newHome, "library/transcripts/assets"),
    receipt: {
      engine: {
        runtime: engine.runtime,
        runtimeVersion: engine.runtimeVersion,
        decoder: engine.decoder,
        encoderPrecision: engine.encoderPrecision,
        computeUnits: engine.computeUnits,
      },
      segments: raw.map(({ ordinal, source, state, reason, words }) => ({
        ordinal,
        source,
        state,
        ...(reason ? { reason } : {}),
        wordCount: words.length,
      })),
      wordCount: 306,
    },
  };
  await save("replay.json", fixture);
  const sourceRows = await drain(modern, "transcript.get", sourceSelector, "source-cli");
  assert.deepEqual(
    await drain(modern, "transcript.get", sourceSelector, "source-mcp", "mcp"),
    sourceRows,
  );
  const metadata = report.pages["source-cli"][0].page.transcript;
  assert.equal(metadata.raw.sha256, report.inputs.raw.sha256);
  assert.deepEqual(metadata.engine, engine);
  const sourceWords = sourceRows.filter((row) => row.type === "word");
  const expectedSource = baselineProject
    .filter((row) => row.type === "word")
    .map((value) => {
      const row = { ...value };
      for (const key of [
        "clipId",
        "assetId",
        "streamId",
        "acquisitionId",
        "trackId",
        "trackRank",
        "generation",
        "fragments",
      ])
        delete row[key];
      return row;
    });
  assert.deepEqual(sourceWords, expectedSource);
  report.receivedRaw = await pin(
    join(newHome, "library/transcripts/assets", narration, metadata.generation, "raw.jsonl"),
  );
  assert.equal(report.receivedRaw.sha256, report.inputs.raw.sha256);
  const take = await old.call("recording.get", { recordingId });
  const restored = await old.call("edit.restore", {
    recordingId,
    requestId: "23m-identity",
    expectedRevisionId: take.currentRevisionId,
    targetRevisionId: "r0",
  });
  const oldBeforeRevision = restored.revision;
  const made = await modern.call("project.create", {
    requestId: "23m-identity",
    title: "Partial-word protocol fixture",
    canvas: {
      width: 3120,
      height: 1970,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = made.project.projectId;
  const operations = [];
  for (const [label, binding] of [
    ["video", acquisition.bindings.find((b) => b.sourceRoles.includes("video"))],
    ["audio", voice],
  ]) {
    const asset = await modern.call("asset.get", { assetId: binding.assetId });
    const startUs = Math.max(0, -binding.sourceToAssetOffsetUs);
    const endUs = Math.min(
      duration,
      asset.streams.find((stream) => stream.id === binding.streamId).endUs -
        binding.sourceToAssetOffsetUs,
    );
    operations.push(
      { operation: "track.add", label, track: { kind: label, order: 0 } },
      {
        operation: "place",
        clip: {
          trackId: { label },
          assetId: binding.assetId,
          streamId: binding.streamId,
          acquisitionId: acquisition.id,
          source: {
            kind: "range",
            range: {
              startUs: startUs + binding.sourceToAssetOffsetUs,
              endUs: endUs + binding.sourceToAssetOffsetUs,
            },
          },
          placement: { kind: "project", range: { startUs, endUs } },
        },
      },
    );
  }
  const placed = await modern.call("edit.apply", {
    projectId,
    requestId: "23m-place",
    expectedRevisionId: made.revision.id,
    operations,
  });
  const before = { recordingId, revisionId: oldBeforeRevision.id };
  const projectBefore = { projectId, revisionId: placed.revision.id };
  const oldBefore = await drain(old, "transcript.get", before, "old-before-cli");
  assert.deepEqual(oldBefore, projectedOld(baselineOld, false));
  const newBefore = await drain(modern, "transcript.get", projectBefore, "new-before-cli");
  assert.deepEqual(
    newBefore,
    expectedProject(placed.revision.document, metadata.generation, acquisition.id),
  );
  assert.deepEqual(await drain(old, "transcript.get", before, "old-before-mcp", "mcp"), oldBefore);
  assert.deepEqual(
    await drain(modern, "transcript.get", projectBefore, "new-before-mcp", "mcp"),
    newBefore,
  );
  const oldCut = await old.call("edit.cut", {
    recordingId,
    requestId: "23m-cut",
    expectedRevisionId: before.revisionId,
    ranges: [cut],
  });
  const doc = placed.revision.document;
  const newCut = await modern.call("edit.apply", {
    projectId,
    requestId: "23m-cut",
    expectedRevisionId: projectBefore.revisionId,
    operations: [
      {
        operation: "remove",
        clipIds: doc.clips.map((clip) => clip.id),
        ranges: [cut],
        scope: "selected",
        ripple: { trackIds: doc.tracks.map((track) => track.id) },
      },
    ],
  });
  report.revisions = {
    oldBefore: oldBeforeRevision,
    newBefore: placed.revision,
    oldAfter: oldCut.revision,
    newAfter: newCut.revision,
  };
  const after = { recordingId, revisionId: oldCut.revision.id },
    projectAfter = { projectId, revisionId: newCut.revision.id };
  const oldAfter = await drain(old, "transcript.get", after, "old-after-cli");
  const newAfter = await drain(modern, "transcript.get", projectAfter, "new-after-cli");
  assert.deepEqual(oldAfter, projectedOld(baselineOld, true));
  assert.deepEqual(
    newAfter,
    expectedProject(newCut.revision.document, metadata.generation, acquisition.id),
  );
  assert.deepEqual(await drain(old, "transcript.get", after, "old-after-mcp", "mcp"), oldAfter);
  assert.deepEqual(
    await drain(modern, "transcript.get", projectAfter, "new-after-mcp", "mcp"),
    newAfter,
  );
  for (const [name, rows, count] of [
    ["old", oldAfter, 306],
    ["project", newAfter, 307],
  ]) {
    const words = rows.filter((row) => row.type === "word");
    assert.equal(words.length, count);
    assert.deepEqual(
      [...new Set(words.map((row) => row.ordinal))].sort((a, b) => a - b),
      Array.from({ length: 306 }, (_, i) => i),
    );
    report.comparisons[name] = {
      wordRows: words.length,
      distinctOrdinals: 306,
      partial: words.filter((row) => row.partial),
    };
  }
  const common = (rows, side) =>
    rows
      .filter((row) => row.type === "word" && row.ordinal === 1)
      .flatMap((row) => row.fragments.map((fragment) => fragment[side]));
  const retained = [
    { startUs: 1648675, endUs: 1800000 },
    { startUs: 1800000, endUs: 1918675 },
  ];
  assert.deepEqual(common(oldAfter, "playback"), retained);
  assert.deepEqual(common(newAfter, "project"), retained);
  assert.deepEqual(await drain(old, "transcript.get", before, "old-history-cli"), oldBefore);
  assert.deepEqual(
    await drain(modern, "transcript.get", projectBefore, "new-history-cli"),
    newBefore,
  );
  const absent = await old.call(
    "audio.get",
    { ...after, range: { startUs: 0, endUs: 1000000 }, track: "system" },
    { error: "UNAVAILABLE" },
  );
  assert.deepEqual(absent, {
    code: "UNAVAILABLE",
    message: "Selected audio was not acquired",
    retryable: false,
    details: { missingRoles: [{ role: "system", reason: "not_requested" }] },
  });
  assert.deepEqual(
    await old.call(
      "audio.get",
      { ...after, range: { startUs: 0, endUs: 1000000 }, track: "system" },
      { via: "mcp", error: "UNAVAILABLE" },
    ),
    absent,
  );
  const search = async (service, target, text, name) => {
    const entries = await drain(service, "transcript.search", { ...target, text }, name);
    assert.deepEqual(
      await drain(service, "transcript.search", { ...target, text }, name + "-mcp", "mcp"),
      entries,
    );
    return entries;
  };
  report.search = {
    oldPartial: await search(old, after, "so this", "old-partial"),
    projectPartial: await search(modern, projectAfter, "so this", "new-partial"),
    oldWhole: await search(old, after, "this is", "old-whole"),
    projectWhole: await search(modern, projectAfter, "this is", "new-whole"),
  };
  assert.deepEqual(report.search.oldPartial, expectedOldSearch([[1, 2]]));
  assert.deepEqual(
    report.search.oldWhole,
    expectedOldSearch([
      [2, 3],
      [164, 165],
    ]),
  );
  assert.deepEqual(
    report.search.projectWhole,
    expectedProjectSearch(
      expectedProject(newCut.revision.document, metadata.generation, acquisition.id),
      [
        [2, 3],
        [164, 165],
      ],
    ),
  );
  assert.deepEqual(report.search.projectPartial, []);
  report.checks.push(
    "Complete raw/source and all before/after CLI/MCP projection values, ordinal/occurrence shape, historical reads, intentional phrase difference, whole phrase and genuine absent role",
  );
  if (values.mutant) {
    await modern.stop();
    modern = null;
    const original = await readFile(join(sourceBundle, "service.mjs"), "utf8");
    const needle = 'if (head.row.type !== "word" || head.row.partial) {';
    assert.equal(original.split(needle).length, 2, "Partial barrier mutation owner not unique");
    const mutant = original.replace(needle, 'if (head.row.type !== "word") {');
    const entry = join(out, "partial-barrier-mutant.mjs");
    await writeFile(entry, mutant);
    report.mutant = {
      original: await pin(join(sourceBundle, "service.mjs")),
      changed: await pin(entry),
      needle,
    };
    modern = await start("project-mutant", entry);
    const unexpected = await drain(
      modern,
      "transcript.search",
      { ...projectAfter, text: "so this" },
      "mutant-partial",
    );
    report.mutant.entries = unexpected;
    assert(unexpected.length > 0, "Negative producer did not falsify the partial-phrase contract");
    assert.deepEqual(
      unexpected,
      expectedProjectSearch(
        expectedProject(newCut.revision.document, metadata.generation, acquisition.id),
        [[1, 2]],
      ),
    );
    try {
      assert.deepEqual(unexpected, []);
    } catch (error) {
      report.mutant.originalRed = {
        name: error.name,
        message: error.message,
        actual: unexpected,
        expected: [],
      };
    }
    assert(report.mutant.originalRed);
    assert.deepEqual(
      await drain(
        modern,
        "transcript.search",
        { ...projectAfter, text: "this is" },
        "mutant-whole",
      ),
      report.search.projectWhole,
    );
  }
  report.passed = true;
} catch (error) {
  failure = error;
  report.failure = { name: error.name, message: error.message, stack: error.stack };
} finally {
  // Preserve the primary outcome before any close/log parsing can fail.
  await save("report.json", report);
  for (const service of [modern, old])
    if (service) {
      try {
        await service.stop();
      } catch (error) {
        report.cleanupFailure ??= [];
        report.cleanupFailure.push(String(error));
        failure ??= error;
      }
    }
  for (const child of live) child.kill("SIGKILL");
  await Promise.allSettled(exited.values());
  for (const [key, path] of [
    ["native", nativeLog],
    ["childEvents", processLog],
  ]) {
    try {
      report[key] = (await readFile(path, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse);
    } catch (error) {
      if (error.code === "ENOENT") report[key] = [];
      else {
        report.cleanupFailure ??= [];
        report.cleanupFailure.push(String(error));
        failure ??= error;
      }
    }
  }
  if (failure) report.passed = false;
  await save("report.json", report);
}
if (failure) throw failure;
try {
  verifyPublicFields(report, saved);
} catch (error) {
  report.passed = false;
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  await save("report.json", report);
  throw error;
}
await save("report.json", report);
console.log(
  JSON.stringify({
    passed: report.passed,
    exchanges: report.exchanges.length,
    pages: Object.keys(report.pages).length,
    partialRows: report.comparisons,
    negative: !!report.mutant?.originalRed,
  }),
);

function verifyPublicFields(packet, original) {
  assert.equal(packet.passed, true);
  const frozen = packet.native.filter((event) => event.event === "frozen-reply");
  assert.equal(frozen.length, 1);
  const request = packet.native.find((event) => event.request?.operation === "speech.transcribe")
    .request.params;
  const generation = dirname(request.output).split("/").at(-1);
  const selected = {
    assetId: narration,
    streamId: "track:1",
    acquisitionId: packet.acquisition.id,
  };
  const baseline = original.receipts.projectTranscript.dependencies.find(
    (dependency) => dependency.selection.assetId === narration,
  ).transcript;
  const expected = {
    ...baseline,
    generation,
    source: { ...baseline.source, acquisitionId: packet.acquisition.id },
    track: { ...baseline.track, source: request.track.source },
  };
  const starting = packet.exchanges
    .map((exchange) =>
      exchange.via === "cli"
        ? JSON.parse(exchange.response.stdout).data
        : exchange.response.structuredContent?.data,
    )
    .find((value) => value?.assetId === narration && value.state === "processing");
  assert(starting?.jobId, "No original public source preparation identity retained");
  const dependencies = [
    {
      selection: selected,
      transcript: expected,
      state: "ready",
      reason: null,
      retryable: false,
      jobId: starting.jobId,
    },
  ];
  for (const [name, pages] of Object.entries(packet.pages)) {
    const first = pages[0];
    for (const value of pages) {
      const page = value.page;
      const reference = { ...value },
        firstReference = { ...first };
      delete reference.page;
      delete firstReference.page;
      assert.deepEqual(reference, firstReference, name);
      if ("assetId" in value) {
        assert.deepEqual(reference, { ...selected, state: "ready", generation });
        assert.deepEqual(page.transcript, expected);
      } else if ("recordingId" in value) {
        assert.deepEqual(reference, {
          recordingId,
          sourceId: packet.acquisition.sourceId,
          revisionId: value.revisionId,
          generation: original.transcriptOracle.oldGeneration,
          state: "ready",
        });
        if (page.transcript)
          assert.deepEqual(
            page.transcript,
            original.receipts.legacySelectedTranscript.page.transcript,
          );
      } else {
        assert.deepEqual(reference, {
          projectId: packet.revisions.newBefore.projectId,
          revisionId: value.revisionId,
          state: "ready",
          dependencies,
        });
      }
      if (page.nextCursor) {
        for (const key of [
          "assetId",
          "streamId",
          "acquisitionId",
          "recordingId",
          "projectId",
          "revisionId",
          "generation",
        ])
          if (key in page.nextCursor)
            assert.equal(page.nextCursor[key], reference[key], `${name}/${key}`);
        if ("supportDigest" in page.nextCursor)
          assert.equal(page.nextCursor.supportDigest, expected.source.supportDigest);
        if ("manifestId" in page.nextCursor) {
          assert.deepEqual(Object.keys(page.nextCursor).sort(), [
            "checkpointId",
            "manifestId",
            "projectId",
            "queryDigest",
            "revisionId",
          ]);
          assert.equal(page.nextCursor.manifestId, first.page.nextCursor.manifestId);
          assert.equal(page.nextCursor.queryDigest, first.page.nextCursor.queryDigest);
        }
      }
    }
  }
  for (const exchange of packet.exchanges) {
    const envelope =
      exchange.via === "cli"
        ? JSON.parse(exchange.response.stdout)
        : (exchange.response.structuredContent ?? JSON.parse(exchange.response.content[0].text));
    if (exchange.via === "mcp" && exchange.response.structuredContent)
      assert.deepEqual(
        JSON.parse(exchange.response.content.find((block) => block.type === "text").text),
        exchange.response.structuredContent,
      );
    if (envelope.data?.state !== "ready" || !exchange.request.operation.startsWith("transcript."))
      continue;
    for (const key of [
      "assetId",
      "streamId",
      "acquisitionId",
      "recordingId",
      "projectId",
      "revisionId",
    ])
      if (key in exchange.request.params)
        assert.equal(envelope.data[key], exchange.request.params[key]);
  }
  for (const [cli, mcp] of [
    ["source-cli", "source-mcp"],
    ["old-before-cli", "old-before-mcp"],
    ["old-after-cli", "old-after-mcp"],
  ])
    assert.deepEqual(packet.pages[cli], packet.pages[mcp]);
  assert.deepEqual(packet.pages["old-history-cli"], packet.pages["old-before-cli"]);
  for (const process of packet.processes) assert.deepEqual(process.exit, { code: 0, signal: null });
  assert(!packet.native.some((event) => event.event === "refused"));
  for (const event of packet.native.filter((event) => event.event === "forwarded-close")) {
    assert(nativeAllowed.has(event.operation));
    assert.equal(event.code, 0);
    assert.equal(event.signal, null);
  }
  for (const child of packet.childEvents.filter((event) => event.event === "spawn"))
    assert(
      packet.childEvents.some((event) => event.event === "close" && event.pid === child.pid),
      `Unclosed child ${child.pid}`,
    );
  const clients = packet.childEvents.filter(
    (event) => event.event === "spawn" && event.args?.includes("mcp"),
  );
  assert.equal(clients.length, 3);
  for (const client of clients) {
    assert(
      packet.childEvents.some(
        (event) => event.event === "node-exit" && event.pid === client.pid && event.code === 0,
      ),
      `Missing actual MCP Node exit ${client.pid}`,
    );
    assert(
      packet.childEvents.some(
        (event) =>
          event.event === "close" &&
          event.pid === client.pid &&
          event.code === 0 &&
          event.signal === null,
      ),
      `Missing actual MCP close ${client.pid}`,
    );
  }
}

function observeChild(child) {
  const record = { pid: child.pid, stdout: "", stderr: "", exit: null };
  child.stdout.on("data", (bytes) => {
    record.stdout += bytes;
  });
  child.stderr.on("data", (bytes) => {
    record.stderr += bytes;
  });
  child.on("error", (error) => {
    record.spawnError = String(error);
  });
  const close = new Promise((done) => {
    child.once("close", (code, signal) => {
      record.exit = { code, signal };
      done(record.exit);
    });
  });
  return { record, close };
}

async function serviceSocket(record) {
  for (let i = 0; i < 150; i++) {
    assert.equal(record.exit, null, "Source service closed before readiness");
    assert(!record.spawnError, record.spawnError);
    const lines = record.stdout.split("\n").slice(0, -1).filter(Boolean).map(JSON.parse);
    assert(!lines.some((line) => line.event === "failed"), record.stdout);
    const socket = lines.find((line) => line.event === "started")?.socketPath;
    if (socket) return socket;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.fail(record.stdout + record.stderr);
}

async function duringStartup(child, work) {
  const early = (code, signal) =>
    new Error(`Child ${child.pid} closed during startup: ${code}/${signal}`);
  if (child.exitCode !== null || child.signalCode !== null)
    throw early(child.exitCode, child.signalCode);
  let onClose, onError;
  const closed = new Promise((_, reject) => {
    onClose = (code, signal) => reject(early(code, signal));
    onError = reject;
  });
  child.once("close", onClose);
  child.once("error", onError);
  try {
    return await Promise.race([work(), closed]);
  } finally {
    child.off("close", onClose);
    child.off("error", onError);
  }
}

async function lifecycleControls(directory) {
  await mkdir(directory, { mode: 0o700 });
  const controls = [];
  for (const [name, code, outcome] of [
    ["close-before-readiness", "process.exit(0)", "reject"],
    ["close-before-later-await", "process.exit(0)", "reject"],
    [
      "close-during-handshake",
      'process.stdout.write(\'{"event":"started","socketPath":"fixture"}\\n\');setTimeout(()=>process.exit(0),300)',
      "reject",
    ],
    [
      "ready-then-owned-close",
      'process.stdout.write(\'{"event":"started","socketPath":"fixture"}\\n\');process.stdin.resume();process.stdin.on(\'end\',()=>process.exit(0))',
      "ready",
    ],
    [
      "split-started-frame",
      'process.stdout.write(\'{"event":"started",\');setTimeout(()=>process.stdout.write(\'"socketPath":"fixture"}\\n\'),150);process.stdin.resume();process.stdin.on(\'end\',()=>process.exit(0))',
      "ready",
    ],
  ]) {
    const child = spawn(process.execPath, ["-e", code], { stdio: ["pipe", "pipe", "pipe"] });
    const { record, close: exit } = observeChild(child);
    const control = { name, pid: child.pid, code, stdout: null, exit: null };
    controls.push(control);
    const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
    try {
      if (name === "close-before-later-await") {
        await exit;
        assert.deepEqual(record.exit, { code: 0, signal: null });
      }
      if (name === "split-started-frame") {
        await once(child.stdout, "data");
        assert.equal(record.stdout, '{"event":"started",');
        control.incompleteFrameObserved = true;
      }
      const ready = duringStartup(child, async () => {
        const socket = await serviceSocket(record);
        assert.equal(socket, "fixture");
        control.socketObserved = true;
        if (outcome === "ready") return "ready";
        return new Promise(() => {});
      });
      if (outcome === "reject")
        await assert.rejects(ready, (error) => {
          control.refusal = { name: error.name, message: error.message };
          return /closed during startup/.test(error.message);
        });
      else assert.equal(await ready, "ready");
      child.stdin.end();
      control.exit = await exit;
      assert.deepEqual(control.exit, { code: 0, signal: null });
      control.stdout = record.stdout;
      if (name === "close-during-handshake") assert.equal(control.socketObserved, true);
      if (outcome === "ready" || name === "close-during-handshake")
        assert.equal(record.stdout, '{"event":"started","socketPath":"fixture"}\n');
      control.passed = true;
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exit;
      }
      await writeFile(
        join(directory, "report.json"),
        JSON.stringify(
          { scope: "Node child lifetime controls only; no source service/model/native", controls },
          null,
          2,
        ) + "\n",
      );
    }
  }
  console.log(JSON.stringify({ passed: controls.length, scope: "Bounded child startup controls" }));
}
