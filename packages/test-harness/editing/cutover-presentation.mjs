import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { JourneyService, hash, poll, run } from "./source-evidence-fixture.mjs";

// Continue the retained public identity project; do not reimport capture or repeat ASR.
const { values } = parseArgs({
  options: { out: { type: "string" }, baseline: { type: "string" } },
});
assert(values.out && values.baseline && process.env.SCREENREC_NATIVE);
const baselinePath = await realpath(values.baseline);
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
assert(baseline.passed);
assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), baseline.nativeSha256);
await mkdir(values.out, { mode: 0o700 });
const out = await realpath(values.out);
const report = {
  passed: false,
  baseline: { path: baselinePath, sha256: hash(await readFile(baselinePath)) },
  trace: [],
  attempts: [],
  frames: [],
  color: [],
};
const service = new JourneyService(baseline.homes.new, report);
async function call(operation, params, options) {
  const result = await service.call(operation, params, options);
  report.attempts.push({ operation, params, result });
  return result;
}
async function image(params, leaf) {
  await poll(
    () => call("frame.get", params),
    (value) => value.state === "ready",
    leaf,
  );
  const path = join(out, leaf);
  const receipt = await call("frame.get", params, { output: path });
  return { path, sha256: hash(await readFile(path)), receipt };
}
async function inspectExport(side, receipt) {
  const bytes = await readFile(receipt.output);
  assert.equal(hash(bytes), receipt.receipt.sha256);
  const request = await call("asset.import", {
    requestId: `23a-color-${receipt.receipt.sha256}`,
    path: receipt.output,
  });
  const job = await poll(
    () => call("job.get", { jobId: request.jobId }),
    (value) => value.state === "ready",
    "export color source import",
  );
  const asset = await call("asset.get", { assetId: job.result.assetId });
  const stream = asset.streams.find((value) => value.kind === "video");
  assert(stream);
  const metadata = JSON.parse(
    (await run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", receipt.output])).stdout,
  );
  const video = metadata.streams.find((stream) => stream.codec_type === "video");
  assert.equal(video.width, 3120);
  assert.equal(video.height, 1970);
  assert.equal(video.time_base, "1/1000000");
  assert.equal(video.duration_ts, baseline.cohort.range.endUs);
  if (side === "pointer-project") {
    assert.equal(video.r_frame_rate, "30/1");
    assert.equal(Number(video.nb_frames), baseline.projectVideoClock.frames);
  }
  const frames = [];
  for (const atUs of baseline.frames.map((value) => value.atUs))
    frames.push({
      atUs,
      ...(await image(
        { assetId: asset.id, streamId: stream.id, atUs, maxLongEdge: 3120 },
        `${side}-public-export-${atUs}.png`,
      )),
    });
  report.color.push({ side, asset, metadata, frames });
}
try {
  await service.start();
  for (const { side, receipt } of baseline.exports) await inspectExport(side, receipt);
  const revision = baseline.project.revision;
  const video = revision.document.clips.find(
    (clip) => revision.document.tracks.find((track) => track.id === clip.trackId)?.kind === "video",
  );
  assert(video);
  const edited = await call("edit.apply", {
    projectId: revision.projectId,
    expectedRevisionId: revision.id,
    requestId: "23a-explicit-movie-pointer",
    operations: [
      {
        operation: "processing.set",
        target: { kind: "clip", id: video.id },
        steps: [{ processor: { type: "pointer", trailUs: 0 } }],
      },
    ],
  });
  report.project = edited;
  const selection = { projectId: revision.projectId, revisionId: edited.revision.id };
  for (const atUs of baseline.frames.map((value) => value.atUs))
    report.frames.push({
      atUs,
      ...(await image({ ...selection, atUs, maxLongEdge: 3120 }, `pointer-project-${atUs}.png`)),
    });
  const exportId = randomUUID();
  await call("export.create", {
    ...selection,
    kind: "video",
    exportId,
    directory: out,
    leaf: "pointer-project.mp4",
  });
  report.export = await poll(
    () => call("export.status", { exportId }),
    (value) => value.state === "committed",
    "pointer movie export",
  );
  assert.equal(report.export.snapshot.revisionId, selection.revisionId);
  await inspectExport("pointer-project", report.export);
  const raw = (
    await run(
      "ffmpeg",
      ["-v", "error", "-nostdin", "-i", report.export.output, "-f", "f32le", "-"],
      { encoding: "buffer", maxBuffer: 60 * 1024 ** 2, timeout: 60000 },
    )
  ).stdout;
  const expected = (
    await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-i",
        join(baseline.mediaDirectory, "project.wav"),
        "-f",
        "f32le",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 60 * 1024 ** 2, timeout: 60000 },
    )
  ).stdout;
  assert(raw.length >= expected.length && raw.length - expected.length < 1024 * 8);
  let squared = 0;
  for (let i = 0; i < expected.length; i += 4)
    squared += (raw.readFloatLE(i) - expected.readFloatLE(i)) ** 2;
  report.audio = {
    presentationFrames: expected.length / 8,
    decodedFrames: raw.length / 8,
    rms: Math.sqrt(squared / (expected.length / 4)),
    policy: "Existing export recovered-audio RMS<0.002, complete support without alignment",
  };
  assert(report.audio.rms < 0.002);
  report.passed = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  try {
    await service.stop();
    report.shutdown = "fulfilled";
  } catch (error) {
    report.passed = false;
    report.shutdown = String(error);
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "service.log"), service.logs.join(""));
}
assert(report.passed);
console.log(JSON.stringify({ passed: true, out }));
