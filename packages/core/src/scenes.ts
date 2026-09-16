import { CatalogError } from "./library.js";
import type { TimeRange } from "./timeline.js";

/** Measured visual change, not recognition of a scene's meaning. */
export const scenePolicy = Object.freeze({
  id: "rgb-spatial-change-v1",
  stepUs: 200_000,
  maximumRangeUs: 10_000_000,
  changedChannelDelta: 24,
  gridColumns: 8,
  gridRows: 8,
  activeCellFraction: 0.05,
  broadPixelFraction: 0.3,
  spatialPixelFraction: 0.04,
  broadCellFraction: 0.5,
});
export type VisualSample = {
  requestedSourceUs: number;
  actualSourceUs: number;
  distanceUs: number;
  width: number;
  height: number;
  rgbBase64: string;
};
export type VisualObservations = {
  sourceWidth: number;
  sourceHeight: number;
  samples: VisualSample[];
};
export type VisualSampler = (
  request: { source: string; kept: TimeRange; atSourceUs: number[] },
  signal: AbortSignal,
) => Promise<VisualObservations>;
export type VisualComparison = {
  previousActualSourceUs: number;
  actualSourceUs: number;
  changedPixelFraction: number;
  changedCellFraction: number;
  meanAbsoluteChannelDifference: number;
  boundary: boolean;
};
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function interval(range: TimeRange): void {
  if (!integer(range.startUs) || !integer(range.endUs) || range.endUs <= range.startUs)
    throw new CatalogError("INVALID_RANGE", "Scene analysis requires a nonempty source interval");
}
function pixels(sample: VisualSample): Buffer {
  if (
    !integer(sample.requestedSourceUs) ||
    !integer(sample.actualSourceUs) ||
    sample.distanceUs !== Math.abs(sample.actualSourceUs - sample.requestedSourceUs) ||
    !Number.isInteger(sample.width) ||
    sample.width < 1 ||
    sample.width > 64 ||
    !Number.isInteger(sample.height) ||
    sample.height < 1 ||
    sample.height > 64
  )
    invalid("Invalid visual sample timing or dimensions");
  const bytes = sample.width * sample.height * 3;
  if (sample.rgbBase64.length !== 4 * Math.ceil(bytes / 3)) invalid("Invalid RGB byte length");
  const result = Buffer.from(sample.rgbBase64, "base64");
  if (result.length !== bytes || result.toString("base64") !== sample.rgbBase64)
    invalid("Invalid RGB encoding");
  return result;
}

/** Explicit pairs make chunk continuity and repeated held frames share one comparison policy. */
export function compareVisualSamples(
  previous: VisualSample,
  current: VisualSample,
): VisualComparison {
  const before = pixels(previous),
    after = pixels(current);
  if (
    current.actualSourceUs <= previous.actualSourceUs ||
    current.width !== previous.width ||
    current.height !== previous.height
  )
    invalid("Visual comparison requires later source time and matching raster dimensions");
  const columns = Math.min(scenePolicy.gridColumns, current.width);
  const rows = Math.min(scenePolicy.gridRows, current.height);
  const changed = new Uint16Array(columns * rows),
    total = new Uint16Array(columns * rows);
  let changedPixels = 0,
    channelDifference = 0;
  for (let y = 0; y < current.height; y++) {
    for (let x = 0; x < current.width; x++) {
      const offset = (y * current.width + x) * 3;
      const differences = [0, 1, 2].map((channel) =>
        Math.abs(before[offset + channel]! - after[offset + channel]!),
      );
      channelDifference += differences[0]! + differences[1]! + differences[2]!;
      const cell =
        Math.floor((y * rows) / current.height) * columns +
        Math.floor((x * columns) / current.width);
      total[cell] = total[cell]! + 1;
      if (Math.max(...differences) >= scenePolicy.changedChannelDelta) {
        changedPixels++;
        changed[cell] = changed[cell]! + 1;
      }
    }
  }
  const changedPixelFraction = changedPixels / (current.width * current.height);
  const changedCellFraction =
    Array.from(changed).filter((count, i) => count / total[i]! >= scenePolicy.activeCellFraction)
      .length / changed.length;
  return {
    previousActualSourceUs: previous.actualSourceUs,
    actualSourceUs: current.actualSourceUs,
    changedPixelFraction,
    changedCellFraction,
    meanAbsoluteChannelDifference: channelDifference / (before.length * 255),
    boundary:
      changedPixelFraction >= scenePolicy.broadPixelFraction ||
      (changedPixelFraction >= scenePolicy.spatialPixelFraction &&
        changedCellFraction >= scenePolicy.broadCellFraction),
  };
}

