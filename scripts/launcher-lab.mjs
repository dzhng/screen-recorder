import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const source = dirname(fileURLToPath(import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "screenrec-launcher-lab-"));
const children = new Set();
let cleanupPromise;
let stopping = false;
function cleanup() {
  stopping = true;
  return (cleanupPromise ??= (async () => {
    await Promise.all(
      [...children].map(
        (child) =>
          new Promise((resolve) => {
            child.once("close", resolve);
            child.kill("SIGKILL");
          }),
      ),
    );
    rmSync(scratch, { recursive: true, force: true });
  })());
}
// Own the deadline and signal teardown; an outer test timeout must not orphan
// Node with a live lock or retain copied app bundles.
const deadline = setTimeout(() => void cleanup().then(() => process.exit(124)), 20000);
process.once("SIGTERM", () => void cleanup().then(() => process.exit(143)));
process.once("SIGINT", () => void cleanup().then(() => process.exit(130)));
function start(command, args, options = {}) {
  if (stopping) throw new Error("Launcher lab is stopping");
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], ...options });
  children.add(child);
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (bytes) => {
    stdout += bytes;
  });
  child.stderr.on("data", (bytes) => {
    stderr += bytes;
  });
  const closed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (status) => {
      children.delete(child);
      resolve({ status, stdout, stderr });
    });
  });
  return { child, closed };
}
async function run(command, args) {
  const { child, closed } = start(command, args);
  const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    const result = await closed;
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
function bundle(folder, generation) {
  const resources = join(folder, "Contents/Resources");
  mkdirSync(join(resources, "node/bin"), { recursive: true });
  mkdirSync(join(resources, "cli"));
  copyFileSync(process.execPath, join(resources, "node/bin/node"));
  writeFileSync(join(resources, "generation"), generation);
  writeFileSync(
    join(resources, "cli/main.mjs"),
    `
import { readFile, writeFile, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const loaded = ${JSON.stringify(generation)};
await writeFile(process.env.SCREENREC_LAB_READY, JSON.stringify({loaded, fd: process.env.SCREENREC_LAB_LOCK_FD}));
for (;;) { try { await stat(process.env.SCREENREC_LAB_GO); break; } catch {} await delay(5); }
const resource = await readFile(process.env.SCREENREC_APP + '/Contents/Resources/generation', 'utf8');
process.stdout.write(JSON.stringify({loaded,resource}) + '\\n');
`,
  );
}
async function until(file, closed) {
  let terminalError;
  closed.then(
    (result) => {
      terminalError = new Error(result.stderr || "Child exited before barrier");
    },
    (error) => {
      terminalError = error;
    },
  );
  for (let n = 0; n < 1000; n++) {
    if (terminalError) throw terminalError;
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {}
    await delay(5);
  }
  throw new Error("Timed out at barrier " + file);
}
async function launch(command, args, app, name, extraEnv = {}) {
  if (stopping) throw new Error("Launcher lab is stopping");
  const ready = join(scratch, name + ".ready");
  const go = join(scratch, name + ".go");
  const { child, closed } = start(command, args, {
    env: {
      ...process.env,
      SCREENREC_APP: app,
      SCREENREC_LAB_READY: ready,
      SCREENREC_LAB_GO: go,
      ...extraEnv,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  await until(ready, closed);
  return { child, ready, go, closed };
}
try {
  const helper = join(scratch, "lock-exec");
  await run("clang", [
    "-Wall",
    "-Wextra",
    "-Werror",
    join(source, "launcher-lab/lock-exec.c"),
    "-o",
    helper,
  ]);
  const launcher = join(scratch, "screenrec");
  writeFileSync(launcher, readFileSync(join(source, "launcher-lab/shell-launcher.sh")), {
    mode: 0o755,
  });
  const app = join(scratch, "Relocated with spaces/Screen Recorder.app");
  const staged = join(scratch, "B.app");
  const previous = join(scratch, "A.app");
  bundle(app, "A");
  bundle(staged, "B");
  const legacy = await launch(launcher, ["--help"], app, "legacy");
  renameSync(app, previous);
  renameSync(staged, app);
  if (process.argv.includes("--hold")) {
    console.error(JSON.stringify({ barrier: "legacy-read", scratch, pid: legacy.child.pid }));
  } else writeFileSync(legacy.go, "go");
  const legacyResult = await legacy.closed;
  if (legacyResult.status !== 0) throw new Error(legacyResult.stderr);
  rmSync(app, { recursive: true });
  renameSync(previous, app);
  bundle(staged, "B");
  const lock = app + ".update.lock";
  const args = [
    app + "/Contents/Resources/node/bin/node",
    app + "/Contents/Resources/cli/main.mjs",
  ];
  const protectedLaunch = await launch(helper, ["shared", lock, ...args, "mcp"], app, "protected");
  const swap = spawnSync(helper, ["exclusive", lock, "/usr/bin/true"], { encoding: "utf8" });
  if (swap.status === 0) {
    renameSync(app, previous);
    renameSync(staged, app);
  }
  writeFileSync(protectedLaunch.go, "go");
  const protectedResult = await protectedLaunch.closed;
  if (protectedResult.status !== 0) throw new Error(protectedResult.stderr);
  const afterExit = spawnSync(helper, ["exclusive", lock, "/usr/bin/true"], { encoding: "utf8" });
  if (afterExit.status === 0 && swap.status !== 0) {
    renameSync(app, previous);
    renameSync(staged, app);
  }
  const newLaunch = await launch(helper, ["shared", lock, ...args, "--help"], app, "new");
  writeFileSync(newLaunch.go, "go");
  const newResult = await newLaunch.closed;
  if (newResult.status !== 0) throw new Error(newResult.stderr);
  let actual = {};
  if (process.argv.includes("--actual-cli")) {
    const cliFile = app + "/Contents/Resources/cli/main.mjs";
    await run("bun", [join(source, "launcher-lab/build-cli.mjs"), dirname(source), cliFile]);
    const sha256 = createHash("sha256").update(readFileSync(cliFile)).digest("hex");
    const preload = join(scratch, "barrier.cjs");
    writeFileSync(
      preload,
      `
const fs=require('node:fs');
fs.writeFileSync(process.env.SCREENREC_LAB_READY,JSON.stringify({node:process.version}));
while(!fs.existsSync(process.env.SCREENREC_LAB_GO)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);
`,
    );
    const actualHelp = await launch(
      helper,
      ["shared", lock, ...args, "--help"],
      app,
      "actual-help",
      {
        NODE_OPTIONS: "--require " + preload,
      },
    );
    const helpSwap = spawnSync(helper, ["exclusive", lock, "/usr/bin/true"]);
    writeFileSync(actualHelp.go, "go");
    const helpResult = await actualHelp.closed;
    if (helpResult.status !== 0) throw new Error(helpResult.stderr);
    const actualMcp = await launch(helper, ["shared", lock, ...args, "mcp"], app, "actual-mcp", {
      NODE_OPTIONS: "--require " + preload,
    });
    writeFileSync(actualMcp.go, "go");
    let messages = "";
    const toolList = new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("MCP tools/list timed out")), 5000);
      actualMcp.child.stdin.once("error", reject);
      actualMcp.child.stdout.on("data", (bytes) => {
        messages += bytes.toString();
        for (const line of messages.split("\n")) {
          let message;
          try {
            message = JSON.parse(line);
          } catch {
            continue;
          }
          if (message?.id === 2) {
            clearTimeout(deadline);
            if (
              !Array.isArray(message.result?.tools) ||
              !message.result.tools.every((tool) => tool && typeof tool.name === "string")
            ) {
              reject(new Error("Invalid MCP tools/list response: " + line));
            } else resolve(message.result.tools.map((t) => t.name));
          }
        }
      });
    });
    actualMcp.child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "launcher-proof", version: "1" },
        },
      }) + "\n",
    );
    actualMcp.child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
    );
    actualMcp.child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n",
    );
    const tools = await toolList;
    const mcpSwap = spawnSync(helper, ["exclusive", lock, "/usr/bin/true"]);
    actualMcp.child.kill("SIGKILL");
    await actualMcp.closed;
    const afterCrash = spawnSync(helper, ["exclusive", lock, "/usr/bin/true"]);
    const holder = await launch(
      helper,
      ["exclusive", lock, process.execPath, "--require", preload, "-e", "setInterval(()=>{},1000)"],
      app,
      "exclusive",
    );
    const denied = spawnSync(helper, ["shared", lock, ...args, "--help"]);
    holder.child.kill("SIGKILL");
    await holder.closed;
    const released = spawnSync(helper, ["shared", lock, "/usr/bin/true"]);
    actual = {
      actualHelp: {
        sha256,
        phase: "node-preload-before-cli",
        swapStatus: helpSwap.status,
        operations: JSON.parse(helpResult.stdout).operations.map((o) => o.name),
      },
      actualMcp: { swapStatus: mcpSwap.status, tools, afterCrashStatus: afterCrash.status },
      exclusiveOwner: { launchStatus: denied.status, afterCrashStatus: released.status },
    };
  }
  console.log(
    JSON.stringify({
      provenance: {
        sourceRevision: (
          await run("git", ["-C", dirname(source), "rev-parse", "HEAD"])
        ).stdout.trim(),
        runnerSha256: createHash("sha256")
          .update(readFileSync(fileURLToPath(import.meta.url)))
          .digest("hex"),
        shellLauncherSha256: createHash("sha256")
          .update(readFileSync(join(source, "launcher-lab/shell-launcher.sh")))
          .digest("hex"),
        helperSha256: createHash("sha256")
          .update(readFileSync(join(source, "launcher-lab/lock-exec.c")))
          .digest("hex"),
        cliBuildSha256: createHash("sha256")
          .update(readFileSync(join(source, "launcher-lab/build-cli.mjs")))
          .digest("hex"),
        nodeSha256: createHash("sha256").update(readFileSync(process.execPath)).digest("hex"),
      },
      platform: {
        os: process.platform,
        architecture: process.arch,
        node: process.version,
        macOS: (await run("sw_vers", ["-productVersion"])).stdout.trim(),
        osBuild: (await run("sw_vers", ["-buildVersion"])).stdout.trim(),
        bun: (await run("bun", ["--version"])).stdout.trim(),
      },
      ...actual,
      legacy: JSON.parse(legacyResult.stdout),
      protected: { swapStatus: swap.status, ...JSON.parse(protectedResult.stdout) },
      afterExit: { swapStatus: afterExit.status, ...JSON.parse(newResult.stdout) },
    }),
  );
} finally {
  clearTimeout(deadline);
  await cleanup();
}
