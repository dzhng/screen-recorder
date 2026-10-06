import { z } from "zod";
import { selectionRangeSchema } from "@yap/composition";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { CatalogError } from "./catalog.js";
import { sourceChannelSchema, selectSourceChannelRange } from "./source-selection.js";

export const alignmentSourceSchema = sourceChannelSchema
  .extend({
    sourceRange: selectionRangeSchema,
    text: z
      .string()
      .min(1)
      .max(8192)
      .refine((v) => {
        const words = v.match(/\S+/gu) ?? [];
        return (
          words.length > 0 &&
          words.length <= 512 &&
          words.every((word) => Buffer.byteLength(word) <= 1024)
        );
      }, "Supplied text exceeds bounded correspondence operands"),
    modelId: z.string().min(1),
  })
  .strict();
export type AlignmentSourceInput = z.infer<typeof alignmentSourceSchema>;
export function selectAlignmentSource(
  assets: Pick<AssetStore, "get" | "path">,
  acquisitions: { get(id: string): Pick<ReturnType<AcquisitionStore["get"]>, "id" | "bindings"> },
  input: AlignmentSourceInput,
) {
  const { text, modelId, ...selection } = alignmentSourceSchema.parse(input);
  const selected = selectSourceChannelRange(assets, acquisitions, selection);
  if (selected.expectedPCM.frames < 1 || selected.expectedPCM.frames > 400000)
    throw new CatalogError(
      "INVALID_PARAMS",
      "Alignment requires at most 25 seconds of complete support",
    );
  return { ...selected, text, modelId };
}
