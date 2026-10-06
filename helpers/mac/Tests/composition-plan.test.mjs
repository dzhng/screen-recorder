import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
const native =
  process.env.YAP_NATIVE ??
  fileURLToPath(new URL("../.build/debug/yap-native", import.meta.url));

test("file-backed composition plans retain typed validation and exact native audio", () => {
  const directory = mkdtempSync(join(tmpdir(), "composition-plan-"));
  const execute = (params) => {
    const result = spawnSync(native, [], {
      input: JSON.stringify({ id: "plan", operation: "media.mixCompositionAudio", params }) + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    return JSON.parse(result.stdout);
  };
  const plan = {
    output: join(directory, "inline.wav"),
    range: { start: 0, end: 48 },
    clips: [
      {
        clipId: "silence",
        trackId: "audio",
        sampleRange: { start: 0, end: 48 },
        placement: { startUs: 0, endUs: 1000 },
        source: { kind: "silence" },
        context: [],
        pitch: "preserve",
        available: [{ start: 0, end: 48 }],
      },
    ],
    processing: [
      { target: { kind: "clip", id: "silence" }, mediaKind: "audio", inputs: [], steps: [] },
    ],
    assets: [],
  };
  try {
    assert.equal(execute(plan).ok, true);
    const planFile = join(directory, "plan.json");
    plan.output = join(directory, "file.wav");
    writeFileSync(planFile, JSON.stringify(plan));
    const delivered = execute({ planFile });
    assert.equal(delivered.ok, true, JSON.stringify(delivered));
    assert.deepEqual(readFileSync(plan.output), readFileSync(join(directory, "inline.wav")));
    assert.equal(execute({ planFile, output: plan.output }).error.code, "INVALID_REQUEST");
    writeFileSync(planFile, JSON.stringify({ ...plan, unexpected: true }));
    assert.equal(execute({ planFile }).error.code, "INVALID_REQUEST");
    const link = join(directory, "link.json");
    symlinkSync(planFile, link);
    assert.equal(execute({ planFile: link }).error.code, "INVALID_REQUEST");
    assert.equal(execute({ planFile: directory }).error.code, "INVALID_REQUEST");
    writeFileSync(planFile, "{}");
    truncateSync(planFile, 64 * 1024 ** 2 + 1);
    assert.equal(execute({ planFile }).error.code, "INVALID_REQUEST");
    plan.output = join(directory, "large.wav");
    plan.processing[0].steps = Array.from({ length: 7000 }, (_, i) => ({
      id: `${"g".repeat(100)}${i}`,
      enabled: true,
      processor: { type: "gain", gain: 1 },
    }));
    const data = JSON.stringify(plan);
    assert.ok(Buffer.byteLength(data) > 1024 ** 2);
    writeFileSync(planFile, data);
    const large = execute({ planFile });
    assert.equal(large.ok, true, JSON.stringify(large));
    assert.deepEqual(readFileSync(plan.output), readFileSync(join(directory, "inline.wav")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
