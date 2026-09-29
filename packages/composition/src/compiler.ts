import { deriveStatePlan, selectStatePlan } from "./processing-state.js";
import { temporalProcessing } from "./temporal-processing.js";
import { compileScalarCurve } from "./curve.js";
import { visualPlanner } from "./visual-plan.js";
import { intervalIndex } from "./interval-index.js";
import { sampleAt } from "./sample-clock.js";
import { audioContexts } from "./audio-context.js";
import type { CompiledFrame, CompiledAudio } from "./compiled-records.js";
import {
  executionWindow,
  executionWindowRequestSchema,
  processingTapSchema,
} from "./execution-window.js";
import { processingPlanner } from "./processing-plan.js";
import { CompositionError } from "./errors.js";
import { sourceTime, type ValidatedComposition } from "./model.js";
import { compare, floor, ceil, fromTime, toTime, type Rational } from "./rational.js";
import {
  isMediaClip,
  rangeSchema,
  timeValueSchema,
  type TimeValue,
  type Range,
  type Fraction,
} from "./schema.js";

type Resolved = ValidatedComposition["clips"][number];
const renderOrder = (a: Resolved, b: Resolved) =>
  a.trackRank - b.trackRank || compare(a.range.start, b.range.start);
function safeInteger(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CompositionError("INVALID_TIME", "Compiled clock exceeds safe-integer precision");
  return Number(value);
}
function checkedRange(input: Range): Range {
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) throw new CompositionError("INVALID_TIME", parsed.error.message);
  return parsed.data;
}

function firstAvailable(ranges: Resolved["available"], at: Rational): number {
  let lo = 0,
    hi = ranges.length;
  while (lo < hi) {
    const middle = Math.floor((lo + hi) / 2);
    if (compare(ranges[middle]!.end, at) <= 0) lo = middle + 1;
    else hi = middle;
  }
  return lo;
}

function frameClock(fps: Fraction) {
  const numerator = BigInt(fps.numerator),
    denominator = 1000000n * BigInt(fps.denominator);
  return {
    timeAt: (index: bigint) => (index * denominator) / numerator,
    // Floor timestamps make an exact integer boundary slightly earlier than k * period.
    indexAt: (time: bigint) => ((time + 1n) * numerator + denominator - 1n) / denominator - 1n,
    firstAtOrAfter: (time: number) => (BigInt(time) * numerator + denominator - 1n) / denominator,
  };
}

function frameTiming(
  clock: ReturnType<typeof frameClock>,
  index: bigint,
  range: Range,
): Pick<CompiledFrame, "index" | "sampleAtUs" | "visibleRange"> {
  const sampleAtUs = safeInteger(clock.timeAt(index));
  const next = clock.timeAt(index + 1n);
  return {
    index: safeInteger(index),
    sampleAtUs,
    visibleRange: {
      startUs: Math.max(range.startUs, sampleAtUs),
      endUs: safeInteger(next < BigInt(range.endUs) ? next : BigInt(range.endUs)),
    },
  };
}

