import { z } from "zod";
import { processingTapSchema, rangeSchema } from "@screenrec/composition";

const integer = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sampleRange = z.strictObject({ start: integer, end: integer });
const id = z.string().min(1);
export const audioRenditionSchema = z.strictObject({
  sampleRate: z.int().min(1).max(192000),
  channels: z.union([z.literal(1), z.literal(2)]),
});
export const audioDimensionsSchema = audioRenditionSchema.extend({ frames: integer.positive() });
export const extractionOriginSchema = z.strictObject({
  kind: z.literal("extraction"),
  selection: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("source"),
      assetId: id,
      streamId: id,
      acquisitionId: id.optional(),
      range: rangeSchema,
      sampleRange,
      supportDigest: id,
      unavailable: z.array(rangeSchema),
    }),
    z.strictObject({
      kind: z.literal("project"),
      projectId: id,
      revisionId: id,
      range: rangeSchema,
      sampleRange,
      tap: processingTapSchema,
      processingSha256: z.string().regex(/^[a-f0-9]{64}$/),
      unavailable: z.array(z.strictObject({ clipId: id, ranges: z.array(sampleRange) })),
    }),
  ]),
  selectionImplementationId: id,
  input: audioDimensionsSchema,
  output: audioDimensionsSchema,
  conversion: z.strictObject({
    implementationId: id,
    channelPolicy: z.enum(["preserve", "duplicate", "equal-weight-double-rounded-float32"]),
    contextPolicy: z.enum(["complete-selected-pcm-zero-origin", "complete-source"]),
  }),
});
export const assetOriginSchema = z.union([
  z.strictObject({
    kind: z.enum(["import", "capture", "generated"]),
    source: z.string().optional(),
  }),
  extractionOriginSchema,
]);
export type AssetProvenance = z.infer<typeof assetOriginSchema>;
export type ExtractionOrigin = z.infer<typeof extractionOriginSchema>;
