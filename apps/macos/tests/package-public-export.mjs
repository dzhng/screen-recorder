import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, rename, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { registerRelocationTest } from "./package-relocation.mjs";
import { publicFrames } from "./package-public-frames.mjs";
import { publicAudio } from "./package-public-audio.mjs";
import {
  startPublicService,
  publicCommand,
  connectPublicMcp,
  until,
} from "./fixtures/public-service.mjs";

const executable = process.env.SCREENREC_NATIVE;
assert.ok(executable, "SCREENREC_NATIVE must name the fresh bundled worker");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
let produced;
async function exportThroughClients({ home, recordingId, revisionId }) {
  // The fixture releases its catalog before this process becomes the sole writer.
  const service = await startPublicService(home, executable);
  let mcp;
  try {
    const request = {
      exportId: randomUUID(),
      kind: "processed-package",
      recordingId,
      revisionId,
      directory: dirname(home),
      leaf: "public-package.zip",
    };
    const admitted = publicCommand(service.socket, "export.create", request);
    assert.equal(admitted.kind, "processed-package");
    assert.equal(admitted.snapshot.revisionId, revisionId);
    // A later edit must not change the admitted package's revision/history snapshot.
    const current = publicCommand(service.socket, "revision.get", { recordingId });
    const changed = await service.call("edit.cut", {
      recordingId,
      requestId: randomUUID(),
      expectedRevisionId: current.revision.id,
      ranges: [{ startUs: 0, endUs: 100_000 }],
    });
    assert.equal(changed.ok, true, JSON.stringify(changed));
    assert.notEqual(changed.data.revision.id, revisionId);
    const replay = publicCommand(service.socket, "export.create", request);
    assert.equal(replay.jobId, admitted.jobId);
    assert.deepEqual(replay.snapshot, admitted.snapshot);
    mcp = await connectPublicMcp(service.socket, "complete-package-export-proof");
    const committed = await until(async () => {
      const response = await mcp.callTool({
        name: "export.status",
        arguments: { exportId: request.exportId },
      });
      assert.equal(response.isError, false, JSON.stringify(response));
      const status = response.structuredContent.data;
      assert.ok(
        !["failed", "canceled", "unavailable"].includes(status.state),
        JSON.stringify(status),
      );
      return status.state === "committed" && status;
    }, "Public complete-package export did not commit");
    assert.deepEqual(committed.snapshot, admitted.snapshot);
    produced = committed.output;
    assert.equal(produced, await realpath(join(request.directory, request.leaf)));
    assert.equal(committed.receipt.sha256, sha(await readFile(produced)));
    const retry = publicCommand(service.socket, "export.retry", { exportId: request.exportId });
    assert.deepEqual(retry.receipt, committed.receipt);
  } finally {
    try {
      await mcp?.close();
    } finally {
      await service.close();
    }
  }
}
registerRelocationTest({
  executable,
  narration: false,
  afterLibraryClose: exportThroughClients,
  reader: async (root, output, native) => {
    assert.ok(produced, "Public export must run before source removal");
    const relocated = join(dirname(root), "relocated-public-package.zip");
    await rename(produced, relocated);
    const before = sha(await readFile(relocated));
    const result = await publicFrames(root, output, native, relocated);
    const audio = await publicAudio(
      root,
      join(dirname(output), "public-audio-inspection"),
      native,
      relocated,
    );
    assert.equal(sha(await readFile(relocated)), before);
    return { ...result, ...audio, publicPackageExport: true };
  },
  evidenceScope:
    "Actual CLI package export.create, concurrent edit, MCP commit, replay/retry, moved ZIP and public frame/audio inspection after original library removal; generated no-narration media",
});
