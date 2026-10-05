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
  const lockDirectory = join(accountHome, "Library/Caches/com.dzhng.screenrec");
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

test("bundled media tools preserve arguments, streams and exit status while excluding installation", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-media-launcher-"));
  const accountHome = join(scratch, "Account home");
  let child, closed;
  try {
    mkdirSync(accountHome);
    const accountShim = join(scratch, "account.c");
    writeFileSync(
      accountShim,
      `#include <pwd.h>
struct passwd *fixture_getpwuid(uid_t uid) { static struct passwd account; account.pw_uid=uid; account.pw_dir=${JSON.stringify(accountHome)}; return &account; }
`,
    );
    const launcher = join(scratch, "screenrec");
    const lockExec = join(scratch, "lock-exec");
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
    const bin = join(app, "Contents/Resources/ffmpeg/bin");
    mkdirSync(bin, { recursive: true });
    const source = join(scratch, "tool.c");
    writeFileSync(
      source,
      `#include <stdio.h>
int main(int argc, char **argv) {
  for (int i=1; i<argc; ++i) puts(argv[i]);
  fflush(stdout);
  fputs("tool diagnostic\\n", stderr);
  int value;
  while ((value=getchar()) != EOF) putchar(value);
  return 23;
}
`,
    );
    execFileSync("clang", [source, "-o", join(bin, "ffmpeg")]);
    copyFileSync(join(bin, "ffmpeg"), join(bin, "ffprobe"));
    const env = { ...process.env, HOME: scratch, SCREENREC_APP: app };
    const lock = join(accountHome, "Library/Caches/com.dzhng.screenrec/launch.lock");
    for (const tool of ["ffmpeg", "ffprobe"]) {
      const args = [
        "-filter_complex",
        "drawtext=text='literal $(text) with spaces'",
        "-i",
        "pipe:0",
      ];
      child = spawn(launcher, [tool, ...args], { env, stdio: ["pipe", "pipe", "pipe"] });
      closed = new Promise((resolve) => child.once("close", resolve));
      let output = "",
        errors = "";
      child.stdout.on("data", (bytes) => {
        output += bytes;
      });
      child.stderr.on("data", (bytes) => {
        errors += bytes;
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Tool entry timed out")), 5000);
        child.stdout.once("data", () => {
          clearTimeout(timer);
          resolve();
        });
        child.once("close", () => {
          clearTimeout(timer);
          reject(new Error("Tool exited before entry"));
        });
      });
      assert.equal(spawnSync(lockExec, ["exclusive", lock, "/usr/bin/true"]).status, 75);
      child.stdin.end("stdin payload\n");
      assert.equal(await closed, 23);
      child = undefined;
      assert.equal(output, args.join("\n") + "\nstdin payload\n");
      assert.equal(errors, "tool diagnostic\n");
      assert.equal(spawnSync(lockExec, ["exclusive", lock, "/usr/bin/true"]).status, 0);
      child = spawn(lockExec, ["exclusive", lock, "/bin/cat"], { stdio: ["pipe", "pipe", "pipe"] });
      closed = new Promise((resolve) => child.once("close", resolve));
      child.stdin.write("exclusive owner\n");
      await new Promise((resolve) => child.stdout.once("data", resolve));
      const denied = spawnSync(launcher, [tool, "-version"], { env, encoding: "utf8" });
      assert.equal(denied.status, 75);
      assert.equal(JSON.parse(denied.stdout).error.code, "UPDATING");
      child.stdin.end();
      assert.equal(await closed, 0);
      child = undefined;
    }
  } finally {
    if (child) {
      child.kill("SIGKILL");
      await closed;
    }
    rmSync(scratch, { recursive: true, force: true });
  }
});
