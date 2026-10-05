import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileCliOwner } from "../../../apps/service/src/cli-owner.fixture.ts";
import { inspectFfmpegInput } from "../../../apps/service/dist/ffmpeg-input.js";
import { cliWorker, mediaWorker, nativeResult } from "../../../apps/service/dist/worker.js";

// Reproduction only: explicitly supplied prepared/candidate runtime, immutable
// source facts, independent standards chart and held-source substitution.
const [distribution, native, output] = process.argv.slice(2, 5).map((value) => resolve(value));
const heldOut = process.argv[5] === "held-out";
if (!distribution || !native || !output)
  throw new Error("Usage: node hdr-conversion.mjs DISTRIBUTION NATIVE NEW_OUTPUT_DIRECTORY");
await mkdir(output, { mode: 0o700 });
const scratch = await mkdtemp("/tmp/screenrec-hdr-owner-");
const ffmpeg = join(distribution, "bin/ffmpeg"),
  ffprobe = join(distribution, "bin/ffprobe");
const hash = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const recipe =
  "zscale=t=linear:npl=100:agamma=0,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0:peak=10,zscale=t=bt709:m=bt709:r=limited:dither=error_diffusion:agamma=0";
const run = (args) =>
  execFileSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", ...args], {
    maxBuffer: 4 * 1024 * 1024,
  });
