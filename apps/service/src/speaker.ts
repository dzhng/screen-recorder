import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { CatalogError } from "@screenrec/core/catalog";
import { hashFile } from "@screenrec/core/files";
import type { SpeakerObserver } from "@screenrec/core/speaker-processing";
import type { SpeakerEvidenceSource } from "@screenrec/core/speaker-evidence";
import { withRenderAttempt } from "./render.js";
import { nativeResult, preparedModelWorker, type MediaWorker } from "./worker.js";

const capabilitiesSchema = z.object({
  recipe: z.string().min(1),
  providerVersion: z.string().min(1),
});
const pcmSchema = z.object({
  file: z.string(),
  bytes: z.literal(1920000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sampleRate: z.literal(16000),
  frames: z.literal(480000),
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
export async function speakerDecoder(
  native: MediaWorker,
  executable: string | undefined,
  signal: AbortSignal,
): Promise<SpeakerEvidenceSource["decoder"] | null> {
  if (!executable) return null;
  try {
    const capability = capabilitiesSchema.parse(
      nativeResult(await native("media.speakerCapabilities", {}, { signal, timeoutMs: 5000 })),
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
async function operand(path: string): Promise<string> {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024)
      throw new CatalogError("INVALID_EVIDENCE", "Speaker operand exceeds bounded regular storage");
    return await file.readFile("utf8");
  } finally {
    await file.close();
  }
}
/** Capture original sidecar files while the render-attempt owner still retains their workspace. */
export function speakerObserver(native: MediaWorker, workspace: string): SpeakerObserver {
  return async (request, signal) => {
    const model = preparedModelWorker(request.runtime, 600000);
    const worker: MediaWorker = (operation, params, options) =>
      (operation === "speaker.observe" ? model : native)(operation, params, options);
    return withRenderAttempt(
      worker,
      workspace,
      signal,
      async (directory, execute) => {
        const pcmPath = join(directory, "speaker.f32");
        const output = join(directory, "speaker-report.json");
        const { selected, decoder } = request;
        const raw = nativeResult(
          await execute(
            "media.sourceSpeakerPCM",
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
            "Speaker PCM differs from the admitted source and decoder",
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
              "Prepared speaker PCM differs from its complete receipt",
            );
        } finally {
          await file.close();
        }
        const result = await execute(
          "speaker.observe",
          {
            model: request.checkpoint,
            pcm: pcmPath,
            pcmSha256: receipt.sha256,
            frames: receipt.frames,
            sampleRate: receipt.sampleRate,
            output,
          },
          { signal, timeoutMs: 600000 },
        );
        const operands = {
          nativeReceipt: await operand(output + ".native-unverified.json"),
          report: await operand(output),
        };
        return {
          pcm: { sha256: receipt.sha256, sampleRate: receipt.sampleRate, frames: receipt.frames },
          operands,
          ...(result.ok
            ? {}
            : {
                failure: new CatalogError(
                  result.error.code,
                  result.error.message,
                  result.error.details,
                  result.error.retryable,
                ),
              }),
        };
      },
      async (observed) => observed,
    );
  };
}
