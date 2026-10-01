import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { constants, readFileSync, appendFileSync, createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, writeFile, chmod, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createServer, createConnection } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { cliReply } from "./first-preview-transport.mjs";

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), "../../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function filePin(path) {
  const digest = createHash("sha256");
  let bytes = 0;
  for await (const block of createReadStream(path)) {
    bytes += block.length;
    digest.update(block);
  }
  return { bytes, sha256: digest.digest("hex") };
}
// The gate precedes forwarding, including recovery of copied catalogs. It never admits media work.
const nativeAllowed = new Set([
  "storage.clearRenderWorkspace",
  "packageWorkspace.recover",
  "media.audioCapabilities",
]);
if (process.argv[2] === "--native-proxy") {
  const input = readFileSync(0);
  const request = JSON.parse(input);
  const allowed = nativeAllowed.has(request.operation);
  appendFileSync(
    process.env.SCREENREC_STATE_NATIVE_LOG,
    JSON.stringify({ request, allowed }) + "\n",
  );
  if (!allowed) {
    process.stdout.write(
      JSON.stringify({
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
    const stdio = [
      "pipe",
      "pipe",
      "pipe",
      ...(request.operation === "media.audioCapabilities" ? [] : [3]),
    ];
    const child = spawn(process.env.SCREENREC_STATE_WORKER, [], { cwd: "/", stdio });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      assert(stdout.length < 8 * 1024 * 1024);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdin.end(input);
    const [code, signal] = await once(child, "close");
    appendFileSync(
      process.env.SCREENREC_STATE_NATIVE_LOG,
      JSON.stringify({ response: stdout, stderr, exit: { code, signal } }) + "\n",
    );
    assert.equal(code, 0, stderr);
    process.stdout.write(stdout);
  }
  process.exit(0);
}

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    "old-catalog": { type: "string" },
    "project-home": { type: "string" },
    "legacy-app": { type: "string" },
    "source-bundle": { type: "string" },
  },
});
assert(
  values.out &&
    values["old-catalog"] &&
    values["project-home"] &&
    values["legacy-app"] &&
    values["source-bundle"],
);
assert(process.env.SCREENREC_NATIVE, "Name the frozen worker explicitly");
const out = resolve(values.out);
await mkdir(out, { mode: 0o700 });
const oldCatalog = await realpath(values["old-catalog"]);
const projectDonor = await realpath(values["project-home"]);
const legacyApp = await realpath(values["legacy-app"]);
const worker = await realpath(process.env.SCREENREC_NATIVE);
const sourceBundle = await realpath(values["source-bundle"]);
const report = {
  scope: "Matched public edit state only; no media/capture/inference/presentation",
  passed: false,
  inputs: {},
  exchanges: [],
  processes: [],
  checks: [],
  mappings: [],
  nativeAllowed: [...nativeAllowed],
};
const fixture = join(root, "fixtures/narrated-workbench");
const described = JSON.parse(await readFile(join(fixture, "recording.json"), "utf8"));
const D = described.sourceDurationUs;
assert.equal(D, 134025574);
const recordingId = described.recordingId;
const originals = {
  "video.mov": "ade26eacf8dce118e4fe16dcf261e7d3445d115e2b92721f0a01b8a4511de17a",
  "narration.mov": "2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c",
  "capture.journal.jsonl": "d44ff9028b14c533b78db6bf944b63cfc46e84b5f8d8e92299a36d4e1d986698",
};
report.inputs.oldCatalog = { path: oldCatalog, sha256: hash(await readFile(oldCatalog)) };
assert.equal(
  report.inputs.oldCatalog.sha256,
  "7f882c348f248e79ad4efaa609f3e36092a037876ef566ac7b36927dd18715eb",
);
report.inputs.projectCatalog = {
  path: join(projectDonor, "library/catalog.sqlite"),
  sha256: hash(await readFile(join(projectDonor, "library/catalog.sqlite"))),
};
report.inputs.worker = { path: worker, sha256: hash(await readFile(worker)) };
assert.equal(
  report.inputs.worker.sha256,
  "0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928",
);
report.inputs.node = {
  path: process.execPath,
  version: process.version,
  sha256: hash(await readFile(process.execPath)),
};
const oldHome = join(out, "recording-home"),
  newHome = join(out, "project-home");
