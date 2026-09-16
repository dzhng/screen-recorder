import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { raster } from "../../../apps/macos/tests/fixtures/generated-capture.mjs";
import {
  createOriginalRevision,
  createRevision,
  renderPlan,
} from "../../../packages/core/dist/timeline.js";
const root = resolve(import.meta.dirname, "../../..");
const out =
  process.env.SCREENREC_RENDER_EVIDENCE ??
  (await mkdtemp(join(tmpdir(), "screenrec-render-membership-")));
assert.ok(isAbsolute(out), "Evidence directory must be absolute");
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), [], "Evidence directory must be empty");
function run(cmd, args, input) {
  const p = spawnSync(cmd, args, {
    input,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(p.error, undefined);
  assert.equal(p.status, 0, p.stderr);
  return p.stdout;
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const frames = [];
for (let n = 0; n < 6; n++) {
  const { rgb, rect, text } = raster(320, 180);
  rect(0, 0, 320, 180, [30 + n * 30, 40, 100]);
  rect(0, 0, 30, 50, [255, 0, 0]);
  rect(270, 130, 50, 50, [0, 255, 80]);
  text("FRAME " + n, 40, 70, 4, [255, 255, 255]);
  frames.push(rgb);
}
await writeFile(join(out, "source.rgb"), Buffer.concat(frames));
for (const [name, rate] of [
  ["dense", 30],
  ["sparse", 1],
])
  run("ffmpeg", [
    "-v",
    "error",
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgb24",
    "-video_size",
    "320x180",
    "-framerate",
    String(rate),
    "-i",
    join(out, "source.rgb"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-bf",
    "2",
    "-video_track_timescale",
    "90000",
    "-an",
    join(out, name + ".mov"),
  ]);
run("swiftc", [
  "-parse-as-library",
  join(root, "helpers/mac/Sources/ScreenRecorderMediaTime/SampleTiming.swift"),
  join(import.meta.dirname, "RenderMembership/main.swift"),
  "-o",
  join(out, "probe"),
]);
run("swiftc", [
  "-parse-as-library",
  join(import.meta.dirname, "RenderMembership/gap.swift"),
  "-o",
  join(out, "gap-maker"),
]);
run(join(out, "gap-maker"), [join(out, "dense.mov"), join(out, "gap.mov")]);
const cases = [
  ["dense-subframe", "dense", 200000, [{ startUs: 10000, endUs: 20000 }], [0]],
  [
    "dense-two-spans",
    "dense",
    200000,
    [
      { startUs: 10000, endUs: 20000 },
      { startUs: 43333, endUs: 53333 },
    ],
    [0, 1],
  ],
  ["sparse-held", "sparse", 6000000, [{ startUs: 500000, endUs: 510000 }], [0]],
  ["empty-edit", "gap", 300000, [{ startUs: 50000, endUs: 60000 }], null],
];
const report = { kind: "generated native membership feasibility", sources: {}, cases: [] };
for (const [name, sourceName, duration, spans, expectedFrames] of cases) {
  const source = join(out, sourceName + ".mov"),
    bytes = await readFile(source),
    directory = join(out, name);
  await mkdir(directory);
  const original = createOriginalRevision(duration, "fixture");
  const revision = createRevision(original, spans, {
    id: name,
    operation: "cut",
    createdAt: "fixture",
  });
  const plan = renderPlan(revision);
  const request = { source, outputDirectory: directory, plan };
  await writeFile(join(directory, "request.json"), JSON.stringify(request, null, 2));
  run(join(out, "probe"), [join(directory, "request.json")]);
  const ledger = JSON.parse(await readFile(join(directory, "ledger.json"), "utf8"));
  assert.equal(hash(await readFile(source)), hash(bytes));
  report.sources[sourceName] ??= { sha256: hash(bytes), bytes: bytes.length };
  const decoded = {};
  for (const method of ["composition", "writer"]) {
    if (!ledger[method].file) {
      decoded[method] = { unsupported: ledger[method].unsupported ?? ledger[method].error };
      continue;
    }
    const output = join(directory, method + ".rgb");
    run("ffmpeg", [
      "-v",
      "error",
      "-i",
      ledger[method].file,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-fps_mode",
      "passthrough",
      output,
    ]);
    const pixels = await readFile(output);
    const sampleBytes = 320 * 180 * 3;
    const sourceRaw = join(out, sourceName + "-decoded.rgb");
    if (!report.sources[sourceName].decoded) {
      run("ffmpeg", [
        "-v",
        "error",
        "-i",
        source,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-fps_mode",
        "passthrough",
        sourceRaw,
      ]);
      report.sources[sourceName].decoded = true;
    }
    const reference = await readFile(sourceRaw);
    const matches = [];
    for (let offset = 0; offset < pixels.length; offset += sampleBytes) {
      const errors = [];
      for (let i = 0; i < reference.length / sampleBytes; i++) {
        let sum = 0;
        for (let k = 0; k < sampleBytes; k++)
          sum += Math.abs(pixels[offset + k] - reference[i * sampleBytes + k]);
        errors.push(sum / sampleBytes);
      }
      const best = Math.min(...errors);
      matches.push({ sourceFrame: errors.indexOf(best), meanAbsoluteRgbError: best });
    }
    decoded[method] = {
      frameCount: matches.length,
      matches,
      probe: JSON.parse(
        run("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "frame=pts_time:format=duration",
          "-of",
          "json",
          ledger[method].file,
        ]),
      ),
    };
  }
  if (expectedFrames) {
    assert.equal(ledger.membership.fullyProven, true);
    assert.deepEqual(
      decoded.writer.matches.map((x) => x.sourceFrame),
      expectedFrames,
    );
    assert.equal(ledger.writer.durationUs, revision.durationUs);
  } else {
    assert.equal(ledger.membership.fullyProven, false);
    assert.ok(decoded.writer.unsupported);
  }
  report.cases.push({ name, source: sourceName, plan, ledger, decoded });
}
const native =
  process.env.SCREENREC_NATIVE ?? join(root, "helpers/mac/.build/debug/screenrec-native");
report.inspection = [];
for (const [sourceName, atUs, kept] of [
  ["dense", 15000, { startUs: 10000, endUs: 20000 }],
  ["gap", 50000, { startUs: 50000, endUs: 60000 }],
  ["gap", 50000, { startUs: 0, endUs: 300000 }],
]) {
  const source = join(out, sourceName + ".mov");
  for (const operation of ["media.frame", "media.visualSamples"]) {
    const params =
      operation === "media.frame"
        ? {
            source,
            kept,
            atSourceUs: atUs,
            output: join(out, `inspection-${report.inspection.length}.png`),
          }
        : { source, kept, atSourceUs: [atUs] };
    const result = JSON.parse(
      run(native, [], JSON.stringify({ id: "inspection", operation, params }) + "\n"),
    );
    if (kept.startUs > 0) assert.equal(result.error?.code, "UNAVAILABLE");
    else {
      assert.equal(result.ok, true);
      assert.equal(
        operation === "media.frame"
          ? result.data.actualSourceUs
          : result.data.samples[0].actualSourceUs,
        0,
      );
    }
    report.inspection.push({ source: sourceName, operation, atUs, kept, result });
  }
}
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      out,
      report: join(out, "report.json"),
      cases: report.cases.map((c) => ({
        name: c.name,
        compositionFrames: c.decoded.composition.frameCount,
        writer: c.decoded.writer,
      })),
    },
    null,
    2,
  ),
);
