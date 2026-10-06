import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileCliOwner } from "../../../apps/service/src/cli-owner.fixture.ts";
import { inspectFfmpegInput } from "../../../apps/service/dist/ffmpeg-input.js";
import { withFfmpegArtifact } from "../../../apps/service/dist/ffmpeg-artifact.js";
import { readMediaProbe } from "../../../apps/service/dist/media-probe.js";
import {
  qualifyHdrInterpretation,
  withHdrDerivative,
} from "../../../apps/service/dist/hdr-conversion.js";
import { readHdrConversionFacts } from "@yap/core/hdr-conversion-facts";
import { cliWorker, mediaWorker, nativeResult } from "../../../apps/service/dist/worker.js";

// Reproduction only: explicitly supplied prepared/candidate runtime, immutable
// source facts, independent standards chart and held-source substitution.
const [distribution, native, output] = process.argv.slice(2, 5).map((value) => resolve(value));
const heldOut = process.argv.slice(5).includes("held-out");
const encoded = process.argv.slice(5).includes("encoded");
const producer = process.argv.slice(5).includes("producer");
const producerAudio = process.argv.slice(5).includes("producer-audio");
if (producer && !encoded) throw new Error("producer requires encoded controls");
if (producerAudio && !producer) throw new Error("producer-audio requires producer");
if (!distribution || !native || !output)
  throw new Error(
    "Usage: node hdr-conversion.mjs DISTRIBUTION NATIVE NEW_OUTPUT_DIRECTORY [held-out] [encoded] [producer] [producer-audio]",
  );
