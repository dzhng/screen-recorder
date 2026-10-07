import { z } from "zod";
export const lutMetadataSchema = z
  .object({
    format: z.literal("cube-3d"),
    size: z.int().min(2).max(33),
    domain: z.literal("unit"),
    ordering: z.literal("red-fastest"),
  })
  .strict();
export const lutParameters = {
  assetId: z.string().min(1),
  colorSpace: z.literal("linear-srgb"),
  interpolation: z.literal("trilinear"),
};
