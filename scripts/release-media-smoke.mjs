import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { verifyVideoDelivery } from "../packages/test-harness/editing/hevc-delivery.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receipt = JSON.parse(readFileSync(join(root, "dist/release/release.json")));
const scratch = mkdtempSync("/tmp/yap-release-");
let child, exited, cleanupError, spawnError;
try {
  const moved = join(scratch, "Relocated release");
  execFileSync("ditto", [
    "-x",
    "-k",
    join(root, `dist/release/Yap-${receipt.tag}-macos-arm64.zip`),
    moved,
  ]);
  const app = join(moved, "Yap.app");
  execFileSync("codesign", ["--verify", "--deep", "--strict", app]);
  const node = join(app, "Contents/Resources/node/bin/node");
  const cli = join(app, "Contents/Resources/cli/main.mjs");
  const service = join(app, "Contents/Resources/service/main.mjs");
  const runtime = JSON.parse(readFileSync(join(app, "Contents/Resources/service/runtime.json")));
  const env = {
    HOME: scratch,
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    TMPDIR: tmpdir(),
    YAP_HOME: join(scratch, "home"),
    YAP_APP: app,
    YAP_NATIVE: join(app, "Contents/MacOS/yap-native"),
    YAP_FFMPEG_DIRECTORY: resolve(dirname(service), runtime.ffmpegDirectory),
    YAP_FFMPEG_RECEIPT_SHA256: runtime.ffmpegReceiptSha256,
  };
  let diagnostics = "";
  // Execute the packaged service directly: the production host and launcher own
  // account-scoped updater state and must not be launched by a scratch fixture.
  child = spawn(node, [service], {
    cwd: "/",
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  exited = new Promise((answer) => {
    child.once("exit", answer);
    child.once("error", (error) => {
      spawnError = error;
      answer();
    });
  });
  let control = "";
  child.stdout.on("data", (bytes) => {
    control = (control + bytes).slice(-65536);
  });
  child.stderr.on("data", (bytes) => {
    diagnostics = (diagnostics + bytes).slice(-65536);
  });
  const deadline = Date.now() + 20_000;
  while (!control.includes('"event":"started"')) {
    if (
      spawnError ||
      child.exitCode !== null ||
      Date.now() > deadline ||
      control.includes('"event":"failed"')
    )
      throw new Error(
        `Relocated service did not become ready: ${spawnError ?? control + diagnostics}`,
      );
    await delay(50);
  }
  const call = (operation, params = {}) => {
    const result = spawnSync(
      node,
      [
        cli,
        operation,
        "--socket",
        join(env.YAP_HOME, "run/service.sock"),
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
  const tools = call("service.tools").data;
  assert.equal(tools.node.path, realpathSync(join(app, "Contents/Resources/node/bin/node")));
  const ffmpeg = tools.ffmpeg;
  assert.equal(ffmpeg.available, true, JSON.stringify(ffmpeg));
  assert.equal(ffmpeg.version, receipt.ffmpeg.version);
  assert.equal(ffmpeg.receiptSha256, receipt.ffmpeg.receiptSha256);
  assert.equal(
    realpathSync(ffmpeg.directory),
    realpathSync(join(app, "Contents/Resources/ffmpeg")),
  );
  for (const [name, executable] of Object.entries(ffmpeg.executables)) {
    assert.equal(executable.path, join(ffmpeg.directory, "bin", name));
    execFileSync("codesign", ["--verify", "--strict", executable.path]);
    const version = execFileSync(executable.path, ["-version"], {
      env,
      cwd: "/",
      encoding: "utf8",
      timeout: 5000,
    });
    assert.ok(version.startsWith(`${name} version ${ffmpeg.version} `));
  }
  execFileSync(node, [join(root, "helpers/ffmpeg/smoke.mjs"), ffmpeg.directory], {
    env,
    cwd: "/",
    stdio: "inherit",
    timeout: 30000,
  });
  assert.deepEqual(call("recording.list").data.recordings, []);
  const mediaOut = mkdtempSync(join(root, "dist/release/media-smoke-"));
  const mediaReport = { passed: false, trace: [], exchanges: [], release: receipt, tools };
  try {
    await verifyVideoDelivery({
      call: async (operation, params) => {
        const response = call(operation, params);
        mediaReport.exchanges.push({ request: { operation, params }, response });
        assert.equal(response.ok, true, JSON.stringify(response));
        mediaReport.trace.push({ operation });
        return response.data;
      },
      out: mediaOut,
      ffmpeg: ffmpeg.executables.ffmpeg.path,
      ffprobe: ffmpeg.executables.ffprobe.path,
      report: mediaReport,
      env,
    });
  } finally {
    writeFileSync(join(mediaOut, "report.json"), JSON.stringify(mediaReport, null, 2) + "\n");
  }
  console.log(`Relocated managed delivery evidence: ${mediaOut}`);
  console.log(
    "Relocated release: bundled tools, isolated packaged service/CLI and managed H.264/HEVC delivery pass; no capture or inference.",
  );
} finally {
  if (child?.pid && child.exitCode === null) {
    child.kill("SIGTERM");
    let timer;
    try {
      await Promise.race([
        exited,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Release service did not quit")), 15_000);
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
