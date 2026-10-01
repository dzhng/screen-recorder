import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const owner = new URL("./parakeet-readiness-processes.mjs", import.meta.url).href;
async function control(name, serviceSource, cliSource = "process.exit(7);", expectedCode = 1) {
  const base = process.env.SCREENREC_READINESS_CONTROLS_OUT;
  const directory = base ? join(base, name) : await mkdtemp(join(tmpdir(), "readiness-control-"));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "service.mjs"), serviceSource);
  await writeFile(join(directory, "cli.mjs"), cliSource);
  await writeFile(
    join(directory, "observer.mjs"),
    `import {appendFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
process.on('exit',code=>appendFileSync(process.env.SCREENREC_READINESS_CLI_LOG,JSON.stringify({pid:process.pid,code})+'\\n'));
await import(pathToFileURL(process.env.SCREENREC_READINESS_CLI).href);`,
  );
  await writeFile(
    join(directory, "driver.mjs"),
    `import {withReadinessProcesses} from ${JSON.stringify(owner)};import {writeFile} from 'node:fs/promises';
const report={scope:'Synthetic checker failure control; no model or native operations',passed:false,processes:[]};
try { await withReadinessProcesses({report,env:process.env,serviceObserver:${JSON.stringify(join(directory, "service.mjs"))},runtime:${JSON.stringify(directory)},observer:${JSON.stringify(join(directory, "observer.mjs"))},cliLog:${JSON.stringify(join(directory, "mcp-terminal.jsonl"))},childLog:${JSON.stringify(join(directory, "service-children.jsonl"))}},async processes=>{await processes.start();await processes.stop();report.passed=true;},async (name,value)=>writeFile(${JSON.stringify(directory)}+'/'+name,JSON.stringify(value,null,2)+'\\n')); }
catch(error){console.error(error.stack);process.exitCode=1;}`,
  );
  const child = spawn(process.execPath, [join(directory, "driver.mjs")], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5000,
  });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (bytes) => (stdout += bytes));
  child.stderr.on("data", (bytes) => (stderr += bytes));
  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const terminal = { pid: child.pid, exit, stdout, stderr };
  await writeFile(join(directory, "terminal.json"), JSON.stringify(terminal, null, 2) + "\n");
  let report;
  try {
    assert.deepEqual(exit, { code: expectedCode, signal: null }, stderr);
    report = JSON.parse(await readFile(join(directory, "report.json"), "utf8"));
    assert.equal(report.passed, expectedCode === 0);
    const mcpEvents = await readFile(join(directory, "mcp-terminal.jsonl"), "utf8").then(
      (value) => value.trim().split("\n").map(JSON.parse),
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return [];
      },
    );
    return { report, mcpEvents };
  } finally {
    if (!base) await rm(directory, { recursive: true, force: true });
  }
}

test("source exit before ready terminates and saves a failed report", async () => {
  const { report } = await control("exit-before-ready", "process.exit(0);");
  assert.match(report.error.message, /before.*started/);
  assert.deepEqual(report.processes[0].exit, { code: 0, signal: null });
});

test("failed control and nonzero exit preserve the startup error and cleanup failure", async () => {
  const { report } = await control(
    "failed-control",
    "console.log(JSON.stringify({event:'failed',error:'fixture-startup-failure'}));process.exitCode=1;",
  );
  assert.match(report.error.message, /fixture-startup-failure/);
  assert.match(report.cleanupError.message, /code/);
  assert.deepEqual(report.processes[0].exit, { code: 1, signal: null });
});

test("malformed startup stdout saves its parse failure and actual terminal", async () => {
  const { report } = await control(
    "malformed-control",
    "console.log('not-json');process.stdin.resume().on('end',()=>{});",
  );
  assert.match(report.error.message, /Invalid UTF-8 or JSON/);
  assert.equal(report.processes[0].stdout, "not-json\n");
  assert.deepEqual(report.processes[0].exit, { code: 0, signal: null });
});

test("truncated startup stdout settles at EOF and saves its failure", async () => {
  const { report } = await control("truncated-control", "process.stdout.write('{');");
  assert.match(report.error.message, /terminator/);
  assert.deepEqual(report.processes[0].exit, { code: 0, signal: null });
});

const started =
  "console.log(JSON.stringify({event:'started',socketPath:'synthetic-unused.socket'}));process.stdin.resume().on('end',()=>{});";

test("SDK adapter exit during connect is observed before cleanup and report save", async () => {
  const { report, mcpEvents } = await control("adapter-exit", started);
  assert.match(report.error.message, /Connection closed/);
  const adapter = report.processes.find((record) => record.label === "default SDK child close");
  assert.equal(adapter.closeObserved, true);
  assert.deepEqual(mcpEvents, [{ pid: adapter.pid, code: 7 }]);
  assert.deepEqual(report.processes[0].exit, { code: 0, signal: null });
});

const sdkServer = import.meta.resolve("@modelcontextprotocol/sdk/server/index.js");
const sdkTransport = import.meta.resolve("@modelcontextprotocol/sdk/server/stdio.js");
const adapterSource = `import {Server} from ${JSON.stringify(sdkServer)};import {StdioServerTransport} from ${JSON.stringify(sdkTransport)};await new Server({name:'synthetic-startup-control',version:'1'},{capabilities:{}}).connect(new StdioServerTransport());`;

test("ordinary source and default SDK startup still require successful closes", async () => {
  const { report, mcpEvents } = await control("successful-startup", started, adapterSource, 0);
  assert.equal(report.error, undefined);
  assert.equal(report.cleanupError, undefined);
  assert.deepEqual(report.processes[0].exit, { code: 0, signal: null });
  const adapter = report.processes.find((record) => record.label === "default SDK child close");
  assert.equal(adapter.closeObserved, true);
  assert.deepEqual(mcpEvents, [{ pid: adapter.pid, code: 0 }]);
});

test("nonzero source close cannot become a successful verification", async () => {
  const { report, mcpEvents } = await control(
    "nonzero-close",
    started.replace("()=>{}", "()=>{process.exitCode=2;}"),
    adapterSource,
  );
  assert.match(report.error.message, /code/);
  assert.deepEqual(report.processes[0].exit, { code: 2, signal: null });
  assert.equal(mcpEvents[0].code, 0);
});

test("SDK malformed stdout settles initialization without waiting for its request deadline", async () => {
  const { report, mcpEvents } = await control(
    "adapter-malformed",
    started,
    "console.log('not-json');process.stdin.resume().on('end',()=>{});",
  );
  assert.match(report.error.message, /JSON/);
  const adapter = report.processes.find((record) => record.label === "default SDK child close");
  assert.equal(adapter.closeObserved, true);
  assert.deepEqual(mcpEvents, [{ pid: adapter.pid, code: 0 }]);
  assert.deepEqual(report.processes[0].exit, { code: 0, signal: null });
});
