import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { resolveOutputSettings } from "../../composition/dist/index.js";
import { mediaWorker } from "../../../apps/service/dist/worker.js";
const home = await mkdtemp("/tmp/sr-preflight-");
const worker = process.env.SCREENREC_NATIVE;
assert(worker);
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
  workerSha256: createHash("sha256")
    .update(await readFile(worker))
    .digest("hex"),
  cases: [],
};
for (const [name, modify, message] of [
  [
    "invalid-video",
    (s) => {
      s.video.codec = "unsupported";
    },
    /Unsupported video encoding settings/,
  ],
  [
    "invalid-audio",
    (s) => {
      s.audio.sampleRate = 12345;
    },
    /Unsupported AAC output settings/,
  ],
]) {
  const settings = resolveOutputSettings();
  modify(settings);
  const response = await call("media.renderCompositionMovie", { ...request, settings });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "UNSUPPORTED_FORMAT");
  assert.match(response.error.message, message);
  assert.deepEqual(
    await readdir(home),
    [],
    "Refusal must precede output creation and missing frame reads",
  );
  report.cases.push({ name, response });
}
await writeFile(join(home, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, home, ...report }));
