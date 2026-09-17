import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { finderEnvironment, waitFor } from "./harness.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const installer = join(root, "scripts/install-personal.mjs");

function processes() {
  return execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim().match(/^(\d+) (.*)$/))
    .filter(Boolean)
    .map(([, pid, command]) => ({ pid: Number(pid), command }));
}

test(
  "the installed app and launcher serve CLI and MCP from outside the checkout",
  { timeout: 120_000 },
  async () => {
    const scratch = realpathSync(mkdtempSync("/tmp/screenrec-install-"));
    const app = join(scratch, "Applications/ScreenRecorder.app");
    const bin = join(scratch, "bin");
    const launcher = join(bin, "screenrec");
    const executable = join(app, "Contents/MacOS/ScreenRecorder");
    const env = {
      ...finderEnvironment,
      SCREENREC_APP: app,
      SCREENREC_HOME: join(scratch, "home"),
    };
    const install = () =>
      spawnSync(process.execPath, [installer, "--app", app, "--bin", bin], {
        encoding: "utf8",
        timeout: 60_000,
      });
    const installed = () => processes().find(({ command }) => command === executable);
    try {
      const first = install();
      assert.equal(first.status, 0, first.stderr);
      assert.match(first.stdout, /"args": \["mcp"\]/);
      for (const file of [launcher, join(app, "Contents/Resources/cli/main.mjs")])
        assert.ok(
          !readFileSync(file, "utf8").includes(root),
          `${file} must not reach into the checkout`,
        );

      // An ordinary CLI call from `/` launches the installed copy, not the checkout build.
      const call = (operation) =>
        spawnSync(launcher, [operation, "--params", "{}"], {
          cwd: "/",
          env,
          encoding: "utf8",
          timeout: 30_000,
        });
      const status = call("capture.status");
      assert.equal(status.status, 0, status.stderr + status.stdout);
      assert.equal(JSON.parse(status.stdout).data.device.state, "idle");
      assert.ok(installed(), "discovery launched the installed app");
      assert.ok(
        processes().some(({ command }) =>
          command.includes(join(app, "Contents/Resources/service/main.mjs")),
        ),
        "the service runs from the installed bundle",
      );
      assert.deepEqual(JSON.parse(call("recording.list").stdout).data.recordings, []);

      const refused = install();
      assert.equal(refused.status, 1);
      assert.match(refused.stderr, /Quit Screen Recorder/);

      const client = new Client({ name: "install-proof", version: "1" });
      try {
        await client.connect(
          new StdioClientTransport({
            command: launcher,
            args: ["mcp"],
            cwd: "/",
            env,
            stderr: "pipe",
          }),
        );
        const tools = await client.listTools();
        assert.ok(tools.tools.some(({ name }) => name === "export.create"));
        const answer = await client.callTool({ name: "capture.status", arguments: {} });
        assert.equal(answer.isError, false, JSON.stringify(answer));
      } finally {
        await client.close();
      }

      process.kill(installed().pid, "SIGTERM");
      await waitFor(() => !installed(), 20_000);

      const second = install();
      assert.equal(second.status, 0, second.stderr);
      assert.deepEqual(
        readdirSync(join(scratch, "Applications")),
        ["ScreenRecorder.app"],
        "no staging copy remains",
      );
      execFileSync("codesign", ["--verify", "--strict", app]);
    } finally {
      const running = installed();
      if (running) {
        process.kill(running.pid, "SIGTERM");
        await waitFor(() => !installed(), 20_000).catch(() => process.kill(running.pid, "SIGKILL"));
      }
      rmSync(scratch, { recursive: true, force: true });
    }
  },
);
