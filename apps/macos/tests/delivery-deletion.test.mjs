import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";
import { journalRows } from "./fixtures/generated-capture.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function generated(home, color, frequency) {
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
        ...(state === "complete" ? { sourceDurationUs: 2_000_000 } : {}),
      });
  } finally {
    store.close();
  }
  const directory = join(home, "recordings", take.recordingId),
    source = join(directory, "source");
  await mkdir(source, { recursive: true });
  const encode = (args) => {
    const encoded = spawnSync("ffmpeg", ["-v", "error", ...args], {
      timeout: 15_000,
      encoding: "utf8",
    });
    assert.equal(encoded.status, 0, encoded.stderr);
  };
  encode([
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=64x64:r=2:d=2`,
    "-an",
    "-c:v",
    "libx264",
    "-bf",
    "0",
    join(source, "video.mov"),
  ]);
  encode([
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${frequency}:sample_rate=48000:duration=2`,
    "-c:a",
    "pcm_f32le",
    join(source, "narration.mov"),
  ]);
  const rows = journalRows({ sourceId: take.sourceId, width: 64, height: 64, samples: [] });
  rows[0].data.microphone = true;
  rows.splice(rows.length - 1, 0, {
    event: "audioSamples",
    data: { role: "narration", startUs: 0, endUs: 2_000_000 },
  });
  await writeFile(
    join(source, "capture.journal.jsonl"),
    rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row })).join("\n") + "\n",
  );
  const sourceHashes = () =>
    Promise.all(
      ["video.mov", "narration.mov", "capture.journal.jsonl"].map(async (name) => ({
        name,
        sha256: digest(await readFile(join(source, name))),
      })),
    );
  return { ...take, directory, sourceHashes };
}

