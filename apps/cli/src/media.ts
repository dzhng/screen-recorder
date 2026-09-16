import { randomUUID } from "node:crypto";
import { z } from "zod";
import { callLocal, resolveServiceSocket, type ServiceSelection } from "@screenrec/client";
import type { OperationResponse } from "@screenrec/protocol";

export class ImageDeliveryError extends Error {
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
    .max(32 * 1024 * 1024),
  expiresAt: z.int(),
});
const ready = z.object({
  state: z.literal("ready"),
  delivery: receipt,
  published: z.object({ frame: z.object({ mediaType: z.literal("image/png") }) }),
});
const chunk = z.object({
  data: z.string(),
  offset: z.int().nonnegative(),
  nextOffset: z.int().nonnegative(),
  eof: z.boolean(),
});

/** Consume the service's pinned read; metadata and image bytes never share one oversized socket frame. */
export async function imageBytes(
  selection: ServiceSelection,
  result: OperationResponse,
): Promise<Buffer | null> {
  if (!result.ok) return null;
  const data = result.data as { state?: unknown } | null;
  if (!data || data.state !== "ready") return null;
  const parsed = ready.safeParse(data);
  if (!parsed.success)
    throw new ImageDeliveryError("INVALID_RESPONSE", "Ready frame has no valid image delivery");
  const { token, bytes, expiresAt } = parsed.data.delivery;
  const socket = await resolveServiceSocket(selection);
  try {
    const output = Buffer.alloc(bytes);
    let offset = 0;
    while (offset < bytes) {
      if (Date.now() >= expiresAt)
        throw new ImageDeliveryError("ARTIFACT_EXPIRED", "Image delivery expired", true);
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
        throw new ImageDeliveryError(
          response.error.code,
          response.error.message,
          response.error.retryable,
        );
      const parsedChunk = chunk.safeParse(response.data);
      if (!parsedChunk.success)
        throw new ImageDeliveryError("INVALID_RESPONSE", "Malformed image chunk");
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
        throw new ImageDeliveryError(
          "INVALID_RESPONSE",
          "Image chunk does not advance within the delivery",
        );
      decoded.copy(output, offset);
      offset = part.nextOffset;
    }
    return output;
  } finally {
    // Expiry releases the same pin if the service disappeared or the caller was canceled.
    await callLocal(
      socket,
      { id: randomUUID(), operation: "artifact.close", params: { token } },
      { timeoutMs: 1000 },
    ).catch(() => undefined);
  }
}
