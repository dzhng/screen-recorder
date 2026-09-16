import assert from "node:assert/strict";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { callLocal } from "@screenrec/client";
import { alive, launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const peer = fileURLToPath(new URL("./fixtures/terminal-peer.mjs", import.meta.url));
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

// The fake service can delay the app's finalizing report while sending a second native call.
// This reaches the actual Controller await point without adding a production test hook.
test(
  "cancel joins a controller finalization held at its service report",
  { timeout: 45_000 },
  async () => {
    const home = temporary("/tmp/scr-native-terminal-");
    const interpreter = join(home, "node");
    writeFileSync(
      interpreter,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then exec ${quote(process.execPath)} --version; fi\nexec ${quote(process.execPath)} ${quote(peer)}\n`,
    );
    chmodSync(interpreter, 0o755);
    const { instance, servicePid } = await launchReady(home, {
      SCREENREC_NODE: interpreter,
      SCREENREC_FIXTURE_WINDOW: "1",
    });
    const [, fixtureId] = await instance.waitFor(/capture fixture window=(\d+)/);
    const call = (operation, params = {}) =>
      callLocal(socketPath(home), { id: randomUUID(), operation, params }, { timeoutMs: 25_000 });
    const native = (operation, params = {}) => call("peer.native", { operation, params });
    const selection = {
      source: { kind: "window", windowId: Number(fixtureId) },
      microphone: false,
      systemAudio: false,
    };
    const first = {
      ...selection,
      recordingId: randomUUID(),
      sourceId: randomUUID(),
      outputDirectory: join(home, "first"),
    };
    const second = {
      ...selection,
      recordingId: randomUUID(),
      sourceId: randomUUID(),
      outputDirectory: join(home, "second"),
    };
    const started = await native("capture.start", first);
    assert.equal(started.ok, true, JSON.stringify(started));
    await delay(250);
    const stopping = native("capture.stop", { recordingId: first.recordingId }).catch((error) => ({
      ok: false,
      error,
    }));
    await waitFor(async () => (await call("peer.status")).data.held, 5_000);
    const canceling = native("capture.cancel", { recordingId: first.recordingId }).catch(
      (error) => ({ ok: false, error }),
    );
    await waitFor(
      async () => (await call("peer.status")).data.pending.includes("capture.cancel"),
      5_000,
    );
    const held = await native("capture.status");
    assert.equal(held.ok, true);
    assert.equal(
      held.data.state,
      "recording",
      "A joined cancel cannot discard while its owner's finalizing report is held",
    );
    assert.equal(held.data.recordingId, first.recordingId);
    const premature = await native("capture.start", second);
    assert.equal(premature.ok, false);
    assert.equal(premature.error.code, "INVALID_STATE");
    await call("peer.release");
    const [stopped, canceled] = await Promise.all([stopping, canceling]);
    assert.equal(stopped.ok, true, JSON.stringify(stopped));
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.deepEqual(
      canceled.data,
      stopped.data,
      "Joined terminal callers receive the same pinned receipt",
    );
    assert.equal(stopped.data.recordingId, first.recordingId);
    assert.equal(stopped.data.sourceId, first.sourceId);
    const firstJournal = join(first.outputDirectory, "capture.journal.jsonl");
    const finalized = readFileSync(firstJournal);
    const replacement = await native("capture.start", second);
    assert.equal(replacement.ok, true, JSON.stringify(replacement));
    await delay(250);
    const running = await native("capture.status");
    assert.equal(running.data.recordingId, second.recordingId);
    assert.equal(running.data.state, "recording");
    assert.deepEqual(
      readFileSync(firstJournal),
      finalized,
      "Old terminal work cannot append after a replacement starts",
    );
    const replacementStopped = await native("capture.stop", { recordingId: second.recordingId });
    assert.equal(replacementStopped.ok, true, JSON.stringify(replacementStopped));
    instance.kill("SIGTERM");
    await instance.exited;
    assert.equal(alive(servicePid), false);
  },
);
