import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { RevisionStore } from "@screenrec/core/library";
import { DerivedCache } from "@screenrec/core/cache";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";
import { journalRows } from "./fixtures/generated-capture.mjs";
const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
function run(command, args, encoding = "utf8") {
  const result = spawnSync(command, args, {
    encoding,
    timeout: 20000,
    maxBuffer: 8 * 1024 ** 2,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function pointerPixels(file, second, x, y) {
  const rgb = run(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-i",
      file,
      "-ss",
      String(second),
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    null,
  );
  assert.equal(rgb.length, 320 * 180 * 3);
  let bright = 0;
  for (let yy = y; yy < y + 16; yy++)
    for (let xx = x; xx < x + 12; xx++) if (rgb[(yy * 320 + xx) * 3] > 200) bright++;
  return bright;
}

test("public preview pins its revision and delivers a current-pointer movie through the CLI", async () => {
  const home = temporary("/tmp/screenrec-public-preview-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated preview",
    sourceDurationUs: 4_000_000,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  run("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=gray:s=320x180:r=1:d=4",
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    join(source, "video.mov"),
  ]);
  const samples = [
    [500000, 40, 50],
    [1500000, 100, 90],
    [3100000, 200, 40],
  ].map(([sourceUs, x, y]) => ({
    sourceUs,
    x,
    y,
    globalX: x,
    globalY: y,
    buttons: 0,
    eligibility: "inside",
    geometryEpoch: 1,
  }));
  const rows = journalRows({
    sourceId: take.sourceId,
    width: 320,
    height: 180,
    samples,
    pauses: [{ kind: "pause", atSourceUs: 2500000, elapsedPauseUs: 60000000 }],
  });
  await writeFile(
    join(source, "capture.journal.jsonl"),
    rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
  );
  const before = sha(await readFile(join(source, "video.mov")));
  let { instance } = await launchReady(home);
  const call = async (operation, params = {}) => {
    const result = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  const preview = (params) =>
    waitFor(async () => {
      const result = await call("preview.get", params);
      if (["failed", "unavailable"].includes(result.state)) throw new Error(JSON.stringify(result));
      return result.state === "ready" && result;
    }, 20000);
  try {
    const initial = await call("preview.get", { recordingId: take.recordingId });
    const cut = await call("edit.cut", {
      recordingId: take.recordingId,
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [{ startUs: 1000000, endUs: 2000000 }],
    });
    const params = { recordingId: take.recordingId, revisionId: initial.revisionId };
    const ready = await preview(params);
    assert.equal(ready.published.preview.revisionId, "r0");
    assert.equal(ready.published.preview.durationUs, 4_000_000);
    assert.deepEqual(ready.published.preview.missingRoles, [
      { role: "narration", reason: "not_requested" },
      { role: "system", reason: "not_requested" },
    ]);
    await call("artifact.close", { token: ready.delivery.token });
    const output = join(home, "preview.mp4");
    const result = JSON.parse(
      run(process.execPath, [
        cli,
        "preview.get",
        "--socket",
        socketPath(home),
        "--params",
        JSON.stringify(params),
        "--output",
        output,
      ]),
    );
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.output, output);
    const info = JSON.parse(
      run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", output]),
    );
    assert.equal(Number(info.format.duration), 4);
    assert.equal(pointerPixels(output, 0, 40, 50), 0);
    assert.ok(pointerPixels(output, 0.5, 40, 50) > 10);
    assert.ok(pointerPixels(output, 1.5, 100, 90) > 10);
    assert.equal(pointerPixels(output, 1.5, 40, 50), 0, "old pointer is not a trail");
    assert.equal(pointerPixels(output, 2.5, 100, 90), 0, "pause clears held pointer");
    assert.ok(pointerPixels(output, 3.1, 200, 40) > 10);
    const client = new Client({ name: "preview-proof", version: "1" });
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [cli, "mcp", "--socket", socketPath(home)],
          stderr: "pipe",
        }),
      );
      const response = await client.callTool({ name: "preview.get", arguments: params });
      assert.equal(response.isError, false);
      const delivered = response.structuredContent.data;
      assert.deepEqual(delivered.published, ready.published);
      const chunks = [];
      for (let offset = 0; offset < delivered.delivery.bytes;) {
        const response = await client.callTool({
          name: "artifact.read",
          arguments: {
            token: delivered.delivery.token,
            offset,
            maxBytes: 1024,
          },
        });
        assert.equal(response.isError, false);
        const part = response.structuredContent.data;
        const bytes = Buffer.from(part.data, "base64");
        assert.equal(part.offset, offset);
        assert.ok(bytes.length > 0 && bytes.length <= 1024);
        offset += bytes.length;
        assert.equal(part.nextOffset, offset);
        assert.equal(part.eof, offset === delivered.delivery.bytes);
        chunks.push(bytes);
      }
      assert.deepEqual(Buffer.concat(chunks), await readFile(output));
      await client.callTool({
        name: "artifact.close",
        arguments: { token: delivered.delivery.token },
      });
    } finally {
      await client.close();
    }
    assert.equal(
      (await call("revision.get", { recordingId: take.recordingId })).revision.id,
      cut.revision.id,
    );
    assert.equal(sha(await readFile(join(source, "video.mov"))), before);
    const editedParams = { recordingId: take.recordingId, revisionId: cut.revision.id };
    const edited = await preview(editedParams);
    assert.equal(edited.published.preview.durationUs, 3_000_000);
    await call("artifact.close", { token: edited.delivery.token });
    const editedFile = join(home, "edited.mp4");
    const download = JSON.parse(
      run(process.execPath, [
        cli,
        "preview.get",
        "--socket",
        socketPath(home),
        "--params",
        JSON.stringify(editedParams),
        "--output",
        editedFile,
      ]),
    );
    assert.equal(download.ok, true, JSON.stringify(download));
    assert.ok(pointerPixels(editedFile, 0.5, 40, 50) > 10);
    assert.equal(pointerPixels(editedFile, 1, 40, 50), 0, "cut clears earlier retained pointer");
    assert.equal(
      pointerPixels(editedFile, 1, 100, 90),
      0,
      "deleted pointer cannot leak across cut",
    );
    assert.ok(pointerPixels(editedFile, 2.1, 200, 40) > 10);
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
      assert.equal(cache.acquire(edited.published.preview.cacheId), null);
    } finally {
      catalog.close();
    }
    ({ instance } = await launchReady(home));
    const regenerated = await preview(editedParams);
    assert.equal(regenerated.published.generation, edited.published.generation + 1);
    assert.equal(regenerated.revisionId, editedParams.revisionId);
    const regeneratedFile = join(home, "regenerated.mp4");
    const regeneratedDownload = JSON.parse(
      run(process.execPath, [
        cli,
        "preview.get",
        "--socket",
        socketPath(home),
        "--params",
        JSON.stringify(editedParams),
        "--output",
        regeneratedFile,
      ]),
    );
    assert.equal(regeneratedDownload.ok, true, JSON.stringify(regeneratedDownload));
    // The MP4 container can change bookkeeping; the decoded edited pointer must not change.
    assert.ok(pointerPixels(regeneratedFile, 2.1, 200, 40) > 10);
    assert.equal(sha(await readFile(join(source, "video.mov"))), before);
    // A prior failed attempt may have left private staging after its worker exited.
    await writeFile(join(home, "run", "render", "abandoned.mp4"), "staged recording bytes");
    await call("recording.delete", { recordingId: take.recordingId });
    assert.deepEqual(await readdir(join(home, "run", "render")), []);
    const revoked = await callLocal(socketPath(home), {
      id: randomUUID(),
      operation: "artifact.read",
      params: { token: regenerated.delivery.token, offset: 0, maxBytes: 1 },
    });
    assert.equal(revoked.ok, false);
    assert.equal(revoked.error.code, "ARTIFACT_EXPIRED");
  } finally {
    await instance.reap();
  }
});
