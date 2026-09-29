import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir, stat, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
    "linked independent-channel RNNoise through public CLI/MCP and existing prepared owner; no listening or model-absent binary claim",
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
async function inspect(
  prepared,
  startUs,
  endUs,
  name,
  factor = 1,
  oracle = expected,
  oracleChannels = 1,
) {
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
    for (let channel = 0; channel < 2; channel++) {
      const value = Math.fround(
        oracle.readFloatLE(
          ((first + frame) * oracleChannels + Math.min(channel, oracleChannels - 1)) * 4,
        ) * factor,
      );
      assert.equal(bytes.readFloatLE(header.offset + frame * 8 + channel * 4), value);
    }
  }
  report.checks[name] = { frames, sha256: hash(bytes), exactPCM: true };
}
async function projectAudio(selection, tap, name, expectedPCM) {
  const params = { ...selection, range: { startUs: 0, endUs: 5000000 }, tap };
  const ready = await poll(
    () => call("audio.get", params),
    (value) => value.state === "ready",
    name,
  );
  const path = join(out, name + ".wav");
  await call("audio.get", params, { output: path });
  const bytes = await readFile(path),
    header = waveHeader(bytes, bytes.length);
  assert.equal(header.frames, expectedPCM.length / 4);
  for (let frame = 0; frame < header.frames; frame++)
    for (let channel = 0; channel < 2; channel++)
      assert.equal(
        bytes.readFloatLE(header.offset + frame * 8 + channel * 4),
        expectedPCM.readFloatLE(frame * 4),
      );
  report.checks[name] = {
    params,
    ready,
    frames: header.frames,
    sha256: hash(bytes),
    exactPCM: true,
  };
}
const baseline = gunzipSync(
  await readFile(join(root, "specs/agent-editing/assets/12c-matched-noise/audio/mixture.f32.gz")),
);
const outputTap = (point) => ({ target: { kind: "output" }, point });
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
  const originalStack = await call("processing.get", { ...original, target: { kind: "output" } });
  await projectAudio(original, outputTap({ kind: "dry" }), "before-state-tap", baseline);
  await projectAudio(
    original,
    outputTap({ kind: "after-step", stepId: originalStack.steps[0].id }),
    "after-state-tap",
    expected,
  );
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
  const gainedStack = await call("processing.get", { ...selected, target: { kind: "output" } });
  await projectAudio(
    selected,
    outputTap({ kind: "after-step", stepId: gainedStack.steps[0].id }),
    "before-downstream-gain-tap",
    expected,
  );
  const bypassed = await call("edit.apply", {
    projectId,
    expectedRevisionId: selected.revisionId,
    requestId: "bypass-state",
    operations: [
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: gainedStack.steps.map((step, index) => ({ ...step, enabled: index !== 0 })),
      },
    ],
  });
  const halfDry = Buffer.from(baseline);
  for (let at = 0; at < halfDry.length; at += 4)
    halfDry.writeFloatLE(Math.fround(halfDry.readFloatLE(at) * 0.5), at);
  await projectAudio(
    { projectId, revisionId: bypassed.revision.id },
    outputTap({ kind: "processed" }),
    "bypassed-state",
    halfDry,
  );
  const undone = await call("edit.undo", {
    projectId,
    expectedRevisionId: bypassed.revision.id,
    requestId: "undo-bypass",
  });
  assert.deepEqual(undone.document, gained.revision.document);
  const halfWet = Buffer.from(expected);
  for (let at = 0; at < halfWet.length; at += 4)
    halfWet.writeFloatLE(Math.fround(halfWet.readFloatLE(at) * 0.5), at);
  await projectAudio(
    { projectId, revisionId: undone.id },
    outputTap({ kind: "processed" }),
    "undo-state",
    halfWet,
  );
  const restored = await call("edit.restore", {
    projectId,
    expectedRevisionId: undone.id,
    targetRevisionId: original.revisionId,
    requestId: "restore-original",
  });
  assert.deepEqual(restored.document, placed.revision.document);
  await projectAudio(
    { projectId, revisionId: restored.id },
    outputTap({ kind: "processed" }),
    "restore-state",
    expected,
  );
  await projectAudio(
    selected,
    outputTap({ kind: "processed" }),
    "historical-gained-state",
    halfWet,
  );
  const stereoImported = await call("asset.import", {
    requestId: "stereo-source",
    path: join(dirname(resolve(values.source)), "differing-stereo.wav"),
  });
  const stereoJob = await poll(
    () => call("job.get", { jobId: stereoImported.jobId }),
    (v) => v.state === "ready",
    "stereo import",
  );
  const stereoAsset = await call("asset.get", { assetId: stereoJob.result.assetId });
  assert.equal(stereoAsset.streams[0].channels, 2);
  const stereoMade = await call("project.create", {
    requestId: "stereo-project",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const stereoPlaced = await call("edit.apply", {
    projectId: stereoMade.project.projectId,
    expectedRevisionId: stereoMade.revision.id,
    requestId: "stereo-place",
    operations: [
      { operation: "track.add", label: "audio", track: { kind: "audio", order: 0 } },
      {
        operation: "place",
        clip: {
          trackId: { label: "audio" },
          assetId: stereoAsset.id,
          streamId: stereoAsset.streams[0].id,
          source: { kind: "range", range: { startUs: 0, endUs: 5000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 5000000 } },
        },
      },
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [{ processor: { type: "rnnoise" } }],
      },
    ],
  });
  const stereoPrepared = await prepare({
    projectId: stereoMade.project.projectId,
    revisionId: stereoPlaced.revision.id,
  });
  const rightExpected = gunzipSync(
    await readFile(
      join(root, "specs/agent-editing/assets/12c-matched-noise/audio/rnnoise-reference.f32.gz"),
    ),
  );
  assert.equal(rightExpected.length, expected.length);
  const stereoExpected = Buffer.alloc(expected.length * 2);
  for (let frame = 0; frame < expected.length / 4; frame++) {
    expected.copy(stereoExpected, frame * 8, frame * 4, frame * 4 + 4);
    rightExpected.copy(stereoExpected, frame * 8 + 4, frame * 4, frame * 4 + 4);
  }
  await inspect(stereoPrepared, 0, 5000000, "independent-stereo-full", 1, stereoExpected, 2);
  await inspect(stereoPrepared, 1000000, 3000000, "independent-stereo-range", 1, stereoExpected, 2);
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
        if (bytes > 600 * 48000 * 4 && bytes < 600 * 48000 * 8) return { processing: true, bytes };
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
    "in-flight second-channel state spool",
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
    completedLanes: 1,
    incompleteLane: 1,
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
  await projectAudio(
    original,
    outputTap({ kind: "dry" }),
    "dry-tap-with-executor-unavailable",
    baseline,
  );
  await inspect(
    stereoPrepared,
    3000000,
    4500000,
    "stereo-retained-executor-unavailable",
    1,
    stereoExpected,
    2,
  );
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
