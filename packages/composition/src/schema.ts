import { geometrySchema } from "./geometry.js";
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
const clipFields = { id, trackId: id, placement: anchorSchema };
export const mediaClipSchema = z
  .object({
    ...clipFields,
    assetId: id,
    streamId: id,
    acquisitionId: id.optional(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("range"), range: selectionRangeSchema }).strict(),
      z.object({ kind: z.literal("hold"), atUs: time }).strict(),
    ]),
    pitch: z.enum(["preserve", "follow"]).optional(),
  })
  .strict();
export const silenceClipSchema = z
  .object({ ...clipFields, source: z.object({ kind: z.literal("silence") }).strict() })
  .strict();
export const clipSchema = z.union([mediaClipSchema, silenceClipSchema]);
export const streamSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id,
      kind: z.literal("image"),
      width: z.number().finite().positive(),
      height: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("audio"),
      bounds: rangeSchema,
      available: z.array(rangeSchema),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("video"),
      width: z.number().finite().positive(),
      height: z.number().finite().positive(),
      pixelBounds: z
        .object({
          x: z.number().finite(),
          y: z.number().finite(),
          width: z.number().finite().positive(),
          height: z.number().finite().positive(),
        })
        .strict()
        .optional(),
      bounds: rangeSchema,
      available: z.array(rangeSchema),
    })
    .strict(),
]);
export const acquisitionContextSchema = z
  .object({
    id,
    bindings: z.array(
      z.object({ assetId: id, streamId: id, available: z.array(rangeSchema) }).strict(),
    ),
  })
  .strict();
export type AcquisitionContext = z.infer<typeof acquisitionContextSchema>;
export const assetSchema = z.object({ id, streams: z.array(streamSchema) }).strict();
export const routingNodeSchema = z
  .object({
    id,
    kind: z.enum(["video", "audio"]),
    order: z.int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
    parentId: id.optional(),
  })
  .strict();
export const processingTargetSchema = z.union([
  z.object({ kind: z.enum(["clip", "track", "group"]), id }).strict(),
  z.object({ kind: z.literal("output") }).strict(),
]);
export const processorRegistry = {
  geometry: {
    schema: geometrySchema,
    mediaKind: "video" as const,
    units: {
      crop: "preceding image pixels",
      rect: "canvas pixels",
      scale: "multiplier",
      rotationDeg: "clockwise degrees",
      pivot: "normalized rectangle",
    },
  },
  opacity: {
    schema: z.object({ type: z.literal("opacity"), opacity: z.number().min(0).max(1) }).strict(),
    mediaKind: "video" as const,
    units: { opacity: "linear alpha multiplier" },
  },
  gain: {
    schema: z.object({ type: z.literal("gain"), gain: z.number().finite().nonnegative() }).strict(),
    mediaKind: "audio" as const,
    units: { gain: "linear multiplier" },
  },
};
export const processingStepSchema = z
  .object({
    id,
    enabled: z.boolean(),
    processor: z.discriminatedUnion("type", [
      processorRegistry.gain.schema,
      processorRegistry.geometry.schema,
      processorRegistry.opacity.schema,
    ]),
  })
  .strict();
export const processingStackSchema = z
  .object({
    target: processingTargetSchema,
    steps: z.array(processingStepSchema).min(1),
  })
  .strict();
export type ProcessingTarget = z.infer<typeof processingTargetSchema>;
export type ProcessingStep = z.infer<typeof processingStepSchema>;
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
    tracks: z.array(routingNodeSchema),
    groups: z.array(routingNodeSchema),
    clips: z.array(clipSchema),
    syncGroups: z.array(z.object({ id, clipIds: z.array(id).min(2) }).strict()),
    processing: z.array(processingStackSchema),
    captions: z.array(z.never()).max(0),
  })
  .strict();

export type Range = z.infer<typeof rangeSchema>;
export type Fraction = z.infer<typeof fractionSchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type MediaClip = z.infer<typeof mediaClipSchema>;
export type Clip = z.infer<typeof clipSchema>;
export function isMediaClip(clip: Clip): clip is MediaClip {
  return clip.source.kind !== "silence";
}
export type Stream = z.infer<typeof streamSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Composition = z.infer<typeof compositionSchema>;
