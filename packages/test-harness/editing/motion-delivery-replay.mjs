import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sha256 = /^[0-9a-f]{64}$/;
const expected = {
  case: "moved-split-zoom",
  nativeSha256: "dbb3e7aa7674f8cb4d4c416ac3ef082f482993874d7ebb06ddc2054fb41b38f4",
  runnerSha256: "97e7a8b93e42ba9c500e3ddf20bcca9e380ffba050cd84ee17c7119a60ea0d0b",
  decoderSha256: "c8173e9755795978bce8e104f8d7044fabe7d6d84044aba37d3648c6f4e4e1a8",
  pictures: 39,
  checks: {
    wholeCurveRefusals: 0,
    analyticStaticControls: 8,
    movedPictures: 8,
    splitPictures: 8,
    trimmedPictures: 4,
    activationPictures: 3,
    previewExportExact: true,
  },
  outputSha256: {
    full: "c6833a0eb0d711bc0a6a635c0ef22671aba6c28d6b4b75ca19eeb94fa66b4456",
    range: "25e351b8b0ef4e4d80956db9e9b95431b8fcad54b8e01e95c82a57524fd850f3",
  },
};

/** Replay only the immutable moving-trajectory receipt; no native rendering is implied. */
export async function replayMotionDelivery(reportPath) {
  const report = JSON.parse(await readFile(reportPath));
  assert.equal(report.status, "passed", "motion delivery did not pass");
  assert.equal(report.case, expected.case, "motion delivery case changed");
  for (const key of ["nativeSha256", "runnerSha256", "decoderSha256"]) {
    assert.match(report[key], sha256, `${key} is not a SHA-256 identity`);
    assert.equal(report[key], expected[key], `${key} changed`);
  }
  assert.equal(report.pictures, expected.pictures, "picture count changed");
  for (const [key, value] of Object.entries(expected.checks)) {
    assert.equal(report.checks?.[key], value, `${key} changed`);
  }
  assert.equal(report.outputs?.full?.sha256, expected.outputSha256.full, "full output hash changed");
  assert.equal(report.outputs?.range?.sha256, expected.outputSha256.range, "range output hash changed");
  for (const key of ["full", "range"]) {
    assert.equal(report.outputs?.[key]?.path, `${key}.mp4`, `${key} output path changed`);
    assert.match(report.outputs?.[key]?.sha256, sha256, `${key} output is not hashed`);
  }
  return {
    case: report.case,
    pictures: report.pictures,
    wholeCurveRefusals: report.checks.wholeCurveRefusals,
    movedPictures: report.checks.movedPictures,
    splitPictures: report.checks.splitPictures,
    previewExportExact: report.checks.previewExportExact,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node motion-delivery-replay.mjs <motion-delivery-replay.json>");
  console.log(JSON.stringify(await replayMotionDelivery(process.argv[2])));
}
