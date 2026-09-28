import { z } from "zod";
import { rangeSchema, selectionRangeSchema } from "./schema.js";

const id = z.string().min(1);
const index = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const compiledFrameSchema = z
  .object({
    index,
    sampleAtUs: index,
    visibleRange: rangeSchema,
    layers: z.array(
      z
        .object({
          clipId: id,
          trackId: id,
          assetId: id,
          streamId: id,
          sourceUs: index,
          availability: z.enum(["available", "source-unavailable", "anchor-unavailable"]),
          placement: z.literal("contain"),
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
export const compiledAudioSchema = z
  .object({
    clipId: id,
    trackId: id,
    sampleRange,
    placement: selectionRangeSchema,
    context: z.array(selectionRangeSchema).readonly(),
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
