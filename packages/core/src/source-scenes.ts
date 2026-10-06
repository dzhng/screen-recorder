import {
  rational,
  subtract,
  fromTime,
  add,
  compare,
  round,
  ceil,
  type TimeValue,
  type SignedTimeValue,
  type SelectionRange,
} from "@yap/composition";
import { isDeepStrictEqual } from "node:util";
import type { CompositionAssetBinding } from "./project-window.js";
import type { TimeRange } from "./presentation-time.js";
import { CatalogError } from "./catalog.js";
import { compareVisualRasters, scenePolicy, sceneSampleTimes } from "./scenes.js";

/** Presentation membership and gap resets differ from the recording nearest-sample policy. */
export const sourceScenePolicy = `${scenePolicy.id}-presentation-v1`;
export type SceneSampleClock = {
  value: string;
  timescale: number;
  endValue: string;
  endTimescale: number;
};
export type SourceVisualPoint = { requestedSourceUs: number; continuousFromPrevious: boolean } & (
  | { status: "unavailable"; reason: "outside_support" | "empty_edit" }
  | {
      status: "available";
      actualSourceUs: number;
      sample: SceneSampleClock;
      width: number;
      height: number;
      rgbBase64: string;
    }
);
export type SourceVisualRequest = {
  asset: CompositionAssetBinding;
  available: readonly SelectionRange[];
  atSourceUs: number[];
};
export type SourceVisualObservations = {
  assetId: string;
  streamId: string;
  originUs: SignedTimeValue;
  sourceWidth: number;
  sourceHeight: number;
  samples: SourceVisualPoint[];
  decodedSamples: number;
  readerOpens: number;
};
export type SourceVisualSampler = (
  request: SourceVisualRequest,
  signal: AbortSignal,
) => Promise<SourceVisualObservations>;
type Available = Extract<SourceVisualPoint, { status: "available" }>;
type Coverage =
  | Exclude<SourceVisualPoint, Available>
  | (Omit<Available, "rgbBase64"> & { stillnessRunStartUs: number });
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function stamp(clock: SceneSampleClock) {
  if (
    !/^-?\d+$/.test(clock.value) ||
    !/^-?\d+$/.test(clock.endValue) ||
    !Number.isInteger(clock.timescale) ||
    clock.timescale <= 0 ||
    clock.timescale > 2147483647 ||
    !Number.isInteger(clock.endTimescale) ||
    clock.endTimescale <= 0 ||
    clock.endTimescale > 2147483647
  )
    invalid("Invalid presentation clock");
  return {
    start: BigInt(clock.value),
    scale: BigInt(clock.timescale),
    end: BigInt(clock.endValue),
    endScale: BigInt(clock.endTimescale),
  };
}
export function compareSceneSampleClocks(a: SceneSampleClock, b: SceneSampleClock) {
  const left = BigInt(a.value) * BigInt(b.timescale),
    right = BigInt(b.value) * BigInt(a.timescale);
  return left < right ? -1 : left > right ? 1 : 0;
}
export function sceneSampleSourceTime(
  sample: Pick<SceneSampleClock, "value" | "timescale"> &
    Partial<Pick<SceneSampleClock, "endValue" | "endTimescale">>,
  originUs: SignedTimeValue,
) {
  return subtract(
    rational(BigInt(sample.value) * 1000000n, BigInt(sample.timescale)),
    fromTime(originUs),
  );
}
export function validateSceneSampleClock(
  sample: SceneSampleClock,
  requestedSourceUs: number,
  actualSourceUs: number,
  originUs: SignedTimeValue,
) {
  const { start, scale, end, endScale } = stamp(sample);
  const at = add(fromTime(requestedSourceUs), fromTime(originUs));
  if (
    compare(rational(start * 1000000n, scale), at) > 0 ||
    compare(rational(end * 1000000n, endScale), at) <= 0 ||
    round(sceneSampleSourceTime(sample, originUs)) !== actualSourceUs
  )
    invalid("Visual sample does not contain its request");
}
function validate(point: SourceVisualPoint, request: SourceVisualRequest, index: number) {
  if (
    point.requestedSourceUs !== request.atSourceUs[index] ||
    typeof point.continuousFromPrevious !== "boolean"
  )
    invalid("Visual observations changed the requested grid");
  const acquired = request.available.find(
    (s) =>
      compare(fromTime(s.startUs), fromTime(point.requestedSourceUs)) <= 0 &&
      compare(fromTime(point.requestedSourceUs), fromTime(s.endUs)) < 0,
  );
  if (point.status === "unavailable") {
    if (
      point.continuousFromPrevious ||
      (point.reason !== "outside_support" && point.reason !== "empty_edit") ||
      (point.reason === "outside_support") !== !acquired
    )
      invalid("Invalid visual gap");
    return;
  }
  if (point.status !== "available" || !acquired || !Number.isSafeInteger(point.actualSourceUs))
    invalid("Invalid acquired visual observation");
  validateSceneSampleClock(
    point.sample,
    point.requestedSourceUs,
    point.actualSourceUs,
    request.asset.originUs,
  );
  compareVisualRasters(point, point);
  if (index === 0 && point.continuousFromPrevious)
    invalid("First observation cannot claim predecessor continuity");
  if (index > 0 && point.continuousFromPrevious) {
    const previous = request.atSourceUs[index - 1]!;
    const before = request.available.findIndex(
      (s) =>
        compare(fromTime(s.startUs), fromTime(previous)) <= 0 &&
        compare(fromTime(previous), fromTime(s.endUs)) < 0,
    );
    const current = request.available.indexOf(acquired);
    if (before < 0) invalid("Visual continuity crosses acquisition gap");
    for (let i = before; i < current; i++) {
      if (
        compare(
          fromTime(request.available[i]!.endUs),
          fromTime(request.available[i + 1]!.startUs),
        ) !== 0
      )
        invalid("Visual continuity crosses acquisition gap");
    }
  }
}

