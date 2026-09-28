import { sampleAt } from "./sample-clock.js";
import { audioContexts } from "./audio-context.js";
import type { CompiledFrame, CompiledAudio } from "./compiled-records.js";
import { executionWindow, executionWindowRequestSchema } from "./execution-window.js";
import { processingPlanner } from "./processing-plan.js";
import { CompositionError } from "./errors.js";
import { sourceTime, type ValidatedComposition } from "./model.js";
import { compare, floor, ceil, fromTime, toTime, type Rational } from "./rational.js";
import { isMediaClip, rangeSchema, type Range, type Fraction } from "./schema.js";

type Resolved = ValidatedComposition["clips"][number];
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

/** Balanced interval index over the detached immutable revision; queries skip unrelated prefixes. */
function intervalIndex(clips: readonly Resolved[]) {
  type Node = { clip: Resolved; end: Rational; left?: Node; right?: Node };
  const sorted = [...clips].sort((a, b) => compare(a.range.start, b.range.start));
  function build(start: number, end: number): Node | undefined {
    if (start === end) return undefined;
    const middle = Math.floor((start + end) / 2);
    const left = build(start, middle),
      right = build(middle + 1, end);
    const clip = sorted[middle]!;
    let max = clip.range.end;
    for (const child of [left, right]) if (child && compare(child.end, max) > 0) max = child.end;
    return { clip, end: max, ...(left ? { left } : {}), ...(right ? { right } : {}) };
  }
  const root = build(0, sorted.length);
  return function query(start: Rational, end?: Rational): Resolved[] {
    const result: Resolved[] = [];
    const pending = root ? [root] : [];
    while (pending.length) {
      const node = pending.pop()!;
      if (compare(node.end, start) <= 0) continue;
      if (node.left) pending.push(node.left);
      const beforeEnd = end
        ? compare(node.clip.range.start, end) < 0
        : compare(node.clip.range.start, start) <= 0;
      if (!beforeEnd) continue;
      if (compare(node.clip.range.end, start) > 0) result.push(node.clip);
      if (node.right) pending.push(node.right);
    }
    return result.sort(
      (a, b) => a.trackRank - b.trackRank || compare(a.range.start, b.range.start),
    );
  };
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

function compileSchedules(
  clock: ReturnType<typeof frameClock>,
  query: ReturnType<typeof intervalIndex>,
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
          placement: { startUs: toTime(value.range.start), endUs: toTime(value.range.end) },
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
        for (const value of query(at)) {
          const clip = value.clip;
          if (value.track.kind !== "video" || !isMediaClip(clip)) continue;
          const part = value.available[firstAvailable(value.available, at)];
          const anchor = value.anchorSupport[firstAvailable(value.anchorSupport, at)];
          layers.push({
            clipId: clip.id,
            trackId: clip.trackId,
            assetId: clip.assetId,
            streamId: clip.streamId,
            sourceUs: floor(sourceTime(value, at)),
            availability:
              anchor === undefined || compare(anchor.start, at) > 0
                ? "anchor-unavailable"
                : part !== undefined && compare(part.start, at) <= 0
                  ? "available"
                  : "source-unavailable",
            placement: "contain",
          });
        }
        const nextTimestamp = clock.timeAt(index + 1n);
        const visibleEnd =
          nextTimestamp < BigInt(range.endUs) ? nextTimestamp : BigInt(range.endUs);
        yield {
          index: safeInteger(index),
          sampleAtUs: atUs,
          visibleRange: { startUs: Math.max(range.startUs, atUs), endUs: safeInteger(visibleEnd) },
          layers,
        };
        index = clock.indexAt(nextTimestamp);
      }
    },
  };
}

/** Build once per validated immutable revision, then request lazy globally phased schedules. */
export function createCompiler(model: ValidatedComposition, revisionId: string) {
  if (typeof revisionId !== "string" || revisionId.length === 0)
    throw new CompositionError("INVALID_COMPOSITION", "Expected a revision identity");
  const query = intervalIndex(model.clips);
  const processing = processingPlanner(model);
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
  return {
    ...compileSchedules(clock, query, contexts),
    processing(input: Range) {
      const range = checkedRange(input);
      return processing(contributors(range));
    },
    window(input: unknown) {
      const parsed = executionWindowRequestSchema.safeParse(input);
      if (!parsed.success) throw new CompositionError("INVALID_COMPOSITION", parsed.error.message);
      const request = parsed.data;
      const clips = contributors(request.range, request.rendition.sampleRate);
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
      const plan = processing(clips, request.tap);
      const selected = new Set(
        plan.flatMap((node) => (node.target.kind === "clip" ? [node.target.id] : [])),
      );
      const inputs = clips.filter((value) => selected.has(value.clip.id));
      return executionWindow(
        revisionId,
        model.document.canvas,
        request,
        inputs,
        plan,
        contexts,
        compileSchedules(clock, intervalIndex(inputs), contexts),
      );
    },
  };
}
