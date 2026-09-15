import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { callLocal } from "@screenrec/client";
import {
  alive,
  app,
  finderEnvironment,
  launchReady,
  socketPath,
  temporary,
  waitFor,
} from "./harness.mjs";

/**
 * Capture through the real app, service and local client. Every take records this app's own
 * fixture window with microphone and system audio off; no other window, display or device is
 * ever selected, and no permission is requested here.
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
    "Screen recording permission is not authorized for this build, so these capture gates cannot run. Grant it in System Settings > Privacy & Security > Screen & System Audio Recording; it is never requested automatically.",
  );
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

/** An ordinary launch that also opens this app's own window and exposes only that window. */
async function fixtureApp(home) {
  const { instance, servicePid } = await launchReady(home, { SCREENREC_FIXTURE_WINDOW: "1" });
  const [, windowId] = await instance.waitFor(/capture fixture window=(\d+)/);
  return { instance, servicePid, source: { kind: "window", windowId: Number(windowId) } };
}

/** The takes the service has allocated a directory for, before any of them has media. */
function takes(home) {
  try {
    return readdirSync(join(home, "recordings"));
  } catch {
    return [];
  }
}

/**
 * Asks for a take and answers with it as soon as the service has allocated its directory, which
 * is the moment native is asked to start and has not started yet.
 */
async function starting(home, source, requestId) {
  call(home, "capture.start", { requestId, source }).catch(() => undefined);
  const [recordingId] = await waitFor(
    () => takes(home).at(0) && takes(home),
    5_000,
    () => "The service never allocated the take",
  );
  return recordingId;
}

/** Whether this take's own journal says its capture was finished rather than left running. */
function finalized(home, recordingId) {
  try {
    return journal(home, recordingId).some((record) => record.event === "finished");
  } catch {
    return false;
  }
}

function sourceFiles(home, recordingId) {
  return readdirSync(join(home, "recordings", recordingId, "source")).sort();
}

function journal(home, recordingId) {
  return readFileSync(join(home, "recordings", recordingId, "source/capture.journal.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("records its own window through the service and leaves one inspectable original", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { source } = await fixtureApp(home);

  const sources = await succeeds(home, "capture.sources");
  assert.deepEqual(sources.displays, [], "Fixture mode must expose no display");
  assert.deepEqual(
    sources.windows.map((window) => window.id),
    [source.windowId],
    "Fixture mode must expose this app's own window and nothing else",
  );

  const started = await succeeds(home, "capture.start", { requestId: "take-1", source });
  assert.equal(started.state, "recording");
  assert.equal(started.currentRevisionId, null);
  // The take is discoverable immediately, and its timeline is honestly not ready yet.
  assert.deepEqual(await succeeds(home, "recording.latest"), started);
  assert.deepEqual((await call(home, "revision.get", { recordingId: started.recordingId })).error, {
    code: "NOT_READY",
    message: "Source duration is not finalized",
    retryable: false,
    details: { state: "recording" },
  });

  await delay(1_200);
  assert.equal(
    (await succeeds(home, "capture.pause", { recordingId: started.recordingId })).state,
    "paused",
  );
  await delay(600);
  assert.equal(
    (await succeeds(home, "capture.resume", { recordingId: started.recordingId })).state,
    "recording",
  );
  await delay(1_200);
  const elapsed = Date.now();
  const stopped = await succeeds(home, "capture.stop", { recordingId: started.recordingId });
  assert.equal(stopped.state, "complete");
  assert.equal(stopped.recordingId, started.recordingId);
  assert.ok(stopped.sourceDurationUs > 1_000_000, `Short take: ${stopped.sourceDurationUs}us`);

  const original = await succeeds(home, "revision.get", { recordingId: started.recordingId });
  assert.deepEqual(original.revision.spans, [{ startUs: 0, endUs: stopped.sourceDurationUs }]);
  assert.equal(original.revision.id, "r0");
  assert.deepEqual(sourceFiles(home, started.recordingId), ["capture.journal.jsonl", "video.mov"]);

  const records = journal(home, started.recordingId);
  // Native stamps the identity the service allocated, so a source directory names its own take.
  assert.equal(records[0].data.sessionID, started.sourceId);
  assert.equal(records[0].data.microphone, false);
  assert.equal(records[0].data.systemAudio, false);
  const pauses = records.filter((record) => record.event === "pauseEnded");
  assert.equal(pauses.length, 1, "The take must record the pause it was asked for");
  // Paused time is real elapsed time that the media does not contain.
  assert.ok(
    stopped.sourceDurationUs < (elapsed - Date.parse(started.createdAt)) * 1000 - 400_000,
    `Paused time leaked into the source duration: ${stopped.sourceDurationUs}us`,
  );
  const reported = records
    .filter((record) => record.event === "lifecycle")
    .map((r) => r.data.state);
  assert.deepEqual(reported, ["recording", "paused", "recording", "finalizing", "complete"]);
});

test("replays a repeated start onto one take and refuses a concurrent second one", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { source } = await fixtureApp(home);
  const request = { requestId: "once", source };
  const started = await succeeds(home, "capture.start", request);
  assert.deepEqual(await succeeds(home, "capture.start", request), started);

  const competing = await call(home, "capture.start", { requestId: "competing", source });
  assert.equal(competing.ok, false);
  assert.equal(competing.error.code, "INVALID_STATE");
  const refused = competing.error.details.recordingId;
  assert.notEqual(refused, started.recordingId);
  // The refused take keeps an honest terminal identity rather than a false recording state.
  const failed = await succeeds(home, "recording.get", { recordingId: refused });
  assert.equal(failed.state, "interrupted");
  assert.equal(failed.currentRevisionId, null);
  assert.equal(
    (await call(home, "revision.get", { recordingId: refused })).error.code,
    "UNAVAILABLE",
  );
  assert.deepEqual(
    readdirSync(join(home, "recordings")).sort(),
    [refused, started.recordingId].sort(),
  );
  await succeeds(home, "capture.stop", { recordingId: started.recordingId });
});

