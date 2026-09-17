import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm, realpath, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FileSourceEvidence } from "@screenrec/core/evidence-pages";
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
async function publicCursor(root, output, executable) {
  await relocatedReader(root, output, executable);
  const context = JSON.parse(await readFile(join(root, "context.json"), "utf8"));
  const sourceRange = { startUs: 0, endUs: 4_000_000 };
  const sourceReader = new FileSourceEvidence(join(root, "source-pages"), context.source);
  const expected = sourceReader.page({
    ...context.source,
    range: sourceRange,
    limit: 1000,
  }).samples;
  assert.ok(expected.length > 60);
  const source = join(dirname(root), "cursor-package"),
    archive = join(dirname(root), "cursor.zip");
  await archiveFixture(root, source);
  execFileSync("/usr/bin/zip", ["-q", "-r", archive, "."], { cwd: source });
  const originalHash = sha(await readFile(archive));
  const home = await mkdtemp("/tmp/scr-public-cursor-");
  const take = await seedPublicRecording(home, context.snapshot);
  let service, client;
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
        const value = await ok("package.status", { admissionId: admitted.id });
        assert.ok(!["failed", "cleanup_failed"].includes(value.state), JSON.stringify(value));
        return value.state === "ready" && value;
      }, "Cursor package did not open");
    };
    const first = await open(),
      second = await open(),
      target = { packageHandle: first.packageHandle };
    const initial = publicCommand(service.socket, "cursor.raw", {
      ...target,
      sourceRange,
      limit: 3,
    });
    assert.equal(initial.packageHandle, first.packageHandle);
    assert.equal(initial.sourceId, context.source.sourceId);
    assert.equal(initial.generation, context.source.generation);
    assert.equal(initial.sourceRevisionId, "r0");
    assert.deepEqual(initial.samples, expected.slice(0, 3));
    assert.deepEqual(initial.integrity, {
      finished: context.source.receipt.finished,
      incompleteTail: context.source.receipt.incompleteTail,
      invalidAtSequence: context.source.receipt.invalidAtSequence ?? null,
      lastSequence: context.source.receipt.lastSequence,
    });
    client = await connectPublicMcp(service.socket, "public-package-cursor-proof");
    const tool = await client.callTool({
      name: "cursor.raw",
      arguments: { ...target, sourceRange, limit: 3 },
    });
    assert.equal(tool.structuredContent.ok, true);
    assert.deepEqual(tool.structuredContent.data, initial);
    let cursor = initial.nextCursor;
    const observed = [...initial.samples];
    while (cursor) {
      const page = await ok("cursor.raw", { ...target, sourceRange, cursor, limit: 7 });
      assert.ok(page.samples.length <= 7);
      assert.deepEqual(page.integrity, initial.integrity);
      observed.push(...page.samples);
      cursor = page.nextCursor;
    }
    assert.deepEqual(observed, expected);
    assert.ok(
      observed.some((sample) => sample.sourceUs === 750_000),
      "Raw source cursor retains observations inside the deleted edit span",
    );
    for (const params of [
      { ...target, sourceRange, cursor: { ...initial.nextCursor, generation: "changed" } },
      { ...target, sourceRange, cursor: { ...initial.nextCursor, sourceId: "changed" } },
      { ...target, sourceRange: { startUs: 1, endUs: 4_000_000 }, cursor: initial.nextCursor },
      { packageHandle: second.packageHandle, sourceRange, cursor: initial.nextCursor },
    ])
      assert.equal((await service.call("cursor.raw", params)).error.code, "ARTIFACT_CHANGED");
    await ok("recording.delete", { recordingId: take.recordingId });
    const afterDelete = await ok("cursor.raw", {
      ...target,
      sourceRange,
      cursor: initial.nextCursor,
      limit: 7,
    });
    assert.deepEqual(afterDelete.samples, expected.slice(3, 10));
    const sibling = await ok("cursor.raw", {
      packageHandle: second.packageHandle,
      sourceRange,
      limit: 3,
    });
    assert.deepEqual(sibling.samples, initial.samples);
    assert.notDeepEqual(sibling.nextCursor, initial.nextCursor);
    await ok("package.close", { admissionId: first.id });
    assert.equal(
      (await service.call("cursor.raw", { ...target, sourceRange, cursor: initial.nextCursor }))
        .error.code,
      "CONTEXT_CLOSED",
    );
    assert.deepEqual(
      (
        await ok("cursor.raw", {
          packageHandle: second.packageHandle,
          sourceRange,
          cursor: sibling.nextCursor,
          limit: 7,
        })
      ).samples,
      expected.slice(3, 10),
    );
    await client.close();
    client = undefined;
    await service.close();
    service = undefined;
    assert.deepEqual(await readdir(join(home, "run/packages")), []);
    service = await startPublicService(home, executable);
    assert.equal(
      (
        await service.call("cursor.raw", {
          packageHandle: second.packageHandle,
          sourceRange,
          cursor: sibling.nextCursor,
        })
      ).error.code,
      "CONTEXT_CLOSED",
    );
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
  assert.equal(sha(await readFile(archive)), originalHash);
  if (process.env.SCREENREC_PUBLIC_CURSOR_EVIDENCE)
    await writeFile(
      process.env.SCREENREC_PUBLIC_CURSOR_EVIDENCE,
      JSON.stringify(
        {
          archiveSha256: originalHash,
          samples: expected.length,
          cliAndMcpParity: true,
          sourceTimeRetainsDeletedObservations: true,
          filteredContinuationIsolation: true,
          libraryDeletionIsolation: true,
          closedAndRestartedHandleRejected: true,
          ownedProcessGroupsReaped: true,
        },
        null,
        2,
      ) + "\n",
    );
  return { publicCursor: true, ownedServiceGroupsReaped: true };
}
registerRelocationTest({
  reader: publicCursor,
  narration: false,
  executable: native,
  evidenceScope:
    "Public source-time cursor pages after relocation, strict continuation identity and closed-handle isolation",
});
