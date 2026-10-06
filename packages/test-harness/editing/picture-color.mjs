import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, corpusReferences } from "./render-membership.mjs";

// Compare display colors only after each image's actual profile has been applied.
// This augments the existing exact movie-pixel and independent picture membership gates.
const args = process.argv.slice(2);
assert.deepEqual([args[0], args[2], args[4]], ["--frames", "--movies", "--out"]);
const framesRoot = resolve(args[1]),
  moviesRoot = resolve(args[3]),
  out = resolve(args[5]);
const root = fileURLToPath(new URL("../../../", import.meta.url));
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), []);
const run = (command, args, input) => {
  const result = spawnSync(command, args, { input, timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
};
const json = async (path) => JSON.parse(await readFile(path));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const rgb = (path) =>
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
const probe = (path) =>
  JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height,color_space,color_transfer,color_primaries",
      "-of",
      "json",
      path,
    ]),
  ).streams[0];
const refs = corpusReferences((id) =>
  rgb(join(root, "specs/done/agent-editing/assets/00-corpus", id + ".mov")),
);
function difference(a, b) {
  assert.equal(a.length, 160 * 128 * 3);
  assert.equal(b.length, a.length);
  let total = 0,
    square = 0,
    above16 = 0,
    above32 = 0,
    above64 = 0,
    signed = 0;
  let rgbTotal = 0,
    maxChannel = 0;
  const centerA = [0, 0, 0],
    centerB = [0, 0, 0];
  for (let i = 0; i < a.length; i += 3) {
    const delta =
      (a[i] - b[i]) * 0.2126 + (a[i + 1] - b[i + 1]) * 0.7152 + (a[i + 2] - b[i + 2]) * 0.0722;
    total += Math.abs(delta);
    square += delta * delta;
    signed += delta;
    above16 += Math.abs(delta) > 16;
    above32 += Math.abs(delta) > 32;
    above64 += Math.abs(delta) > 64;
    for (let channel = 0; channel < 3; channel++) {
      const d = Math.abs(a[i + channel] - b[i + channel]);
      rgbTotal += d;
      maxChannel = Math.max(maxChannel, d);
    }
  }
  for (let y = 64; y < 80; y++)
    for (let x = 72; x < 88; x++)
      for (let c = 0; c < 3; c++) {
        centerA[c] += a[(y * 160 + x) * 3 + c] / 256;
        centerB[c] += b[(y * 160 + x) * 3 + c] / 256;
      }
  return {
    mae: total / 20480,
    rmse: Math.sqrt(square / 20480),
    diffRatio16: above16 / 20480,
    diffRatio32: above32 / 20480,
    diffRatio64: above64 / 20480,
    avgLuminanceDelta: signed / 20480,
    rgbMAE: rgbTotal / a.length,
    maxChannel,
    centerA,
    centerB,
  };
}
const reference = join(out, "reference");
run("swiftc", [
  "-parse-as-library",
  join(root, "packages/test-harness/editing/FrameColorReference.swift"),
  "-o",
  reference,
]);
const report = await json(join(framesRoot, "report.json"));
const visual = join(out, "visual");
await mkdir(visual);
const results = [];
for (const scenario of report.results) {
  const directory = join(out, scenario.name);
  await mkdir(directory);
  const request = await json(join(moviesRoot, scenario.name, "request.json"));
  const compiled = (await readFile(request.frames, "utf8")).trim().split("\n").map(JSON.parse);
  const requested = {
    movie: request.output,
    output: directory,
    timesUs: compiled.map((frame) => frame.visibleRange.startUs - request.range.startUs),
  };
  await save(join(directory, "request.json"), requested);
  const referenceReceipt = JSON.parse(run(reference, [join(directory, "request.json")]));
  assert.equal(referenceReceipt.length, compiled.length);
  const pairs = [];
  for (const [index, referenceFrame] of referenceReceipt.entries()) {
    assert.equal(referenceFrame.status, "available", referenceFrame.error);
    const requestedUs = requested.timesUs[index];
    assert.equal(
      BigInt(referenceFrame.actualValue) * 1000000n,
      BigInt(requestedUs) * BigInt(referenceFrame.actualTimescale),
    );
    const frame = join(framesRoot, scenario.name, `${String(index).padStart(3, "0")}.png`);
    const directMetadata = probe(frame),
      referenceMetadata = probe(referenceFrame.file);
    assert.equal(directMetadata.color_transfer, "iec61966-2-1");
    assert.equal(referenceMetadata.color_transfer, "iec61966-2-1");
    const direct = rgb(frame),
      common = rgb(referenceFrame.file);
    const mixed = rgb(
      join(moviesRoot, scenario.name, "shots", `${String(index + 1).padStart(3, "0")}.png`),
    );
    assert.equal(classify(direct, refs).id, scenario.ids[index]);
    assert.equal(classify(common, refs).id, scenario.ids[index]);
    pairs.push({
      index,
      expected: scenario.ids[index],
      directSHA256: hash(direct),
      referenceSHA256: hash(common),
      sourceProfile: referenceFrame.sourceProfile,
      sourceProfileSHA256: referenceFrame.sourceProfileSHA256,
      directMetadata,
      referenceMetadata,
      mixedProfiles: difference(direct, mixed),
      commonProfile: difference(direct, common),
    });
  }
  await save(join(directory, "reference-receipts.json"), referenceReceipt);
  await save(join(directory, "metrics.json"), pairs);
  run("ffmpeg", [
    "-v",
    "error",
    "-start_number",
    "0",
    "-i",
    join(framesRoot, scenario.name, "%03d.png"),
    "-start_number",
    "0",
    "-i",
    join(directory, "%03d.png"),
    "-filter_complex",
    `[0:v][1:v]hstack,tile=4x${Math.ceil(compiled.length / 4)}`,
    "-frames:v",
    "1",
    join(visual, scenario.name + ".png"),
  ]);
  results.push({ name: scenario.name, pictures: pairs.length, metrics: pairs });
}
for (const [name, source, crop, size] of [
  ["selected-second-stream-crop", "selected-second-stream", "320:128:0:0", "1280:512"],
  ["leading-partial-picture-crop", "leading-partial-picture", "640:128:0:0", "1280:256"],
  ["acquisition-boundary-window-crop", "acquisition-boundary-window", "640:128:0:0", "1280:256"],
  ["acquisition-transition-crop", "acquisition-occurrences", "640:128:0:128", "1280:256"],
  ["acquisition-return-crop", "acquisition-occurrences", "640:128:320:256", "1280:256"],
])
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    join(visual, source + ".png"),
    "-vf",
    `crop=${crop},scale=${size}:flags=neighbor`,
    "-frames:v",
    "1",
    join(visual, name + ".png"),
  ]);
await save(join(out, "report.json"), {
  results,
  visualAcceptance: "pending fresh critique",
  passed: true,
});
console.log(
  JSON.stringify({
    out,
    cases: results.length,
    pictures: results.reduce((n, r) => n + r.pictures, 0),
    passed: true,
  }),
);
