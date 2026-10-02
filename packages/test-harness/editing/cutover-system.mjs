import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// Saved-data verification only. The public producers and their terminal evidence remain separate.
const directory = resolve(process.argv[2]);
const json = async (name) => JSON.parse(await readFile(join(directory, name), "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixture = await json("fixture-report.json");
const before = await json("correspondence-report-v2.json");
const completed = await json("correspondence-report.json");
const source = await readFile(join(directory, "independent-offered.f32"));
assert.equal(sha(source), "8569fcee1664e29ef7f73ae2e05f1077c83442f8425b8a582454a9f4181c924c");
assert.equal(source.length, 96000 * 4);

function wav(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  let format;
  for (let at = 12; at + 8 <= bytes.length;) {
    const count = bytes.readUInt32LE(at + 4);
    assert.ok(at + 8 + count <= bytes.length, "Complete WAV chunks required");
    const kind = bytes.toString("ascii", at, at + 4);
    if (kind === "fmt ")
      format = {
        encoding: bytes.readUInt16LE(at + 8),
        channels: bytes.readUInt16LE(at + 10),
        sampleRate: bytes.readUInt32LE(at + 12),
        bits: bytes.readUInt16LE(at + 22),
      };
    if (kind === "data") {
      assert.deepEqual(
        { ...format, channels: undefined },
        { encoding: 3, channels: undefined, sampleRate: 48000, bits: 32 },
      );
      return { channels: format.channels, pcm: bytes.subarray(at + 8, at + 8 + count) };
    }
    at += 8 + count + (count % 2);
  }
  assert.fail("No PCM data");
}

const legacy = wav(await readFile(join(directory, "legacy-system.wav")));
const project = wav(await readFile(join(directory, "project-system.wav")));
const split = wav(await readFile(join(directory, "project-system-split.wav")));
assert.equal(legacy.channels, 1);
assert.equal(project.channels, 2);
assert.equal(split.channels, 2);

// Independently offered sample addresses: callback buffer 4 was omitted before NativeCapture.
const accepted = Buffer.concat([source.subarray(0, 32768 * 4), source.subarray(40960 * 4)]);
const format = Buffer.alloc(16);
format.writeBigInt64LE(48000n);
format.writeBigInt64LE(1n, 8);
assert.equal(
  sha(Buffer.concat([Buffer.from("screenrec.capture-pcm.v1\0"), format, accepted])),
  "9927e17377949e5aff350d1f50e86a4511ef0a9670d0824f0caeb44117cf60d2",
);
const expected = Buffer.concat([
  source.subarray(28800 * 4, 32768 * 4),
  Buffer.alloc(8192 * 4),
  source.subarray(40960 * 4, 43200 * 4),
]);
const duplicated = Buffer.alloc(expected.length * 2);
for (let at = 0; at < expected.length; at += 4) {
  expected.copy(duplicated, at * 2, at, at + 4);
  expected.copy(duplicated, at * 2 + 4, at, at + 4);
}
function verifyPCM(actual, wanted) {
  assert.ok(
    actual.equals(wanted),
    "Complete PCM must match independently offered sample addresses",
  );
}
verifyPCM(legacy.pcm, expected);
verifyPCM(project.pcm, duplicated);
verifyPCM(split.pcm, duplicated);
assert.equal(expected.length, 14400 * 4);
const poisonedHole = Buffer.from(expected);
source.copy(poisonedHole, 3968 * 4, 32768 * 4, 40960 * 4);
assert.throws(() => verifyPCM(poisonedHole, expected), /Complete PCM/);
const shifted = Buffer.concat([source.subarray(28799 * 4, 32767 * 4), expected.subarray(3968 * 4)]);
assert.throws(() => verifyPCM(shifted, expected), /Complete PCM/);
const wrongChannel = Buffer.from(duplicated);
wrongChannel.writeFloatLE(0.5, 4);
assert.throws(() => verifyPCM(wrongChannel, duplicated), /Complete PCM/);

const canonicalSHA = "4860a72fe6857d9e647444aa653b3f1b2561f4ae2af5dc636256475db77b6494";
const journalSHA = "8747e98c5bff23a2f019aca259f3d37938c12ed95e8563b23c503748b3a07f21";
const sourceReceipt = fixture.source.normalization;
const journal = await readFile(join(directory, "authentic-source/capture.journal.jsonl"));
const publicationBytes = await readFile(
  join(directory, "authentic-source/system.publication.json"),
);
const publication = JSON.parse(publicationBytes);
assert.equal(sha(journal), journalSHA);
assert.equal(publication.intent.sourceID, "unreadable-packed");
assert.equal(publication.intent.role, "system");
assert.equal(
  sha(journal.subarray(0, Number(publication.intent.journal.bytes))),
  publication.intent.journal.sha256,
);
assert.equal(publication.canonical.sha256, canonicalSHA);
assert.equal(
  publication.pcmSHA256,
  "9927e17377949e5aff350d1f50e86a4511ef0a9670d0824f0caeb44117cf60d2",
);
assert.equal(publication.representedFrames, "87808");
assert.equal(publication.cleanPhysicalEOF, true);
const support = Buffer.alloc(7 * 8);
for (const [index, value] of [100001n, 0n, 0n, 32768n, 32768n, 40960n, 55040n].entries())
  support.writeBigInt64LE(value, index * 8);
assert.equal(
  sha(Buffer.concat([Buffer.from("screenrec.capture-support.v1\0"), format, support])),
  publication.supportSHA256,
);
assert.equal(sourceReceipt.header.sessionID, "unreadable-packed");
assert.equal(sourceReceipt.header.microphone, true);
assert.equal(sourceReceipt.header.systemAudio, true);
assert.equal(sourceReceipt.header.source.kind, "offline-prerecorded");
assert.equal(sourceReceipt.completion.failureCode, "PACKED_MEDIA_INVALID");
assert.equal(sourceReceipt.geometryRecords, 0);
assert.equal(sourceReceipt.audioIntervals, 2);
assert.equal(sourceReceipt.publications.system.canonical.sha256, canonicalSHA);
assert.equal(sourceReceipt.publications.system.receipt.sha256, sha(publicationBytes));
assert.equal(fixture.source.journal.sha256, journalSHA);
assert.equal(
  sha(await readFile(join(directory, "authored-system-inspection.zip"))),
  fixture.archive.sha256,
);
assert.equal(fixture.manifest.acquisition.narration, "not_acquired");
assert.equal(fixture.manifest.acquisition.system, "acquired");
assert.equal(fixture.manifest.transcript, "unavailable:no_narration");
assert.equal(fixture.manifest.snapshot.capture.state, "interrupted");
assert.equal(fixture.manifest.snapshot.capture.interruptionReason, "PACKED_MEDIA_INVALID");
assert.equal(fixture.manifest.snapshot.sourceDurationUs, 3163631);
assert.equal(fixture.owners.revision, "aa8a18e183db64cbf0b7a2df50b9e9d36038e6f4");
assert.equal(before.legacyPackage.state, "ready");
const oldAudio = before.legacy.receipt.published.audio;
assert.equal(oldAudio.selectedTrack, "system");
assert.deepEqual(oldAudio.missingRoles, []);
assert.deepEqual(
  oldAudio.tracks.map(({ role, gain, unavailable }) => ({ role, gain, unavailable })),
  [{ role: "system", gain: 1, unavailable: [{ startUs: 782668, endUs: 953334 }] }],
);
assert.equal(oldAudio.sourceEvidence.receipt.publications.system.canonical.sha256, canonicalSHA);
assert.equal(before.acquisition.journal.sha256, journalSHA);
const system = before.acquisition.bindings.find((binding) =>
  binding.sourceRoles.includes("system"),
);
assert.deepEqual(system, {
  assetId: canonicalSHA,
  streamId: "track:1",
  sourceRoles: ["system"],
  sourceToAssetOffsetUs: -100001,
  supportBasis: "captured-audio",
  available: [
    { startUs: 0, endUs: 682667 },
    { startUs: 853333, endUs: 2000000 },
  ],
});
assert.ok(
  !before.acquisition.bindings.some((binding) => binding.sourceRoles.includes("narration")),
);
const clips = before.placed.revision.document.clips;
assert.equal(clips.length, 1);
assert.equal(clips[0].assetId, canonicalSHA);
assert.equal(clips[0].acquisitionId, before.acquisition.id);
assert.deepEqual(clips[0].source, { kind: "range", range: { startUs: 0, endUs: 2000000 } });
assert.deepEqual(clips[0].placement, {
  kind: "project",
  range: { startUs: 100001, endUs: 2100001 },
});
const projectAudio = before.project.receipt.published.audio;
assert.deepEqual(projectAudio.sampleRange, { start: 33600, end: 48000 });
assert.deepEqual(projectAudio.unavailable, [
  { clipId: clips[0].id, ranges: [{ start: 37568, end: 45760 }] },
]);
assert.deepEqual(completed.range, { startUs: 700001, endUs: 1000001 });
assert.equal(completed.splitAtUs, 800001);
const afterClips = completed.split.revision.document.clips;
assert.equal(afterClips.length, 2);
assert.equal(afterClips[0].id, clips[0].id);
assert.notEqual(afterClips[1].id, clips[0].id);
assert.deepEqual(completed.split.edit.createdIds, [{ kind: "clip", id: afterClips[1].id }]);
const expectedDocument = structuredClone(before.placed.revision.document);
expectedDocument.clips = [
  {
    ...clips[0],
    source: { ...clips[0].source, range: { startUs: 0, endUs: 700000 } },
    placement: { ...clips[0].placement, range: { startUs: 100001, endUs: 800001 } },
  },
  {
    ...clips[0],
    id: afterClips[1].id,
    source: { ...clips[0].source, range: { startUs: 700000, endUs: 2000000 } },
    placement: { ...clips[0].placement, range: { startUs: 800001, endUs: 2100001 } },
  },
];
assert.deepEqual(completed.split.revision.document, expectedDocument);
assert.equal(completed.split.revision.projectId, before.placed.revision.projectId);
assert.equal(completed.split.revision.ordinal, before.placed.revision.ordinal + 1);
assert.notEqual(completed.split.revision.id, before.placed.revision.id);
assert.deepEqual(completed.calls.slice(0, before.calls.length), before.calls);
for (const call of [...before.calls, ...completed.calls.slice(before.calls.length)]) {
  assert.equal(call.result.code, call.value.ok ? 0 : 1);
  assert.deepEqual(JSON.parse(call.result.stdout), call.value);
  assert.ok(!/capture|synth|transcri|model|recording/.test(call.operation));
}
assert.equal(completed.executionComplete, true);
assert.deepEqual(
  before.terminal.map(({ side, code, signal }) => ({ side, code, signal })),
  [
    { side: "current", code: 0, signal: null },
    { side: "legacy", code: 0, signal: null },
  ],
);
assert.deepEqual(
  completed.terminal.map(({ side, code, signal }) => ({ side, code, signal })),
  [{ side: "current", code: 0, signal: null }],
);
const events = (await readFile(join(directory, "processes.jsonl"), "utf8"))
  .trim()
  .split("\n")
  .map(JSON.parse);
for (const { pid } of events.filter((entry) => entry.event === "spawn"))
  for (const event of ["exit", "close"])
    assert.ok(
      events.some((entry) => entry.pid === pid && entry.event === event),
      "Every owned child must terminate",
    );
for (const { pid } of [...before.terminal, ...completed.terminal]) {
  for (const event of ["exit", "close"])
    assert.ok(
      events.some(
        (entry) =>
          entry.pid === pid && entry.event === event && entry.code === 0 && entry.signal === null,
      ),
    );
  assert.ok(
    events.some((entry) => entry.pid === pid && entry.event === "node-exit" && entry.code === 0),
  );
}
const catalog = await json("catalog-audit.json");
assert.deepEqual(
  catalog.results.map(({ side, recordingTableExists, recordingRows }) => ({
    side,
    recordingTableExists,
    recordingRows,
  })),
  [
    { side: "legacy", recordingTableExists: true, recordingRows: 0 },
    { side: "current", recordingTableExists: true, recordingRows: 0 },
  ],
);
const result = {
  passed: true,
  scope:
    "Independent saved-data correspondence; authored legacy inspection fixture, not automatic recording export or installed cutover",
  frames: 14400,
  matchedAvailableFrames: 6208,
  exactUnavailableFrames: 8192,
  legacyPCM: sha(legacy.pcm),
  projectPCM: sha(project.pcm),
  splitPCM: sha(split.pcm),
  sampleDifference: 0,
  recordingRowsAdmitted: 0,
  legacyPolicy: "Nearest duration and source origin; mono selected system role",
  projectPolicy: "Absolute-floor output clock [33600,48000); stereo unity mono duplication",
  policyDifference:
    "This selected window has the same sample membership; no general rounding equivalence claimed",
  mutationControls: [
    "filled acquisition hole",
    "one-sample source phase",
    "incorrect right channel",
  ],
  producerLimit:
    "Original public producer later failed before split dispatch; its successful cases are verified from saved output. The successful successor performs only the previously unexecuted split.",
};
await writeFile(join(directory, "verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
