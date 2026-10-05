import { z } from "zod";
import { stateRecipeSchema, type ProcessingStep } from "@screenrec/composition";
import { CatalogError } from "./catalog.js";

export const loudnessMeasurementSchema = z.strictObject({
  integratedLufs: z.number().finite().nullable(),
  loudnessRangeLu: z.number().finite().nonnegative().nullable(),
  samplePeakDbfs: z.number().finite().nullable(),
  truePeakDbtp: z.number().finite().nullable(),
  integratedReason: z.enum(["insufficient-duration", "below-gate"]).nullable(),
  rangeReason: z.enum(["insufficient-duration", "below-gate"]).nullable(),
  algorithm: z.string().min(1),
  version: z.string().min(1),
});
export type LoudnessMeasurement = z.infer<typeof loudnessMeasurementSchema>;
export const normalizationTolerance = {
  integratedAbsoluteLu: 0.2,
  rangeMaximumExcessLu: 0.2,
  meterSpecificTruePeakExcessDb: 0.15,
} as const;
const tolerances = z.strictObject({
  integratedAbsoluteLu: z.literal(normalizationTolerance.integratedAbsoluteLu),
  rangeMaximumExcessLu: z.literal(normalizationTolerance.rangeMaximumExcessLu),
  meterSpecificTruePeakExcessDb: z.literal(normalizationTolerance.meterSpecificTruePeakExcessDb),
});
export const audioProcessingEvidenceSchema = z.strictObject({
  domainIndex: z.int().nonnegative(),
  recipe: stateRecipeSchema,
  sampleRange: z.strictObject({ start: z.int().nonnegative(), end: z.int().positive() }),
  implementationId: z.string().min(1),
  normalization: z
    .strictObject({
      before: loudnessMeasurementSchema,
      after: loudnessMeasurementSchema,
      meterImplementationId: z.string().min(1),
      tolerances,
    })
    .optional(),
});
export type AudioProcessingEvidence = z.infer<typeof audioProcessingEvidenceSchema>;
type Normalization = Extract<ProcessingStep["processor"], { type: "normalization" }>;
function measurable(value: LoudnessMeasurement) {
  return (
    value.integratedLufs !== null && value.loudnessRangeLu !== null && value.truePeakDbtp !== null
  );
}
export function normalizationGain(recipe: Normalization, before: LoudnessMeasurement) {
  if (!measurable(before))
    throw new CatalogError(
      "NORMALIZATION_UNMEASURABLE",
      "Complete input has no measurable integrated loudness, range or true peak",
      { before },
    );
  const gainDb = recipe.targetIntegratedLufs - before.integratedLufs!;
  if (
    recipe.mode === "gain-only" &&
    (before.loudnessRangeLu! >
      recipe.maxLoudnessRangeLu + normalizationTolerance.rangeMaximumExcessLu ||
      before.truePeakDbtp! + gainDb >
        recipe.truePeakCeilingDbtp + normalizationTolerance.meterSpecificTruePeakExcessDb)
  )
    throw new CatalogError(
      "NORMALIZATION_NOT_FEASIBLE",
      "Gain-only treatment cannot meet the requested range or peak ceiling",
      { recipe, before },
    );
  return 10 ** (gainDb / 20);
}
export function admitNormalization(recipe: Normalization, after: LoudnessMeasurement) {
  if (
    !measurable(after) ||
    Math.abs(after.integratedLufs! - recipe.targetIntegratedLufs) >
      normalizationTolerance.integratedAbsoluteLu ||
    after.loudnessRangeLu! >
      recipe.maxLoudnessRangeLu + normalizationTolerance.rangeMaximumExcessLu ||
    after.truePeakDbtp! >
      recipe.truePeakCeilingDbtp + normalizationTolerance.meterSpecificTruePeakExcessDb
  )
    throw new CatalogError(
      "NORMALIZATION_TARGETS_UNMET",
      "The complete treated signal misses the requested normalization targets",
      { recipe, after, tolerances: normalizationTolerance },
    );
}
