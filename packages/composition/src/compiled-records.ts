import { z } from "zod";
import { picturePrimitiveSchema } from "./geometry.js";
import { rangeSchema, selectionRangeSchema, processingTargetSchema } from "./schema.js";

const id = z.string().min(1);
const index = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const compiledFrameSchema = z
  .object({
    index,
    sampleAtUs: index,
    visibleRange: rangeSchema,
    visual: z.array(
      z
        .object({
          target: processingTargetSchema,
          inputs: z.array(processingTargetSchema),
          operations: z.array(picturePrimitiveSchema),
        })
        .strict(),
    ),
    layers: z.array(
      z
        .object({
          clipId: id,
          trackId: id,
          assetId: id,
          streamId: id,
          sourceUs: index,
          availability: z.enum(["available", "source-unavailable", "anchor-unavailable"]),
          width: z.number().finite().positive(),
          height: z.number().finite().positive(),
        })
        .strict(),
    ),
  })
  .strict()
  .refine(
    (frame) => frame.sampleAtUs <= frame.visibleRange.startUs,
    "A clipped frame cannot become visible before its sampled instant",
  );
const sampleRange = z
  .object({ start: index, end: index })
  .strict()
  .refine((range) => range.start < range.end, "Expected a positive half-open sample range");
export const audioContextSchema = z.object({ source: selectionRangeSchema, sampleRange }).strict();
export type AudioContext = z.infer<typeof audioContextSchema>;
export const compiledAudioSchema = z
  .object({
    clipId: id,
    trackId: id,
    sampleRange,
    placement: selectionRangeSchema,
    context: z.array(audioContextSchema).readonly(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("silence") }).strict(),
      z
        .object({
          kind: z.literal("range"),
          assetId: id,
          streamId: id,
          range: selectionRangeSchema,
        })
        .strict(),
    ]),
    pitch: z.enum(["preserve", "follow"]),
    available: z.array(sampleRange),
  })
  .strict()
  .refine(
    (segment) =>
      segment.available.every(
        (range, i) =>
          range.start >= segment.sampleRange.start &&
          range.end <= segment.sampleRange.end &&
          (i === 0 || segment.available[i - 1]!.end <= range.start),
      ),
    "Availability must be ordered, disjoint and inside the scheduled sample range",
  );
export type CompiledFrame = z.infer<typeof compiledFrameSchema>;
export type CompiledAudio = z.infer<typeof compiledAudioSchema>;
