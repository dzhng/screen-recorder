import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { alive, temporary, waitFor } from "./harness.mjs";

/**
 * A run that is interrupted — or that is not a test at all, so the hook that buries its apps
 * never runs — must still leave nothing of itself on the screen of whoever is at this Mac. This
 * is the defect that left fixture windows standing after an abandoned run, so it is checked from
 * outside: a child run of the harness is interrupted, and both processes it owned are gone.
 */
test("an interrupted run leaves none of its apps running", { timeout: 90_000 }, async () => {
  const home = temporary("/tmp/scr-interrupt-");
  const script = join(home, "run.mjs");
  // Not a test file: nothing here ever reaches node:test's cleanup, which is the whole point.
  writeFileSync(
    script,
    `import { launchReady } from ${JSON.stringify(join(import.meta.dirname, "harness.mjs"))};\n` +
      `const { instance, servicePid } = await launchReady(${JSON.stringify(home)});\n` +
      "console.log(JSON.stringify({ app: instance.pid, service: servicePid }));\n" +
      "await new Promise(() => {});\n",
  );

  const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "inherit"] });
  let out = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (out += chunk));
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    const [, line] = await waitFor(
      () => out.match(/(\{"app".*\})/),
      60_000,
      () => out,
    );
    const owned = JSON.parse(line);
    assert.equal(alive(owned.app), true, "the run never got its app started");

    child.kill("SIGINT");
    await exited;
    // The apps go with the run that started them, not on their own schedule afterwards.
    await waitFor(() => !alive(owned.app) && !alive(owned.service), 10_000);
  } finally {
    child.kill("SIGKILL");
    await exited;
  }
});
