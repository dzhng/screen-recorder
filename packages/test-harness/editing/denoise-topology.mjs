import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { JourneyService, hash, poll, run } from "./source-evidence-fixture.mjs";
import { routingTopology } from "./routing-topology.mjs";
import { writeSourceWave, sourcePeriod, waveHeader } from "./audio-project-fixture.mjs";
import { createDenoiseReference } from "./denoise-reference.mjs";

const { values } = parseArgs({
  options: { out: { type: "string" }, reference: { type: "string" } },
});
assert(values.out && values.reference && process.env.SCREENREC_NATIVE);
const out = resolve(values.out),
  home = await realpath(await mkdtemp("/tmp/sr-learned-topology-"));
await mkdir(out);
const report = {
  passed: false,
  trace: [],
  checks: {},
  observations: {},
  home,
  scope: "Eight-second deep/wide learned traversal; no two-hour or listening claim",
  fixture: { seconds: 8, occurrences: 512, depth: 128, width: 32, rootGainSteps: 128 },
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  referenceSha256: hash(await readFile(resolve(values.reference))),
};
const reference = createDenoiseReference(resolve(values.reference), out);
const service = new JourneyService(home, report);
const call = (op, params, options = {}) =>
  service.call(op, params, { transport: "mcp", ...options });
let observing = false,
  peakRSS = 0;