test(
  "public deletion revokes held frame, audio and retained-index deliveries only for its recording",
  { timeout: 60_000 },
  async () => {
    const home = temporary("/tmp/scr-delivery-delete-");
    const target = await generated(home, "blue", 1000),
      sibling = await generated(home, "red", 400);
    const siblingSourceBefore = await sibling.sourceHashes();
    const { instance } = await launchReady(home);
    const call = (operation, params = {}) =>
      callLocal(socketPath(home), { id: randomUUID(), operation, params }, { timeoutMs: 20_000 });
    const succeeds = async (operation, params) => {
      const result = await call(operation, params);
      assert.equal(result.ok, true, `${operation}: ${JSON.stringify(result)}`);
      return result.data;
    };
    const ready = (operation, params) =>
      waitFor(async () => {
        const result = await succeeds(operation, params);
        assert.ok(!["failed", "unavailable"].includes(result.state), JSON.stringify(result));
        if (result.state !== "ready") return false;
        if (result.delivery) await succeeds("artifact.close", { token: result.delivery.token });
        return result;
      }, 20_000);
    const requests = async (recordingId) => {
      const frame = { recordingId, revisionId: "r0", atUs: 500_000, clean: true };
      const audio = {
        recordingId,
        revisionId: "r0",
        range: { startUs: 0, endUs: 1_000_000 },
        track: "narration",
      };
      const index = await ready("index.get", { recordingId, limit: 1 });
      await ready("frame.get", frame);
      await ready("audio.get", audio);
      return [
        { kind: "frame", operation: "frame.get", params: frame },
        { kind: "audio", operation: "audio.get", params: audio },
        {
          kind: "retained-index",
          operation: "index.frame",
          params: index.page.entries[0].reference,
        },
      ];
    };
    // Warm both recordings first, then acquire fresh leases together. Expiry must not masquerade as revocation.
    const targetRequests = await requests(target.recordingId),
      siblingRequests = await requests(sibling.recordingId);
    const acquire = async (requests) => {
      const held = [];
      for (const request of requests) {
        const result = await succeeds(request.operation, request.params);
        assert.equal(result.state, "ready");
        const delivery = result.delivery;
        const read = await succeeds("artifact.read", {
          token: delivery.token,
          offset: 0,
          maxBytes: 524288,
        });
        assert.equal(read.eof, true);
        const bytes = Buffer.from(read.data, "base64");
        assert.equal(bytes.length, delivery.bytes);
        assert.ok(bytes.length > 16);
        if (request.kind === "audio") assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
        else assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        // EOF intentionally retains the handle so retrying a lost response remains possible.
        held.push({ ...request, delivery, bytes });
      }
      return held;
    };
    const targetHeld = await acquire(targetRequests),
      siblingHeld = await acquire(siblingRequests);
    const usageBefore = await succeeds("storage.usage", { recordingId: target.recordingId });
    const siblingUsageBefore = await succeeds("storage.usage", {
      recordingId: sibling.recordingId,
    });
    const earliestDeadline = Math.min(
      ...[...targetHeld, ...siblingHeld].map(({ delivery }) => delivery.expiresAt),
    );
    assert.ok(Date.now() < earliestDeadline, "All leases must remain live when deletion begins");
    const deleted = await succeeds("recording.delete", { recordingId: target.recordingId });
    assert.deepEqual(deleted, { recordingId: target.recordingId, deleted: true });
    assert.equal(existsSync(target.directory), false);
    const matrix = [];
    for (const held of targetHeld) {
      const read = await call("artifact.read", {
        token: held.delivery.token,
        offset: 16,
        maxBytes: 524288,
      });
      assert.equal(read.ok, false, `${held.kind} remained readable after deletion`);
      assert.equal(read.error.code, "ARTIFACT_EXPIRED", held.kind);
      assert.ok(
        Date.now() < held.delivery.expiresAt,
        `${held.kind} must be revoked before natural expiry`,
      );
      const reopen = await call(held.operation, held.params);
      assert.equal(reopen.ok, false);
      assert.equal(reopen.error.code, "NOT_FOUND", held.kind);
      matrix.push({
        kind: held.kind,
        revoked: read.error.code,
        reacquire: reopen.error.code,
        bytesBefore: held.bytes.length,
      });
    }
    for (const held of siblingHeld) {
      const read = await succeeds("artifact.read", {
        token: held.delivery.token,
        offset: 16,
        maxBytes: 524288,
      });
      assert.equal(read.eof, true);
      assert.deepEqual(Buffer.from(read.data, "base64"), held.bytes.subarray(16), held.kind);
      await succeeds("artifact.close", { token: held.delivery.token });
      matrix.find(({ kind }) => kind === held.kind).siblingSha256 = digest(held.bytes);
    }
    const usageAfter = await call("storage.usage", { recordingId: target.recordingId });
    assert.equal(usageAfter.ok, false);
    assert.equal(usageAfter.error.code, "NOT_FOUND");
    const siblingUsageAfter = await succeeds("storage.usage", { recordingId: sibling.recordingId });
    const { observedAt: _beforeTime, ...before } = siblingUsageBefore;
    const { observedAt: _afterTime, ...after } = siblingUsageAfter;
    assert.deepEqual(after, before);
    assert.deepEqual(await sibling.sourceHashes(), siblingSourceBefore);
    assert.equal((await succeeds("service.health")).status, "ready");
    assert.deepEqual(await instance.reap(), []);
    const report = {
      generated: true,
      ownedProcessesReaped: true,
      deleted,
      matrix,
      usageBefore,
      usageAfter: usageAfter.error.code,
      siblingUsageBefore,
      siblingUsageAfter,
      siblingSourceHashes: siblingSourceBefore,
      scope:
        "Generated native frame/audio/index delivery leases through the packaged service; no capture devices.",
    };
    console.log(JSON.stringify(report));
    if (process.env.SCREENREC_DELIVERY_DELETE_EVIDENCE)
      await writeFile(
        process.env.SCREENREC_DELIVERY_DELETE_EVIDENCE,
        JSON.stringify(report, null, 2) + "\n",
        { flag: "wx" },
      );
  },
);