test("a source this app may not capture fails the start and settles that take", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { source } = await fixtureApp(home);
  const refused = await call(home, "capture.start", {
    requestId: "other-window",
    source: { kind: "window", windowId: source.windowId + 1 },
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, "SOURCE_UNAVAILABLE");
  const settled = await succeeds(home, "recording.get", {
    recordingId: refused.error.details.recordingId,
  });
  assert.equal(settled.state, "interrupted");
  assert.equal(settled.interruptionReason, "SOURCE_UNAVAILABLE");
  assert.equal(settled.sourceDurationUs, null);
  // Nothing was captured, so the device is idle and free for the next take.
  const status = await succeeds(home, "capture.status");
  assert.deepEqual(status, {
    device: { state: "idle", recordingId: null, sourceId: null },
    recording: null,
  });
});

test("cancel discards only its own take's media and restart names a new one", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { source } = await fixtureApp(home);
  const kept = await succeeds(home, "capture.start", { requestId: "kept", source });
  await delay(1_200);
  await succeeds(home, "capture.stop", { recordingId: kept.recordingId });

  const discarded = await succeeds(home, "capture.start", { requestId: "discarded", source });
  await delay(600);
  const restarted = await succeeds(home, "capture.restart", {
    recordingId: discarded.recordingId,
    requestId: "restarted",
    source,
  });
  assert.notEqual(restarted.recordingId, discarded.recordingId);
  assert.equal(restarted.state, "recording");
  assert.deepEqual(
    readdirSync(join(home, "recordings")).sort(),
    [kept.recordingId, restarted.recordingId].sort(),
  );

  await delay(600);
  const canceled = await succeeds(home, "capture.cancel", { recordingId: restarted.recordingId });
  assert.equal(canceled.state, "canceled");
  assert.deepEqual(readdirSync(join(home, "recordings")), [kept.recordingId]);
  // Only the finished take remains discoverable, and it kept its own media.
  assert.equal((await succeeds(home, "recording.latest")).recordingId, kept.recordingId);
  assert.deepEqual(sourceFiles(home, kept.recordingId), ["capture.journal.jsonl", "video.mov"]);
});

test("a service killed mid-capture leaves a take the next service reconciles from its media", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { instance, servicePid, source } = await fixtureApp(home);
  const started = await succeeds(home, "capture.start", { requestId: "orphan", source });
  await delay(1_800);
  process.kill(servicePid, "SIGKILL");
  await instance.waitFor(/service failed code=SERVICE_STOPPED/);
  // Native owns the media, so it finalizes the take into its own journal rather than capturing on
  // unindexed. Nothing restarts the service.
  await waitFor(
    () => journal(home, started.recordingId).some((record) => record.event === "finished"),
    10_000,
    () => "Native never finalized the take its service abandoned",
  );
  assert.deepEqual(instance.children(), []);
  instance.kill("SIGTERM");
  await instance.exited;

  const relaunched = await fixtureApp(home);
  await relaunched.instance.waitFor(/reconciliation complete/);
  const reconciled = await succeeds(home, "recording.get", { recordingId: started.recordingId });
  assert.equal(reconciled.state, "interrupted");
  assert.equal(reconciled.interruptionReason, "CAPTURE_INTERRUPTED");
  assert.ok(reconciled.sourceDurationUs > 0, "The recovered prefix must carry its own duration");
  const original = await succeeds(home, "revision.get", { recordingId: started.recordingId });
  assert.deepEqual(original.revision.spans, [{ startUs: 0, endUs: reconciled.sourceDurationUs }]);
});

