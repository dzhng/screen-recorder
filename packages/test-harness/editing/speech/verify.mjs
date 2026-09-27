import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
const folder = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(join(folder, "manifest.json")));
function pcm(name) {
  const path = join(folder, name + ".wav");
  const clip = manifest.clips.find((c) => c.id === name);
  assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), clip.sha256);
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-nostdin", "-i", path, "-f", "f32le", "-c:a", "pcm_f32le", "-"],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr?.toString());
  return Array.from({ length: result.stdout.length / 4 }, (_, i) =>
    result.stdout.readFloatLE(i * 4),
  );
}
const result = [];
for (const clip of manifest.clips.filter((c) => c.id.endsWith("-candidate-cut"))) {
  const base = clip.id.slice(0, -"-candidate-cut".length);
  const a = pcm(base + "-original"),
    b = pcm(clip.id);
  const receipt = JSON.parse(readFileSync(join(folder, clip.id + "-response.json"))).data;
  assert.equal(receipt.channels, 1);
  const rate = receipt.sampleRate;
  const first = Math.round(((clip.spans[0].endUs - clip.spans[0].startUs) * rate) / 1e6);
  const removed = Math.round(((clip.spans[1].startUs - clip.spans[0].endUs) * rate) / 1e6);
  const ramp = Math.round(0.005 * rate);
  assert.equal(b.length, a.length - removed);
  assert.deepEqual(b.slice(ramp, first - ramp), a.slice(ramp, first - ramp));
  assert.deepEqual(b.slice(first + ramp, -ramp), a.slice(first + removed + ramp, -ramp));
  result.push({
    id: base,
    originalFrames: a.length,
    cutFrames: b.length,
    removedFrames: removed,
    joinFrame: first,
    ignoredJoinRampFrames: ramp,
  });
}
console.log(
  JSON.stringify(
    {
      checks: result,
      meaning:
        "Hashes and exact retained PCM outside5ms native ramps; no claim about protected words or listening.",
    },
    null,
    2,
  ),
);