await mkdir(join(oldHome, "recordings", recordingId, "source"), { recursive: true, mode: 0o700 });
await mkdir(join(newHome, "library/assets"), { recursive: true, mode: 0o700 });
await copyFile(oldCatalog, join(oldHome, "library.sqlite"));
await copyFile(report.inputs.projectCatalog.path, join(newHome, "library/catalog.sqlite"));
for (const [name, expected] of Object.entries(originals)) {
  const source = join(fixture, name);
  assert.equal(hash(await readFile(source)), expected);
  await copyFile(source, join(oldHome, "recordings", recordingId, "source", name));
}
// Copy canonical files, never model storage or derived media. All asset facts remain genuine.
report.inputs.assetFiles = [];
for (const name of await readdir(join(projectDonor, "library/assets"))) {
  const source = join(projectDonor, "library/assets", name);
  const destination = join(newHome, "library/assets", name);
  await copyFile(source, destination, constants.COPYFILE_FICLONE).catch(() =>
    copyFile(source, destination),
  );
  const pin = await filePin(destination);
  assert.equal(name.split(".")[0], pin.sha256);
  report.inputs.assetFiles.push({ name, ...pin });
}
for (const [side, path, format] of [
  ["recording", join(oldHome, "library.sqlite"), 1],
  ["project", join(newHome, "library/catalog.sqlite"), 22],
]) {
  const db = new DatabaseSync(path, { readOnly: true });
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, format);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
  report.inputs[side + "Format"] = format;
}
const proxy = join(out, "native-gate.mjs");
await writeFile(
  proxy,
  `#!${process.execPath}\nprocess.argv[2]='--native-proxy'; await import(${JSON.stringify(script)});\n`,
);
await chmod(proxy, 0o700);
const profile = join(out, "read-only-authorities.sb");
await writeFile(
  profile,
  `(version 1)\n(allow default)\n(deny file-write* ${[
    oldCatalog,
    projectDonor,
    legacyApp,
    fixture,
    worker,
    join(process.env.HOME, ".screen-recorder"),
  ]
    .map((path) => `(subpath ${JSON.stringify(path)})`)
    .join(" ")})\n`,
);
const live = new Set();
const exits = [];
let ordinal = 0;
async function start(side) {
  const isOld = side === "recording";
  const entry = isOld
    ? join(legacyApp, "Contents/Resources/service/main.mjs")
    : join(sourceBundle, "service.mjs");
  const cli = isOld
    ? join(legacyApp, "Contents/Resources/cli/main.mjs")
    : join(sourceBundle, "cli.mjs");
  const child = spawn("/usr/bin/sandbox-exec", ["-f", profile, process.execPath, entry], {
    cwd: "/",
    env: {
      ...process.env,
      SCREENREC_HOME: isOld ? oldHome : newHome,
      SCREENREC_NATIVE: proxy,
      SCREENREC_STATE_WORKER: worker,
      SCREENREC_STATE_NATIVE_LOG: join(out, "native.jsonl"),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const record = {
    side,
    pid: child.pid,
    entry,
    entrySha256: hash(await readFile(entry)),
    cli,
    cliSha256: hash(await readFile(cli)),
    stdout: "",
    stderr: "",
    exit: null,
  };
  report.processes.push(record);
  live.add(child);
  child.stdout.on("data", (chunk) => {
    record.stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    record.stderr += chunk;
  });
  const exited = once(child, "close").then(([code, signal]) => {
    record.exit = { code, signal };
    live.delete(child);
    return record.exit;
  });
  exits.push(exited);
  let socket;
  for (let attempt = 0; attempt < 150; attempt++) {
    const lines = record.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert(!lines.some((line) => line.event === "failed"), record.stdout);
    socket = lines.find((line) => line.event === "started")?.socketPath;
    if (socket) break;
    assert.equal(record.exit, null, record.stderr);
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(socket, record.stdout + record.stderr);
  const mcp = new Client({ name: "cutover-state-preservation", version: "1" });
  await mcp.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [cli, "mcp", "--socket", socket],
      stderr: "pipe",
    }),
  );
  return {
    async loseReply(operation, params) {
      const path = join(out, `lost-${side}.sock`);
      let originalResponse;
      const proxyServer = createServer((client) => {
        const backend = createConnection(socket);
        client.pipe(backend);
        let bytes = "";
        backend.on("data", (chunk) => {
          bytes += chunk;
          if (bytes.includes("\n")) {
            originalResponse = JSON.parse(bytes);
            client.destroy();
            backend.destroy();
          }
        });
        client.on("error", () => backend.destroy());
        backend.on("error", () => client.destroy());
      });
      await new Promise((done, fail) => {
        proxyServer.once("error", fail);
        proxyServer.listen(path, done);
      });
      try {
        const clientResponse = await cliReply([
          cli,
          operation,
          "--socket",
          path,
          "--params",
          JSON.stringify(params),
        ]);
        assert.equal(clientResponse.ok, false, "Lost acknowledgement reached the client");
        assert.equal(originalResponse?.ok, true);
        report.exchanges.push({
          ordinal: ++ordinal,
          side,
          transport: "cli-lost-acknowledgement",
          operation,
          params,
          response: originalResponse,
          clientResponse,
          responseForwarded: false,
        });
        return originalResponse.data;
      } finally {
        await new Promise((done) => proxyServer.close(done));
      }
    },
    async call(operation, params, { error, transport = "cli" } = {}) {
      const response =
        transport === "cli"
          ? await cliReply([cli, operation, "--socket", socket, "--params", JSON.stringify(params)])
          : await mcp.callTool({ name: operation, arguments: params });
      report.exchanges.push({ ordinal: ++ordinal, side, transport, operation, params, response });
      const result = transport === "cli" ? response : response.structuredContent;
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
        assert.deepEqual(await exited, { code: 0, signal: null }, record.stderr);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
let old, modern;
let projectId;
const identity = [[0, D]];
function sourceMap(revision, side) {
  if (side === "recording") return revision.spans.map((range) => [range.startUs, range.endUs]);
  const video = revision.document.clips
    .filter((clip) => clip.assetId === originals["video.mov"])
    .sort((a, b) => a.placement.range.startUs - b.placement.range.startUs);
  let atUs = 0;
  return video.map((clip) => {
    assert.deepEqual(clip.placement.range, {
      startUs: atUs,
      endUs: atUs + clip.source.range.endUs - clip.source.range.startUs,
    });
    atUs = clip.placement.range.endUs;
    return [clip.source.range.startUs, clip.source.range.endUs];
  });
}
async function compare(label, expected) {
  const { revision: a } = await old.call("revision.get", { recordingId });
  const { revision: b } = await modern.call("revision.get", { projectId });
  const oldMap = sourceMap(a, "recording"),
    newMap = sourceMap(b, "project");
  assert.deepEqual(oldMap, expected);
  assert.deepEqual(newMap, expected);
  let projectStart = 0;
  const expectedAudio = expected.flatMap(([start, end]) => {
    const left = Math.max(start, 48675),
      right = Math.min(end, 134022009);
    const rows =
      left < right
        ? [
            {
              source: [left - 48675, right - 48675],
              project: [projectStart + left - start, projectStart + right - start],
            },
          ]
        : [];
    projectStart += end - start;
    return rows;
  });
  const actualAudio = b.document.clips
    .filter((clip) => clip.assetId === originals["narration.mov"])
    .sort((left, right) => left.placement.range.startUs - right.placement.range.startUs)
    .map((clip) => ({
      source: [clip.source.range.startUs, clip.source.range.endUs],
      project: [clip.placement.range.startUs, clip.placement.range.endUs],
    }));
  assert.deepEqual(actualAudio, expectedAudio);
  report.mappings.push({
    label,
    expected,
    oldMap,
    newMap,
    expectedAudio,
    actualAudio,
    oldRevision: a.id,
    newRevision: b.id,
  });
  return { a, b };
}
function removeRequest(revision, requestId, ranges) {
  return {
    projectId,
    expectedRevisionId: revision.id,
    requestId,
    operations: [
      {
        operation: "remove",
        clipIds: revision.document.clips.map((clip) => clip.id),
        ranges,
        scope: "selected",
        ripple: { trackIds: revision.document.tracks.map((track) => track.id) },
      },
    ],
  };
}
let failure;
try {
  old = await start("recording");
  modern = await start("project");
  const selected = await old.call("recording.get", { recordingId });
  await old.call("edit.restore", {
    recordingId,
    requestId: "23j-base",
    expectedRevisionId: selected.currentRevisionId,
    targetRevisionId: "r0",
  });
  const created = await modern.call("project.create", {
    requestId: "23j-base",
    title: "State preservation fixture",
    canvas: {
      width: 3120,
      height: 1970,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  projectId = created.project.projectId;
  const operations = [];
  for (const [label, name, startUs, endUs] of [
    ["video", "video.mov", 0, D],
    ["audio", "narration.mov", 48675, 134022009],
  ]) {
    const asset = await modern.call("asset.get", { assetId: originals[name] });
    assert.equal(asset.originUs, startUs);
    assert.equal(asset.streams[0].endUs, endUs - startUs);
    operations.push(
      { operation: "track.add", label, track: { kind: label, order: 0 } },
      {
        operation: "place",
        clip: {
          trackId: { label },
          assetId: asset.id,
          streamId: "track:1",
          source: { kind: "range", range: { startUs: 0, endUs: endUs - startUs } },
          placement: { kind: "project", range: { startUs, endUs } },
        },
      },
    );
  }
  await modern.call("edit.apply", {
    projectId,
    requestId: "23j-place",
    expectedRevisionId: created.revision.id,
    operations,
  });
  const before = await compare("identity", identity);
  const ranges = [
    { startUs: 1000000, endUs: 2000000 },
    { startUs: 4000000, endUs: 5000000 },
  ];
  const oldRequest = { recordingId, requestId: "23j-cut", expectedRevisionId: before.a.id, ranges };
  const newRequest = removeRequest(before.b, "23j-cut", ranges);
  const oldAnswer = await old.loseReply("edit.cut", oldRequest);
  const newAnswer = await modern.loseReply("edit.apply", newRequest);
  await old.stop();
  old = undefined;
  await modern.stop();
  modern = undefined;
  old = await start("recording");
  modern = await start("project");
  assert.deepEqual(await old.call("edit.cut", oldRequest, { transport: "mcp" }), oldAnswer);
  assert.deepEqual(await modern.call("edit.apply", newRequest, { transport: "mcp" }), newAnswer);
  const cutMap = [
    [0, 1000000],
    [2000000, 4000000],
    [5000000, D],
  ];
  let current = await compare("explicit two-range cut/restart", cutMap);
  report.checks.push(
    "Actual swallowed acknowledgement, restart and full cross-transport receipt replay",
  );
  await old.call(
    "edit.cut",
    { ...oldRequest, ranges: [{ startUs: 6000000, endUs: 7000000 }] },
    { error: "REQUEST_CONFLICT" },
  );
  await modern.call(
    "edit.apply",
    {
      ...newRequest,
      operations: [{ ...newRequest.operations[0], ranges: [{ startUs: 6000000, endUs: 7000000 }] }],
    },
    { error: "REQUEST_CONFLICT" },
  );
  await old.call(
    "edit.cut",
    { ...oldRequest, requestId: "23j-stale" },
    { error: "STALE_REVISION", transport: "mcp" },
  );
  await modern.call(
    "edit.apply",
    { ...newRequest, requestId: "23j-stale" },
    { error: "STALE_REVISION", transport: "mcp" },
  );
  await compare("conflict/stale leave state unchanged", cutMap);
  const oldHistory = await old.call("revision.history", { recordingId });
  const newHistory = await modern.call("revision.history", { projectId });
  await old.call(
    "edit.cut",
    {
      recordingId,
      expectedRevisionId: current.a.id,
      requestId: "23j-atomic",
      ranges: [
        { startUs: 6000000, endUs: 7000000 },
        { startUs: 0, endUs: D + 1 },
      ],
    },
    { error: "INVALID_RANGE" },
  );
  const validRemove = removeRequest(current.b, "23j-atomic", [
    { startUs: 6000000, endUs: 7000000 },
  ]);
  await modern.call(
    "edit.apply",
    {
      ...validRemove,
      operations: [
        ...validRemove.operations,
        {
          operation: "processing.set",
          target: {
            kind: "track",
            id: current.b.document.tracks.find((track) => track.kind === "audio").id,
          },
          steps: [{ id: "foreign-step", enabled: true, processor: { type: "gain", gain: 2 } }],
        },
      ],
    },
    { error: "INVALID_EDIT" },
  );
  const rolledBack = await compare("late-invalid mutation rollback", cutMap);
  assert.deepEqual(rolledBack, current);
  assert.deepEqual(await old.call("revision.history", { recordingId }), oldHistory);
  assert.deepEqual(await modern.call("revision.history", { projectId }), newHistory);
  report.checks.push("Changed-argument conflict, stale refusal and complete late-invalid rollback");
  const oldFirst = await old.call("revision.history", { recordingId, limit: 1 });
  const newFirst = await modern.call("revision.history", { projectId, limit: 1 });
  const raceRange = [{ startUs: 10000000, endUs: 11000000 }];
  for (const [service, side, operation, request] of [
    [
      old,
      "recording",
      "edit.cut",
      { recordingId, expectedRevisionId: current.a.id, ranges: raceRange },
    ],
    [modern, "project", "edit.apply", removeRequest(current.b, "unused", raceRange)],
  ]) {
    const result = await Promise.allSettled(
      ["a", "b"].map((suffix) =>
        service.call(operation, { ...request, requestId: "23j-race-" + suffix }),
      ),
    );
    const failures = result.filter((item) => item.status === "rejected");
    assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(failures.length, 1);
    assert.match(failures[0].reason.message, /STALE_REVISION/);
    report.checks.push(side + " competing real CLI writers commit one complete mutation");
  }
  const raceMap = [
    [0, 1000000],
    [2000000, 4000000],
    [5000000, 12000000],
    [13000000, D],
  ];
  current = await compare("concurrent winner", raceMap);
  for (const [service, selector, first, history] of [
    [old, { recordingId }, oldFirst, oldHistory],
    [modern, { projectId }, newFirst, newHistory],
  ]) {
    const revisions = [...first.revisions];
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await service.call(
        "revision.history",
        { ...selector, cursor, limit: 1 },
        { transport: "mcp" },
      );
      revisions.push(...page.revisions);
      cursor = page.nextCursor;
      assert(revisions.length <= 100);
    }
    assert.deepEqual(revisions, history.revisions);
  }
  report.checks.push(
    "History continuation pins all complete pre-race revisions and excludes new commits",
  );
  const oldUndo = await old.call("edit.undo", {
    recordingId,
    requestId: "23j-undo",
    expectedRevisionId: current.a.id,
  });
  const newUndo = await modern.call("edit.undo", {
    projectId,
    requestId: "23j-undo",
    expectedRevisionId: current.b.id,
  });
  assert.notEqual(oldUndo.revision.id, current.a.id);
  assert.notEqual(newUndo.id, current.b.id);
  const undo = await compare("undo concurrent edit", cutMap);
  assert.deepEqual(undo.a.spans, oldAnswer.revision.spans);
  assert.deepEqual(undo.b.document, newAnswer.revision.document);
  const oldRestored = await old.call("edit.restore", {
    recordingId,
    requestId: "23j-restore",
    expectedRevisionId: undo.a.id,
    targetRevisionId: before.a.id,
  });
  const newRestored = await modern.call("edit.restore", {
    projectId,
    requestId: "23j-restore",
    expectedRevisionId: undo.b.id,
    targetRevisionId: before.b.id,
  });
  assert.notEqual(oldRestored.revision.id, before.a.id);
  assert.notEqual(newRestored.id, before.b.id);
  const restored = await compare("restore identity into fresh revision", identity);
  assert.deepEqual(restored.a.spans, before.a.spans);
  assert.deepEqual(restored.b.document, before.b.document);
  const historiesBeforeNoop = [
    await old.call("revision.history", { recordingId }),
    await modern.call("revision.history", { projectId }),
  ];
  const oldNoopRequest = {
    recordingId,
    requestId: "23j-noop",
    expectedRevisionId: restored.a.id,
    range: { startUs: 0, endUs: D },
  };
  const newNoopRequest = {
    projectId,
    requestId: "23j-noop",
    expectedRevisionId: restored.b.id,
    operations: [{ operation: "canvas.set", canvas: { width: 3120 } }],
  };
  const oldNoop = await old.call("edit.trim", oldNoopRequest);
  const newNoop = await modern.call("edit.apply", newNoopRequest);
  assert.equal(oldNoop.revision.id, restored.a.id);
  assert.equal(newNoop.revision.id, restored.b.id);
  assert.deepEqual(await old.call("edit.trim", oldNoopRequest, { transport: "mcp" }), oldNoop);
  assert.deepEqual(await modern.call("edit.apply", newNoopRequest, { transport: "mcp" }), newNoop);
  assert.deepEqual(await old.call("revision.history", { recordingId }), historiesBeforeNoop[0]);
  assert.deepEqual(await modern.call("revision.history", { projectId }), historiesBeforeNoop[1]);
  report.checks.push(
    "Exact undo/restore documents, new revision identities and replay-safe no-op without history",
  );
  assert.deepEqual(await old.call("edit.cut", oldRequest), oldAnswer);
  assert.deepEqual(await modern.call("edit.apply", newRequest), newAnswer);
  await compare("historical replay does not move current head", identity);
  report.passed = true;
} catch (error) {
  failure = error;
  report.failure = { message: error.message, stack: error.stack };
} finally {
  const terminal = await Promise.allSettled([old?.stop(), modern?.stop()]);
  for (const child of live) child.kill("SIGKILL");
  await Promise.all(exits);
  report.native = (await readFile(join(out, "native.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
  report.preservedInputs = {
    oldCatalog: hash(await readFile(oldCatalog)),
    projectCatalog: hash(await readFile(report.inputs.projectCatalog.path)),
    worker: hash(await readFile(worker)),
  };
  try {
    const rejected = terminal.find((result) => result.status === "rejected");
    assert(!rejected, rejected?.reason?.message);
    assert.equal(report.preservedInputs.oldCatalog, report.inputs.oldCatalog.sha256);
    assert.equal(report.preservedInputs.projectCatalog, report.inputs.projectCatalog.sha256);
    assert.equal(report.preservedInputs.worker, report.inputs.worker.sha256);
    assert(report.native.every((entry) => !entry.request || entry.allowed));
    assert.equal(
      report.native.filter((entry) => entry.request).length,
      report.native.filter((entry) => entry.response).length,
    );
    assert(report.native.filter((entry) => entry.response).every((entry) => entry.exit.code === 0));
  } catch (error) {
    failure ??= error;
    report.passed = false;
    report.failure ??= { message: error.message, stack: error.stack };
  } finally {
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  }
}
if (failure) throw failure;
