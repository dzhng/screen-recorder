import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir, stat, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";
import { JourneyService, hash, poll, root } from "./source-evidence-fixture.mjs";
import { waveHeader } from "./audio-project-fixture.mjs";

const { values } = parseArgs({ options: { out: { type: "string" }, source: { type: "string" } } });
assert(values.out && values.source && process.env.SCREENREC_NATIVE);
const out = resolve(values.out),
  home = await mkdtemp("/tmp/sr-denoise-public-");
await mkdir(out);
const report = {
  passed: false,
  trace: [],
  checks: {},
  receipts: [],
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  harnessSha256: hash(await readFile(import.meta.filename)),
  scope:
    "linked mono RNNoise through public CLI/MCP and existing prepared owner; no listening or model-absent binary claim",
};
const service = new JourneyService(home, report),
  call = service.call.bind(service);
const expected = gunzipSync(
  await readFile(
    join(root, "specs/agent-editing/assets/12c-matched-noise/audio/rnnoise-mixture.f32.gz"),
  ),
);
async function prepare(selection) {
  const result = await poll(
    () => call("audio.prepare", selection),
    (v) => v.state === "ready",
    "denoise preparation",
  );
  assert.deepEqual(await call("audio.prepare", selection, { transport: "mcp" }), result);
  report.receipts.push(result);
  return result;
}
async function inspect(prepared, startUs, endUs, name, factor = 1) {
  const asset = await call("asset.get", { assetId: prepared.published.audio.assetId });
  const stream = asset.streams.find((s) => s.kind === "audio");
  assert(stream);
  const selection = { assetId: asset.id, streamId: stream.id, range: { startUs, endUs } };
  await poll(
    () => call("audio.get", selection),
    (v) => v.state === "ready",
    "retained PCM",
  );
  const path = join(out, name + ".wav");
  await call("audio.get", selection, { output: path });
  const bytes = await readFile(path),
    header = waveHeader(bytes, bytes.length);
  const first = (startUs * 48000) / 1000000,
    frames = ((endUs - startUs) * 48000) / 1000000;
  assert.equal(header.frames, frames);
  for (let frame = 0; frame < frames; frame++) {
    const value = Math.fround(expected.readFloatLE((first + frame) * 4) * factor);
    for (let channel = 0; channel < 2; channel++)
      assert.equal(bytes.readFloatLE(header.offset + frame * 8 + channel * 4), value);
  }
  report.checks[name] = { frames, sha256: hash(bytes), exactPCM: true };
}
try {
  await service.start();
  const imported = await call("asset.import", {
    requestId: "source",
    path: resolve(values.source),
  });
  const job = await poll(
    () => call("job.get", { jobId: imported.jobId }),
    (v) => v.state === "ready",
    "import",
  );
  const asset = await call("asset.get", { assetId: job.result.assetId });
  const made = await call("project.create", {
    requestId: "project",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = made.project.projectId;
  const placed = await call("edit.apply", {
    projectId,
    expectedRevisionId: made.revision.id,
    requestId: "place",
    operations: [
      { operation: "track.add", label: "audio", track: { kind: "audio", order: 0 } },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: { label: "audio" },
          assetId: asset.id,
          streamId: asset.streams[0].id,
          source: { kind: "range", range: { startUs: 0, endUs: 5000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 5000000 } },
        },
      },
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [{ enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  });
  const original = { projectId, revisionId: placed.revision.id },
    first = await prepare(original);
  await inspect(first, 0, 5000000, "full");
  const movie = join(out, "full-preview.mp4"),
    rangedMovie = join(out, "range-preview.mp4");
  const preview = await poll(
    () => call("preview.get", { ...original, settings: { preset: "balanced" } }, { output: movie }),
    (v) => v.state === "ready",
    "learned movie",
  );
  const ranged = await poll(
    () =>
      call(
        "preview.get",
        {
          ...original,
          range: { startUs: 1000000, endUs: 3000000 },
          settings: { preset: "balanced" },
        },
        { output: rangedMovie },
      ),
    (v) => v.state === "ready",
    "learned range movie",
  );
  const exportId = randomUUID();
  await call(
    "export.create",
    {
      ...original,
      exportId,
      kind: "video",
      directory: await realpath(out),
      leaf: "export.mp4",
      settings: { preset: "balanced" },
    },
    { transport: "mcp" },
  );
  const exported = await poll(
    () => call("export.status", { exportId }),
    (v) => v.state === "committed",
    "learned export",
  );
  assert.equal(hash(await readFile(exported.output)), hash(await readFile(movie)));
  report.checks.movie = {
    full: preview.published.preview,
    range: ranged.published.preview,
    exportByteIdenticalToFullPreview: true,
    encodedPCMEqualityClaim: false,
  };
  const gained = await call("edit.apply", {
    projectId,
    expectedRevisionId: original.revisionId,
    requestId: "gain",
    operations: [
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [
          { enabled: true, processor: { type: "rnnoise" } },
          { enabled: true, processor: { type: "gain", gain: 0.5 } },
        ],
      },
    ],
  });
  const selected = { projectId, revisionId: gained.revision.id };
  const blocked = await service.arm("media.mixCompositionAudio"),
    pending = await call("audio.prepare", selected);
  await blocked();
  await call("job.cancel", { jobId: pending.jobId });
  const canceled = await call("job.get", { jobId: pending.jobId });
  assert.equal(canceled.state, "canceled");
  assert.equal(canceled.result, null);
  await call("audio.prepare", selected);
  assert.deepEqual(await call("job.get", { jobId: pending.jobId }), canceled);
  await call("job.retry", { jobId: pending.jobId });
  const second = await prepare(selected);
  assert.equal(second.jobId, pending.jobId);
  await inspect(second, 1000000, 3000000, "gained-range", 0.5);
  assert.deepEqual(await prepare(original), first);
  const longMade = await call("project.create", {
    requestId: "cancel-project",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const longPlaced = await call("edit.apply", {
    projectId: longMade.project.projectId,
    expectedRevisionId: longMade.revision.id,
    requestId: "cancel-domain",
    operations: [
      { operation: "track.add", label: "audio", track: { kind: "audio", order: 0 } },
      {
        operation: "place",
        clip: {
          trackId: { label: "audio" },
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 0, endUs: 600000000 } },
        },
      },
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [{ enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  });
  const inFlight = await call("audio.prepare", {
    projectId: longMade.project.projectId,
    revisionId: longPlaced.revision.id,
  });
  const workspace = join(home, "library/render");
  const observation = await poll(
    async () => {
      for (const file of await readdir(workspace, { recursive: true })) {
        if (!file.endsWith("output.f32")) continue;
        const bytes = (await stat(join(workspace, file))).size;
        if (bytes > 0 && bytes < 600 * 48000 * 4) return { processing: true, bytes };
      }
      const status = await call("job.get", { jobId: inFlight.jobId });
      assert.notEqual(
        status.state,
        "ready",
        "Cancellation must interrupt native inference, not a finished job",
      );
      return { processing: false };
    },
    (v) => v.processing,
    "in-flight native state spool",
  );
  const cancelAt = performance.now();
  await call("job.cancel", { jobId: inFlight.jobId });
  const canceledInFlight = await call("job.get", { jobId: inFlight.jobId });
  assert.equal(canceledInFlight.state, "canceled");
  assert.equal(canceledInFlight.result, null);
  await poll(
    async () => ({ files: await readdir(workspace, { recursive: true }) }),
    (v) => v.files.length === 0,
    "attempt scratch cleanup",
  );
  report.checks.inFlightCancellation = {
    observedOutputSpoolBytes: observation.bytes,
    declaredFrames: 600 * 48000,
    canceled: true,
    noPublishedResult: true,
    scratchRemoved: true,
    cancelAndCleanupMs: performance.now() - cancelAt,
  };
  await service.stop();
  process.env.SCREENREC_TEST_UNAVAILABLE_OPERATIONS = JSON.stringify([
    "media.audioCapabilities",
    "media.mixCompositionAudio",
  ]);
  await service.start();
  await inspect(first, 3000000, 4500000, "retained-with-executor-unavailable");
  const refusal = await call("audio.prepare", selected, { error: true });
  assert.equal(refusal.code, "NOT_READY");
  report.checks.lifecycle = {
    canceledRealNativeReplyNotPublished: true,
    explicitRetry: true,
    historicalRevision: true,
    cliAndMcpRepeat: true,
    retainedPCMWithExecutorUnavailable: true,
    newPreparationRefusedWithoutCapability: true,
  };
  report.passed = true;
} finally {
  delete process.env.SCREENREC_TEST_UNAVAILABLE_OPERATIONS;
  await service.stop();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await rm(home, { recursive: true, force: true });
}