function compileSchedules(
  visual: ReturnType<typeof visualPlanner>,
  processing: ReturnType<typeof processingPlanner>,
  tap: import("./execution-window.js").ProcessingTap | undefined,
  clock: ReturnType<typeof frameClock>,
  query: ReturnType<typeof intervalIndex<Resolved>>,
  contexts: ReturnType<typeof audioContexts>,
) {
  return {
    *audio(input: Range, sampleRate = 48000): Generator<CompiledAudio> {
      const range = checkedRange(input);
      if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0)
        throw new CompositionError("INVALID_TIME", "Expected a positive integer sample rate");
      const sample = (at: Rational) => sampleAt(at, sampleRate);
      const requestedStart = sample(fromTime(range.startUs)),
        requestedEnd = sample(fromTime(range.endUs));
      for (const value of query(fromTime(range.startUs), fromTime(range.endUs))) {
        if (value.track.kind !== "audio") continue;
        const start = Math.max(requestedStart, sample(value.range.start));
        const end = Math.min(requestedEnd, sample(value.range.end));
        if (start >= end) continue;
        const clip = value.clip;
        const source: CompiledAudio["source"] =
          isMediaClip(clip) && clip.source.kind === "range"
            ? {
                kind: "range",
                assetId: clip.assetId,
                streamId: clip.streamId,
                range: clip.source.range,
              }
            : { kind: "silence" };
        const available: CompiledAudio["available"] = [];
        for (
          let i = firstAvailable(value.available, fromTime(range.startUs));
          i < value.available.length;
          i++
        ) {
          const part = value.available[i]!;
          const first = Math.max(start, sample(part.start)),
            last = Math.min(end, sample(part.end));
          if (first >= end) break;
          if (first < last) available.push({ start: first, end: last });
        }
        yield {
          clipId: clip.id,
          trackId: clip.trackId,
          sampleRange: { start, end },
          placement: {
            startUs: toTime(value.range.start),
            endUs: toTime(value.range.end),
          },
          source,
          context: contexts(value, range, sampleRate),
          pitch: isMediaClip(clip) ? (clip.pitch ?? "preserve") : "preserve",
          available,
        };
      }
    },
    *frames(input: Range): Generator<CompiledFrame> {
      const range = checkedRange(input);
      let index = clock.indexAt(BigInt(range.startUs));
      for (;;) {
        const timestamp = clock.timeAt(index);
        if (timestamp >= BigInt(range.endUs)) return;
        const atUs = safeInteger(timestamp);
        const at = fromTime(atUs);
        const layers: CompiledFrame["layers"] = [];
        const active = query(at);
        for (const value of active) {
          const clip = value.clip;
          if (value.track.kind !== "video") continue;
          if (clip.source.kind === "text") {
            const available = value.available.some(
              (range) => compare(range.start, at) <= 0 && compare(at, range.end) < 0,
            );
            layers.push({
              kind: "text",
              clipId: clip.id,
              trackId: clip.trackId,
              text: clip.source,
              width: clip.source.width,
              height: clip.source.height,
              availability: available ? "available" : "anchor-unavailable",
            });
            continue;
          }
          if (!isMediaClip(clip)) continue;
          const part = value.available[firstAvailable(value.available, at)];
          const anchor = value.anchorSupport[firstAvailable(value.anchorSupport, at)];
          layers.push({
            clipId: clip.id,
            trackId: clip.trackId,
            assetId: clip.assetId,
            streamId: clip.streamId,
            ...(value.stream!.kind === "image"
              ? { kind: "image" as const }
              : { kind: "video" as const, sourceUs: floor(sourceTime(value, at)) }),
            availability:
              anchor === undefined || compare(anchor.start, at) > 0
                ? "anchor-unavailable"
                : part !== undefined && compare(part.start, at) <= 0
                  ? "available"
                  : "source-unavailable",
            width: value.stream!.kind === "audio" ? 0 : value.stream!.width,
            height: value.stream!.kind === "audio" ? 0 : value.stream!.height,
          });
        }
        const nextTimestamp = clock.timeAt(index + 1n);
        yield {
          ...frameTiming(clock, index, range),
          layers,
          visual: visual(
            processing(
              active.filter((clip) => clip.track.kind === "video"),
              tap,
              "video",
            ),
            atUs,
          ),
        };
        index = clock.indexAt(nextTimestamp);
      }
    },
  };
}

