import { z } from "zod";
import { selectionRangeSchema } from "@yap/composition";
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

/** The original provider accepts complete, score-grid aligned windows up to 30 seconds. */
export function selectSpeakerSource(
  assets: Pick<AssetStore, "get" | "path">,
  acquisitions: { get(id: string): Pick<ReturnType<AcquisitionStore["get"]>, "id" | "bindings"> },
  input: SpeakerSourceInput,
) {
  const { modelId, ...selection } = speakerSourceSchema.parse(input);
  const source = selectSourceChannelRange(assets, acquisitions, selection);
  if (source.expectedPCM.frames < 1280)
    throw new CatalogError("INVALID_PARAMS", "Speaker observations require at least 80ms");
  if (source.expectedPCM.frames > 480000)
    throw new CatalogError("INVALID_PARAMS", "Speaker observations require at most 30 seconds");
  if (source.expectedPCM.frames % 1280 !== 0)
    throw new CatalogError("INVALID_PARAMS", "Speaker observations must use the 80ms score grid");
  return {
    ...source,
    modelId,
  };
}
