import { randomUUID } from "node:crypto";
import { link, mkdtemp, open, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { callLocal, resolveServiceSocket, type ServiceSelection } from "@screenrec/client";
import { ARTIFACT_CHUNK_BYTES, resultSchema, type OperationResponse } from "@screenrec/protocol";

export class MediaDeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}
const receipt = z.object({
  token: z.string().min(1),
  bytes: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  expiresAt: z.int(),
});
const ready = z.object({
  state: z.literal("ready"),
  delivery: receipt,
  published: z.union([
    z.object({ frame: z.object({ mediaType: z.literal("image/png") }) }),
    z.object({ audio: z.object({ mediaType: z.literal("audio/wav") }) }),
    z.object({ preview: z.object({ mediaType: z.literal("video/mp4") }) }),
  ]),
});
const chunk = z.object({
  data: z.string(),
  offset: z.int().nonnegative(),
  nextOffset: z.int().nonnegative(),
  eof: z.boolean(),
});

type MediaType = "image/png" | "audio/wav" | "video/mp4";
type MediaInfo = { bytes: number; mediaType: MediaType };

/** One transport validator for buffered model content and streamed playable files. */
async function consumeMedia<T>(
  selection: ServiceSelection,
  result: OperationResponse,
  consume: (info: MediaInfo, chunks: AsyncIterable<Buffer>) => Promise<T>,
): Promise<T | null> {
  if (!result.ok) return null;
  const data = result.data as { state?: unknown } | null;
  if (!data || data.state !== "ready") return null;
  const parsed = ready.safeParse(data);
  if (!parsed.success)
    throw new MediaDeliveryError("INVALID_RESPONSE", "Ready media has no valid delivery");
  const { token, bytes } = parsed.data.delivery;
  let expiresAt = parsed.data.delivery.expiresAt;
  const mediaType: MediaType =
    "frame" in parsed.data.published
      ? "image/png"
      : "audio" in parsed.data.published
        ? "audio/wav"
        : "video/mp4";
  const socket = await resolveServiceSocket(selection);
  async function* chunks() {
    let offset = 0;
    while (offset < bytes) {
      if (Date.now() >= expiresAt)
        throw new MediaDeliveryError("ARTIFACT_EXPIRED", "Media delivery expired", true);
      if (expiresAt - Date.now() < 5000) {
        const renewal = await callLocal(
          socket,
          { id: randomUUID(), operation: "artifact.renew", params: { token } },
          selection.signal ? { signal: selection.signal } : {},
        );
        if (!renewal.ok)
          throw new MediaDeliveryError(
            renewal.error.code,
            renewal.error.message,
            renewal.error.retryable,
          );
        const renewed = receipt.safeParse(renewal.data);
        if (
          !renewed.success ||
          renewed.data.token !== token ||
          renewed.data.bytes !== bytes ||
          renewed.data.expiresAt <= expiresAt
        )
          throw new MediaDeliveryError(
            "INVALID_RESPONSE",
            "Media renewal changed its identity or failed to extend the lease",
          );
        expiresAt = renewed.data.expiresAt;
      }
      const response = await callLocal(
        socket,
        {
          id: randomUUID(),
          operation: "artifact.read",
          params: { token, offset, maxBytes: Math.min(ARTIFACT_CHUNK_BYTES, bytes - offset) },
        },
        selection.signal ? { signal: selection.signal } : {},
      );
      if (!response.ok)
        throw new MediaDeliveryError(
          response.error.code,
          response.error.message,
          response.error.retryable,
        );
      const parsedChunk = chunk.safeParse(response.data);
      if (!parsedChunk.success)
        throw new MediaDeliveryError("INVALID_RESPONSE", "Malformed media chunk");
      const part = parsedChunk.data;
      const decoded = Buffer.from(part.data, "base64");
      if (
        part.offset !== offset ||
        decoded.length < 1 ||
        decoded.length > ARTIFACT_CHUNK_BYTES ||
        part.nextOffset !== offset + decoded.length ||
        part.nextOffset > bytes ||
        part.eof !== (part.nextOffset === bytes) ||
        decoded.toString("base64") !== part.data
      )
        throw new MediaDeliveryError(
          "INVALID_RESPONSE",
          "Media chunk does not advance within the delivery",
        );
      offset = part.nextOffset;
      yield decoded;
    }
  }
  try {
    return await consume({ bytes, mediaType }, chunks());
  } finally {
    // Expiry releases the same pin if the service disappeared or the caller was canceled.
    await callLocal(
      socket,
      { id: randomUUID(), operation: "artifact.close", params: { token } },
      { timeoutMs: 1000 },
    ).catch(() => undefined);
  }
}

