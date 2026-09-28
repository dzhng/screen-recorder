import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compareLandmarks } from "../../../../packages/test-harness/editing/layers-oracle.mjs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { gunzipSync } from "node:zlib";
const [baselineWorker, observerWorker, candidateWorker, candidateName, output] =
  process.argv.slice(2);
assert.ok(
  baselineWorker &&
    observerWorker &&
    candidateWorker &&
    candidateName &&
    output,
  "Pass baseline, observer, candidate, candidate name, and fresh output directory",
);
assert.ok(!["baseline", "instrumented"].includes(candidateName));
const out = resolve(output);
await mkdir(out);
const input = fileURLToPath(new URL("./input/", import.meta.url));
const media = out;
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const run = (cmd, args, stdin, env = {}) => {
  const r = spawnSync(cmd, args, {
    input: stdin,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 8 * 1024 ** 2,
    env: { ...process.env, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const hash = (b) => createHash("sha256").update(b).digest("hex");
for (const [source, tool] of [
  ["FrameColorReference.swift", "frame-reference"],
  ["FrameImagePixels.swift", "frame-pixels"],
])
  run("swiftc", [
    "-parse-as-library",
    join(repository, "packages/test-harness/editing", source),
    "-o",
    join(out, tool),
  ]);
const report = {
  workers: {},
  cohorts: {},
  controls: {},
  scope:
    "Existing strict landmark criterion against intact delivered pictures; writer inputs and decoded outputs independently retained. No default promotion.",
};
for (const [name, worker] of [
  ["baseline", resolve(baselineWorker)],
  ["instrumented", resolve(observerWorker)],
  [candidateName, resolve(candidateWorker)],
]) {
  report.workers[name] = { path: worker, sha256: hash(await readFile(worker)) };
  report.cohorts[name] = {};
  for (const label of ["full", "range"]) {
    const dir = out + "/" + name + "-" + label;
    await mkdir(dir);
    const request = JSON.parse(
      await readFile(join(input, label + ".request.json"), "utf8"),
    );
    request.frames = join(input, request.frames);
    request.pointers.file = join(input, request.pointers.file);
    request.assets = request.assets.map((asset) => ({
      ...asset,
      path: join(input, asset.path),
    }));
    request.output = dir + "/movie.mp4";
    await writeFile(dir + "/request.json", JSON.stringify(request, null, 2));
    const receipt = JSON.parse(
      run(
        worker,
        [],
        JSON.stringify({
          id: name + "-" + label,
          operation: "media.renderCompositionMovie",
          params: request,
        }) + "\n",
        name === "baseline" ? {} : { SCREENREC_WRITER_TRACE: dir },
      ),
    );
    assert.equal(receipt.ok, true, JSON.stringify(receipt));
    await writeFile(dir + "/receipt.json", JSON.stringify(receipt, null, 2));
    const frames = (await readFile(request.frames, "utf8"))
        .trim()
        .split("\n")
        .map(JSON.parse),
      timesUs = frames.map(
        (f) =>
          Math.max(f.visibleRange.startUs, request.range.startUs) -
          request.range.startUs,
      );
    const decodeRequest = { movie: request.output, output: dir, timesUs };
    await writeFile(dir + "/decode.json", JSON.stringify(decodeRequest));
    const decoded = JSON.parse(
      run(media + "/frame-reference", [dir + "/decode.json"]),
    );
    assert.equal(decoded.length, frames.length);
    const checks = [];
    for (let i = 0; i < decoded.length; i++) {
      const file = decoded[i].file,
        raw = file + ".rgba";
      run(media + "/frame-pixels", [file, raw]);
      const bytes = await readFile(raw),
        expected = gunzipSync(
          await readFile(join(input, "intact-" + frames[i].index + ".rgba.gz")),
        );
      let geometry;
      try {
        geometry = {
          passed: true,
          result: compareLandmarks(bytes, expected, 256, 160),
        };
      } catch (e) {
        geometry = { passed: false, error: e.message };
      }
      checks.push({
        index: frames[i].index,
        pngSha256: hash(await readFile(file)),
        rgbaSha256: hash(bytes),
        geometry,
        maximumCodeDifference: bytes.reduce(
          (m, v, k) => Math.max(m, Math.abs(v - expected[k])),
          0,
        ),
      });
    }
    report.cohorts[name][label] = {
      checks,
      movieBytes: (await readFile(request.output)).length,
      range: request.range,
    };
  }
}
for (const label of ["full", "range"]) {
  const base = report.cohorts.baseline[label].checks,
    inst = report.cohorts.instrumented[label].checks;
  assert.deepEqual(
    base.map((x) => x.rgbaSha256),
    inst.map((x) => x.rgbaSha256),
  );
  report.controls["instrumentation-" + label] = { allDecodedPixelsExact: true };
}
for (const name of ["instrumented", candidateName])
  for (const index of [0, 1, 2]) {
    const full = await readFile(
        out + "/" + name + "-full/frame-" + index + ".bgra",
      ),
      range = await readFile(
        out + "/" + name + "-range/frame-" + index + ".bgra",
      );
    assert.ok(full.equals(range));
    const parent = await readFile(
      out + "/instrumented-full/frame-" + index + ".bgra",
    );
    assert.ok(full.equals(parent));
    report.controls[name + "-writer-" + index] = {
      fullRangeExact: true,
      candidateParentExact: true,
      sha256: hash(full),
    };
  }
report.candidate = candidateName;
report.candidatePasses = Object.values(report.cohorts[candidateName]).every(
  (cohort) => cohort.checks.every((check) => check.geometry.passed),
);
await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.cohorts, null, 2));
