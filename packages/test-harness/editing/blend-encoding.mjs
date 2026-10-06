import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { createCompiler, validateComposition } from "../../composition/dist/index.js";
import { mediaWorker, nativeResult } from "../../../apps/service/dist/worker.js";
import { run, root, hash } from "./source-evidence-fixture.mjs";
import {
  compareBlendRaster,
  selectBlendCases,
  verifyBlendMovieSupport,
  verifyBlendReferenceIdentity,
} from "./blend-reference.mjs";
import { verifyPicturePixels } from "./decoded-picture-proof.mjs";

const { values } = parseArgs({
  options: { out: { type: "string" }, case: { type: "string" }, help: { type: "boolean" } },
});
if (values.help) {
  console.log(
    "YAP_NATIVE=ABSOLUTE_WORKER node blend-encoding.mjs --out ABSOLUTE_EMPTY_DIRECTORY [--case RETAINED_CASE]\nEncode each frozen independent arithmetic PNG as an unprocessed image through the existing compiler/native H.264 path. Compare both delivered movie samples over the full raster against the frozen blend movie using identical settings. Raw-reference loss remains a separate claim. No devices/models or source mutation.",
  );
  process.exit(0);
}
assert.ok(
  values.out &&
    isAbsolute(values.out) &&
    process.env.YAP_NATIVE &&
    isAbsolute(process.env.YAP_NATIVE),
);
const out = values.out;
await mkdir(out);
const evidence = join(root, "specs/video-editing-feedback/assets/24-blend-sheet");
const frozen = JSON.parse(await readFile(join(evidence, "report.json")));
const cases = selectBlendCases(frozen.cases, values.case);
const readers = {};
const report = {
  passed: false,
  scope:
    "Independent arithmetic PNG delivered as one unprocessed image through the same frozen H.264 settings; full-raster movie reproducibility, not lossless raw-RGB fidelity",
  workerSha256: hash(await readFile(process.env.YAP_NATIVE)),
  observers: {},
  cases: [],
};
for (const [kind, source] of [
  ["pixels", "FrameImagePixels.swift"],
  ["movie", "FrameColorReference.swift"],
  ["support", "FrameSampleSupport.swift"],
]) {
  readers[kind] = join(out, kind + "-reader");
  const file = join(root, "packages/test-harness/editing", source);
  report.observers[source] = hash(await readFile(file));
  await run("swiftc", ["-parse-as-library", file, "-o", readers[kind]], { timeout: 120000 });
}
const native = mediaWorker(process.env);
async function pixels(file, raw) {
  const observation = JSON.parse(
    (await run(readers.pixels, [file, raw], { timeout: 60000 })).stdout,
  );
  verifyPicturePixels(observation);
  assert.deepEqual([observation.width, observation.height], [128, 64]);
  return { observation, rgba: await readFile(raw) };
}
async function decode(file, directory) {
  await mkdir(directory);
  const request = join(directory, "read.json");
  await writeFile(
    request,
    JSON.stringify({ movie: file, output: directory, timesUs: [0, 100000] }),
  );
  const reads = JSON.parse((await run(readers.movie, [request], { timeout: 60000 })).stdout);
  assert.deepEqual(
    reads.map((read) => read.requestedUs),
    [0, 100000],
  );
  return Promise.all(
    reads.map(async (read, i) => {
      assert.equal(read.status, "available", read.error);
      assert.equal((Number(read.actualValue) * 1000000) / read.actualTimescale, read.requestedUs);
      return { read, ...(await pixels(read.file, join(directory, i + ".rgba"))) };
    }),
  );
}
try {
  for (const item of cases) {
    const directory = join(out, item.scenario);
    await mkdir(directory);
    const reference = join(evidence, item.scenario, "reference.png");
    verifyBlendReferenceIdentity(item.scenario, hash(await readFile(reference)), frozen.cases);
    const input = await pixels(reference, join(directory, "input.rgba"));
    const movie = join(evidence, item.scenario, "candidate.mp4");
    assert.equal(hash(await readFile(movie)), item.artifacts["candidate.mp4"]);
    const range = { startUs: 0, endUs: 200000 };
    const document = {
      canvas: item.document.canvas,
      tracks: [{ id: "reference", kind: "video", order: 0 }],
      groups: [],
      clips: [
        {
          id: "reference",
          trackId: "reference",
          assetId: "reference",
          streamId: "image:0",
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range },
        },
      ],
      processing: [],
      syncGroups: [],
    };
    const assets = [
      { id: "reference", streams: [{ id: "image:0", kind: "image", width: 128, height: 64 }] },
    ];
    const window = createCompiler(
      validateComposition(document, assets),
      "independent-blend-reference",
    ).videoWindow({
      range,
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    const frames = [...window.frames()];
    const bindings = [{ assetId: "reference", streamId: "image:0", path: reference, originUs: 0 }];
    const frameRequest = {
      output: join(directory, "control.png"),
      canvas: document.canvas,
      frame: frames[0],
      processing: [],
      assets: bindings,
      profile: "h264-rec709",
      maxLongEdge: 128,
    };
    const frame = nativeResult(await native("media.renderCompositionFrame", frameRequest));
    const controlStill = await pixels(frame.file, join(directory, "control.rgba"));
    const stillProof = compareBlendRaster(controlStill.rgba, input.rgba, {
      width: 128,
      height: 64,
      limit: 2,
    });
    const records = join(directory, "frames.jsonl");
    await writeFile(records, frames.map((frame) => JSON.stringify(frame) + "\n").join(""));
    const request = {
      output: join(directory, "control.mp4"),
      frames: records,
      range,
      canvas: document.canvas,
      processing: [],
      assets: bindings,
      settings: item.movie.request.settings,
    };
    const receipt = nativeResult(await native("media.renderCompositionVideo", request));
    const supportRequest = join(directory, "support.json");
    await writeFile(
      supportRequest,
      JSON.stringify({
        file: receipt.file,
        points: [
          { numerator: 0, denominator: 1 },
          { numerator: 100000, denominator: 1 },
        ],
      }),
    );
    const support = JSON.parse(
      (await run(readers.support, [supportRequest], { timeout: 60000 })).stdout,
    );
    verifyBlendMovieSupport(support);
    const controls = await decode(receipt.file, join(directory, "control-frames"));
    const actual = await decode(movie, join(directory, "actual-frames"));
    const proofs = actual.map((sample, i) =>
      compareBlendRaster(sample.rgba, controls[i].rgba, { width: 128, height: 64, limit: 8 }),
    );
    report.cases.push({
      scenario: item.scenario,
      referenceSha256: item.artifacts["reference.png"],
      originalMovieSha256: item.artifacts["candidate.mp4"],
      document,
      frameRequest,
      frame,
      stillProof,
      request,
      receipt,
      support,
      controlSha256: hash(await readFile(receipt.file)),
      proofs,
      controls: controls.map(({ read, observation }) => ({ read, observation })),
      actual: actual.map(({ read, observation }) => ({ read, observation })),
    });
    verifyBlendReferenceIdentity(item.scenario, hash(await readFile(reference)), frozen.cases);
    assert.equal(
      hash(await readFile(movie)),
      item.artifacts["candidate.mp4"],
      "Original movie remains unchanged",
    );
    console.log(
      `PASS encoded ${item.scenario}: full-raster maxima ${proofs.map((proof) => proof.maximum).join(", ")}`,
    );
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  }
  report.passed = true;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
}
