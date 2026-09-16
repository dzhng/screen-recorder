import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { constants } from "node:fs";
import { open, mkdir, readdir } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export async function retainedParentDeath(archive, directory, worker, native) {
  await mkdir(directory, { mode: 0o700 });
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./retained-parent.mjs", import.meta.url)), archive, directory, native],
    { detached: true, stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
  const terminal = once(child, "close");
  let diagnostic = "",
    pid,
    handle;
  child.stderr.on("data", (data) => (diagnostic = (diagnostic + data).slice(-8192)));
  const absent = () => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      return true;
    }
  };
  try {
    const message = await Promise.race([
      once(child, "message", { signal: AbortSignal.timeout(10_000) }).then(([value]) => value),
      terminal.then(() => {
        throw new Error(`Fixture parent exited before native admission: ${diagnostic}`);
      }),
    ]);
    pid = message.nativePid;
    assert.ok(Number.isInteger(pid) && pid > 1);
    process.kill(pid, 0);
    child.kill("SIGKILL");
    assert.deepEqual(await terminal, [null, "SIGKILL"]);
    assert.equal(absent(), false, "native child must outlive its killed parent");
    handle = await open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const stat = await handle.stat({ bigint: true });
    const identity = { dev: String(stat.dev), ino: String(stat.ino) };
    const before = await readdir(directory);
    assert.ok(before.includes("content"));
    for (const operation of ["archive.cleanup", "archive.prepare"]) {
      const blocked = await worker(operation, { identity }, { descriptors: [handle.fd] });
      assert.equal(blocked.ok, false, "live orphan must retain exclusive workspace ownership");
      assert.equal(blocked.error.code, "INVALID_STORAGE");
      assert.deepEqual(await readdir(directory), before);
    }
    process.kill(pid, "SIGKILL");
    for (let i = 0; i < 200 && !absent(); i++) await setTimeout(10);
    assert.equal(absent(), true, "owned orphan must be reaped before cleanup");
    const cleaned = await worker("archive.cleanup", { identity }, { descriptors: [handle.fd] });
    assert.equal(cleaned.ok, true, JSON.stringify(cleaned));
    assert.deepEqual(await readdir(directory), []);
    const admitted = await worker("archive.prepare", { identity }, { descriptors: [handle.fd] });
    assert.equal(admitted.ok, true, JSON.stringify(admitted));
    return {
      parentPid: child.pid,
      nativePid: pid,
      parentKilled: true,
      blockedWhileChildLive: true,
      childReaped: true,
      cleanupAfterChild: true,
    };
  } finally {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      assert.equal(error.code, "ESRCH", "owned process group must be signaled or absent");
    }
    await terminal;
    if (pid) {
      for (let i = 0; i < 200 && !absent(); i++) await setTimeout(10);
      assert.equal(absent(), true);
    }
    await handle?.close();
  }
}
