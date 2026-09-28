import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { compareLandmarks } from "../../../../packages/test-harness/editing/layers-oracle.mjs";
const [traceDirectory, output] = process.argv.slice(2);
assert.ok(traceDirectory && output);
const trace = resolve(traceDirectory),
  out = resolve(output);
await mkdir(out);
const root = fileURLToPath(new URL("../../../../", import.meta.url)),
  input = fileURLToPath(new URL("./input/", import.meta.url));
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 8 * 1024 ** 2,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
for (const [source, tool] of [
  [
    fileURLToPath(new URL("./WriterPixels.swift", import.meta.url)),
    "writer-pixels",
  ],
  [
    join(root, "packages/test-harness/editing/FrameColorReference.swift"),
    "frame-reference",
  ],
  [
    join(root, "packages/test-harness/editing/FrameImagePixels.swift"),
    "frame-pixels",
  ],
])
  run("swiftc", ["-parse-as-library", source, "-o", join(out, tool)]);
const converted = [],
  original = [];
for (let i = 0; i < 4; i++) {
  const raw = join(trace, `frame-${i}.bgra`),
    normalized = join(out, `writer-${i}.rgba`),
    record = JSON.parse(await readFile(join(trace, `frame-${i}.json`), "utf8"));
  assert.equal(record.width, 256);
  assert.equal(record.height, 160);
  const profile = run(join(out, "writer-pixels"), [raw, normalized]).trim();
  assert.equal(profile, record.attachments.propagate.CGColorSpace.iccSHA256);
  original.push(await readFile(raw));
  converted.push(await readFile(normalized));
}
const report = {
  scope: "Research RGB MOV display control, not a production export capability",
  variants: {},
};
for (const [name, pixels, format, transfer, space] of [
  ["untouched-709", original, "bgra", "bt709", "bt709"],
  ["normalized-srgb", converted, "rgba", "iec61966-2-1", "rgb"],
]) {
  const dir = join(out, name);
  await mkdir(dir);
  const raw = join(dir, "input.raw"),
    movie = join(dir, "movie.mov");
  await writeFile(raw, Buffer.concat(pixels));
  run("ffmpeg", [
    "-v",
    "error",
    "-f",
    "rawvideo",
    "-pixel_format",
    format,
    "-video_size",
    "256x160",
    "-framerate",
    "10",
    "-i",
    raw,
    "-c:v",
    "rawvideo",
    "-pix_fmt",
    "argb",
    "-color_primaries",
    "bt709",
    "-color_trc",
    transfer,
    "-colorspace",
    space,
    movie,
  ]);
  const request = join(dir, "decode.json");
  await writeFile(
    request,
    JSON.stringify({
      movie,
      output: dir,
      timesUs: [0, 100000, 200000, 300000],
    }),
  );
  const frames = JSON.parse(run(join(out, "frame-reference"), [request]));
  assert.equal(frames.length, 4);
  const checks = [];
  for (let i = 0; i < 4; i++) {
    const rgba = frames[i].file + ".rgba";
    run(join(out, "frame-pixels"), [frames[i].file, rgba]);
    const actual = await readFile(rgba),
      expected = gunzipSync(await readFile(join(input, `intact-${i}.rgba.gz`)));
    let geometry;
    try {
      geometry = {
        passed: true,
        result: compareLandmarks(actual, expected, 256, 160),
      };
    } catch (error) {
      geometry = { passed: false, error: error.message };
    }
    const exactNormalizedWriter = actual.equals(converted[i]);
    if (name === "normalized-srgb")
      assert.ok(
        exactNormalizedWriter,
        "Lossless sRGB display changed writer pixels",
      );
    checks.push({
      index: i,
      exactNormalizedWriter,
      geometry,
      maximumCodeDifference: actual.reduce(
        (m, v, k) => Math.max(m, Math.abs(v - expected[k])),
        0,
      ),
      decoder: frames[i],
    });
  }
  report.variants[name] = {
    movieBytes: (await readFile(movie)).length,
    checks,
  };
}
assert.ok(
  report.variants["normalized-srgb"].checks.every(
    (check) => check.geometry.passed,
  ),
);
assert.ok(
  report.variants["untouched-709"].checks.some(
    (check) => !check.geometry.passed,
  ),
);
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
