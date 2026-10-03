import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { renderFrames } from "./fixtures/render-frames.mjs";
import { renderPlan } from "../../../packages/core/dist/presentation-time.js";
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
const frames = renderFrames();
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
  join(root, "helpers/mac/Sources/ScreenRecorderMedia/SampleTiming.swift"),
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
  ["dense-subframe", "dense", [{ startUs: 10000, endUs: 20000 }], [0]],
  [
    "dense-two-spans",
    "dense",
    [
      { startUs: 10000, endUs: 20000 },
      { startUs: 43333, endUs: 53333 },
    ],
    [0, 1],
  ],
  ["sparse-held", "sparse", [{ startUs: 500000, endUs: 510000 }], [0]],
  ["empty-edit", "gap", [{ startUs: 50000, endUs: 60000 }], null],
];
const report = { kind: "generated native membership feasibility", sources: {}, cases: [] };
for (const [name, sourceName, spans, expectedFrames] of cases) {
  const source = join(out, sourceName + ".mov"),
    bytes = await readFile(source),
    directory = join(out, name);
  await mkdir(directory);
  const plan = renderPlan({ spans });
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
    assert.equal(ledger.writer.durationUs, plan.at(-1).playback.endUs);
  } else {
    assert.equal(ledger.membership.fullyProven, false);
    assert.ok(decoded.writer.unsupported);
  }
  report.cases.push({ name, source: sourceName, plan, ledger, decoded });
}
// Opt in after the short membership gate: real-time playback needs an idle host.
if (process.env.SCREENREC_RENDER_PLAYBACK === "1") {
  run("swiftc", [
    "-parse-as-library",
    join(import.meta.dirname, "RenderMembership/playback.swift"),
    "-o",
    join(out, "playback-probe"),
  ]);
  if (process.env.SCREENREC_RENDER_WINDOW === "1") {
    run("swiftc", [
      "-parse-as-library",
      join(import.meta.dirname, "RenderMembership/window.swift"),
      "-o",
      join(out, "window-probe"),
    ]);
  }
  report.playback = {};
  for (const kind of ["leading", "internal"]) {
    const source = join(out, `gap-${kind}.mov`);
    const destination = join(out, `playback-${kind}`);
    run(join(out, "gap-maker"), [join(out, "sparse.mov"), source, kind]);
    if (kind === "internal" && process.env.SCREENREC_RENDER_WINDOW === "1") {
      const shots = join(out, "window-shots");
      await mkdir(shots);
      run(join(out, "window-probe"), [source, shots]);
    }
    const before = hash(await readFile(source));
    run(join(out, "playback-probe"), [source, destination]);
    assert.equal(hash(await readFile(source)), before);
    report.playback[kind] = JSON.parse(await readFile(join(destination, "playback.json"), "utf8"));
    assert.ok(
      report.playback[kind].segments.some(
        (segment) => segment.empty && segment.durationSeconds >= 1.9,
      ),
      "Export must retain the long empty edit",
    );
    const observation = report.playback[kind];
    observation.sourceSha256 = before;
    const gapStart = kind === "leading" ? 0 : 1;
    const gapEnd = gapStart + 2;
    assert.ok(
      observation.events.some(
        (event) =>
          event.itemStatus === 1 &&
          event.acquisition === "no-display" &&
          event.displaySeconds === gapStart,
      ),
      "Running player must explicitly clear presentation at the gap",
    );
    const middle = observation.events.filter(
      (event) => event.currentSeconds > gapStart + 0.5 && event.currentSeconds < gapEnd - 0.5,
    );
    assert.ok(middle.length > 0, "Must observe the gap interior");
    assert.ok(
      middle.every((event) => event.lastAcquiredPresentation === "explicit no-display reference"),
    );
    const images = observation.events.filter((event) => event.acquisition === "image");
    assert.deepEqual(
      images.map((event) => event.displaySeconds),
      kind === "leading" ? [2] : [0, 3],
    );
    observation.imageMatches = [];
    for (const event of images) {
      const raw = join(destination, event.image + ".rgb");
      run("ffmpeg", [
        "-v",
        "error",
        "-i",
        join(destination, event.image),
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        raw,
      ]);
      const pixels = await readFile(raw);
      assert.equal(pixels.length, frames[0].length);
      const errors = frames.map((frame) => {
        let sum = 0;
        for (let i = 0; i < pixels.length; i++) sum += Math.abs(pixels[i] - frame[i]);
        return sum / pixels.length;
      });
      const best = Math.min(...errors);
      const sourceFrame = errors.indexOf(best);
      assert.equal(sourceFrame, event.displaySeconds === 0 ? 0 : 1);
      assert.ok(best < 12, `Unexpected presentation pixels: MAE ${best}`);
      observation.imageMatches.push({
        image: event.image,
        sourceFrame,
        meanAbsoluteRgbError: best,
      });
    }
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
