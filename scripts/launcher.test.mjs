import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("the production launcher refuses bundled entry before loading and holds exclusion until Node exits", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-launcher-"));
  let holder, ownedClosed;
  try {
    const launcher = join(scratch, "screenrec"),
      lockExec = join(scratch, "lock-exec");
    execFileSync("clang", [
      "-Wall",
      "-Wextra",
      "-Werror",
      "scripts/launcher/main.c",
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
    const lock = join(scratch, "Library/Caches/com.david.screenrec/launch.lock");
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
    const denied = spawnSync(launcher, ["--help"], {
      env: { ...env, SCREENREC_APP: join(scratch, "absent.app") },
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
    assert.equal(spawnSync(launcher, ["--help"], { env, input: "", encoding: "utf8" }).status, 0);
  } finally {
    if (holder) {
      holder.kill("SIGKILL");
      await ownedClosed;
    }
    rmSync(scratch, { recursive: true, force: true });
  }
});
