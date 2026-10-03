import assert from "node:assert/strict";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { JourneyService, hash, poll, run } from "./source-evidence-fixture.mjs";
import { waveHeader } from "./audio-project-fixture.mjs";
import { operationSchema } from "@screenrec/protocol";

// Reproduce a fixed reference edit through public composition owners. This is not
// an automatic filler classifier, new alignment, or a speech-engine quality gate.
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    home: { type: "string" },
    acquisition: { type: "string" },
    reference: { type: "string" },
    "verify-saved": { type: "boolean" },
    "verify-public": { type: "boolean" },
  },
});
assert(values.out);
assert(!(values["verify-saved"] && values["verify-public"]));
assert(values["verify-saved"] || (values.home && process.env.SCREENREC_NATIVE));
const verifying = values["verify-saved"] || values["verify-public"];
assert(verifying || values.acquisition);
await mkdir(resolve(values.out), { recursive: true });
const out = await realpath(resolve(values.out)),
  home = values.home && (await realpath(values.home));
const reference = values.reference
  ? await realpath(values.reference)
  : fileURLToPath(
      new URL("../../../specs/done/agent-editing/assets/12d-complete-sentence/", import.meta.url),
    );
const manifestBytes = await readFile(
  join(reference, values.reference ? "report.json" : "manifest.json"),
);
const manifest = JSON.parse(manifestBytes);
const spans = manifest.mapping.map((v) => v.source);
assert.equal(spans.length, 2, "This fixed journey covers two retained spans");
const contextDurationUs = manifest.context.endUs - manifest.context.startUs,
  spanFrames = manifest.mapping.map((v) => v.outputFrames[1] - v.outputFrames[0]),
  durationUs = spans.reduce((sum, v) => sum + v.endUs - v.startUs, 0),
  candidateFrames = spanFrames.reduce((sum, frames) => sum + frames, 0),
  rampFrames = values.reference ? manifest.rampFrames : manifest.nativeJoinRampFramesPerSide;
const referenceIdentity = { directory: reference, sha256: hash(manifestBytes) };
const report = verifying
  ? JSON.parse(await readFile(join(out, "report.json")))
  : {
      passed: false,
      trace: [],
      calls: [],
      receipts: {},
      checks: {},
      exchanges: [],
      reference: referenceIdentity,
      listening: values.reference
        ? "pending; frozen acceptance does not transfer"
        : "frozen accepted candidate",
      home,
      acquisitionId: values.acquisition,
    };
