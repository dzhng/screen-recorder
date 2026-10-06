import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  openSync,
  closeSync,
  fstatSync,
  truncateSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { waveHeader } from "../../../packages/test-harness/editing/audio-project-fixture.mjs";
const native =
  process.env.YAP_NATIVE ??
  fileURLToPath(new URL("../.build/debug/yap-native", import.meta.url));
test("retained PCM preserves exact frames across blocks and refuses malformed or changed operands", () => {
  const dir = mkdtempSync(join(tmpdir(), "retained-pcm-"));
  const file = join(dir, "retained.wav");
  const frames = 20000,
    bytes = Buffer.alloc(44 + frames * 8);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(384000, 28);
  bytes.writeUInt16LE(8, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 8, 40);
  for (let i = 0; i < frames; i++) {
    bytes.writeFloatLE(((i % 257) - 128) / 256, 44 + i * 8);
    bytes.writeFloatLE(((i % 127) - 63) / 128, 48 + i * 8);
  }
  writeFileSync(file, bytes);
  const fd = openSync(file, "r"),
    info = fstatSync(fd, { bigint: true });
  const range = { start: 37, end: 19001 };
  const retained = {
    descriptor: 3,
    identity: {
      device: String(info.dev),
      inode: String(info.ino),
      modifiedNs: String(info.mtimeNs),
      changedNs: String(info.ctimeNs),
    },
    bytes: bytes.length,
    dataOffset: 44,
    frames,
    range,
    unavailable: [],
  };
  let ordinal = 0;
  const execute = (operand) => {
    const output = join(dir, `result-${ordinal++}.wav`);
    const r = spawnSync(native, [], {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe", fd],
      input:
        JSON.stringify({
          id: "retained",
          operation: "media.mixCompositionAudio",
          params: { output, range, clips: [], processing: [], assets: [], retained: operand },
        }) + "\n",
    });
    assert.equal(r.status, 0, r.stderr || String(r.error));
    return { reply: JSON.parse(r.stdout), output };
  };
  try {
    const good = execute(retained);
    assert.equal(good.reply.ok, true, JSON.stringify(good.reply));
    const result = readFileSync(good.output);
    assert.deepEqual(
      result.subarray(waveHeader(result, result.length).offset),
      bytes.subarray(44 + range.start * 8, 44 + range.end * 8),
    );
    for (const operand of [
      "invalid",
      { ...retained, frames: frames + 1 },
      { ...retained, range: { start: 38, end: 19001 } },
      { ...retained, identity: { ...retained.identity, inode: "0" } },
    ]) {
      assert.equal(execute(operand).reply.ok, false);
    }
    truncateSync(file, bytes.length - 8);
    assert.equal(execute(retained).reply.error.code, "ARTIFACT_CHANGED");
  } finally {
    closeSync(fd);
    rmSync(dir, { recursive: true, force: true });
  }
});
