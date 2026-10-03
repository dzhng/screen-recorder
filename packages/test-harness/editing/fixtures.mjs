import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { raster } from "../../../apps/macos/tests/fixtures/generated-capture.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const expectedPath = join(here, "expected.json");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const ffprobe = process.env.FFPROBE ?? "ffprobe";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr?.toString()}`);
  return result.stdout;
}
function encode(args) {
  return run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...args]);
}
async function hash(file) {
  const digest = createHash("sha256");
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest("hex");
}
function probe(file) {
  return JSON.parse(
    run(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "stream=index,codec_name,profile,codec_type,width,height,pix_fmt,r_frame_rate,time_base,start_time,duration,sample_rate,channels:stream_side_data=rotation:format=duration",
      "-of",
      "json",
      file,
    ]),
  );
}
function frames(id, width, height, count) {
  return Buffer.concat(
    Array.from({ length: count }, (_, frame) => {
      const { rgb, rect, text } = raster(width, height);
      rect(0, 0, width, height, [32 + frame * 16, id === "a" ? 40 : 100, id === "a" ? 120 : 30]);
      rect(0, 0, 18, 26, [255, 0, 0]);
      rect(width - 34, height - 15, 34, 15, [0, 255, 80]);
      text(`${id.toUpperCase()} ${String(frame).padStart(2, "0")}`, 22, 34, 2, [255, 255, 255]);
      return rgb;
    }),
  );
}
function wav(hz, impulses) {
  const samples = 96000;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(48000, 24);
  data.writeUInt32LE(96000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    data.writeInt16LE(
      impulses.includes(i) ? 30000 : Math.round(4000 * Math.sin((2 * Math.PI * hz * i) / 48000)),
      44 + i * 2,
    );
  return data;
}
const videoOptions = [
  "-c:v",
  "libx264",
  "-preset",
  "veryslow",
  "-crf",
  "12",
  "-profile:v",
  "high",
  "-bf",
  "0",
  "-pix_fmt",
  "yuv420p",
  "-threads",
  "1",
  "-flags:v",
  "+bitexact",
  "-map_metadata",
  "-1",
  "-fflags",
  "+bitexact",
];

async function generate(out) {
  await mkdir(out, { recursive: true });
  const scratch = await mkdtemp(join(tmpdir(), "screenrec-fixtures-"));
  const files = [];
  try {
    for (const [id, width, height, fps, count, hz, impulses] of [
      ["a", 160, 96, 4, 8, 440, [24000, 72000]],
      ["b", 96, 128, 5, 10, 880, [12000, 60000]],
    ]) {
      const raw = join(scratch, `${id}.rgb`);
      const audio = `${id}-audio.wav`;
      await writeFile(raw, frames(id, width, height, count));
      await writeFile(join(out, audio), wav(hz, impulses));
      encode([
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        `${width}x${height}`,
        "-r",
        String(fps),
        "-i",
        raw,
        "-i",
        join(out, audio),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        ...videoOptions,
        "-c:a",
        "pcm_s16le",
        join(out, `${id}.mov`),
      ]);
      encode([
        "-i",
        join(out, `${id}.mov`),
        "-vf",
        `tile=${fps}x2`,
        "-frames:v",
        "1",
        "-threads",
        "1",
        join(out, `frames-${id}.png`),
      ]);
      files.push(`${id}.mov`, audio, `frames-${id}.png`);
    }
    encode([
      "-i",
      join(out, "a.mov"),
      "-map",
      "0:v:0",
      "-c",
      "copy",
      "-map_metadata",
      "-1",
      "-fflags",
      "+bitexact",
      join(out, "video-only.mov"),
    ]);
    encode([
      "-display_rotation:v:0",
      "90",
      "-i",
      join(out, "a.mov"),
      "-map",
      "0:v:0",
      "-c",
      "copy",
      "-map_metadata",
      "-1",
      "-fflags",
      "+bitexact",
      join(out, "orientation.mov"),
    ]);
    encode([
      "-i",
      join(out, "a.mov"),
      "-an",
      "-vf",
      "select='not(between(n,2,3))'",
      "-fps_mode",
      "vfr",
      ...videoOptions,
      join(out, "timestamp-gap.mov"),
    ]);
    files.push("video-only.mov", "orientation.mov", "timestamp-gap.mov");
    for (const [name, width, height] of [
      ["still-alpha.png", 47, 31],
      ["odd-canvas.png", 161, 97],
    ]) {
      const rgba = Buffer.alloc(width * height * 4);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const at = (y * width + x) * 4;
          rgba.set([x < 13 ? 240 : 30, y < 11 ? 80 : 180, 100, x < 7 ? 0 : x < 23 ? 128 : 255], at);
        }
      const raw = join(scratch, "still.rgba");
      await writeFile(raw, rgba);
      encode([
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${width}x${height}`,
        "-i",
        raw,
        "-frames:v",
        "1",
        "-threads",
        "1",
        join(out, name),
      ]);
      files.push(name);
    }
    await writeFile(join(out, "expected.json"), await readFile(expectedPath));
    files.push("expected.json");
    const assets = [];
    for (const path of files)
      assets.push({
        path,
        sha256: await hash(join(out, path)),
        bytes: (await stat(join(out, path))).size,
        ...(path.endsWith(".json") ? {} : { probe: probe(join(out, path)) }),
      });
    const references = [];
    for (const leaf of ["recording.json", "capture.journal.jsonl", "narration.mov", "video.mov"]) {
      const path = `fixtures/narrated-workbench/${leaf}`;
      references.push({
        path,
        sha256: await hash(join(root, path)),
        bytes: (await stat(join(root, path))).size,
        ...(leaf.endsWith(".mov") ? { probe: probe(join(root, path)) } : {}),
      });
    }
    const manifest = {
      version: 1,
      invocation:
        "node packages/test-harness/editing/fixtures.mjs --out specs/done/agent-editing/assets/00-corpus",
      sourceCommit: run("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim(),
      generator: {
        path: "packages/test-harness/editing/fixtures.mjs",
        sha256: await hash(fileURLToPath(import.meta.url)),
      },
      raster: {
        path: "apps/macos/tests/fixtures/generated-capture.mjs",
        sha256: await hash(join(root, "apps/macos/tests/fixtures/generated-capture.mjs")),
      },
      tools: {
        node: process.version,
        ffmpeg: run(ffmpeg, ["-version"]).toString().split("\n")[0],
        ffprobe: run(ffprobe, ["-version"]).toString().split("\n")[0],
      },
      determinism:
        "Media bytes repeat with these tool versions; cross-version encoder byte identity is not promised. Source commit records generation provenance, not the later commit containing these artifacts.",
      assets,
      references,
      limitations: [
        "Synthetic media proves timing and geometry only, not speech or camera quality.",
        "Real narration is referenced and hashed in place, never rewritten or copied into this compact corpus.",
        "Timestamp gap needs its synthetic acquisition evidence; it does not claim an empty media edit list.",
        "Preservation-suite results, human speech labels and independent visual critique are separate slice-00 evidence.",
      ],
    };
    await writeFile(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
async function verify(out) {
  const manifest = JSON.parse(await readFile(join(out, "manifest.json"), "utf8"));
  for (const [base, entries] of [
    [out, manifest.assets],
    [root, manifest.references],
  ])
    for (const entry of entries) {
      const actual = await hash(join(base, entry.path));
      if (actual !== entry.sha256) throw new Error(`Hash mismatch: ${entry.path}`);
    }
  return manifest;
}

try {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes("--verify");
  const filtered = args.filter((arg) => arg !== "--verify");
  if (filtered.length !== 2 || filtered[0] !== "--out")
    throw new Error("Usage: node fixtures.mjs --out DIRECTORY [--verify]");
  const out = resolve(filtered[1]);
  const manifest = verifyOnly ? await verify(out) : await generate(out);
  console.log(
    JSON.stringify({
      status: verifyOnly ? "verified" : "generated",
      out,
      assets: manifest.assets.length,
      references: manifest.references.length,
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
