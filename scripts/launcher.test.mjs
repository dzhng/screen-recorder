import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  symlinkSync,
  linkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("the production launcher refuses bundled entry before loading and holds exclusion until Node exits", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-launcher-"));
  const accountHome = join(scratch, "Account home");
  const lockDirectory = join(accountHome, "Library/Caches/com.david.screenrec");
  let holder, ownedClosed;
  try {
    mkdirSync(accountHome);
    const accountShim = join(scratch, "account.c");
    writeFileSync(
      accountShim,
      `#include <pwd.h>
struct passwd *fixture_getpwuid(uid_t uid) { static struct passwd account; account.pw_uid=uid; account.pw_dir=${JSON.stringify(accountHome)}; return &account; }
`,
    );
    const launcher = join(scratch, "screenrec"),
      lockExec = join(scratch, "lock-exec");
    execFileSync("clang", [
      "-Wall",
      "-Wextra",
      "-Werror",
      "-Dgetpwuid=fixture_getpwuid",
      "scripts/launcher/main.c",
      accountShim,
      "-o",
      launcher,
    ]);
    execFileSync("clang", ["scripts/launcher-lab/lock-exec.c", "-o", lockExec]);
    const app = join(scratch, "Relocated App.app");
    mkdirSync(join(app, "Contents/Resources/node/bin"), { recursive: true });
    mkdirSync(join(app, "Contents/Resources/cli"));
    copyFileSync(process.execPath, join(app, "Contents/Resources/node/bin/node"));
    writeFileSync(
      join(app, "Contents/Resources/cli/main.mjs"),
      `console.log(JSON.stringify({app:process.env.SCREENREC_APP,args:process.argv.slice(2)}));process.stdin.resume();`,
    );
    const env = { ...process.env, HOME: scratch, SCREENREC_APP: app };
    holder = spawn(launcher, ["mcp", "with spaces"], { env, stdio: ["pipe", "pipe", "pipe"] });
    const closed = (ownedClosed = new Promise((resolve) => holder.once("close", resolve)));
    const line = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Node entry timed out")), 5000);
      holder.stdout.once("data", (bytes) => {
        clearTimeout(timer);
        resolve(bytes.toString());
      });
    });
    assert.deepEqual(JSON.parse(line), { app, args: ["mcp", "with spaces"] });
    const lock = join(lockDirectory, "launch.lock");
    assert.equal(spawnSync(lockExec, ["exclusive", lock, "/usr/bin/true"]).status, 75);
    holder.stdin.end();
    assert.equal(await closed, 0);
    assert.equal(spawnSync(lockExec, ["exclusive", lock, "/usr/bin/true"]).status, 0);
    holder = spawn(
      lockExec,
      ["exclusive", lock, process.execPath, "-e", "console.log('locked');process.stdin.resume()"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const exclusiveClosed = (ownedClosed = new Promise((resolve) => holder.once("close", resolve)));
    await new Promise((resolve) => holder.stdout.once("data", resolve));
    const otherHome = join(scratch, "Different HOME");
    mkdirSync(otherHome);
    const denied = spawnSync(launcher, ["--help"], {
      env: { ...env, HOME: otherHome, SCREENREC_APP: join(scratch, "absent.app") },
      encoding: "utf8",
    });
    assert.equal(denied.status, 75);
    assert.deepEqual(JSON.parse(denied.stdout).error, {
      code: "UPDATING",
      message: "Installation is being replaced; retry after the update",
      retryable: true,
    });
    holder.kill("SIGKILL");
    await exclusiveClosed;
    holder = undefined;
    const defaultApp = join(otherHome, "Applications/Screen Recorder.app");
    mkdirSync(join(otherHome, "Applications"));
    symlinkSync(app, defaultApp);
    const defaultEnv = { ...env, HOME: otherHome };
    delete defaultEnv.SCREENREC_APP;
    const defaultEntry = spawnSync(launcher, ["--help"], {
      env: defaultEnv,
      input: "",
      encoding: "utf8",
    });
    assert.equal(defaultEntry.status, 0, defaultEntry.stderr);
    assert.deepEqual(JSON.parse(defaultEntry.stdout), { app: defaultApp, args: ["--help"] });
    linkSync(lock, join(lockDirectory, "hardlink"));
    const hardlinked = spawnSync(launcher, ["--help"], { env, input: "", encoding: "utf8" });
    assert.equal(hardlinked.status, 74);
    assert.equal(
      JSON.parse(hardlinked.stdout).error.message,
      "Cannot open private installation lock",
    );
  } finally {
    if (holder) {
      holder.kill("SIGKILL");
      await ownedClosed;
    }
    rmSync(scratch, { recursive: true, force: true });
  }
});