/** Each batch repeats its retained endpoint, so continuity never includes an already-consumed gap. */
export function sourceSceneSampleTimes(range: TimeRange, durationUs: TimeValue) {
  const grid = sceneSampleTimes(range, { startUs: 0, endUs: ceil(fromTime(durationUs)) });
  return [range.startUs, ...grid.filter((at) => at > range.startUs)];
}

/** Source analysis commits one overlap observation and pixel envelope only after the chunk succeeds. */
export class SelectedSourceSceneAnalysis {
  private throughUs = 0;
  private dimensions: { width: number; height: number } | undefined;
  private state: {
    recent?: { point: SourceVisualPoint; coverage: Coverage };
    last?: Available | undefined;
    minimum?: Buffer | undefined;
    maximum?: Buffer | undefined;
    runStart?: number | undefined;
  } = {};
  constructor(
    private readonly source: Omit<SourceVisualRequest, "atSourceUs">,
    private readonly durationUs: TimeValue,
    private readonly sampler: SourceVisualSampler,
  ) {}

  async analyze(range: TimeRange, signal: AbortSignal) {
    const atSourceUs = sourceSceneSampleTimes(range, this.durationUs);
    if (range.startUs !== this.throughUs) invalid("Source analysis requires contiguous chunks");
    const request = { ...this.source, atSourceUs };
    signal.throwIfAborted();
    const observed = await this.sampler(request, signal);
    signal.throwIfAborted();
    if (
      observed.assetId !== request.asset.assetId ||
      observed.streamId !== request.asset.streamId ||
      compare(fromTime(observed.originUs), fromTime(request.asset.originUs)) !== 0 ||
      observed.samples.length !== atSourceUs.length ||
      !Number.isSafeInteger(observed.sourceWidth) ||
      observed.sourceWidth < 1 ||
      observed.sourceWidth > 8192 ||
      !Number.isSafeInteger(observed.sourceHeight) ||
      observed.sourceHeight < 1 ||
      observed.sourceHeight > 8192 ||
      !Number.isSafeInteger(observed.decodedSamples) ||
      observed.decodedSamples < 0 ||
      observed.readerOpens !== 1
    )
      invalid("Visual batch changed source identity or dimensions");
    if (
      this.dimensions &&
      (this.dimensions.width !== observed.sourceWidth ||
        this.dimensions.height !== observed.sourceHeight)
    )
      invalid("Source dimensions changed across scene chunks");
    observed.samples.forEach((point, index) => validate(point, request, index));
    const comparisons: ({
      previous: SceneSampleClock;
      current: SceneSampleClock;
      actualSourceUs: number;
    } & ReturnType<typeof compareVisualRasters>)[] = [];
    const coverage: Coverage[] = [];
    const state = {
      ...this.state,
      minimum: this.state.minimum && Buffer.from(this.state.minimum),
      maximum: this.state.maximum && Buffer.from(this.state.maximum),
    };

    for (const point of observed.samples) {
      const overlap =
        state.recent?.point.requestedSourceUs === point.requestedSourceUs
          ? state.recent
          : undefined;
      if (overlap) {
        // The first observation in each native batch has no in-batch predecessor.
        const { continuousFromPrevious: _a, ...before } = overlap.point;
        const { continuousFromPrevious: _b, ...after } = point;
        if (!isDeepStrictEqual(before, after))
          invalid("Overlapping presentation observations changed");
        coverage.push(overlap.coverage);
        continue;
      }
      if (point.status === "unavailable" || !point.continuousFromPrevious) {
        state.last = undefined;
        state.minimum = undefined;
        state.maximum = undefined;
        state.runStart = undefined;
      }
      let row: Coverage;
      if (point.status === "unavailable") row = point;
      else {
        if (state.last) {
          const order = compareSceneSampleClocks(state.last.sample, point.sample);
          if (order > 0) invalid("Presentation samples moved backwards");
          if (
            order === 0 &&
            (state.last.rgbBase64 !== point.rgbBase64 ||
              state.last.width !== point.width ||
              state.last.height !== point.height)
          )
            invalid("A held presentation sample changed pixels");
          if (order < 0)
            comparisons.push({
              previous: state.last.sample,
              current: point.sample,
              actualSourceUs: point.actualSourceUs,
              ...compareVisualRasters(state.last, point),
            });
        }
        const rgb = Buffer.from(point.rgbBase64, "base64");
        let within = !!state.minimum && state.minimum.length === rgb.length;
        if (within)
          for (let i = 0; i < rgb.length; i++) {
            if (
              Math.max(state.maximum![i]!, rgb[i]!) - Math.min(state.minimum![i]!, rgb[i]!) >
              scenePolicy.stillnessChannelRange
            ) {
              within = false;
              break;
            }
          }
        if (!within) {
          state.minimum = Buffer.from(rgb);
          state.maximum = Buffer.from(rgb);
          state.runStart = point.requestedSourceUs;
        } else
          for (let i = 0; i < rgb.length; i++) {
            state.minimum![i] = Math.min(state.minimum![i]!, rgb[i]!);
            state.maximum![i] = Math.max(state.maximum![i]!, rgb[i]!);
          }
        const { rgbBase64: _rgb, ...retained } = point;
        row = { ...retained, stillnessRunStartUs: state.runStart! };
        state.last = point;
      }
      coverage.push(row);
      state.recent = { point, coverage: row };
    }
    this.state = state;
    this.dimensions = { width: observed.sourceWidth, height: observed.sourceHeight };
    this.throughUs = range.endUs;
    return structuredClone({
      policy: sourceScenePolicy,
      assetId: observed.assetId,
      streamId: observed.streamId,
      range,
      durationUs: this.durationUs,
      originUs: observed.originUs,
      sourceWidth: observed.sourceWidth,
      sourceHeight: observed.sourceHeight,
      coverage,
      comparisons,
    });
  }
}
