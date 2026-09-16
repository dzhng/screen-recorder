import { randomUUID } from "node:crypto";
import { z } from "zod";
import { callLocal, resolveServiceSocket, type ServiceSelection } from "@screenrec/client";
import { resultSchema, type OperationResponse } from "@screenrec/protocol";

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
  bytes: z
    .int()
    .min(1)
    .max(48 * 1024 * 1024),
  expiresAt: z.int(),
});
const ready = z.object({
  state: z.literal("ready"),
  delivery: receipt,
  published: z.union([
    z.object({ frame: z.object({ mediaType: z.literal("image/png") }) }),
    z.object({ audio: z.object({ mediaType: z.literal("audio/wav") }) }),
  ]),
});
const chunk = z.object({
  data: z.string(),
  offset: z.int().nonnegative(),
  nextOffset: z.int().nonnegative(),
  eof: z.boolean(),
});

/** Consume the service's pinned read; metadata and media bytes never share one oversized socket frame. */
export async function mediaBytes(
  selection: ServiceSelection,
  result: OperationResponse,
): Promise<{ bytes: Buffer; mediaType: "image/png" | "audio/wav" } | null> {
  if (!result.ok) return null;
  const data = result.data as { state?: unknown } | null;
  if (!data || data.state !== "ready") return null;
  const parsed = ready.safeParse(data);
  if (!parsed.success)
    throw new MediaDeliveryError("INVALID_RESPONSE", "Ready media has no valid delivery");
  const { token, bytes, expiresAt } = parsed.data.delivery;
  const mediaType = "frame" in parsed.data.published ? "image/png" : "audio/wav";
  const socket = await resolveServiceSocket(selection);
  try {
    if (bytes > (mediaType === "image/png" ? 32 : 48) * 1024 * 1024)
      throw new MediaDeliveryError("LIMIT_EXCEEDED", "Media exceeds its delivery byte limit");
    const output = Buffer.alloc(bytes);
    let offset = 0;
    while (offset < bytes) {
      if (Date.now() >= expiresAt)
        throw new MediaDeliveryError("ARTIFACT_EXPIRED", "Media delivery expired", true);
      const response = await callLocal(
        socket,
        {
          id: randomUUID(),
          operation: "artifact.read",
          params: { token, offset, maxBytes: Math.min(512 * 1024, bytes - offset) },
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
        decoded.length > 512 * 1024 ||
        part.nextOffset !== offset + decoded.length ||
        part.nextOffset > bytes ||
        part.eof !== (part.nextOffset === bytes) ||
        decoded.toString("base64") !== part.data
      )
        throw new MediaDeliveryError(
          "INVALID_RESPONSE",
          "Media chunk does not advance within the delivery",
        );
      decoded.copy(output, offset);
      offset = part.nextOffset;
    }
    return { bytes: output, mediaType };
  } finally {
    // Expiry releases the same pin if the service disappeared or the caller was canceled.
    await callLocal(
      socket,
      { id: randomUUID(), operation: "artifact.close", params: { token } },
      { timeoutMs: 1000 },
    ).catch(() => undefined);
  }
}

const batchResponse = {
  atUs: z.object({
    recordingId: z.string(),
    revisionId: z.string(),
    items: z
      .array(z.intersection(resultSchema, z.object({ atUs: z.number() })))
      .min(1)
      .max(8),
  }),
  ordinal: z.object({
    recordingId: z.string(),
    revisionId: z.string(),
    generation: z.string(),
    items: z
      .array(z.intersection(resultSchema, z.object({ ordinal: z.int().nonnegative() })))
      .min(1)
      .max(8),
  }),
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
  const batch = batchResponse[reference].parse(result.data);
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
