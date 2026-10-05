import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { parseLoudnessSummary } from "../../../../apps/service/dist/loudness.js";
const [ffmpeg, oracle, destination] = process.argv.slice(2);
assert.ok(ffmpeg && oracle && destination, "Expected FFMPEG ORACLE NEW_DESTINATION");
const out = resolve(destination);
await mkdir(out);
const run = promisify(execFile),
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const protocol = JSON.parse(
  await readFile(
    new URL(
      "../../../../specs/ffmpeg-parity/evidence/loudness/frozen-protocol.json",
      import.meta.url,
    ),
  ),
);
const cases = [
  {
    id: "heldout-stereo-44100",
    rate: 44100,
    channels: 2,
    seconds: 9,
    sample: (t, c) =>
      (c ? 0.07 : 0.11) *
      (Math.sin(2 * Math.PI * 733 * t) + 0.23 * Math.sin(2 * Math.PI * 4117 * t)),
  },
  {
    id: "heldout-stepped-48000",
    rate: 48000,
    channels: 1,
    seconds: 12,
    sample: (t) =>
      (t < 4 ? 0.08 : t < 8 ? 0.02 : 0.15) *
      (Math.sin(2 * Math.PI * 997 * t) + 0.2 * Math.sin(2 * Math.PI * 233 * t)),
  },
];
const records = [];
for (const item of cases) {
  const frames = item.rate * item.seconds,
    pcm = Buffer.alloc(frames * item.channels * 4);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < item.channels; c++) {
      const t = i / item.rate,
        taper = Math.min(1, t / 0.1, (item.seconds - t - 1 / item.rate) / 0.1);
      pcm.writeFloatLE(item.sample(t, c) * taper, (i * item.channels + c) * 4);
    }
  const source = join(out, item.id + ".f32");
  await writeFile(source, pcm, { flag: "wx" });
  const baseline = await run(oracle, [source, String(item.channels), String(item.rate)]);
  const result = await run(ffmpeg, [
    "-hide_banner",
    "-nostats",
    "-nostdin",
    "-f",
    "f32le",
    "-ar",
    String(item.rate),
    "-ac",
    String(item.channels),
    "-i",
    source,
    "-af",
    "ebur128=peak=sample+true:framelog=quiet:dualmono=false",
    "-f",
    "null",
    "-",
  ]);
  const measured = parseLoudnessSummary(
    result.stderr,
    { frames, sampleRate: item.rate, truePeak: true },
    "9.0.2",
  );
  const reference = JSON.parse(baseline.stdout),
    errors = {};
  for (const key of ["integratedLufs", "loudnessRangeLu", "samplePeakDbfs", "truePeakDbtp"])
    errors[key] = Math.abs(measured[key] - Number(reference[key]));
  const record = {
    ...item,
    sample: undefined,
    frames,
    sourceSha256: hash(pcm),
    reference,
    measured,
    errors,
  };
  records.push(record);
  await writeFile(join(out, item.id + "-oracle.json"), baseline.stdout, { flag: "wx" });
  await writeFile(join(out, item.id + "-ffmpeg.txt"), result.stderr, { flag: "wx" });
  await writeFile(
    join(out, "report.json"),
    JSON.stringify(
      {
        protocol,
        records,
        ffmpegSha256: hash(await readFile(ffmpeg)),
        oracleSha256: hash(await readFile(oracle)),
        passed: false,
      },
      null,
      2,
    ),
  );
  assert.ok(errors.integratedLufs <= protocol.gates.integratedLufsAbsolute, JSON.stringify(record));
  assert.ok(
    errors.loudnessRangeLu <= protocol.gates.loudnessRangeLuAbsolute,
    JSON.stringify(record),
  );
  assert.ok(errors.samplePeakDbfs <= protocol.gates.samplePeakDbfsAbsolute, JSON.stringify(record));
  assert.ok(
    errors.truePeakDbtp <= protocol.gates.smoothTruePeakDbtpAbsolute,
    JSON.stringify(record),
  );
}
await writeFile(
  join(out, "report.json"),
  JSON.stringify(
    {
      protocol,
      records,
      ffmpegSha256: hash(await readFile(ffmpeg)),
      oracleSha256: hash(await readFile(oracle)),
      passed: true,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(records.map((r) => ({ id: r.id, errors: r.errors }))));
