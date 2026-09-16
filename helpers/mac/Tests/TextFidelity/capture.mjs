import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, isAbsolute } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { callLocal } from "../../../../packages/client/dist/index.js";
const root =
  process.env.SCREENREC_TEXT_CAPTURE_ROOT ??
  fileURLToPath(new URL("../../../../", import.meta.url));
const { app, temporary, launchReady, socketPath } = await import(
  pathToFileURL(join(root, "apps/macos/tests/harness.mjs"))
);
const out = process.env.SCREENREC_TEXT_EVIDENCE;
assert.ok(out && isAbsolute(out));
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), []);
function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
run("swiftc", [
  "-parse-as-library",
  fileURLToPath(new URL("browser.swift", import.meta.url)),
  "-o",
  join(out, "browser"),
]);
test(
  "capture only the owned browser text fixture with audio disabled",
  { timeout: 60000 },
  async () => {
    assert.equal(JSON.parse(run(app, ["--capture-preflight"])).screen, true);
    const captures = [];
    for (const [width, height] of [
      [1280, 800],
      [1024, 700],
    ]) {
      const fixture = spawn(
        join(out, "browser"),
        [fileURLToPath(new URL("browser.html", import.meta.url)), String(width), String(height)],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let text = "";
      fixture.stdout.on("data", (x) => (text += x));
      fixture.stderr.on("data", (x) => (text += x));
      const closed = new Promise((resolve) => fixture.once("close", resolve));
      const wait = async (pattern) => {
        const end = Date.now() + 10000;
        while (Date.now() < end) {
          const match = text.match(pattern);
          if (match) return match;
          assert.equal(fixture.exitCode, null, text);
          await delay(10);
        }
        throw new Error(text);
      };
      try {
        const ready = await wait(/READY (\d+) ([\d.]+)/),
          windowId = Number(ready[1]);
        const home = temporary("/tmp/screenrec-browser-capture-"),
          { instance } = await launchReady(home);
        const call = async (operation, params = {}) => {
          const r = await callLocal(
            socketPath(home),
            { id: randomUUID(), operation, params },
            { timeoutMs: 30000 },
          );
          assert.equal(r.ok, true, JSON.stringify(r));
          return r.data;
        };
        const take = await call("capture.start", {
          requestId: randomUUID(),
          source: { kind: "window", windowId },
          microphone: false,
          systemAudio: false,
        });
        const state = async (name) => {
          text = "";
          fixture.stdin.write(name + "\n");
          await wait(/STATE /);
        };
        await delay(1200);
        await state("scroll");
        await delay(1200);
        await state("dark");
        await delay(1200);
        const stopped = await call("capture.stop", { recordingId: take.recordingId });
        assert.equal(stopped.state, "complete");
        const name = `${width}x${height}`;
        await copyFile(
          join(home, "recordings", take.recordingId, "source/video.mov"),
          join(out, name + ".mov"),
        );
        await cp(
          join(home, "recordings", take.recordingId, "source"),
          join(out, name + "-source"),
          { recursive: true },
        );
        await writeFile(join(out, name + "-stop.json"), JSON.stringify(stopped, null, 2));
        captures.push({
          name,
          windowId,
          logicalSize: [width, height],
          backingScale: Number(ready[2]),
          durationUs: stopped.sourceDurationUs,
          audio: { microphone: false, systemAudio: false },
        });
        await instance.reap();
      } finally {
        fixture.stdin.end("quit\n");
        fixture.kill("SIGTERM");
        await closed;
      }
    }
    await writeFile(join(out, "capture.json"), JSON.stringify(captures, null, 2));
  },
);
