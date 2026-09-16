import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { app, finderEnvironment, launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

/**
 * The status-bar controls, driven through the packaged app, its service child and its real menu.
 * Every take here records this app's own capture-fixture window with the microphone and system
 * audio explicitly off; no other window, display or audio device is ever selected.
 */
const preflight = JSON.parse(
  spawnSync(app, ["--capture-preflight"], {
    cwd: "/",
    env: finderEnvironment,
    encoding: "utf8",
    timeout: 20_000,
  }).stdout || "{}",
);

function requireScreenPermission() {
  assert.equal(
    preflight.screen,
    true,
    "Screen recording permission is not authorized for this build, so these control gates cannot run. Grant it in System Settings > Privacy & Security > Screen & System Audio Recording; it is never requested automatically.",
  );
}

/** Where a launch's own shots are kept for review, outside the scratch home it deletes. */
const shots = "/tmp/screenrec-recording-controls-evidence/live";

/** An ordinary launch that also opens this app's own window and answers control commands. */
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
  const controls = {
    instance,
    windowSource: `source.window.${Number(windowId)}`,
    send,
    /** Chooses one menu row exactly as a click on it would. */
    choose: (item) => send({ do: "choose", item }),
    menu: () => send({ do: "menu" }),
    shot: (name, open = []) => send({ do: "shot", path: join(shots, `${name}.png`), open }),
    /** The one line the menu leads with, which is what a person reads the state from. */
    status: async () => (await controls.menu()).rows[0].title,
    row: async (item) => find((await controls.menu()).rows, item),
    /** Waits until the menu leads with what this step expects. */
    settles: (expected) =>
      waitFor(
        async () => (await controls.status()).startsWith(expected),
        20_000,
        async () => `The menu still reads ${await controls.status()}`,
      ),
  };
  await waitFor(async () => Boolean(await controls.row(controls.windowSource)), 20_000);
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

function notes(rows) {
  return rows
    .filter((row) => !row.enabled && !row.separator && !row.submenu)
    .map((row) => row.title);
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

test("the menu records, pauses and stops one take, showing that take's own clock", async () => {
  requireScreenPermission();
  mkdirSync(shots, { recursive: true });
  const home = temporary("/tmp/scr-controls-");
  const controls = await controlledApp(home);

  const idle = await controls.menu();
  assert.equal(idle.rows[0].title, "Idle");
  assert.equal(
    find(idle.rows, "capture.startOrStop").enabled,
    false,
    "Nothing can start until a source is chosen",
  );
  assert.equal(
    (await controls.choose("capture.pauseOrResume")).ok,
    false,
    "A control with no take to act on is refused by the menu itself",
  );

  assert.equal((await controls.choose(controls.windowSource)).ok, true);
  assert.match((await controls.menu()).rows[2].title, /^Source: .*Capture Fixture$/);
  await controls.shot("idle");

  // The microphone is on by default, so this start reaches the app's refusal to record audio in
  // its capture fixture. That refusal is the proof that narration is the default, not the absence
  // of one; no audio device is opened either way.
  assert.equal((await controls.choose("capture.startOrStop")).ok, true);
  const refused = await waitFor(
    async () => notes((await controls.menu()).rows).find((note) => note.includes("audio device")),
    20_000,
    () => "The menu never reported the refused start",
  );
  assert.match(refused, /^INVALID_REQUEST: /);

  assert.equal((await controls.choose("microphone.off")).ok, true);
  assert.equal((await controls.menu()).rows[3].title, "Microphone: off");

  const startedAt = Date.now();
  assert.equal((await controls.choose("capture.startOrStop")).ok, true);
  await controls.settles("Recording —");
  const live = await succeeds(home, "capture.status");
  assert.equal(live.device.state, "recording");
  assert.equal(live.recording.state, "recording");
  assert.equal(
    find((await controls.menu()).rows, "capture.startOrStop").title,
    "Stop Recording",
    "One control starts and stops the take",
  );
  await controls.shot("recording");

  // The clock the menu shows is the take's own, so it has to move while the take records.
  await waitFor(
    async () => (await succeeds(home, "capture.status")).device.elapsedUs >= 1_000_000,
    20_000,
    () => "The recording clock never advanced",
  );

  assert.equal((await controls.choose("capture.pauseOrResume")).ok, true);
  await controls.settles("Paused —");
  const frozen = await controls.status();
  const pausedUs = (await succeeds(home, "capture.status")).device.elapsedUs;
  await controls.shot("paused");
  await new Promise((wake) => setTimeout(wake, 2_000));
  assert.equal(
    await controls.status(),
    frozen,
    "A paused take holds the playback time it reached; paused wall time is not recording time",
  );
  assert.equal(
    (await succeeds(home, "capture.status")).device.elapsedUs,
    (await succeeds(home, "capture.status")).device.elapsedUs,
    "The same frozen time is what any caller reads",
  );

  assert.equal((await controls.choose("capture.pauseOrResume")).ok, true);
  await controls.settles("Recording —");
  await waitFor(
    async () => {
      const elapsed = (await succeeds(home, "capture.status")).device.elapsedUs;
      return elapsed > pausedUs + 1_000_000;
    },
    20_000,
    () => `The resumed clock never moved past ${frozen}`,
  );

  assert.equal((await controls.choose("capture.startOrStop")).ok, true);
  await controls.settles("Idle");
  const wallUs = (Date.now() - startedAt) * 1000;
  const take = await succeeds(home, "recording.get", { recordingId: live.recording.recordingId });
  assert.equal(take.state, "complete");
  assert.ok(take.sourceDurationUs > 0, "A stopped take holds the media it recorded");
  assert.ok(
    take.sourceDurationUs < wallUs - 2_000_000,
    `The two paused seconds are absent from the ${take.sourceDurationUs}us of source media`,
  );
  const stored = (await controls.menu()).rows.find((row) => row.title === "Recent Recordings")
    .submenu[0];
  assert.match(stored.title, /— \d+:\d\d$/, "A stored take states the media it holds");
  assert.deepEqual(
    stored.submenu.filter((row) => row.enabled && row.item).map((row) => row.title),
    [],
    "Preview and the two exports are visible and unavailable, never faked",
  );
});

test("the menu cancels a take and restarts onto a new one", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-controls-");
  const controls = await controlledApp(home);
  assert.equal((await controls.choose(controls.windowSource)).ok, true);
  assert.equal((await controls.choose("microphone.off")).ok, true);

  assert.equal((await controls.choose("capture.startOrStop")).ok, true);
  await controls.settles("Recording —");
  const canceled = (await succeeds(home, "capture.status")).recording.recordingId;
  assert.equal((await controls.choose("capture.cancel")).ok, true);
  await controls.settles("Idle");
  assert.deepEqual(
    (await succeeds(home, "recording.list", {})).recordings,
    [],
    "A canceled take is discarded rather than listed",
  );

  assert.equal((await controls.choose("capture.startOrStop")).ok, true);
  await controls.settles("Recording —");
  const first = (await succeeds(home, "capture.status")).recording.recordingId;
  assert.notEqual(first, canceled);
  assert.equal((await controls.choose("capture.restart")).ok, true);
  await waitFor(async () => {
    const status = await succeeds(home, "capture.status");
    return status.device.state === "recording" && status.device.recordingId !== first;
  }, 20_000);
  await controls.settles("Recording —");
  const second = (await succeeds(home, "capture.status")).recording.recordingId;
  assert.notEqual(second, first, "Restarting names a distinct new take");
  assert.equal((await controls.choose("capture.startOrStop")).ok, true);
  await controls.settles("Idle");
  const kept = (await succeeds(home, "recording.list", {})).recordings;
  assert.deepEqual(
    kept.map((recording) => recording.recordingId),
    [second],
    "Restart discards only the take it replaced",
  );
});

test("external controls update the closed menu and restart its actual source and audio", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-controls-external-");
  const controls = await controlledApp(home);
  const windowId = Number(controls.windowSource.split(".").at(-1));
  const started = await succeeds(home, "capture.start", {
    requestId: randomUUID(),
    source: { kind: "window", windowId },
    microphone: false,
    systemAudio: false,
  });
  // A snapshot reads existing rows without invoking menuWillOpen or forcing a refresh.
  const snapshot = () => controls.send({ do: "snapshot" });
  await waitFor(async () => (await snapshot()).rows[0].title.startsWith("Recording —"), 20_000);
  const active = (await snapshot()).rows;
  assert.equal(find(active, controls.windowSource).checked, true);
  assert.equal(find(active, "microphone.off").checked, true);
  await succeeds(home, "capture.pause", { recordingId: started.recordingId });
  await waitFor(async () => (await snapshot()).rows[0].title.startsWith("Paused —"), 20_000);
  await succeeds(home, "capture.resume", { recordingId: started.recordingId });
  await waitFor(async () => (await snapshot()).rows[0].title.startsWith("Recording —"), 20_000);
  assert.equal((await controls.choose("capture.restart")).ok, true);
  await waitFor(async () => {
    const status = await succeeds(home, "capture.status");
    return status.device.state === "recording" && status.device.recordingId !== started.recordingId;
  }, 20_000);
  const restarted = await succeeds(home, "capture.status");
  assert.deepEqual(restarted.device.selection, {
    source: { kind: "window", windowId },
    microphone: false,
    systemAudio: false,
  });
  await succeeds(home, "capture.stop", { recordingId: restarted.device.recordingId });
  await waitFor(async () => (await snapshot()).rows[0].title === "Idle", 20_000);
});
