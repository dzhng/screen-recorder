import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, lstat, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { values } = parseArgs({ options: { out: { type: "string" } } });
assert(values.out, "--out must name a new scratch evidence directory");
await mkdir(resolve(values.out), { mode: 0o700 });
const out = await realpath(values.out);
const report = {
  node: process.version,
  scope: "fresh service process and shared consumer discovery",
  exchanges: [],
  processes: [],
  checks: [],
};
const children = [];
const exits = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const priorEntry = await readFile(join(root, "apps/service/src/main.ts"));
const buildScript = await readFile(join(root, "scripts/build-macos.mjs"));
const serviceEntry = join(out, "service.mjs");
const cliEntry = join(out, "cli.mjs");
const installedEntry = join(out, "installed-entry.mjs");
for (const [entry, output] of [
  ["apps/service/dist/project-main.js", serviceEntry],
  ["apps/service/dist/main.js", installedEntry],
  ["apps/cli/dist/main.js", cliEntry],
]) {
  execFileSync(
    "bun",
    [
      "build",
      join(root, entry),
      "--target=node",
      "--outfile",
      output,
      `--metafile=${output}.meta.json`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}
const worker = join(out, "startup-worker.mjs");
await writeFile(
  worker,
  `#!${process.execPath}\nimport { appendFileSync } from 'node:fs';\nlet input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',x=>input+=x); process.stdin.on('end',()=>{const r=JSON.parse(input);appendFileSync(process.env.SCREENREC_BOOT_WORKER_LOG,JSON.stringify(r)+'\\n');const data=r.operation==='media.audioCapabilities'?{}:r.operation==='storage.clearRenderWorkspace'?{removed:true}:r.operation==='packageWorkspace.recover'?{recovered:0}:null;process.stdout.write(JSON.stringify(data===null?{ok:false,error:{code:'UNEXPECTED_NATIVE_CALL',message:r.operation,retryable:false,details:{}}}:{ok:true,data})+'\\n');});\n`,
  { mode: 0o700 },
);
const home = join(out, "home");
await mkdir(home, { mode: 0o700 });
const legacyBytes = Buffer.from("retained old catalog sentinel — never interpreted or migrated\n");
await writeFile(join(home, "library.sqlite"), legacyBytes);
const legacyMedia = join(home, "recordings", "retained", "source.mov");
await mkdir(dirname(legacyMedia), { recursive: true, mode: 0o700 });
await writeFile(legacyMedia, "original source sentinel\n");
const env = {
  ...process.env,
  SCREENREC_HOME: home,
  SCREENREC_APP: join(out, "never-launch.app"),
  SCREENREC_NATIVE: worker,
  SCREENREC_BOOT_WORKER_LOG: join(out, "native-requests.jsonl"),
};
let ordinal = 0;
function start(label, selectedHome = home, entry = serviceEntry) {
  const child = spawn(process.execPath, [entry], {
    cwd: out,
    env: { ...env, SCREENREC_HOME: selectedHome },
    stdio: ["pipe", "pipe", "pipe"],
  });
  children.push(child);
  const record = { label, pid: child.pid, control: [], stderr: "", exit: null };
  report.processes.push(record);
  let buffer = "";
  const waiters = [];
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const end = buffer.indexOf("\n");
      if (end < 0) break;
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      record.control.push(message);
      for (const waiting of waiters.filter(({ predicate }) => predicate(message))) {
        waiters.splice(waiters.indexOf(waiting), 1);
        clearTimeout(waiting.timer);
        waiting.resolve(message);
      }
    }
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => (record.stderr += chunk));
  const exited = new Promise((resolveExit) =>
    child.once("close", (code, signal) => {
      record.exit = { code, signal };
      resolveExit(record.exit);
    }),
  );
  exits.push(exited);
  function take(predicate) {
    const existing = record.control.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolveMessage, reject) => {
      const waiting = {
        predicate,
        resolve: resolveMessage,
        timer: setTimeout(() => {
          waiters.splice(waiters.indexOf(waiting), 1);
          reject(new Error(`No control answer: ${label}`));
        }, 15_000),
      };
      waiters.push(waiting);
    });
  }
  async function call(operation, params = {}) {
    const request = { id: `control-${++ordinal}`, operation, params };
    const answer = take(
      (message) => message.event === "result" && message.response.id === request.id,
    );
    child.stdin.write(JSON.stringify({ event: "request", request }) + "\n");
    const { response } = await answer;
    report.exchanges.push({ transport: "control", request, response });
    return response;
  }
  return { child, record, exited, take, call };
}
async function stopped(service, signal) {
  if (signal) service.child.kill(signal);
  else service.child.stdin.end();
  const timer = setTimeout(() => service.child.kill("SIGKILL"), 15_000);
  const exit = await service.exited;
  clearTimeout(timer);
  assert.deepEqual(exit, signal === "SIGKILL" ? { code: null, signal } : { code: 0, signal: null });
}
async function absent(path) {
  await assert.rejects(lstat(path), { code: "ENOENT" });
}
async function cli(socketPath, operation, params = {}) {
  const args = [
    cliEntry,
    operation,
    ...(socketPath ? ["--socket", socketPath] : []),
    "--params",
    JSON.stringify(params),
    "--id",
    `cli-${++ordinal}`,
  ];
  const stdout = execFileSync(process.execPath, args, {
    env,
    cwd: out,
    encoding: "utf8",
    timeout: 15_000,
  });
  const response = JSON.parse(stdout);
  report.exchanges.push({
    transport: "CLI",
    discovery: socketPath ? "explicit" : "shared",
    operation,
    params,
    response,
  });
  return response;
}
function health(reply, service, socketPath, selectedHome = home) {
  assert.equal(reply.ok, true);
  const { uptimeMs, ...fields } = reply.data;
  assert.deepEqual(fields, {
    status: "ready",
    pid: service.child.pid,
    socketPath,
    home: selectedHome,
    node: process.versions.node,
  });
  assert(Number.isSafeInteger(uptimeMs) && uptimeMs >= 0);
}
try {
  const installedHome = join(out, "installed-home");
  await mkdir(installedHome, { mode: 0o700 });
  const installed = start("matched installed source entry", installedHome, installedEntry);
  const installedReady = await installed.take((message) => message.event === "started");
  assert.equal(installedReady.socketPath, join(installedHome, "run", "service.sock"));
  health(
    await installed.call("service.health"),
    installed,
    installedReady.socketPath,
    installedHome,
  );
  assert.equal(
    (await installed.call("service.health", { extra: true })).error.code,
    "INVALID_PARAMS",
  );
  const compositionConflict = start(
    "project contender against installed source owner",
    installedHome,
  );
  assert.equal(
    (await compositionConflict.take((message) => message.event === "failed")).error.code,
    "SOCKET_IN_USE",
  );
  assert.deepEqual(await compositionConflict.exited, { code: 1, signal: null });
  await absent(join(installedHome, "library", "catalog.sqlite"));
  health(
    await installed.call("service.health"),
    installed,
    installedReady.socketPath,
    installedHome,
  );
  await stopped(installed);
  await absent(installedReady.socketPath);
  const first = start("initial");
  const ready = await first.take((message) => message.event === "started");
  const socketPath = join(home, "run", "service.sock");
  assert.deepEqual(ready, { event: "started", pid: first.child.pid, socketPath });
  health(await first.call("service.health"), first, socketPath);
  health(await cli(socketPath, "service.health"), first, socketPath);
  health(await cli(null, "service.health"), first, socketPath);
  assert.equal((await first.call("service.health", { extra: true })).error.code, "INVALID_PARAMS");
  assert.deepEqual((await cli(socketPath, "project.list")).data, {
    projects: [],
    nextCursor: null,
  });
  const params = {
    requestId: "explicit-project",
    title: "Caller fixture",
    canvas: {
      width: 64,
      height: 32,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  };
  const created = await cli(socketPath, "project.create", params);
  assert.equal(created.ok, true);
  const project = created.data;
  assert.deepEqual(
    (await first.call("project.get", { projectId: project.project.projectId })).data,
    project.project,
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliEntry, "mcp"],
    env,
    stderr: "pipe",
  });
  const mcp = new Client({ name: "service-process-preservation", version: "1" });
  try {
    await mcp.connect(transport);
    for (const [name, args] of [
      ["service.health", {}],
      ["project.get", { projectId: project.project.projectId }],
    ]) {
      const reply = await mcp.callTool({ name, arguments: args });
      report.exchanges.push({ transport: "MCP", operation: name, params: args, response: reply });
      if (name === "service.health") health(reply.structuredContent, first, socketPath);
      else assert.deepEqual(reply.structuredContent.data, project.project);
    }
  } finally {
    await mcp.close();
  }
  const conflict = start("occupied owner");
  const failed = await conflict.take((message) => message.event === "failed");
  assert.equal(failed.error.code, "SOCKET_IN_USE");
  assert.deepEqual(await conflict.exited, { code: 1, signal: null });
  health(await cli(socketPath, "service.health"), first, socketPath);
  report.checks.push("single startup owner and live socket preserved");
  await stopped(first);
  await absent(socketPath);
  const second = start("EOF reopen");
  await second.take((message) => message.event === "started");
  assert.deepEqual((await cli(socketPath, "project.create", params)).data, project);
  await stopped(second, "SIGTERM");
  await absent(socketPath);
  const third = start("signal reopen");
  await third.take((message) => message.event === "started");
  assert.deepEqual(
    (await cli(socketPath, "project.get", { projectId: project.project.projectId })).data,
    project.project,
  );
  await stopped(third, "SIGKILL");
  const fourth = start("crash reopen");
  await fourth.take((message) => message.event === "started");
  assert.deepEqual(
    (await cli(socketPath, "project.get", { projectId: project.project.projectId })).data,
    project.project,
  );
  await stopped(fourth);
  await absent(socketPath);
  report.checks.push("EOF, signal and abrupt-death recovery preserve explicit project/replay");
  const ended = start("EOF before readiness");
  ended.child.stdin.end();
  const endedMessage = await ended.take((message) => ["started", "failed"].includes(message.event));
  assert.equal(endedMessage.event, "failed");
  assert.equal(endedMessage.error.code, "SERVICE_STOPPED");
  assert.deepEqual(await ended.exited, { code: 1, signal: null });
  await absent(socketPath);
  const refusedHome = join(out, "refused-home");
  await mkdir(join(refusedHome, "library"), { recursive: true, mode: 0o755 });
  const refused = start("nonprivate library refusal", refusedHome);
  assert.equal(
    (await refused.take((message) => message.event === "failed")).error.code,
    "SERVICE_UNAVAILABLE",
  );
  assert.deepEqual(await refused.exited, { code: 1, signal: null });
  await absent(join(refusedHome, "library", "catalog.sqlite"));
  assert.deepEqual(await readFile(join(home, "library.sqlite")), legacyBytes);
  assert.equal(await readFile(legacyMedia, "utf8"), "original source sentinel\n");
  assert.deepEqual(await readFile(join(root, "apps/service/src/main.ts")), priorEntry);
  assert.deepEqual(await readFile(join(root, "scripts/build-macos.mjs")), buildScript);
  const nativeRequests = (await readFile(env.SCREENREC_BOOT_WORKER_LOG, "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert(
    nativeRequests.every(({ operation }) =>
      [
        "media.audioCapabilities",
        "storage.clearRenderWorkspace",
        "packageWorkspace.recover",
      ].includes(operation),
    ),
  );
  report.nativeRequests = nativeRequests;
  report.checks.push(
    "old bytes and default composition/bundling preserved; only controlled startup native calls",
  );
  report.artifacts = [];
  for (const path of [serviceEntry, installedEntry, cliEntry, worker]) {
    const bytes = await readFile(path);
    report.artifacts.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  report.preserved = {
    oldCatalog: hash(legacyBytes),
    installedEntry: hash(priorEntry),
    defaultBuild: hash(buildScript),
  };
  report.result = "pass";
} catch (error) {
  report.result = "fail";
  report.error = String(error);
  throw error;
} finally {
  for (const child of children)
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await Promise.all(exits);
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    result: report.result,
    exchanges: report.exchanges.length,
    processes: report.processes.length,
    out,
  }),
);
