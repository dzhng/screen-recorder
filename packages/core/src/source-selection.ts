import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  mediaClipSchema,
  sourceAvailability,
  toSignedTime,
  subtract,
  fromTime,
} from "@screenrec/composition";
import { compositionAsset, type Asset, type AssetStore } from "./assets.js";
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
  const acquisition =
    selection.acquisitionId === undefined ? undefined : acquisitions.get(selection.acquisitionId);
  return selectSourceMetadata(asset, assets.path(asset.id), acquisition, selection);
}

/** Identical selection rules apply to immutable admitted metadata before catalog publication. */
export function selectSourceMetadata(
  asset: Asset,
  path: string,
  acquisition:
    | { id: string; bindings: ReturnType<AcquisitionStore["get"]>["bindings"] }
    | undefined,
  input: SourceSelection,
) {
  const selection = sourceSelectionSchema.parse(input);
  if (asset.id !== selection.assetId || acquisition?.id !== selection.acquisitionId)
    throw new CatalogError("INVALID_PARAMS", "Source metadata differs from selection");
  const stream = compositionAsset(asset).streams.find((value) => value.id === selection.streamId);
  if (!stream || stream.kind === "image")
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "Source inspection requires a decodable timed stream",
      selection,
    );
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
      source: path,
      streamId: stream.id,
      sourceOffsetUs: toSignedTime(subtract(fromTime(0), fromTime(asset.originUs))),
      available,
    },
  };
}

export const sourceSelectionKey = (value: SourceSelection) =>
  JSON.stringify([value.assetId, value.streamId, value.acquisitionId ?? null]);
