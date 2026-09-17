import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, truncateSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const executable =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));

function tone(path, frequency, seconds = 2) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${frequency}:sample_rate=48000:duration=${seconds}`,
      "-c:a",
      "pcm_f32le",
      path,
    ],
    { encoding: "utf8", timeout: 15000 },
  );
  assert.equal(result.status, 0, result.stderr);
}

/// The excerpt's own chunks, read without the writer's help.
function wave(bytes) {
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("latin1"), "WAVE");
  let offset = 12;
  let format;
  let audio;
  while (offset + 8 <= bytes.length) {
    const id = bytes.subarray(offset, offset + 4).toString("latin1");
    const size = bytes.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      format = {
        tag: bytes.readUInt16LE(offset + 8),
        channels: bytes.readUInt16LE(offset + 10),
        sampleRate: bytes.readUInt32LE(offset + 12),
        bits: bytes.readUInt16LE(offset + 22),
      };
    } else if (id === "data") {
      audio = bytes.subarray(offset + 8, offset + 8 + size);
    }
    offset += 8 + size + (size % 2);
  }
  return { format, audio };
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
      tracks: [
        {
          role: "narration",
          source: narration,
          sourceOffsetUs: 0,
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    };
    const requests = [
      { ...params, spans: [{ startUs: 0, endUs: 100000, extra: true }] },
      { ...params, spans: [{ startUs: true, endUs: 100000 }] },
      { ...params, tracks: [{ ...params.tracks[0], extra: true }] },
      { ...params, tracks: [{ ...params.tracks[0], role: "music" }] },
      { ...params, extra: true },
      { ...params, output: "relative.wav" },
      { ...params, output: directory },
      { ...params, output: narration },
      { ...params, spans: [{ startUs: 0, endUs: 30000001 }] },
      // Acquisition evidence is required and is shaped like everything else on this wire: a plan
      // that omits it, mistypes it or misorders it is refused rather than answered from the file.
      {
        ...params,
        tracks: [{ role: "narration", source: narration, sourceOffsetUs: 0 }],
      },
      {
        ...params,
        tracks: [{ ...params.tracks[0], available: [{ startUs: 0, endUs: 1000, extra: true }] }],
      },
      { ...params, tracks: [{ ...params.tracks[0], available: 1000 }] },
      {
        ...params,
        tracks: [{ ...params.tracks[0], available: [{ startUs: 900000, endUs: 400000 }] }],
      },
      {
        ...params,
        output: join(directory, "mixed.wav"),
        tracks: [
          params.tracks[0],
          {
            role: "system",
            source: system,
            sourceOffsetUs: 250000,
            available: [{ startUs: 250000, endUs: 2250000 }],
          },
        ],
      },
      params,
    ].map((params, id) => ({ id: String(id), operation: "media.audio", params }));
    // Int64.min cannot survive a JavaScript number, so this request is written as raw JSON.
    const extremeOffset = `{"id":"offset","operation":"media.audio","params":{"output":${JSON.stringify(
      output,
    )},"spans":[{"startUs":0,"endUs":1000}],"tracks":[{"role":"narration","source":${JSON.stringify(
      narration,
    )},"sourceOffsetUs":-9223372036854775808,"available":[{"startUs":0,"endUs":2000000}]}]}}`;
    requests.push({ id: "ping", operation: "system.ping", params: {} });

    const run = spawnSync(executable, [], {
      input:
        [
          ...requests.slice(0, -1).map((value) => JSON.stringify(value)),
          extremeOffset,
          JSON.stringify(requests.at(-1)),
        ].join("\n") + "\n",
      cwd: directory,
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(run.status, 0, run.stderr);
    // A refused relative output never lands beside the worker's working directory either.
    assert.equal(existsSync(join(directory, "relative.wav")), false);
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
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_RANGE",
    ].entries()) {
      assert.equal(replies[index].id, String(index));
      assert.equal(replies[index].ok, false);
      assert.equal(
        replies[index].error.code,
        code,
        `request ${index}: ${replies[index].error.message}`,
      );
    }

    const mixed = replies[13];
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

    const excerpt = replies[14];
    assert.equal(excerpt.ok, true, JSON.stringify(excerpt.error));
    assert.equal(excerpt.data.sampleRate, 48000);
    assert.equal(excerpt.data.channels, 1);
    assert.equal(excerpt.data.frames, 24000);
    assert.equal(excerpt.data.durationUs, 500000);
    assert.equal(excerpt.data.mediaType, "audio/wav");
    assert.deepEqual(excerpt.data.tracks[0].unavailable, []);

    const bytes = readFileSync(output);
    assert.equal(excerpt.data.bytes, bytes.length);
    // A new output path is the contract: repeating the request never replaces what is there.
    const replay = spawnSync(executable, [], {
      input: JSON.stringify({ id: "replay", operation: "media.audio", params }) + "\n",
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(JSON.parse(replay.stdout).error.code, "INVALID_OUTPUT");
    assert.deepEqual(readFileSync(output), bytes);
    assert.deepEqual(
      readdirSync(directory).filter((name) => name.startsWith(".")),
      [],
    );
    const { format, audio } = wave(bytes);
    assert.deepEqual(format, { tag: 3, channels: 1, sampleRate: 48000, bits: 32 });
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
    assert.equal(replies[15].id, "offset");
    assert.equal(replies[15].error.code, "INVALID_RANGE", JSON.stringify(replies[15]));
    assert.deepEqual(replies[16], { id: "ping", ok: true, data: { platform: "macos" } });
    assert.deepEqual(readFileSync(narration), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a thousand fractional spans keep the duration the plan asked for", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-audio-rounding-"));
  try {
    const source = join(directory, "long.mov");
    tone(source, 1000, 20);
    const output = join(directory, "many-cuts.wav");
    // 10010 us is 480.48 frames at 48 kHz. Quantising each span on its own drops that fraction a
    // thousand times over and answers a 10.01 second plan with 10 seconds of audio.
    const spans = Array.from({ length: 1000 }, (unused, index) => ({
      startUs: index * 20000,
      endUs: index * 20000 + 10010,
    }));
    const request = {
      id: "many-cuts",
      operation: "media.audio",
      params: {
        output,
        spans,
        tracks: [
          {
            role: "narration",
            source,
            sourceOffsetUs: 0,
            available: [{ startUs: 0, endUs: 20000000 }],
          },
        ],
      },
    };
    const run = spawnSync(executable, [], {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 1 << 26,
    });
    assert.equal(run.status, 0, run.stderr);
    const reply = JSON.parse(run.stdout.trim());
    assert.equal(reply.ok, true, JSON.stringify(reply.error));
    assert.equal(reply.data.frames, 480480);
    assert.equal(reply.data.durationUs, 10010000);
    assert.deepEqual(reply.data.tracks[0].unavailable, []);

    // What the worker reports and what it wrote are the same excerpt.
    const bytes = readFileSync(output);
    const { format, audio } = wave(bytes);
    assert.deepEqual(format, { tag: 3, channels: 1, sampleRate: 48000, bits: 32 });
    assert.equal(audio.length, 480480 * 4);
    assert.equal(reply.data.bytes, bytes.length);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("audio worker writes WAVE bytes to an opaque derivative path", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-audio-cache-"));
  try {
    const source = join(directory, "narration.mov");
    tone(source, 440, 0.2);
    const output = join(directory, "opaque.cache");
    const run = spawnSync(executable, [], {
      input:
        JSON.stringify({
          id: "opaque",
          operation: "media.audio",
          params: {
            output,
            spans: [{ startUs: 0, endUs: 100000 }],
            tracks: [
              {
                role: "narration",
                source,
                sourceOffsetUs: 0,
                available: [{ startUs: 0, endUs: 200000 }],
              },
            ],
          },
        }) + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(run.status, 0, run.stderr);
    const response = JSON.parse(run.stdout);
    assert.equal(response.ok, true, JSON.stringify(response));
    assert.equal(response.data.mediaType, "audio/wav");
    const decoded = wave(readFileSync(output));
    assert.equal(decoded.format.tag, 3);
    assert.equal(decoded.format.sampleRate, 48000);
    assert.equal(decoded.audio.length, 4800 * 4);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("audio decode failure permits explicit retry while invalid plans remain terminal", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-audio-errors-"));
  try {
    const params = {
      output: join(directory, "excerpt.wav"),
      spans: [{ startUs: 0, endUs: 100000 }],
      tracks: [
        {
          role: "narration",
          source: join(directory, "absent.mov"),
          sourceOffsetUs: 0,
          available: [{ startUs: 0, endUs: 100000 }],
        },
      ],
    };
    const run = spawnSync(executable, [], {
      input:
        [params, { ...params, spans: [] }]
          .map((params, index) =>
            JSON.stringify({ id: String(index), operation: "media.audio", params }),
          )
          .join("\n") + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(run.status, 0, run.stderr);
    const replies = run.stdout.trim().split("\n").map(JSON.parse);
    assert.deepEqual(
      replies.map((reply) => [reply.ok, reply.error.code, reply.error.retryable]),
      [
        [false, "NATIVE_DECODE_FAILED", true],
        [false, "INVALID_RANGE", false],
      ],
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("AAC source priming is removed before offset placement in streamed PCM", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-audio-priming-"));
  try {
    const pcm = join(directory, "source.mov"),
      source = join(directory, "source.m4a");
    tone(pcm, 1000, 2);
    const encode = spawnSync("ffmpeg", ["-v", "error", "-i", pcm, "-c:a", "aac", source], {
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(encode.status, 0, encode.stderr);
    const original = readFileSync(source),
      output = join(directory, "primed.wav");
    const params = {
      output,
      spans: [{ startUs: 0, endUs: 2125000 }],
      tracks: [
        {
          role: "narration",
          source,
          sourceOffsetUs: 125000,
          available: [{ startUs: 125000, endUs: 2125000 }],
        },
      ],
    };
    const rendered = spawnSync(executable, [], {
      input: JSON.stringify({ id: "priming", operation: "media.audio", params }) + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(rendered.status, 0, rendered.stderr);
    const receipt = JSON.parse(rendered.stdout);
    assert.equal(receipt.ok, true, rendered.stdout);
    assert.equal(receipt.data.frames, 102000);
    const actual = wave(readFileSync(output)).audio;
    const decoded = spawnSync(
      "ffmpeg",
      ["-v", "error", "-i", source, "-t", "2", "-f", "f32le", "-"],
      { timeout: 15000, maxBuffer: 1024 * 1024 },
    );
    assert.equal(decoded.status, 0, decoded.stderr.toString());
    assert.equal(decoded.stdout.length, 96000 * 4);
    assert.equal(actual.length, 102000 * 4);
    for (let i = 0; i < 6000; i++) assert.equal(actual.readFloatLE(i * 4), 0);
    // Independent AAC decoders differ slightly; stay below one 16-bit PCM step.
    // A one-sample offset in this fixture disagrees by over 0.01 RMS.
    let squared = 0;
    for (let i = 0; i < 96000; i++)
      squared += (actual.readFloatLE((i + 6000) * 4) - decoded.stdout.readFloatLE(i * 4)) ** 2;
    assert.ok(
      Math.sqrt(squared / 96000) < 1 / 32768,
      `AAC PCM RMS disagreement ${Math.sqrt(squared / 96000)}`,
    );
    assert.deepEqual(receipt.data.tracks[0].unavailable, [{ startUs: 0, endUs: 125000 }]);
    assert.deepEqual(readFileSync(source), original);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("midstream source failure leaves no completed WAVE or staging output", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-audio-truncated-"));
  try {
    const source = join(directory, "truncated.mov"),
      output = join(directory, "output.wav");
    const fixture = spawnSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=1000:sample_rate=48000:duration=2",
        "-c:a",
        "pcm_f32le",
        "-movflags",
        "faststart",
        source,
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.equal(fixture.status, 0, fixture.stderr);
    truncateSync(source, readFileSync(source).length - 5000);
    const before = readFileSync(source);
    const params = {
      output,
      spans: [{ startUs: 0, endUs: 2000000 }],
      tracks: [
        {
          role: "narration",
          source,
          sourceOffsetUs: 0,
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    };
    const result = spawnSync(executable, [], {
      input: JSON.stringify({ id: "truncated", operation: "media.audio", params }) + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).error.code, "NATIVE_DECODE_FAILED");
    assert.equal(existsSync(output), false);
    assert.deepEqual(readdirSync(directory), ["truncated.mov"]);
    assert.deepEqual(readFileSync(source), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
