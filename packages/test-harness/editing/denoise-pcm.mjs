import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { open, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { waveHeader } from "./audio-project-fixture.mjs";
import { run } from "./source-evidence-fixture.mjs";

/** The frozen independent C recipe, retaining each lane's input and uncompensated output. */
export async function referenceLanes(reference, inputs, frames, out) {
  assert.equal(
    createHash("sha256")
      .update(await readFile(reference))
      .digest("hex"),
    "697657e249b178c415d379511ba4041687055c7cf5d347af80a2d3a08cb6c5ee",
  );
  const outputs = [];
  for (let channel = 0; channel < 2; channel++) {
    const output = join(out, `reference-${channel}-raw.f32`);
    await run(reference, [inputs[channel], output, "2"], { timeout: 3600000 });
    assert.equal((await stat(output)).size, (Math.ceil(frames / 480) * 480 + 960) * 4);
    outputs.push(output);
  }
  return outputs;
}

/** Exact whole-output comparison with bounded diagnostics and bounded read buffers. */
export async function compareWavePCM(wav, frames, expectedPaths, firstExpectedFrame = 0) {
  const files = [],
    pcmHash = createHash("sha256");
  try {
    for (const path of [wav, ...expectedPaths]) files.push(await open(path, "r"));
    const headerBytes = Buffer.alloc(4096);
    await files[0].read(headerBytes, 0, headerBytes.length, 0);
    const header = waveHeader(headerBytes, (await files[0].stat()).size);
    assert.equal(header.frames, frames);
    const actual = Buffer.alloc(8192 * 8),
      expected = Buffer.alloc(8192 * 8),
      lanes = [Buffer.alloc(8192 * 4), Buffer.alloc(8192 * 4)];
    for (let start = 0; start < frames; start += 8192) {
      const count = Math.min(8192, frames - start),
        bytes = count * 8;
      assert.equal(
        (await files[0].read(actual, 0, bytes, header.offset + start * 8)).bytesRead,
        bytes,
      );
      if (expectedPaths.length === 1) {
        assert.equal((await files[1].read(expected, 0, bytes, start * 8)).bytesRead, bytes);
      } else {
        for (let channel = 0; channel < 2; channel++) {
          assert.equal(
            (
              await files[channel + 1].read(
                lanes[channel],
                0,
                count * 4,
                (firstExpectedFrame + start + 960) * 4,
              )
            ).bytesRead,
            count * 4,
          );
          for (let frame = 0; frame < count; frame++)
            lanes[channel].copy(expected, frame * 8 + channel * 4, frame * 4, frame * 4 + 4);
        }
      }
      if (!actual.subarray(0, bytes).equals(expected.subarray(0, bytes))) {
        let byte = 0;
        while (byte < bytes && actual[byte] === expected[byte]) byte++;
        assert.fail(
          JSON.stringify({
            wav,
            firstDifferentFrame: start + Math.floor(byte / 8),
            channel: Math.floor(byte / 4) % 2,
            actualBits: actual.readUInt32LE(Math.floor(byte / 4) * 4),
            expectedBits: expected.readUInt32LE(Math.floor(byte / 4) * 4),
          }),
        );
      }
      pcmHash.update(actual.subarray(0, bytes));
    }
    return pcmHash.digest("hex");
  } finally {
    for (const file of files) await file.close();
  }
}

export async function writeDryReference(blocks, out) {
  const paths = [
      join(out, "independent-dry.f32"),
      ...[0, 1].map((c) => join(out, `reference-${c}-input.f32`)),
    ],
    files = [],
    digest = createHash("sha256");
  let frames = 0;
  try {
    for (const path of paths) files.push(await open(path, "wx"));
    for (const bytes of blocks) {
      assert.equal((await files[0].write(bytes)).bytesWritten, bytes.length);
      digest.update(bytes);
      frames += bytes.length / 8;
      for (let channel = 0; channel < 2; channel++) {
        const lane = Buffer.alloc(bytes.length / 2);
        for (let i = 0; i < bytes.length / 8; i++)
          bytes.copy(lane, i * 4, i * 8 + channel * 4, i * 8 + channel * 4 + 4);
        assert.equal((await files[channel + 1].write(lane)).bytesWritten, lane.length);
      }
    }
  } finally {
    for (const file of files) await file.close();
  }
  return { dry: paths[0], inputs: paths.slice(1), frames, sha256: digest.digest("hex") };
}