if (values.reference && verifying) assert.equal(report.reference.sha256, referenceIdentity.sha256);
const service = new JourneyService(home, report, join(out, "native"));
async function call(operation, params, options) {
  const entry = { operation, params };
  report.calls.push(entry);
  operationSchema.parse({ operation, params });
  const result = await service.call(operation, params, options);
  entry.result = result;
  return result;
}
const ref = (label) => ({ label });
const key = (numerator, denominator, value) => {
  let a = numerator,
    b = denominator;
  while (b) [a, b] = [b, a % b];
  return {
    at: { numerator: numerator / a, denominator: denominator / a },
    value,
    interpolation: "linear",
  };
};
const heldFrame = (frame, value) => ({
  at: Math.floor((frame * 1000000) / 48000),
  value,
  interpolation: "hold",
});
async function delivered(operation, selection, name) {
  await poll(
    () => call(operation, selection),
    (v) => v.state === "ready",
    name,
  );
  const file = join(out, name);
  report.receipts[name] = await call(operation, selection, { output: file });
  return file;
}
async function pcm(selection, name) {
  const file = await delivered("audio.get", selection, name + ".wav");
  const bytes = await readFile(file),
    header = waveHeader(bytes, bytes.length);
  await mcpAudio(selection, bytes);
  return bytes.subarray(header.offset);
}
async function mcpAudio(selection, bytes) {
  const result = await service.mcp.callTool({ name: "audio.get", arguments: selection });
  assert.equal(result.structuredContent.ok, true);
  const audio = result.content.find((v) => v.type === "audio");
  assert(audio);
  const delivered = Buffer.from(audio.data, "base64");
  assert(delivered.equals(bytes), "MCP and CLI must deliver the same complete WAV");
  report.calls.push({
    operation: "audio.get",
    transport: "mcp",
    params: selection,
    result: result.structuredContent,
    wavSha256: hash(delivered),
    bytes: delivered.length,
  });
}
async function expected(name) {
  const artifact = manifest.artifacts.find((v) => v.file === name),
    bytes = await readFile(join(reference, name)),
    frames = artifact.frames;
  assert.equal(hash(bytes), artifact.sha256);
  if (name === "original.wav")
    assert.equal(
      artifact.sha256,
      "38ad96206360f48ece6ded712f0a1d72b18efb9eae3dfd5e01b49721e67c8dfb",
    );
  else if (!values.reference)
    assert.equal(
      artifact.sha256,
      "a16a92434c5e8bccbe6b527e3e938b9186d5055867d0fa2682317d3425b2b9fd",
    );
  // Frozen receipt pins this legacy mono float WAV's 4096-byte header.
  assert.equal(bytes.length, 4096 + frames * 4);
  const mono = bytes.subarray(4096),
    stereo = Buffer.alloc(frames * 8);
  for (let i = 0; i < frames; i++) {
    mono.copy(stereo, i * 8, i * 4, i * 4 + 4);
    mono.copy(stereo, i * 8 + 4, i * 4, i * 4 + 4);
  }
  return stereo;
}
function compare(actual, wanted) {
  assert.equal(actual.length, wanted.length);
  let changed = 0,
    maximum = 0,
    first = null,
    last = null;
  for (let i = 0; i < actual.length / 4; i++) {
    const difference = Math.abs(actual.readFloatLE(i * 4) - wanted.readFloatLE(i * 4));
    assert(Number.isFinite(difference));
    if (actual.readUInt32LE(i * 4) !== wanted.readUInt32LE(i * 4)) {
      changed++;
      first ??= Math.floor(i / 2);
      last = Math.floor(i / 2);
      maximum = Math.max(maximum, difference);
    }
  }
  return {
    frames: actual.length / 8,
    changedSamples: changed,
    firstDifferentFrame: first,
    lastDifferentFrame: last,
    maximum,
    exact: actual.equals(wanted),
    sha256: hash(actual),
    expectedSha256: hash(wanted),
  };
}
async function verifySaved(original, candidateReference) {
  const checks = {};
  for (const [name, wanted] of [
    ["original", original],
    ["candidate", candidateReference],
    ["undo", original],
  ]) {
    const bytes = await readFile(join(out, name + ".wav"));
    checks[name] = compare(bytes.subarray(waveHeader(bytes, bytes.length).offset), wanted);
    assert(
      checks[name].exact,
      `${name}: PCM differs from reference: ${JSON.stringify(checks[name])}`,
    );
  }
  const placed = report.calls.find((v) => v.operation === "edit.apply").result.revision.document;
  assert.deepEqual(
    report.undo.document,
    placed,
    "Undo must restore the complete authored document",
  );
  const edited = report.inspection.revision.document;
  const tracks = new Map(edited.tracks.map((v) => [v.id, v.kind]));
  assert.equal(edited.clips.length, 4);
  for (const kind of ["video", "audio"]) {
    const clips = edited.clips
      .filter((v) => tracks.get(v.trackId) === kind)
      .sort((a, b) => a.placement.range.startUs - b.placement.range.startUs);
    const offset = kind === "audio" ? -manifest.source.trackOriginUsFromInheritedLabels : 0;
    assert.deepEqual(
      clips.map((v) => v.placement.range),
      manifest.mapping.map((v) => ({
        startUs: (v.outputFrames[0] * 1000000) / 48000,
        endUs: (v.outputFrames[1] * 1000000) / 48000,
      })),
    );
    assert.deepEqual(
      clips.map((v) => v.source.range),
      spans.map((v) => ({ startUs: v.startUs + offset, endUs: v.endUs + offset })),
    );
  }
  assert.equal(report.export.snapshot.revisionId, report.edited.revisionId);
  assert.deepEqual(report.export.snapshot.range, { startUs: 0, endUs: durationUs });
  checks.movies = [];
  for (const name of ["preview.mp4", "candidate.mp4"]) {
    const path = join(out, name),
      bytes = await readFile(path);
    if (name === "candidate.mp4") {
      assert.equal(hash(bytes), report.export.receipt.sha256);
      assert.equal(bytes.length, report.export.receipt.bytes);
    }
    const metadata = JSON.parse(
      (
        await run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path], {
          timeout: 30000,
        })
      ).stdout,
    );
    const audio = metadata.streams.find((v) => v.codec_type === "audio"),
      video = metadata.streams.find((v) => v.codec_type === "video");
    assert.equal(audio.codec_name, "aac");
    assert.equal(audio.sample_rate, "48000");
    assert.equal(audio.channels, 2);
    assert.equal(audio.time_base, "1/48000");
    assert.equal(Number(audio.duration_ts), candidateFrames);
    assert.equal(video.width, 640);
    assert.equal(video.height, 404);
    assert.equal(video.time_base, "1/1000000");
    assert.equal(Number(video.duration_ts), durationUs);
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
          { timeout: 30000, maxBuffer: 1024 ** 2 },
        )
      ).stdout,
    ).frames;
    assert.equal(timing.length, Math.ceil((durationUs * 30) / 1000000));
    timing.forEach((v, i) => assert.equal(v.best_effort_timestamp, Math.floor((i * 1000000) / 30)));
    const decoded = (
      await run(
        "ffmpeg",
        ["-v", "error", "-nostdin", "-i", path, "-map", "0:a:0", "-f", "f32le", "-"],
        { encoding: "buffer", timeout: 30000, maxBuffer: candidateReference.length + 8192 },
      )
    ).stdout;
    const paddingFrames = decoded.length / 8 - candidateFrames;
    assert(paddingFrames >= 0 && paddingFrames < 1024);
    let error = 0,
      energy = 0,
      maximum = 0;
    for (let i = 0; i < candidateReference.length; i += 4) {
      const wanted = candidateReference.readFloatLE(i),
        delta = decoded.readFloatLE(i) - wanted;
      assert(Number.isFinite(delta));
      error += delta ** 2;
      energy += wanted ** 2;
      maximum = Math.max(maximum, Math.abs(delta));
    }
    const rms = Math.sqrt(error / (candidateReference.length / 4)),
      silenceRms = Math.sqrt(energy / (candidateReference.length / 4)),
      halfGainRms = silenceRms / 2;
    assert(
      rms < 0.002,
      "Existing recovered-AAC RMS policy; no shift, scaling, or fitted tolerance",
    );
    assert(
      silenceRms >= 0.002 && halfGainRms >= 0.002,
      "Oracle must reject silent and half-gain substitutions",
    );
    checks.movies.push({
      name,
      bytes: bytes.length,
      sha256: hash(bytes),
      frames: timing.length,
      presentationAudioFrames: candidateFrames,
      decodedPcmSha256: hash(decoded),
      paddingFrames,
      rms,
      maximum,
      silenceRms,
      halfGainRms,
      policy: "first-preview complete-support recovered-AAC RMS <0.002; no fitted shift",
    });
  }
  return checks;
}
try {
  const original = await expected("original.wav");
  const candidateReference = await expected(
    values.reference ? "candidate-remove-marked-fillers.wav" : "candidate-remove-uh.wav",
  );
  if (values["verify-public"]) {
    await service.start();
    for (const [name, selection] of [
      ["original", report.original],
      ["candidate", report.edited],
      ["undo", report.undone],
    ]) {
      await mcpAudio(selection, await readFile(join(out, name + ".wav")));
    }
    assert.deepEqual(
      await call("revision.get", report.edited, { transport: "mcp" }),
      report.inspection,
    );
    const status = await call(
      "export.status",
      { exportId: report.export.exportId },
      { transport: "mcp" },
    );
    assert.equal(status.state, "committed");
    assert.deepEqual(status.receipt, report.export.receipt);
  } else if (!values["verify-saved"]) {
    report.nativeSha256 = hash(await readFile(process.env.SCREENREC_NATIVE));
    assert.equal(report.nativeSha256, manifest.native.sha256);
    await service.start();
    const acquisition = await call("acquisition.get", { acquisitionId: values.acquisition });
    const picture = acquisition.bindings.find((v) => v.sourceRoles.includes("video"));
    const voice = acquisition.bindings.find((v) => v.sourceRoles.includes("narration"));
    assert.equal(voice.assetId, manifest.source.sha256);
    assert.equal(voice.sourceToAssetOffsetUs, -manifest.source.trackOriginUsFromInheritedLabels);
    const created = await call("project.create", {
      requestId: randomUUID(),
      title: values.reference
        ? "Human-marked complete-sentence filler candidate"
        : "Accepted complete-sentence filler removal",
      canvas: {
        width: 640,
        height: 404,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
    });
    const projectId = created.project.projectId;
    let revisionId = created.revision.id;
    async function edit(operations) {
      const result = await call("edit.apply", {
        projectId,
        expectedRevisionId: revisionId,
        requestId: randomUUID(),
        operations,
      });
      revisionId = result.revision.id;
      return result;
    }
    const operations = [];
    for (const [label, binding, kind] of [
      ["picture", picture, "video"],
      ["voice", voice, "audio"],
    ]) {
      operations.push(
        { operation: "track.add", label, track: { kind, order: 0 } },
        {
          operation: "place",
          label: label + "-clip",
          clip: {
            trackId: ref(label),
            assetId: binding.assetId,
            streamId: binding.streamId,
            acquisitionId: acquisition.id,
            source: {
              kind: "range",
              range: {
                startUs: manifest.context.startUs + binding.sourceToAssetOffsetUs,
                endUs: manifest.context.endUs + binding.sourceToAssetOffsetUs,
              },
            },
            placement: { kind: "project", range: { startUs: 0, endUs: contextDurationUs } },
          },
        },
      );
    }
    const placed = await edit(operations),
      labels = placed.edit.labels;
    const originalSelection = { projectId, revisionId };
    report.original = originalSelection;
    const baseline = await pcm(originalSelection, "original");
    report.checks.original = compare(baseline, original);
    assert(
      report.checks.original.exact,
      "Public unedited audio must equal frozen mono duplicated to stereo",
    );
    const clipIds = [labels["picture-clip"], labels["voice-clip"]],
      headUs = spans[0].startUs - manifest.context.startUs,
      leftClipIds = headUs ? [ref("left-0"), ref("left-1")] : clipIds;
    const edited = await edit([
      ...(headUs
        ? [
            {
              operation: "split",
              clipIds,
              atUs: headUs,
              scope: "selected",
              rightLabels: clipIds.map((clipId, i) => ({ clipId, label: "left-" + i })),
            },
          ]
        : []),
      {
        operation: "split",
        clipIds: leftClipIds,
        atUs: spans[0].endUs - manifest.context.startUs,
        scope: "selected",
        rightLabels: leftClipIds.map((clipId, i) => ({ clipId, label: "middle-" + i })),
      },
      {
        operation: "split",
        clipIds: [ref("middle-0"), ref("middle-1")],
        atUs: spans[1].startUs - manifest.context.startUs,
        scope: "selected",
        rightLabels: [0, 1].map((i) => ({ clipId: ref("middle-" + i), label: "right-" + i })),
      },
      {
        operation: "remove",
        clipIds: [...(headUs ? clipIds : []), ref("middle-0"), ref("middle-1")],
        scope: "selected",
        ripple: { trackIds: [labels.picture, labels.voice] },
      },
      // Track processing preserves ramp signed zero after sibling clips combine.
      // Held keys fit its integer-us clock without rounding the sample gain values.
      ...(values.reference
        ? [
            {
              operation: "processing.set",
              target: { kind: "track", id: labels.voice },
              steps: [
                {
                  processor: {
                    type: "gain",
                    gain: {
                      keys: [
                        heldFrame(0, 1),
                        ...Array.from({ length: rampFrames }, (_, i) =>
                          heldFrame(
                            spanFrames[0] - rampFrames + i,
                            (rampFrames - 1 - i) / rampFrames,
                          ),
                        ),
                        ...Array.from({ length: rampFrames + 1 }, (_, i) =>
                          heldFrame(spanFrames[0] + i, i / rampFrames),
                        ),
                      ],
                    },
                  },
                },
              ],
            },
          ]
        : [
            {
              operation: "processing.set",
              target: { kind: "clip", id: leftClipIds[1] },
              steps: [
                {
                  processor: {
                    type: "gain",
                    gain: {
                      keys: [
                        key(spanFrames[0] - rampFrames - 1, spanFrames[0], 1),
                        key(spanFrames[0] - 1, spanFrames[0], 0),
                      ],
                    },
                  },
                },
              ],
            },
            {
              operation: "processing.set",
              target: { kind: "clip", id: ref("right-1") },
              steps: [
                {
                  processor: {
                    type: "gain",
                    gain: { keys: [key(0, 1, 0), key(rampFrames, spanFrames[1], 1)] },
                  },
                },
              ],
            },
          ]),
    ]);
    report.edited = { projectId, revisionId };
    report.edit = edited;
    report.inspection = await call("revision.get", report.edited);
    const candidate = await pcm(report.edited, "candidate");
    report.checks.candidate = compare(candidate, candidateReference);
    // No tolerance can inherit the user's verdict. Preserve a red exact comparison.
    assert(report.checks.candidate.exact, "Public joined PCM differs from reference candidate");
    report.checks.negativeControls = {
      silenceRejected: !candidate.equals(Buffer.alloc(candidate.length)),
      unchangedRejected: !candidate.equals(original),
      missingGainRejected: false,
    };
    const hardCut = Buffer.concat(
      spans.map((v) =>
        original.subarray(
          (((v.startUs - manifest.context.startUs) * 48000) / 1000000) * 8,
          (((v.endUs - manifest.context.startUs) * 48000) / 1000000) * 8,
        ),
      ),
    );
    report.checks.negativeControls.missingGainRejected = !candidate.equals(hardCut);
    assert(Object.values(report.checks.negativeControls).every(Boolean));
    await delivered("preview.get", report.edited, "preview.mp4");
    const exportId = randomUUID();
    await call("export.create", {
      ...report.edited,
      exportId,
      kind: "video",
      directory: out,
      leaf: "candidate.mp4",
    });
    report.export = await poll(
      () => call("export.status", { exportId }),
      (v) => v.state === "committed",
      "candidate export",
    );
    const undone = await call("edit.undo", {
      projectId,
      expectedRevisionId: revisionId,
      requestId: randomUUID(),
    });
    report.undone = { projectId, revisionId: undone.id };
    report.undo = undone;
    const restored = await pcm(report.undone, "undo");
    report.checks.undo = compare(restored, original);
    assert(report.checks.undo.exact);
  }
  report.savedChecks = await verifySaved(original, candidateReference);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  try {
    await service.stop();
    report.shutdown = "fulfilled";
  } catch (error) {
    report.shutdown = error.message;
    report.passed = false;
    process.exitCode = 1;
  }
  const suffix = values["verify-saved"]
    ? "saved-verification"
    : values["verify-public"]
      ? "public-verification"
      : "report";
  if (!values["verify-saved"]) await writeFile(join(out, suffix + ".log"), service.logs.join(""));
  await writeFile(join(out, suffix + ".json"), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({ passed: report.passed, error: report.error, checks: report.checks, out }),
  );
}
