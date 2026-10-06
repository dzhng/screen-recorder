import assert from "node:assert/strict";
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

/** Runs assertions while a killed owner's actual native child retains its workspace lock. */
export async function withOrphanedPackageWorkspace(parentDirectory, native, inspect) {
  const owner = fork(
    fileURLToPath(new URL("./package-workspace-owner.mjs", import.meta.url)),
    [parentDirectory],
    {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
      env: { ...process.env, YAP_NATIVE: native },
    },
  );
  const ownerReaped = once(owner, "close");
  let pid;
  let childFinished = false;
  let finishing;
  const signalChild = (signal) => {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const waitGone = async () => {
    const deadline = Date.now() + 3000;
    while (true) {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") {
          childFinished = true;
          return;
        }
        throw error;
      }
      assert.ok(Date.now() < deadline, "Native process must reach terminal state");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  try {
    const [message] = await Promise.race([
      once(owner, "message"),
      ownerReaped.then(() => {
        throw new Error("Fixture owner exited before reporting its native child");
      }),
    ]);
    pid = message.pid;
    assert.equal(
      execFileSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,command="], {
        encoding: "utf8",
      }).trim(),
      `${owner.pid} ${native}`,
    );
    const deadline = Date.now() + 3000;
    while (
      !execFileSync("/bin/ps", ["-p", String(pid), "-o", "state="], { encoding: "utf8" })
        .trim()
        .startsWith("T")
    ) {
      assert.ok(Date.now() < deadline, "Native child must stop");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    owner.kill("SIGKILL");
    await ownerReaped;
    return await inspect({
      pid,
      name: message.name,
      finishChild() {
        finishing ??= (async () => {
          signalChild("SIGCONT");
          await waitGone();
        })();
        return finishing;
      },
    });
  } finally {
    owner.kill("SIGKILL");
    await ownerReaped;
    if (pid && !childFinished) {
      signalChild("SIGKILL");
      await waitGone();
    }
  }
}