const maximumDifference = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  return actual.reduce(
    (maximum, value, index) => Math.max(maximum, Math.abs(value - expected[index])),
    0,
  );
};
const calibration = (actual, expected) => {
  const rows = [];
  for (let row = 0; row < 2; row++)
    for (let column = 0; column < 10; column++) {
      const errors = [];
      for (let y = row * 96 + 8; y < (row + 1) * 96 - 8; y++)
        for (let x = column * 32 + 8; x < (column + 1) * 32 - 8; x++) {
          const at = (y * 320 + x) * 3;
          for (let c = 0; c < 3; c++) errors.push(Math.abs(actual[at + c] - expected[at + c]));
        }
      rows.push({
        row,
        column,
        maxError: Math.max(...errors),
        meanError: errors.reduce((a, b) => a + b, 0) / errors.length,
      });
    }
  return rows;
};
try {
  const owner = await compileCliOwner(scratch),
    worker = mediaWorker({ SCREENREC_NATIVE: native });
  const result = {
    recipe,
    rawTolerance8bit: 3,
    heldOut,
    intermediateTolerance8bit: 3,
    runtime: {
      ffmpeg: await hash(ffmpeg),
      ffprobe: await hash(ffprobe),
      native: await hash(native),
    },
    families: [],
  };
  for (const family of ["pq", "hlg"]) {
    execFileSync("python3", [
      join(dirname(fileURLToPath(import.meta.url)), "hdr-chart.py"),
      family,
      output,
      ffmpeg,
      ...(heldOut ? ["held-out"] : []),
    ]);
    const source = join(output, `${family}-chart.mov`),
      retained = source + ".retained";
    const file = await open(source, "r");
    let substituted = false;
    try {
      const metadata = nativeResult(
        await worker("media.probe", { path: "/dev/fd/3" }, { descriptors: [file.fd] }),
      );
      const input = await inspectFfmpegInput(
        { executable: ffprobe, ownerExecutable: owner },
        { file, metadata, streamId: "track:1" },
      );
      const sourceSha256 = await hash(source);
      await rename(source, retained);
      substituted = true;
      await writeFile(source, "replacement must never decode");
      const decoded = await cliWorker(
        {
          executable: ffmpeg,
          ownerExecutable: owner,
          args: [
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            ...input.args,
            "-map",
            input.map,
            "-an",
            "-vf",
            recipe + ",format=yuv444p16le",
            "-frames:v",
            "1",
            "-pix_fmt",
            "rgb24",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
        },
        {
          descriptors: input.descriptors,
          rewindDescriptors: input.rewindDescriptors,
          maxBytes: 320 * 192 * 3 + 4096,
        },
      );
      assert(decoded.ok, JSON.stringify(decoded));
      const raw = decoded.data.stdout;
      assert.equal(raw.length, 320 * 192 * 3);
      await writeFile(join(output, `${family}-candidate.rgb`), raw);
      run([
        "-f",
        "rawvideo",
        "-pixel_format",
        "rgb24",
        "-video_size",
        "320x192",
        "-i",
        join(output, `${family}-candidate.rgb`),
        "-frames:v",
        "1",
        join(output, `${family}-candidate.png`),
      ]);
      const ppm = await readFile(join(output, `${family}-independent-sdr.ppm`));
      const reference = ppm.subarray(ppm.indexOf(10, ppm.indexOf(10, ppm.indexOf(10) + 1) + 1) + 1);
      const rawCalibration = calibration(raw, reference);
      assert(Math.max(...rawCalibration.map((p) => p.maxError)) <= result.rawTolerance8bit);
      const intermediate = join(output, `${family}-converted.mov`);
      const placeholder = await open("/dev/null", "w");
      const directory = await open(output, "r");
      let encoded;
      try {
        encoded = await cliWorker(
          {
            executable: ffmpeg,
            ownerExecutable: owner,
            args: [
              "-nostdin",
              "-hide_banner",
              "-loglevel",
              "error",
              "-y",
              ...input.args,
              "-map",
              input.map,
              "-an",
              "-vf",
              recipe +
                ",format=yuv444p10le,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=limited",
              "-frames:v",
              "1",
              "-c:v",
              "prores_ks",
              "-profile:v",
              "4",
              "-alpha_bits",
              "0",
              "-color_primaries",
              "bt709",
              "-color_trc",
              "bt709",
              "-colorspace",
              "bt709",
              "-f",
              "mov",
              "/dev/fd/4",
            ],
          },
          {
            descriptors: [...input.descriptors, placeholder.fd, directory.fd],
            rewindDescriptors: input.rewindDescriptors,
            maxBytes: 4096,
            stagedOutput: {
              directoryDescriptor: 5,
              descriptor: 4,
              name: `${family}-converted.mov`,
            },
          },
        );
      } finally {
        await placeholder.close();
        await directory.close();
      }
      assert(encoded.ok, JSON.stringify(encoded));
      const outputFile = await open(intermediate, "r");
      try {
        const identity = await outputFile.stat({ bigint: true });
        assert.deepEqual(encoded.data.allocatedOutput, {
          device: String(identity.dev),
          inode: String(identity.ino),
        });
      } finally {
        await outputFile.close();
      }
      const delivery = run([
        "-i",
        intermediate,
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      await writeFile(join(output, `${family}-intermediate.rgb`), delivery);
      run([
        "-f",
        "rawvideo",
        "-pixel_format",
        "rgb24",
        "-video_size",
        "320x192",
        "-i",
        join(output, `${family}-intermediate.rgb`),
        "-frames:v",
        "1",
        join(output, `${family}-intermediate.png`),
      ]);
      const intermediateCalibration = calibration(delivery, reference);
      assert(
        Math.max(...intermediateCalibration.map((p) => p.maxError)) <=
          result.intermediateTolerance8bit,
      );
      const outputMetadata = nativeResult(await worker("media.probe", { path: intermediate }));
      const outputStream = outputMetadata.streams[0];
      assert.equal(outputStream.colorPrimaries, "ITU_R_709_2");
      assert.equal(outputStream.transferFunction, "ITU_R_709_2");
      assert.equal(outputStream.ycbcrMatrix, "ITU_R_709_2");
      assert.deepEqual(outputStream.samples, metadata.streams[0].samples);
      assert.deepEqual(outputStream.segments, metadata.streams[0].segments);
      await rm(source);
      await rename(retained, source);
      substituted = false;
      const wholeFrameMaximum = maximumDifference(raw, delivery);
      assert(wholeFrameMaximum <= 3, "Intermediate must retain whole-frame boundaries");
      const h264 = join(output, `${family}-h264-control.mp4`);
      run([
        "-i",
        source,
        "-vf",
        recipe + ",format=yuv420p",
        "-frames:v",
        "1",
        "-c:v",
        "h264_videotoolbox",
        "-b:v",
        "10000000",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        h264,
      ]);
      const h264Rgb = run([
        "-i",
        h264,
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      const h264BoundaryMaximum = maximumDifference(raw, h264Rgb);
      assert(h264BoundaryMaximum > 3, "Lossy chroma control must fail whole-frame boundary budget");
      const approximate = run([
        "-i",
        source,
        "-vf",
        recipe.replaceAll("agamma=0", "agamma=1") + ",format=yuv444p16le",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      const approximateMaximum = Math.max(
        ...calibration(approximate, reference).map((p) => p.maxError),
      );
      if (family === "hlg")
        assert(
          approximateMaximum > result.rawTolerance8bit,
          "HLG control must expose approximate-gamma color error",
        );
      result.families.push({
        family,
        sourceSha256,
        metadata,
        outputSha256: await hash(intermediate),
        outputMetadata,
        rawCalibration,
        intermediateCalibration,
        approximateGammaMaximum: approximateMaximum,
        wholeFrameRawToIntermediateMaximum: wholeFrameMaximum,
        h264BoundaryMaximum,
        intermediateInput: "held original while pathname replacement persists",
        heldPathSubstitution: "original retained inode decoded after replacement",
      });
    } finally {
      await file.close();
      if (substituted) {
        await rm(source, { force: true });
        await rename(retained, source);
      }
    }
  }
  await writeFile(join(output, "report.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      report: join(output, "report.json"),
      families: result.families.map((f) => ({
        family: f.family,
        maxRaw: Math.max(...f.rawCalibration.map((p) => p.maxError)),
        maxIntermediate: Math.max(...f.intermediateCalibration.map((p) => p.maxError)),
        approximateGammaMaximum: f.approximateGammaMaximum,
      })),
    }),
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
