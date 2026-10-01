import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { writeSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CONTROL_FRAME_BYTES, JsonLineStream, controlMessageSchema } from "@screenrec/protocol";
import { startProjectService } from "../../../apps/service/dist/project-service.js";

assert.equal(process.argv[2], "--out");
const out = resolve(process.argv[3]);
await mkdir(out, { recursive: true });
const home = await mkdtemp("/tmp/capture-coordination-public-");
const cli = new URL("../../../apps/cli/dist/main.js", import.meta.url).pathname;
const run = promisify(execFile);
const report = {
  scope:
    "Scripted controller/worker, real fresh service, CLI and MCP; no native media or physical capture",
  passed: false,
  exchanges: [],
  controllerCalls: [],
  workerCalls: [],
  checks: {},
};
let service,
  mcp,
  input,
  sequence = 0,
  take = null,
  deviceState = "idle",
  selection = null;
const privateReplies = new Map();
const worker = async (operation, params, options) => {
  report.workerCalls.push(operation);
  if (operation === "storage.clearRenderWorkspace") return { ok: true, data: { removed: true } };
  if (operation === "media.audioCapabilities") return { ok: true, data: {} };
  if (operation === "media.sourceEvidence") {
    const header = JSON.parse(
      await readFile(join(params.directory, "capture.journal.jsonl"), "utf8"),
    );
    await writeFile(params.output, "");
    return {
      ok: true,
      data: {
        file: params.output,
        journal: "capture.journal.jsonl",
        header,
        cursorSamples: 0,
        geometryRecords: 0,
        displaySpaces: 0,
        pauseEvents: 0,
        audioIntervals: 0,
        lastSequence: 0,
        incompleteTail: false,
        finished: true,
        bytes: 0,
      },
    };
  }
  if (operation === "media.probe") {
    const bytes = Buffer.from(
      JSON.stringify({
        originUs: 0,
        streams: [
          {
            id: "track:1",
            kind: "video",
            codec: "scripted",
            width: 16,
            height: 16,
            orientedWidth: 16,
            orientedHeight: 16,
            decodable: true,
            startUs: 0,
            endUs: 100,
            segments: [{ startUs: 0, endUs: 100, empty: false }],
          },
        ],
      }),
    );
    writeSync(
      options.descriptors[Number(params.output.split("/").at(-1)) - 3],
      bytes,
      0,
      bytes.length,
      0,
    );
    return {
      ok: true,
      data: {
        file: params.output,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  }
  throw Error(`Unscripted worker operation ${operation}`);
};
async function start() {
  input = new PassThrough();
  const output = new PassThrough(),
    frames = new JsonLineStream(CONTROL_FRAME_BYTES);
  output.on("data", (bytes) => {
    for (const frame of frames.push(bytes)) {
      assert.equal(frame.ok, true);
      const message = controlMessageSchema.parse(frame.value);
      if (message.event === "result") {
        privateReplies.get(message.response.id)?.(message.response);
        privateReplies.delete(message.response.id);
      }
      if (message.event !== "call") continue;
      const { operation, params } = message.request;
      report.controllerCalls.push({ operation, params });
      let data;
      if (operation === "capture.status")
        data = {
          state: deviceState,
          recordingId: take?.recordingId ?? null,
          sourceId: take?.sourceId ?? null,
          elapsedUs: take ? 0 : null,
          selection,
          permissions: { screen: true, microphone: "authorized", camera: "not_determined" },
        };
      else {
        if (operation === "capture.start") {
          take = { recordingId: params.recordingId, sourceId: params.sourceId };
          selection = {
            source: params.source,
            microphone: params.microphone,
            systemAudio: params.systemAudio,
          };
          sequence = 0;
          assert.equal(
            params.outputDirectory,
            join(home, "library", "recordings", take.recordingId, "source"),
          );
        }
        assert.ok(
          ["capture.start", "capture.pause", "capture.resume", "capture.stop"].includes(operation),
        );
        deviceState =
          operation === "capture.stop"
            ? "finalizing"
            : operation === "capture.pause"
              ? "paused"
              : "recording";
        data = { ...take, sequence: ++sequence, state: deviceState };
      }
      input.write(
        JSON.stringify({ event: "result", response: { id: message.request.id, ok: true, data } }) +
          "\n",
      );
    }
  });
  service = await startProjectService({ home, control: { input, output }, worker });
  mcp = new Client({ name: "capture-coordination", version: "1" });
  await mcp.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [cli, "mcp", "--socket", service.socketPath],
      stderr: "pipe",
    }),
  );
}
async function stop() {
  await mcp?.close();
  mcp = undefined;
  await service?.close();
  service = undefined;
}
async function call(transport, operation, params = {}, expectedError) {
  let response;
  if (transport === "mcp")
    response = (await mcp.callTool({ name: operation, arguments: params })).structuredContent;
  else {
    let stdout;
    try {
      ({ stdout } = await run(
        process.execPath,
        [cli, operation, "--socket", service.socketPath, "--params", JSON.stringify(params)],
        { timeout: 15000 },
      ));
    } catch (error) {
      if (!error.stdout) throw error;
      stdout = error.stdout;
    }
    response = JSON.parse(stdout);
  }
  report.exchanges.push({ transport, operation, params, response });
  assert.equal(response.ok, !expectedError, JSON.stringify(response));
  if (expectedError) assert.equal(response.error.code, expectedError);
  return response.data;
}
async function waitState(recordingId, state) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const recording = await call("mcp", "recording.get", { recordingId });
    if (recording.sourceAdmissions[0]?.job?.state === state) return recording;
    if (["failed", "canceled", "unavailable"].includes(recording.sourceAdmissions[0]?.job?.state))
      throw Error(JSON.stringify(recording.sourceAdmissions[0].job));
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw Error(`Source never reached ${state}`);
}
try {
  await start();
  const params = {
    requestId: "public-capture",
    source: { kind: "display", displayId: 1 },
    microphone: false,
    systemAudio: false,
  };
  const allocated = await call("cli", "capture.start", params);
  assert.equal(allocated.state, "recording");
  assert.deepEqual(allocated.sourceAdmissions, []);
  assert.deepEqual(await call("mcp", "capture.start", params), allocated);
  assert.equal(
    report.controllerCalls.filter((value) => value.operation === "capture.start").length,
    1,
  );
  await call("cli", "capture.start", { ...params, microphone: true }, "REQUEST_CONFLICT");
  await call(
    "mcp",
    "capture.start",
    { ...params, cameraDeviceId: "not-exposed" },
    "INVALID_PARAMS",
  );
  const identity = { recordingId: allocated.recordingId };
  assert.equal((await call("mcp", "capture.pause", identity)).state, "paused");
  assert.equal((await call("cli", "capture.resume", identity)).state, "recording");
  assert.equal((await call("cli", "capture.stop", identity)).state, "finalizing");
  const settled = { ...take, sequence: ++sequence, state: "complete", sourceDurationUs: 100 };
  const answer = new Promise((resolve) => {
    const id = randomUUID();
    privateReplies.set(id, resolve);
    input.write(
      JSON.stringify({
        event: "request",
        request: { id, operation: "capture.report", params: settled },
      }) + "\n",
    );
  });
  assert.equal((await answer).ok, true);
  take = null;
  selection = null;
  deviceState = "idle";
  const failed = await waitState(allocated.recordingId, "failed");
  const admitted = failed.sourceAdmissions[0];
  assert.equal(admitted.job.errorCode, "NOT_FOUND");
  assert.deepEqual(await call("mcp", "capture.stop", identity), failed);
  const source = join(home, "library", "recordings", allocated.recordingId, "source");
  await writeFile(
    join(source, "capture.journal.jsonl"),
    JSON.stringify({ sessionID: allocated.sourceId }),
  );
  await writeFile(join(source, "video.mov"), "scripted public capture bytes");
  assert.deepEqual(
    (await call("cli", "recording.get", identity)).sourceAdmissions,
    failed.sourceAdmissions,
  );
  await call("mcp", "job.retry", { jobId: admitted.job.jobId });
  const ready = await waitState(allocated.recordingId, "ready");
  assert.equal(ready.sourceAdmissions[0].acquisitionId, admitted.acquisitionId);
  assert.equal(ready.sourceAdmissions[0].job.jobId, admitted.job.jobId);
  const acquisition = await call("cli", "acquisition.get", {
    acquisitionId: admitted.acquisitionId,
  });
  assert.equal(acquisition.sourceId, allocated.sourceId);
  assert.deepEqual(
    acquisition.bindings.map((binding) => binding.sourceRoles),
    [["video"]],
  );
  await rm(source, { recursive: true });
  await stop();
  await start();
  assert.deepEqual(await call("cli", "recording.get", identity), ready);
  assert.deepEqual(await call("mcp", "capture.start", params), ready);
  assert.deepEqual(
    await call("mcp", "acquisition.get", { acquisitionId: admitted.acquisitionId }),
    acquisition,
  );
  assert.deepEqual((await call("cli", "project.list")).projects, []);
  report.checks = {
    allocated,
    failed,
    ready,
    acquisition,
    donorFreeReopen: true,
    noAutomaticProject: true,
  };
  report.passed = true;
} finally {
  await stop();
  await rm(home, { recursive: true, force: true });
  await writeFile(join(out, "public-journey.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ passed: report.passed, exchanges: report.exchanges.length, out }));