export async function mediaBytes(
  selection: ServiceSelection,
  result: OperationResponse,
): Promise<{ bytes: Buffer; mediaType: "image/png" | "audio/wav" } | null> {
  const parsed = result.ok ? ready.safeParse(result.data) : null;
  // Large audio remains a renewable artifact for MCP callers instead of becoming one huge message.
  if (
    parsed?.success &&
    "audio" in parsed.data.published &&
    parsed.data.delivery.bytes > 48 * 1024 ** 2
  )
    return null;
  return consumeMedia(selection, result, async ({ bytes, mediaType }, chunks) => {
    if (mediaType === "video/mp4")
      throw new MediaDeliveryError(
        "INVALID_REQUEST",
        "Playable previews must be streamed to a file",
      );
    if (mediaType === "image/png" && bytes > 32 * 1024 ** 2)
      throw new MediaDeliveryError(
        "LIMIT_EXCEEDED",
        "Image exceeds its buffered delivery byte limit",
      );
    const output = Buffer.alloc(bytes);
    let offset = 0;
    for await (const chunk of chunks) {
      chunk.copy(output, offset);
      offset += chunk.length;
    }
    return { bytes: output, mediaType };
  });
}

/** Publish only the complete file, without replacing a caller's existing destination. */
export async function mediaFile(
  selection: ServiceSelection,
  result: OperationResponse,
  destination?: string,
): Promise<(MediaInfo & { output: string }) | null> {
  let ownedDirectory: string | undefined;
  try {
    return await consumeMedia(selection, result, async (info, chunks) => {
      const names = {
        "image/png": "frame.png",
        "audio/wav": "excerpt.wav",
        "video/mp4": "preview.mp4",
      };
      const output = destination
        ? resolve(destination)
        : join(
            (ownedDirectory = await mkdtemp(join(tmpdir(), "screenrec-media-"))),
            names[info.mediaType],
          );
      const staging = await mkdtemp(join(dirname(output), ".screenrec-media-"));
      try {
        const file = await open(join(staging, "media"), "wx", 0o600);
        try {
          for await (const part of chunks) await file.writeFile(part);
          await file.sync();
        } finally {
          await file.close();
        }
        await link(join(staging, "media"), output);
        return { ...info, output };
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    });
  } catch (error) {
    if (ownedDirectory) await rm(ownedDirectory, { recursive: true, force: true });
    throw error;
  }
}

const targetedBatch = <T extends z.ZodRawShape>(fields: T) =>
  z.union([
    z.object({
      ...fields,
      projectId: z.string(),
      recordingId: z.never().optional(),
      packageHandle: z.never().optional(),
    }),
    z.object({
      ...fields,
      recordingId: z.string(),
      packageHandle: z.never().optional(),
      projectId: z.never().optional(),
    }),
    z.object({
      ...fields,
      packageHandle: z.string(),
      recordingId: z.never().optional(),
      projectId: z.never().optional(),
    }),
  ]);
const indexBatchResponse = targetedBatch({
  revisionId: z.string(),
  generation: z.string(),
  items: z
    .array(z.intersection(resultSchema, z.object({ ordinal: z.int().nonnegative() })))
    .min(1)
    .max(8),
});
const frameItems = z
  .array(z.intersection(resultSchema, z.object({ atUs: z.number() })))
  .min(1)
  .max(8);
const batchResponse = {
  atUs: z.union([
    ...targetedBatch({ revisionId: z.string(), items: frameItems }).options,
    z.object({
      assetId: z.string(),
      streamId: z.string(),
      acquisitionId: z.string().optional(),
      projectId: z.never().optional(),
      recordingId: z.never().optional(),
      packageHandle: z.never().optional(),
      items: frameItems,
    }),
  ]),
  ordinal: indexBatchResponse,
};

// Drain every ready item's lease even when another read or output write fails.
export async function consumeBatch(
  selection: ServiceSelection,
  result: OperationResponse,
  reference: keyof typeof batchResponse,
  consume: (
    media: NonNullable<Awaited<ReturnType<typeof mediaBytes>>>,
    index: number,
  ) => Promise<Record<string, unknown>>,
  errorDetails: (error: unknown) => Extract<OperationResponse, { ok: false }>["error"],
): Promise<OperationResponse> {
  if (!result.ok) return result;
  const parsed = batchResponse[reference].safeParse(result.data);
  if (!parsed.success)
    throw new MediaDeliveryError("INVALID_RESPONSE", "Batch response does not match its request");
  const batch = parsed.data;
  const items = [];
  for (const [index, item] of batch.items.entries()) {
    try {
      const media = await mediaBytes(selection, { ...item, id: result.id });
      items.push(
        media && item.ok
          ? {
              ...item,
              data: { ...(item.data as Record<string, unknown>), ...(await consume(media, index)) },
            }
          : item,
      );
    } catch (error) {
      const identity = "ordinal" in item ? { ordinal: item.ordinal } : { atUs: item.atUs };
      items.push({ ...identity, ok: false, error: errorDetails(error) });
    }
  }
  return { ...result, data: { ...batch, items } };
}
