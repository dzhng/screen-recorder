import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receipt = JSON.parse(readFileSync(join(root, "dist/release/release.json")));
const scratch = mkdtempSync("/tmp/screenrec-release-");
let child, exited, cleanupError, spawnError;
try {
  const moved = join(scratch, "Relocated release");
  execFileSync("ditto", [
    "-x",
    "-k",
    join(root, `dist/release/ScreenRecorder-${receipt.tag}-macos-arm64.zip`),
    moved,
  ]);
  const app = join(moved, "Screen Recorder.app");
  execFileSync("codesign", ["--verify", "--deep", "--strict", app]);
  const env = {
    HOME: scratch,
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    TMPDIR: tmpdir(),
    SCREENREC_HOME: join(scratch, "home"),
    SCREENREC_DEFAULTS: join(scratch, "preferences"),
    SCREENREC_APP: app,
    SCREENREC_SERVICE_LAUNCH: "1",
  };
  let diagnostics = "";
  child = spawn(join(app, "Contents/MacOS/ScreenRecorder"), [], {
    cwd: "/",
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  exited = new Promise((answer) => {
    child.once("exit", answer);
    child.once("error", (error) => {
      spawnError = error;
      answer();
    });
  });
  child.stderr.on("data", (bytes) => {
    diagnostics = (diagnostics + bytes).slice(-65536);
  });
  const deadline = Date.now() + 20_000;
  while (!diagnostics.includes("service ready pid=")) {
    if (
      spawnError ||
      child.exitCode !== null ||
      Date.now() > deadline ||
      diagnostics.includes("service failed code=")
    )
      throw new Error(`Relocated app did not become ready: ${spawnError ?? diagnostics}`);
    await delay(50);
  }
  const call = (operation, params = {}) => {
    const result = spawnSync(
      join(moved, "screenrec"),
      [
        operation,
        "--socket",
        join(env.SCREENREC_HOME, "run/service.sock"),
        "--params",
        JSON.stringify(params),
      ],
      { cwd: "/", env, encoding: "utf8", timeout: 15_000 },
    );
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return JSON.parse(result.stdout);
  };
  const health = call("service.health");
  assert.equal(health.data.status, "ready");
  assert.equal(health.data.node, receipt.nodeVersion);
  assert.deepEqual(call("recording.list").data.recordings, []);
  const native = spawnSync(join(app, "Contents/MacOS/screenrec-native"), [], {
    cwd: "/",
    env,
    input: JSON.stringify({ id: "release-smoke", operation: "system.ping", params: {} }) + "\n",
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(native.status, 0, native.stderr);
  assert.deepEqual(JSON.parse(native.stdout), {
    id: "release-smoke",
    ok: true,
    data: { platform: "macos" },
  });
  const help = spawnSync(join(moved, "screenrec"), ["--help"], {
    cwd: "/",
    env,
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.ok(JSON.parse(help.stdout).operations.some((entry) => entry.name === "edit.apply"));
  console.log(
    "Relocated release: bundled Node, app-owned service, CLI and native worker pass; no capture or inference.",
  );
} finally {
  if (child?.pid && child.exitCode === null) {
    child.kill("SIGTERM");
    let timer;
    try {
      await Promise.race([
        exited,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Release app did not quit")), 15_000);
        }),
      ]);
    } catch (error) {
      child.kill("SIGKILL");
      await exited;
      cleanupError = error;
    } finally {
      clearTimeout(timer);
      rmSync(scratch, { recursive: true, force: true });
    }
  } else rmSync(scratch, { recursive: true, force: true });
}

if (cleanupError) throw cleanupError;
