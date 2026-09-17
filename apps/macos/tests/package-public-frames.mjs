import { packageMediaFailures } from "./fixtures/package-media-failures.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm, realpath, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { FileSourceEvidence } from "@screenrec/core/evidence-pages";
import { materializeFrame } from "@screenrec/core/frame-materialization";
import { mediaWorker } from "../../service/dist/worker.js";
import { archiveFixture } from "./fixtures/retained-archive.mjs";
import {
  until,
  startPublicService,
  publicCommand,
  connectPublicMcp,
  seedPublicRecording,
} from "./fixtures/public-service.mjs";
import { registerRelocationTest, relocatedReader } from "./package-relocation.mjs";

const native = process.env.SCREENREC_NATIVE;
assert.ok(native, "SCREENREC_NATIVE must name the pinned native build");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function metadata(frame, clean) {
  const { file: _file, outputId: _outputId, cacheId: _cacheId, sourceEvidence, ...rest } = frame;
  return clean ? rest : { ...rest, sourceEvidence };
}

async function publicFrames(root, output, executable) {
  // The relocation owner deleted the original library before entering this callback.
  await relocatedReader(root, output, executable);
  const expected = JSON.parse(await readFile(join(output, "result.json"), "utf8")).result;
  const context = JSON.parse(await readFile(join(root, "context.json"), "utf8"));
  const parent = dirname(root),
    source = join(parent, "frame-package"),
    archive = join(parent, "frames.zip");
  await archiveFixture(root, source);
  execFileSync("/usr/bin/zip", ["-q", "-r", archive, "."], { cwd: source });
  const archiveHash = sha(await readFile(archive));
  const home = await mkdtemp("/tmp/scr-public-frames-");
  const take = await seedPublicRecording(home, context.snapshot);
  const nativeWorker = mediaWorker({ SCREENREC_NATIVE: executable });
  const run = async (operation, params, signal) => {
    const result = await nativeWorker(operation, params, { signal });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  const revision = context.history.find((value) => value.id === context.snapshot.revisionId);
  const extras = [
    { atUs: 500_000, clean: true },
    { ...context.requests[1], crop: { x: 64, y: 64, width: 640, height: 400 }, maxLongEdge: 320 },
  ];
  const extraExpected = [];
  for (const [i, request] of extras.entries()) {
    const frame = await materializeFrame(
      {
        ...request,
        recordingId: context.snapshot.recordingId,
        sourceId: context.snapshot.sourceId,
        revision,
        source: join(root, context.assets.video),
        output: join(output, `extra-${i}.png`),
        maxLongEdge: request.maxLongEdge ?? 1600,
        crop: request.crop ?? null,
        trailUs: 0,
        sourceEvidence: null,
      },
      {
        decode: (params, signal) => run("media.frame", params, signal),
        sample: ({ source, kept, atSourceUs }, signal) =>
          run("media.visualSamples", { source, kept, atSourceUs }, signal),
        evidence: new FileSourceEvidence(join(root, "source-pages"), context.source),
      },
      new AbortController().signal,
    );
    extraExpected.push({ frame, bytes: await readFile(frame.file) });
  }
  assert.equal(
    extraExpected[0].frame.requestedSourceUs,
    1_000_000,
    "Exact cut join maps to following kept span",
  );
  assert.equal(extraExpected[1].frame.width, 320);
  assert.equal(extraExpected[1].frame.height, 200);
  let service, client;
  const receipts = { originalLibraryAbsent: true, archiveSha256: archiveHash };
  try {
    service = await startPublicService(home, native);
    const ok = async (operation, params = {}) => {
      const result = await service.call(operation, params);
      assert.equal(result.ok, true, JSON.stringify(result));
      return result.data;
    };
    const opened = publicCommand(service.socket, "package.open", { path: await realpath(archive) });
    const readyPackage = (id) =>
      until(async () => {
        const value = await ok("package.status", { admissionId: id });
        assert.ok(
          !["failed", "cleanup_failed", "canceled"].includes(value.state),
          JSON.stringify(value),
        );
        return value.state === "ready" && value;
      }, "Package did not become ready");
    const first = await readyPackage(opened.id);
    const second = await readyPackage(
      (await ok("package.open", { path: await realpath(archive) })).id,
    );
    assert.notEqual(first.packageHandle, second.packageHandle);
    const target = { packageHandle: first.packageHandle };
    const frame = (params) =>
      until(async () => {
        const value = await ok("frame.get", params);
        assert.ok(!["failed", "unavailable"].includes(value.state), JSON.stringify(value));
        return value.state === "ready" && value.published && value;
      }, "Arbitrary frame did not become ready");
    const bytes = async (delivery, close = true) => {
      const chunks = [];
      let offset = 0;
      try {
        for (;;) {
          const chunk = await ok("artifact.read", {
            token: delivery.token,
            offset,
            maxBytes: 524288,
          });
          chunks.push(Buffer.from(chunk.data, "base64"));
          if (chunk.eof) break;
          assert.ok(chunk.nextOffset > offset);
          offset = chunk.nextOffset;
        }
        return Buffer.concat(chunks);
      } finally {
        if (close) await ok("artifact.close", { token: delivery.token });
      }
    };
    const index = await ok("index.get", { ...target, limit: 200 });
    assert.equal(index.page.nextCursor, null);
    assert.ok(
      !index.page.entries.some(
        (entry) =>
          entry.candidate.requestedSourceUs === expected.frames[0].metadata.requestedSourceUs,
      ),
    );
    const readyFrames = [];
    let held;
    for (const [i, request] of context.requests.entries()) {
      const value = await frame({ ...target, ...request });
      assert.equal(value.packageHandle, first.packageHandle);
      assert.equal(value.revisionId, request.revisionId ?? context.snapshot.revisionId);
      if (request.clean) assert.equal(value.published.frame.sourceEvidence, null);
      assert.deepEqual(
        metadata(value.published.frame, request.clean),
        metadata(expected.frames[i].metadata, request.clean),
      );
      assert.deepEqual(
        await bytes(value.delivery, i !== 0),
        await readFile(join(output, `${i}.png`)),
      );
      if (i === 0) held = value.delivery;
      readyFrames.push(value);
    }
    for (const [i, request] of extras.entries()) {
      const value = await frame({ ...target, ...request });
      assert.deepEqual(
        metadata(value.published.frame, true),
        metadata(extraExpected[i].frame, true),
      );
      assert.deepEqual(await bytes(value.delivery), extraExpected[i].bytes);
    }
    const again = await frame({ ...target, ...context.requests[0] });
    assert.equal(again.jobId, readyFrames[0].jobId);
    assert.equal(again.published.frame.outputId, readyFrames[0].published.frame.outputId);
    await bytes(again.delivery);
    const cliImage = join(parent, "public-arbitrary.png");
    publicCommand(service.socket, "frame.get", { ...target, ...context.requests[0] }, [
      "--output",
      cliImage,
    ]);
    assert.deepEqual(await readFile(cliImage), await readFile(join(output, "0.png")));
    client = await connectPublicMcp(service.socket, "public-package-frame-proof");
    const tool = await client.callTool({
      name: "frame.get",
      arguments: { ...target, ...context.requests[0] },
    });
    const image = tool.content.find((value) => value.type === "image");
    assert.ok(image, JSON.stringify(tool));
    assert.deepEqual(Buffer.from(image.data, "base64"), await readFile(join(output, "0.png")));
    const batch = await client.callTool({
      name: "frame.batch",
      arguments: { ...target, clean: true, atUs: [context.requests[1].atUs, extras[0].atUs] },
    });
    const images = batch.content.filter((value) => value.type === "image");
    assert.equal(images.length, 2, JSON.stringify(batch));
    assert.deepEqual(Buffer.from(images[0].data, "base64"), await readFile(join(output, "1.png")));
    assert.deepEqual(Buffer.from(images[1].data, "base64"), extraExpected[0].bytes);
    const outputs = new Set();
    for (let i = 0; i < 40; i++) {
      held = await ok("artifact.renew", { token: held.token });
      const value = await frame({
        ...target,
        atUs: 50_000 + i * 8_000,
        clean: true,
        maxLongEdge: 240,
      });
      outputs.add(value.published.frame.outputId);
      await bytes(value.delivery);
    }
    assert.equal(
      outputs.size,
      40,
      "Unique admitted requests must make forward progress beyond output capacity",
    );
    assert.deepEqual(await bytes(held, false), await readFile(join(output, "0.png")));
    const regenerated = await frame({ ...target, ...context.requests[1] });
    assert.notEqual(regenerated.jobId, readyFrames[1].jobId);
    assert.notEqual(regenerated.published.frame.outputId, readyFrames[1].published.frame.outputId);
    assert.deepEqual(await bytes(regenerated.delivery), await readFile(join(output, "1.png")));
    const sibling = await frame({ packageHandle: second.packageHandle, ...context.requests[0] });
    const siblingBytes = await bytes(sibling.delivery, false);
    await ok("recording.delete", { recordingId: take.recordingId });
    assert.deepEqual(await bytes(held, false), await readFile(join(output, "0.png")));
    assert.deepEqual(await bytes(sibling.delivery, false), siblingBytes);
    held = await ok("artifact.renew", { token: held.token });
    await ok("package.close", { admissionId: first.id });
    assert.ok(Date.now() < held.expiresAt);
    assert.equal(
      (await service.call("artifact.read", { token: held.token, offset: 0 })).error.code,
      "ARTIFACT_EXPIRED",
    );
    assert.equal(
      (await service.call("frame.get", { ...target, ...context.requests[0] })).error.code,
      "CONTEXT_CLOSED",
    );
    assert.deepEqual(await bytes(sibling.delivery, false), siblingBytes);
    await client.close();
    client = undefined;
    await service.close();
    service = undefined;
    assert.deepEqual(await readdir(join(home, "run/packages")), []);
    service = await startPublicService(home, native);
    assert.equal(
      (
        await service.call("frame.get", {
          packageHandle: second.packageHandle,
          ...context.requests[0],
        })
      ).error.code,
      "CONTEXT_CLOSED",
    );
    assert.equal(
      (await service.call("artifact.read", { token: sibling.delivery.token, offset: 0 })).error
        .code,
      "ARTIFACT_EXPIRED",
    );
    Object.assign(receipts, {
      cliAndMcpImageParity: true,
      arbitraryNotSelected: true,
      cropAndCutJoinParity: true,
      cleanSourceEvidenceNull: true,
      historicalRevisionParity: true,
      sequentialUniqueOutputs: outputs.size,
      heldReadSurvivesPressure: true,
      regeneration: true,
      sameContentIndependent: true,
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
  Object.assign(receipts, await packageMediaFailures(await realpath(archive), executable));
  assert.equal(sha(await readFile(archive)), archiveHash);
  if (process.env.SCREENREC_PUBLIC_FRAME_EVIDENCE)
    await writeFile(
      process.env.SCREENREC_PUBLIC_FRAME_EVIDENCE,
      JSON.stringify(receipts, null, 2) + "\n",
    );
  return { publicFrames: true, ownedServiceGroupsReaped: true };
}
registerRelocationTest({
  reader: publicFrames,
  narration: false,
  executable: native,
  evidenceScope:
    "Actual public arbitrary package frame CLI/MCP parity and output lifetime; injected failure retry and actual stopped-worker close drain",
});
