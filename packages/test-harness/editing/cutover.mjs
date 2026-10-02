import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { parseArgs } from "node:util";
import { JourneyService, hash, poll, root, run } from "./source-evidence-fixture.mjs";
import { cliReply } from "./first-preview-transport.mjs";
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    "legacy-home": { type: "string" },
    inspect: { type: "boolean" },
    "legacy-app": { type: "string" },
    resume: { type: "string" },
    full: { type: "boolean" },
    "verify-only": { type: "boolean" },
  },
});
assert(values.out && values["legacy-home"] && values["legacy-app"] && process.env.SCREENREC_NATIVE);
const legacyApp = resolve(values["legacy-app"]),
  legacyCLI = join(legacyApp, "Contents/Resources/cli/main.mjs"),
  legacyEntry = join(legacyApp, "Contents/Resources/service/main.mjs"),
  legacyNative = join(legacyApp, "Contents/MacOS/screenrec-native");
await mkdir(resolve(values.out), { mode: 0o700 });
const out = await realpath(values.out),
  donor = await realpath(values["legacy-home"]);
const prior = values.resume
  ? JSON.parse(await readFile(join(await realpath(values.resume), "report.json"), "utf8"))
  : null;
const homes = prior
  ? (prior.homes ?? {
      old: join(await realpath(values.resume), "old"),
      new: join(await realpath(values.resume), "new"),
    })
  : { old: join(out, "old"), new: join(out, "new") };
const oldHome = homes.old,
  newHome = homes.new;
if (!prior) {
  await mkdir(oldHome, { mode: 0o700 });
  await mkdir(newHome, { mode: 0o700 });
}
await writeFile(
  join(out, "legacy-readonly.sb"),
  `(version 1)\n(allow default)\n(deny file-write* (subpath ${JSON.stringify(donor)}) (subpath ${JSON.stringify(legacyApp)}))\n`,
);
const legacyRuntime = JSON.parse(
  await readFile(join(legacyApp, "Contents/Resources/service/runtime.json"), "utf8"),
);
assert.equal(
  await realpath(legacyRuntime.nodePath),
  await realpath(process.execPath),
  "Run with the installed service Node runtime",
);
const fixture = join(root, "fixtures/narrated-workbench");
const described = JSON.parse(await readFile(join(fixture, "recording.json"), "utf8"));
const recordingId = described.recordingId;
const report = {
  passed: false,
  scope:
    "One retained real recording through old/new public consumers; no cutover, physical or listening acceptance",
  trace: [],
  attempts: [],
  checks: {},
  source: {},
  isolation: {},
  receipts: {},
};
report.nodeRuntime = {
  path: process.execPath,
  version: process.version,
  sha256: hash(await readFile(process.execPath)),
  installedConfiguration: legacyRuntime,
};
report.homes = homes;
report.mediaDirectory = out;
report.prerequisite = values.resume ?? null;
let old;
const modern = new JourneyService(newHome, report);
async function oldCall(operation, params, options = {}) {
  const result = await cliReply([
    legacyCLI,
    operation,
    "--socket",
    old.socketPath,
    "--params",
    JSON.stringify(params),
    ...(options.output ? ["--output", options.output] : []),
  ]);
  report.attempts.push({ side: "recording", operation, params, result });
  assert.equal(result.ok, !options.error, JSON.stringify(result));
  return result.ok ? result.data : result.error;
}
async function call(operation, params, options = {}) {
  const result = await modern.call(operation, params, options);
  report.attempts.push({ side: "project", operation, params, result });
  return result;
}
async function startOld() {
  const child = spawn(
    "/usr/bin/sandbox-exec",
    ["-f", join(out, "legacy-readonly.sb"), process.execPath, legacyEntry],
    {
      cwd: "/",
      env: { ...process.env, SCREENREC_HOME: oldHome, SCREENREC_NATIVE: legacyNative },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (b) => (stdout += b));
  child.stderr.on("data", (b) => (stderr += b));
  const exit = once(child, "exit");
  old = { child, exit, socketPath: null, logs: () => ({ stdout, stderr }) };
  const started = await poll(
    () => {
      assert.equal(child.exitCode, null, stdout + "\n" + stderr);
      return (
        stdout
          .split("\n")
          .filter(Boolean)
          .map((s) => JSON.parse(s))
          .find((x) => x.event === "started") ?? {}
      );
    },
    (x) => !!x.socketPath,
    "legacy startup",
  );
  old.socketPath = started.socketPath;
  return old;
}
async function stopOld() {
  if (!old) return;
  if (old.child.exitCode !== null || old.child.signalCode !== null) return;
  old.child.stdin.end();
  let timer;
  try {
    const result = await Promise.race([
      old.exit,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          old.child.kill("SIGKILL");
          reject(Error("legacy shutdown deadline"));
        }, 15000);
      }),
    ]);
    assert.equal(result[0], 0, old.logs().stderr);
  } finally {
    clearTimeout(timer);
    if (old.child.exitCode === null && old.child.signalCode === null) {
      old.child.kill("SIGKILL");
      await old.exit;
    }
  }
}

