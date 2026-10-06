import { z } from "zod";

/** Static source-neutral correction; the native recipe defines order and working space. */
export const sdrCorrectionParameters = {
  exposureEV: z.number().finite().min(-8).max(8).default(0),
  contrast: z.number().finite().min(0).max(2).default(1),
  saturation: z.number().finite().min(0).max(2).default(1),
  shadows: z.number().finite().min(0).max(1).default(0),
  highlights: z.number().finite().min(0).max(1).default(0),
  neutralKelvin: z.number().finite().min(2000).max(10000).default(6500),
  neutralTint: z.number().finite().min(-100).max(100).default(0),
};
