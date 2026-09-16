import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import {
  alive,
  app,
  childProcessesOf,
  launchReady,
  socketPath,
  temporary,
  waitFor,
} from "./harness.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function generated(home, seconds) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  let take;
  try {
    take = store.allocate().recording;
    for (const [i, state] of ["recording", "finalizing", "complete"].entries())
      store.ingestLifecycle(take.recordingId, {
        sourceId: take.sourceId,
        sequence: i + 1,
        state,
        ...(state === "complete" ? { sourceDurationUs: seconds * 1_000_000 } : {}),
      });
  } finally {
    store.close();
  }
  const directory = join(home, "recordings", take.recordingId),
    source = join(directory, "source");
  await mkdir(source, { recursive: true });
  const video = join(source, "video.mov");
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=c=blue:s=320x180:r=30:d=${seconds}`,
      "-an",
      "-c:v",
      "libx264",
      "-bf",
      "0",
      video,
    ],
    { timeout: 15_000, encoding: "utf8" },
  );
  assert.equal(encoded.status, 0, encoded.stderr);
  const rows = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: take.sourceId,
        source: { kind: "window", windowID: 1 },
        width: 320,
        height: 180,
        microphone: false,
        systemAudio: false,
      },
    },
    { event: "origin", data: { hostUs: 1_000_000 } },
    {
      event: "geometry",
      data: {
        epoch: 1,
        hostUs: 1_000_000,
        sourceUs: 0,
        geometry: {
          outputWidth: 320,
          outputHeight: 180,
          contentScale: 1,
          scaleFactor: 1,
          contentRect: { x: 0, y: 0, width: 320, height: 180 },
          screenRect: { x: 0, y: 0, width: 320, height: 180 },
        },
      },
    },
    { event: "finished", data: {} },
  ];
  await writeFile(
    join(source, "capture.journal.jsonl"),
    rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row })).join("\n") + "\n",
  );
  return { ...take, directory, video };
}

test(
  "public deletion reaps a live native media worker before removing its recording",
  { timeout: 60_000 },
  async () => {
    const home = temporary("/tmp/scr-worker-delete-");
    const sibling = await generated(home, 2);
    const { instance, servicePid } = await launchReady(home);
    const call = (operation, params = {}) =>
      callLocal(socketPath(home), { id: randomUUID(), operation, params }, { timeoutMs: 20_000 });
    const succeeds = async (operation, params) => {
      const result = await call(operation, params);
      assert.equal(result.ok, true, `${operation}: ${JSON.stringify(result)}`);
      return result.data;
    };
    const siblingIndex = await waitFor(async () => {
      const result = await succeeds("index.get", { recordingId: sibling.recordingId, limit: 1 });
      if (["failed", "unavailable"].includes(result.state)) throw new Error(JSON.stringify(result));
      return result.state === "ready" && result;
    }, 20_000);
    const reference = siblingIndex.page.entries[0].reference;
    const readSibling = async () => {
      const frame = await succeeds("index.frame", reference);
      try {
        const chunk = await succeeds("artifact.read", {
          token: frame.delivery.token,
          offset: 0,
          maxBytes: 524288,
        });
        assert.equal(chunk.eof, true);
        return Buffer.from(chunk.data, "base64");
      } finally {
        await succeeds("artifact.close", { token: frame.delivery.token });
      }
    };
    const siblingImage = await readSibling(),
      siblingHash = digest(await readFile(sibling.video));
    const siblingUsage = await succeeds("storage.usage", { recordingId: sibling.recordingId });
    // Seed only after the sibling is ready, so the service's sole native media child is attributable.
    const take = await generated(home, 30);
    await succeeds("index.get", { recordingId: take.recordingId, limit: 1 });
    const native = join(app, "..", "screenrec-native");
    let worker;
    await waitFor(
      () => {
        const candidate = childProcessesOf(servicePid).find((child) => child.command === native);
        if (!candidate) return false;
        try {
          process.kill(candidate.pid, "SIGSTOP");
        } catch (error) {
          if (error.code === "ESRCH") return false;
          throw error;
        }
        instance.owned.push(candidate.pid);
        worker = candidate;
        return true;
      },
      5_000,
      () => instance.diagnostics,
    );
    const state = execFileSync("/bin/ps", ["-o", "stat=", "-p", String(worker.pid)], {
      encoding: "utf8",
    }).trim();
    assert.match(state, /T/, "The actual native worker must be stopped before deletion starts");
    const catalog = new DatabaseSync(join(home, "library.sqlite"), { readOnly: true });
    let active;
    try {
      catalog.exec("PRAGMA busy_timeout=1000");
      active = catalog.prepare("SELECT recordingId,artifact FROM jobs WHERE state='running'").all();
    } finally {
      catalog.close();
    }
    assert.ok(active.length > 0);
    assert.ok(
      active.every((job) => job.recordingId === take.recordingId),
      JSON.stringify(active),
    );
    assert.ok(
      active.some((job) =>
        ["source-evidence", "source-scenes", "screenshot-index"].includes(job.artifact),
      ),
    );
    assert.equal(existsSync(take.directory), true);
    assert.equal(alive(worker.pid), true);

    const usageBefore = await succeeds("storage.usage", { recordingId: take.recordingId });
    assert.ok(usageBefore.sourceBytes > 0);
    let finished = false,
      observations = 0,
      sawDirectoryRemoved = false;
    const deletion = call("recording.delete", { recordingId: take.recordingId }).finally(() => {
      finished = true;
    });
    const monitor = (async () => {
      do {
        const present = existsSync(take.directory);
        if (!present) {
          sawDirectoryRemoved = true;
          assert.equal(
            alive(worker.pid),
            false,
            "Recording directory disappeared while its native media worker was alive",
          );
        }
        observations++;
        await delay(1);
      } while (!finished);
    })();
    const [result] = await Promise.all([deletion, monitor]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.data, { recordingId: take.recordingId, deleted: true });
    assert.equal(alive(worker.pid), false);
    assert.equal(existsSync(take.directory), false);
    assert.equal(
      (await call("recording.get", { recordingId: take.recordingId })).error.code,
      "NOT_FOUND",
    );
    const usageAfter = await call("storage.usage", { recordingId: take.recordingId });
    assert.equal(usageAfter.ok, false);
    assert.equal(usageAfter.error.code, "NOT_FOUND");
    const siblingUsageAfter = await succeeds("storage.usage", { recordingId: sibling.recordingId });
    const { observedAt: _beforeTime, ...beforeBytes } = siblingUsage;
    const { observedAt: _afterTime, ...afterBytes } = siblingUsageAfter;
    assert.deepEqual(afterBytes, beforeBytes);
    assert.deepEqual(await readSibling(), siblingImage);
    assert.equal(digest(await readFile(sibling.video)), siblingHash);
    assert.equal((await succeeds("service.health")).status, "ready");
    assert.deepEqual(await instance.reap(), []);
    const report = {
      generated: true,
      ownedProcessesReaped: true,
      usageBefore,
      usageAfter: usageAfter.error.code,
      siblingUsage,
      siblingUsageAfter,
      servicePid,
      workerPid: worker.pid,
      workerStateBeforeDelete: state,
      active,
      observations,
      sawDirectoryRemoved,
      deleted: result.data,
      workerGone: !alive(worker.pid),
      directoryGone: !existsSync(take.directory),
      siblingImageSha256: digest(siblingImage),
      siblingSourceSha256: siblingHash,
      siblingUsable: true,
      scope:
        "Generated media with an OS-stopped real native worker; no capture devices or user recordings.",
    };
    console.log(JSON.stringify(report));
    if (process.env.SCREENREC_WORKER_DELETE_EVIDENCE)
      await writeFile(
        process.env.SCREENREC_WORKER_DELETE_EVIDENCE,
        JSON.stringify(report, null, 2) + "\n",
        { flag: "wx" },
      );
  },
);