/** Whole-recording chunks can pass the preceding chunk's final observation without a second detector. */
export function analyzeVisualSamples(samples: readonly VisualSample[], previous?: VisualSample) {
  if (samples.length === 0 || samples.length > 52)
    invalid("Visual analysis requires 1...52 observations");
  const comparisons: VisualComparison[] = [];
  let last = previous;
  if (last) pixels(last);
  for (const sample of samples) {
    pixels(sample);
    if (last) {
      if (
        sample.requestedSourceUs <= last.requestedSourceUs ||
        sample.actualSourceUs < last.actualSourceUs
      )
        invalid("Visual observations must progress in request and source order");
      if (sample.actualSourceUs === last.actualSourceUs) {
        if (
          sample.width !== last.width ||
          sample.height !== last.height ||
          sample.rgbBase64 !== last.rgbBase64
        )
          invalid("A held source sample cannot change its pixels");
      } else comparisons.push(compareVisualSamples(last, sample));
    }
    last = sample;
  }
  return { policy: scenePolicy.id, comparisons, lastSample: last! };
}

/** Source-anchored grid plus one predecessor and endpoint; selection remains native's job. */
export function sceneSampleTimes(range: TimeRange, kept: TimeRange): number[] {
  interval(range);
  interval(kept);
  if (
    range.startUs < kept.startUs ||
    range.endUs > kept.endUs ||
    range.endUs - range.startUs > scenePolicy.maximumRangeUs
  )
    throw new CatalogError(
      "INVALID_RANGE",
      "Scene interval must fit the kept span and ten-second limit",
    );
  const step = scenePolicy.stepUs;
  const first = Math.max(kept.startUs, Math.ceil(range.startUs / step) * step - step);
  const endpoint = Math.min(range.endUs, kept.endUs - 1);
  const times = [first];
  for (let at = (Math.floor(first / step) + 1) * step; at <= endpoint; at += step) times.push(at);
  if (times.at(-1)! < endpoint) times.push(endpoint);
  return times;
}

export async function analyzeSceneRange(
  request: { source: string; kept: TimeRange; range: TimeRange },
  sample: VisualSampler,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const atSourceUs = sceneSampleTimes(request.range, request.kept);
  const observed = await sample({ source: request.source, kept: request.kept, atSourceUs }, signal);
  signal.throwIfAborted();
  if (
    !Number.isSafeInteger(observed.sourceWidth) ||
    observed.sourceWidth < 1 ||
    !Number.isSafeInteger(observed.sourceHeight) ||
    observed.sourceHeight < 1 ||
    observed.samples.length !== atSourceUs.length
  )
    invalid("Incomplete visual observation batch");
  for (const [index, value] of observed.samples.entries()) {
    if (
      value.requestedSourceUs !== atSourceUs[index] ||
      value.actualSourceUs < request.kept.startUs ||
      value.actualSourceUs >= request.kept.endUs
    )
      invalid("Visual sample escapes its requested grid or retained span");
  }
  const analyzed = analyzeVisualSamples(observed.samples);
  return {
    ...analyzed,
    range: request.range,
    kept: request.kept,
    sourceWidth: observed.sourceWidth,
    sourceHeight: observed.sourceHeight,
    coverage: observed.samples.map(({ rgbBase64: _, ...timing }) => timing),
    boundaries: analyzed.comparisons
      .filter(
        (pair) =>
          pair.boundary &&
          pair.actualSourceUs >= request.range.startUs &&
          pair.actualSourceUs <= request.range.endUs,
      )
      .map((pair) => ({ kind: "scene" as const, atSourceUs: pair.actualSourceUs })),
  };
}