async function pixels(file) {
  return (
    await run(
      "ffmpeg",
      ["-v", "error", "-nostdin", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
      { encoding: "buffer", maxBuffer: 64 * 1024 ** 2, timeout: 30000 },
    )
  ).stdout;
}

async function preservation() {
  const durationUs = values.full ? described.sourceDurationUs : 12000000,
    range = { startUs: 0, endUs: durationUs };
  report.cohort = {
    range,
    scope: values.full
      ? "Full retained source support"
      : "Identity opening excerpt; original full-source transcript retained separately",
  };
  const restored = await oldCall("edit.restore", {
    recordingId,
    requestId: randomUUID(),
    expectedRevisionId: report.receipts.recording.currentRevisionId,
    targetRevisionId: "r0",
  });
  const trimmed = await oldCall("edit.trim", {
    recordingId,
    requestId: randomUUID(),
    expectedRevisionId: restored.revision.id,
    range,
  });
  const legacy = { recordingId, revisionId: trimmed.revision.id };
  await modern.start();
  const pending = await call("acquisition.import", {
    requestId: "actual-retained-recording",
    path: join(oldHome, "recordings", recordingId, "source"),
  });
  const adopted = await poll(
    () => call("job.get", { jobId: pending.jobId }),
    (v) => v.state === "ready",
    "source adoption",
  );
  const acquired = await call("acquisition.get", { acquisitionId: adopted.target.acquisitionId });
  report.acquisition = acquired;
  const picture = acquired.bindings.find((x) => x.sourceRoles.includes("video"));
  const voice = acquired.bindings.find((x) => x.sourceRoles.includes("narration"));
  assert(picture && voice);
  const created = await call("project.create", {
    requestId: values.full ? "identity-full" : "identity",
    title: "Recorded source preservation",
    canvas: {
      width: 3120,
      height: 1970,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const operations = [
    { operation: "track.add", label: "picture", track: { kind: "video", order: 0 } },
    { operation: "track.add", label: "voice", track: { kind: "audio", order: 0 } },
  ];
  for (const [label, binding] of [
    ["picture", picture],
    ["voice", voice],
  ]) {
    const asset = await call("asset.get", { assetId: binding.assetId });
    const startUs = Math.max(0, -binding.sourceToAssetOffsetUs),
      endUs = Math.min(
        durationUs,
        asset.streams.find((x) => x.id === binding.streamId).endUs - binding.sourceToAssetOffsetUs,
      );
    operations.push({
      operation: "place",
      label: label + "-clip",
      clip: {
        trackId: { label },
        assetId: binding.assetId,
        streamId: binding.streamId,
        acquisitionId: acquired.id,
        source: {
          kind: "range",
          range: {
            startUs: startUs + binding.sourceToAssetOffsetUs,
            endUs: endUs + binding.sourceToAssetOffsetUs,
          },
        },
        placement: { kind: "project", range: { startUs, endUs } },
      },
    });
  }
  const placed = await call("edit.apply", {
    projectId: created.project.projectId,
    expectedRevisionId: created.revision.id,
    requestId: values.full ? "identity-full-placement" : "identity-placement",
    operations,
  });
  const project = { projectId: created.project.projectId, revisionId: placed.revision.id };
  report.project = placed;
  async function delivered(invoke, operation, params, name) {
    await poll(
      () => invoke(operation, params),
      (v) => v.state === "ready",
      name,
    );
    const file = join(out, name);
    const receipt = await invoke(operation, params, { output: file });
    report.receipts[name] = receipt;
    return file;
  }
  report.frames = [];
  for (const atUs of values.full ? [1000000, 67000000, 134000000] : [1000000, 5000000, 10000000]) {
    const b = await delivered(
      call,
      "frame.get",
      { ...project, atUs, maxLongEdge: 3120 },
      `project-${atUs}.png`,
    );
    const current = report.receipts[`project-${atUs}.png`].published.frame;
    const actual = current.pictures[0].actualSourceUs;
    const a = await delivered(
      oldCall,
      "frame.get",
      { ...legacy, atUs: actual, clean: true, maxLongEdge: 3120 },
      `legacy-matched-${atUs}.png`,
    );
    const raw = await delivered(
      call,
      "frame.get",
      {
        assetId: picture.assetId,
        streamId: picture.streamId,
        acquisitionId: acquired.id,
        atUs: actual,
        maxLongEdge: 3120,
      },
      `source-${atUs}.png`,
    );
    const oldReceipt = report.receipts[`legacy-matched-${atUs}.png`].published.frame;
    assert.equal(oldReceipt.actualSourceUs, actual, "Matched source sample differs");
    const ap = await pixels(a),
      bp = await pixels(b),
      rp = await pixels(raw);
    assert.equal(ap.length, bp.length);
    assert.equal(rp.length, bp.length);
    const difference = (left, right) => {
      let different = 0,
        max = 0;
      for (let i = 0; i < left.length; i++) {
        const d = Math.abs(left[i] - right[i]);
        if (d) different++;
        max = Math.max(max, d);
      }
      return { differentBytes: different, maximumChannelDifference: max };
    };
    report.frames.push({
      atUs,
      actualSourceUs: actual,
      legacy: hash(ap),
      project: hash(bp),
      source: hash(rp),
      legacyVsProject: difference(ap, bp),
      legacyVsSource: difference(ap, rp),
      sourceVsProject: difference(rp, bp),
    });
  }
  const expectedFrames = Math.floor((durationUs * 48000) / 1000000);
  const decode = async (file, maximumBytes) =>
    (
      await run("ffmpeg", ["-v", "error", "-nostdin", "-i", file, "-f", "f32le", "-"], {
        encoding: "buffer",
        maxBuffer: maximumBytes + 1048576,
        timeout: 60000,
      })
    ).stdout;
  const monoParts = [];
  report.legacyAudioChunks = [];
  for (let startUs = 0; startUs < durationUs; startUs += 30000000) {
    const selected = { startUs, endUs: Math.min(durationUs, startUs + 30000000) };
    const wav = await delivered(
      oldCall,
      "audio.get",
      { ...legacy, range: selected, track: "narration" },
      `legacy-${startUs}.wav`,
    );
    const frames = Math.round(((selected.endUs - selected.startUs) * 48000) / 1000000);
    const pcm = await decode(wav, frames * 4);
    assert.equal(pcm.length, frames * 4);
    monoParts.push(pcm);
    report.legacyAudioChunks.push({ range: selected, frames, sha256: hash(pcm) });
  }
  const wavB = await delivered(call, "audio.get", { ...project, range }, "project.wav");
  const legacyComplete = Buffer.concat(monoParts),
    b = await decode(wavB, expectedFrames * 8);
  const legacyFrames = legacyComplete.length / 4;
  assert.equal(legacyFrames, Math.round((durationUs * 48000) / 1000000));
  const extra = legacyComplete.subarray(expectedFrames * 4);
  assert(
    extra.every((x) => x === 0),
    "Legacy extra terminal frame is not acquired silence",
  );
  report.terminalPolicy = {
    legacy: "nearest cumulative microseconds",
    project: "floor absolute endpoints",
    legacyFrames,
    projectFrames: expectedFrames,
    extraLegacyBytes: extra.length,
    extraLegacyAllZero: true,
  };
  const mono = legacyComplete.subarray(0, expectedFrames * 4);
  const a = Buffer.alloc(mono.length * 2);
  for (let i = 0; i < mono.length; i += 4) {
    mono.copy(a, i * 2, i, i + 4);
    mono.copy(a, i * 2 + 4, i, i + 4);
  }
  assert.equal(a.length, expectedFrames * 8);
  assert.equal(b.length, expectedFrames * 8);
  let different = 0,
    first = null,
    last = null,
    max = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.abs(a.readFloatLE(i) - b.readFloatLE(i));
    if (d) {
      different++;
      first ??= i / 8;
      last = i / 8;
      max = Math.max(max, d);
    }
  }
  report.audio = {
    frames: expectedFrames,
    legacy: hash(a),
    project: hash(b),
    channelMapping: "explicit unity mono duplication",
    differentSamples: different,
    firstDifferentFrame: first,
    lastDifferentFrame: last,
    maximumSampleDifference: max,
  };
  await writeFile(join(out, "media-checkpoint.json"), JSON.stringify(report, null, 2));
  const modelId = "parakeet",
    modelSource = join(
      donor,
      "models/parakeet/ee09c569f73759e6d44c9bd16766f477b2b36d39/parakeet-tdt-0.6b-v2",
    );
  await call("model.prepare", { modelId, modelSource });
  await poll(
    () => call("model.status", { modelId }),
    (v) => v.state === "ready",
    "existing baseline model",
  );
  report.receipts.projectTranscript = await poll(
    () => call("transcript.get", { ...project, limit: 500 }),
    (v) => v.state === "ready",
    "project baseline transcript",
  );
  report.receipts.legacySelectedTranscript = await oldCall("transcript.get", {
    ...legacy,
    limit: 500,
  });
  report.exports = [];
  for (const [side, invoke, selection] of [
    ["legacy", oldCall, legacy],
    ["project", call, project],
  ]) {
    const exportId = randomUUID(),
      request = { ...selection, exportId, kind: "video", directory: out, leaf: side + ".mp4" };
    await invoke("export.create", request);
    const receipt = await poll(
      () => invoke("export.status", { exportId }),
      (v) => v.state === "committed",
      "video export",
    );
    report.exports.push({ side, receipt });
  }
  report.checks.delivered = true;
  await completeTranscript();
  await verifySaved();
  report.checks.matchedSourceSamples = true;
}

async function completeTranscript() {
  const pages = report.projectTranscriptPages ?? [report.receipts.projectTranscript];
  report.projectTranscriptPages = pages;
  const seen = new Set();
  while (pages.at(-1).page.nextCursor) {
    const cursor = pages.at(-1).page.nextCursor,
      key = JSON.stringify(cursor);
    assert(!seen.has(key), "Transcript pagination made no progress");
    seen.add(key);
    if (!modern.started) await modern.start();
    const next = await call("transcript.get", { projectId: cursor.projectId, cursor, limit: 500 });
    assert.equal(next.state, "ready");
    assert.deepEqual(
      next.dependencies,
      { manifestId: cursor.manifestId },
      "Continuation changed pinned dependencies",
    );
    pages.push(next);
  }
}

async function verifySaved() {
  const durationUs = report.cohort.range.endUs - report.cohort.range.startUs;
  const frames = Math.floor((durationUs * 48000) / 1000000);
  const directory = report.mediaDirectory ?? (await realpath(values.resume));
  const decode = async (path) =>
    (
      await run("ffmpeg", ["-v", "error", "-nostdin", "-i", path, "-f", "f32le", "-"], {
        encoding: "buffer",
        maxBuffer: (Math.ceil((described.sourceDurationUs * 48000) / 1000000) + 4096) * 8,
        timeout: 60000,
      })
    ).stdout;
  for (const [name, receipt] of Object.entries(report.source)) {
    const bytes = await readFile(join(fixture, name));
    assert.equal(bytes.length, receipt.bytes);
    assert.equal(hash(bytes), receipt.sha256);
  }
  const original = await decode(join(fixture, "narration.mov"));
  const actual = await decode(join(directory, "project.wav"));
  const voice = report.acquisition.bindings.find((x) => x.sourceRoles.includes("narration"));
  const offset = Math.floor((-voice.sourceToAssetOffsetUs * 48000) / 1000000);
  const expected = Buffer.alloc(frames * 8);
  for (let i = 0; i < Math.min(original.length / 4, frames - offset); i++) {
    original.copy(expected, (offset + i) * 8, i * 4, i * 4 + 4);
    original.copy(expected, (offset + i) * 8 + 4, i * 4, i * 4 + 4);
  }
  assert.equal(
    hash(actual),
    hash(expected),
    "Project PCM must equal original samples at declared offset",
  );
  const shifted = Buffer.concat([Buffer.alloc(8), expected.subarray(0, -8)]);
  assert.notEqual(hash(actual), hash(shifted), "One-sample mapping mutation must fail");
  report.sourceAudioOracle = {
    frames,
    sourceFrames: original.length / 4,
    offsetFrames: offset,
    sha256: hash(actual),
    completeExact: true,
    oneFrameMutationRejected: true,
  };
  for (const frame of report.frames) {
    const oldPixels = await pixels(join(directory, `legacy-matched-${frame.atUs}.png`));
    const sourcePixels = await pixels(join(directory, `source-${frame.atUs}.png`));
    const projectPixels = await pixels(join(directory, `project-${frame.atUs}.png`));
    assert.equal(hash(oldPixels), frame.legacy);
    assert.equal(hash(sourcePixels), frame.source);
    assert.equal(hash(projectPixels), frame.project);
    assert.equal(hash(oldPixels), hash(sourcePixels), "Complete matched source pixels differ");
    assert.equal(
      frame.legacyVsSource.differentBytes,
      0,
      "Direct source pixels must equal matched installed pixels",
    );
  }
  const legacyMetadata = report.receipts.transcript.page.transcript;
  const currentMetadata = report.receipts.projectTranscript.dependencies.find(
    (x) => x.selection.assetId === voice.assetId,
  ).transcript;
  const paths = [
    join(
      oldHome,
      "recordings",
      recordingId,
      "evidence/transcript",
      legacyMetadata.generation,
      "raw.jsonl",
    ),
    join(
      newHome,
      "library/transcripts/assets",
      voice.assetId,
      currentMetadata.generation,
      "raw.jsonl",
    ),
  ];
  const [before, after] = await Promise.all(
    paths.map(async (p) => (await readFile(p, "utf8")).trim().split("\n").map(JSON.parse)),
  );
  assert.equal(before.length, after.length);
  const rawWords = [];
  for (let i = 0; i < before.length; i++) {
    assert.deepEqual(
      before[i].result.tokenTimings,
      after[i].result.tokenTimings,
      "Raw ASR tokens/timings changed",
    );
    assert.equal(before[i].result.text, after[i].result.text);
    assert.equal(before[i].samples, after[i].samples);
    rawWords.push(...after[i].words);
  }
  const oldWords = report.receipts.legacySelectedTranscript.page.rows.filter(
    (x) => x.type === "word",
  );
  const currentWords = report.projectTranscriptPages
    .flatMap((x) => x.page.rows)
    .filter((x) => x.type === "word");
  assert.equal(report.receipts.legacySelectedTranscript.page.nextCursor, null);
  assert.equal(report.projectTranscriptPages.at(-1).page.nextCursor, null);
  assert.equal(oldWords.length, currentWords.length);
  const timingChanges = [];
  for (let i = 0; i < currentWords.length; i++) {
    const old = oldWords[i],
      now = currentWords[i],
      word = rawWords[now.ordinal];
    assert.deepEqual(
      [now.ordinal, now.text, now.kind, now.confidence],
      [old.ordinal, old.text, old.kind, old.confidence],
    );
    assert.deepEqual(now.sourceRange, word.source);
    assert.deepEqual(
      now.fragments.map((x) => x.project),
      [
        {
          startUs: Math.max(0, word.source.startUs - voice.sourceToAssetOffsetUs),
          endUs: Math.min(durationUs, word.source.endUs - voice.sourceToAssetOffsetUs),
        },
      ],
    );
    if (
      JSON.stringify(old.fragments.map((x) => x.playback)) !==
      JSON.stringify(now.fragments.map((x) => x.project))
    )
      timingChanges.push({
        ordinal: now.ordinal,
        text: now.text,
        legacy: old.fragments.map((x) => x.playback),
        current: now.fragments.map((x) => x.project),
      });
  }
  report.transcriptGaps = {
    legacy: report.receipts.legacySelectedTranscript.page.rows.filter((x) => x.type === "gap"),
    project: report.projectTranscriptPages
      .flatMap((x) => x.page.rows)
      .filter((x) => x.type === "gap"),
    scope:
      "Project evidence follows selected clip support; no source-gap rows are invented outside clips",
  };
  report.transcriptOracle = {
    oldGeneration: legacyMetadata.generation,
    newGeneration: currentMetadata.generation,
    rawTokenTimingsExact: true,
    wordCount: currentWords.length,
    currentSpokenProjectionExact: true,
    permittedPolicyCommits: ["247adb4f", "02191f76"],
    timingChanges,
  };
  report.exportMedia = [];
  report.exportAudio = [];
  for (const { side, receipt } of report.exports) {
    assert.equal(receipt.state, "committed");
    const path = receipt.output;
    const exported = await readFile(path);
    assert.equal(exported.length, receipt.receipt.bytes);
    assert.equal(hash(exported), receipt.receipt.sha256);
    if (side === "project") {
      assert.equal(receipt.snapshot.projectId, report.project.revision.projectId);
      assert.equal(receipt.snapshot.revisionId, report.project.revision.id);
      assert.deepEqual(receipt.snapshot.range, report.cohort.range);
    }

    const metadata = JSON.parse(
      (
        await run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path], {
          timeout: 30000,
        })
      ).stdout,
    );
    const video = metadata.streams.find((x) => x.codec_type === "video"),
      audio = metadata.streams.find((x) => x.codec_type === "audio");
    assert.equal(video.width, 3120);
    assert.equal(video.height, 1970);
    assert.equal(video.codec_name, "h264");
    assert.equal(audio.codec_name, "aac");
    assert.equal(Number(audio.sample_rate), 48000);
    assert.equal(audio.channels, side === "legacy" ? 1 : 2);
    assert.equal(
      Number(audio.duration_ts),
      side === "legacy" ? Math.round((durationUs * 48000) / 1000000) : frames,
    );
    assert.equal(video.time_base, "1/1000000");
    assert.equal(Number(video.start_time), 0);
    assert.equal(Number(video.duration_ts), durationUs);
    if (side === "project") {
      assert.equal(video.r_frame_rate, "30/1");
      const timing = JSON.parse(
        (
          await run(
            "ffprobe",
            [
              "-v",
              "error",
              "-select_streams",
              "v:0",
              "-show_frames",
              "-show_entries",
              "frame=best_effort_timestamp",
              "-of",
              "json",
              path,
            ],
            { maxBuffer: 4 * 1024 ** 2, timeout: 60000 },
          )
        ).stdout,
      ).frames;
      assert.equal(timing.length, Math.ceil((durationUs * 30) / 1000000));
      for (let i = 0; i < timing.length; i++)
        assert.equal(timing[i].best_effort_timestamp, Math.floor((i * 1000000) / 30));
      report.projectVideoClock = { frames: timing.length, completeFloorClockExact: true };
    }
    const encoded = await decode(path),
      channels = audio.channels,
      count = Number(audio.duration_ts),
      decodedFrames = encoded.length / (4 * channels);
    assert(
      decodedFrames >= count && decodedFrames - count < 1024,
      "AAC tail exceeds existing one-packet policy",
    );
    const windows = [];
    let total = 0,
      muted = 0,
      half = 0;
    for (let begin = 0; begin < count; begin += 48000 * 30) {
      const end = Math.min(count, begin + 48000 * 30);
      let squared = 0,
        maximum = 0;
      for (let frame = begin; frame < end; frame++)
        for (let channel = 0; channel < channels; channel++) {
          const wanted = frame < frames ? expected.readFloatLE(frame * 8) : 0,
            got = encoded.readFloatLE((frame * channels + channel) * 4),
            delta = got - wanted;
          squared += delta * delta;
          maximum = Math.max(maximum, Math.abs(delta));
          muted += wanted * wanted;
          half += (wanted * 0.5) ** 2;
        }
      total += squared;
      windows.push({ begin, end, rms: Math.sqrt(squared / ((end - begin) * channels)), maximum });
    }
    const rms = Math.sqrt(total / (count * channels)),
      silenceRms = Math.sqrt(muted / (count * channels)),
      halfGainRms = Math.sqrt(half / (count * channels));
    report.exportAudio ??= [];
    report.exportAudio.push({
      side,
      decodedFrames,
      presentationFrames: count,
      paddingFrames: decodedFrames - count,
      rms,
      windows,
      silenceRms,
      halfGainRms,
      policy:
        "Existing first-preview recovered audio RMS < 0.002; here measured across complete presentation support, without shifting",
    });
    assert(rms < 0.002, "Complete export AAC exceeds existing recovered-audio RMS policy");
    assert(
      silenceRms >= 0.002 && halfGainRms >= 0.002,
      "Export oracle cannot reject silence/half-gain mutation",
    );
    const images = [];
    for (const atUs of report.frames.map((x) => x.atUs)) {
      const image = join(out, `${side}-export-${atUs}.png`);
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-ss",
          String(atUs / 1000000),
          "-i",
          path,
          "-frames:v",
          "1",
          image,
        ],
        { timeout: 60000 },
      );
      images.push({ atUs, path: image, sha256: hash(await readFile(image)) });
    }
    report.exportMedia.push({
      side,
      file: path,
      sha256: hash(exported),
      metadata,
      images,
    });
  }
  report.checks = {
    ...report.checks,
    sourcePCMExact: true,
    sourcePixelsExact: true,
    rawTokensAndCurrentProjection: true,
    fullPublicExports: true,
  };
}

