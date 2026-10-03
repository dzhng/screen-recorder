import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  createCompiler,
  validateComposition,
  resolveOutputSettings,
} from "../../../../packages/composition/dist/index.js";
const [directory, label, native] = process.argv.slice(2);
assert.ok(directory && label && native);
const out = join(directory, label);
mkdirSync(out, { recursive: false });
const sourceFrames = join(directory, "source-compiled");
mkdirSync(sourceFrames, { recursive: true });
const captures = JSON.parse(readFileSync(join(directory, "capture.json"))),
  results = [];
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function run(command, args, input) {
  const child = spawn(command, args, { detached: true, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "",
    stderr = "",
    failure;
  const kill = () => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") failure ??= error;
    }
  };
  const timer = setTimeout(() => {
    failure = new Error("Owned media process exceeded 120 seconds");
    kill();
  }, 120000);
  for (const [stream, append] of [
    [
      child.stdout,
      (text) => {
        stdout += text;
      },
    ],
    [
      child.stderr,
      (text) => {
        stderr += text;
      },
    ],
  ])
    stream.on("data", (data) => {
      append(data.toString());
      if (stdout.length + stderr.length > 4 * 1024 * 1024) {
        failure = new Error("Owned media process exceeded output bound");
        kill();
      }
    });
  child.stdin.on("error", () => {});
  const status = await new Promise((resolve) => {
    child.once("error", (error) => {
      failure = error;
    });
    child.once("close", resolve);
    child.stdin.end(input);
  });
  clearTimeout(timer);
  assert.equal(failure, undefined);
  assert.equal(status, 0, stderr);
  return { stdout, stderr };
}
async function probe(path) {
  const result = JSON.parse(
    (
      await run(
        native,
        [],
        JSON.stringify({
          id: "probe",
          operation: "media.probe",
          params: { path },
        }) + "\n",
      )
    ).stdout,
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  const video = result.data.streams.filter((stream) => stream.kind === "video");
  assert.equal(video.length, 1, "Text-fidelity fixtures must provide exactly one video stream");
  const stream = video[0];
  return {
    stream,
    asset: { assetId: path, streamId: stream.id, path, originUs: result.data.originUs },
    available: stream.segments
      .filter((segment) => !segment.empty)
      .map(({ startUs, endUs }) => ({ startUs, endUs })),
  };
}
async function frame(binding, output, atUs) {
  const result = JSON.parse(
    (
      await run(
        native,
        [],
        JSON.stringify({
          id: "frame",
          operation: "media.sourceFrame",
          params: {
            asset: binding.asset,
            available: binding.available,
            output,
            atUs,
            maxLongEdge: 8192,
          },
        }) + "\n",
      )
    ).stdout,
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
}
for (const capture of captures) {
  const source = join(directory, capture.name + ".mov"),
    output = join(out, capture.name + ".mp4"),
    before = sha(source),
    durationUs = 4_000_000;
  const selected = await probe(source);
  const range = { startUs: 0, endUs: durationUs };
  const canvas = {
    width: selected.stream.orientedWidth,
    height: selected.stream.orientedHeight,
    fps: { numerator: 60, denominator: 1 },
    background: "#000000ff",
  };
  const document = {
    canvas,
    tracks: [{ id: "video", kind: "video", order: 0 }],
    groups: [],
    syncGroups: [],
    processing: [],
    clips: [
      {
        id: "source",
        trackId: "video",
        assetId: selected.asset.assetId,
        streamId: selected.asset.streamId,
        source: { kind: "range", range },
        placement: { kind: "project", range },
      },
    ],
  };
  const compiler = createCompiler(
    validateComposition(document, [
      {
        id: selected.asset.assetId,
        streams: [
          {
            id: selected.stream.id,
            kind: "video",
            width: canvas.width,
            height: canvas.height,
            bounds: { startUs: selected.stream.startUs, endUs: selected.stream.endUs },
            available: selected.available,
          },
        ],
      },
    ]),
    "text-fidelity",
  );
  const frames = [
    ...compiler
      .videoWindow({
        range,
        rendition: { sampleRate: 48000, channels: 2 },
        tap: { target: { kind: "output" }, point: { kind: "processed" } },
      })
      .frames(),
  ];
  const framesFile = join(out, capture.name + ".frames.jsonl");
  writeFileSync(framesFile, frames.map((frame) => JSON.stringify(frame) + "\n").join(""));
  const request = {
    id: "render",
    operation: "media.renderCompositionVideo",
    params: {
      output,
      frames: framesFile,
      range,
      canvas,
      settings: resolveOutputSettings(),
      processing: [],
      assets: [selected.asset],
    },
  };
  writeFileSync(join(out, capture.name + "-request.json"), JSON.stringify(request, null, 2));
  const started = Date.now(),
    runResult = await run("/usr/bin/time", ["-l", native], JSON.stringify(request) + "\n"),
    elapsedMs = Date.now() - started;
  writeFileSync(join(out, capture.name + "-response.json"), runResult.stdout);
  writeFileSync(join(out, capture.name + "-native.log"), runResult.stderr);
  const result = JSON.parse(runResult.stdout);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.durationUs, durationUs);
  assert.equal(sha(source), before);
  assert.equal(result.data.frames, frames.length);
  const renderedSource = await probe(output);
  const states = [];
  for (const [state, at] of [
    ["top", 600000],
    ["scrolling", 1350000],
    ["details", 2300000],
    ["dark", 3600000],
  ]) {
    assert.ok(at < durationUs);
    const id = capture.name + "-" + state;
    const ref = join(sourceFrames, id + ".png"),
      refReceipt = join(sourceFrames, id + ".json");
    const compiled = frames.find(
      (frame) => frame.visibleRange.startUs <= at && at < frame.visibleRange.endUs,
    );
    assert.ok(compiled, "Every review timestamp must address a compiled output frame");
    const layer = compiled.layers.find((layer) => layer.kind === "video");
    assert.ok(layer && layer.availability === "available");
    if (!existsSync(ref)) {
      const receipt = await frame(selected, ref, layer.sourceUs);
      writeFileSync(
        refReceipt,
        JSON.stringify(
          { ...receipt, projectSampleUs: compiled.sampleAtUs, sourceSHA256: before },
          null,
          2,
        ),
      );
    }
    const sourceReceipt = JSON.parse(readFileSync(refReceipt));
    assert.equal(sourceReceipt.sourceSHA256, before, "Reference source bytes must stay pinned");
    assert.equal(
      sourceReceipt.projectSampleUs,
      compiled.sampleAtUs,
      "Reference must use the same CFR phase",
    );
    const rendered = await frame(renderedSource, join(out, id + ".png"), compiled.sampleAtUs);
    assert.equal(rendered.width, sourceReceipt.width);
    assert.equal(rendered.height, sourceReceipt.height);
    assert.equal(rendered.actualSourceUs, compiled.visibleRange.startUs);
    states.push({
      state,
      sourceUs: sourceReceipt.actualSourceUs,
      projectSampleUs: compiled.sampleAtUs,
      visibleRange: compiled.visibleRange,
      renderedUs: rendered.actualSourceUs,
      width: rendered.width,
      height: rendered.height,
    });
  }
  const metadata = JSON.parse(
    (
      await run("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size,bit_rate:stream=width,height,profile,codec_name,bit_rate,color_space,color_transfer,color_primaries",
        "-of",
        "json",
        output,
      ])
    ).stdout,
  );
  assert.equal(Number(metadata.format.duration) * 1_000_000, durationUs);
  assert.equal(metadata.streams[0].width, result.data.width);
  assert.equal(metadata.streams[0].height, result.data.height);
  results.push({
    capture,
    canvas,
    sourceSHA256: before,
    outputSHA256: sha(output),
    receipt: { ...result.data, file: capture.name + ".mp4" },
    elapsedMs,
    maxRSS: Number(runResult.stderr.match(/(\d+)\s+maximum resident set size/)[1]),
    metadata,
    states,
  });
}
writeFileSync(
  join(out, "report.json"),
  JSON.stringify({ label, binarySHA256: sha(native), results }, null, 2),
);
console.log(
  JSON.stringify(
    results.map((r) => ({
      capture: r.capture.name,
      bytes: r.receipt.bytes,
      elapsedMs: r.elapsedMs,
      maxRSS: r.maxRSS,
    })),
  ),
);
