import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm, realpath, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { renderAudio } from "@screenrec/core/audio";
import { FileSourceEvidence, readSourceMetadata } from "@screenrec/core/evidence-pages";
import { mediaWorker } from "../../service/dist/worker.js";
import { archiveFixture } from "./fixtures/retained-archive.mjs";
import {
  until,
  startPublicService,
  publicCommand,
  connectPublicMcp,
  seedPublicRecording,
} from "./fixtures/public-service.mjs";
import { packageMediaFailures } from "./fixtures/package-media-failures.mjs";
import { registerRelocationTest, relocatedReader } from "./package-relocation.mjs";
const native = process.env.SCREENREC_NATIVE;
assert.ok(native, "SCREENREC_NATIVE must name the pinned native build");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function metadata(audio) {
  const { file: _file, cacheId: _cacheId, outputId: _outputId, ...rest } = audio;
  return rest;
}
export async function publicAudio(root, output, executable, producedArchive) {
  await relocatedReader(root, output, executable);
  const context = JSON.parse(await readFile(join(root, "context.json"), "utf8"));
  const parent = dirname(root),
    source = join(parent, "audio-package"),
    archive = producedArchive ?? join(parent, "audio.zip");
  await archiveFixture(root, source);
  if (!producedArchive) execFileSync("/usr/bin/zip", ["-q", "-r", archive, "."], { cwd: source });
  const inputHash = sha(await readFile(archive));
  const home = await mkdtemp("/tmp/scr-public-audio-");
  const take = await seedPublicRecording(home, context.snapshot);
  const sourceEvidence = readSourceMetadata(join(source, "evidence/source"), context.source);
  const evidence = new FileSourceEvidence(join(source, "evidence/source"), context.source);
  const worker = mediaWorker({ SCREENREC_NATIVE: executable });
  const requests = [
    { range: { startUs: 250_000, endUs: 2_750_000 }, track: "system" },
    { range: { startUs: 250_000, endUs: 2_750_000 }, track: "mix" },
    { range: { startUs: 0, endUs: 4_000_000 }, track: "system", revisionId: "r0" },
  ];
  const expected = [];
  for (const [i, request] of requests.entries()) {
    const revision = context.history.find(
      (value) => value.id === (request.revisionId ?? context.snapshot.revisionId),
    );
    const audio = await renderAudio(
      { policy: "audio-excerpt-v1", ...request, sourceEvidence },
      {
        ...context.snapshot,
        revision,
        output: {
          file: join(output, `audio-${i}.wav`),
          publish: async (value) => value,
          discard: async () => {},
        },
      },
      {
        evidence,
        resolveSource: (role) => join(source, "source", `${role}.mov`),
        decode: async (params, signal) => {
          const result = await worker("media.audio", params, { signal });
          assert.equal(result.ok, true, JSON.stringify(result));
          return result.data;
        },
      },
      new AbortController().signal,
    );
    expected.push({ audio, bytes: await readFile(audio.file) });
  }
  assert.ok(expected[0].audio.spans.length > 1, "Edited excerpt must cross a cut");
  assert.ok(
    expected[0].audio.tracks[0].unavailable.length > 0,
    "Acquisition gaps must remain explicit",
  );
  assert.deepEqual(expected[1].audio.missingRoles, [
    { role: "narration", reason: "not_requested" },
  ]);
  assert.equal(
    expected[1].audio.tracks[0].gain,
    1,
    "Mix with one acquired track retains unity gain",
  );
  assert.deepEqual(expected[0].bytes, expected[1].bytes);
  let service, client;
  const receipt = { archiveSha256: inputHash };
  try {
    service = await startPublicService(home, executable);
    const ok = async (operation, params = {}) => {
      const result = await service.call(operation, params);
      assert.equal(result.ok, true, JSON.stringify(result));
      return result.data;
    };
    const open = async () => {
      const admitted = await ok("package.open", { path: await realpath(archive) });
      return until(async () => {
        const state = await ok("package.status", { admissionId: admitted.id });
        assert.ok(!["failed", "cleanup_failed"].includes(state.state), JSON.stringify(state));
        return state.state === "ready" && state;
      }, "Package audio admission did not finish");
    };
    const first = await open(),
      second = await open(),
      target = { packageHandle: first.packageHandle };
    const audio = (params) =>
      until(async () => {
        const value = await ok("audio.get", params);
        assert.ok(!["failed", "unavailable"].includes(value.state), JSON.stringify(value));
        return value.state === "ready" && value;
      }, "Package audio did not finish");
    const bytes = async (delivery, close = true) => {
      const parts = [];
      let offset = 0;
      try {
        for (;;) {
          const chunk = await ok("artifact.read", {
            token: delivery.token,
            offset,
            maxBytes: 524288,
          });
          parts.push(Buffer.from(chunk.data, "base64"));
          if (chunk.eof) break;
          assert.ok(chunk.nextOffset > offset);
          offset = chunk.nextOffset;
        }
        return Buffer.concat(parts);
      } finally {
        if (close) await ok("artifact.close", { token: delivery.token });
      }
    };
    const unavailable = await service.call("audio.get", {
      ...target,
      range: { startUs: 0, endUs: 100_000 },
      track: "narration",
    });
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.error.code, "UNAVAILABLE");
    assert.deepEqual(unavailable.error.details.missingRoles, [
      { role: "narration", reason: "not_requested" },
    ]);
    const ready = [];
    let held;
    for (const [i, request] of requests.entries()) {
      const value = await audio({ ...target, ...request });
      assert.equal(value.revisionId, request.revisionId ?? context.snapshot.revisionId);
      assert.deepEqual(metadata(value.published.audio), metadata(expected[i].audio));
      assert.deepEqual(await bytes(value.delivery, i !== 0), expected[i].bytes);
      if (i === 0) held = value.delivery;
      ready.push(value);
    }
    const again = await audio({ ...target, ...requests[0] });
    assert.equal(again.jobId, ready[0].jobId);
    assert.equal(again.published.audio.outputId, ready[0].published.audio.outputId);
    await bytes(again.delivery);
    const cliFile = join(parent, "public-audio.wav");
    publicCommand(service.socket, "audio.get", { ...target, ...requests[0] }, [
      "--output",
      cliFile,
    ]);
    assert.deepEqual(await readFile(cliFile), expected[0].bytes);
    client = await connectPublicMcp(service.socket, "public-package-audio-proof");
    const tool = await client.callTool({
      name: "audio.get",
      arguments: { ...target, ...requests[1] },
    });
    const content = tool.content.find((value) => value.type === "audio");
    assert.ok(content, JSON.stringify(tool));
    assert.deepEqual(Buffer.from(content.data, "base64"), expected[1].bytes);
    const outputs = new Set();
    for (let i = 0; i < 40; i++) {
      held = await ok("artifact.renew", { token: held.token });
      // Both media kinds share one bounded receipt/output working set.
      const value =
        i % 2 === 0
          ? await audio({
              ...target,
              range: { startUs: i * 1000, endUs: 100_000 + i * 1000 },
              track: "system",
            })
          : await until(async () => {
              const status = await ok("frame.get", {
                ...target,
                atUs: 50_000 + i * 1000,
                clean: true,
                maxLongEdge: 96,
              });
              assert.notEqual(status.state, "failed", JSON.stringify(status));
              return status.state === "ready" && status;
            }, "Interleaved frame did not finish");
      outputs.add((value.published.audio ?? value.published.frame).outputId);
      await bytes(value.delivery);
    }
    assert.equal(outputs.size, 40);
    assert.deepEqual(await bytes(held, false), expected[0].bytes);
    const regenerated = await audio({ ...target, ...requests[1] });
    assert.notEqual(regenerated.jobId, ready[1].jobId);
    assert.notEqual(regenerated.published.audio.outputId, ready[1].published.audio.outputId);
    assert.deepEqual(await bytes(regenerated.delivery), expected[1].bytes);
    const sibling = await audio({ packageHandle: second.packageHandle, ...requests[0] });
    await ok("recording.delete", { recordingId: take.recordingId });
    assert.deepEqual(await bytes(held, false), expected[0].bytes);
    assert.deepEqual(await bytes(sibling.delivery, false), expected[0].bytes);
    held = await ok("artifact.renew", { token: held.token });
    await ok("package.close", { admissionId: first.id });
    assert.ok(Date.now() < held.expiresAt);
    assert.equal(
      (await service.call("artifact.read", { token: held.token, offset: 0 })).error.code,
      "ARTIFACT_EXPIRED",
    );
    assert.equal(
      (await service.call("audio.get", { ...target, ...requests[0] })).error.code,
      "CONTEXT_CLOSED",
    );
    assert.deepEqual(await bytes(sibling.delivery, false), expected[0].bytes);
    await client.close();
    client = undefined;
    await service.close();
    service = undefined;
    assert.deepEqual(await readdir(join(home, "run/packages")), []);
    service = await startPublicService(home, executable);
    assert.equal(
      (await service.call("audio.get", { packageHandle: second.packageHandle, ...requests[0] }))
        .error.code,
      "CONTEXT_CLOSED",
    );
    assert.equal(
      (await service.call("artifact.read", { token: sibling.delivery.token, offset: 0 })).error
        .code,
      "ARTIFACT_EXPIRED",
    );
    Object.assign(receipt, {
      cliAndMcpAudioParity: true,
      systemMixGapCutHistoryParity: true,
      missingNarration: true,
      interleavedUniqueOutputs: outputs.size,
      heldReadSurvivesPressure: true,
      regeneration: true,
      libraryDeletionIsolation: true,
      closeAndRestartRevoke: true,
    });
  } finally {
    try {
      await client?.close();
    } finally {
      try {
        await service?.close();
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    }
  }
  Object.assign(receipt, await packageMediaFailures(await realpath(archive), executable, "audio"));
  assert.equal(sha(await readFile(archive)), inputHash);
  if (process.env.SCREENREC_PUBLIC_AUDIO_EVIDENCE)
    await writeFile(
      process.env.SCREENREC_PUBLIC_AUDIO_EVIDENCE,
      JSON.stringify(receipt, null, 2) + "\n",
    );
  return { publicAudio: true, ownedServiceGroupsReaped: true };
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  registerRelocationTest({
    reader: publicAudio,
    narration: false,
    executable: native,
    evidenceScope:
      "Actual public package audio CLI/MCP sample parity and lifetime, not audition or ASR readiness",
  });
