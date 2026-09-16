import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { callLocal } from "@screenrec/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { app, finderEnvironment, launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const cli = new URL("../../cli/dist/main.js", import.meta.url).pathname;
test("real clean frames retain edit identity and reach CLI files and MCP pixels", async () => {
  const preflight = JSON.parse(
    spawnSync(app, ["--capture-preflight"], {
      env: finderEnvironment,
      encoding: "utf8",
      timeout: 20000,
    }).stdout || "{}",
  );
  assert.equal(preflight.screen, true);
  const home = temporary("/tmp/scr-frame-delivery-");
  const { instance } = await launchReady(home, { SCREENREC_FIXTURE_WINDOW: "1" });
  const [, window] = await instance.waitFor(/capture fixture window=(\d+)/);
  const call = async (operation, params = {}) => {
    const result = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  const take = await call("capture.start", {
    requestId: randomUUID(),
    source: { kind: "window", windowId: Number(window) },
    microphone: false,
    systemAudio: false,
  });
  await waitFor(async () => (await call("capture.status")).device.elapsedUs >= 1000000, 20000);
  const finished = await call("capture.stop", { recordingId: take.recordingId });
  const source = join(home, "recordings", take.recordingId, "source", "video.mov");
  const hash = async () =>
    createHash("sha256")
      .update(await readFile(source))
      .digest("hex");
  const originalHash = await hash();
  const params = { recordingId: take.recordingId, revisionId: "r0", atUs: 400000, clean: true };
  const ready = await waitFor(async () => {
    const result = await call("frame.get", params);
    if (result.state === "failed" || result.state === "unavailable")
      throw new Error(JSON.stringify(result));
    return result.state === "ready" && result;
  }, 20000);
  assert.ok(ready.published.frame.actualSourceUs < finished.sourceDurationUs);
  await call("artifact.close", { token: ready.delivery.token });
  const output = join(home, "delivered.png");
  const command = spawnSync(
    process.execPath,
    [
      cli,
      "frame.get",
      "--socket",
      socketPath(home),
      "--params",
      JSON.stringify(params),
      "--output",
      output,
    ],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(command.status, 0, command.stdout + command.stderr);
  const result = JSON.parse(command.stdout);
  assert.equal(result.data.output, output);
  const bytes = await readFile(output);
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.equal(bytes.readUInt32BE(16), ready.published.frame.width);
  assert.equal(bytes.readUInt32BE(20), ready.published.frame.height);
  assert.equal(result.data.published.frame.cacheId, ready.published.frame.cacheId);
  if (process.env.SCREENREC_FRAME_EVIDENCE) {
    await mkdir(process.env.SCREENREC_FRAME_EVIDENCE, { recursive: true });
    await copyFile(output, join(process.env.SCREENREC_FRAME_EVIDENCE, "delivered.png"));
  }

  const client = new Client({ name: "frame-delivery-proof", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, "mcp", "--socket", socketPath(home)],
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const response = await client.callTool({ name: "frame.get", arguments: params });
    assert.equal(response.isError, false);
    const image = response.content.find((item) => item.type === "image");
    assert.equal(image?.mimeType, "image/png");
    assert.deepEqual(Buffer.from(image.data, "base64"), bytes);
  } finally {
    await client.close();
  }

  const cropped = await waitFor(async () => {
    const result = await call("frame.get", {
      ...params,
      crop: { x: 20, y: 30, width: 200, height: 100 },
      maxLongEdge: 8192,
    });
    if (result.state === "failed" || result.state === "unavailable")
      throw new Error(JSON.stringify(result));
    return result.state === "ready" && result;
  }, 20000);
  assert.equal(cropped.published.frame.width, 200);
  assert.equal(cropped.published.frame.height, 100);
  assert.equal(cropped.published.frame.actualSourceUs, ready.published.frame.actualSourceUs);
  assert.deepEqual(cropped.published.frame.crop, { x: 20, y: 30, width: 200, height: 100 });
  await call("artifact.close", { token: cropped.delivery.token });
  const outside = await callLocal(socketPath(home), {
    id: randomUUID(),
    operation: "frame.get",
    params: { ...params, atUs: finished.sourceDurationUs },
  });
  assert.equal(outside.ok, false);
  assert.equal(outside.error.code, "INVALID_RANGE");

  const revision = await call("edit.cut", {
    recordingId: take.recordingId,
    expectedRevisionId: "r0",
    requestId: randomUUID(),
    ranges: [{ startUs: 0, endUs: 200000 }],
  });
  const edited = await waitFor(async () => {
    const result = await call("frame.get", { recordingId: take.recordingId, atUs: 0, clean: true });
    if (result.state === "failed" || result.state === "unavailable")
      throw new Error(JSON.stringify(result));
    return result.state === "ready" && result;
  }, 20000);
  assert.equal(edited.revisionId, revision.revision.id);
  assert.ok(edited.published.frame.actualSourceUs >= 200000);
  assert.equal(edited.published.frame.requestedPlaybackUs, 0);
  await call("artifact.close", { token: edited.delivery.token });
  const historical = await call("frame.get", params);
  assert.deepEqual(historical.published, ready.published);
  await call("artifact.close", { token: historical.delivery.token });
  assert.equal(await hash(), originalHash);
});
