import type { FileHandle } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { fileIdentity, hashFile } from "@screenrec/core/files";
import { mediaProbeSchema } from "@screenrec/core/assets";
import { withRenderAttempt } from "./render.js";
import { withFfmpegArtifact, type FfmpegArtifact } from "./ffmpeg-artifact.js";
import { readMediaProbe } from "./media-probe.js";
import { renderWindowDeadlineMs, type MediaWorker } from "./worker.js";
import { inspectFfmpegInput } from "./ffmpeg-input.js";
import {
  readHdrConversionFacts,
  readHdrAudioConversionFacts,
  type HdrAudioConversionFacts,
  type HdrConversionFacts,
} from "@screenrec/core/hdr-conversion-facts";
import { CatalogError } from "@screenrec/core/catalog";
import {
  add,
  compare,
  fromTime,
  rational,
  subtract,
  toTime,
  type SignedTimeValue,
} from "@screenrec/composition";
import type { FfmpegColorDeclarations } from "./ffmpeg-input.js";

/** Interpretation only. Physical support, clock mapping and actual derivative
 * validation remain separate requirements before any managed publication. */
export function qualifyHdrInterpretation(
  facts: HdrConversionFacts,
  color: FfmpegColorDeclarations,
) {
  const video = facts.video;
  const inspection = video.compressedVideoInspection;
  // Native owns packet/configuration grammar; this recipe consumes its whole-track verdict.
  if (
    video.codec !== "hvc1" ||
    video.hasAlpha ||
    video.codecAtomNames.length !== 1 ||
    video.codecAtomNames[0]!.length !== 1 ||
    video.codecAtomNames[0]![0] !== "hvcC" ||
    !inspection ||
    inspection.status !== "complete" ||
    inspection.refusals.length ||
    inspection.packetCount < video.samples.count
  )
    throw new CatalogError("UNSUPPORTED_MEDIA", "HDR compressed interpretation is unqualified");
  const declarations = facts.video.colorFormats;
  const native = declarations[0];
  const transfer = native?.transferFunction;
  const family: "pq" | "hlg" | undefined =
    transfer === "SMPTE_ST_2084_PQ" ? "pq" : transfer === "ITU_R_2100_HLG" ? "hlg" : undefined;
  if (
    declarations.length !== 1 ||
    !native ||
    !family ||
    native.colorPrimaries !== "ITU_R_2020" ||
    native.ycbcrMatrix !== "ITU_R_2020" ||
    native.bitsPerComponent !== 10 ||
    native.fullRange === true ||
    native.interpretationExtensions.length ||
    native.invalidColorDeclarations.length ||
    color.colorPrimaries !== "bt2020" ||
    color.transferFunction !== (family === "pq" ? "smpte2084" : "arib-std-b67") ||
    color.ycbcrMatrix !== "bt2020nc" ||
    color.range !== "tv" ||
    color.pixelFormat !== "yuv420p10le"
  )
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "HDR source declarations are unqualified or disagree",
    );
  return { family };
}

