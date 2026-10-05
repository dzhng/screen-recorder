import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyFFmpeg } from "./prepare.mjs";

export async function smokeFFmpeg(directory) {
  directory = resolve(directory);
  const receipt = await verifyFFmpeg(directory);
  const ffmpeg = join(directory, "bin/ffmpeg"),
    ffprobe = join(directory, "bin/ffprobe");
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-ffmpeg-smoke-"));
  const run = (executable, args) =>
    execFileSync(executable, args, {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
    });
  const execute = (args) =>
    run(ffmpeg, ["-hide_banner", "-nostdin", "-threads", "2", "-filter_threads", "1", ...args]);
  const probes = [];
  try {
    for (const codec of ["h264", "hevc"]) {
      const output = join(scratch, `${codec}.mp4`);
      execute([
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x180:rate=30:duration=1",
        "-an",
        "-c:v",
        `${codec}_videotoolbox`,
        "-pix_fmt",
        "yuv420p",
        ...(codec === "hevc" ? ["-tag:v", "hvc1"] : []),
        "-n",
        output,
      ]);
      const observation = JSON.parse(
        run(ffprobe, [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_name,width,height,duration",
          "-of",
          "json",
          output,
        ]),
      ).streams;
      assert.deepEqual(observation, [
        { codec_name: codec, width: 320, height: 180, duration: "1.000000" },
      ]);
      execute(["-v", "error", "-i", output, "-f", "null", "-"]);
      probes.push({ codec, ...observation[0] });
    }
    for (const [extension, encoder] of [
      ["wav", "pcm_f32le"],
      ["m4a", "aac"],
    ]) {
      const output = join(scratch, `tone.${extension}`);
      execute([
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=1000:sample_rate=48000:duration=1",
        "-c:a",
        encoder,
        "-n",
        output,
      ]);
      const stream = JSON.parse(
        run(ffprobe, [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_name,sample_rate",
          "-of",
          "json",
          output,
        ]),
      ).streams[0];
      assert.equal(stream.codec_name, encoder);
      assert.equal(stream.sample_rate, "48000");
      probes.push({ extension, ...stream });
    }
    for (const filter of [
      "ebur128",
      "loudnorm",
      "alimiter",
      "sidechaincompress",
      "tonemap",
      "lut3d",
      "colorbalance",
      "colorspace",
    ])
      run(ffmpeg, ["-hide_banner", "-h", `filter=${filter}`]);
    execute([
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:sample_rate=48000:duration=2",
      "-af",
      "ebur128=peak=true,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.8:level=false:latency=true",
      "-ar",
      "48000",
      "-f",
      "null",
      "-",
    ]);
    execute([
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=1",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      "-filter_complex",
      "[0:a][1:a]sidechaincompress=threshold=0.05:ratio=4[out]",
      "-map",
      "[out]",
      "-f",
      "null",
      "-",
    ]);
    execute([
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=64x64:rate=1:duration=1",
      "-vf",
      "colorbalance=rs=0.02",
      "-frames:v",
      "1",
      "-f",
      "null",
      "-",
    ]);
    return {
      recipeSha256: receipt.recipeSha256,
      sourceSha256: receipt.sourceSha256,
      probes,
      filterExecution: ["ebur128", "loudnorm", "alimiter", "sidechaincompress", "colorbalance"],
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: node helpers/ffmpeg/smoke.mjs PREPARED_DIRECTORY");
    console.log(JSON.stringify(await smokeFFmpeg(process.argv[2]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
