import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { JourneyService, hash, poll, root, run } from "./source-evidence-fixture.mjs";

const { values } = parseArgs({ options: { out: { type: "string" } } });
assert.ok(
  values.out && process.env.YAP_NATIVE,
  "Usage: YAP_NATIVE=WORKER node packages/test-harness/editing/transition-delivery.mjs --out NEW_DIRECTORY",
);
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const home = await mkdtemp("/tmp/yap-transition-delivery-");
const report = {
  passed: false,
  trace: [],
  exchanges: [],
  checks: [],
  nativeSha256: hash(await readFile(process.env.YAP_NATIVE)),
  recipe: {
    kind: "crossfade",
    mediaKind: "video",
    projectRange: { startUs: 0, endUs: 1000000 },
    transitionRange: { startUs: 250000, endUs: 750000 },
    sources: "solid red and solid blue caller-authored images",
  },
};
const service = new JourneyService(home, report, join(out, "native"));
const call = service.call.bind(service);
const ffmpeg =
  process.env.YAP_FFMPEG ?? join(root, "helpers/ffmpeg/.build/distribution/bin/ffmpeg");
const save = () => writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
const runFFmpeg = (args, options) => run(ffmpeg, ["-v", "error", "-nostdin", ...args], options);
const decodeRGB = async (path) =>
  Buffer.from(
    (
      await runFFmpeg(["-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], {
        encoding: "buffer",
      })
    ).stdout,
  );
const meanRGB = (bytes) => {
  const mean = [0, 0, 0];
  for (let i = 0; i < bytes.length; i++) mean[i % 3] += bytes[i];
  return mean.map((value) => value / (bytes.length / 3));
};
const distance = (a, b) =>
  Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
const makeSolid = async (name, color) => {
  const path = join(out, `${name}.png`);
  await runFFmpeg(["-f", "lavfi", "-i", `color=c=${color}:s=64x48`, "-frames:v", "1", path]);
  return path;
};
try {
  await service.start();
  const importImage = async (path) => {
    const imported = await call("asset.import", { requestId: randomUUID(), path });
    const ready = await poll(
      () => call("job.get", { jobId: imported.jobId }),
      (value) => value.state === "ready",
      "image import",
    );
    return call("asset.get", { assetId: ready.published.output.assetId }, { transport: "mcp" });
  };
  const red = await importImage(await makeSolid("red", "red"));
  const blue = await importImage(await makeSolid("blue", "blue"));
  const project = await call("project.create", {
    requestId: randomUUID(),
    canvas: {
      width: 64,
      height: 48,
      fps: { numerator: 4, denominator: 1 },
      background: "#000000ff",
    },
  });
  const edited = await call("edit.apply", {
    projectId: project.project.projectId,
    expectedRevisionId: project.revision.id,
    requestId: randomUUID(),
    operations: [
      { operation: "track.add", label: "red-track", track: { kind: "video", order: 0 } },
      { operation: "track.add", label: "blue-track", track: { kind: "video", order: 1 } },
      {
        operation: "place",
        label: "red",
        clip: {
          trackId: { label: "red-track" },
          assetId: red.id,
          streamId: red.streams[0].id,
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
      {
        operation: "place",
        label: "blue",
        clip: {
          trackId: { label: "blue-track" },
          assetId: blue.id,
          streamId: blue.streams[0].id,
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
      {
        operation: "transition",
        kind: "crossfade",
        targets: [
          { kind: "clip", id: { label: "red" } },
          { kind: "clip", id: { label: "blue" } },
        ],
        mediaKind: "video",
        window: { kind: "project", range: { startUs: 250000, endUs: 750000 } },
      },
    ],
  });
  report.project = { projectId: project.project.projectId, revisionId: edited.revision.id };
  const samples = {};
  for (const atUs of [100000, 500000, 900000]) {
    const request = {
      projectId: project.project.projectId,
      revisionId: edited.revision.id,
      atUs,
      maxLongEdge: 64,
    };
    const ready = await poll(
      () => call("frame.get", request),
      (value) => value.state === "ready",
      `frame ${atUs}`,
    );
    const file = join(out, `frame-${atUs}.png`);
    await call("frame.get", request, { output: file });
    samples[atUs] = {
      meanRGB: meanRGB(await decodeRGB(file)),
      output: {
        implementationId: ready.published.output.implementationId,
        frame: ready.published.output.frame,
      },
    };
  }
  report.samples = samples;
  const edge = samples[100000].meanRGB;
  assert.ok(
    distance(edge, samples[900000].meanRGB) <= 1,
    "outside the transition window, delivery stays on the same top blue layer",
  );
  assert.ok(
    samples[500000].meanRGB[0] > 20 && samples[500000].meanRGB[2] > 100,
    "midpoint contains both explicit transition sources",
  );
  assert.ok(
    distance(samples[500000].meanRGB, edge) > 20,
    "midpoint delivery changes from the outside-window control",
  );
  assert.ok(
    samples[500000].meanRGB[1] < 10,
    "solid-color crossfade does not invent a green channel",
  );
  const preview = join(out, "crossfade-preview.mp4");
  const previewResult = await poll(
    () =>
      call(
        "preview.get",
        {
          projectId: project.project.projectId,
          revisionId: edited.revision.id,
          range: { startUs: 0, endUs: 1000000 },
        },
        { output: preview },
      ),
    (value) => value.state === "ready",
    "crossfade preview",
  );
  const movie = await decodeRGB(preview);
  assert.equal(movie.length, 4 * 64 * 48 * 3, "preview contains the four declared project frames");
  report.preview = { receipt: previewResult.published.output, frames: 4, rgbSha256: hash(movie) };
  report.checks.push(
    "public CLI/MCP asset import and transition authoring",
    "native frame delivery keeps outside-window controls and mixes both explicit sources at midpoint",
    "native preview delivery contains the declared four project frames",
  );
  report.passed = true;
} finally {
  await save();
  await service.stop();
  await rm(home, { recursive: true, force: true });
}
await save();
console.log(
  JSON.stringify({ passed: report.passed, out, checks: report.checks, samples: report.samples }),
);
