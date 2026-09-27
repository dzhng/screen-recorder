import { z } from "zod";
import { compare, fromTime } from "./rational.js";

const time = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = time.positive();
const id = z.string().min(1);
export const rangeSchema = z
  .object({ startUs: time, endUs: time })
  .strict()
  .refine((value) => value.startUs < value.endUs, "Expected positive half-open range");
export const fractionSchema = z
  .object({ numerator: time, denominator: positive })
  .strict()
  .refine(({ numerator, denominator }) => {
    let a = BigInt(numerator),
      b = BigInt(denominator);
    while (b) [a, b] = [b, a % b];
    return a === 1n;
  }, "Expected reduced fraction");
/** Integer command times stay compact; edits retain exact sub-microsecond boundaries. */
export const timeValueSchema = z.union([
  time,
  fractionSchema.refine((value) => value.denominator > 1, "Use an integer for whole microseconds"),
]);
export type TimeValue = z.infer<typeof timeValueSchema>;
const selectionBoundsSchema = z
  .object({ startUs: timeValueSchema, endUs: timeValueSchema })
  .strict();
export const selectionRangeSchema = selectionBoundsSchema.refine(
  (value) => compare(fromTime(value.startUs), fromTime(value.endUs)) < 0,
  {
    message: "Expected positive half-open range",
    // Zod may continue refinements after scalar constraint failures.
    when: ({ value }) => selectionBoundsSchema.safeParse(value).success,
  },
);
export type SelectionRange = z.infer<typeof selectionRangeSchema>;
export const anchorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), range: selectionRangeSchema }).strict(),
  z.object({ kind: z.literal("content"), clipId: id, sourceRange: selectionRangeSchema }).strict(),
  z
    .object({ kind: z.literal("clip"), clipId: id, start: fractionSchema, end: fractionSchema })
    .strict()
    .refine(
      ({ start, end }) =>
        start.numerator <= start.denominator &&
        end.numerator <= end.denominator &&
        BigInt(start.numerator) * BigInt(end.denominator) <
          BigInt(end.numerator) * BigInt(start.denominator),
      "Expected ordered clip fractions within [0,1]",
    ),
]);
export const clipSchema = z
  .object({
    id,
    assetId: id,
    streamId: id,
    trackId: id,
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("range"), range: selectionRangeSchema }).strict(),
      z.object({ kind: z.literal("hold"), atUs: time }).strict(),
    ]),
    placement: anchorSchema,
    pitch: z.enum(["preserve", "follow"]).optional(),
  })
  .strict();
export const streamSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("image") }).strict(),
  z
    .object({
      id,
      kind: z.enum(["video", "audio"]),
      bounds: rangeSchema,
      available: z.array(rangeSchema),
    })
    .strict(),
]);
export const assetSchema = z.object({ id, streams: z.array(streamSchema) }).strict();
export const compositionSchema = z
  .object({
    canvas: z
      .object({
        width: positive,
        height: positive,
        fps: fractionSchema.refine((value) => value.numerator > 0),
        background: z.string().regex(/^#[0-9a-fA-F]{8}$/),
      })
      .strict(),
    tracks: z.array(
      z
        .object({
          id,
          kind: z.enum(["video", "audio"]),
          order: z.int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
        })
        .strict(),
    ),
    clips: z.array(clipSchema),
    syncGroups: z.array(z.object({ id, clipIds: z.array(id).min(2) }).strict()),
    effects: z.array(z.never()).max(0),
    captions: z.array(z.never()).max(0),
  })
  .strict();

export type Range = z.infer<typeof rangeSchema>;
export type Fraction = z.infer<typeof fractionSchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type Stream = z.infer<typeof streamSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Composition = z.infer<typeof compositionSchema>;
