import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { createCompiler, validateComposition } from "../../composition/dist/index.js";
import { nativeProcessing } from "../../../apps/service/dist/native-processing.js";
import { writeSourceWave, waveHeader } from "./audio-project-fixture.mjs";
import { hash } from "./source-evidence-fixture.mjs";
assert.ok(process.env.SCREENREC_NATIVE && process.env.SCREENREC_BASELINE_NATIVE);
const home = await mkdtemp(join(tmpdir(), "screenrec-gain-cost-"));
let sequence = 0;
function execute(worker, operation, params) {
  const run = spawnSync(worker, [], {
    input: JSON.stringify({ id: String(sequence++), operation, params }) + "\n",
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || String(run.error));
  const response = JSON.parse(run.stdout);
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.data;
}
try {
  const path = join(home, "source.wav"),
    duration = 5000000;
  await writeSourceWave(path, { source: 0, seconds: duration / 1000000 });
  const probe = execute(process.env.SCREENREC_NATIVE, "media.probe", { path });
  const stream = probe.streams.find((v) => v.kind === "audio");
  const source = {
    id: "a",
    streams: [
      {
        id: stream.id,
        kind: "audio",
        bounds: { startUs: 0, endUs: duration },
        available: [{ startUs: 0, endUs: duration }],
      },
    ],
  };
  function plan(gain) {
    const doc = {
      canvas: {
        width: 64,
        height: 48,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
      tracks: [{ id: "a", kind: "audio", order: 0 }],
      groups: [],
      captions: [],
      syncGroups: [],
      clips: [
        {
          id: "c",
          trackId: "a",
          assetId: "a",
          streamId: stream.id,
          source: { kind: "range", range: { startUs: 0, endUs: duration } },
          placement: { kind: "project", range: { startUs: 0, endUs: duration } },
        },
      ],
      processing: [
        {
          target: { kind: "clip", id: "c" },
          steps: [{ id: "g", enabled: true, processor: { type: "gain", gain } }],
        },
      ],
    };
    const window = createCompiler(validateComposition(doc, [source]), "cost").audioWindow({
      range: { startUs: 0, endUs: duration },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    return {
      range: window.manifest.sampleRange,
      clips: [...window.audio()],
      processing: nativeProcessing(window.processing()),
      assets: [{ assetId: "a", streamId: stream.id, path, originUs: probe.originUs }],
    };
  }
  const constant = plan(0.7),
    curve = plan({
      keys: [
        {
          at: { numerator: 0, denominator: 1 },
          value: 0.25,
          interpolation: { cubic: [0.2, 0, 0.8, 1] },
        },
        { at: { numerator: 1, denominator: 1 }, value: 1.25, interpolation: "linear" },
      ],
    });
  const trials = [],
    constantHashes = new Set();
  for (let trial = 0; trial < 3; trial++)
    for (const [name, worker, params] of [
      ["baseline-constant", process.env.SCREENREC_BASELINE_NATIVE, constant],
      ["constant", process.env.SCREENREC_NATIVE, constant],
      ["cubic", process.env.SCREENREC_NATIVE, curve],
    ]) {
      const output = join(home, `${trial}-${name}.wav`),
        start = performance.now();
      const result = execute(worker, "media.mixCompositionAudio", { ...params, output });
      const wallMs = performance.now() - start;
      const bytes = await readFile(output),
        header = waveHeader(bytes, bytes.length);
      assert.equal(header.frames, 240000);
      assert.equal(result.frames, 240000);
      assert.ok(result.maximumBlockFrames <= 8192);
      if (name !== "cubic") constantHashes.add(hash(bytes.subarray(header.offset)));
      trials.push({
        trial,
        name,
        wallMs,
        frames: result.frames,
        maximumBlockFrames: result.maximumBlockFrames,
        peakResidentBytes: result.peakResidentBytes,
      });
    }
  assert.equal(constantHashes.size, 1, "Constant fast path must preserve baseline PCM exactly");
  console.log(
    JSON.stringify(
      {
        passed: true,
        note: "Five-second stereo native mixer jobs including startup and file IO. Constant-versus-cubic cost uses the same worker; the older worker supplies PCM preservation, not a controlled performance baseline.",
        programBytes: Buffer.byteLength(JSON.stringify(curve.processing)),
        constantPcmSha256: [...constantHashes][0],
        workerSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
        baselineWorkerSha256: hash(await readFile(process.env.SCREENREC_BASELINE_NATIVE)),
        trials,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(home, { recursive: true, force: true });
}
