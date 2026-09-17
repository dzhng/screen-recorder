import {
  until,
  startPublicService,
  publicCommand,
  connectPublicMcp,
  seedPublicRecording,
} from "./fixtures/public-service.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, readdir, realpath, mkdtemp, rm, cp } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createConnection } from "node:net";
import { encodeJsonLine } from "../../../packages/protocol/dist/index.js";
import { archiveFixture } from "./fixtures/retained-archive.mjs";
import { registerRelocationTest, relocatedReader } from "./package-relocation.mjs";

const native = process.env.SCREENREC_NATIVE;
assert.ok(native, "SCREENREC_NATIVE must name the pinned native build");
const sha = (value) => createHash("sha256").update(value).digest("hex");

async function publicReader(original, output, executable) {
  const parent = dirname(original),
    source = join(parent, "public-package"),
    archive = join(parent, "public.zip"),
    home = await mkdtemp("/tmp/scr-public-pkg-");
  await archiveFixture(original, source);
  execFileSync("/usr/bin/zip", ["-q", "-r", archive, "."], { cwd: source });
  const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
  const inputHash = sha(await readFile(archive));
  const take = await seedPublicRecording(home, manifest.snapshot);
  let service, client;
  const receipts = {};
  try {
    service = await startPublicService(home, native);
    const ok = async (operation, params) => {
      const result = await service.call(operation, params);
      assert.equal(result.ok, true, JSON.stringify(result));
      return result.data;
    };
    const command = (operation, params, extra = []) =>
      publicCommand(service.socket, operation, params, extra);
    const archivePath = await realpath(archive);
    const opened = command("package.open", { path: archivePath });
    const ready = async (id) =>
      until(async () => {
        const value = await ok("package.status", { admissionId: id });
        assert.ok(
          !["failed", "cleanup_failed", "canceled"].includes(value.state),
          JSON.stringify(value),
        );
        return value.state === "ready" && value;
      }, "Package did not become ready");
    const first = await ready(opened.id),
      second = await ready((await ok("package.open", { path: await realpath(archive) })).id);
    assert.notEqual(first.packageHandle, second.packageHandle);
    const target = { packageHandle: first.packageHandle };
    const revision = await ok("revision.get", target);
    assert.equal(revision.revision.id, manifest.snapshot.revisionId);
    assert.notEqual(
      revision.revision.ordinal,
      manifest.snapshot.historyThroughOrdinal,
      "Fixture exports an older revision",
    );
    const history = await ok("revision.history", { ...target, limit: 1 });
    assert.equal(history.revisions[0].id, "r0");
    assert.ok(history.nextCursor);
    assert.equal(
      (
        await service.call("revision.history", {
          packageHandle: second.packageHandle,
          cursor: history.nextCursor,
        })
      ).error.code,
      "ARTIFACT_CHANGED",
    );
    const later = manifest.history.at(-1).id;
    assert.equal((await ok("revision.get", { ...target, revisionId: later })).revision.id, later);
    assert.equal(
      (await service.call("index.get", { ...target, revisionId: later })).error.code,
      "ARTIFACT_UNAVAILABLE",
    );
    const index = await ok("index.get", { ...target, limit: 1 }),
      reference = index.page.entries[0].reference;
    assert.equal(reference.packageHandle, first.packageHandle);
    assert.equal(reference.recordingId, undefined, "Provenance must not become a second selector");
    assert.ok(index.page.nextCursor);
    assert.equal(
      (
        await service.call("index.get", {
          packageHandle: second.packageHandle,
          cursor: index.page.nextCursor,
        })
      ).error.code,
      "ARTIFACT_CHANGED",
    );
    assert.equal(
      (await service.call("index.get", { ...target, recordingId: take.recordingId })).error.code,
      "INVALID_PARAMS",
    );
    const continued = await ok("index.get", { ...target, cursor: index.page.nextCursor, limit: 1 });
    assert.ok(continued.page.entries[0].candidate.ordinal > reference.ordinal);
    const { ordinal: _ordinal, ...indexReference } = reference;
    const coverage = await ok("index.coverage", { ...indexReference, limit: 1 });
    assert.ok(coverage.coverage.length);
    const imagePath = join(parent, "public-selected.png");
    command("index.frame", reference, ["--output", imagePath]);
    const expected = await readFile(
      join(source, "evidence/index/images", `${reference.ordinal}.png`),
    );
    const actual = await readFile(imagePath);
    assert.deepEqual(actual, expected);
    client = await connectPublicMcp(service.socket, "public-package-index-proof");
    const tool = await client.callTool({ name: "index.frame", arguments: reference });
    const image = tool.content.find((value) => value.type === "image");
    assert.ok(image);
    assert.deepEqual(Buffer.from(image.data, "base64"), expected);
    const batch = await client.callTool({
      name: "index.frames",
      arguments: {
        packageHandle: first.packageHandle,
        revisionId: reference.revisionId,
        generation: reference.generation,
        ordinals: [reference.ordinal, 999999, reference.ordinal],
      },
    });
    assert.equal(
      batch.content.filter((value) => value.type === "image").length,
      2,
      JSON.stringify(batch),
    );
    for (const image of batch.content.filter((value) => value.type === "image"))
      assert.deepEqual(Buffer.from(image.data, "base64"), expected);
    assert.deepEqual(
      batch.structuredContent.data.items.map((item) => ({ ordinal: item.ordinal, ok: item.ok })),
      [
        { ordinal: reference.ordinal, ok: true },
        { ordinal: 999999, ok: false },
        { ordinal: reference.ordinal, ok: true },
      ],
    );
    // Admission validates every byte hash, while normalized row semantics remain a read-time contract.
    const malformed = join(parent, "malformed-pages"),
      badArchive = join(parent, "malformed.zip");
    await cp(source, malformed, { recursive: true });
    const pagesPath = "evidence/index/pages.json";
    const pages = JSON.parse(await readFile(join(malformed, pagesPath), "utf8"));
    const descriptor = pages.indexes.entries[0];
    const pagePath = `evidence/index/${descriptor.file}`;
    const rows = JSON.parse(await readFile(join(malformed, pagePath), "utf8"));
    assert.equal(rows[0].kind, "entry");
    rows[0].entry.frame.actualSourceUs = -1;
    const invalidPage = Buffer.from(JSON.stringify(rows));
    descriptor.bytes = invalidPage.length;
    descriptor.sha256 = sha(invalidPage);
    await writeFile(join(malformed, pagePath), invalidPage);
    await writeFile(join(malformed, pagesPath), JSON.stringify(pages));
    const malformedManifest = structuredClone(manifest);
    for (const path of [pagePath, pagesPath]) {
      const data = await readFile(join(malformed, path)),
        member = malformedManifest.inventory.find((entry) => entry.path === path);
      member.bytes = data.length;
      member.sha256 = sha(data);
    }
    await writeFile(join(malformed, "manifest.json"), JSON.stringify(malformedManifest));
    execFileSync("/usr/bin/zip", ["-q", "-r", badArchive, "."], { cwd: malformed });
    const bad = await ready((await ok("package.open", { path: await realpath(badArchive) })).id);
    assert.equal(
      (await service.call("index.get", { packageHandle: bad.packageHandle })).error.code,
      "INVALID_EVIDENCE",
    );
    await ok("package.close", { admissionId: bad.id });
    const absent = await service.call("package.open", {
      path: "/private/tmp/screenrec-absent-package/absent.zip",
    });
    assert.equal(absent.error.code, "INVALID_PACKAGE");
    receipts.lazyRowValidation = true;
    const beforeLost = (await ok("package.status")).admissions.map((entry) => entry.id);
    await new Promise((resolve, reject) => {
      const socket = createConnection(service.socket);
      const timeout = setTimeout(
        () => socket.destroy(new Error("Lost-response fixture deadline")),
        3000,
      );
      socket.once("error", reject);
      socket.once("connect", () =>
        socket.write(
          encodeJsonLine({
            id: randomUUID(),
            operation: "package.open",
            params: { path: archivePath },
          }),
        ),
      );
      // Discard the response without parsing its admission ID, then recover solely by public status.
      socket.once("data", () => socket.destroy());
      socket.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    const recovered = (await ok("package.status")).admissions.filter(
      (entry) => !beforeLost.includes(entry.id),
    );
    assert.equal(recovered.length, 1);
    const lost = await ready(recovered[0].id);
    assert.notEqual(lost.packageHandle, first.packageHandle);
    await ok("package.close", { admissionId: lost.id });
    assert.deepEqual(
      (await ok("package.status")).admissions.map((entry) => entry.id),
      beforeLost,
    );
    receipts.lostOpenReplyRecovered = true;
    const held = (await ok("index.frame", reference)).delivery;
    const siblingReference = { ...reference, packageHandle: second.packageHandle };
    const sibling = (await ok("index.frame", siblingReference)).delivery;
    const read = async (token) => ok("artifact.read", { token, offset: 0, maxBytes: 524288 });
    const before = await read(held.token);
    receipts.libraryDeletion = await ok("recording.delete", { recordingId: take.recordingId });
    assert.equal((await read(held.token)).data, before.data);
    assert.equal((await read(sibling.token)).data, before.data);
    await ok("package.close", { admissionId: first.id });
    assert.ok(Date.now() < held.expiresAt, "Revocation must be proven before TTL expiry");
    assert.equal(
      (await service.call("artifact.read", { token: held.token, offset: 0 })).error.code,
      "ARTIFACT_EXPIRED",
    );
    assert.equal((await service.call("index.get", target)).error.code, "CONTEXT_CLOSED");
    assert.equal((await read(sibling.token)).data, before.data);
    await client.close();
    client = undefined;
    await service.close();
    service = undefined;
    assert.deepEqual(await readdir(join(home, "run/packages")), []);
    service = await startPublicService(home, native);
    assert.equal(
      (await service.call("index.get", { packageHandle: second.packageHandle })).error.code,
      "CONTEXT_CLOSED",
    );
    assert.equal(
      (await service.call("package.status", { admissionId: second.id })).error.code,
      "NOT_FOUND",
    );
    assert.equal(
      (await service.call("artifact.read", { token: sibling.token, offset: 0 })).error.code,
      "ARTIFACT_EXPIRED",
    );
    receipts.imageSha256 = sha(actual);
    receipts.packageSha256 = inputHash;
    receipts.sameContentIndependent = true;
    receipts.cliAndMcpBytes = true;
    receipts.closeBeforeExpiry = true;
    receipts.restartInvalidates = true;
  } finally {
    await client?.close();
    await service?.close();
    await rm(home, { recursive: true, force: true });
  }
  assert.equal(sha(await readFile(archive)), inputHash);
  await relocatedReader(original, output, executable);
  if (process.env.SCREENREC_PUBLIC_PACKAGE_EVIDENCE)
    await writeFile(
      process.env.SCREENREC_PUBLIC_PACKAGE_EVIDENCE,
      JSON.stringify(receipts, null, 2) + "\n",
    );
  return { publicPackage: true, ownedServiceGroupsReaped: true };
}
registerRelocationTest({
  reader: publicReader,
  narration: false,
  executable: native,
  evidenceScope:
    "Actual public package admission and retained index CLI/MCP bytes; arbitrary package frame/audio remains deferred",
});
