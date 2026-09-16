import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, open, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
const out =
  process.env.SCREENREC_AUDIO_STREAM_EVIDENCE ??
  (await mkdtemp(join(tmpdir(), "screenrec-audio-stream-")));
assert.ok(isAbsolute(out));
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), []);
const executable = new URL("../.build/debug/ScreenRecorderAudioTests", import.meta.url).pathname;
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
async function hash(file, start, end) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file, start === undefined ? {} : { start, end }))
    hash.update(chunk);
  return hash.digest("hex");
}
async function wave(file) {
  const reader = await open(file);
  const header = Buffer.alloc(12);
  try {
    await reader.read(header, 0, 12, 0);
    assert.equal(header.toString("ascii", 0, 4), "RIFF");
    assert.equal(header.toString("ascii", 8, 12), "WAVE");
    const size = (await reader.stat()).size;
    let offset = 12,
      format,
      data;
    while (offset + 8 <= size) {
      const entry = Buffer.alloc(8);
      await reader.read(entry, 0, 8, offset);
      const length = entry.readUInt32LE(4),
        tag = entry.toString("ascii", 0, 4);
      assert.ok(offset + 8 + length <= size);
      if (tag === "fmt ") {
        format = Buffer.alloc(length);
        await reader.read(format, 0, length, offset + 8);
      }
      if (tag === "data") data = { start: offset + 8, bytes: length };
      offset += 8 + length + (length % 2);
    }
    assert.ok(format && data);
    assert.equal(format.readUInt16LE(0), 3);
    assert.equal(format.readUInt16LE(14), 32);
    return {
      format,
      ...data,
      channels: format.readUInt16LE(2),
      sampleRate: format.readUInt32LE(4),
    };
  } finally {
    await reader.close();
  }
}
const source = join(out, "source.mov");
run("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "aevalsrc=0.2*sin(2*PI*997*t)|0.2*sin(2*PI*1511*t):s=48000:d=300",
  "-c:a",
  "pcm_f32le",
  source,
]);
const before = await hash(source),
  scale = [];
for (const seconds of [10, 300]) {
  const report = JSON.parse(
    run(executable, [], {
      ...process.env,
      SCREENREC_AUDIO_EVIDENCE: out,
      SCREENREC_AUDIO_STREAM_SOURCE: source,
      SCREENREC_AUDIO_STREAM_SECONDS: String(seconds),
    }),
  );
  if (seconds === 300) assert.equal(report.canceledWaveRemoved, true);
  const file = join(out, `stream-${seconds}.wav`),
    info = await wave(file);
  assert.equal(info.sampleRate, 48000);
  assert.equal(info.channels, 2);
  assert.equal(info.bytes / 8, seconds * 48000 - 2816);
  assert.equal(report.frames, info.bytes / 8);
  const reader = await open(file);
  let maximumError = 0;
  try {
    for (const center of [0, 8092, 16384, Math.floor(report.frames / 2), report.frames - 100]) {
      const start = Math.max(0, center - 32),
        count = Math.min(64, report.frames - start),
        buffer = Buffer.alloc(count * 8);
      await reader.read(buffer, 0, buffer.length, info.start + start * 8);
      for (let i = 0; i < count; i++) {
        const frame = start + i,
          begin = frame < 8092 ? 0 : frame < 16384 ? 8092 : 16384;
        const end = frame < 8092 ? 8092 : frame < 16384 ? 16384 : report.frames;
        const sourceFrame =
          frame < 8092 ? frame : frame < 16384 ? frame - 8092 + 9600 : frame - 16384 + 19200;
        let gain = 1;
        if (begin > 0 && frame - begin < 240) gain = Math.fround((frame - begin) / 240);
        if (end < report.frames && end - 1 - frame < 240)
          gain = Math.fround((end - 1 - frame) / 240);
        for (const [channel, frequency] of [997, 1511].entries()) {
          const expected = Math.fround(
            Math.fround(0.2 * Math.sin((2 * Math.PI * frequency * sourceFrame) / 48000)) * gain,
          );
          maximumError = Math.max(
            maximumError,
            Math.abs(expected - buffer.readFloatLE(i * 8 + channel * 4)),
          );
        }
      }
    }
  } finally {
    await reader.close();
  }
  assert.ok(maximumError < 0.000001);
  scale.push({
    ...report,
    waveCancellationExercised: seconds >= 300,
    independentlyCountedFrames: info.bytes / 8,
    independentWindowMaximumError: maximumError,
  });
}
assert.ok(
  scale[1].peakNativeRSSBytes < scale[0].peakNativeRSSBytes * 1.5 + 16 * 1024 * 1024,
  "Native memory must not scale with retained output duration",
);
assert.equal(await hash(source), before);
const baseline = [];
if (process.env.SCREENREC_AUDIO_BASELINE) {
  const excerpts = join(out, "excerpts");
  await mkdir(excerpts);
  run(executable, [], { ...process.env, SCREENREC_AUDIO_EVIDENCE: excerpts });
  for (const entry of await readdir(process.env.SCREENREC_AUDIO_BASELINE, {
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".wav")) continue;
    const previous = join(process.env.SCREENREC_AUDIO_BASELINE, entry.name),
      current = join(excerpts, entry.name);
    const a = await wave(previous),
      b = await wave(current);
    assert.deepEqual(b.format, a.format);
    assert.equal(b.bytes, a.bytes);
    const pcmHash = await hash(current, b.start, b.start + b.bytes - 1);
    assert.equal(pcmHash, await hash(previous, a.start, a.start + a.bytes - 1));
    baseline.push({ file: entry.name, pcmBytes: b.bytes, pcmSha256: pcmHash, exact: true });
  }
  assert.ok(baseline.length > 0);
}
const report = { sourceSha256: before, sourceUnchanged: true, scale, baseline };
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, scale, baselineComparisons: baseline.length }, null, 2));