export function prepareHdrClock(facts: HdrConversionFacts, audioFacts?: HdrAudioConversionFacts) {
  const video = facts.video;
  const occupied = video.segments.filter((segment) => !segment.empty);
  const segment = occupied[0];
  const first = fromTime(video.samples.firstTimeUs);
  const last = fromTime(video.samples.lastTimeUs);
  const tail = fromTime(video.samples.lastDurationUs);
  if (
    occupied.length !== 1 ||
    !segment ||
    video.samples.count < 1 ||
    segment.mediaStartUs === undefined ||
    segment.mediaDurationUs === undefined ||
    compare(tail, rational(0n)) <= 0 ||
    compare(last, first) < 0 ||
    compare(first, fromTime(video.startUs)) !== 0 ||
    compare(first, fromTime(segment.startUs)) !== 0 ||
    compare(add(last, tail), fromTime(video.endUs)) !== 0 ||
    compare(add(last, tail), fromTime(segment.endUs)) !== 0 ||
    compare(
      fromTime(segment.mediaDurationUs),
      subtract(fromTime(segment.endUs), fromTime(segment.startUs)),
    ) !== 0
  )
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "HDR declared support cannot map faithfully to its physical samples",
    );
  const operands = [
    facts.metadata.originUs,
    video.startUs,
    video.endUs,
    video.samples.firstTimeUs,
    video.samples.lastTimeUs,
    video.samples.lastDurationUs,
    ...video.segments.flatMap((segment) => [
      segment.startUs,
      segment.endUs,
      ...(segment.mediaStartUs === undefined ? [] : [segment.mediaStartUs]),
      ...(segment.mediaDurationUs === undefined ? [] : [segment.mediaDurationUs]),
    ]),
  ];
  let sourceClockAtDerivativeZeroUs = video.startUs;
  let selectedEndUs = video.endUs;
  if (audioFacts) {
    const audio = audioFacts.audio;
    const decoded = audio.decodedAudioInspection;
    const occupiedAudio = audio.segments.filter((item) => !item.empty);
    const audioSegment = occupiedAudio[0];
    const run = decoded.runs[0];
    const duration = rational(BigInt(decoded.frames) * 1000000n, BigInt(decoded.sampleRate));
    const same = (a: SignedTimeValue, b: SignedTimeValue) =>
      compare(fromTime(a), fromTime(b)) === 0;
    if (
      !same(facts.metadata.originUs, audioFacts.metadata.originUs) ||
      occupiedAudio.length !== 1 ||
      !audioSegment ||
      audioSegment.mediaStartUs === undefined ||
      audioSegment.mediaDurationUs === undefined ||
      decoded.frames < 1 ||
      decoded.runs.length !== 1 ||
      !run ||
      run.frames !== decoded.frames ||
      decoded.sampleRate !== audio.sampleRate ||
      decoded.channels !== audio.channels ||
      !same(run.startUs, audio.startUs) ||
      !same(run.endUs, audio.endUs) ||
      !same(run.startUs, audioSegment.startUs) ||
      !same(run.endUs, audioSegment.endUs) ||
      compare(subtract(fromTime(run.endUs), fromTime(run.startUs)), duration) !== 0 ||
      compare(fromTime(audioSegment.mediaDurationUs), duration) !== 0
    )
      throw new CatalogError(
        "UNSUPPORTED_MEDIA",
        "HDR selected audio decoder support differs from its occupied native sample cells",
      );
    if (compare(fromTime(audio.startUs), fromTime(sourceClockAtDerivativeZeroUs)) < 0)
      sourceClockAtDerivativeZeroUs = audio.startUs;
    if (compare(fromTime(audio.endUs), fromTime(selectedEndUs)) > 0) selectedEndUs = audio.endUs;
    operands.push(
      audioFacts.metadata.originUs,
      audio.startUs,
      audio.endUs,
      run.startUs,
      run.endUs,
      toTime(rational(1000000n, BigInt(decoded.sampleRate))),
      ...audio.segments.flatMap((item) => [
        item.startUs,
        item.endUs,
        ...(item.mediaStartUs === undefined ? [] : [item.mediaStartUs]),
        ...(item.mediaDurationUs === undefined ? [] : [item.mediaDurationUs]),
      ]),
    );
  }
  let movieTimescale = 1n;
  for (const value of operands) {
    const time = fromTime(value);
    const denominator = rational(time.numerator, time.denominator * 1000000n).denominator;
    movieTimescale *= rational(denominator, movieTimescale).numerator;
    if (movieTimescale > 2147483647n)
      throw new CatalogError("UNSUPPORTED_MEDIA", "HDR movie clock is not exactly representable");
  }
  return {
    sourceClockAtDerivativeZeroUs,
    sourceSupport: { startUs: sourceClockAtDerivativeZeroUs, endUs: selectedEndUs },
    movieTimescale: Number(movieTimescale),
  };
}

