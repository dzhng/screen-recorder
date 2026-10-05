import { z } from "zod";
import {
  selectionRangeSchema,
  sourceAvailability,
  compare,
  fromTime,
  rational,
  subtract,
  add,
  multiply,
} from "@screenrec/composition";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { CatalogError } from "./catalog.js";
import { selectSource, sourceSelectionSchema } from "./source-selection.js";

export const speakerSourceSchema = sourceSelectionSchema
  .extend({
    channel: z.int().nonnegative(),
    sourceRange: selectionRangeSchema,
    modelId: z.string().min(1),
  })
  .strict();
export type SpeakerSourceInput = z.infer<typeof speakerSourceSchema>;

/** Select one source channel without inventing an observation range or requesting inference. */
export function selectSpeakerChannel(
  assets: Pick<AssetStore, "get" | "path">,
  acquisitions: { get(id: string): Pick<ReturnType<AcquisitionStore["get"]>, "id" | "bindings"> },
  input: Omit<SpeakerSourceInput, "sourceRange">,
) {
  const { channel, modelId, ...selection } = speakerSourceSchema
    .omit({ sourceRange: true })
    .parse(input);
  const source = selectSource(assets, acquisitions, selection);
  if (source.stream.kind !== "audio")
    throw new CatalogError("UNSUPPORTED_MEDIA", "Speaker observations require an audio stream");
  if (source.stream.channels === undefined || channel >= source.stream.channels)
    throw new CatalogError(
      "UNSUPPORTED_MEDIA",
      "Speaker observations require a known source channel",
    );
  return { ...source, originUs: assets.get(selection.assetId).originUs, channel, modelId };
}
/** Admit one complete source observation; decoding retains this source/support authority. */
export function selectSpeakerSource(
  assets: Pick<AssetStore, "get" | "path">,
  acquisitions: { get(id: string): Pick<ReturnType<AcquisitionStore["get"]>, "id" | "bindings"> },
  input: SpeakerSourceInput,
) {
  const { sourceRange, ...selection } = speakerSourceSchema.parse(input);
  const source = selectSpeakerChannel(assets, acquisitions, selection);
  const start = fromTime(sourceRange.startUs);
  const duration = subtract(fromTime(sourceRange.endUs), start);
  if (compare(duration, rational(30_000_000n)) !== 0)
    throw new CatalogError("INVALID_PARAMS", "Speaker observations require exactly 30 seconds");
  const startFrame = multiply(start, rational(16_000n, 1_000_000n));
  if (startFrame.denominator !== 1n)
    throw new CatalogError(
      "INVALID_PARAMS",
      "Speaker observations must start on the 16k sample grid",
    );
  const covered = sourceAvailability(source.track.available, [sourceRange]).reduce(
    (sum, range) => add(sum, subtract(fromTime(range.endUs), fromTime(range.startUs))),
    rational(0n),
  );
  if (compare(covered, duration) !== 0)
    throw new CatalogError(
      "UNAVAILABLE_SUPPORT",
      "Speaker observations require complete selected support",
    );
  return {
    ...source,
    sourceRange,
    expectedPCM: { sampleRate: 16_000, frames: 480_000 },
  };
}
