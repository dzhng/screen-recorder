import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCompiler, validateComposition } from "../../composition/dist/index.js";
import { compositionAsset } from "../../core/dist/assets.js";
import { classify, mask } from "./render-membership.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2);
assert.deepEqual(args.slice(0, 2), ["--case", "repeat-reorder"]);
const out = args[2] === "--out" ? resolve(args[3]) : await mkdtemp(join(tmpdir(), "sr-video-"));
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), [], "Evidence folder must be empty");
const native =
  process.env.SCREENREC_NATIVE ?? join(root, "helpers/mac/.build/debug/screenrec-native");
const frozen = join(root, "specs/agent-editing/assets/06-platform-temporal");
const corpus = join(root, "specs/agent-editing/assets/00-corpus");
const bytes = 160 * 128 * 3;
function run(command, args, input) {
  const r = spawnSync(command, args, { input, timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr.toString());
  return r.stdout;
}
function call(operation, params) {
  return JSON.parse(run(native, [], JSON.stringify({ id: "video", operation, params }) + "\n"));
}
function ff(args) {
  return run("ffmpeg", ["-v", "error", "-nostdin", ...args]);
}
const json = async (path) => JSON.parse(await readFile(path));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
const refs = [{ id: "black", mask: new Uint8Array(160 * 128) }];
for (const [id, w, h, count] of [
  ["a", 160, 96, 8],
  ["b", 96, 128, 10],
]) {
  const raw = ff([
    "-i",
    join(corpus, id + ".mov"),
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
  for (let index = 0; index < count; index++) {
    const frame = Buffer.alloc(bytes);
    for (let y = 0; y < h; y++)
      raw.copy(
        frame,
        ((y + (128 - h) / 2) * 160 + (160 - w) / 2) * 3,
        (index * h + y) * w * 3,
        (index * h + y + 1) * w * 3,
      );
    refs.push({ id: id.toUpperCase() + index, mask: mask(frame) });
  }
}
const files = new Map();
async function asset(file) {
  if (files.has(file)) return files.get(file);
  const p = call("media.probe", { path: file });
  assert.equal(p.ok, true, JSON.stringify(p));
  const id = basename(file);
  const result = {
    asset: compositionAsset({ id, ...p.data }),
    binding: {
      assetId: id,
      streamId: p.data.streams.find((s) => s.kind === "video").id,
      path: file,
      originUs: p.data.originUs,
    },
  };
  files.set(file, result);
  return result;
}
async function compile(pictures, range, directory, fps = { numerator: 20, denominator: 1 }) {
  const clips = [],
    bindings = [],
    assets = [];
  for (const picture of pictures) {
    const local =
      picture.localFile ??
      join(
        basename(picture.file) === "timestamp-gap.mov" ? corpus : frozen,
        basename(picture.file),
      );
    const a = await asset(local);
    const binding = picture.streamId ? { ...a.binding, streamId: picture.streamId } : a.binding;
    bindings.push(binding);
    assets.push(a.asset);
    clips.push({
      id: picture.id,
      trackId: "video",
      assetId: a.asset.id,
      streamId: binding.streamId,
      source:
        picture.holdUs === null
          ? { kind: "range", range: picture.source }
          : { kind: "hold", atUs: picture.holdUs },
      placement: { kind: "project", range: picture.project },
    });
  }
  const document = {
    canvas: { width: 160, height: 128, fps, background: "#000000ff" },
    tracks: [{ id: "video", kind: "video", order: 0 }],
    groups: [],
    clips,
    syncGroups: [],
    processing: [],
    captions: [],
  };
  const unique = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];
  const compiled = createCompiler(
    validateComposition(
      document,
      unique(assets, (a) => a.id),
    ),
    "fixture",
  ).window({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  const frames = [...compiled.frames()];
  await writeFile(
    join(directory, "frames.jsonl"),
    frames.map((f) => JSON.stringify(f) + "\n").join(""),
  );
  await save(join(directory, "manifest.json"), compiled.manifest);
  return {
    frames,
    request: {
      output: join(directory, "video.mp4"),
      frames: join(directory, "frames.jsonl"),
      range,
      canvas: document.canvas,
      profile: "h264-rec709",
      processing: compiled.manifest.processing,
      assets: unique(bindings, (b) => b.assetId + b.streamId),
    },
  };
}
const sourceProfiles = [];
for (const [name, primaries, transfer, matrix, expectedPrimaries] of [
  ["hdr-pq", 9, 16, 9, "bt2020"],
  ["hdr-hlg", 9, 18, 9, "bt2020"],
  ["wide-p3", 12, 13, 1, "smpte432"],
]) {
  const file = join(out, name + ".mov");
  ff([
    "-i",
    join(frozen, "tagged-a.mov"),
    "-map",
    "0:v:0",
    "-c",
    "copy",
    "-bsf:v",
    `h264_metadata=colour_primaries=${primaries}:transfer_characteristics=${transfer}:matrix_coefficients=${matrix}`,
    "-color_primaries",
    String(primaries),
    "-color_trc",
    String(transfer),
    "-colorspace",
    String(matrix),
    file,
  ]);
  const metadata = JSON.parse(
    run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file]),
  );
  assert.equal(metadata.streams[0].color_primaries, expectedPrimaries);
  const directory = join(out, name);
  await mkdir(directory);
  const { request } = await compile(
    [
      {
        id: name,
        file,
        localFile: file,
        holdUs: null,
        source: { startUs: 0, endUs: 50000 },
        project: { startUs: 0, endUs: 50000 },
      },
    ],
    { startUs: 0, endUs: 50000 },
    directory,
  );
  const response = call("media.renderCompositionVideo", request);
  sourceProfiles.push({
    name,
    colorPrimaries: metadata.streams[0].color_primaries,
    transfer: metadata.streams[0].color_transfer,
    response,
  });
}
assert.ok(
  sourceProfiles.every((r) => !r.response.ok && r.response.error.code === "NOT_READY"),
  JSON.stringify(sourceProfiles),
);
for (const { name } of sourceProfiles) {
  const files = await readdir(join(out, name));
  assert.ok(
    !files.includes("video.mp4") && !files.some((f) => f.startsWith(".screenrec-output-")),
    name + " leaked unsupported output",
  );
}
const results = [];
const names = [
  "av-replacement",
  "audio-replacement",
  "nonzero-preview",
  "held-frame",
  "subframe-source",
  "vfr-held-tail",
  "empty-edit",
  "empty-edit-preview",
];
const scenarios = [];
for (const name of names)
  scenarios.push({
    name,
    original: await json(join(frozen, name, "request.json")),
    expected: await json(join(frozen, name, "expected.json")),
  });
const picture = (id, file, start, end, at, until) => ({
  id,
  file,
  source: { startUs: start, endUs: end },
  project: { startUs: at, endUs: until },
  holdUs: null,
});
const repeated = (...groups) => groups.flatMap(([id, count]) => Array(count).fill(id));
scenarios.push({
  name: "repeat-reorder",
  original: {
    pictures: [
      picture("late", "tagged-a.mov", 1000000, 1500000, 0, 500000),
      picture("again", "tagged-a.mov", 0, 500000, 500000, 1000000),
      picture("b", "tagged-b.mov", 0, 500000, 1250000, 1750000),
    ],
    range: { startUs: 0, endUs: 1750000 },
  },
  expected: {
    frameIDsOnFullProjectGrid: repeated(
      ["A4", 5],
      ["A5", 5],
      ["A0", 5],
      ["A1", 5],
      ["black", 5],
      ["B0", 4],
      ["B1", 4],
      ["B2", 2],
    ),
  },
});
scenarios.push({
  name: "leading-partial-picture",
  original: {
    pictures: [picture("ended", "tagged-a.mov", 0, 50000, 0, 50000)],
    range: { startUs: 50001, endUs: 70000 },
  },
  fps: { numerator: 30000, denominator: 1001 },
  expected: { frameIDsOnFullProjectGrid: ["A0", "A0", "black"] },
});
scenarios.push({
  name: "retimed-picture",
  original: {
    pictures: [picture("slow", "tagged-a.mov", 0, 500000, 0, 1000000)],
    range: { startUs: 0, endUs: 1000000 },
  },
  expected: { frameIDsOnFullProjectGrid: repeated(["A0", 10], ["A1", 10]) },
});
const multi = join(out, "two-streams.mov");
ff([
  "-i",
  join(frozen, "tagged-a.mov"),
  "-i",
  join(frozen, "tagged-b.mov"),
  "-map",
  "0:v:0",
  "-map",
  "1:v:0",
  "-c",
  "copy",
  multi,
]);
const multiProbe = call("media.probe", { path: multi });
assert.equal(multiProbe.ok, true);
scenarios.push({
  name: "selected-second-stream",
  original: {
    pictures: [
      {
        ...picture("second", multi, 0, 500000, 0, 500000),
        localFile: multi,
        streamId: multiProbe.data.streams[1].id,
      },
    ],
    range: { startUs: 0, endUs: 500000 },
  },
  expected: { frameIDsOnFullProjectGrid: repeated(["B0", 4], ["B1", 4], ["B2", 2]) },
});
const distant = join(out, "distant-source.mov");
ff([
  "-stream_loop",
  "299",
  "-i",
  join(frozen, "tagged-a.mov"),
  "-map",
  "0:v:0",
  "-c",
  "copy",
  "-t",
  "600",
  distant,
]);
scenarios.push({
  name: "sparse-forward-cuts",
  original: {
    pictures: [
      { ...picture("start", distant, 0, 250000, 0, 250000), localFile: distant },
      { ...picture("end", distant, 599000000, 599250000, 250000, 500000), localFile: distant },
    ],
    range: { startUs: 0, endUs: 500000 },
  },
  expected: { frameIDsOnFullProjectGrid: repeated(["A0", 5], ["A4", 5]) },
});
scenarios.push({
  name: "sparse-forward-retime",
  original: {
    pictures: [{ ...picture("fast", distant, 0, 600000000, 0, 500000), localFile: distant }],
    range: { startUs: 0, endUs: 500000 },
  },
  expected: { frameIDsOnFullProjectGrid: repeated(["A0", 10]) },
});
for (const { name, original, expected, fps } of scenarios) {
  const directory = join(out, name);
  await mkdir(directory);
  const { request, frames } = await compile(original.pictures, original.range, directory, fps);
  await save(join(directory, "request.json"), request);
  const response = call("media.renderCompositionVideo", request);
  assert.equal(response.ok, true, `${name}: ${JSON.stringify(response)}`);
  if (name.startsWith("sparse-forward"))
    assert.ok(
      response.data.decodedSamples < 100,
      `${name}: decoded discarded middle footage (${response.data.decodedSamples} samples)`,
    );

  const metadata = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_frames",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      request.output,
    ]),
  );
  const raw = ff([
    "-i",
    request.output,
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
  const observed = metadata.frames.filter((f) => f.media_type === "video");
  assert.equal(raw.length, frames.length * bytes);
  const ids = [];
  for (let i = 0; i < frames.length; i++) {
    const actual = classify(raw.subarray(i * bytes, (i + 1) * bytes), refs);
    assert.equal(
      actual.id,
      expected.frameIDsOnFullProjectGrid[frames[i].index],
      `${name} frame ${i}`,
    );
    assert.equal(
      Math.round(Number(observed[i].best_effort_timestamp_time) * 1e6),
      frames[i].visibleRange.startUs - request.range.startUs,
    );
    assert.equal(
      Math.round(Number(observed[i].duration_time) * 1e6),
      frames[i].visibleRange.endUs - frames[i].visibleRange.startUs,
    );
    ids.push(actual.id);
  }
  assert.equal(
    Math.round(Number(metadata.format.duration) * 1e6),
    request.range.endUs - request.range.startUs,
  );
  assert.equal(metadata.streams[0].color_space, "bt709");
  assert.equal(metadata.streams[0].color_transfer, "bt709");
  assert.equal(metadata.streams[0].color_primaries, "bt709");
  await mkdir(join(directory, "shots"));
  ff(["-i", request.output, "-fps_mode", "passthrough", join(directory, "shots/%03d.png")]);
  results.push({ name, ids, receipt: response.data });
}

const negatives = [];
const base = await json(join(out, "av-replacement/request.json"));
async function rejected(name, change, code) {
  const directory = join(out, name);
  await mkdir(directory);
  const request = { ...base, ...change, output: join(directory, "video.mp4") };
  const response = call("media.renderCompositionVideo", request);
  assert.equal(response.ok, false, name);
  assert.equal(response.error.code, code, JSON.stringify(response));
  assert.deepEqual(await readdir(directory), [], `${name} leaked staging/output`);
  negatives.push({ name, error: response.error });
}
await rejected("odd-canvas", { canvas: { ...base.canvas, width: 159 } }, "INVALID_REQUEST");
await rejected(
  "transparent-canvas",
  { canvas: { ...base.canvas, background: "#00000000" } },
  "NOT_READY",
);
await rejected("unknown-profile", { profile: "mystery" }, "NOT_READY");
await rejected(
  "missing-stream",
  { assets: base.assets.map((a) => ({ ...a, streamId: "track:999" })) },
  "INVALID_REQUEST",
);
await rejected(
  "visual-processing",
  {
    processing: [
      {
        target: { kind: "track", id: "video" },
        mediaKind: "video",
        inputs: [],
        steps: [{ id: "visual", enabled: true, processor: { type: "gain", gain: 1 } }],
      },
    ],
  },
  "NOT_READY",
);
const first = JSON.parse((await readFile(base.frames, "utf8")).split("\n")[0]);
for (const [name, frame, code] of [
  [
    "unknown-acquisition",
    { ...first, layers: first.layers.map((l) => ({ ...l, availability: "source-unavailable" })) },
    "UNAVAILABLE",
  ],
  ["unknown-frame-field", { ...first, guess: 1 }, "INVALID_REQUEST"],
  ["multiple-layers", { ...first, layers: [first.layers[0], first.layers[0]] }, "NOT_READY"],
]) {
  const path = join(out, name + ".jsonl");
  await writeFile(path, JSON.stringify(frame) + "\n");
  await rejected(name, { frames: path }, code);
}
const gap = await json(join(out, "empty-edit-preview/request.json"));
const gapFrame = JSON.parse((await readFile(gap.frames, "utf8")).split("\n")[0]);
assert.equal(gapFrame.layers[0].availability, "source-unavailable");
const anchorPath = join(out, "anchor-unavailable.jsonl");
await writeFile(
  anchorPath,
  JSON.stringify({
    ...gapFrame,
    layers: gapFrame.layers.map((l) => ({ ...l, availability: "anchor-unavailable" })),
  }) + "\n",
);
await rejected("anchor-unavailable", { ...gap, frames: anchorPath }, "UNAVAILABLE");

const preservation = [];
if (process.env.SCREENREC_BASELINE_NATIVE) {
  for (const [name, source, spans] of [
    [
      "old-cuts",
      join(frozen, "tagged-a.mov"),
      [
        [0, 500000],
        [1000000, 1500000],
      ],
    ],
    ["old-empty-edit", join(frozen, "empty-edit.mov"), [[0, 1250000]]],
  ]) {
    const directory = join(out, name);
    await mkdir(directory);
    let at = 0;
    const plan = spans.map(([startUs, endUs]) => {
      const span = {
        source: { startUs, endUs },
        playback: { startUs: at, endUs: at + endUs - startUs },
      };
      at = span.playback.endUs;
      return span;
    });
    const pixels = [];
    for (const [label, binary] of [
      ["baseline", process.env.SCREENREC_BASELINE_NATIVE],
      ["current", native],
    ]) {
      const output = join(directory, label + ".mp4");
      const request = {
        id: "preservation",
        operation: "media.renderMovie",
        params: { source, output, plan, tracks: [] },
      };
      const result = JSON.parse(run(binary, [], JSON.stringify(request) + "\n"));
      assert.equal(result.ok, true, JSON.stringify(result));
      const raw = ff([
        "-i",
        output,
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
      pixels.push(createHash("sha256").update(raw).digest("hex"));
    }
    assert.equal(pixels[0], pixels[1], `${name} changed decoded existing-renderer pixels`);
    preservation.push({ name, decodedPixelSHA256: pixels[0] });
  }
}
const resources = [];
let cancellation = null;
if (!args.includes("--temporal-only")) {
  for (const seconds of [3, 600]) {
    const directory = join(out, `held-${seconds}s`);
    await mkdir(directory);
    const { request } = await compile(
      [
        {
          ...picture("held", "tagged-a.mov", 375000, 375001, 0, seconds * 1000000),
          holdUs: 375000,
        },
      ],
      { startUs: 0, endUs: seconds * 1000000 },
      directory,
    );
    await save(join(directory, "request.json"), request);
    const measured = spawnSync("/usr/bin/time", ["-l", native], {
      input:
        JSON.stringify({
          id: "resources",
          operation: "media.renderCompositionVideo",
          params: request,
        }) + "\n",
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(measured.error);
    assert.equal(measured.status, 0, measured.stderr.toString());
    const response = JSON.parse(measured.stdout);
    assert.equal(response.ok, true, JSON.stringify(response));
    assert.equal(response.data.readerOpens, 1);
    assert.equal(response.data.decodedSamples, 1);
    assert.equal(response.data.frames, seconds * 20);
    const counted = JSON.parse(
      run("ffprobe", [
        "-v",
        "error",
        "-count_frames",
        "-show_streams",
        "-of",
        "json",
        request.output,
      ]),
    );
    assert.equal(Number(counted.streams[0].nb_read_frames), seconds * 20);
    const peakRSSBytes = Number(
      measured.stderr.toString().match(/(\d+)\s+maximum resident set size/)?.[1],
    );
    assert.ok(Number.isFinite(peakRSSBytes));
    resources.push({ seconds, peakRSSBytes, receipt: response.data });
  }
  assert.ok(
    resources[1].peakRSSBytes <= resources[0].peakRSSBytes + 128 * 1024 * 1024,
    "Memory grows with retained frame count",
  );
  const cancellationDirectory = join(out, "cancellation");
  await mkdir(cancellationDirectory);
  const cancelRequest = await json(join(out, "held-600s/request.json"));
  cancelRequest.output = join(cancellationDirectory, "video.mp4");
  await save(join(cancellationDirectory, "request.json"), cancelRequest);
  cancellation = run(join(root, "helpers/mac/.build/debug/ScreenRecorderCompositionVideoTests"), [
    join(cancellationDirectory, "request.json"),
  ])
    .toString()
    .trim();
  assert.deepEqual((await readdir(cancellationDirectory)).sort(), ["request.json"]);
  const firstRecord = JSON.parse((await readFile(cancelRequest.frames, "utf8")).split("\n")[0]);
  const retryFrames = join(cancellationDirectory, "retry.jsonl");
  await writeFile(retryFrames, JSON.stringify(firstRecord) + "\n");
  const retry = call("media.renderCompositionVideo", {
    ...cancelRequest,
    frames: retryFrames,
    range: firstRecord.visibleRange,
  });
  assert.equal(retry.ok, true, JSON.stringify(retry));
  const restartedPixels = ff([
    "-i",
    cancelRequest.output,
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
  assert.equal(restartedPixels.length, bytes);
  assert.equal(classify(restartedPixels, refs).id, "A1");
  cancellation += "; same-path worker restart renders the expected A1 frame";
}
await save(join(out, "report.json"), {
  productionNativeEntry: true,
  livePublicJourney: false,
  resourceChecksRun: !args.includes("--temporal-only"),
  sourceProfiles,
  results,
  negatives,
  resources,
  cancellation,
  preservation,
});
console.log(
  JSON.stringify({ out, cases: results.length, refusals: negatives.length, passed: true }),
);
