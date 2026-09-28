import type { waveformBuckets } from "./audio-wave.js";
import type { spectralWindows } from "./audio-spectrum.js";
import type { WaveformArtifact } from "./waveform.js";
import { CatalogError } from "./catalog.js";

type Waveform = Awaited<ReturnType<typeof waveformBuckets>>;
type Spectrum = Awaited<ReturnType<typeof spectralWindows>>;
type Span = { start: number; end: number };
type Metadata<T> = T extends unknown
  ? Omit<
      T,
      | "file"
      | "bytes"
      | "mediaType"
      | "cacheId"
      | "bucketFrames"
      | "bucketCount"
    >
  : never;
export type AcousticMetadata = Metadata<WaveformArtifact>;
export type AcousticImageRequest = {
  output: string;
  kind: "waveform" | "spectrum";
  domain: "source" | "project";
  provenance: string[];
  sampleRate: number;
  channels: number;
  range: Span;
  columns: { range: Span; partial: boolean; values: number[][] }[];
  unavailable: Span[];
  bins?: number;
  binHz?: number;
};
/** Converts retained measurements to one bounded renderer request; never reacquires PCM. */
export function acousticImageRequest(
  metadata: AcousticMetadata,
  evidence:
    { kind: "waveform"; data: Waveform } | { kind: "spectrum"; data: Spectrum },
  output: string,
): AcousticImageRequest {
  const data = evidence.data;
  if (
    metadata.sampleRate !== data.sampleRate ||
    metadata.channels !== data.channels ||
    metadata.sampleRange.start > data.sampleRange.start ||
    metadata.sampleRange.end < data.sampleRange.end
  )
    throw new CatalogError(
      "INVALID_RESPONSE",
      "Acoustic measurements disagree with their audio provenance",
    );
  const project = metadata.domain === "project";
  // A mixed output may retain other audible contributors through a missing source interval.
  // The overlay means incomplete support, never that the whole mix is silent.
  const spans: Span[] = [];
  for (const entry of metadata.unavailable) {
    if ("ranges" in entry) spans.push(...entry.ranges);
    else {
      const rate = BigInt(data.sampleRate);
      spans.push({
        start: Number((BigInt(entry.startUs) * rate) / 1_000_000n),
        end: Number((BigInt(entry.endUs) * rate + 999_999n) / 1_000_000n),
      });
    }
  }
  const unavailable: Span[] = [];
  for (const source of spans.sort((a, b) => a.start - b.start)) {
    const span = {
      start: Math.max(source.start, data.sampleRange.start),
      end: Math.min(source.end, data.sampleRange.end),
    };
    if (span.start >= span.end) continue;
    const last = unavailable.at(-1);
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else unavailable.push(span);
  }
  const provenance = [
    project
      ? `project ${metadata.projectId} | revision ${metadata.revisionId}`
      : `asset ${metadata.assetId} | stream ${metadata.streamId}`,
    `audio ${metadata.audio.jobId} | generation ${metadata.audio.generation}`,
    project
      ? `tap ${JSON.stringify(metadata.tap)}`
      : `support ${metadata.supportDigest}`,
  ];
  if (evidence.kind === "spectrum")
    provenance.push(
      `FFT ${evidence.data.fftFrames} frames | hop ${evidence.data.hopFrames} frames | ${evidence.data.window} window | clipped PCM support is zero-padded`,
    );
  const common = {
    output,
    domain: metadata.domain,
    provenance,
    sampleRate: data.sampleRate,
    channels: data.channels,
    range: data.sampleRange,
    unavailable,
  };
  if (evidence.kind === "waveform")
    return {
      ...common,
      kind: "waveform",
      columns: evidence.data.buckets.map((bucket) => ({
        range: bucket.sampleRange,
        partial: bucket.partial,
        values: bucket.channels.map(({ min, max, rms }) => [min, max, rms]),
      })),
    };
  const spectrum = evidence.data;
  return {
    ...common,
    kind: "spectrum",
    bins: spectrum.frequency.bins,
    binHz: spectrum.frequency.binHz,
    columns: spectrum.columns.map((column, index) => ({
      range: column.sampleRange,
      partial: column.partial,
      values: Array.from({ length: spectrum.channels }, (_, channel) => {
        const start =
          (index * spectrum.channels + channel) * spectrum.frequency.bins;
        return Array.from(
          spectrum.density.subarray(start, start + spectrum.frequency.bins),
        );
      }),
    })),
  };
}
