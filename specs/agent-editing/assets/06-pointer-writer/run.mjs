import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [baseline, instrumented, output] = process.argv.slice(2).map((value) => resolve(value));
assert.ok(
  baseline && instrumented && output,
  "Pass frozen worker, instrumented worker, fresh output",
);
await mkdir(output);
const input = fileURLToPath(new URL("./input/", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (program, args, stdin, env = {}) => {
  const r = spawnSync(program, args, {
    input: stdin,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 8 * 1024 ** 2,
    env: { ...process.env, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const pixelTool = join(output, "pixels"),
  referenceTool = join(output, "reference");
for (const [name, tool] of [
  ["FrameImagePixels.swift", pixelTool],
  ["FrameColorReference.swift", referenceTool],
])
  run("swiftc", [
    "-parse-as-library",
    fileURLToPath(new URL(`../../../../packages/test-harness/editing/${name}`, import.meta.url)),
    "-o",
    tool,
  ]);
const source = join(input, "source.mov");
const sourceHash = hash(await readFile(source));
const cohorts = [
  { id: "full", range: { startUs: 0, endUs: 2000000 } },
  { id: "range", range: { startUs: 1050001, endUs: 1250001 } },
];
const decoded = {},
  traces = {};
for (const [name, worker] of [
  ["baseline", baseline],
  ["instrumented", instrumented],
]) {
  decoded[name] = {};
  for (const cohort of cohorts) {
    const directory = join(output, `${name}-${cohort.id}`);
    await mkdir(directory);
    const framesFile = join(input, `${cohort.id}.frames.jsonl`),
      pointersFile = join(input, `${cohort.id}.pointers.jsonl`);
    const frames = (await readFile(framesFile, "utf8")).trim().split("\n").map(JSON.parse);
    const body = await readFile(pointersFile);
    const pointerRows = body.toString().trim().split("\n").map(JSON.parse);
    const layer = frames[0].layers[0];
    assert.equal(layer.assetId, sourceHash);
    const request = {
      output: join(directory, "movie.mp4"),
      frames: framesFile,
      range: cohort.range,
      canvas: {
        width: 256,
        height: 160,
        fps: { numerator: 10, denominator: 1 },
        background: "#000000ff",
      },
      profile: "h264-rec709",
      processing: frames[0].visual.map((node) => ({
        target: node.target,
        mediaKind: "video",
        inputs: node.inputs,
        steps:
          node.target.kind === "clip"
            ? [{ id: "pointer", enabled: true, processor: { type: "pointer", trailUs: 600000 } }]
            : [],
      })),
      assets: [{ assetId: layer.assetId, streamId: layer.streamId, path: source, originUs: 0 }],
      pointers: {
        file: pointersFile,
        bytes: body.length,
        records: pointerRows.length,
        sha256: hash(body),
      },
    };
    await writeFile(join(directory, "request.json"), JSON.stringify(request, null, 2));
    const result = JSON.parse(
      run(
        worker,
        [],
        JSON.stringify({
          id: "writer-probe",
          operation: "media.renderCompositionVideo",
          params: request,
        }) + "\n",
        { SCREENREC_WRITER_TRACE: directory },
      ),
    );
    assert.ok(result.ok, JSON.stringify(result));
    await writeFile(join(directory, "receipt.json"), JSON.stringify(result.data, null, 2));
    const images = join(directory, "decoded");
    await mkdir(images);
    const reference = {
      movie: request.output,
      output: images,
      timesUs: frames.map((frame) => frame.visibleRange.startUs - cohort.range.startUs),
    };
    const referenceRequest = join(directory, "reference.json");
    await writeFile(referenceRequest, JSON.stringify(reference));
    const results = JSON.parse(run(referenceTool, [referenceRequest]));
    assert.equal(results.length, frames.length);
    decoded[name][cohort.id] = new Map();
    for (let i = 0; i < frames.length; i++) {
      const raw = results[i].file + ".rgba";
      run(pixelTool, [results[i].file, raw]);
      const bytes = await readFile(raw);
      assert.equal(bytes.length, 256 * 160 * 4);
      decoded[name][cohort.id].set(frames[i].index, bytes);
    }
    if (name === "instrumented") {
      traces[cohort.id] = [];
      for (const frame of frames.filter((frame) => frame.index >= 10 && frame.index <= 12)) {
        const trace = JSON.parse(
          await readFile(join(directory, `frame-${frame.index}.json`), "utf8"),
        );
        const raw = await readFile(join(directory, `frame-${frame.index}.bgra`));
        assert.equal(hash(raw), trace.sha256);
        assert.equal(raw.length, trace.width * trace.height * 4);
        assert.deepEqual(trace.frame, frame);
        assert.equal(trace.writerPTSUs, frame.visibleRange.startUs - cohort.range.startUs);
        assert.equal(trace.writerDurationUs, frame.visibleRange.endUs - frame.visibleRange.startUs);
        traces[cohort.id].push(trace);
      }
    }
  }
}
const differences = (a, b) => {
  let changed = 0,
    maximum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    changed += d > 0;
    maximum = Math.max(maximum, d);
  }
  return { changedChannels: changed, maximum };
};
const instrumentation = [];
for (const cohort of cohorts) {
  for (const [index, original] of decoded.baseline[cohort.id]) {
    const diff = differences(original, decoded.instrumented[cohort.id].get(index));
    assert.equal(diff.maximum, 0, `Instrumentation changed decoded ${cohort.id} frame ${index}`);
    instrumentation.push({ cohort: cohort.id, index, sha256: hash(original), ...diff });
  }
}
const baselineReproduction = [];
for (const cohort of cohorts)
  for (const index of [10, 11, 12]) {
    const retained = fileURLToPath(
      new URL(
        `../15-pointer-execution/images/movie-${cohort.range.startUs}-references/${String(index - 10).padStart(3, "0")}.png`,
        import.meta.url,
      ),
    );
    const raw = join(output, `retained-${cohort.id}-${index}.rgba`);
    run(pixelTool, [retained, raw]);
    const delta = differences(await readFile(raw), decoded.baseline[cohort.id].get(index));
    assert.equal(delta.maximum, 0, "Frozen decoded baseline did not reproduce");
    baselineReproduction.push({ cohort: cohort.id, index, ...delta });
  }
const writerInputs = [];
for (let i = 0; i < 3; i++) {
  const a = traces.full[i],
    b = traces.range[i];
  const rawA = await readFile(join(output, "instrumented-full", `frame-${a.frame.index}.bgra`));
  const rawB = await readFile(join(output, "instrumented-range", `frame-${b.frame.index}.bgra`));
  assert.equal(a.frame.index, b.frame.index);
  assert.equal(a.frame.sampleAtUs, b.frame.sampleAtUs);
  assert.deepEqual(a.frame.layers, b.frame.layers);
  assert.deepEqual(a.frame.visual, b.frame.visual);
  assert.deepEqual(a.pictures, b.pictures);
  writerInputs.push({
    frameIndex: a.frame.index,
    pixels: differences(rawA, rawB),
    fullHash: a.sha256,
    rangeHash: b.sha256,
    attachmentsEqual: JSON.stringify(a.attachments) === JSON.stringify(b.attachments),
    fullPTSUs: a.writerPTSUs,
    rangePTSUs: b.writerPTSUs,
    fullDurationUs: a.writerDurationUs,
    rangeDurationUs: b.writerDurationUs,
  });
}
const mask = (raw, redThreshold) => {
  const points = new Set();
  let xsum = 0,
    ysum = 0;
  for (let y = 0; y < 160; y++)
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      if (raw[i] > raw[i + 1] + redThreshold && raw[i + 2] > raw[i + 1] + 10) {
        points.add(y * 256 + x);
        xsum += x;
        ysum += y;
      }
    }
  return { points, count: points.size, centroid: [xsum / points.size, ysum / points.size] };
};
const trail = [];
for (const index of [10, 11, 12]) {
  for (const threshold of [19, 20, 21]) {
    const a = mask(decoded.baseline.full.get(index), threshold),
      b = mask(decoded.baseline.range.get(index), threshold);
    let intersection = 0;
    for (const p of a.points) if (b.points.has(p)) intersection++;
    const shifts = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        let matched = 0;
        for (const p of a.points) {
          const x = (p % 256) + dx,
            y = Math.floor(p / 256) + dy;
          if (x >= 0 && x < 256 && y >= 0 && y < 160 && b.points.has(y * 256 + x)) matched++;
        }
        shifts.push({ dx, dy, iou: matched / (a.count + b.count - matched) });
      }
    shifts.sort((a, b) => b.iou - a.iou);
    trail.push({
      index,
      threshold,
      fullCount: a.count,
      rangeCount: b.count,
      fullCentroid: a.centroid,
      rangeCentroid: b.centroid,
      centroidDelta: a.centroid.map((v, i) => b.centroid[i] - v),
      fullOnly: a.count - intersection,
      rangeOnly: b.count - intersection,
      intersection,
      iou: intersection / (a.count + b.count - intersection),
      bestShift: shifts[0],
    });
  }
}
const report = {
  baselineWorkerSHA256: hash(await readFile(baseline)),
  instrumentedWorkerSHA256: hash(await readFile(instrumented)),
  sourceSHA256: sourceHash,
  inputSHA256: Object.fromEntries(
    await Promise.all(
      cohorts.flatMap((c) =>
        ["frames", "pointers"].map(async (kind) => {
          const file = `${c.id}.${kind}.jsonl`;
          return [file, hash(await readFile(join(input, file)))];
        }),
      ),
    ),
  ),
  instrumentation,
  baselineReproduction,
  writerInputs,
  trail,
  matchedWriterInputsEqual: writerInputs.every((v) => v.pixels.maximum === 0 && v.attachmentsEqual),
  originalMagentaCriterionPassed: trail
    .filter((v) => v.threshold === 20)
    .every((v) => v.centroidDelta.every((d) => Math.abs(d) < 1)),
};
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
