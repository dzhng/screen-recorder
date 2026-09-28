import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "./catalog.js";
import {
  sourceScenePolicy,
  sourceSceneSampleTimes,
  validateSceneSampleClock,
  compareSceneSampleClocks,
  type SelectedSourceSceneAnalysis,
} from "./source-scenes.js";
import type { SceneSource } from "./scene-evidence.js";

export type SourceSceneChunk = Awaited<ReturnType<SelectedSourceSceneAnalysis["analyze"]>>;
const integer = z.int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const time = integer.nonnegative();
const clock = z.strictObject({
  value: z
    .string()
    .regex(/^-?\d+$/)
    .max(20),
  timescale: z.int().positive().max(2147483647),
  endValue: z
    .string()
    .regex(/^-?\d+$/)
    .max(20),
  endTimescale: z.int().positive().max(2147483647),
});
const coverage = z.discriminatedUnion("status", [
  z.strictObject({
    requestedSourceUs: time,
    status: z.literal("unavailable"),
    reason: z.enum(["outside_support", "empty_edit"]),
    continuousFromPrevious: z.literal(false),
  }),
  z.strictObject({
    requestedSourceUs: time,
    status: z.literal("available"),
    actualSourceUs: integer,
    sample: clock,
    width: time.positive().max(64),
    height: time.positive().max(64),
    continuousFromPrevious: z.boolean(),
    stillnessRunStartUs: time,
  }),
]);
const comparison = z.strictObject({
  previous: clock,
  current: clock,
  actualSourceUs: integer,
  changedPixelFraction: z.number().min(0).max(1),
  changedCellFraction: z.number().min(0).max(1),
  meanAbsoluteChannelDifference: z.number().min(0).max(1),
  boundary: z.boolean(),
});
const schema = z.strictObject({
  policy: z.literal(sourceScenePolicy),
  assetId: z.string().min(1),
  streamId: z.string().min(1),
  range: z.strictObject({ startUs: time, endUs: time }),
  durationUs: time.positive(),
  originUs: integer,
  sourceWidth: time.positive().max(8192),
  sourceHeight: time.positive().max(8192),
  coverage: z.array(coverage).max(52),
  comparisons: z.array(comparison).max(51),
});
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}

/** One canonical retained codec for presentation observations; gaps never imply pixels or comparisons. */
export function normalizeSourceSceneChunk(
  report: SourceSceneChunk,
  assetId: string,
  source: Extract<SceneSource, { kind: "asset" }>,
  previous?: {
    coverage: SourceSceneChunk["coverage"][number];
    comparison?: SourceSceneChunk["comparisons"][number];
    lastAvailable?: Extract<SourceSceneChunk["coverage"][number], { status: "available" }>;
  },
) {
  const parsed = schema.safeParse(report);
  if (!parsed.success) invalid("Malformed source scene chunk");
  const chunk = parsed.data;
  if (
    chunk.assetId !== assetId ||
    chunk.streamId !== source.streamId ||
    chunk.originUs !== source.originUs ||
    chunk.durationUs !== source.durationUs
  )
    invalid("Scene chunk changed its selected source");
  const times = sourceSceneSampleTimes(chunk.range, chunk.durationUs);
  if (times.length !== chunk.coverage.length) invalid("Incomplete source scene coverage");
  if (previous && !isDeepStrictEqual(previous.coverage, chunk.coverage[0]))
    invalid("Overlapping scene coverage changed");
  let prior: Extract<SourceSceneChunk["coverage"][number], { status: "available" }> | undefined;
  let lastAvailable: typeof prior = previous?.lastAvailable;
  let last = previous?.comparison;
  let pairIndex = 0;
  for (const [index, point] of chunk.coverage.entries()) {
    if (point.requestedSourceUs !== times[index]) invalid("Source scene coverage changed its grid");
    if (point.status === "unavailable") {
      prior = undefined;
      continue;
    }
    validateSceneSampleClock(
      point.sample,
      point.requestedSourceUs,
      point.actualSourceUs,
      source.originUs,
    );
    if (lastAvailable && compareSceneSampleClocks(lastAvailable.sample, point.sample) > 0)
      invalid("Source scene samples moved backwards");
    if (index === 0 && !previous && point.continuousFromPrevious)
      invalid("First scene observation has no predecessor");
    if (index > 0 && !prior && point.continuousFromPrevious)
      invalid("Scene continuity follows an unavailable observation");
    if (index > 0 || !previous) {
      if (!prior || !point.continuousFromPrevious) {
        if (point.stillnessRunStartUs !== point.requestedSourceUs)
          invalid("Scene stillness crosses a gap");
      } else if (
        point.stillnessRunStartUs !== prior.stillnessRunStartUs &&
        point.stillnessRunStartUs !== point.requestedSourceUs
      )
        invalid("Scene stillness changed its observed start");
    }
    if (
      prior &&
      point.continuousFromPrevious &&
      compareSceneSampleClocks(prior.sample, point.sample) < 0
    ) {
      const pair = chunk.comparisons[pairIndex++];
      if (
        !pair ||
        !isDeepStrictEqual(pair.previous, prior.sample) ||
        !isDeepStrictEqual(pair.current, point.sample) ||
        pair.actualSourceUs !== point.actualSourceUs
      )
        invalid("Scene comparison does not join retained observations");
      if (last && compareSceneSampleClocks(last.current, pair.current) >= 0)
        invalid("Scene comparisons moved backwards");
      last = pair;
    }
    prior = point;
    lastAvailable = point;
  }
  if (pairIndex !== chunk.comparisons.length)
    invalid("Source scene comparisons cross gaps or repeat observations");
  if (Buffer.byteLength(JSON.stringify(chunk)) > 65536)
    invalid("Scene chunk exceeds bounded storage");
  return {
    chunk,
    last,
    sourceState: { coverage: chunk.coverage.at(-1)!, ...(lastAvailable ? { lastAvailable } : {}) },
  };
}
