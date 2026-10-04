import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { resolveOutputSettings } from "../../composition/dist/index.js";
import { mediaWorker } from "../../../apps/service/dist/worker.js";
const worker = process.env.SCREENREC_NATIVE;
assert(worker);
const workerSha256 = createHash("sha256")
  .update(await readFile(worker))
  .digest("hex");
const out = process.argv[2]
  ? resolve(process.argv[2])
  : await mkdtemp("/tmp/screenrec-preflight-evidence-");
await mkdir(out, { recursive: true });
const home = await mkdtemp("/tmp/sr-preflight-");
const call = mediaWorker({ ...process.env, SCREENREC_NATIVE: worker });
const request = {
  output: join(home, "movie.mp4"),
  frames: join(home, "missing-frames.jsonl"),
  range: { startUs: 0, endUs: 1000000 },
  canvas: {
    width: 64,
    height: 48,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  assets: [],
  processing: [],
  audio: { range: { start: 0, end: 48000 }, clips: [] },
};
const report = {
  passed: false,
  workerSha256,
  cases: [],
};
try {
  for (const [name, modify] of [
    [
      "invalid-video",
      (s) => {
        s.video.codec = "unsupported";
      },
    ],
    [
      "invalid-audio",
      (s) => {
        s.audio.sampleRate = 12345;
      },
    ],
  ]) {
    const settings = resolveOutputSettings();
    modify(settings);
    const response = await call("media.renderCompositionMovie", { ...request, settings });
    assert.equal(response.ok, false);
    assert.equal(response.error.code, "UNSUPPORTED_FORMAT");
    assert.deepEqual(
      await readdir(home),
      [],
      "Refusal must precede output creation and missing frame reads",
    );
    report.cases.push({ name, response });
  }
  report.passed = true;
} finally {
  try {
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ out, ...report }));
