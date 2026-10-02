import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { RevisionStore } from "../../packages/core/dist/library.js";
import { SourceEvidenceStore, recordingEvidenceOwner } from "../../packages/core/dist/evidence.js";
import { planAudioTracks } from "../../packages/core/dist/audio.js";
import {
  createRevision,
  editedToSource,
  sourceToEdited,
} from "../../packages/core/dist/timeline.js";
import { renderPlan } from "../../packages/core/dist/presentation-time.js";
import { renderFrames } from "../../helpers/mac/Tests/fixtures/render-frames.mjs";

const dir =
  process.env.SCREENREC_MOVIE_SCALE_EVIDENCE ??
  (await mkdtemp(join(tmpdir(), "screenrec-movie-scale-")));
assert.ok(isAbsolute(dir));
await mkdir(dir, { recursive: true });
assert.deepEqual(await readdir(dir), []);
const native = new URL("../../helpers/mac/.build/debug/screenrec-native", import.meta.url).pathname;
const referenceNative = new URL(
  "../../helpers/mac/.build/debug/ScreenRecorderAudioTests",
  import.meta.url,
).pathname;
function execute(command, args, { input, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    input,
    env,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result;
}
function run(command, args, options) {
  return execute(command, args, options).stdout;
}
async function hash(file) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
async function floats(file, frame, count, channels) {
  const handle = await open(file);
  try {
    const b = Buffer.alloc(count * channels * 4);
    assert.equal((await handle.read(b, 0, b.length, frame * channels * 4)).bytesRead, b.length);
    return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  } finally {
    await handle.close();
  }
}
const frames = renderFrames(),
  rgb = await open(join(dir, "source.rgb"), "wx");
try {
  for (let index = 0; index < 300; index++) {
    const frame = Buffer.from(frames[index % frames.length]);
    for (let bit = 0; bit < 9; bit++)
      for (let y = 150; y < 172; y++)
        for (let x = 10 + bit * 30; x < 30 + bit * 30; x++) {
          const offset = (y * 320 + x) * 3;
          frame.fill(index & (1 << bit) ? 255 : 0, offset, offset + 3);
        }
    await rgb.write(frame);
  }
} finally {
  await rgb.close();
}
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
  "1",
  "-i",
  join(dir, "source.rgb"),
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-bf",
  "0",
  "-an",
  join(dir, "base-video.mov"),
]);
run("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "aevalsrc=0.2*sin(2*PI*(997*t+0.85*t*t)):s=48000:d=300",
  "-c:a",
  "aac",
  "-b:a",
  "96k",
  join(dir, "narration.m4a"),
]);
run("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "aevalsrc=0.2*sin(2*PI*(1511*t+0.55*t*t))|0.2*sin(2*PI*(2111*t+0.35*t*t)):s=44100:d=300",
  "-c:a",
  "pcm_f32le",
  join(dir, "base-system.mov"),
]);
run("swiftc", [
  "-parse-as-library",
  new URL("../../helpers/mac/Tests/MovieTiming/gaps.swift", import.meta.url).pathname,
  "-o",
  join(dir, "gaps"),
]);
run("swiftc", [
  "-parse-as-library",
  new URL("../../helpers/mac/Tests/MovieTiming/main.swift", import.meta.url).pathname,
  "-o",
  join(dir, "inspect"),
]);
const containerGaps = {};
for (const [role, type, input] of [
  ["video", "video", "base-video.mov"],
  ["system", "audio", "base-system.mov"],
]) {
  containerGaps[role] = JSON.parse(
    run(join(dir, "gaps"), [join(dir, input), join(dir, role + ".mov"), type]),
  );
  assert.deepEqual(
    containerGaps[role].filter((s) => s.empty).map((s) => [s.startUs, s.durationUs]),
    [
      [4000000, 1000000],
      [151000000, 2000000],
    ],
  );
}
const priming = JSON.parse(
  run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a",
    "-read_intervals",
    "%+#1",
    "-show_packets",
    "-of",
    "json",
    join(dir, "narration.m4a"),
  ]),
).packets[0];
assert.ok(priming.side_data_list.some((s) => s.skip_samples > 0));
const sources = ["video.mov", "narration.m4a", "system.mov"],
  hashes = {};
