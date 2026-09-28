import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const native =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));
const fixture =
  process.env.SCREENREC_SOURCE_AUDIO_FIXTURE ??
  fileURLToPath(new URL("../.build/debug/ScreenRecorderSourceAudioTests", import.meta.url));
test("source WAV wire delivery retains native fixture samples and refuses ambiguous selection", () => {
  const directory = mkdtempSync(join(tmpdir(), "source-audio-wire-"));
  try {
    const proof = spawnSync(fixture, [], {
      env: { ...process.env, SCREENREC_SOURCE_AUDIO_EVIDENCE: directory },
      encoding: "utf8",
      timeout: 120000,
    });
    assert.equal(proof.status, 0, proof.stdout + proof.stderr);
    for (const rate of [44100, 48000]) {
      const params = JSON.parse(readFileSync(join(directory, `request-${rate}.json`), "utf8"));
      const execute = (value) => {
        const result = spawnSync(native, [], {
          input:
            JSON.stringify({ id: "source", operation: "media.sourceAudio", params: value }) + "\n",
          encoding: "utf8",
          timeout: 30000,
        });
        assert.equal(result.status, 0, result.stderr);
        return JSON.parse(result.stdout);
      };
      const reply = execute(params);
      assert.equal(reply.ok, true, JSON.stringify(reply));
      assert.equal(reply.data.sampleRate, rate);
      assert.equal(reply.data.channels, 2);
      assert.equal(reply.data.layout, "stereo");
      assert.equal(reply.data.frames, rate);
      assert.deepEqual(reply.data.sampleRange, { start: 0, end: rate });
      assert.deepEqual(
        readFileSync(params.output),
        readFileSync(join(directory, `full-${rate}.wav`)),
      );
      assert.equal(execute(params).error.code, "INVALID_OUTPUT");
      const ambiguous = structuredClone(params);
      delete ambiguous.source.streamId;
      ambiguous.output = join(directory, `ambiguous-${rate}.wav`);
      assert.equal(execute(ambiguous).error.code, "INVALID_REQUEST");
      assert.equal(execute({ ...params, unexpected: true }).error.code, "INVALID_REQUEST");
    }
    assert.deepEqual(
      readdirSync(directory).filter((name) => name.startsWith(".screenrec-output-")),
      [],
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
