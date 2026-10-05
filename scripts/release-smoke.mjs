import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receipt = JSON.parse(readFileSync(join(root, "dist/release/release.json")));
const scratch = mkdtempSync("/tmp/screenrec-release-");
try {
  const moved = join(scratch, "Relocated release");
  execFileSync("ditto", [
    "-x",
    "-k",
    join(root, `dist/release/ScreenRecorder-${receipt.tag}-macos-arm64.zip`),
    moved,
  ]);
  const update = join(scratch, "Update archive");
  execFileSync("ditto", [
    "-x",
    "-k",
    join(root, "dist/release", receipt.updateArchive.name),
    update,
  ]);
  const app = join(moved, "Screen Recorder.app");
  const updateApp = join(update, "Screen Recorder.app");
  for (const path of [app, updateApp])
    execFileSync("codesign", ["--verify", "--deep", "--strict", path]);
  execFileSync("codesign", ["--verify", "--strict", join(moved, "screenrec")]);
  const tree = (path) =>
    execFileSync("/usr/sbin/mtree", ["-c", "-p", path, "-k", "type,mode,link,sha256digest"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .join("\n");
  assert.equal(
    tree(app),
    tree(updateApp),
    "The kit and update archive must contain the same files, modes and links",
  );
  const env = {
    HOME: scratch,
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    TMPDIR: tmpdir(),
    SCREENREC_HOME: join(scratch, "home"),
    SCREENREC_APP: app,
  };
  // The signed production identity owns real Sparkle preferences and the account
  // lock. Do not launch that host or launcher as a scratch smoke fixture.
  const node = join(app, "Contents/Resources/node/bin/node");
  const version = spawnSync(node, ["--version"], { env, encoding: "utf8", timeout: 15000 });
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), `v${receipt.nodeVersion}`);
  const help = spawnSync(node, [join(app, "Contents/Resources/cli/main.mjs"), "--help"], {
    cwd: "/",
    env,
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.ok(JSON.parse(help.stdout).operations.some((entry) => entry.name === "edit.apply"));
  const native = spawnSync(join(app, "Contents/MacOS/screenrec-native"), [], {
    cwd: "/",
    env,
    input: JSON.stringify({ id: "release-smoke", operation: "system.ping", params: {} }) + "\n",
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(native.status, 0, native.stderr);
  assert.deepEqual(JSON.parse(native.stdout), {
    id: "release-smoke",
    ok: true,
    data: { platform: "macos" },
  });
  console.log(
    "Relocated archives: identical signed app trees, bundled Node/CLI schema load, native ping and signed launcher inspection pass. Host/service/updater and launcher execution belong to the isolated installed lab.",
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
