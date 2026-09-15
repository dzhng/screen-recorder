import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const executable =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));

function tone(path, frequency) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${frequency}:sample_rate=48000:duration=2`,
      "-c:a",
      "pcm_f32le",
      path,
    ],
    { encoding: "utf8", timeout: 15000 },
  );
  assert.equal(result.status, 0, result.stderr);
}

test("audio worker writes a concatenated excerpt and survives invalid requests", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-audio-wire-"));
  try {
    const narration = join(directory, "narration.mov");
    const system = join(directory, "system.mov");
    tone(narration, 1000);
    tone(system, 400);
    const before = readFileSync(narration);
    const output = join(directory, "excerpt.wav");
    const params = {
      output,
      spans: [
        { startUs: 200000, endUs: 400000 },
        { startUs: 1000000, endUs: 1300000 },
      ],
      tracks: [{ role: "narration", source: narration, sourceOffsetUs: 0 }],
    };
    const requests = [
      { ...params, spans: [{ startUs: 0, endUs: 100000, extra: true }] },
      { ...params, spans: [{ startUs: true, endUs: 100000 }] },
      { ...params, tracks: [{ ...params.tracks[0], extra: true }] },
      { ...params, tracks: [{ ...params.tracks[0], role: "music" }] },
      { ...params, extra: true },
      { ...params, output: "excerpt.wav" },
      { ...params, output: join(directory, "excerpt.caf") },
      { ...params, output: narration },
      { ...params, spans: [{ startUs: 0, endUs: 30000001 }] },
      {
        ...params,
        tracks: [params.tracks[0], { role: "system", source: system, sourceOffsetUs: 250000 }],
      },
      params,
    ].map((params, id) => ({ id: String(id), operation: "media.audio", params }));
    // Int64.min cannot survive a JavaScript number, so this request is written as raw JSON.
    const extremeOffset = `{"id":"offset","operation":"media.audio","params":{"output":${JSON.stringify(
      output,
    )},"spans":[{"startUs":0,"endUs":1000}],"tracks":[{"role":"narration","source":${JSON.stringify(
      narration,
    )},"sourceOffsetUs":-9223372036854775808}]}}`;
    requests.push({ id: "ping", operation: "system.ping", params: {} });

    const run = spawnSync(executable, [], {
      input:
        [
          ...requests.slice(0, -1).map((value) => JSON.stringify(value)),
          extremeOffset,
          JSON.stringify(requests.at(-1)),
        ].join("\n") + "\n",
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(run.status, 0, run.stderr);
    const replies = run.stdout.trim().split("\n").map(JSON.parse);
    for (const [index, code] of [
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_OUTPUT",
      "INVALID_OUTPUT",
      "INVALID_OUTPUT",
      "LIMIT_EXCEEDED",
    ].entries()) {
      assert.equal(replies[index].id, String(index));
      assert.equal(replies[index].ok, false);
      assert.equal(
        replies[index].error.code,
        code,
        `request ${index}: ${replies[index].error.message}`,
      );
    }

    const mixed = replies[9];
    assert.equal(mixed.ok, true, JSON.stringify(mixed.error));
    assert.deepEqual(
      mixed.data.tracks.map((track) => [track.role, track.gain]),
      [
        ["narration", 0.5],
        ["system", 0.5],
      ],
    );
    // The system track starts 250 ms into the recording, so the excerpt's first span opens before
    // it has any media.
    assert.deepEqual(mixed.data.tracks[1].unavailable, [{ startUs: 200000, endUs: 250000 }]);

    const excerpt = replies[10];
    assert.equal(excerpt.ok, true, JSON.stringify(excerpt.error));
    assert.equal(excerpt.data.sampleRate, 48000);
    assert.equal(excerpt.data.channels, 1);
    assert.equal(excerpt.data.frames, 24000);
    assert.equal(excerpt.data.durationUs, 500000);
    assert.equal(excerpt.data.mediaType, "audio/wav");
    assert.deepEqual(excerpt.data.tracks[0].unavailable, []);

    const wave = readFileSync(output);
    assert.equal(excerpt.data.bytes, wave.length);
    assert.equal(wave.subarray(0, 4).toString("latin1"), "RIFF");
    assert.equal(wave.subarray(8, 12).toString("latin1"), "WAVE");
    let offset = 12;
    let audio;
    while (offset + 8 <= wave.length) {
      const id = wave.subarray(offset, offset + 4).toString("latin1");
      const size = wave.readUInt32LE(offset + 4);
      if (id === "fmt ") {
        assert.equal(wave.readUInt16LE(offset + 8), 3, "IEEE float samples");
        assert.equal(wave.readUInt16LE(offset + 10), 1);
        assert.equal(wave.readUInt32LE(offset + 12), 48000);
        assert.equal(wave.readUInt16LE(offset + 22), 32);
      } else if (id === "data") {
        audio = wave.subarray(offset + 8, offset + 8 + size);
      }
      offset += 8 + size + (size % 2);
    }
    assert.equal(audio.length, 24000 * 4);

    // Independently decoded source samples: the excerpt must hold exactly these, in the order its
    // spans name, with the 5 ms ramps only around the single join.
    const decoded = spawnSync(
      "ffmpeg",
      ["-v", "error", "-i", narration, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
      { timeout: 15000, maxBuffer: 1 << 28 },
    );
    assert.equal(decoded.status, 0, String(decoded.stderr));
    const source = (frame) => decoded.stdout.readFloatLE(frame * 4);
    const excerptSample = (frame) => audio.readFloatLE(frame * 4);
    let sourcePeak = 0;
    for (let frame = 9600; frame < 62400; frame += 1)
      sourcePeak = Math.max(sourcePeak, Math.abs(source(frame)));
    assert.ok(sourcePeak > 0.05, `fixture must carry signal, peak ${sourcePeak}`);
    const ramp = 240;
    for (let offset = 0; offset < 9600 - ramp; offset += 97) {
      assert.ok(
        Math.abs(excerptSample(offset) - source(9600 + offset)) < 1e-6,
        `frame ${offset} must hold source frame ${9600 + offset}`,
      );
    }
    for (let offset = ramp; offset < 14400; offset += 97) {
      assert.ok(
        Math.abs(excerptSample(9600 + offset) - source(48000 + offset)) < 1e-6,
        `frame ${9600 + offset} must hold source frame ${48000 + offset}`,
      );
    }
    assert.equal(Math.abs(excerptSample(9599)), 0);
    assert.equal(Math.abs(excerptSample(9600)), 0);

    // An offset no arithmetic can negate must be refused, and must not take the worker down with
    // it: the ping after it proves the process is still answering.
    assert.equal(replies[11].id, "offset");
    assert.equal(replies[11].error.code, "INVALID_RANGE", JSON.stringify(replies[11]));
    assert.deepEqual(replies[12], { id: "ping", ok: true, data: { platform: "macos" } });
    assert.deepEqual(readFileSync(narration), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
