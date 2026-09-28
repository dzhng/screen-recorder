import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, corpusReferences } from "./render-membership.mjs";

// Consume the independently asserted every-frame movie corpus, including physical empty edits,
// repeated/reordered clips, global picture phase, holds, retiming and acquisition masks.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const [flag, input, outFlag, output, caseFlag, caseName] = process.argv.slice(2);
assert.ok(caseFlag === undefined || (caseFlag === "--case" && caseName));
assert.equal(flag, "--rendered");
assert.equal(outFlag, "--out");
const rendered = resolve(input),
  out = resolve(output);
const native = process.env.SCREENREC_NATIVE;
const baseline = process.env.SCREENREC_BASELINE_NATIVE;
const cancellationWorker = process.env.SCREENREC_COMPOSITION_CANCEL_TEST;
assert.ok(cancellationWorker, "The production NativeWire cancellation test executable is required");
assert.ok(native && baseline, "Both candidate and frozen baseline native binaries are required");
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), []);
const run = (binary, args, input) => {
  const result = spawnSync(binary, args, { input, timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
};
const call = (binary, operation, params) =>
  JSON.parse(run(binary, [], JSON.stringify({ id: "picture", operation, params }) + "\n"));
const raw = (path) =>
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-map",
    "0:v:0",
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
const json = async (path) => JSON.parse(await readFile(path));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const refs = corpusReferences((id) =>
  raw(join(root, "specs/agent-editing/assets/00-corpus", id + ".mov")),
);
const results = [];
const report = await json(join(rendered, "report.json"));
const scenarios = caseName
  ? report.results.filter((scenario) => scenario.name === caseName)
  : report.results;
assert.ok(scenarios.length > 0, "No matching picture case");
for (const scenario of scenarios) {
  const directory = join(out, scenario.name);
  await mkdir(directory);
  const request = await json(join(rendered, scenario.name, "request.json"));
  const frames = (await readFile(request.frames, "utf8")).trim().split("\n").map(JSON.parse);
  const frozen = call(baseline, "media.renderCompositionVideo", {
    ...request,
    output: join(directory, "frozen.mp4"),
  });
  assert.equal(frozen.ok, true, JSON.stringify(frozen));
  const oldPixels = raw(frozen.data.file),
    currentPixels = raw(request.output);
  assert.equal(
    hash(currentPixels),
    hash(oldPixels),
    `${scenario.name}: movie pixels changed during extraction`,
  );
  const receipts = [];
  for (const [index, frame] of frames.entries()) {
    const still = {
      output: join(directory, `${String(index).padStart(3, "0")}.png`),
      frame,
      canvas: request.canvas,
      profile: request.profile,
      processing: request.processing,
      assets: request.assets,
    };
    const response = call(native, "media.renderCompositionFrame", still);
    assert.equal(response.ok, true, JSON.stringify(response));
    const receipt = response.data;
    assert.deepEqual(receipt.frame, frame);
    assert.equal(
      classify(raw(receipt.file), refs).id,
      scenario.ids[index],
      `${scenario.name} still ${index}`,
    );
    const layer = frame.layers[0];
    if (!layer) assert.deepEqual(receipt.picture, { status: "background" });
    else {
      assert.equal(receipt.picture.clipId, layer.clipId);
      assert.equal(receipt.picture.assetId, layer.assetId);
      assert.equal(receipt.picture.streamId, layer.streamId);
      assert.equal(receipt.picture.requestedSourceUs, layer.sourceUs);
      if (layer.availability === "source-unavailable") {
        assert.equal(receipt.picture.status, "unavailable");
        assert.equal(receipt.picture.reason, "source-unavailable");
      } else if (scenario.ids[index] === "black") {
        assert.equal(receipt.picture.status, "unavailable");
        assert.equal(receipt.picture.reason, "physical-empty");
      } else {
        assert.equal(receipt.picture.status, "available");
        const sample = receipt.picture.sample;
        const binding = request.assets.find(
          (a) => a.assetId === layer.assetId && a.streamId === layer.streamId,
        );
        assert.equal(sample.originUs, binding.originUs);
        assert.equal(
          receipt.picture.actualSourceUs,
          Math.round((Number(sample.value) * 1e6) / sample.timescale) - sample.originUs,
        );
        assert.ok(receipt.picture.actualSourceUs <= layer.sourceUs);
      }
    }
    receipts.push(receipt);
  }
  await writeFile(join(directory, "receipts.json"), JSON.stringify(receipts, null, 2));
  results.push({
    name: scenario.name,
    pictures: frames.length,
    moviePixelSHA256: hash(oldPixels),
    ids: scenario.ids,
  });
}
const base = await json(join(rendered, "av-replacement/request.json"));
const frame = JSON.parse((await readFile(base.frames, "utf8")).split("\n")[0]);
const still = {
  frame,
  canvas: base.canvas,
  assets: base.assets,
  profile: base.profile,
  processing: base.processing,
};
const negatives = [];
for (const [name, change, code] of [
  ["encoded-limit", { maxEncodedBytes: 1 }, "LIMIT_EXCEEDED"],
  ["oversize-limit", { maxEncodedBytes: 33554433 }, "INVALID_REQUEST"],
  ["invalid-size", { maxLongEdge: 8193 }, "INVALID_REQUEST"],
  ["unknown-crop", { crop: { x: 0, y: 0, width: 20, height: 20 } }, "INVALID_REQUEST"],
  ["layering", { frame: { ...frame, layers: [frame.layers[0], frame.layers[0]] } }, "NOT_READY"],
]) {
  const directory = join(out, name);
  await mkdir(directory);
  const response = call(native, "media.renderCompositionFrame", {
    ...still,
    ...change,
    output: join(directory, "frame.png"),
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, code, JSON.stringify(response));
  assert.deepEqual(await readdir(directory), [], `${name} leaked native staging`);
  negatives.push({ name, code });
}
const bounded = call(native, "media.renderCompositionFrame", {
  ...still,
  maxLongEdge: 80,
  output: join(out, "bounded.png"),
});
assert.equal(bounded.ok, true, JSON.stringify(bounded));
assert.deepEqual(
  [bounded.data.width, bounded.data.height, bounded.data.sourceWidth, bounded.data.sourceHeight],
  [80, 64, 160, 128],
);
const physicalRequest = await json(join(rendered, "empty-edit/request.json"));
const physicalFrame = (await readFile(physicalRequest.frames, "utf8"))
  .trim()
  .split("\n")
  .map(JSON.parse)
  .find((item) => item.layers[0]?.availability === "source-unavailable");
assert.ok(physicalFrame);
const physical = call(native, "media.renderCompositionFrame", {
  ...still,
  assets: physicalRequest.assets,
  frame: {
    ...physicalFrame,
    layers: physicalFrame.layers.map((layer) => ({ ...layer, availability: "available" })),
  },
  output: join(out, "physical-empty.png"),
});
assert.equal(physical.ok, true, JSON.stringify(physical));
assert.equal(physical.data.picture.status, "unavailable");
assert.equal(physical.data.picture.reason, "physical-empty");
assert.equal(classify(raw(physical.data.file), refs).id, "black");
const fractionalFile = join(out, "fractional.mov");
run("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=160x128:rate=30000/1001",
  "-frames:v",
  "3",
  "-c:v",
  "libx264",
  "-bf",
  "0",
  "-video_track_timescale",
  "90000",
  fractionalFile,
]);
const probed = call(native, "media.probe", { path: fractionalFile });
assert.equal(probed.ok, true, JSON.stringify(probed));
const fractionalStream = probed.data.streams.find((stream) => stream.kind === "video").id;
const fractional = call(native, "media.renderCompositionFrame", {
  ...still,
  assets: [
    {
      assetId: "fractional",
      streamId: fractionalStream,
      path: fractionalFile,
      originUs: probed.data.originUs,
    },
  ],
  frame: {
    ...frame,
    layers: [
      { ...frame.layers[0], assetId: "fractional", streamId: fractionalStream, sourceUs: 33367 },
    ],
  },
  output: join(out, "fractional.png"),
});
assert.equal(fractional.ok, true, JSON.stringify(fractional));
assert.equal(fractional.data.picture.actualSourceUs, 33367);
const sample = fractional.data.picture.sample;
assert.equal(BigInt(sample.value) * 30000n, 1001n * BigInt(sample.timescale));
assert.notEqual((BigInt(sample.value) * 1000000n) % BigInt(sample.timescale), 0n);
const defaultBound = call(native, "media.renderCompositionFrame", {
  ...still,
  frame: { ...frame, layers: [] },
  canvas: { ...still.canvas, width: 3200, height: 1800 },
  output: join(out, "default-bound.png"),
});
assert.equal(defaultBound.ok, true, JSON.stringify(defaultBound));
assert.deepEqual(
  [
    defaultBound.data.width,
    defaultBound.data.height,
    defaultBound.data.sourceWidth,
    defaultBound.data.sourceHeight,
  ],
  [1600, 900, 3200, 1800],
);
const cancelDirectory = join(out, "cancellation");
await mkdir(cancelDirectory);
const cancelRequest = join(cancelDirectory, "request.json");
await writeFile(
  cancelRequest,
  JSON.stringify({
    ...still,
    frame: { ...frame, layers: [] },
    canvas: { ...still.canvas, width: 4096, height: 4096 },
    output: join(cancelDirectory, "frame.png"),
  }),
);
const cancellation = run(cancellationWorker, [cancelRequest, "media.renderCompositionFrame"])
  .toString()
  .trim();
assert.deepEqual(await readdir(cancelDirectory), ["request.json"]);
await writeFile(
  join(out, "report.json"),
  JSON.stringify(
    {
      results,
      negatives,
      bounded: bounded.data,
      physical: physical.data,
      fractional: fractional.data,
      defaultBound: defaultBound.data,
      cancellation,
      passed: true,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    out,
    cases: results.length,
    pictures: results.reduce((sum, r) => sum + r.pictures, 0),
    passed: true,
  }),
);
