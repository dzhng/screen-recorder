import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = /^[0-9a-f]{64}$/;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expected = {
  case: "moved-split-zoom",
  nativeSha256: "b6d1f73e0777f635c1a1bc9718a6cf23ac7235a72f1b7fff071a259b31b5b5de",
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
    full: "cf60ee1d9019c0fbc9bf4182e8f92e5d96c24472d39066d35b10a08347ca66a0",
    range: "21568ea171f41f83a722203f47f43e96f2a530214f295b483200012f912189f5",
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
  assert.equal(
    report.outputs?.full?.sha256,
    expected.outputSha256.full,
    "full output hash changed",
  );
  assert.equal(
    report.outputs?.range?.sha256,
    expected.outputSha256.range,
    "range output hash changed",
  );
  for (const key of ["full", "range"]) {
    assert.equal(report.outputs?.[key]?.path, `${key}.mp4`, `${key} output path changed`);
    assert.match(report.outputs?.[key]?.sha256, sha256, `${key} output is not hashed`);
    const reportFile =
      typeof reportPath === "string" ? resolve(reportPath) : fileURLToPath(reportPath);
    const artifactPath = resolve(dirname(reportFile), report.outputs[key].path);
    const artifact = await readFile(artifactPath);
    const details = await stat(artifactPath);
    assert.ok(details.isFile(), `${key} output is not a regular file`);
    assert.ok(artifact.length > 0, `${key} output is empty`);
    assert.equal(digest(artifact), report.outputs[key].sha256, `${key} output bytes changed`);
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
