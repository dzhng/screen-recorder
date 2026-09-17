import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import {
  launchReady,
  socketPath,
  temporary,
  waitFor,
  requireScreenPermission,
} from "./harness.mjs";

/**
 * Read-only menu-state observations while public service calls control the own-window fixture.
 * Every take here records this app's own capture-fixture window with the microphone and system
 * audio explicitly off; no other window, display or audio device is ever selected.
 */
/** Ordinary app launch with an own-window fixture and read-only menu observations. */
async function controlledApp(home) {
  const commands = join(home, "controls");
  mkdirSync(commands, { recursive: true });
  const { instance } = await launchReady(home, {
    SCREENREC_FIXTURE_WINDOW: "1",
    SCREENREC_FIXTURE_CONTROLS: commands,
  });
  const [, windowId] = await instance.waitFor(/capture fixture window=(\d+)/);
  await instance.waitFor(/controls probe listening/);
  let next = 0;
  const send = async (payload) => {
    const id = (next += 1);
    writeFileSync(join(commands, "command.json"), JSON.stringify({ id, ...payload }));
    const answered = join(commands, `answer-${id}.json`);
    const answer = await waitFor(() => {
      try {
        return JSON.parse(readFileSync(answered, "utf8"));
      } catch {
        return undefined;
      }
    }, 20_000);
    rmSync(answered, { force: true });
    return answer;
  };
  const controls = { instance, windowId: Number(windowId), send };
  await waitFor(
    async () => Boolean(find((await send({ do: "snapshot" })).rows, `source.window.${windowId}`)),
    20_000,
  );
  return controls;
}

function find(rows, item) {
  for (const row of rows) {
    if (row.item === item) return row;
    const nested = row.submenu && find(row.submenu, item);
    if (nested) return nested;
  }
  return undefined;
}

function call(home, operation, params = {}) {
  return callLocal(
    socketPath(home),
    { id: randomUUID(), operation, params },
    { timeoutMs: 30_000 },
  );
}

async function succeeds(home, operation, params) {
  const answer = await call(home, operation, params);
  assert.equal(answer.ok, true, `${operation}: ${JSON.stringify(answer.error)}`);
  return answer.data;
}

test("external controls update the closed menu with actual source, audio and clock", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-controls-external-");
  const controls = await controlledApp(home);
  const windowId = controls.windowId;
  const started = await succeeds(home, "capture.start", {
    requestId: randomUUID(),
    source: { kind: "window", windowId },
    microphone: false,
    systemAudio: false,
  });
  // A snapshot reads existing rows without invoking menuWillOpen or forcing a refresh.
  const snapshot = () => controls.send({ do: "snapshot" });
  await waitFor(async () => (await snapshot()).rows[0].title.startsWith("Recording —"), 20_000);
  const seconds = (title) => {
    const parts = title.split(" — ")[1].split(":").map(Number);
    return parts.reduce((value, part) => value * 60 + part, 0);
  };
  await waitFor(async () => seconds((await snapshot()).rows[0].title) >= 1, 20_000);
  const active = (await snapshot()).rows;
  assert.equal(find(active, `source.window.${windowId}`).checked, true);
  assert.equal(find(active, "microphone.off").checked, true);
  await succeeds(home, "capture.pause", { recordingId: started.recordingId });
  await waitFor(async () => (await snapshot()).rows[0].title.startsWith("Paused —"), 20_000);
  const paused = (await snapshot()).rows[0].title;
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal((await snapshot()).rows[0].title, paused);
  await succeeds(home, "capture.resume", { recordingId: started.recordingId });
  await waitFor(async () => (await snapshot()).rows[0].title.startsWith("Recording —"), 20_000);
  await waitFor(async () => seconds((await snapshot()).rows[0].title) > seconds(paused), 20_000);
  await succeeds(home, "capture.stop", { recordingId: started.recordingId });
  await waitFor(async () => (await snapshot()).rows[0].title === "Idle", 20_000);
});
