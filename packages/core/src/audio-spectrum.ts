import { setImmediate } from "node:timers/promises";
import { CatalogError } from "./catalog.js";
import type { RetainedRead } from "./files.js";
import { sampleGrid, validateAudioWave, type AudioSamples } from "./audio-wave.js";

export type SpectralOptions = {
  fftFrames: number;
  hopFrames: number;
  window?: "hann" | "rectangular";
  sampleRange?: { start: number; end: number };
};
/** Unnormalized forward radix-two transform; spectrum normalization belongs to the window owner. */
function transform(real: Float64Array, imaginary: Float64Array) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j]!, real[i]!];
      [imaginary[i], imaginary[j]] = [imaginary[j]!, imaginary[i]!];
    }
  }
  for (let length = 2; length <= n; length *= 2) {
    const angle = (-2 * Math.PI) / length,
      stepReal = Math.cos(angle),
      stepImaginary = Math.sin(angle);
    for (let begin = 0; begin < n; begin += length) {
      let wr = 1,
        wi = 0;
      for (let j = 0; j < length / 2; j++) {
        const even = begin + j,
          odd = even + length / 2,
          vr = real[odd]! * wr - imaginary[odd]! * wi,
          vi = real[odd]! * wi + imaginary[odd]! * wr;
        real[odd] = real[even]! - vr;
        imaginary[odd] = imaginary[even]! - vi;
        real[even] = real[even]! + vr;
        imaginary[even] = imaginary[even]! + vi;
        const next = wr * stepReal - wi * stepImaginary;
        wi = wr * stepImaginary + wi * stepReal;
        wr = next;
      }
    }
  }
}
/** Plan the displayed grid and surrounding PCM before preparing or opening audio. */
export function spectralLayout(
  audio: Pick<AudioSamples, "sampleRange" | "frames" | "channels">,
  options: SpectralOptions,
) {
  const n = options.fftFrames,
    hop = options.hopFrames,
    window = options.window ?? "hann";
  if (
    !Number.isInteger(n) ||
    n < 16 ||
    n > 8192 ||
    (n & (n - 1)) !== 0 ||
    !Number.isInteger(hop) ||
    hop < 1 ||
    hop > n ||
    !["hann", "rectangular"].includes(window)
  )
    throw new CatalogError(
      "INVALID_PARAMS",
      "Spectrum needs a power-of-two fftFrames from 16 through 8192, hopFrames from 1 through fftFrames, and hann or rectangular window",
    );
  const { range, firstGrid } = sampleGrid(audio, {
    bucketFrames: hop,
    ...(options.sampleRange ? { sampleRange: options.sampleRange } : {}),
  });
  const count = Math.ceil((range.end - firstGrid) / hop),
    bins = n / 2 + 1,
    cells = count * bins * audio.channels;
  if (cells > 262144)
    throw new CatalogError(
      "LIMIT_EXCEEDED",
      "Spectrum exceeds 262144 channel/time/frequency cells; narrow the window or increase hopFrames",
      { maximumCells: 262144 },
    );
  const context = {
    start: firstGrid + Math.floor(hop / 2) - n / 2,
    end: firstGrid + (count - 1) * hop + Math.floor(hop / 2) + n / 2,
  };
  if (!Number.isSafeInteger(context.start) || !Number.isSafeInteger(context.end))
    throw new CatalogError(
      "INVALID_RANGE",
      "Spectrum analysis window exceeds safe sample accounting",
    );
  return { range, firstGrid, count, bins, cells, context, fftFrames: n, hopFrames: hop, window };
}
/** No detrending/downmixing. Caller retains the same published PCM lease through every yield. */
export async function spectralWindows(
  file: RetainedRead,
  audio: AudioSamples,
  options: SpectralOptions,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const {
    range,
    firstGrid,
    count,
    bins,
    cells,
    fftFrames: n,
    hopFrames: hop,
    window,
  } = spectralLayout(audio, options);
  const { dataOffset } = validateAudioWave(file, audio),
    block = Buffer.alloc(n * audio.channels * 4),
    weights = new Float64Array(n),
    real = new Float64Array(n),
    imaginary = new Float64Array(n),
    density = new Float64Array(cells);
  let energy = 0,
    readFrames = 0;
  for (let i = 0; i < n; i++) {
    weights[i] = window === "hann" ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n) : 1;
    energy += weights[i]! ** 2;
  }
  const columns: {
    gridStart: number;
    sampleRange: { start: number; end: number };
    center: number;
    analysis: { start: number; end: number };
    available: { start: number; end: number };
    partial: boolean;
  }[] = [];
  for (let index = 0; index < count; index++) {
    signal.throwIfAborted();
    const gridStart = firstGrid + index * hop,
      center = gridStart + Math.floor(hop / 2),
      analysis = { start: center - n / 2, end: center + n / 2 };
    const available = {
      start: Math.max(analysis.start, audio.sampleRange.start),
      end: Math.min(analysis.end, audio.sampleRange.end),
    };
    const frames = available.end - available.start,
      bytes = frames * audio.channels * 4;
    if (
      file.read(
        block.subarray(0, bytes),
        dataOffset + (available.start - audio.sampleRange.start) * audio.channels * 4,
      ) !== bytes
    )
      throw new CatalogError("INVALID_RESPONSE", "Truncated spectrum PCM");
    readFrames += frames;
    for (let channel = 0; channel < audio.channels; channel++) {
      real.fill(0);
      imaginary.fill(0);
      for (let i = 0; i < frames; i++) {
        const value = block.readFloatLE((i * audio.channels + channel) * 4);
        if (!Number.isFinite(value))
          throw new CatalogError("INVALID_RESPONSE", "Spectrum PCM contains a non-finite sample");
        const at = available.start - analysis.start + i;
        real[at] = value * weights[at]!;
      }
      transform(real, imaginary);
      for (let bin = 0; bin < bins; bin++)
        density[(index * audio.channels + channel) * bins + bin] =
          ((real[bin]! ** 2 + imaginary[bin]! ** 2) / (audio.sampleRate * energy)) *
          (bin === 0 || bin === n / 2 ? 1 : 2);
    }
    columns.push({
      gridStart,
      sampleRange: {
        start: Math.max(gridStart, range.start),
        end: Math.min(gridStart + hop, range.end),
      },
      center,
      analysis,
      available,
      partial: frames !== n,
    });
    await setImmediate(undefined, { signal });
  }
  return {
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    sampleRange: range,
    fftFrames: n,
    hopFrames: hop,
    window,
    windowEnergy: energy,
    frequency: { bins, binHz: audio.sampleRate / n, firstHz: 0, lastHz: audio.sampleRate / 2 },
    units: "full-scale-squared/Hz" as const,
    layout: "column-channel-frequency" as const,
    columns,
    density,
    readFrames,
  };
}