export function validateHdrDerivative(
  source: HdrConversionFacts,
  output: HdrConversionFacts,
  sourceAudio?: HdrAudioConversionFacts,
  outputAudio?: HdrAudioConversionFacts,
) {
  const clock = prepareHdrClock(source, sourceAudio);
  const offset = fromTime(clock.sourceClockAtDerivativeZeroUs);
  const before = source.video;
  const after = output.video;
  const same = (a: SignedTimeValue, b: SignedTimeValue) => compare(fromTime(a), fromTime(b)) === 0;
  const mapped = (a: SignedTimeValue, b: SignedTimeValue) =>
    compare(subtract(fromTime(a), offset), fromTime(b)) === 0;
  const occupied = after.segments.filter((segment) => !segment.empty);
  const segment = occupied[0];
  const color = after.colorFormats[0];
  if (
    output.metadata.streams.length !== (sourceAudio ? 2 : 1) ||
    after.codec !== "ap4h" ||
    after.hasAlpha ||
    before.width !== after.width ||
    before.height !== after.height ||
    before.orientedWidth !== after.orientedWidth ||
    before.orientedHeight !== after.orientedHeight ||
    before.transform.some((value, index) => value !== after.transform[index]) ||
    compare(add(fromTime(source.metadata.originUs), offset), fromTime(output.metadata.originUs)) !==
      0 ||
    !mapped(before.startUs, after.startUs) ||
    !mapped(before.endUs, after.endUs) ||
    before.samples.count !== after.samples.count ||
    before.samples.presentedTimingSha256 !== after.samples.presentedTimingSha256 ||
    !mapped(before.samples.firstTimeUs, after.samples.firstTimeUs) ||
    !mapped(before.samples.lastTimeUs, after.samples.lastTimeUs) ||
    !same(before.samples.lastDurationUs, after.samples.lastDurationUs) ||
    before.samples.minDurationUs !== after.samples.minDurationUs ||
    before.samples.maxDurationUs !== after.samples.maxDurationUs ||
    occupied.length !== 1 ||
    !segment ||
    !same(segment.startUs, after.startUs) ||
    !same(segment.endUs, after.endUs) ||
    segment.mediaStartUs === undefined ||
    !same(segment.mediaStartUs, 0) ||
    segment.mediaDurationUs === undefined ||
    compare(
      fromTime(segment.mediaDurationUs),
      subtract(fromTime(after.endUs), fromTime(after.startUs)),
    ) !== 0 ||
    after.colorFormats.length !== 1 ||
    !color ||
    color.colorPrimaries !== "ITU_R_709_2" ||
    color.transferFunction !== "ITU_R_709_2" ||
    color.ycbcrMatrix !== "ITU_R_709_2" ||
    color.bitsPerComponent !== 12 ||
    color.fullRange === true ||
    color.interpretationExtensions.length !== 0 ||
    color.invalidColorDeclarations.length !== 0 ||
    after.codecAtomNames.length !== 1 ||
    after.codecAtomNames[0]!.length !== 0
  )
    throw new CatalogError(
      "INVALID_NATIVE_RESPONSE",
      "HDR derivative changed physical support or declared interpretation",
    );
  if (sourceAudio) {
    if (!outputAudio)
      throw new CatalogError("INVALID_NATIVE_RESPONSE", "HDR derivative omitted selected audio");
    try {
      prepareHdrClock(output, outputAudio);
    } catch {
      throw new CatalogError(
        "INVALID_NATIVE_RESPONSE",
        "HDR derivative audio support is unqualified",
      );
    }
    const beforeAudio = sourceAudio.audio;
    const afterAudio = outputAudio.audio;
    const beforeDecoded = beforeAudio.decodedAudioInspection;
    const afterDecoded = afterAudio.decodedAudioInspection;
    if (
      output.metadata.streams.filter((item) => item.kind === "audio").length !== 1 ||
      !output.metadata.streams.some((item) => item.kind === "audio" && item.id === afterAudio.id) ||
      beforeAudio.codec !== afterAudio.codec ||
      beforeAudio.sampleRate !== afterAudio.sampleRate ||
      beforeAudio.channels !== afterAudio.channels ||
      beforeAudio.channelLayoutTag !== afterAudio.channelLayoutTag ||
      beforeDecoded.frames !== afterDecoded.frames ||
      beforeDecoded.pcmSha256 !== afterDecoded.pcmSha256 ||
      !mapped(beforeAudio.startUs, afterAudio.startUs) ||
      !mapped(beforeAudio.endUs, afterAudio.endUs) ||
      !mapped(beforeDecoded.runs[0]!.startUs, afterDecoded.runs[0]!.startUs) ||
      !mapped(beforeDecoded.runs[0]!.endUs, afterDecoded.runs[0]!.endUs)
    )
      throw new CatalogError(
        "INVALID_NATIVE_RESPONSE",
        "HDR derivative changed selected decoded audio or its common-clock support",
      );
  } else if (outputAudio) {
    throw new CatalogError("INVALID_NATIVE_RESPONSE", "HDR derivative added unselected audio");
  }
  return output;
}

export type HdrDerivativeEvidence = {
  source: HdrConversionFacts;
  output: HdrConversionFacts;
  sourceAudio?: HdrAudioConversionFacts;
  outputAudio?: HdrAudioConversionFacts;
  family: "pq" | "hlg";
  clock: ReturnType<typeof prepareHdrClock>;
};

/** Private selected-stream producer. The caller retains the source lease; this owner
 * prepares and validates inside one existing held attempt, never by donor path. */
