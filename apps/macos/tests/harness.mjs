import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
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

const scratch = [];
const launched = [];
// Nothing this file started may outlive it: every app and every process it owns is signalled and
// waited for before its scratch directory — and the media inside it — is removed.
after(async () => {
  const surviving = [];
  for (const instance of launched) surviving.push(...(await instance.reap()));
  for (const directory of scratch) rmSync(directory, { recursive: true, force: true });
  if (surviving.length)
    throw new Error(`Processes this run owns are still alive: ${surviving.join(", ")}`);
});

export function temporary(prefix) {
  const directory = mkdtempSync(prefix);
  scratch.push(directory);
  return directory;
}

/** Launches the packaged app the way Finder would, and keeps its diagnostics readable. */
export function launch(home, environment = {}) {
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

export async function launchReady(home, environment) {
  const instance = launch(home, environment);
  const [, pid] = await instance.waitFor(/service ready pid=(\d+)/);
  instance.owned.push(Number(pid));
  return { instance, servicePid: Number(pid) };
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

/** Only ever inspects and signals this test's own processes, found by exact parent PID. */
export function childProcessesOf(pid) {
  const listed = execFileSync("/bin/ps", ["-A", "-o", "pid=,ppid=,command="], { encoding: "utf8" });
  return listed
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter((match) => match && Number(match[2]) === pid)
    .map((match) => ({ pid: Number(match[1]), command: match[3] }));
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
