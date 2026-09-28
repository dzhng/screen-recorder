import { createHash } from "node:crypto";
import type { z } from "zod";
import { mediaClipSchema, sourceAvailability } from "@screenrec/composition";
import { compositionAsset, type AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { CatalogError } from "./catalog.js";

export const sourceSelectionSchema = mediaClipSchema.pick({
  assetId: true,
  streamId: true,
  acquisitionId: true,
});
export type SourceSelection = z.infer<typeof sourceSelectionSchema>;

/** Resolve immutable source inputs without inventing a recording or a project timeline. */
export function selectSource(
  assets: AssetStore,
  acquisitions: AcquisitionStore,
  input: SourceSelection,
) {
  const selection = sourceSelectionSchema.parse(input);
  const asset = assets.get(selection.assetId);
  const stream = compositionAsset(asset).streams.find((value) => value.id === selection.streamId);
  if (!stream || stream.kind === "image")
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "Source inspection requires a decodable timed stream",
      selection,
    );
  const acquisition =
    selection.acquisitionId === undefined ? undefined : acquisitions.get(selection.acquisitionId);
  const binding = acquisition?.bindings.find(
    (value) => value.assetId === asset.id && value.streamId === stream.id,
  );
  if (acquisition && !binding)
    throw new CatalogError(
      "INVALID_PARAMS",
      "Acquisition does not bind the selected asset and stream",
      selection,
    );
  const available = sourceAvailability(stream.available, binding?.available);
  const supportDigest = createHash("sha256").update(JSON.stringify(available)).digest("hex");
  return {
    selection,
    stream,
    durationUs: stream.bounds.endUs,
    supportDigest,
    track: {
      source: assets.path(asset.id),
      streamId: stream.id,
      sourceOffsetUs: -asset.originUs,
      available,
    },
  };
}
