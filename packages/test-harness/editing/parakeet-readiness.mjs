import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, lstat, mkdir, readFile, readlink, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Models, parakeetModel } from "../../core/dist/models.js";
import { registeredModels } from "../../core/dist/model-registry.js";
import { verifyRuntime } from "../../core/dist/model-files.js";
import { JsonLineStream, CONTROL_FRAME_BYTES } from "../../protocol/dist/index.js";

const { values } = parseArgs({
  options: Object.fromEntries(
    ["out", "home", "model", "runtime", "native", "preservation"].map((key) => [
      key,
      { type: "string" },
    ]),
  ),
});
for (const key of ["out", "home", "model", "runtime", "native", "preservation"])
  assert(values[key], `Missing --${key}`);
const out = resolve(values.out);
await mkdir(out, { mode: 0o700 });
const home = await realpath(values.home);
const source = await realpath(values.model);
const runtime = await realpath(values.runtime);
const native = await realpath(values.native);
const preservation = JSON.parse(await readFile(values.preservation, "utf8"));
const report = {
  scope: "Registered Parakeet public readiness only; no inference, media or quality claim",
  passed: false,
  home,
  source,
  runtime,
  native,
  exchanges: [],
  processes: [],
};
const save = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + "\n");
async function pin(path, expected) {
  const stat = await lstat(path, { bigint: true });
  assert(stat.isFile(), path);
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  const result = { path, bytes: Number(stat.size), sha256: hash.digest("hex") };
  if (expected) {
    assert.equal(result.bytes, expected.bytes, path);
    assert.equal(result.sha256, expected.sha256, path);
  }
  return {
    ...result,
    inode: String(stat.ino),
    dev: String(stat.dev),
    mode: String(stat.mode),
    modifiedNs: String(stat.mtimeNs),
    changedNs: String(stat.ctimeNs),
  };
}
async function runtimePins(path, manifest) {
  const root = await realpath(path);
  await verifyRuntime(root, manifest);
  const entries = [];
  for (const entry of manifest.entries) {
    const selected = join(root, entry.path);
    const stat = await lstat(selected, { bigint: true });
    entries.push({
      path: entry.path,
      inode: String(stat.ino),
      dev: String(stat.dev),
      mode: String(stat.mode),
      bytes: String(stat.size),
      modifiedNs: String(stat.mtimeNs),
      changedNs: String(stat.ctimeNs),
      ...(stat.isSymbolicLink() ? { target: await readlink(selected) } : {}),
    });
  }
  return entries;
}
async function preserved() {
  const voice = registeredModels.find((model) => model.name === "qwen3-tts-icl-v1");
  assert(voice.runtimeArtifact);
  const models = [];
  for (const file of voice.files) models.push(await pin(join(preservation.model, file.path), file));
  const originalRuntime = await runtimePins(preservation.runtime, voice.runtimeArtifact);
  const homes = [];
  for (const selected of preservation.homes) {
    const base = join(selected, "library/models", voice.name, voice.revision);
    const modelFiles = [];
    for (const file of voice.files)
      modelFiles.push(await pin(join(base, voice.folderName, file.path), file));
    homes.push({
      home: selected,
      modelFiles,
      runtime: await runtimePins(join(base, "runtime"), voice.runtimeArtifact),
      receipt: await pin(join(base, "receipt.json")),
    });
  }
  const workers = [];
  for (const path of preservation.workers) {
    try {
      workers.push(await pin(path));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      workers.push({ path, absent: true });
    }
  }
  return { models, originalRuntime, homes, workers };
}
async function run(executable, args, env = process.env, input) {
  const child = spawn(executable, args, { env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (bytes) => (stdout += bytes));
  child.stderr.on("data", (bytes) => (stderr += bytes));
  const terminal = new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolveExit({ code, signal }));
  });
  child.stdin.end(input);
  const exit = await terminal;
  const result = { executable, args, pid: child.pid, stdout, stderr, exit };
  report.processes.push(result);
  assert.deepEqual(exit, { code: 0, signal: null }, stderr || stdout);
  return result;
}
const nativeLog = join(out, "native.jsonl");
const fence = join(out, "startup-worker.mjs");
await writeFile(
  fence,
  `#!${process.execPath}
import {spawn} from 'node:child_process';import {appendFileSync} from 'node:fs';
const log=value=>appendFileSync(process.env.SCREENREC_READINESS_NATIVE_LOG,JSON.stringify(value)+'\\n');let input='';
process.stdin.setEncoding('utf8').on('data',value=>input+=value);process.stdin.on('end',()=>{
const request=JSON.parse(input);log({event:'request',request});
if(request.operation!=='media.audioCapabilities'||Object.keys(request.params).length){log({event:'refused',request});process.stdout.write(JSON.stringify({id:request.id,ok:false,error:{code:'UNEXPECTED_NATIVE_CALL',message:request.operation,retryable:false,details:{}}})+'\\n');return;}
const child=spawn(process.env.SCREENREC_READINESS_NATIVE,[],{stdio:['pipe','pipe','pipe']});log({event:'forwarded',pid:child.pid});
let stdout='',stderr='';child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);
child.on('close',(code,signal)=>{log({event:'close',pid:child.pid,code,signal,stdout,stderr});process.stdout.write(stdout);process.stderr.write(stderr);process.exitCode=code??1;});child.stdin.end(input);
});
`,
);
await chmod(fence, 0o700);
const env = {
  ...process.env,
  SCREENREC_HOME: home,
  SCREENREC_NATIVE: fence,
  SCREENREC_READINESS_NATIVE: native,
  SCREENREC_READINESS_NATIVE_LOG: nativeLog,
};
const observer = join(out, "cli-observer.mjs");
await writeFile(
  observer,
  `import {appendFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
process.on('exit',code=>appendFileSync(process.env.SCREENREC_READINESS_CLI_LOG,JSON.stringify({event:'node-exit',pid:process.pid,code})+'\\n'));
await import(pathToFileURL(process.env.SCREENREC_READINESS_CLI).href);
`,
);
const cliLog = join(out, "mcp-terminal.jsonl");
const childLog = join(out, "service-children.jsonl");
const serviceObserver = join(out, "service-observer.mjs");
await writeFile(
  serviceObserver,
  `import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {appendFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const spawn=childProcess.spawn;childProcess.spawn=(...args)=>{const child=spawn(...args);child.once('close',(code,signal)=>appendFileSync(process.env.SCREENREC_READINESS_CHILD_LOG,JSON.stringify({event:'close',pid:child.pid,executable:args[0],args:args[1],code,signal})+'\\n'));return child;};syncBuiltinESMExports();
await import(pathToFileURL(process.env.SCREENREC_READINESS_SERVICE).href);
`,
);
let service, client, transport, mcpClosed;
async function start() {
  const child = spawn(process.execPath, [serviceObserver], {
    env: {
      ...env,
      SCREENREC_READINESS_SERVICE: join(runtime, "service.mjs"),
      SCREENREC_READINESS_CHILD_LOG: childLog,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const record = { label: "source service", pid: child.pid, control: [], stderr: "", exit: null };
  report.processes.push(record);
  const terminal = new Promise((resolveExit) =>
    child.once("close", (code, signal) => {
      record.exit = { code, signal };
      resolveExit(record.exit);
    }),
  );
  const stream = new JsonLineStream(CONTROL_FRAME_BYTES);
  let resolveReady, rejectReady;
  const ready = new Promise((resolveValue, reject) => {
    resolveReady = resolveValue;
    rejectReady = reject;
  });
  child.once("error", rejectReady);
  child.stderr.on("data", (bytes) => (record.stderr += bytes));
  child.stdout.on("data", (bytes) => {
    for (const frame of stream.push(bytes)) {
      assert(frame.ok);
      record.control.push(frame.value);
      if (frame.value.event === "started") resolveReady(frame.value);
      if (frame.value.event === "failed") rejectReady(new Error(JSON.stringify(frame.value)));
    }
  });
  service = { child, terminal, record };
  const started = await ready;
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [observer, "mcp", "--socket", started.socketPath],
    env: {
      ...env,
      SCREENREC_READINESS_CLI: join(runtime, "cli.mjs"),
      SCREENREC_READINESS_CLI_LOG: cliLog,
    },
    stderr: "pipe",
  });
  client = new Client({ name: "parakeet-readiness", version: "1" });
  await client.connect(transport);
  const pid = transport.pid;
  mcpClosed = new Promise((resolveClose) => {
    const previous = transport.onclose;
    transport.onclose = () => {
      previous?.();
      resolveClose(pid);
    };
  });
  return started.socketPath;
}
async function stop() {
  if (client) {
    await client.close();
    const pid = await mcpClosed;
    report.processes.push({ label: "default SDK child close", pid, closeObserved: true });
    client = undefined;
  }
  if (service) {
    service.child.stdin.end();
    const exit = await service.terminal;
    assert.deepEqual(exit, { code: 0, signal: null }, service.record.stderr);
    service = undefined;
  }
}
async function call(socket, operation, params = {}, mcp = false) {
  const request = { id: randomUUID(), operation, params };
  let response;
  if (mcp) {
    const reply = await client.callTool({ name: operation, arguments: params });
    response = reply.structuredContent;
    assert.deepEqual(reply.content, [{ type: "text", text: JSON.stringify(response) }]);
    assert.equal(reply.isError, false);
    report.exchanges.push({ transport: "default SDK MCP", operation, params, reply });
  } else {
    const args = [
      join(runtime, "cli.mjs"),
      operation,
      "--socket",
      socket,
      "--params",
      JSON.stringify(params),
      "--id",
      request.id,
    ];
    const result = await run(process.execPath, args, env);
    response = JSON.parse(result.stdout);
    assert.equal(response.id, request.id);
    report.exchanges.push({ transport: "CLI", request, response });
  }
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.data;
}
try {
  const before = await preserved();
  await save("preservation-before.json", before);
  const preservationDigest = (value) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  report.before = { path: "preservation-before.json", sha256: preservationDigest(before) };
  report.sourceFiles = [];
  for (const file of parakeetModel.files)
    report.sourceFiles.push(await pin(join(source, file.path), file));
  const card = await readFile(join(source, "README.md"), "utf8");
  assert(card.includes("cc-by-4.0"), "Registered model card must retain its license notice");
  report.modelCard = card;
  const socket = await start();
  const discovery = await call(socket, "model.list");
  assert.deepEqual(await call(socket, "model.list", {}, true), discovery);
  const declared = discovery.find((model) => model.modelId === "parakeet");
  assert.equal(declared.purpose, "transcription");
  assert.deepEqual(declared.pins, {
    ...parakeetModel.engine,
    model: parakeetModel.repo,
    modelRevision: parakeetModel.revision,
  });
  assert.deepEqual(await call(socket, "model.status", { modelId: "parakeet" }), {
    state: "absent",
  });
  const params = { modelId: "parakeet", modelSource: source };
  const responses = await Promise.all([
    call(socket, "model.prepare", params, true),
    call(socket, "model.prepare", params),
  ]);
  assert(responses.some((status) => status.state === "preparing"));
  let received = 0;
  const deadline = performance.now() + 180000;
  for (;;) {
    const status = await call(socket, "model.status", { modelId: "parakeet" }, true);
    if (status.state === "ready") break;
    assert.equal(status.state, "preparing", JSON.stringify(status));
    assert.equal(status.totalBytes, declared.preparation.modelBytes);
    assert(status.receivedBytes >= received);
    received = status.receivedBytes;
    assert(performance.now() < deadline, "Existing readiness fixture budget exhausted");
    await delay(100);
  }
  assert.deepEqual(await call(socket, "model.prepare", params), { state: "ready" });
  await stop();
  const reopened = await start();
  assert.deepEqual(await call(reopened, "model.status", { modelId: "parakeet" }), {
    state: "ready",
  });
  assert.deepEqual(await call(reopened, "model.status", { modelId: "parakeet" }, true), {
    state: "ready",
  });
  await stop();
  const models = new Models(join(home, "library"));
  assert.deepEqual(await models.status("parakeet"), { state: "ready" });
  report.nativeRequest = await models.transcription("parakeet").nativeRequest();
  await models.settled();
  assert.deepEqual(report.nativeRequest.files, parakeetModel.files);
  assert.equal(
    report.nativeRequest.directory,
    join(home, "library/models/parakeet", parakeetModel.revision, parakeetModel.folderName),
  );
  report.managedFiles = [];
  for (const file of report.nativeRequest.files)
    report.managedFiles.push(await pin(join(report.nativeRequest.directory, file.path), file));
  const receiptPath = join(report.nativeRequest.directory, "../receipt.json");
  report.receipt = await pin(receiptPath);
  const receiptBytes = await readFile(receiptPath);
  await writeFile(join(out, "prepared-receipt.json"), receiptBytes);
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.modelDigest, declared.modelDigest);
  for (const file of report.managedFiles) {
    const key = file.path.slice(report.nativeRequest.directory.length + 1);
    assert.deepEqual(receipt.files[key], { modifiedNs: file.modifiedNs, inode: file.inode });
  }
  report.afterSourceFiles = [];
  for (const file of parakeetModel.files)
    report.afterSourceFiles.push(await pin(join(source, file.path), file));
  assert.deepEqual(report.afterSourceFiles, report.sourceFiles);
  const after = await preserved();
  assert.deepEqual(after, before);
  report.after = { sha256: preservationDigest(after), equalBefore: true };
  const nativeEvents = (await readFile(nativeLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(nativeEvents.filter((event) => event.event === "request").length, 2);
  assert(nativeEvents.every((event) => event.event !== "refused"));
  assert.deepEqual(
    nativeEvents
      .filter((event) => event.event === "close")
      .map(({ code, signal }) => ({ code, signal })),
    [
      { code: 0, signal: null },
      { code: 0, signal: null },
    ],
  );
  report.nativeEvents = nativeEvents;
  report.serviceChildEvents = (await readFile(childLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(report.serviceChildEvents.length, 2);
  assert(report.serviceChildEvents.every((event) => event.executable === fence));
  report.mcpTerminalEvents = (await readFile(cliLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(report.mcpTerminalEvents.length, 2);
  assert(report.mcpTerminalEvents.every((event) => event.code === 0));
  report.passed = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  await stop();
  await save("report.json", report);
  console.log(JSON.stringify({ passed: report.passed, out, error: report.error?.message }));
}