await mkdir(output, { mode: 0o700 });
const scratch = await mkdtemp("/tmp/yap-hdr-owner-");
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
    worker = mediaWorker({ YAP_NATIVE: native });
  const attemptParent = join(scratch, "attempts");
  await mkdir(attemptParent, { mode: 0o700 });
  const result = {
    recipe,
    rawTolerance8bit: 3,
    heldOut,
    encoded,
    producer,
    producerAudio,
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
    let source = join(output, `${family}-chart.mov`);
    let encodedControl;
    if (encoded) {
      const transfer = family === "pq" ? "smpte2084" : "arib-std-b67";
      const rawPath = join(output, `${family}-three.yuv`);
      const raw = await readFile(join(output, `${family}-chart.yuv`));
      await writeFile(rawPath, Buffer.concat([raw, raw, raw]));
      const control = join(output, `${family}-unstripped.mov`);
      run([
        "-y",
        "-f",
        "rawvideo",
        "-pixel_format",
        "yuv444p10le",
        "-video_size",
        "320x192",
        "-framerate",
        "24",
        "-i",
        rawPath,
        "-vf",
        `setparams=color_primaries=bt2020:color_trc=${transfer}:colorspace=bt2020nc:range=limited,format=p010le`,
        "-frames:v",
        "3",
        "-c:v",
        "hevc_videotoolbox",
        "-profile:v",
        "main10",
        "-b:v",
        "100000000",
        "-tag:v",
        "hvc1",
        "-color_primaries",
        "bt2020",
        "-color_trc",
        transfer,
        "-colorspace",
        "bt2020nc",
        "-color_range",
        "tv",
        "-video_track_timescale",
        "90000",
        "-movie_timescale",
        "90000",
        control,
      ]);
      source = join(output, `${family}-encoded.mov`);
      // Independently author a plain test signal; never a production treatment.
      run([
        "-y",
        "-i",
        control,
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
        "-bsf:v",
        "filter_units=remove_types=39|40|62",
        "-video_track_timescale",
        "90000",
        "-movie_timescale",
        "90000",
        source,
      ]);
      encodedControl = {
        sha256: await hash(control),
        metadata: nativeResult(
          await worker("media.probe", { path: control, inspectCompressedVideo: true }),
        ),
      };
    }
    const retained = source + ".retained";
    const file = await open(source, "r");
    let substituted = false;
    try {
      const metadata = await readMediaProbe(
        worker,
        output,
        "/dev/fd/3",
        new AbortController().signal,
        [file.fd],
        { inspectCompressedVideo: encoded },
      );
      const input = await inspectFfmpegInput(
        { executable: ffprobe, ownerExecutable: owner },
        { file, metadata, streamId: "track:1", inspectColor: encoded },
      );
      await writeFile(
        join(output, `${family}-input-operands.json`),
        JSON.stringify({ metadata, encodedControl, ffprobeColor: input.color }, null, 2) + "\n",
      );
      const interpretation = encoded
        ? qualifyHdrInterpretation(readHdrConversionFacts(metadata, "track:1"), input.color)
        : undefined;
      if (encoded) {
        assert.equal(interpretation.family, family);
        assert(encodedControl.metadata.streams[0].compressedVideoInspection.refusals.length > 0);
      }
      const sourceSha256 = await hash(source);
      await rename(source, retained);
      substituted = true;
      await writeFile(source, "replacement must never decode");
      const decodeRgb = async (transform) => {
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
              transform + ",format=yuv444p16le",
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
        assert.equal(decoded.data.stdout.length, 320 * 192 * 3);
        return decoded.data.stdout;
      };
      const raw = await decodeRgb(recipe);
      await writeFile(join(output, `${family}-candidate.rgb`), raw);
      const pinnedRecipe = encoded
        ? recipe.replace(
            "zscale=t=linear",
            `zscale=pin=bt2020:tin=${family === "pq" ? "smpte2084" : "arib-std-b67"}:min=bt2020nc:rin=limited:t=linear`,
          )
        : recipe;
      let explicitPins;
      if (encoded) {
        const pinned = await decodeRgb(pinnedRecipe);
        const wrongRange = await decodeRgb(pinnedRecipe.replace("rin=limited", "rin=full"));
        await writeFile(join(output, `${family}-pinned.rgb`), pinned);
        await writeFile(join(output, `${family}-wrong-range.rgb`), wrongRange);
        explicitPins = {
          recipe: pinnedRecipe,
          rawMaximum: maximumDifference(raw, pinned),
          wrongRangeMaximum: maximumDifference(raw, wrongRange),
        };
        await writeFile(
          join(output, `${family}-pin-operands.json`),
          JSON.stringify(explicitPins, null, 2) + "\n",
        );
        assert.equal(explicitPins.rawMaximum, 0);
        assert(explicitPins.wrongRangeMaximum > result.rawTolerance8bit);
      }
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
      let completion;
      try {
        completion = await cliWorker(
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
              pinnedRecipe +
                ",format=yuv444p10le,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=limited",
              "-frames:v",
              encoded ? "3" : "1",
              ...(encoded
                ? [
                    "-fps_mode",
                    "passthrough",
                    "-enc_time_base",
                    "demux",
                    "-movie_timescale",
                    "90000",
                  ]
                : []),
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
              ...(encoded ? ["-color_range", "tv"] : []),
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
      assert(completion.ok, JSON.stringify(completion));
      const outputFile = await open(intermediate, "r");
      try {
        const identity = await outputFile.stat({ bigint: true });
        assert.deepEqual(completion.data.allocatedOutput, {
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
      await writeFile(
        join(output, `${family}-clock-operands.json`),
        JSON.stringify({ metadata, outputMetadata }, null, 2) + "\n",
      );
      assert.equal(outputStream.colorPrimaries, "ITU_R_709_2");
      assert.equal(outputStream.transferFunction, "ITU_R_709_2");
      assert.equal(outputStream.ycbcrMatrix, "ITU_R_709_2");
      assert.deepEqual(outputStream.samples, metadata.streams[0].samples);
      assert.deepEqual(outputStream.segments, metadata.streams[0].segments);
      if (encoded) {
        assert.equal(metadata.streams[0].endUs, 125000);
        assert.deepEqual(metadata.streams[0].samples.lastDurationUs, {
          numerator: 125000,
          denominator: 3,
        });
        assert.equal(metadata.originUs, outputMetadata.originUs);
        assert.deepEqual(outputStream.transform, metadata.streams[0].transform);
        assert.equal(outputStream.width, metadata.streams[0].width);
        assert.equal(outputStream.height, metadata.streams[0].height);
        assert.equal(outputStream.hasAlpha, false);
      }
      let producerEvidence;
      let zeroExitControl;
      if (producer && family === "pq") {
        let validatorReached = false;
        let retainedBytes;
        try {
          await withFfmpegArtifact(
            worker,
            {
              attemptParent,
              filename: "declined.mov",
              executable: ffmpeg,
              ownerExecutable: owner,
              descriptors: [file.fd],
              rewindDescriptors: [3],
              args: (slot) => [
                "-v",
                "error",
                "-nostdin",
                ...input.args,
                "-map",
                input.map,
                "-an",
                "-c:v",
                "prores_ks",
                "-f",
                "mov",
                `/dev/fd/${slot}`,
              ],
            },
            new AbortController().signal,
            async (outputFile, signal, boundWorker) => {
              validatorReached = true;
              retainedBytes = (await outputFile.stat()).size;
              assert.equal(retainedBytes, 0);
              return readMediaProbe(boundWorker, output, "/dev/fd/3", signal, [outputFile.fd]);
            },
            async () => {
              throw new Error("declined empty output must not consume");
            },
          );
          throw new Error("empty output must refuse");
        } catch (error) {
          zeroExitControl = {
            validatorReached,
            retainedBytes,
            code: error.code,
            message: error.message,
          };
          await writeFile(
            join(output, "zero-exit-empty-control.json"),
            JSON.stringify(zeroExitControl, null, 2) + "\n",
          );
          assert.equal(validatorReached, true);
          assert.equal(retainedBytes, 0);
          assert.equal(error.code, "NATIVE_DECODE_FAILED");
        }
      }
      if (producer) {
        producerEvidence = await withHdrDerivative(
          worker,
          {
            attemptParent,
            source: { file, bytes: (await file.stat()).size, sha256: sourceSha256 },
            streamId: "track:1",
            ffmpeg,
            ffprobe,
            ownerExecutable: owner,
          },
          new AbortController().signal,
          async (artifact) => {
            // Retain exact validation operands before numerical comparison.
            await writeFile(
              join(output, `${family}-producer-operands.json`),
              JSON.stringify(artifact.evidence, null, 2) + "\n",
            );
            const delivered = join(output, `${family}-producer.mov`);
            await copyFile(artifact.path, delivered);
            const rgb = run([
              "-i",
              delivered,
              "-frames:v",
              "1",
              "-pix_fmt",
              "rgb24",
              "-f",
              "rawvideo",
              "pipe:1",
            ]);
            await writeFile(join(output, `${family}-producer.rgb`), rgb);
            assert.deepEqual(rgb, delivery);
            return {
              sha256: artifact.sha256,
              bytes: artifact.bytes,
              clock: artifact.evidence.clock,
              normalizedRgbMatches: true,
            };
          },
        );
      }
      let producerAuxiliary;
      const producerAudioEvidence = [];
      if (producerAudio) {
        const pcm = Buffer.alloc(6000 * 2 * 4);
        for (let frame = 0; frame < 6000; frame++) {
          pcm.writeFloatLE(Math.sin(frame * 0.071) * 0.2, frame * 8);
          pcm.writeFloatLE(Math.cos(frame * 0.113) * 0.1, frame * 8 + 4);
        }
        const pcmPath = join(output, `${family}-selected-audio.f32`);
        await writeFile(pcmPath, pcm);
        for (const offsetUs of [0, 50000]) {
          const selectedSource = join(output, `${family}-selected-audio-${offsetUs}.mov`);
          run([
            "-y",
            "-itsoffset",
            String(offsetUs / 1000000),
            "-i",
            retained,
            "-f",
            "f32le",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-i",
            pcmPath,
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-movie_timescale",
            "48000",
            selectedSource,
          ]);
          const selectedFile = await open(selectedSource, "r");
          try {
            const raw = nativeResult(
              await worker("media.probe", {
                path: selectedSource,
                inspectCompressedVideo: true,
                inspectAudioStreamId: "track:2",
              }),
            );
            await writeFile(
              join(output, `${family}-selected-audio-${offsetUs}-source.json`),
              JSON.stringify(raw, null, 2),
            );
            assert.equal(raw.streams[0].startUs, offsetUs);
            assert.equal(raw.streams[1].decodedAudioInspection.frames, 6000);
            const evidence = await withHdrDerivative(
              worker,
              {
                attemptParent,
                source: {
                  file: selectedFile,
                  bytes: (await selectedFile.stat()).size,
                  sha256: await hash(selectedSource),
                },
                streamId: "track:1",
                audioStreamId: "track:2",
                ffmpeg,
                ffprobe,
                ownerExecutable: owner,
              },
              new AbortController().signal,
              async (artifact) => {
                await writeFile(
                  join(output, `${family}-selected-audio-${offsetUs}-operands.json`),
                  JSON.stringify(artifact.evidence, null, 2),
                );
                await copyFile(
                  artifact.path,
                  join(output, `${family}-selected-audio-${offsetUs}-producer.mov`),
                );
                assert.equal(artifact.evidence.output.video.startUs, offsetUs);
                assert.equal(artifact.evidence.outputAudio.audio.startUs, 0);
                assert.equal(
                  artifact.evidence.outputAudio.audio.decodedAudioInspection.frames,
                  6000,
                );
                assert.equal(
                  artifact.evidence.outputAudio.audio.decodedAudioInspection.pcmSha256,
                  artifact.evidence.sourceAudio.audio.decodedAudioInspection.pcmSha256,
                );
                return {
                  offsetUs,
                  sha256: artifact.sha256,
                  bytes: artifact.bytes,
                  clock: artifact.evidence.clock,
                  audioFrames: 6000,
                  pcmSha256: artifact.evidence.outputAudio.audio.decodedAudioInspection.pcmSha256,
                };
              },
            );
            producerAudioEvidence.push(evidence);
            if (offsetUs === 0) {
              await withHdrDerivative(
                worker,
                {
                  attemptParent,
                  source: {
                    file: selectedFile,
                    bytes: (await selectedFile.stat()).size,
                    sha256: await hash(selectedSource),
                  },
                  streamId: "track:1",
                  ffmpeg,
                  ffprobe,
                  ownerExecutable: owner,
                },
                new AbortController().signal,
                async (artifact) => {
                  await writeFile(
                    join(output, `${family}-unselected-audio-operands.json`),
                    JSON.stringify(artifact.evidence, null, 2),
                  );
                  await copyFile(artifact.path, join(output, `${family}-unselected-audio.mov`));
                  assert.equal(artifact.evidence.output.metadata.streams.length, 1);
                  assert.equal(artifact.evidence.outputAudio, undefined);
                  assert.equal(artifact.sha256, producerEvidence.sha256);
                },
              );
            }
          } finally {
            await selectedFile.close();
          }
        }
      }
      if (producer) {
        const chapters = join(output, `${family}-chapters.txt`);
        await writeFile(
          chapters,
          ";FFMETADATA1\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=125\ntitle=Auxiliary-control\n",
        );
        const auxiliary = join(output, `${family}-auxiliary.mov`);
        run([
          "-y",
          "-i",
          retained,
          "-i",
          chapters,
          "-map",
          "0:v:0",
          "-map_chapters",
          "1",
          "-c",
          "copy",
          "-metadata:s:v:0",
          "timecode=01:00:00:00",
          "-movie_timescale",
          "24",
          auxiliary,
        ]);
        const auxiliaryFile = await open(auxiliary, "r");
        try {
          const auxiliaryMetadata = nativeResult(
            await worker("media.probe", { path: auxiliary, inspectCompressedVideo: true }),
          );
          await writeFile(
            join(output, `${family}-auxiliary-source-operands.json`),
            JSON.stringify(auxiliaryMetadata, null, 2) + "\n",
          );
          assert(auxiliaryMetadata.streams.length > 1);
          producerAuxiliary = await withHdrDerivative(
            worker,
            {
              attemptParent,
              source: {
                file: auxiliaryFile,
                bytes: (await auxiliaryFile.stat()).size,
                sha256: await hash(auxiliary),
              },
              streamId: "track:1",
              ffmpeg,
              ffprobe,
              ownerExecutable: owner,
            },
            new AbortController().signal,
            async (artifact) => {
              await writeFile(
                join(output, `${family}-auxiliary-output-operands.json`),
                JSON.stringify(artifact.evidence, null, 2) + "\n",
              );
              await copyFile(artifact.path, join(output, `${family}-auxiliary-producer.mov`));
              assert.equal(artifact.evidence.output.metadata.streams.length, 1);
              assert.equal(artifact.sha256, producerEvidence.sha256);
              return {
                inputStreamCount: auxiliaryMetadata.streams.length,
                outputStreamCount: 1,
                sha256: artifact.sha256,
              };
            },
          );
        } finally {
          await auxiliaryFile.close();
        }
        const padded = join(output, `${family}-padded.mov`);
        run([
          "-y",
          "-i",
          retained,
          "-map",
          "0:v:0",
          "-c",
          "copy",
          "-movie_timescale",
          "100",
          padded,
        ]);
        const paddedFile = await open(padded, "r");
        try {
          const paddedMetadata = nativeResult(
            await worker("media.probe", { path: padded, inspectCompressedVideo: true }),
          );
          await writeFile(
            join(output, `${family}-padded-source-operands.json`),
            JSON.stringify(paddedMetadata, null, 2) + "\n",
          );
          await assert.rejects(
            withHdrDerivative(
              worker,
              {
                attemptParent,
                source: {
                  file: paddedFile,
                  bytes: (await paddedFile.stat()).size,
                  sha256: await hash(padded),
                },
                streamId: "track:1",
                ffmpeg,
                ffprobe,
                ownerExecutable: owner,
              },
              new AbortController().signal,
              async () => {
                throw new Error("padded source must not consume");
              },
            ),
            (error) =>
              error.code === "UNSUPPORTED_MEDIA" && error.message.includes("physical samples"),
          );
        } finally {
          await paddedFile.close();
        }
      }
      await rm(source);
      await rename(retained, source);
      substituted = false;
      if (encoded) {
        const frozenIntermediate = join(output, `${family}-frozen-converted.mov`);
        // Independent frozen command after restoring the fixture pathname.
        run([
          "-y",
          "-copyts",
          "-noautorotate",
          "-i",
          source,
          "-map",
          input.map,
          "-an",
          "-vf",
          recipe +
            ",format=yuv444p10le,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=limited",
          "-frames:v",
          "3",
          "-fps_mode",
          "passthrough",
          "-enc_time_base",
          "demux",
          "-movie_timescale",
          "90000",
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
          "-color_range",
          "tv",
          "-f",
          "mov",
          frozenIntermediate,
        ]);
        explicitPins.frozenSha256 = await hash(frozenIntermediate);
        explicitPins.pinnedSha256 = await hash(intermediate);
        await writeFile(
          join(output, `${family}-pin-operands.json`),
          JSON.stringify(explicitPins, null, 2) + "\n",
        );
        assert.equal(explicitPins.pinnedSha256, explicitPins.frozenSha256);
      }
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
        producerEvidence,
        zeroExitControl,
        producerAuxiliary,
        producerAudioEvidence,
        sourceSha256,
        metadata,
        interpretation,
        encodedControl,
        explicitPins,
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
