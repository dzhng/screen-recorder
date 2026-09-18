import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

export const app = fileURLToPath(
  new URL("../../../dist/ScreenRecorder.app/Contents/MacOS/ScreenRecorder", import.meta.url),
);

// A Finder launch inherits launchd's minimal environment, not a developer shell's, so
// every process here is started the same way: no repository cwd and no toolchain PATH.
export const finderEnvironment = {
  HOME: process.env.HOME,
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  TMPDIR: process.env.TMPDIR ?? "/tmp",
};

let screenAuthorized;
/** Capture gates use existing screen permission only; preflight reads authorization and never prompts. */
export function requireScreenPermission() {
  screenAuthorized ??=
    JSON.parse(
      spawnSync(app, ["--probe", "preflight"], {
        cwd: "/",
        env: finderEnvironment,
        encoding: "utf8",
        timeout: 20_000,
      }).stdout || "{}",
    ).screen === true;
  assert.equal(
    screenAuthorized,
    true,
    "Screen recording permission is not authorized for this build, so this capture gate cannot run. Grant it in System Settings > Privacy & Security > Screen & System Audio Recording; it is never requested automatically.",
  );
}

const scratch = [];
const launched = [];
// Nothing this file started may outlive it: every app and every process it owns is signalled and
// waited for before its scratch directory — and the media inside it — is removed.
after(async () => {
  const surviving = [];
  try {
    for (const instance of launched) surviving.push(...(await instance.reap()));
  } finally {
    // A take of this person's own screen must go whether or not burying its app went smoothly.
    removeScratch();
  }
  if (surviving.length)
    throw new Error(`Processes this run owns are still alive: ${surviving.join(", ")}`);
});

function removeScratch() {
  while (scratch.length) {
    try {
      rmSync(scratch.pop(), { recursive: true, force: true });
    } catch {
      // Whatever is left of this one, the rest still have to go.
    }
  }
}

/**
 * The same burial, for the ways a run ends without reaching that hook: an interrupt, a script
 * here that is not a test at all, a throw before its own cleanup. Whoever is at this Mac must
 * never be left with a recorder and its fixture window sitting on their screen — or with a take
 * of their own screen in a scratch directory — so this kills and deletes in the same breath,
 * signals and synchronous removals only, nothing a dying process might not get to finish.
 */
function buryLaunched() {
  for (const instance of launched) {
    const owned = new Set(instance.owned);
    if (instance.running) for (const { pid } of instance.children()) owned.add(pid);
    instance.kill("SIGKILL");
    for (const pid of owned) {
      // A PID reused since this run recorded it belongs to somebody else by now.
      if (!runsThisBuild(pid)) continue;
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // It exited between that check and this signal.
      }
    }
  }
  launched.length = 0;
  removeScratch();
}
process.on("exit", buryLaunched);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  // Without a handler these end the process before `exit` runs, taking the apps' only burial with
  // them. Re-raising keeps the exit status a killed process is supposed to have.
  process.on(signal, () => {
    buryLaunched();
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
  });
}

export function temporary(prefix) {
  const directory = mkdtempSync(prefix);
  scratch.push(directory);
  return directory;
}

/**
 * Launches the packaged app the way Finder would, and keeps its diagnostics readable. Its
 * preferences live in a scratch defaults domain beside its home, never this person's own, and
 * the Settings window stays closed unless a check names a domain of its own.
 */
export function launch(home, environment = {}, args = []) {
  const defaults = join(home, "preferences");
  if (!environment.SCREENREC_DEFAULTS) setDefault(defaults, "showSettingsAtLaunch", "-bool", "NO");
  const child = spawn(app, args, {
    cwd: "/",
    env: {
      ...finderEnvironment,
      SCREENREC_HOME: home,
      SCREENREC_DEFAULTS: defaults,
      ...environment,
    },
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
    pid: child.pid,
    /** Every process this launch owns, including ones it has already outlived. */
    owned: [],
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
    /**
     * Ends this app and everything it owns, and waits for all of them, so no test process is still
     * running — or still holding a deleted file open — once the run is over.
     */
    reap: async () => {
      const owned = new Set(instance.owned);
      if (instance.running) for (const { pid } of instance.children()) owned.add(pid);
      instance.kill("SIGKILL");
      await exited;
      const surviving = () => [...owned].filter(runsThisBuild);
      for (const pid of surviving()) {
        try {
          process.kill(pid, "SIGKILL");
        } catch (error) {
          // An owned process can exit between identity verification and signalling.
          if (error.code !== "ESRCH") throw error;
        }
      }
      try {
        await waitFor(() => surviving().length === 0, 5_000);
        return [];
      } catch {
        return surviving();
      }
    },
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

export async function launchReady(home, environment, args) {
  const instance = launch(home, environment, args);
  const [, pid] = await instance.waitFor(/service ready pid=(\d+)/);
  instance.owned.push(Number(pid));
  return { instance, servicePid: Number(pid) };
}

/** Writes one preference into an absolute scratch defaults domain, as the app would store it. */
export function setDefault(domain, key, ...value) {
  execFileSync("/usr/bin/defaults", ["write", domain, key, ...value]);
}

/**
 * Talks to a launch's controls probe through its command directory: one command at a time, each
 * answered in a file of its own once that answer is whole.
 */
export function controlsProbe(directory) {
  let next = 0;
  return async (payload) => {
    const id = (next += 1);
    writeFileSync(join(directory, "command.json"), JSON.stringify({ id, ...payload }));
    const answered = join(directory, `answer-${id}.json`);
    const answer = await waitFor(() => {
      try {
        return JSON.parse(readFileSync(answered, "utf8"));
      } catch {
        return undefined;
      }
    }, 20_000);
    rmSync(answered, { force: true });
    return answer;
  };
}

export async function waitFor(probe, timeoutMs, describe = () => "") {
  const limit = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > limit) throw new Error(`Timed out after ${timeoutMs}ms. ${describe()}`);
    await delay(50);
  }
}

/**
 * Everything this launch is responsible for, found by following parent PIDs all the way down.
 *
 * The app owns a service and the service owns native media workers, so a launch's processes are
 * not only its children: killing the app outright leaves the worker with nobody to stop it, and
 * a worker decoding half an hour of video does not stop on its own.
 */
export function childProcessesOf(pid) {
  const listed = execFileSync("/bin/ps", ["-A", "-o", "pid=,ppid=,command="], { encoding: "utf8" });
  const rows = listed
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), parent: Number(match[2]), command: match[3] }));
  const byParent = new Map();
  for (const row of rows) {
    const siblings = byParent.get(row.parent) ?? [];
    siblings.push(row);
    byParent.set(row.parent, siblings);
  }
  const found = [];
  const seen = new Set([pid]);
  const pending = [pid];
  while (pending.length) {
    for (const row of byParent.get(pending.pop()) ?? []) {
      if (seen.has(row.pid)) continue;
      seen.add(row.pid);
      found.push({ pid: row.pid, command: row.command });
      pending.push(row.pid);
    }
  }
  return found;
}

/** The app bundle every process this harness owns runs out of, app and bundled service alike. */
const bundle = app.slice(0, app.indexOf(".app") + 4);

/**
 * Whether this PID is still one of ours. A PID that has been reused since this run recorded it
 * belongs to somebody else, and nothing here may inspect or signal it.
 */
function runsThisBuild(pid) {
  try {
    return execFileSync("/bin/ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
    }).includes(bundle);
  } catch {
    return false;
  }
}

export function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function socketPath(home) {
  return join(home, "run/service.sock");
}

export function exists(path) {
  try {
    return statSync(path) && true;
  } catch {
    return false;
  }
}
