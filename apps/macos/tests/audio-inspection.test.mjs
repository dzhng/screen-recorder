import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { RevisionStore } from "@screenrec/core/library";
import { DerivedCache } from "@screenrec/core/cache";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-v", "error", ...args], {
    timeout: 20000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}

test("public audio preserves cuts, acquisition gaps, pinned revisions and CLI/MCP bytes", async () => {
  const home = temporary("/tmp/scr-audio-public-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated two-track audio",
    sourceDurationUs: 4000000,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  for (const [role, frequency] of [
    ["narration", 1000],
    ["system", 400],
  ]) {
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${frequency}:sample_rate=48000:duration=4`,
      "-c:a",
      "pcm_f32le",
      join(source, role + ".mov"),
    ]);
  }
  const records = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: take.sourceId,
        source: { kind: "display", displayID: 1 },
        width: 100,
        height: 80,
        microphone: true,
        systemAudio: true,
      },
    },
    { event: "origin", data: { hostUs: 1000 } },
    { event: "audioSamples", data: { role: "narration", startUs: 0, endUs: 2500000 } },
    { event: "audioSamples", data: { role: "narration", startUs: 3000000, endUs: 4000000 } },
    { event: "audioSamples", data: { role: "system", startUs: 0, endUs: 4000000 } },
    { event: "finished", data: {} },
  ];
  await writeFile(
    join(source, "capture.journal.jsonl"),
    records.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
  );
  const hashes = async () =>
    Promise.all(
      ["narration.mov", "system.mov", "capture.journal.jsonl"].map(async (name) =>
        createHash("sha256")
          .update(await readFile(join(source, name)))
          .digest("hex"),
      ),
    );
  const original = await hashes();
  let { instance } = await launchReady(home);
  const call = async (operation, params = {}) => {
    const result = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  const audio = async (params) =>
    waitFor(async () => {
      const result = await call("audio.get", params);
      if (["failed", "unavailable"].includes(result.state)) throw new Error(JSON.stringify(result));
      if (result.state !== "ready") return false;
      await call("artifact.close", { token: result.delivery.token });
      return result;
    }, 20000);
  const edited = await call("edit.cut", {
    recordingId: take.recordingId,
    expectedRevisionId: "r0",
    requestId: randomUUID(),
    ranges: [{ startUs: 1000000, endUs: 2000000 }],
  });
  const params = {
    recordingId: take.recordingId,
    revisionId: edited.revision.id,
    range: { startUs: 500000, endUs: 2500000 },
    track: "mix",
  };
  const ready = await audio(params);
  const excerpt = ready.published.audio;
  assert.deepEqual(excerpt.spans, [
    { startUs: 500000, endUs: 1000000 },
    { startUs: 2000000, endUs: 3500000 },
  ]);
  assert.equal(excerpt.durationUs, 2000000);
  assert.deepEqual(
    excerpt.tracks.map((t) => [t.role, t.gain]),
    [
      ["narration", 0.5],
      ["system", 0.5],
    ],
  );
  assert.deepEqual(excerpt.tracks[0].unavailable, [{ startUs: 2500000, endUs: 3000000 }]);
  assert.deepEqual(excerpt.missingRoles, []);
  const output = join(home, "excerpt.wav");
  const run = spawnSync(
    process.execPath,
    [
      cli,
      "audio.get",
      "--socket",
      socketPath(home),
      "--params",
      JSON.stringify(params),
      "--output",
      output,
    ],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const wave = await readFile(output);
  assert.equal(wave.subarray(0, 4).toString(), "RIFF");
  const client = new Client({ name: "audio-proof", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--socket", socketPath(home)],
        stderr: "pipe",
      }),
    );
    const result = await client.callTool({ name: "audio.get", arguments: params });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent.data.published, ready.published);
    const content = result.content.find((item) => item.type === "audio");
    assert.equal(content.mimeType, "audio/wav");
    assert.deepEqual(Buffer.from(content.data, "base64"), wave);
  } finally {
    await client.close();
  }
  // Independent sample oracle: the missing narration interval must lose its 1 kHz component.
  const pcm = ffmpeg(["-i", output, "-f", "f32le", "-ac", "1", "-ar", "48000", "pipe:1"]);
  assert.equal(pcm.length, 96000 * 4);
  const amplitude = (second, frequency) => {
    const start = Math.round(second * 48000),
      count = 4800;
    let real = 0,
      imaginary = 0;
    for (let i = 0; i < count; i++) {
      const sample = pcm.readFloatLE((start + i) * 4),
        angle = (2 * Math.PI * frequency * i) / 48000;
      real += sample * Math.cos(angle);
      imaginary += sample * Math.sin(angle);
    }
    return (2 * Math.hypot(real, imaginary)) / count;
  };
  assert.ok(amplitude(0.2, 1000) > 0.055);
  assert.ok(amplitude(1.2, 1000) < 0.001);
  assert.ok(amplitude(1.2, 400) > 0.055);
  assert.ok(amplitude(1.7, 1000) > 0.055);
  assert.deepEqual((await audio(params)).published, ready.published);
  const historical = await audio({ ...params, revisionId: "r0" });
  assert.deepEqual(historical.published.audio.spans, [{ startUs: 500000, endUs: 2500000 }]);
  const current = await audio({ recordingId: take.recordingId, range: params.range, track: "mix" });
  assert.deepEqual(current.published, ready.published);
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
  const catalog = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  try {
    const cache = new DerivedCache(catalog, home, 1);
    await cache.reconcile();
    assert.equal(cache.acquire(excerpt.cacheId), null);
  } finally {
    catalog.close();
  }
  ({ instance } = await launchReady(home));
  const regenerated = await audio(params);
  assert.equal(regenerated.published.generation, ready.published.generation + 1);
  assert.equal(regenerated.revisionId, edited.revision.id);
  assert.deepEqual(await readFile(regenerated.published.audio.file), wave);
  assert.deepEqual(await hashes(), original);
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
});

// Generated journals describe acquisition independently of media files, just as capture does.
async function singleTrackFixture(home, availableRole, missingRequested, writeMedia = true) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated single-track audio",
    sourceDurationUs: 1000000,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  const records = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: take.sourceId,
        source: { kind: "display", displayID: 1 },
        width: 100,
        height: 80,
        microphone: availableRole === "narration" || missingRequested,
        systemAudio: availableRole === "system" || missingRequested,
      },
    },
    { event: "origin", data: { hostUs: 1000 } },
    { event: "audioSamples", data: { role: availableRole, startUs: 0, endUs: 1000000 } },
    { event: "finished", data: {} },
  ];
  await writeFile(
    join(source, "capture.journal.jsonl"),
    records.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
  );
  const media = join(source, `${availableRole}.mov`);
  const generate = () =>
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:sample_rate=48000:duration=1",
      "-c:a",
      "pcm_f32le",
      media,
    ]);
  if (writeMedia) generate();
  return { take, media, generate };
}

function publicAudioClient(home) {
  const request = (operation, params) =>
    callLocal(socketPath(home), { id: randomUUID(), operation, params });
  const call = async (operation, params) => {
    const response = await request(operation, params);
    assert.equal(response.ok, true, JSON.stringify(response));
    return response.data;
  };
  const ready = (params) =>
    waitFor(async () => {
      const result = await call("audio.get", params);
      assert.ok(!["failed", "unavailable"].includes(result.state), JSON.stringify(result));
      if (result.state !== "ready") return false;
      await call("artifact.close", { token: result.delivery.token });
      return result;
    }, 20000);
  return { request, call, ready };
}

test("public audio distinguishes unrequested and unacquired roles and mixes one track at unity", async () => {
  const home = temporary("/tmp/scr-audio-absence-");
  const fixtures = [];
  for (const role of ["narration", "system"])
    for (const missingRequested of [false, true])
      fixtures.push({
        ...(await singleTrackFixture(home, role, missingRequested)),
        role,
        missingRequested,
      });
  const { instance } = await launchReady(home);
  const { request, ready } = publicAudioClient(home);
  for (const { take, media, role, missingRequested } of fixtures) {
    const params = {
      recordingId: take.recordingId,
      range: { startUs: 0, endUs: 1000000 },
      track: "mix",
    };
    const result = await ready(params);
    const missing = {
      role: role === "narration" ? "system" : "narration",
      reason: missingRequested ? "not_acquired" : "not_requested",
    };
    assert.deepEqual(result.published.audio.missingRoles, [missing]);
    assert.deepEqual(
      result.published.audio.tracks.map((t) => [t.role, t.gain]),
      [[role, 1]],
    );
    const refused = await request("audio.get", { ...params, track: missing.role });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "UNAVAILABLE");
    assert.deepEqual(refused.error.details.missingRoles, [missing]);
    // Decode both containers independently: metadata alone cannot prove unity gain.
    const samples = (path) =>
      ffmpeg(["-i", path, "-f", "f32le", "-ac", "1", "-ar", "48000", "pipe:1"]);
    assert.deepEqual(samples(result.published.audio.file), samples(media));
  }
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
});

test("public audio keeps native failure until explicit retry after fixture repair", async () => {
  const home = temporary("/tmp/scr-audio-retry-");
  // This deliberately incomplete generated fixture claims acquisition but lacks its container.
  const { take, media, generate } = await singleTrackFixture(home, "narration", false, false);
  const { instance } = await launchReady(home);
  const { call, ready } = publicAudioClient(home);
  const params = {
    recordingId: take.recordingId,
    range: { startUs: 0, endUs: 1000000 },
    track: "narration",
  };
  const failed = await waitFor(async () => {
    const status = await call("audio.get", params);
    assert.notEqual(status.state, "ready");
    return status.state === "failed" && status;
  }, 20000);
  assert.equal(failed.dependency, null);
  assert.equal(failed.published, null);
  assert.match(failed.reason, /No source media/);
  assert.equal(failed.retryable, true);
  generate();
  const original = createHash("sha256")
    .update(await readFile(media))
    .digest("hex");
  for (let i = 0; i < 3; i++) assert.deepEqual(await call("audio.get", params), failed);
  const retry = await call("audio.retry", params);
  assert.equal(retry.jobId, failed.jobId);
  assert.equal(retry.revisionId, "r0");
  assert.notEqual(retry.state, "failed");
  const result = await ready(params);
  assert.equal(result.jobId, failed.jobId);
  assert.equal(result.published.audio.durationUs, 1000000);
  assert.deepEqual(
    result.published.audio.tracks.map((t) => [t.role, t.gain]),
    [["narration", 1]],
  );
  assert.equal(
    createHash("sha256")
      .update(await readFile(media))
      .digest("hex"),
    original,
  );
  const repeated = await call("audio.retry", params);
  assert.deepEqual(repeated.published, result.published);
  await call("artifact.close", { token: repeated.delivery.token });
  instance.kill("SIGTERM");
  await waitFor(() => !instance.running, 15000);
  assert.equal((await instance.exited).code, 0);
});