export async function withHdrDerivative<Result>(
  worker: MediaWorker,
  request: {
    attemptParent: string;
    source: { file: FileHandle; bytes: number; sha256: string };
    streamId: string;
    audioStreamId?: string;
    ffmpeg: string;
    ffprobe: string;
    ownerExecutable: string;
  },
  signal: AbortSignal,
  consume: (artifact: FfmpegArtifact<HdrDerivativeEvidence>) => Promise<Result>,
): Promise<Result> {
  return withRenderAttempt(
    worker,
    request.attemptParent,
    signal,
    async (directory, boundWorker, authority) => {
      const { file, bytes, sha256 } = request.source;
      const identity = fileIdentity(await file.stat({ bigint: true }));
      if ((await hashFile(file, bytes, signal)).sha256 !== sha256)
        throw new CatalogError("SOURCE_CHANGED", "HDR source differs from its immutable identity");
      const rawSource = await readMediaProbe(
        boundWorker,
        directory,
        "/dev/fd/3",
        signal,
        [file.fd],
        {
          inspectCompressedVideo: true,
          ...(request.audioStreamId ? { inspectAudioStreamId: request.audioStreamId } : {}),
        },
      );
      const source = readHdrConversionFacts(rawSource, request.streamId);
      const sourceAudio = request.audioStreamId
        ? readHdrAudioConversionFacts(rawSource, request.audioStreamId)
        : undefined;
      const input = await inspectFfmpegInput(
        { executable: request.ffprobe, ownerExecutable: request.ownerExecutable },
        {
          file,
          metadata: source.metadata,
          streamId: request.streamId,
          signal,
          lifetimes: authority.descriptors,
          inspectColor: true,
        },
      );
      const audioInput = sourceAudio
        ? await inspectFfmpegInput(
            { executable: request.ffprobe, ownerExecutable: request.ownerExecutable },
            {
              file,
              metadata: sourceAudio.metadata,
              streamId: sourceAudio.audio.id,
              signal,
              lifetimes: authority.descriptors,
            },
          )
        : undefined;
      const { family } = qualifyHdrInterpretation(source, input.color!);
      const clock = prepareHdrClock(source, sourceAudio);
      const recipe = `zscale=pin=bt2020:tin=${family === "pq" ? "smpte2084" : "arib-std-b67"}:min=bt2020nc:rin=limited:t=linear:npl=100:agamma=0,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0:peak=10,zscale=t=bt709:m=bt709:r=limited:dither=error_diffusion:agamma=0,format=yuv444p10le,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=limited`;
      return withFfmpegArtifact(
        boundWorker,
        {
          attempt: { directory, worker: boundWorker, authority },
          filename: "hdr-sdr.mov",
          executable: request.ffmpeg,
          ownerExecutable: request.ownerExecutable,
          descriptors: [file.fd],
          rewindDescriptors: [3],
          timeoutMs: renderWindowDeadlineMs(clock.sourceSupport),
          maxBytes: 4096,
          args: (slot) => [
            "-v",
            "error",
            ...input.args,
            "-map",
            input.map,
            ...(audioInput ? ["-map", audioInput.map, "-c:a", "copy"] : ["-an"]),
            "-map_chapters",
            "-1",
            "-vf",
            recipe,
            "-fps_mode",
            "passthrough",
            "-enc_time_base",
            "demux",
            "-movie_timescale",
            String(clock.movieTimescale),
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
            "-write_tmcd",
            "0",
            "-f",
            "mov",
            "-fd",
            String(slot),
            "fd:",
          ],
        },
        signal,
        async (outputFile, validationSignal, validationWorker) => {
          let raw = await readMediaProbe(
            validationWorker,
            directory,
            "/dev/fd/3",
            validationSignal,
            [outputFile.fd],
          );
          const metadata = mediaProbeSchema.parse(raw);
          const selected = metadata.streams.find((stream) => stream.kind === "video");
          if (!selected)
            throw new CatalogError("INVALID_NATIVE_RESPONSE", "HDR derivative omitted video");
          let outputAudio: HdrAudioConversionFacts | undefined;
          if (sourceAudio) {
            const audio = metadata.streams.filter((item) => item.kind === "audio");
            if (audio.length !== 1)
              throw new CatalogError(
                "INVALID_NATIVE_RESPONSE",
                "HDR derivative audio selection changed",
              );
            raw = await readMediaProbe(
              validationWorker,
              directory,
              "/dev/fd/3",
              validationSignal,
              [outputFile.fd],
              { inspectAudioStreamId: audio[0]!.id },
            );
            outputAudio = readHdrAudioConversionFacts(raw, audio[0]!.id);
          }
          const output = validateHdrDerivative(
            source,
            readHdrConversionFacts(raw, selected.id),
            sourceAudio,
            outputAudio,
          );
          if (!isDeepStrictEqual(identity, fileIdentity(await file.stat({ bigint: true }))))
            throw new CatalogError("SOURCE_CHANGED", "HDR source changed during conversion");
          return {
            source,
            output,
            ...(sourceAudio ? { sourceAudio } : {}),
            ...(outputAudio ? { outputAudio } : {}),
            family,
            clock,
          };
        },
        consume,
      );
    },
    async (result) => result,
  );
}
