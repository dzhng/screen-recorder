import { afterEach, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:net";
import { mkdtemp, mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { serviceRuntimeDirectory, serviceSocketPath } from "@screenrec/protocol";
import { resolveServiceSocket } from "./discovery.js";

/** Where a service of this personal root listens. */
function socketIn(home: string): string {
  return serviceSocketPath(serviceRuntimeDirectory(home));
}

/**
 * LaunchServices coalesces repeated launches of one bundle, so an app that is asked to start
 * twice leaves the same trace as one asked once. Counting launcher runs at the process edge is
 * what shows an attempt ordering exactly one launch, whatever LaunchServices then does with it.
 */
const { launcherRuns, launcherFixture, inspection } = vi.hoisted(() => ({
  launcherRuns: [] as string[][],
  inspection: {
    wait: undefined as Promise<void> | undefined,
    entered: () => {},
    finished: () => {},
  },
  launcherFixture: {
    stall: false,
    child: undefined as import("node:child_process").ChildProcess | undefined,
  },
}));
vi.mock("node:child_process", async (original) => {
  const actual = await original<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (command: string, args: string[], options: Record<string, unknown>) => {
      launcherRuns.push([command, ...args]);
      const child = launcherFixture.stall
        ? actual.spawn(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], options)
        : actual.spawn(command, args, options);
      launcherFixture.child = child;
      return child;
    },
  };
});

vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    stat: async (path: string) => {
      if (inspection.wait) {
        inspection.entered();
        await inspection.wait;
      }
      const result = await actual.stat(path);
      inspection.finished();
      return result;
    },
  };
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  launcherRuns.length = 0;
  inspection.wait = undefined;
  inspection.entered = () => {};
  inspection.finished = () => {};
  launcherFixture.stall = false;
  launcherFixture.child?.kill("SIGKILL");
  launcherFixture.child = undefined;
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function personalHome(): Promise<string> {
  const home = await mkdtemp("/tmp/scr-home-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  return home;
}

/** Counts every connection so a test can show that a path was never even probed. */
async function serve(
  socketPath: string,
  options: { answers?: boolean } = {},
): Promise<{ connections: () => number }> {
  let connections = 0;
  await mkdir(dirname(socketPath), { recursive: true, mode: 0o700 });
  const server: Server = createServer((socket) => {
    connections += 1;
    socket.on("error", () => socket.destroy());
    socket.once("data", (chunk: Buffer) => {
      if (options.answers === false) return;
      const request = JSON.parse(chunk.toString("utf8")) as { id: string };
      socket.end(JSON.stringify({ id: request.id, ok: true, data: { status: "ready" } }) + "\n");
    });
  });
  await new Promise<void>((resolve, reject) =>
    server.once("error", reject).listen(socketPath, resolve),
  );
  cleanup.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return { connections: () => connections };
}

/**
 * A temporary application bundle, launched through the same LaunchServices path the personal
 * app uses. Its executable records the home it was launched with, so a test reads what the
 * launch actually carried rather than what the launcher was asked to carry.
 */
async function appBundle(
  body: string,
): Promise<{ path: string; launches: () => Promise<string[]> }> {
  const directory = await mkdtemp("/tmp/scr-app-");
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "Fixture.app");
  const log = join(directory, "launches.log");
  await mkdir(join(path, "Contents", "MacOS"), { recursive: true });
  await writeFile(
    join(path, "Contents", "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Fixture</string>
<key>CFBundleIdentifier</key><string>dev.screenrec.fixture.${randomUUID()}</string>
<key>CFBundleName</key><string>Fixture</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSUIElement</key><true/>
</dict></plist>
`,
  );
  const executable = join(path, "Contents", "MacOS", "Fixture");
  await writeFile(
    executable,
    `#!${process.execPath}
const { appendFileSync, mkdirSync } = require("node:fs");
const { createServer } = require("node:net");
const { dirname, join } = require("node:path");
const home = process.env.SCREENREC_HOME ?? "";
appendFileSync(${JSON.stringify(log)}, process.pid + " " + home + "\\n");
${body}
setTimeout(() => process.exit(0), 20_000);
`,
  );
  await chmod(executable, 0o755);
  const launches = async () => {
    const recorded = await readFile(log, "utf8").catch(() => "");
    const lines = recorded.split("\n").filter((line) => line.length > 0);
    return lines.map((line) => line.slice(line.indexOf(" ") + 1));
  };
  cleanup.push(async () => {
    const recorded = await readFile(log, "utf8").catch(() => "");
    for (const line of recorded.split("\n").filter(Boolean)) {
      try {
        process.kill(Number(line.split(" ")[0]), "SIGKILL");
      } catch {
        /* The fixture already exited. */
      }
    }
  });
  return { path, launches };
}

/** Launches and stays alive, but binds nothing. */
const NEVER_SERVES = "";

/** Binds the socket of whatever home the launch carried, which is the only home it can serve. */
const SERVES_ITS_HOME = `
const socketPath = join(home, "run", "service.sock");
mkdirSync(dirname(socketPath), { recursive: true, mode: 0o700 });
createServer((socket) => {
  socket.once("data", (chunk) => {
    const request = JSON.parse(chunk.toString("utf8"));
    socket.end(JSON.stringify({ id: request.id, ok: true, data: { status: "ready" } }) + "\\n");
  });
}).listen(socketPath);
`;

it("uses a service that already answers without launching an app", async () => {
  const home = await personalHome();
  const socketPath = socketIn(home);
  const service = await serve(socketPath);
  const app = await appBundle(SERVES_ITS_HOME);
  expect(
    await resolveServiceSocket({ env: { SCREENREC_HOME: home, SCREENREC_APP: app.path } }),
  ).toBe(socketPath);
  expect(await app.launches()).toEqual([]);
  expect(launcherRuns).toEqual([]);
  expect(service.connections()).toBe(1);
});

it("launches the personal app once and reaches the service it opens for that home", async () => {
  const home = await personalHome();
  const app = await appBundle(SERVES_ITS_HOME);
  const socketPath = await resolveServiceSocket({
    env: { SCREENREC_HOME: home, SCREENREC_APP: app.path },
  });
  expect(socketPath).toBe(socketIn(home));
  expect(await app.launches()).toEqual([home]);
  expect(launcherRuns).toHaveLength(1);
  // The app is started to serve this request, so it opens no window of its own.
  expect(launcherRuns[0]).toContain("SCREENREC_SERVICE_LAUNCH=1");
  const again = await resolveServiceSocket({
    env: { SCREENREC_HOME: home, SCREENREC_APP: app.path },
  });
  expect(again).toBe(socketPath);
  expect(await app.launches()).toEqual([home]);
  expect(launcherRuns).toHaveLength(1);
});

it("carries the selected scratch preferences into the app it launches", async () => {
  const home = await personalHome();
  const preferences = join(home, "preferences");
  const receipt = join(home, "preferences-received.json");
  const app = await appBundle(`
require("node:fs").writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({
  preferences: process.env.SCREENREC_DEFAULTS ?? null,
  serviceLaunch: process.env.SCREENREC_SERVICE_LAUNCH,
}));
${SERVES_ITS_HOME}`);
  expect(
    await resolveServiceSocket({
      env: { SCREENREC_HOME: home, SCREENREC_APP: app.path, SCREENREC_DEFAULTS: preferences },
    }),
  ).toBe(socketIn(home));
  expect(JSON.parse(await readFile(receipt, "utf8"))).toEqual({
    preferences,
    serviceLaunch: "1",
  });
});

it.each([
  ["a bundle that is not installed", (app: string) => join(app, "..", "Missing.app")],
  ["a relative override", () => "ScreenRecorder.app"],
])("reports %s as an actionable failure instead of looking elsewhere", async (_case, choose) => {
  const home = await personalHome();
  const app = await appBundle(SERVES_ITS_HOME);
  const SCREENREC_APP = choose(app.path);
  const failure = await resolveServiceSocket({
    env: { SCREENREC_HOME: home, SCREENREC_APP },
  }).catch((error: unknown) => error as { code: string; message: string });
  expect(failure).toMatchObject({
    code: "APP_NOT_FOUND",
    message: expect.stringContaining(SCREENREC_APP),
  });
  expect(launcherRuns).toEqual([]);
  expect(await app.launches()).toEqual([]);
});

it("ends one attempt within the budget when the launched app never serves", async () => {
  const home = await personalHome();
  const app = await appBundle(NEVER_SERVES);
  const started = Date.now();
  const budgetMs = 2_000;
  await expect(
    resolveServiceSocket({ env: { SCREENREC_HOME: home, SCREENREC_APP: app.path }, budgetMs }),
  ).rejects.toMatchObject({ code: "TIMEOUT" });
  const elapsed = Date.now() - started;
  expect(elapsed).toBeGreaterThanOrEqual(budgetMs);
  expect(elapsed).toBeLessThan(budgetMs * 2);
  expect(await app.launches()).toEqual([home]);
  expect(launcherRuns).toHaveLength(1);
});

// Cancel at different times while the actual temporary app never opens its socket.
it.each([100, 1_500])("stops a bootstrap the caller canceled after %i ms", async (cancelMs) => {
  const home = await personalHome();
  const app = await appBundle(NEVER_SERVES);
  const controller = new AbortController();
  const canceling = setTimeout(() => controller.abort(), cancelMs);
  const started = Date.now();
  const failure = await resolveServiceSocket({
    env: { SCREENREC_HOME: home, SCREENREC_APP: app.path },
    signal: controller.signal,
    budgetMs: 10_000,
  }).catch((error: unknown) => error as { code: string; message: string });
  clearTimeout(canceling);
  expect(failure).toMatchObject({
    code: "ABORTED",
    message: expect.stringContaining("no request was sent"),
  });
  expect(Date.now() - started).toBeLessThan(cancelMs + 3_000);
  expect(launcherRuns.length).toBeLessThanOrEqual(1);
});

it("connects to an explicitly selected socket without probing or launching anything", async () => {
  const home = await personalHome();
  const service = await serve(socketIn(home));
  const app = await appBundle(SERVES_ITS_HOME);
  expect(
    await resolveServiceSocket({
      socketPath: "/tmp/chosen-by-the-caller.sock",
      env: { SCREENREC_HOME: home, SCREENREC_APP: app.path },
    }),
  ).toBe("/tmp/chosen-by-the-caller.sock");
  expect(service.connections()).toBe(0);
  expect(launcherRuns).toEqual([]);
  expect(await app.launches()).toEqual([]);
});

it("answers concurrent discoveries from one service without launching an app", async () => {
  const home = await personalHome();
  const socketPath = socketIn(home);
  const service = await serve(socketPath);
  const app = await appBundle(SERVES_ITS_HOME);
  const env = { SCREENREC_HOME: home, SCREENREC_APP: app.path };
  const resolved = await Promise.all(
    Array.from({ length: 5 }, () => resolveServiceSocket({ env })),
  );
  expect(resolved).toEqual(Array.from({ length: 5 }, () => socketPath));
  expect(service.connections()).toBe(5);
  expect(launcherRuns).toEqual([]);
  expect(await app.launches()).toEqual([]);
});

it("cancels during a probe rather than going on to launch an app", async () => {
  const home = await personalHome();
  await serve(socketIn(home), { answers: false });
  const app = await appBundle(SERVES_ITS_HOME);
  const controller = new AbortController();
  const canceling = setTimeout(() => controller.abort(), 200);
  const started = Date.now();
  const failure = await resolveServiceSocket({
    env: { SCREENREC_HOME: home, SCREENREC_APP: app.path },
    signal: controller.signal,
  }).catch((error: unknown) => error as { code: string });
  clearTimeout(canceling);
  expect(failure).toMatchObject({ code: "ABORTED" });
  expect(launcherRuns).toEqual([]);
  expect(Date.now() - started).toBeLessThan(2_000);
});

it("spends the same budget on the initial probe and never launches after expiry", async () => {
  const home = await personalHome();
  await serve(socketIn(home), { answers: false });
  const app = await appBundle(SERVES_ITS_HOME);
  const started = Date.now();
  await expect(
    resolveServiceSocket({ env: { SCREENREC_HOME: home, SCREENREC_APP: app.path }, budgetMs: 100 }),
  ).rejects.toMatchObject({ code: "TIMEOUT" });
  expect(Date.now() - started).toBeLessThan(1_000);
  expect(launcherRuns).toEqual([]);
  expect(await app.launches()).toEqual([]);
});

it("kills a stalled launcher within the shared startup budget", async () => {
  const home = await personalHome();
  const app = await appBundle(NEVER_SERVES);
  launcherFixture.stall = true;
  const started = Date.now();
  await expect(
    resolveServiceSocket({ env: { SCREENREC_HOME: home, SCREENREC_APP: app.path }, budgetMs: 100 }),
  ).rejects.toMatchObject({ code: "TIMEOUT" });
  expect(Date.now() - started).toBeLessThan(1_000);
  const child = launcherFixture.child;
  expect(child).toBeDefined();
  if (!child) throw new Error("Launcher fixture did not start");
  await new Promise<void>((resolve) => child.once("close", () => resolve()));
  expect(child.signalCode).toBe("SIGKILL");
  expect(await app.launches()).toEqual([]);
  expect(launcherRuns).toHaveLength(1);
});

it.each(["cancel", "timeout"])(
  "bounds pending bundle inspection on %s and prevents a late launch",
  async (mode) => {
    const home = await personalHome();
    const app = await appBundle(NEVER_SERVES);
    const gate = deferred();
    const entered = deferred();
    const finished = deferred();
    inspection.wait = gate.promise;
    inspection.entered = entered.resolve;
    inspection.finished = finished.resolve;
    const controller = new AbortController();
    const discovery = resolveServiceSocket({
      env: { SCREENREC_HOME: home, SCREENREC_APP: app.path },
      signal: controller.signal,
      budgetMs: 100,
    });
    await entered.promise;
    if (mode === "cancel") controller.abort();
    await expect(discovery).rejects.toMatchObject({
      code: mode === "cancel" ? "ABORTED" : "TIMEOUT",
    });
    gate.resolve();
    await finished.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(launcherRuns).toEqual([]);
    expect(await app.launches()).toEqual([]);
  },
);

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, resolve: () => release() };
}
