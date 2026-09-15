import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { callLocal } from "@screenrec/client";

const app = fileURLToPath(
  new URL("../../../dist/ScreenRecorder.app/Contents/MacOS/ScreenRecorder", import.meta.url),
);
// A Finder launch inherits launchd's minimal environment, not a developer shell's, so
// every process here is started the same way: no repository cwd and no toolchain PATH.
const finderEnvironment = {
  HOME: process.env.HOME,
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  TMPDIR: process.env.TMPDIR ?? "/tmp",
};

const scratch = [];
const launched = [];
after(() => {
  for (const instance of launched) instance.kill("SIGKILL");
  for (const directory of scratch) rmSync(directory, { recursive: true, force: true });
});

function temporary(prefix) {
  const directory = mkdtempSync(prefix);
  scratch.push(directory);
  return directory;
}

function launch(home, environment = {}) {
  const child = spawn(app, [], {
    cwd: "/",
    env: { ...finderEnvironment, SCREENREC_HOME: home, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (diagnostics += chunk));
  child.stderr.on("data", (chunk) => (diagnostics += chunk));
  const exited = new Promise((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const instance = {
    exited,
    get diagnostics() {
      return diagnostics;
    },
    get running() {
      return child.exitCode === null && child.signalCode === null;
    },
    kill: (signal) => {
      if (instance.running) child.kill(signal);
    },
    children: () => childProcessesOf(child.pid),
    waitFor: (pattern, timeoutMs = 20_000) =>
      waitFor(
        () => diagnostics.match(pattern),
        timeoutMs,
        () => diagnostics,
      ),
  };
  launched.push(instance);
  return instance;
}

async function waitFor(probe, timeoutMs, describe = () => "") {
  const limit = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > limit) throw new Error(`Timed out after ${timeoutMs}ms. ${describe()}`);
    await delay(50);
  }
}

/** Only ever inspects and signals this test's own processes, found by exact parent PID. */
function childProcessesOf(pid) {
  const listed = execFileSync("/bin/ps", ["-A", "-o", "pid=,ppid=,command="], { encoding: "utf8" });
  return listed
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter((match) => match && Number(match[2]) === pid)
    .map((match) => ({ pid: Number(match[1]), command: match[3] }));
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function socketPath(home) {
  return join(home, "run/service.sock");
}

function exists(path) {
  try {
    return statSync(path) && true;
  } catch {
    return false;
  }
}

async function launchReady(home, environment) {
  const instance = launch(home, environment);
  const [, pid] = await instance.waitFor(/service ready pid=(\d+)/);
  return { instance, servicePid: Number(pid) };
}

function health(home, id) {
  return callLocal(socketPath(home), { id, operation: "service.health", params: {} });
}

/** Writes a stand-in interpreter that passes the version gate and then misbehaves. */
function fakeNode(body) {
  const path = join(temporary("/tmp/scr-fake-node-"), "node");
  writeFileSync(
    path,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "v24.14.0"; exit 0; fi\n${body}\n`,
  );
  chmodSync(path, 0o755);
  return path;
}

test("ordinary launch owns one service child and answers health without starting capture", async () => {
  const home = temporary("/tmp/scr-app-");
  const { instance, servicePid } = await launchReady(home);
  await instance.waitFor(/service health status=ready/);

  const children = instance.children();
  assert.equal(
    children.length,
    1,
    `Expected exactly one service child, saw ${JSON.stringify(children)}`,
  );
  assert.equal(children[0].pid, servicePid);
  assert.match(children[0].command, /Contents\/Resources\/service\/main\.mjs$/);

  assert.equal(statSync(join(home, "run")).mode & 0o777, 0o700);
  assert.equal(statSync(socketPath(home)).mode & 0o777, 0o600);
  const answer = await health(home, "app-health-1");
  assert.deepEqual(Object.keys(answer.data).sort(), [
    "home",
    "node",
    "pid",
    "socketPath",
    "status",
    "uptimeMs",
  ]);
  assert.equal(answer.data.pid, servicePid);
  // Idle lifetime only: no capture ran, so the personal root holds nothing but the socket.
  assert.deepEqual(readdirSync(home), ["run"]);
  assert.doesNotMatch(instance.diagnostics, /capture|permission/i);
});

test("a native probe run owns no service and leaves the personal root untouched", async () => {
  const home = temporary("/tmp/scr-app-");
  const probe = spawnSync(app, ["--capture-preflight"], {
    cwd: "/",
    env: { ...finderEnvironment, SCREENREC_HOME: home },
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(Object.keys(JSON.parse(probe.stdout)).sort(), ["microphone", "screen"]);
  assert.deepEqual(readdirSync(home), []);
});

test("normal quit stops the service and removes its socket within the deadline", async () => {
  const home = temporary("/tmp/scr-app-");
  const { instance, servicePid } = await launchReady(home);
  instance.kill("SIGTERM");
  assert.deepEqual(await instance.exited, { code: 0, signal: null });
  assert.equal(alive(servicePid), false);
  assert.equal(exists(socketPath(home)), false);
});

test("abrupt app death closes the service through control-pipe EOF", async () => {
  const home = temporary("/tmp/scr-app-");
  const { instance, servicePid } = await launchReady(home);
  instance.kill("SIGKILL");
  await instance.exited;
  await waitFor(
    () => !alive(servicePid),
    10_000,
    () => `Service ${servicePid} outlived its app`,
  );
  await waitFor(
    () => !exists(socketPath(home)),
    5_000,
    () => "Service left its socket behind",
  );
});

test("a killed service is reported once, never restarted, and its path is reclaimed on relaunch", async () => {
  const home = temporary("/tmp/scr-app-");
  const first = await launchReady(home);
  process.kill(first.servicePid, "SIGKILL");
  await first.instance.waitFor(/service failed code=SERVICE_STOPPED/);
  await delay(1_500);
  assert.equal(first.instance.running, true, "The app must survive its service");
  assert.deepEqual(first.instance.children(), [], "A dead service must not be restarted");
  // A killed listener cannot unlink its own path; the leftover is what relaunch reclaims.
  assert.equal(statSync(socketPath(home)).isSocket(), true);

  first.instance.kill("SIGTERM");
  await first.instance.exited;
  const second = await launchReady(home);
  assert.equal((await health(home, "after-reclaim")).data.pid, second.servicePid);
});

test("a second owner reports the conflict and leaves the live socket and its owner alone", async () => {
  const home = temporary("/tmp/scr-app-");
  const owner = await launchReady(home);
  const before = statSync(socketPath(home));

  const intruder = launch(home);
  const [, code] = await intruder.waitFor(/service failed code=(\w+)/);
  assert.equal(code, "SOCKET_IN_USE");
  assert.equal(intruder.running, true, "A failed start must stay visible, not exit silently");
  assert.deepEqual(intruder.children(), [], "The refused service must not linger");

  assert.equal(statSync(socketPath(home)).ino, before.ino, "The live socket was replaced");
  assert.equal(alive(owner.servicePid), true);
  assert.equal((await health(home, "owner-still-serving")).data.pid, owner.servicePid);
});

test("a missing interpreter is a reported startup failure, not a hidden retry", async () => {
  const home = temporary("/tmp/scr-app-");
  const instance = launch(home, { SCREENREC_NODE: "/nonexistent/node" });
  const [line] = await instance.waitFor(/service failed code=NODE_UNAVAILABLE message=(.*)/);
  assert.match(line, /SCREENREC_NODE/);
  await delay(1_000);
  assert.equal(instance.running, true);
  assert.deepEqual(instance.children(), []);
  assert.equal(exists(socketPath(home)), false);
});

test("unreadable control output fails the start and terminates that child", async () => {
  const home = temporary("/tmp/scr-app-");
  const instance = launch(home, {
    SCREENREC_NODE: fakeNode("echo 'not a control message'\nexec sleep 60"),
  });
  await instance.waitFor(/service failed code=CONTROL_PROTOCOL/);
  await waitFor(
    () => instance.children().length === 0,
    5_000,
    () => "The faulty child was left running",
  );
});

test("oversized control output fails the start", async () => {
  const home = temporary("/tmp/scr-app-");
  const oversized = "/usr/bin/head -c 70000 /dev/zero | /usr/bin/tr '\\0' 'x'\necho\nexec sleep 60";
  const instance = launch(home, { SCREENREC_NODE: fakeNode(oversized) });
  await instance.waitFor(/service failed code=CONTROL_LIMIT_EXCEEDED/);
  await waitFor(
    () => instance.children().length === 0,
    5_000,
    () => "The faulty child was left running",
  );
});

test("a silent service fails on the startup budget instead of waiting forever", async () => {
  const home = temporary("/tmp/scr-app-");
  const started = Date.now();
  const instance = launch(home, { SCREENREC_NODE: fakeNode("exec sleep 60") });
  await instance.waitFor(/service failed code=SERVICE_TIMEOUT/, 25_000);
  assert.ok(Date.now() - started >= 10_000, "The startup budget must not be cut short");
  await waitFor(
    () => instance.children().length === 0,
    5_000,
    () => "The silent child was left running",
  );
  assert.equal(instance.running, true);
});
