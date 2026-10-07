import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { CatalogError } from "@yap/core/catalog";
import { hashFile } from "@yap/core/files";
import type { selectSourceChannelRange } from "@yap/core/source-selection";
import { nativeResult, type MediaWorker } from "./worker.js";
export type SourcePCMDecoder = {
  recipe: "source-selected-span-avfoundation-f32-16k-v1";
  workerSha256: string;
  osBuild: string;
};
const capabilitiesSchema = z.object({
  recipe: z.literal("source-selected-span-avfoundation-f32-16k-v1"),
  providerVersion: z.string().min(1),
});
const pcmSchema = z.object({
  file: z.string(),
  bytes: z.int().positive().max(1920000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sampleRate: z.literal(16000),
  frames: z.int().positive().max(480000),
  channels: z.literal(1),
  channel: z.int().nonnegative(),
  sourceChannels: z.int().positive(),
  sourceSampleRate: z.int().positive(),
  range: z.unknown(),
  sourceOffsetUs: z.unknown(),
  recipe: z.string(),
  representation: z.literal("float32-le"),
  providerVersion: z.string(),
});
/** Missing optional execution leaves ready evidence readable and new observations unavailable. */
export async function sourcePCMDecoder(
  native: MediaWorker,
  executable: string | undefined,
  signal: AbortSignal,
): Promise<SourcePCMDecoder | null> {
  if (!executable) return null;
  try {
    const capability = capabilitiesSchema.parse(
      nativeResult(
        await native("media.sourceChannelCapabilities", {}, { signal, timeoutMs: 5000 }),
      ),
    );
    if (capability.recipe !== "source-selected-span-avfoundation-f32-16k-v1") return null;
    const file = await open(
      executable,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await file.stat();
      if (!stat.isFile()) return null;
      const pin = await hashFile(file, stat.size, signal);
      return {
        recipe: capability.recipe,
        workerSha256: pin.sha256,
        osBuild: capability.providerVersion,
      };
    } finally {
      await file.close();
    }
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}

/** One native decode receipt binds both bounded providers to unchanged selected PCM. */
export async function sourceChannelPCM<Frames extends number>(
  execute: MediaWorker,
  selected: ReturnType<typeof selectSourceChannelRange> & { expectedPCM: { frames: Frames } },
  decoder: { recipe: string; osBuild: string },
  pcmPath: string,
  signal: AbortSignal,
) {
  const raw = nativeResult(
    await execute(
      "media.sourceChannelPCM",
      {
        source: selected.track,
        range: selected.sourceRange,
        channel: selected.channel,
        output: pcmPath,
      },
      { signal, timeoutMs: 90000 },
    ),
  );
  const receipt = pcmSchema.parse(raw);
  if (
    receipt.file !== pcmPath ||
    receipt.frames !== selected.expectedPCM.frames ||
    receipt.bytes !== selected.expectedPCM.frames * 4 ||
    receipt.channel !== selected.channel ||
    selected.stream.kind !== "audio" ||
    receipt.sourceChannels !== selected.stream.channels ||
    receipt.recipe !== decoder.recipe ||
    receipt.providerVersion !== decoder.osBuild ||
    !isDeepStrictEqual(receipt.range, selected.sourceRange) ||
    !isDeepStrictEqual(receipt.sourceOffsetUs, selected.track.sourceOffsetUs)
  )
    throw new CatalogError(
      "ARTIFACT_CHANGED",
      "Selected channel PCM differs from the admitted source and decoder",
    );
  const file = await open(
    pcmPath,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await file.stat();
    if (
      !stat.isFile() ||
      stat.size !== receipt.bytes ||
      (await hashFile(file, stat.size, signal)).sha256 !== receipt.sha256
    )
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Prepared selected PCM differs from its complete receipt",
      );
  } finally {
    await file.close();
  }
  return {
    sha256: receipt.sha256,
    sampleRate: receipt.sampleRate,
    frames: selected.expectedPCM.frames,
  };
}
