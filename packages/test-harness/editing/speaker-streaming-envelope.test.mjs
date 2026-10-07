import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("retains the bounded native streaming envelope without promoting long-form labeling", async () => {
  const { readSpeakerStreamingEnvelope } = await import("./speaker-streaming-envelope.mjs");
  const envelope = await readSpeakerStreamingEnvelope();
  assert.equal(envelope.kind, "speaker-native-streaming-envelope");
  assert.equal(envelope.stateScope, "single native diarize call per selected input");
  assert.equal(envelope.internalState, "persistent across native internal chunks");
  assert.equal(envelope.crossSelectionState, "reset between selections");
  assert.equal(envelope.publicWindowMaximumSeconds, 30);
  assert.equal(envelope.researchLongControl.id, "three-speaker600");
  assert.equal(envelope.researchLongControl.passed, true);
  assert.equal(envelope.requiredOverlapControl.id, "four-speaker600");
  assert.equal(envelope.requiredOverlapControl.passed, false);
  assert.equal(envelope.promotion, false);
});

test("rejects a streaming receipt that changes its cross-selection state contract", async () => {
  const { readSpeakerStreamingEnvelope } = await import("./speaker-streaming-envelope.mjs");
  const source = new URL(
    "../../../specs/done/video-editing-feedback/assets/31-speaker-replication/",
    import.meta.url,
  ).pathname;
  const scratch = await mkdtemp(join(tmpdir(), "yap-speaker-streaming-envelope-"));
  try {
    await cp(join(source, "handoff-evidence"), join(scratch, "handoff-evidence"), {
      recursive: true,
    });
    const path = join(scratch, "handoff-evidence", "three-long", "transport.json");
    const transport = JSON.parse(await readFile(path, "utf8"));
    transport.result.data.stateScope = "state reused across selections";
    await writeFile(path, `${JSON.stringify(transport)}\n`);
    await assert.rejects(
      () => readSpeakerStreamingEnvelope(join(scratch, "handoff-evidence")),
      /cross-selection state contract/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
