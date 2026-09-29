import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Frozen independent C recipe; retain raw files before exact compensation/interleaving. */
export function createDenoiseReference(reference, out) {
  assert.equal(
    createHash("sha256").update(readFileSync(reference)).digest("hex"),
    "697657e249b178c415d379511ba4041687055c7cf5d347af80a2d3a08cb6c5ee",
  );
  return (name, pcm, channels = 1) => {
    assert(channels === 1 || channels === 2);
    assert.equal(pcm.length % (channels * 4), 0);
    const frames = pcm.length / channels / 4,
      result = Buffer.alloc(pcm.length);
    for (let channel = 0; channel < channels; channel++) {
      const lane = Buffer.alloc(frames * 4);
      for (let i = 0; i < frames; i++)
        pcm.copy(lane, i * 4, (i * channels + channel) * 4, (i * channels + channel + 1) * 4);
      const label = channels === 1 ? name : `${name}-lane-${channel}`;
      const input = join(out, label + "-input.f32"),
        output = join(out, label + "-raw.f32");
      writeFileSync(input, lane);
      const process = spawnSync(reference, [input, output, "2"], { timeout: 30000 });
      assert.equal(process.status, 0, process.stderr?.toString());
      const raw = readFileSync(output);
      assert.equal(raw.length, (Math.ceil(frames / 480) * 480 + 960) * 4);
      for (let i = 0; i < frames; i++)
        raw.copy(result, (i * channels + channel) * 4, (i + 960) * 4, (i + 961) * 4);
    }
    return result;
  };
}
