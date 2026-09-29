import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { run, root } from "./source-evidence-fixture.mjs";
import { compareLandmarks } from "./layers-oracle.mjs";
const out = resolve(process.argv[2]);
const report = JSON.parse(await readFile(join(out, "report.json"), "utf8"));
assert(report.passed);
const tool = join(out, "frame-pixels");
await run("swiftc", [
  "-parse-as-library",
  join(root, "packages/test-harness/editing/FrameImagePixels.swift"),
  "-o",
  tool,
]);
const diagnostic = {
  scope:
    "Original four-code and thin-landmark diagnostics remain diagnostics; negative sensitivity is not quality acceptance",
  frames: [],
  controls: [],
};
const frozen = report.cohorts.find((c) => c.name === "frozen");
const distance = (a, b) => {
  let sum = 0,
    squared = 0,
    maximum = 0,
    above4 = 0,
    count = 0;
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++)
    if (i % 4 !== 3) {
      const d = Math.abs(a[i] - b[i]);
      sum += d;
      squared += d * d;
      maximum = Math.max(maximum, d);
      above4 += d > 4;
      count++;
    }
  return {
    maximumRGB: maximum,
    meanRGB: sum / count,
    meanSquaredRGB: squared / count,
    shareAbove4: above4 / count,
    originalFourCodePass: maximum <= 4,
  };
};
for (const cohort of report.cohorts.filter((c) => !c.recorded)) {
  for (const movie of [cohort.full, ...(cohort.clipped ? [cohort.clipped] : [])]) {
    for (const frame of movie.decoded.frames) {
      const sampleAtUs = movie.frames[frame.index].sampleAtUs;
      const reference = frozen.pictures.find((p) => p.atUs === sampleAtUs);
      assert(reference);
      const png = join(out, cohort.name, movie.label, "decoded", frame.file),
        raw = png + ".rgba";
      const color = JSON.parse((await run(tool, [png, raw])).stdout);
      const actual = await readFile(raw),
        expected = await readFile(reference.path + ".rgba");
      let landmark;
      try {
        landmark = { passed: true, result: compareLandmarks(actual, expected, 256, 160) };
      } catch (error) {
        landmark = { passed: false, error: error.message };
      }
      diagnostic.frames.push({
        cohort: cohort.name,
        label: movie.label,
        index: frame.index,
        sampleAtUs,
        color,
        distance: distance(actual, expected),
        originalLandmarkDiagnostic: landmark,
      });
    }
  }
}
for (const sample of diagnostic.frames.filter((f) => f.cohort === "frozen" && f.label === "full")) {
  const controls = diagnostic.frames.filter(
    (f) => f.cohort !== "frozen" && f.sampleAtUs === sample.sampleAtUs,
  );
  for (const control of controls) {
    const discriminated = control.distance.meanSquaredRGB > sample.distance.meanSquaredRGB;
    diagnostic.controls.push({
      sampleAtUs: sample.sampleAtUs,
      control: control.cohort,
      positiveMSE: sample.distance.meanSquaredRGB,
      negativeMSE: control.distance.meanSquaredRGB,
      discriminated,
    });
    assert(
      discriminated,
      "A wrong-pointer negative control is not distinguished from matched encoded output",
    );
    assert.equal(
      control.originalLandmarkDiagnostic.passed,
      false,
      "Wrong pointer passed historical landmark diagnostic",
    );
  }
}
await writeFile(join(out, "original-diagnostics.json"), JSON.stringify(diagnostic, null, 2));
console.log(
  JSON.stringify({
    positiveLandmarkPasses: diagnostic.frames.filter(
      (f) => f.cohort === "frozen" && f.originalLandmarkDiagnostic.passed,
    ).length,
    negativeControls: diagnostic.controls,
  }),
);
