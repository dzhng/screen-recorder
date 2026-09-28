import { setImmediate } from "node:timers/promises";
import { CatalogError } from "./catalog.js";
import type { RetainedRead } from "./files.js";

type AudioDimensions = { bytes: number; sampleRate: number; channels: 1 | 2; frames: number };
export type AudioSamples = AudioDimensions & { sampleRange: { start: number; end: number } };
function invalid(message: string): never {
  throw new CatalogError("INVALID_RESPONSE", message);
}

/** One RIFF validator for published native PCM and bounded acoustic readers. */
export function validateAudioWave(file: RetainedRead, value: AudioDimensions) {
  if (file.bytes !== value.bytes) invalid("WAV size differs from its receipt");
  const read = (at: number, size: number) => {
    const bytes = Buffer.alloc(size);
    if (file.read(bytes, at) !== size) invalid("Truncated WAV metadata");
    return bytes;
  };
  const header = read(0, 12);
  if (
    header.toString("ascii", 0, 4) !== "RIFF" ||
    header.toString("ascii", 8, 12) !== "WAVE" ||
    header.readUInt32LE(4) + 8 !== file.bytes
  )
    invalid("Audio output is not a complete RIFF WAVE");
  let at = 12,
    format = false,
    data = false,
    dataOffset = 0,
    dataBytes = 0,
    chunks = 0;
  while (at < file.bytes) {
    if (++chunks > 128 || at + 8 > file.bytes) invalid("WAV chunk metadata exceeds its bounds");
    const chunk = read(at, 8),
      name = chunk.toString("ascii", 0, 4),
      size = chunk.readUInt32LE(4);
    at += 8;
    if (at + size + (size % 2) > file.bytes) invalid("WAV chunk exceeds the file");
    if (name === "fmt ") {
      if (format || size < 16) invalid("WAV format is missing or repeated");
      const fmt = read(at, 16);
      if (
        fmt.readUInt16LE(0) !== 3 ||
        fmt.readUInt16LE(2) !== value.channels ||
        fmt.readUInt32LE(4) !== value.sampleRate ||
        fmt.readUInt32LE(8) !== value.sampleRate * value.channels * 4 ||
        fmt.readUInt16LE(12) !== value.channels * 4 ||
        fmt.readUInt16LE(14) !== 32
      )
        invalid("WAV format differs from the native receipt");
      format = true;
    } else if (name === "data") {
      if (data || BigInt(size) !== BigInt(value.frames) * BigInt(value.channels) * 4n)
        invalid("WAV sample count differs from its receipt");
      data = true;
      dataOffset = at;
      dataBytes = size;
    }
    at += size + (size % 2);
  }
  if (!format || !data) invalid("WAV format or samples are missing");

  return { dataOffset, dataBytes };
}

export type WaveformBucket = {
  gridStart: number;
  sampleRange: { start: number; end: number };
  partial: boolean;
  channels: { min: number; max: number; rms: number }[];
};
/** Plan the absolute grid and refuse oversized detail before preparing or reading PCM. */
export function waveformLayout(
  audio: Pick<AudioSamples, "frames" | "sampleRange">,
  options: { bucketFrames: number; sampleRange?: { start: number; end: number } },
) {
  const range = options.sampleRange ?? audio.sampleRange,
    width = options.bucketFrames;
  const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (
    !integer(width) ||
    width < 1 ||
    !integer(range.start) ||
    !integer(range.end) ||
    range.end <= range.start ||
    range.start < audio.sampleRange.start ||
    range.end > audio.sampleRange.end ||
    audio.sampleRange.end - audio.sampleRange.start !== audio.frames
  )
    throw new CatalogError(
      "INVALID_RANGE",
      "Waveform window must contain samples within the published audio and bucketFrames must be a positive integer",
    );
  const firstGrid = Math.floor(range.start / width) * width;
  const count = Math.floor((range.end - 1) / width) - Math.floor(range.start / width) + 1;
  if (count > 4096)
    throw new CatalogError(
      "LIMIT_EXCEEDED",
      "Waveform request exceeds 4096 buckets; increase bucketFrames or narrow the sample window",
      { maximumBuckets: 4096 },
    );
  return { range, width, firstGrid };
}
/** The caller retains the published PCM lease until completion, including cancellation. */
export async function waveformBuckets(
  file: RetainedRead,
  audio: AudioSamples,
  options: { bucketFrames: number; sampleRange?: { start: number; end: number } },
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const { range, width, firstGrid } = waveformLayout(audio, options);
  const { dataOffset } = validateAudioWave(file, audio),
    buckets: WaveformBucket[] = [];
  const block = Buffer.alloc(8192 * audio.channels * 4);
  let at = range.start,
    bucketStart = range.start,
    gridStart = firstGrid;
  let stats = Array.from({ length: audio.channels }, () => ({
    min: Infinity,
    max: -Infinity,
    squares: 0,
  }));
  while (at < range.end) {
    signal.throwIfAborted();
    const frames = Math.min(8192, range.end - at),
      bytes = frames * audio.channels * 4;
    if (
      file.read(
        block.subarray(0, bytes),
        dataOffset + (at - audio.sampleRange.start) * audio.channels * 4,
      ) !== bytes
    )
      invalid("Truncated PCM samples");
    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < audio.channels; channel++) {
        const value = block.readFloatLE((frame * audio.channels + channel) * 4);
        if (!Number.isFinite(value)) invalid("PCM contains a non-finite sample");
        const stat = stats[channel]!;
        stat.min = Math.min(stat.min, value);
        stat.max = Math.max(stat.max, value);
        stat.squares += value * value;
      }
      at++;
      if (at === range.end || at - gridStart === width) {
        buckets.push({
          gridStart,
          sampleRange: { start: bucketStart, end: at },
          partial: at - bucketStart !== width,
          channels: stats.map((stat) => ({
            min: stat.min,
            max: stat.max,
            rms: Math.sqrt(stat.squares / (at - bucketStart)),
          })),
        });
        bucketStart = at;
        gridStart = at;
        stats = Array.from({ length: audio.channels }, () => ({
          min: Infinity,
          max: -Infinity,
          squares: 0,
        }));
      }
    }
    await setImmediate(undefined, { signal });
  }
  return {
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    sampleRange: range,
    bucketFrames: width,
    buckets,
  };
}
