import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const receipt = new URL(
  "../../../specs/done/video-editing-feedback/assets/34-fresh-agent/autonomous-media-replay.json",
  import.meta.url,
).pathname;

const expected = {
  version: 1,
  scope: "fresh production-native media workflow and relocated replay",
  states: ["clean", "relocated"],
  normalizedSha256: "6ade8a3c6457b0b23feaa6f95c7d65ffabaab2ccfbba79950feb5b4aa6f5361f",
  sourceKeys: ["a.mov", "b.mov", "a-audio.wav", "b-audio.wav"],
  speechRepair: { expectedText: "fortunate", observedText: "Fortunately," },
  useCases: ["launch", "podcast", "teaser"],
};

/** Replay only the immutable fresh-agent receipt; no native rendering or model inference. */
export async function replayAutonomousMediaReceipt(reportPath) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(report.version, expected.version, "receipt version changed");
  assert.equal(report.scope, expected.scope, "receipt scope changed");
  assert.deepEqual(
    report.coverage,
    {
      capabilityRouting: "verified",
      sourceIdentity: "verified",
      deliveryIdentity: "verified",
      native: "verified",
      visual: "verified",
      audio: "verified",
      humanQaRequired: false,
    },
    "coverage changed",
  );
  assert.deepEqual(
    report.runs?.map(({ state }) => state),
    expected.states,
    "run states changed",
  );
  assert.equal(report.runs.length, 2, "fresh receipt must retain two runs");
  for (const run of report.runs) {
    assert.equal(run.normalized?.bytes, 56056, `${run.state}: normalized bytes changed`);
    assert.equal(
      run.normalized?.sha256,
      expected.normalizedSha256,
      `${run.state}: normalized identity changed`,
    );
    assert.deepEqual(
      Object.keys(run.sources ?? {}),
      expected.sourceKeys,
      `${run.state}: source keys changed`,
    );
    assert.equal(run.preview?.passed, true, `${run.state}: preview did not pass`);
    assert.equal(
      run.preview?.rendering,
      "production native worker",
      `${run.state}: renderer changed`,
    );
  }
  assert.equal(report.replay?.normalizedDeliveryIdentity, true, "normalized replay claim changed");
  assert.equal(report.replay?.sourceIdentity, true, "source replay claim changed");
  assert.equal(report.replay?.sourceMediaPreserved, true, "source preservation claim changed");
  assert.deepEqual(
    {
      expectedText: report.speechRepair?.expectedText,
      observedText: report.speechRepair?.observedText,
    },
    expected.speechRepair,
    "speech repair receipt changed",
  );
  assert.deepEqual(
    report.routing?.map(({ useCase }) => useCase),
    expected.useCases,
    "routing changed",
  );
  assert.ok(report.routing.every(({ policy }) => policy?.capabilityQuestionFirst === true));
  assert.ok(report.routing.every(({ policy }) => policy?.humanQaRequired === false));
  return {
    version: report.version,
    states: report.runs.map(({ state }) => state),
    normalizedSha256: report.runs[0].normalized.sha256,
    useCases: report.routing.map(({ useCase }) => useCase),
    speechRepair: report.speechRepair,
  };
}

test("replays the retained autonomous fresh-agent receipt", async () => {
  const result = await replayAutonomousMediaReceipt(receipt);
  assert.deepEqual(result, {
    version: 1,
    states: ["clean", "relocated"],
    normalizedSha256: expected.normalizedSha256,
    useCases: expected.useCases,
    speechRepair: {
      expectedText: "fortunate",
      observedText: "Fortunately,",
      beforeRevisionId: "391e11cc-b87a-4bfe-bdf4-75871a9990ec",
      afterRevisionId: "137406e4-d430-473a-bd02-f91adb984458",
    },
  });
});

test("refuses a fresh-agent receipt with a changed relocated identity", async () => {
  const directory = await mkdtemp("/tmp/yap-autonomous-replay-");
  try {
    const report = JSON.parse(await readFile(receipt, "utf8"));
    report.runs[1].normalized.sha256 = "0".repeat(64);
    const path = join(directory, "report.json");
    await writeFile(path, JSON.stringify(report));
    await assert.rejects(
      () => replayAutonomousMediaReceipt(path),
      /relocated: normalized identity changed/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
