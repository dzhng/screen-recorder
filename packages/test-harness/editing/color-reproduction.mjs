import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = resolve(process.argv[2] ?? `/tmp/screenrec-color-${Date.now()}`);
assert.ok(!existsSync(out), "Choose a fresh evidence directory");
mkdirSync(out, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const run = (command, args) => {
  const r = spawnSync(command, args, { timeout: 60000, maxBuffer: 128 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr.toString());
  return r.stdout;
};
const source = join(root, "packages/test-harness/editing/RenderReproduction.swift"),
  timing = join(root, "helpers/mac/Sources/ScreenRecorderMedia/SampleTiming.swift"),
  binary = join(out, "probe");
run("swiftc", ["-parse-as-library", timing, source, "-o", binary]);
const corpus = join(root, "specs/agent-editing/assets/00-corpus"),
  frozen = join(root, "specs/agent-editing/assets/06-render");
const rotated = join(out, "rotation-only.mov");
run("ffmpeg", [
  "-v",
  "error",
  "-display_rotation",
  "90",
  "-i",
  join(frozen, "tagged-a.mov"),
  "-map",
  "0:v:0",
  "-c",
  "copy",
  rotated,
]);
const probe = (file) =>
  JSON.parse(
    run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", file]),
  ).streams[0];
assert.ok(
  probe(rotated).side_data_list?.some((x) => Math.abs(x.rotation) === 90),
  "Rotation metadata must really be present",
);
const videoHash = (file) =>
  run("ffmpeg", [
    "-v",
    "error",
    "-i",
    file,
    "-map",
    "0:v:0",
    "-c",
    "copy",
    "-f",
    "hash",
    "-hash",
    "sha256",
    "pipe:1",
  ])
    .toString()
    .trim();
assert.equal(
  videoHash(rotated),
  videoHash(join(frozen, "tagged-a.mov")),
  "Rotation derivative must preserve compressed pictures",
);
const baseCases = [
  { name: "synthetic-untagged", file: join(corpus, "a.mov"), width: 160, height: 96 },
  { name: "synthetic-declared", file: join(frozen, "tagged-a.mov"), width: 160, height: 96 },
  { name: "rotation-declared", file: rotated, width: 96, height: 160 },
  {
    name: "recorded-fixture",
    file: join(root, "fixtures/narrated-workbench/video.mov"),
    width: 3120,
    height: 1970,
  },
  {
    name: "recorded-fixture-40mbps",
    file: join(root, "fixtures/narrated-workbench/video.mov"),
    width: 3120,
    height: 1970,
    videoBitrate: 40_000_000,
  },
];
const cases = [...baseCases, ...baseCases.map((c) => ({ ...c, name: c.name + "-rec709", outputProfile: "rec709" }))];
const report = {
  sourceCommit: run("git", ["-C", root, "rev-parse", "HEAD"]).toString().trim(),
  invocation: process.argv.slice(1),
  sourceHashes: [source, timing, fileURLToPath(import.meta.url)].map((path) => ({
    path,
    sha256: hash(readFileSync(path)),
  })),
  versions: {
    swift: run("swiftc", ["--version"]).toString(),
    os: run("sw_vers", []).toString(),
    ffmpeg: run("ffmpeg", ["-version"]).toString().split("\n")[0],
  },
  reference:
    "Native source decode and native color interpretation, fit into the declared canvas at source time0. This preserves platform-decoded appearance, not an assertion about intended appearance of untagged media.",
  outputPolicy:
    "Compare original sRGB output against explicit Rec.709 output. Rec.709 derives the RGB color space from Core Video 709 attachments, tags the BGRA buffer with that CGColorSpace, and declares 709 primaries/transfer/matrix to the writer. Both use H264 at 4Mbps with a recorded-frame 40Mbps comparison. Original source tags/bytes are never rewritten. Rotation uses a separately hashed metadata-only derivative.",
  tolerance: 4,
  selectionPolicy:
    "Fixed5x5 normalized lattice at0.1,0.3,0.5,0.7,0.9 plus synthetic red/green landmarks; chosen before roundtrip. Report whole-frame differences as well, without dropping edge/text pixels.",
  results: [],
  outputs: [],
};
const pngRGB = (file) =>
  run("ffmpeg", ["-v", "error", "-i", file, "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
function compare(reference, actual, points, width) {
  assert.equal(actual.length, reference.length);
  let total = 0,
    max = 0,
    over4 = 0;
  for (let i = 0; i < actual.length; i++) {
    const d = Math.abs(actual[i] - reference[i]);
    total += d;
    max = Math.max(max, d);
    over4 += d > 4;
  }
  const selections = points.map(([x, y]) => {
    const i = (y * width + x) * 3,
      a = [...reference.subarray(i, i + 3)],
      b = [...actual.subarray(i, i + 3)];
    return {
      x,
      y,
      reference: a,
      actual: b,
      maxError: Math.max(...a.map((v, c) => Math.abs(v - b[c]))),
    };
  });
  return {
    channelMAE: total / actual.length,
    maximumChannelError: max,
    channelFractionOver4: over4 / actual.length,
    allPixelsWithin4: max <= 4,
    selections,
    selectedPixelsWithin4: selections.every((x) => x.maxError <= 4),
  };
}
for (const c of cases) {
  const before = hash(readFileSync(c.file)),
    directory = join(out, c.name);
  mkdirSync(directory);
  const reference = join(directory, "source-native.png"),
    sourceInfo = JSON.parse(
      run(binary, ["reference", c.file, reference, String(c.width), String(c.height), "native"]),
    );
  const referenceBytes = pngRGB(reference);
  assert.equal(referenceBytes.length, c.width * c.height * 3);
  const points = [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((y) =>
    [0.1, 0.3, 0.5, 0.7, 0.9].map((x) => [Math.floor(x * c.width), Math.floor(y * c.height)]),
  );
  if (c.width === 160) points.push([4, 4], [145, 85]);
  writeFileSync(
    join(directory, "reference-pixels.json"),
    JSON.stringify(
      {
        sourceHash: before,
        sourceInfo,
        points: points.map(([x, y]) => ({
          x,
          y,
          rgb: [...referenceBytes.subarray((y * c.width + x) * 3, (y * c.width + x) * 3 + 3)],
        })),
      },
      null,
      2,
    ) + "\n",
  );
  const request = {
    width: c.width,
    height: c.height,
    fps: 20,
    range: { startUs: 0, endUs: 50000 },
    pictures: [
      {
        id: c.name,
        file: c.file,
        source: { startUs: 0, endUs: 50000 },
        project: { startUs: 0, endUs: 50000 },
        holdUs: null,
      },
    ],
    audio: [],
    output: directory,
    colorPolicy: "native",
    savePreEncode: true,
    outputProfile: c.outputProfile ?? "srgb",
    videoBitrate: c.videoBitrate ?? 4_000_000,
  };
  const requestPath = join(directory, "request.json");
  writeFileSync(requestPath, JSON.stringify(request, null, 2) + "\n");
  const resourcePath = join(directory, "resources.txt");
  const execution = JSON.parse(
    run("/usr/bin/time", ["-l", "-o", resourcePath, binary, "bounded", requestPath]),
  );
  execution.peakRSSBytes = Number(
    readFileSync(resourcePath, "utf8").match(/(\d+)\s+maximum resident set size/)[1],
  );
  execution.outputBytes = statSync(join(directory, "bounded.mov")).size;
  const roundtrip = join(directory, "roundtrip-native.png"),
    roundtripInfo = JSON.parse(
      run(binary, [
        "reference",
        join(directory, "bounded.mov"),
        roundtrip,
        String(c.width),
        String(c.height),
        "native",
      ]),
    );
  const assumed = join(directory, "source-assume-srgb.png");
  run(binary, ["reference", c.file, assumed, String(c.width), String(c.height), "assume-srgb"]);
  const result = {
    name: c.name,
    source: { path: c.file, sha256: before, metadata: probe(c.file), native: sourceInfo },
    request,
    execution,
    outputNative: roundtripInfo,
    outputMetadata: probe(join(directory, "bounded.mov")),
    preEncode: compare(referenceBytes, pngRGB(join(directory, "pre-encode.png")), points, c.width),
    roundtrip: compare(referenceBytes, pngRGB(roundtrip), points, c.width),
    explicitAssumptionDifference: compare(referenceBytes, pngRGB(assumed), points, c.width),
  };
  if (c.name.startsWith("rotation-declared")) {
    const original = pngRGB(join(out, "synthetic-declared/source-native.png")),
      rotation = new Uint8Array(referenceBytes.length);
    // Independent90degree counterclockwise RGB mapping of the unrotated declared source.
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 160; x++)
        for (let ch = 0; ch < 3; ch++)
          rotation[((159 - x) * 96 + y) * 3 + ch] = original[(y * 160 + x) * 3 + ch];
    result.rotationOracle = compare(Buffer.from(rotation), referenceBytes, points, c.width);
  }
  assert.equal(hash(readFileSync(c.file)), before, "Source must remain immutable");
  report.results.push(result);
}
function inventory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inventory(path);
    else if (entry.name !== "probe")
      report.outputs.push({ path: path.slice(out.length + 1), sha256: hash(readFileSync(path)) });
  }
}
inventory(out);
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    out,
    results: report.results.map((x) => ({
      case: x.name,
      preEncodeWithin4: x.preEncode.allPixelsWithin4,
      roundtripSelectedWithin4: x.roundtrip.selectedPixelsWithin4,
      roundtripWholeWithin4: x.roundtrip.allPixelsWithin4,
      rotation: x.rotationOracle?.allPixelsWithin4,
    })),
  }),
);