/** Build once per validated immutable revision, then request lazy globally phased schedules. */
export function createCompiler(model: ValidatedComposition, revisionId: string) {
  const temporal = temporalProcessing(model);
  if (typeof revisionId !== "string" || revisionId.length === 0)
    throw new CompositionError("INVALID_COMPOSITION", "Expected a revision identity");
  const query = intervalIndex(model.clips, (clip) => clip.range, renderOrder);
  const processing = processingPlanner(model);
  const visual = visualPlanner(model, temporal);
  const clock = frameClock(model.document.canvas.fps);
  const contexts = audioContexts(model);
  function contributors(range: Range, sampleRate = 48000) {
    const leading = clock.indexAt(BigInt(range.startUs));
    const candidates = new Map(
      query(fromTime(range.startUs), fromTime(range.endUs)).map((value) => [value.clip.id, value]),
    );
    for (const value of query(fromTime(safeInteger(clock.timeAt(leading)))))
      if (value.track.kind === "video") candidates.set(value.clip.id, value);
    return [...candidates.values()]
      .filter((value) => {
        if (value.track.kind === "audio")
          return (
            Math.max(
              sampleAt(fromTime(range.startUs), sampleRate),
              sampleAt(value.range.start, sampleRate),
            ) <
            Math.min(
              sampleAt(fromTime(range.endUs), sampleRate),
              sampleAt(value.range.end, sampleRate),
            )
          );
        const first = clock.firstAtOrAfter(ceil(value.range.start));
        const sample = clock.timeAt(first > leading ? first : leading);
        return (
          sample < BigInt(range.endUs) &&
          compare(fromTime(safeInteger(sample)), value.range.end) < 0
        );
      })
      .sort((a, b) => a.trackRank - b.trackRank || compare(a.range.start, b.range.start));
  }
  function window(input: unknown, component?: "audio" | "video") {
    const parsed = executionWindowRequestSchema.safeParse(input);
    if (!parsed.success) throw new CompositionError("INVALID_COMPOSITION", parsed.error.message);
    const request = parsed.data;
    const clips = contributors(request.range, request.rendition.sampleRate).filter(
      (value) => !component || value.track.kind === component,
    );
    const target = request.tap.target;
    if (
      target.kind === "clip" &&
      !clips.some((value) => value.clip.id === target.id) &&
      model.clips.some((value) => value.clip.id === target.id && value.track.kind === "audio")
    )
      throw new CompositionError(
        "NOT_READY",
        "Audio clip tap has no output samples in the requested window",
      );
    const plan = processing(clips, request.tap, component);
    const selected = new Set(
      plan.flatMap((node) => (node.target.kind === "clip" ? [node.target.id] : [])),
    );
    const inputs = clips.filter((value) => selected.has(value.clip.id));
    const compiled = executionWindow(
      revisionId,
      model.document.canvas,
      request,
      inputs,
      plan,
      contexts,
      compileSchedules(
        visual,
        processing,
        request.tap,
        clock,
        intervalIndex(inputs, (clip) => clip.range, renderOrder),
        contexts,
      ),
      () => temporal.audio(plan, request.rendition.sampleRate),
      component,
    );
    if (component !== "video") {
      const state = selectStatePlan(
        deriveStatePlan(model),
        new Set(
          plan.flatMap((node) => node.steps.filter((step) => step.enabled).map((step) => step.id)),
        ),
      );
      if (state.domains.length) compiled.manifest.state = state;
    }
    return compiled;
  }
  return {
    ...compileSchedules(visual, processing, undefined, clock, query, contexts),
    curve: (curve: unknown, anchor: unknown) => compileScalarCurve(model, curve, anchor),
    processingBoundaries(
      input: unknown = { target: { kind: "output" }, point: { kind: "processed" } },
    ) {
      const tap = processingTapSchema.parse(input);
      return temporal.boundaries(processing(model.clips, tap, "video")).map(toTime);
    },
    /** Neighbors of an exact boundary in the existing integer-microsecond picture clock. */
    frameBoundary(at: TimeValue) {
      const parsed = timeValueSchema.safeParse(at);
      if (!parsed.success || compare(fromTime(parsed.data), fromTime(model.durationUs)) > 0)
        throw new CompositionError("INVALID_TIME", "Frame boundary must be within the project");
      const threshold = ceil(fromTime(parsed.data));
      const picture = (
        index: bigint,
      ): Pick<CompiledFrame, "index" | "sampleAtUs" | "visibleRange"> | null => {
        const sample = clock.timeAt(index);
        if (sample >= BigInt(model.durationUs)) return null;
        return frameTiming(clock, index, { startUs: 0, endUs: model.durationUs });
      };
      return {
        before: threshold === 0 ? null : picture(clock.indexAt(BigInt(threshold - 1))),
        after: picture(clock.indexAt(clock.timeAt(clock.firstAtOrAfter(threshold)))),
      };
    },
    /** Validate target and step scope without inventing a render range for an empty project. */
    tapPlan(input: unknown, component?: "audio" | "video") {
      const tap = processingTapSchema.safeParse(input);
      if (!tap.success) throw new CompositionError("INVALID_COMPOSITION", tap.error.message);
      return processing(
        model.clips.filter((value) => !component || value.track.kind === component),
        tap.data,
        component,
      );
    },
    processing(input: Range) {
      const range = checkedRange(input);
      return processing(contributors(range));
    },
    window: (input: unknown) => window(input),
    audioWindow: (input: unknown) => window(input, "audio"),
    videoWindow: (input: unknown) => window(input, "video"),
  };
}
