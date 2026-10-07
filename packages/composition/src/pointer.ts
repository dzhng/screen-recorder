import { z } from "zod";
import { picturePrimitiveSchema } from "./geometry.js";

/** Authored source-time history; core owns eligibility and preparation budgets. */
export const maximumPointerTrailUs = 10_000_000;
const trailUs = z.int().min(0).max(maximumPointerTrailUs);
export const pointerSchema = z.object({ type: z.literal("pointer"), trailUs }).strict();
const pointerOperationSchema = z
  .object({
    kind: z.literal("pointer"),
    stepId: z.string().min(1),
    trailUs,
    geometryPrefix: z.array(z.int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
  })
  .strict();
const blendOperationSchema = z
  .object({
    kind: z.literal("blend"),
    mode: z.enum(["normal", "multiply", "screen", "soft-light"]),
  })
  .strict();
const motionBlurOperationSchema = z
  .object({
    kind: z.literal("motion-blur"),
    samples: z.number().int().min(1).max(8),
    shutter: z.number().finite().min(0).max(1),
  })
  .strict();
export const visualOperationsSchema = z
  .array(
    z.union([
      picturePrimitiveSchema,
      pointerOperationSchema,
      blendOperationSchema,
      motionBlurOperationSchema,
    ]),
  )
  .superRefine((operations, context) => {
    const geometry: number[] = [];
    for (const [index, operation] of operations.entries()) {
      if (operation.kind === "pointer") {
        if (
          operation.geometryPrefix.length !== geometry.length ||
          operation.geometryPrefix.some((reference, i) => reference !== geometry[i])
        )
          context.addIssue({
            code: "custom",
            path: [index, "geometryPrefix"],
            message: "Pointer must reference the complete preceding geometry in execution order",
          });
      } else if (
        operation.kind !== "opacity" &&
        operation.kind !== "sdr-correction" &&
        operation.kind !== "lut" &&
        operation.kind !== "blend" &&
        operation.kind !== "motion-blur"
      )
        geometry.push(index);
    }
  });
export type VisualOperation = z.infer<typeof visualOperationsSchema>[number];
