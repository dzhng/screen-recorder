import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const expected = {
  exportSha256: "1acaea51694da2162d3b55d88402c43823e6039094b554a3f345d24239a1f9aa",
  audioSha256: "e667f3c3b37d7ac720c5c6ae0859ce7bba71ee6e761b7b733b9ee2d03e370ae2",
  sceneRows: [250000, 500000, 750000],
  samples: {
    100000: [0.0625191256403923, -0.21877159178256989],
    500000: [-0.01689782179892063, 0.10598496347665787],
    900000: [0.06253651529550552, -0.21877771615982056],
  },
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Replay the retained combined A/V export without starting a service or detector. */
export async function replaySceneAudioDelivery(reportPath) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(report.status, "passed", "combined A/V report did not pass");
  assert.equal(report.kind, "delivered-av-scene-audio-report");
  assert.equal(report.export?.sha256, expected.exportSha256, "export identity changed");
  assert.equal(report.export?.bytes, 26811, "export byte count changed");
  assert.equal(report.export?.videoFrames, 4);
  assert.equal(report.export?.audioFrames, 48000);
  assert.equal(report.export?.sampleRate, 48000);
  assert.equal(report.export?.channels, 2);
  assert.deepEqual(report.deliveredVideo?.sceneRows, expected.sceneRows, "scene rows changed");
  assert.equal(report.deliveredAudio?.sha256, expected.audioSha256, "audio identity changed");
  assert.equal(report.deliveredAudio?.bytes, 388096);
  assert.equal(report.deliveredAudio?.frames, 48000);
  assert.deepEqual(report.deliveredAudio?.samples, expected.samples, "audio landmarks changed");
  assert.equal(report.checks?.sameExportContainsVideoAndAudio, true);
  assert.equal(report.checks?.audioDecodedThroughPublicAudioGet, true);
  assert.equal(report.checks?.crossPlaneAssociation, "refused");
  assert.equal(report.checks?.sharedClockPromotion, false);
  const reportFile =
    typeof reportPath === "string" ? resolve(reportPath) : fileURLToPath(reportPath);
  const root = dirname(reportFile);
  for (const [name, expectedHash, expectedBytes] of [
    [report.export.path, expected.exportSha256, report.export.bytes],
    [report.deliveredAudio.path, expected.audioSha256, report.deliveredAudio.bytes],
  ]) {
    const path = resolve(root, name);
    const bytes = await readFile(path);
    assert.equal((await stat(path)).isFile(), true);
    assert.equal(bytes.length, expectedBytes, `${name} byte count changed`);
    assert.equal(digest(bytes), expectedHash, `${name} bytes changed`);
  }
  return {
    kind: report.kind,
    sceneRows: report.deliveredVideo.sceneRows,
    audioFrames: report.deliveredAudio.frames,
    crossPlaneAssociation: report.checks.crossPlaneAssociation,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node scene-audio-delivery-replay.mjs <report.json>");
  console.log(JSON.stringify(await replaySceneAudioDelivery(process.argv[2])));
}