try {
  if (values["verify-only"]) {
    assert(prior);
    Object.assign(report, prior, {
      passed: false,
      prerequisite: values.resume,
      mediaDirectory: prior.mediaDirectory ?? (await realpath(values.resume)),
    });
    delete report.error;
    for (const [path, expected] of Object.entries(report.legacyIdentities))
      assert.equal(hash(await readFile(path)), expected);
    assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), report.nativeSha256);
    await completeTranscript();
    await verifySaved();
    report.passed = true;
  } else {
    if (!prior) {
      // Read-only online backup supplies actual committed catalog rows, including historical evidence.
      const original = new DatabaseSync(join(donor, "library.sqlite"), { readOnly: true });
      try {
        const actual = original
          .prepare(
            "SELECT recordingId,sourceId,state,sourceDurationUs FROM recordings WHERE recordingId=?",
          )
          .get(recordingId);
        assert.equal(actual.sourceId, described.sourceId);
        assert.equal(actual.state, described.state);
        assert.equal(actual.sourceDurationUs, described.sourceDurationUs);
        report.recording = actual;
        report.isolation.originalJobs = original
          .prepare("SELECT state,count(*) count FROM jobs GROUP BY state")
          .all();
        await backup(original, join(oldHome, "library.sqlite"));
      } finally {
        original.close();
      }
      const copied = new DatabaseSync(join(oldHome, "library.sqlite"));
      try {
        copied.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE");
        const tables = copied
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
          .all()
          .map((x) => x.name);
        const counts = [];
        for (const table of tables) {
          assert(/^[a-z_]+$/.test(table));
          const columns = copied
            .prepare(`PRAGMA table_info(${table})`)
            .all()
            .map((x) => x.name);
          assert(
            columns.includes("recordingId") || table === "visual_observation_samples",
            `Unclassified global table ${table}`,
          );
          const before = copied.prepare(`SELECT count(*) n FROM ${table}`).get().n;
          if (columns.includes("recordingId"))
            copied
              .prepare(`DELETE FROM ${table} WHERE recordingId<>? OR recordingId IS NULL`)
              .run(recordingId);
          counts.push({
            table,
            before,
            selected: copied.prepare(`SELECT count(*) n FROM ${table}`).get().n,
          });
        }
        copied.exec(
          "DELETE FROM visual_observation_samples WHERE cacheId NOT IN (SELECT id FROM derived_cache); DELETE FROM export_intents; DELETE FROM jobs WHERE artifact IN ('export-media','export-recovery'); DELETE FROM artifacts WHERE artifact IN ('export-media','export-recovery'); COMMIT; VACUUM",
        );
        assert.equal(
          copied
            .prepare("SELECT count(*) n FROM jobs WHERE state IN ('queued','running','waiting')")
            .get().n,
          0,
        );
        assert.equal(copied.prepare("SELECT count(*) n FROM recording_deletions").get().n, 0);
        assert.equal(copied.prepare("SELECT count(*) n FROM export_intents").get().n, 0);
        report.isolation.tables = counts;
        report.isolation.excluded =
          "Other recordings; orphan cache observations; all original export intents and export-media/export-recovery jobs/artifacts";
        report.isolation.historicalTranscript = copied
          .prepare("SELECT * FROM transcript_generations WHERE recordingId=?")
          .all(recordingId);
        await writeFile(
          join(out, "historical-words.json"),
          JSON.stringify(
            copied
              .prepare(
                "SELECT * FROM transcript_words WHERE recordingId=? ORDER BY generation,ordinal",
              )
              .all(recordingId),
            null,
            2,
          ),
        );
        report.identityRevision = JSON.parse(
          copied
            .prepare("SELECT content FROM revisions WHERE recordingId=? ORDER BY ordinal LIMIT 1")
            .get(recordingId).content,
        );
        report.isolation.foreignKeyErrors = copied.prepare("PRAGMA foreign_key_check").all();
        assert.deepEqual(report.isolation.foreignKeyErrors, []);
      } finally {
        copied.close();
      }
      const source = join(donor, "recordings", recordingId);
      await mkdir(join(oldHome, "recordings"), { recursive: true, mode: 0o700 });
      await run("/bin/cp", ["-cR", source, join(oldHome, "recordings", recordingId)], {
        timeout: 30000,
      });
      for (const name of ["video.mov", "narration.mov", "capture.journal.jsonl"]) {
        const bytes = await readFile(join(source, "source", name));
        assert.equal(hash(bytes), hash(await readFile(join(fixture, name))));
        assert.equal(
          hash(bytes),
          hash(await readFile(join(oldHome, "recordings", recordingId, "source", name))),
        );
        report.source[name] = { bytes: bytes.length, sha256: hash(bytes) };
      }
      report.legacyIdentities = Object.fromEntries(
        await Promise.all(
          [legacyCLI, legacyEntry, legacyNative].map(async (path) => [
            path,
            hash(await readFile(path)),
          ]),
        ),
      );
      report.nativeSha256 = hash(await readFile(process.env.SCREENREC_NATIVE));
    } else {
      for (const key of [
        "recording",
        "source",
        "isolation",
        "identityRevision",
        "legacyIdentities",
        "nativeSha256",
      ])
        report[key] = prior[key];
    }
    for (const [path, expected] of Object.entries(report.legacyIdentities))
      assert.equal(hash(await readFile(path)), expected, "Legacy executable changed");
    assert.equal(
      hash(await readFile(process.env.SCREENREC_NATIVE)),
      report.nativeSha256,
      "Current native changed",
    );
    old = await startOld();
    report.receipts.health = await oldCall("service.health", {});
    assert.equal(await realpath(report.receipts.health.home), oldHome);
    report.receipts.recording = await oldCall("recording.get", { recordingId });
    report.receipts.source = await oldCall("processing.status", {
      recordingId,
      artifact: "source",
    });
    report.receipts.transcript = await oldCall("transcript.get", {
      recordingId,
      revisionId: report.identityRevision.id,
      limit: 500,
    });
    if (values.inspect) {
      report.passed = true;
    } else {
      await preservation();
      report.passed = true;
    }
  }
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  const closed = await Promise.allSettled([modern.stop(), stopOld()]);
  report.shutdown = closed.map((x) =>
    x.status === "fulfilled" ? { status: x.status } : { status: x.status, error: String(x.reason) },
  );
  if (closed.some((x) => x.status === "rejected")) report.passed = false;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "legacy-service.json"), JSON.stringify(old?.logs() ?? {}));
  await writeFile(join(out, "project-service.log"), modern.logs.join(""));
}
assert(report.passed, "Preservation failed; inspect retained report");
console.log(JSON.stringify({ passed: report.passed, out }));
