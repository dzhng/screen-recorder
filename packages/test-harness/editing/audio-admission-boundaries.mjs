import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { JourneyService, hash, run } from "./source-evidence-fixture.mjs";

const { values } = parseArgs({
  options: { fixtures: { type: "string" }, out: { type: "string" } },
});
assert(values.fixtures && values.out && process.env.SCREENREC_NATIVE);
const out = resolve(values.out);
await mkdir(out);
const report = {
  trace: [],
  cases: [],
  complete: false,
  listening: false,
  scope: "One finite admission cohort; observed outcomes, no new admission policy",
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  harnessSha256: hash(await readFile(new URL(import.meta.url))),
  runtime: process.version,
};
const home = await mkdtemp("/tmp/sr-admission-");
const service = new JourneyService(home, report);
async function request(operation, params) {
  const reply = (await service.mcp.callTool({ name: operation, arguments: params }))
    .structuredContent;
  report.trace.push({ operation, params, reply });
  return reply;
}
async function terminal(operation, params) {
  const deadline = performance.now() + 60000;
  for (;;) {
    const reply = await request(operation, params);
    if (!reply.ok || ["ready", "failed", "canceled"].includes(reply.data.state)) return reply;
    assert(performance.now() < deadline, `${operation} observation deadline`);
    await delay(100);
  }
}
async function observe(selection, range, name) {
  const params = { ...selection, range };
  const reply = await terminal("audio.get", params);
  if (!reply.ok || reply.data.state !== "ready") return { reply };
  const path = join(out, name + ".wav");
  const delivered = await service.call("audio.get", params, { output: path });
  const pcm = (
    await run("ffmpeg", ["-v", "error", "-nostdin", "-i", path, "-f", "f32le", "-"], {
      encoding: "buffer",
      timeout: 30000,
      maxBuffer: 8 * 1024 ** 2,
    })
  ).stdout;
  const probe = JSON.parse(
    (
      await run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path], {
        timeout: 30000,
      })
    ).stdout,
  ).streams[0];
  const receipt = delivered.published.audio;
  assert.equal(pcm.length, receipt.frames * receipt.channels * 4);
  const stats = {
    decodedFrames: pcm.length / receipt.channels / 4,
    pcmSha256: hash(pcm),
    firstSamples: [],
    lastSamples: [],
    channelMaxDifferenceFromAuthored: [],
  };
  for (let channel = 0; channel < receipt.channels; channel++) {
    stats.firstSamples.push(pcm.readFloatLE(channel * 4));
    stats.lastSamples.push(pcm.readFloatLE(pcm.length - receipt.channels * 4 + channel * 4));
    if (name.startsWith("discrete-stereo-project")) {
      let max = 0;
      const start = Math.floor((range.startUs * 48000) / 1000000);
      for (let frame = 0; frame < receipt.frames; frame++) {
        const expected = Math.fround(((((frame + start) * (channel + 3)) % 101) - 50) / 100);
        max = Math.max(
          max,
          Math.abs(pcm.readFloatLE((frame * receipt.channels + channel) * 4) - expected),
        );
      }
      stats.channelMaxDifferenceFromAuthored.push(max);
    }
  }
  return { reply, receipt, probe, stats, file: name + ".wav" };
}
try {
  await service.start();
  for (const name of ["fractional", "four-channel", "discrete-stereo"]) {
    const path = join(resolve(values.fixtures), name + ".caf");
    const result = { name, sourceSha256: hash(await readFile(path)), observations: [] };
    report.cases.push(result);
    const pending = await request("asset.import", { path, requestId: name });
    result.import = pending.ok ? await terminal("job.get", { jobId: pending.data.jobId }) : pending;
    if (!result.import.ok || result.import.data.state !== "ready") continue;
    result.asset = await request("asset.get", { assetId: result.import.data.result.assetId });
    assert(result.asset.ok);
    const asset = result.asset.data,
      stream = asset.streams.find((s) => s.kind === "audio");
    for (const [label, range] of [
      ["full", { startUs: 0, endUs: 1000000 }],
      ["range", { startUs: 123457, endUs: 812349 }],
    ]) {
      result.observations.push({
        path: "source",
        label,
        range,
        ...(await observe(
          { assetId: asset.id, streamId: stream.id },
          range,
          `${name}-source-${label}`,
        )),
      });
    }
    const made = await request("project.create", {
      requestId: name,
      canvas: {
        width: 320,
        height: 180,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
    });
    assert(made.ok);
    const projectId = made.data.project.projectId;
    result.edit = await request("edit.apply", {
      projectId,
      requestId: name,
      expectedRevisionId: made.data.revision.id,
      operations: [
        { operation: "track.add", label: "audio", track: { kind: "audio", order: 0 } },
        {
          operation: "place",
          clip: {
            trackId: { label: "audio" },
            assetId: asset.id,
            streamId: stream.id,
            source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
            placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
          },
        },
      ],
    });
    if (!result.edit.ok) continue;
    for (const [label, range] of [
      ["full", { startUs: 0, endUs: 1000000 }],
      ["range", { startUs: 123457, endUs: 812349 }],
    ]) {
      result.observations.push({
        path: "project",
        label,
        range,
        ...(await observe(
          { projectId, revisionId: result.edit.data.revision.id },
          range,
          `${name}-project-${label}`,
        )),
      });
    }
  }
  report.complete = true;
} finally {
  try {
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  } finally {
    try {
      await service.stop();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  }
}
