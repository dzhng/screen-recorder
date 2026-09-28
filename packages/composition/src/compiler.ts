import { processingPlanner } from "./processing-plan.js";
import { CompositionError } from "./errors.js";
import { sourceTime, type ValidatedComposition } from "./model.js";
import { compare, floor, fromTime, toTime, type Rational } from "./rational.js";
import { isMediaClip, rangeSchema, type Range, type SelectionRange } from "./schema.js";

type Resolved = ValidatedComposition["clips"][number];
export type CompiledFrame = {
  index: number;
  atUs: number;
  layers: {
    clipId: string;
    trackId: string;
    assetId: string;
    streamId: string;
    sourceUs: number;
    available: boolean;
    placement: "contain";
  }[];
};
export type CompiledAudio = {
  clipId: string;
  trackId: string;
  sampleRange: { start: number; end: number };
  placement: SelectionRange;
  source:
    | { kind: "silence" }
    | { kind: "range"; assetId: string; streamId: string; range: SelectionRange };
  pitch: "preserve" | "follow";
  available: { start: number; end: number }[];
};
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

/** Build once per validated immutable revision, then request lazy globally phased schedules. */
export function createCompiler(model: ValidatedComposition) {
  const query = intervalIndex(model.clips);
  const processing = processingPlanner(model);
  const fps = model.document.canvas.fps;
  const frameNumerator = BigInt(fps.numerator);
  const frameDenominator = 1000000n * BigInt(fps.denominator);
  return {
    processing(input: Range) {
      const range = checkedRange(input);
      return processing(query(fromTime(range.startUs), fromTime(range.endUs)));
    },
    *audio(input: Range, sampleRate = 48000): Generator<CompiledAudio> {
      const range = checkedRange(input);
      if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0)
        throw new CompositionError("INVALID_TIME", "Expected a positive integer sample rate");
      const sample = (at: Rational) =>
        safeInteger((at.numerator * BigInt(sampleRate)) / (at.denominator * 1000000n));
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
          pitch: isMediaClip(clip) ? (clip.pitch ?? "preserve") : "preserve",
          available,
        };
      }
    },
    *frames(input: Range): Generator<CompiledFrame> {
      const range = checkedRange(input);
      let index =
        (BigInt(range.startUs) * frameNumerator + frameDenominator - 1n) / frameDenominator;
      for (;;) {
        const timestamp = (index * frameDenominator) / frameNumerator;
        if (timestamp >= BigInt(range.endUs)) return;
        const atUs = safeInteger(timestamp);
        const at = fromTime(atUs);
        const layers: CompiledFrame["layers"] = [];
        for (const value of query(at)) {
          const clip = value.clip;
          if (value.track.kind !== "video" || !isMediaClip(clip)) continue;
          const part = value.available[firstAvailable(value.available, at)];
          layers.push({
            clipId: clip.id,
            trackId: clip.trackId,
            assetId: clip.assetId,
            streamId: clip.streamId,
            sourceUs: floor(sourceTime(value, at)),
            available: part !== undefined && compare(part.start, at) <= 0,
            placement: "contain",
          });
        }
        yield { index: safeInteger(index), atUs, layers };
        index++;
      }
    },
  };
}