for (const name of sources) hashes[name] = await hash(join(dir, name));
const store = new RevisionStore(join(dir, "catalog.sqlite"), {
  now: () => new Date().toISOString(),
  newId: randomUUID,
});
const recording = store.allocate().recording;
store.ingestLifecycle(recording.recordingId, {
  sourceId: recording.sourceId,
  sequence: 1,
  state: "interrupted",
  reason: "generated fixture",
  sourceDurationUs: 300000000,
});
const evidence = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
const acquisitions = [
  { role: "narration", startUs: 125000, endUs: 142000000 },
  { role: "narration", startUs: 142250000, endUs: 300000000 },
  { role: "system", startUs: 0, endUs: 200000000 },
  { role: "system", startUs: 201000000, endUs: 300000000 },
];
const normalized =
    acquisitions.map((data) => JSON.stringify({ event: "audioAcquired", data })).join("\n") + "\n",
  journal = join(dir, "normalized.jsonl");
await writeFile(journal, normalized);
const metadata = await evidence.ingest({
  owner: { kind: "recording", recordingId: recording.recordingId },
  sourceId: recording.sourceId,
  generation: randomUUID(),
  file: journal,
  receipt: {
    file: journal,
    journal: "capture.journal.jsonl",
    header: { sessionID: recording.sourceId, microphone: true, systemAudio: true },
    cursorSamples: 0,
    geometryRecords: 0,
    displaySpaces: 0,
    pauseEvents: 0,
    audioIntervals: 4,
    lastSequence: 4,
    incompleteTail: false,
    finished: true,
    bytes: Buffer.byteLength(normalized),
  },
});
const results = [];
try {
  for (const seconds of [10, 300]) {
    const spans = [
      { startUs: 0, endUs: 1728333 },
      { startUs: 2005000, endUs: seconds === 10 ? 10000000 : 153583337 },
    ];
    if (seconds === 300) spans.push({ startUs: 154000000, endUs: 300000000 });
    const revision = createRevision(store.revision(recording.recordingId), spans, {
        id: randomUUID(),
        operation: "cut",
        createdAt: new Date().toISOString(),
      }),
      plan = renderPlan(revision);
    const audio = planAudioTracks(
      {
        recordingId: recording.recordingId,
        sourceId: recording.sourceId,
        sourceEvidence: metadata,
        spans: revision.spans,
        track: "mix",
      },
      evidence,
      (role) => join(dir, role === "narration" ? "narration.m4a" : "system.mov"),
    );
    assert.deepEqual(audio.missingRoles, []);
    const output = join(dir, seconds + ".mp4"),
      request = {
        id: "scale",
        operation: "media.renderMovie",
        params: { source: join(dir, "video.mov"), output, plan, tracks: audio.tracks },
      };
    const started = Date.now(),
      measured = execute("/usr/bin/time", ["-l", native], {
        input: JSON.stringify(request) + "\n",
      }),
      wallMs = Date.now() - started;
    const reply = JSON.parse(measured.stdout);
    assert.equal(reply.ok, true, JSON.stringify(reply));
    const maxRSS = Number(measured.stderr.match(/(\d+)\s+maximum resident set size/)[1]);
    assert.equal(reply.data.durationUs, revision.durationUs);
    assert.equal(reply.data.audio.frames, Math.round((revision.durationUs * 48000) / 1e6));
    const reference = join(dir, seconds + ".wav"),
      referencePlan = join(dir, seconds + "-plan.json");
    await writeFile(
      referencePlan,
      JSON.stringify({ tracks: audio.tracks, spans: revision.spans, output: reference }),
    );
    const pcm = JSON.parse(
      run(referenceNative, [], {
        env: {
          ...process.env,
          SCREENREC_AUDIO_EVIDENCE: dir,
          SCREENREC_AUDIO_REFERENCE_PLAN: referencePlan,
        },
      }),
    );
    assert.equal(pcm.frames, reply.data.audio.frames);
    assert.deepEqual(pcm.tracks, reply.data.audio.tracks);
    const expectedUnavailable = {
      narration: [
        { startUs: 0, endUs: 125000 },
        ...(seconds === 300 ? [{ startUs: 142000000, endUs: 142250000 }] : []),
      ],
      system: [
        { startUs: 4000000, endUs: 5000000 },
        ...(seconds === 300
          ? [
              { startUs: 151000000, endUs: 153000000 },
              { startUs: 200000000, endUs: 201000000 },
            ]
          : []),
      ],
    };
    for (const track of reply.data.audio.tracks)
      assert.deepEqual(track.unavailable, expectedUnavailable[track.role]);
    run("ffmpeg", [
      "-v",
      "error",
      "-i",
      reference,
      "-f",
      "f32le",
      join(dir, seconds + "-reference.f32"),
    ]);
    run("ffmpeg", [
      "-v",
      "error",
      "-i",
      output,
      "-map",
      "0:a",
      "-f",
      "f32le",
      join(dir, seconds + "-ff.f32"),
    ]);
    const nativeDecoded = JSON.parse(
      run(join(dir, "inspect"), [output, join(dir, seconds + "-native.f32")]),
    );
    assert.ok(Math.abs(nativeDecoded.durationUs - revision.durationUs) < 0.001);
    assert.equal(nativeDecoded.tracks.find((t) => t.type === "soun").decodedFrames, pcm.frames);
    const ffDecodedFrames = (await stat(join(dir, seconds + "-ff.f32"))).size / 8;
    assert.ok(Number.isInteger(ffDecodedFrames));
    assert.ok(ffDecodedFrames >= pcm.frames && ffDecodedFrames < pcm.frames + 1024);
    assert.ok(
      Math.abs(
        nativeDecoded.tracks.find((t) => t.type === "soun").durationUs - revision.durationUs,
      ) <=
        1e6 / 48000 / 2 + 0.001,
    );
    const targets = [
      500000,
      1728333,
      sourceToEdited(revision, 4500000),
      revision.durationUs - 500000,
    ];
    if (seconds === 300)
      targets.push(
        sourceToEdited(revision, 142125000),
        sourceToEdited(revision, 152000000),
        plan[2].playback.startUs,
        sourceToEdited(revision, 200500000),
      );
    const windows = [];
    for (const target of targets) {
      const center = Math.round((target * 48000) / 1e6),
        start = Math.max(16, center - 2048),
        count = Math.min(4096, pcm.frames - start - 16);
      const expected = await floats(join(dir, seconds + "-reference.f32"), start, count, 2),
        decoded = await floats(join(dir, seconds + "-ff.f32"), start - 16, count + 32, 2),
        av = await floats(join(dir, seconds + "-native.f32"), start, count, 2);
      const errors = [];
      for (let lag = -8; lag <= 8; lag++) {
        let sum = 0;
        for (let i = 0; i < expected.length; i++)
          sum += (decoded[i + (16 + lag) * 2] - expected[i]) ** 2;
        errors.push({ lag, rms: Math.sqrt(sum / expected.length) });
      }
      const best = errors.reduce((a, b) => (a.rms <= b.rms ? a : b)),
        zero = errors.find((e) => e.lag === 0);
      assert.ok(zero.rms < 0.01, JSON.stringify({ target, zero }));
      assert.ok(Math.abs(best.lag) <= 1, JSON.stringify({ target, best }));
      let avError = 0;
      for (let i = 0; i < expected.length; i++) avError += (av[i] - expected[i]) ** 2;
      avError = Math.sqrt(avError / expected.length);
      assert.ok(avError < 0.01);
      windows.push({
        playbackUs: target,
        sourceUs: editedToSource(revision, target).sourceUs,
        bestLagFrames: best.lag,
        ffRms: zero.rms,
        nativeRms: avError,
      });
    }
    // Independently check source-time phase away from ramps, using the generated signals.
    const independent = [];
    for (const sourceUs of [
      750000,
      4500000,
      seconds * 1000000 - 750000,
      ...(seconds === 300 ? [142125000, 152000000, 200500000] : []),
    ]) {
      const at = sourceToEdited(revision, sourceUs),
        start = Math.round((at * 48000) / 1e6),
        samples = await floats(join(dir, seconds + "-ff.f32"), start, 4096, 2);
      let sum = 0;
      for (let i = 0; i < 4096; i++) {
        const t = sourceUs / 1e6 + i / 48000,
          n = t >= 142 && t < 142.25 ? 0 : 0.1 * Math.sin(2 * Math.PI * (997 * t + 0.85 * t * t));
        for (let c = 0; c < 2; c++) {
          const f = c === 0 ? 1511 : 2111,
            k = c === 0 ? 0.55 : 0.35,
            missing = (t >= 4 && t < 5) || (t >= 151 && t < 153) || (t >= 200 && t < 201),
            expected = n + (missing ? 0 : 0.1 * Math.sin(2 * Math.PI * (f * t + k * t * t)));
          sum += (samples[i * 2 + c] - expected) ** 2;
        }
      }
      const rms = Math.sqrt(sum / samples.length);
      assert.ok(rms < 0.01, JSON.stringify({ sourceUs, rms }));
      independent.push({ sourceUs, rms });
    }
    const frameInfo = JSON.parse(
      run("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v",
        "-show_entries",
        "frame=pts_time",
        "-of",
        "json",
        output,
      ]),
    ).frames;
    const expectedVideoPTS = plan.flatMap((span) => [
      span.playback.startUs,
      ...Array.from({ length: 300 }, (_, frame) => frame * 1000000)
        .filter((at) => at !== 152000000 && at > span.source.startUs && at < span.source.endUs)
        .map((at) => sourceToEdited(revision, at)),
    ]);
    assert.equal(frameInfo.length, expectedVideoPTS.length);
    const maximumVideoTimingErrorUs = Math.max(
      ...frameInfo.map((frame, index) =>
        Math.abs(Math.round(Number(frame.pts_time) * 1e6) - expectedVideoPTS[index]),
      ),
    );
    assert.equal(maximumVideoTimingErrorUs, 0);
    const visual = [];
    for (let index = 0; index < targets.length; index++) {
      const at = targets[index],
        sourceUs = editedToSource(revision, at).sourceUs,
        frameIndex = frameInfo.findLastIndex((f) => Number(f.pts_time) * 1e6 <= at + 0.001),
        file = join(dir, `${seconds}-frame-${index}.rgb`);
      run("ffmpeg", [
        "-v",
        "error",
        "-i",
        output,
        "-map",
        "0:v",
        "-vf",
        `select=eq(n\\,${frameIndex})`,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        file,
      ]);
      const pixels = await readFile(file);
      assert.equal(pixels.length, 320 * 180 * 3);
      const empty =
        (sourceUs >= 4000000 && sourceUs < 5000000) ||
        (sourceUs >= 151000000 && sourceUs < 153000000);
      if (empty) assert.ok(pixels.every((value) => value <= 2));
      else {
        let number = 0;
        for (let bit = 0; bit < 9; bit++) {
          const offset = (160 * 320 + 20 + bit * 30) * 3,
            value = pixels[offset];
          assert.ok(value < 30 || value > 220);
          if (value > 128) number |= 1 << bit;
        }
        assert.equal(number, Math.floor(sourceUs / 1e6));
      }
      visual.push({
        playbackUs: at,
        sourceUs,
        frameIndex,
        decodedSourceFrame: empty ? "black" : Math.floor(sourceUs / 1e6),
      });
    }
    results.push({
      seconds,
      plan,
      receipt: { ...reply.data, file: seconds + ".mp4" },
      maxRSS,
      wallMs,
      nativeDecoded,
      ffDecodedFrames,
      windows,
      independent,
      visual,
      videoTiming: { frames: frameInfo.length, maximumErrorUs: maximumVideoTimingErrorUs },
    });
    await writeFile(join(dir, "progress.json"), JSON.stringify(results, null, 2));
    console.log(
      JSON.stringify({ seconds, maxRSS, wallMs, frames: pcm.frames, windows: windows.length }),
    );
  }
  const [short, long] = results;
  assert.ok(
    long.maxRSS <= short.maxRSS * 1.5 + 16 * 1024 * 1024,
    JSON.stringify(results.map((r) => ({ seconds: r.seconds, maxRSS: r.maxRSS }))),
  );
  for (const name of sources) assert.equal(await hash(join(dir, name)), hashes[name]);
  const report = {
    sourceRevision: run("git", ["rev-parse", "HEAD"]).trim(),
    binarySHA256: await hash(native),
    tools: {
      ffmpeg: run("ffmpeg", ["-version"]).split("\n")[0],
      os: run("sw_vers", ["-productVersion"]).trim(),
    },
    sourceHashes: hashes,
    containerGaps,
    inputPriming: priming,
    results,
    memoryGate: "long <= short * 1.5 + 16 MiB",
    sourceBytesUnchanged: true,
  };
  await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ complete: true, evidence: dir }));
} finally {
  store.close();
}
