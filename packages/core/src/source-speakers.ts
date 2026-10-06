import { z } from "zod";
import { selectionRangeSchema, compare, subtract, fromTime, rational } from "@yap/composition";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { CatalogError } from "./catalog.js";
import { selectSourceChannelRange, sourceSelectionSchema } from "./source-selection.js";

export const speakerSourceSchema = sourceSelectionSchema
  .extend({
    channel: z.int().nonnegative(),
    sourceRange: selectionRangeSchema,
    modelId: z.string().min(1),
  })
  .strict();
export type SpeakerSourceInput = z.infer<typeof speakerSourceSchema>;

/** The speaker provider retains its exact30s policy over shared selected-channel admission. */
export function selectSpeakerSource(
  assets: Pick<AssetStore, "get" | "path">,
  acquisitions: { get(id: string): Pick<ReturnType<AcquisitionStore["get"]>, "id" | "bindings"> },
  input: SpeakerSourceInput,
) {
  const { modelId, ...selection } = speakerSourceSchema.parse(input);
  if (
    compare(
      subtract(fromTime(selection.sourceRange.endUs), fromTime(selection.sourceRange.startUs)),
      rational(30000000n),
    ) !== 0
  )
    throw new CatalogError("INVALID_PARAMS", "Speaker observations require exactly 30 seconds");
  const source = selectSourceChannelRange(assets, acquisitions, selection);
  return {
    ...source,
    modelId,
    expectedPCM: { sampleRate: 16000 as const, frames: 480000 as const },
  };
}