const observer = setInterval(async () => {
  if (observing || !service.child?.pid) return;
  observing = true;
  try {
    const value = await run("ps", ["-o", "rss=", "-p", String(service.child.pid)]);
    peakRSS = Math.max(peakRSS, Number(value.stdout.trim()) * 1024);
  } catch {
  } finally {
    observing = false;
  }
}, 200);
const pcm = (bytes) => {
  const header = waveHeader(bytes, bytes.length);
  return bytes.subarray(header.offset, header.offset + header.frames * 8);
};
function exactPCM(actual, expected, label) {
  if (actual.equals(expected)) return;
  let byte = 0;
  while (byte < Math.min(actual.length, expected.length) && actual[byte] === expected[byte]) byte++;
  assert.fail(
    JSON.stringify({
      label,
      actualBytes: actual.length,
      expectedBytes: expected.length,
      firstDifferentFrame: Math.floor(byte / 8),
      channel: Math.floor(byte / 4) % 2,
      actualSha256: hash(actual),
      expectedSha256: hash(expected),
    }),
  );
}
async function audio(params, name) {
  const at = performance.now();
  const ready = await poll(
    () => call("audio.get", params),
    (v) => v.state === "ready",
    name,
  );
  const path = join(out, `${name}.wav`);
  await call("audio.get", params, { transport: "cli", output: path });
  const bytes = await readFile(path);
  report.checks[name] = { receipt: ready, sha256: hash(bytes), ms: performance.now() - at };
  return pcm(bytes);
}
try {
  await service.start();
  const assets = [];
  for (let i = 0; i < 2; i++) {
    const path = join(out, `source-${i}.wav`);
    await writeSourceWave(path, { source: i, seconds: 1 });
    const submitted = await call("asset.import", { path, requestId: `source-${i}` });
    const ready = await poll(
      () => call("job.get", { jobId: submitted.jobId }),
      (v) => v.state === "ready",
      "source import",
    );
    assets.push(await call("asset.get", { assetId: ready.result.assetId }));
  }
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
  let revision = made.revision;
  async function apply(operations, name) {
    const params = { projectId, expectedRevisionId: revision.id, requestId: name, operations };
    await writeFile(join(out, `${name}-request.json`), JSON.stringify(params));
    const at = performance.now(),
      result = await call("edit.apply", params);
    report.observations[name + "Ms"] = performance.now() - at;
    revision = result.revision;
    return result;
  }
  const topology = await apply(routingTopology(128, 32), "topology");
  const placement = [];
  for (let slot = 0; slot < 16; slot++)
    for (let lane = 0; lane < 32; lane++) {
      const asset = assets[lane % 2],
        sourceStartUs = lane % 4 >= 2 ? 250000 : 0;
      placement.push({
        operation: "place",
        clip: {
          trackId: topology.edit.labels[`t${lane}`],
          assetId: asset.id,
          streamId: asset.streams[0].id,
          source: {
            kind: "range",
            range: { startUs: sourceStartUs, endUs: sourceStartUs + 500000 },
          },
          placement: {
            kind: "project",
            range: { startUs: slot * 500000, endUs: (slot + 1) * 500000 },
          },
        },
      });
    }
  await apply(placement.slice(0, 500), "place-first");
  await apply(placement.slice(500), "place-last");
  const drySelection = { projectId, revisionId: revision.id };
  const periods = [sourcePeriod(0), sourcePeriod(1)];
  const expected = Buffer.alloc(8 * 48000 * 8),
    missingLane = Buffer.alloc(expected.length);
  // Dyadic source/gain values make each authored sum exact in Float32; reciprocal
  // gain pairs preserve it through every ancestor and the long root stack.
  for (let frame = 0; frame < 8 * 48000; frame++)
    for (let channel = 0; channel < 2; channel++) {
      let sum = 0,
        missing = 0;
      for (let lane = 0; lane < 32; lane++) {
        const sourceFrame = (frame % 24000) + (lane % 4 >= 2 ? 12000 : 0);
        const contribution = Math.fround(
          periods[lane % 2].readFloatLE(sourceFrame * 8 + channel * 4) / 32,
        );
        sum = Math.fround(sum + contribution);
        if (lane) missing = Math.fround(missing + contribution);
      }
      expected.writeFloatLE(sum, frame * 8 + channel * 4);
      missingLane.writeFloatLE(missing, frame * 8 + channel * 4);
    }
  await writeFile(join(out, "independent-dry.f32"), expected);
  const dry = await audio({ ...drySelection, range: { startUs: 0, endUs: 8000000 } }, "dry");
  exactPCM(dry, expected, "independent dry");
  assert.throws(() => exactPCM(dry, missingLane, "missing lane control"), /missing lane control/);
  report.checks.independentDry = {
    sha256: hash(expected),
    exact: true,
    missingLaneOracleRejected: true,
  };
  const target = { kind: "group", id: topology.edit.labels.g0 };
  const stack = await call("processing.get", { ...drySelection, target });
  await apply(
    [
      {
        operation: "processing.set",
        target,
        steps: [...stack.steps, { processor: { type: "rnnoise" } }],
      },
    ],
    "learned",
  );
  const selection = { projectId, revisionId: revision.id };
  report.selection = selection;
  const query = { ...selection, range: { startUs: 0, endUs: 8000000 }, limit: 250 };
  async function rows250() {
    const rows = [];
    let cursor,
      count = 0;
    do {
      const result = await poll(
        () =>
          call("timeline.events", {
            ...query,
            limit: 250 - rows.length,
            ...(cursor ? { cursor } : {}),
          }),
        (v) => v.state === "ready",
        "inspection",
      );
      rows.push(...result.page.rows);
      cursor = result.page.nextCursor;
      assert(++count <= 100, "bounded paging must advance");
    } while (rows.length < 250 && cursor);
    assert.equal(rows.length, 250);
    return rows;
  }
  const firstRows = await rows250(),
    samples = [];
  for (let i = 0; i < 20; i++) {
    const at = performance.now();
    assert.deepEqual(await rows250(), firstRows);
    samples.push(performance.now() - at);
  }
  const p95 = [...samples].sort((a, b) => a - b)[18];
  report.checks.inspection = { samples, p95Ms: p95, rows: 250 };
  assert(p95 <= 250, "existing cached250-row p95 budget");
  const start = performance.now();
  const prepared = await poll(
    () => call("audio.prepare", selection),
    (v) => v.state === "ready",
    "learned preparation",
  );
  report.observations.prepareMs = performance.now() - start;
  report.prepared = prepared;
  assert.deepEqual(await call("audio.prepare", selection), prepared);
  const retained = await call("asset.get", { assetId: prepared.published.audio.assetId });
  const full = await readFile(join(home, "library/assets", retained.id + ".wav"));
  await writeFile(join(out, "prepared.wav"), full);
  const referenceAt = performance.now(),
    wet = reference("combined", expected, 2);
  report.observations.referenceMs = performance.now() - referenceAt;
  exactPCM(pcm(full), wet, "independent learned");
  report.checks.independentLearned = { sha256: hash(wet), exact: true, frames: wet.length / 8 };
  assert.deepEqual(await readdir(join(home, "library/render"), { recursive: true }), []);
  await service.stop();
  process.env.SCREENREC_TEST_UNAVAILABLE_OPERATIONS = JSON.stringify([
    "media.audioCapabilities",
    "media.mixCompositionAudio",
  ]);
  await service.start();
  const late = {
    assetId: retained.id,
    streamId: retained.streams[0].id,
    range: { startUs: 7750000, endUs: 8000000 },
  };
  exactPCM(
    await audio(late, "retained-late"),
    wet.subarray(((7750000 * 48000) / 1e6) * 8),
    "retained late",
  );
  assert.deepEqual(await readdir(join(home, "library/render"), { recursive: true }), []);
  report.checks.restart = {
    learnedOperationsUnavailable: true,
    lateExact: true,
    renderScratchEmpty: true,
  };
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  clearInterval(observer);
  try {
    await service.stop();
  } catch (error) {
    report.passed = false;
    report.shutdownFailure = error.message;
    throw error;
  } finally {
    report.observations.sampledServicePeakRSS = peakRSS;
    report.observations.controllerPeakRSS = process.resourceUsage().maxRSS * 1024;
    report.serviceLogs = service.logs;
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  }
}