test("a take killed before any media is decodable stays terminal with no timeline", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { instance, source } = await fixtureApp(home);
  const started = await succeeds(home, "capture.start", { requestId: "doomed", source });
  // Killed before the writer's first fragment, so nothing it wrote can be decoded.
  instance.kill("SIGKILL");
  await instance.exited;

  const relaunched = await fixtureApp(home);
  await relaunched.instance.waitFor(/reconciliation complete/);
  const settled = await succeeds(home, "recording.get", { recordingId: started.recordingId });
  assert.equal(settled.state, "interrupted");
  assert.equal(settled.interruptionReason, "NO_RECOVERABLE_VIDEO");
  assert.equal(settled.sourceDurationUs, null);
  assert.equal(settled.currentRevisionId, null);
  const unavailable = await call(home, "revision.get", { recordingId: started.recordingId });
  assert.equal(unavailable.error.code, "UNAVAILABLE");
  assert.equal(unavailable.error.details.interruptionReason, "NO_RECOVERABLE_VIDEO");
});

test("a normal quit during capture finalizes the take before the app exits", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { instance, servicePid, source } = await fixtureApp(home);
  const started = await succeeds(home, "capture.start", { requestId: "quit", source });
  await delay(1_500);
  instance.kill("SIGTERM");
  assert.deepEqual(await instance.exited, { code: 0, signal: null });
  assert.equal(alive(servicePid), false);

  const relaunched = await fixtureApp(home);
  await relaunched.instance.waitFor(/reconciliation complete/);
  // Quit finalized it, so the next service has nothing to reconcile and the take is complete.
  const finished = await succeeds(home, "recording.get", { recordingId: started.recordingId });
  assert.equal(finished.state, "complete");
  assert.ok(finished.sourceDurationUs > 1_000_000, `Short take: ${finished.sourceDurationUs}us`);
  const original = await succeeds(home, "revision.get", { recordingId: started.recordingId });
  assert.deepEqual(original.revision.spans, [{ startUs: 0, endUs: finished.sourceDurationUs }]);
});

test("a service lost while a take is starting finalizes it instead of capturing on", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { instance, servicePid, source } = await fixtureApp(home);
  const recordingId = await starting(home, source, "lost-while-starting");
  process.kill(servicePid, "SIGKILL");
  await instance.waitFor(/service failed code=SERVICE_STOPPED/);

  // The start lands with no library left to index or control it, so the app finishes that take
  // into its own journal rather than leaving the device capturing.
  await waitFor(
    () => finalized(home, recordingId),
    15_000,
    () => "A start that outlived its service left the device capturing",
  );
  assert.deepEqual(instance.children(), []);
  assert.equal(instance.running, true, "The app must survive its service");
  instance.kill("SIGTERM");
  await instance.exited;

  const relaunched = await fixtureApp(home);
  await relaunched.instance.waitFor(/reconciliation complete/);
  const settled = await succeeds(home, "recording.get", { recordingId });
  assert.equal(settled.state, "interrupted");
  assert.equal(
    (await succeeds(home, "capture.status")).device.state,
    "idle",
    "The device must be free for the next take",
  );
});

test("a normal quit while a take is starting finalizes it before the app exits", async () => {
  requireScreenPermission();
  const home = temporary("/tmp/scr-capture-");
  const { instance, servicePid, source } = await fixtureApp(home);
  const recordingId = await starting(home, source, "quit-while-starting");
  instance.kill("SIGTERM");

  assert.deepEqual(await instance.exited, { code: 0, signal: null });
  assert.equal(alive(servicePid), false);
  // Quit owns the start it already asked for: the take is finished before the app is gone.
  assert.equal(
    finalized(home, recordingId),
    true,
    "The quit abandoned a take whose start was still running",
  );
});
