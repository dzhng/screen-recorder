import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replayNemotron3Admission } from "./nemotron3-admission-replay.mjs";

const receipt = new URL(
  "../../../specs/done/video-editing-feedback/assets/31-speaker-replication/nemotron3-admission/protocol.json",
  import.meta.url,
).pathname;

test("replays the Nemotron-3 pre-inference refusal", async () => {
  const result = await replayNemotron3Admission(receipt);
  assert.equal(result.status, "refused-before-inference");
  assert.equal(result.promotion, false);
  assert.equal(result.qualityState, "not-run");
  assert.equal(result.modelRevision, "f667ed73aee57d40cc39428eb768b4fd87a0a29e");
});

test("refuses a Nemotron-3 receipt edited to claim inference", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-nemotron3-replay-"));
  try {
    const changed = JSON.parse(await readFile(receipt, "utf8"));
    changed.qualityGate.state = "passed";
    const report = join(scratch, "protocol.json");
    await writeFile(report, JSON.stringify(changed));
    await assert.rejects(() => replayNemotron3Admission(report), /identity changed/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
