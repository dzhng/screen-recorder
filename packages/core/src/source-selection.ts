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

/** One synchronous evidence phase owns these lookups; never retain it across an await. */
export class SourceSelectionRead {
  private readonly assets = new Map<
    string,
    { asset: ReturnType<typeof compositionAsset>; originUs: Asset["originUs"] }
  >();
  private readonly acquisitions = new Map<string, ReturnType<AcquisitionStore["get"]>>();
  constructor(
    private readonly assetStore: AssetStore,
    private readonly acquisitionStore: AcquisitionStore,
  ) {}
  get(input: SourceSelection) {
    const selection = sourceSelectionSchema.parse(input);
    let metadata = this.assets.get(selection.assetId);
    if (!metadata) {
      const asset = this.assetStore.get(selection.assetId);
      metadata = { asset: compositionAsset(asset), originUs: asset.originUs };
      this.assets.set(selection.assetId, metadata);
    }
    let acquisition =
      selection.acquisitionId === undefined
        ? undefined
        : this.acquisitions.get(selection.acquisitionId);
    if (!acquisition && selection.acquisitionId !== undefined) {
      acquisition = this.acquisitionStore.get(selection.acquisitionId);
      this.acquisitions.set(selection.acquisitionId, acquisition);
    }
    const selected = selectSourceSupport(metadata.asset, acquisition, selection);
    return {
      ...selected,
      acquisition,
      track: sourceTrackSupport(metadata.originUs, selected.available),
    };
  }
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
  const selected = selectSourceSupport(compositionAsset(asset), acquisition, input);
  return {
    selection: selected.selection,
    stream: selected.stream,
    durationUs: selected.durationUs,
    supportDigest: selected.supportDigest,
    track: {
      source: path,
      streamId: selected.stream.id,
      ...sourceTrackSupport(asset.originUs, selected.available),
    },
  };
}

function sourceTrackSupport(
  originUs: Asset["originUs"],
  available: ReturnType<typeof selectSourceSupport>["available"],
) {
  return { sourceOffsetUs: toSignedTime(subtract(fromTime(0), fromTime(originUs))), available };
}

/** Evidence needs the same source authority and support without a renderable file address. */
export function selectSourceSupport(
  asset: ReturnType<typeof compositionAsset>,
  acquisition: Pick<ReturnType<AcquisitionStore["get"]>, "id" | "bindings"> | undefined,
  input: SourceSelection,
) {
  const selection = sourceSelectionSchema.parse(input);
  if (asset.id !== selection.assetId || acquisition?.id !== selection.acquisitionId)
    throw new CatalogError("INVALID_PARAMS", "Source metadata differs from selection");
  const stream = asset.streams.find((value) => value.id === selection.streamId);
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
    binding,
    available,
  };
}

export const sourceSelectionKey = (value: SourceSelection) =>
  JSON.stringify([value.assetId, value.streamId, value.acquisitionId ?? null]);
