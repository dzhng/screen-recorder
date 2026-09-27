import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { classify, mask } from "./render-membership.mjs";

const black = Buffer.alloc(160 * 128 * 3);
const counter = Buffer.from(black);
counter.fill(255, 0, 3);
const references = [
  { id: "black", mask: mask(black) },
  { id: "counter", mask: mask(counter) },
];

test("empty-edit membership rejects colored frames with no white counter", () => {
  for (const rgb of [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 80],
  ]) {
    const frame = Buffer.from(black);
    for (let pixel = 0; pixel < frame.length; pixel += 3) frame.set(rgb, pixel);
    assert.notEqual(classify(frame, references).id, "black", `${rgb} is not an empty black frame`);
  }
});

test("empty-edit membership accepts the actual frozen black output", () => {
  const file = fileURLToPath(
    new URL(
      "../../../specs/agent-editing/assets/06-render/empty-edit/bounded-at-250000.png",
      import.meta.url,
    ),
  );
  const decoded = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"],
    { timeout: 15000 },
  );
  assert.equal(decoded.status, 0, String(decoded.stderr));
  assert.deepEqual(decoded.stdout, black);
  assert.equal(classify(decoded.stdout, references).id, "black");
});
