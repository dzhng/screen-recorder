export const REQUEST_FRAME_BYTES = 1024 * 1024;
export const RESPONSE_FRAME_BYTES = 8 * 1024 * 1024;
export const DEFAULT_CALL_TIMEOUT_MS = 10_000;

export class FrameError extends Error {
  constructor(
    readonly code: "FRAME_TOO_LARGE" | "MALFORMED_FRAME" | "TRUNCATED_FRAME",
    message: string,
  ) {
    super(message);
  }
}

export function encodeJsonLine(value: unknown, maxBytes: number): Buffer {
  const json = JSON.stringify(value, (_key, item: unknown) => {
    if (
      item === undefined ||
      ["function", "symbol", "bigint"].includes(typeof item) ||
      (typeof item === "number" && !Number.isFinite(item))
    )
      throw new FrameError("MALFORMED_FRAME", "Value is not JSON");
    return item;
  });
  if (json === undefined) throw new FrameError("MALFORMED_FRAME", "Value is not JSON");
  if (Buffer.byteLength(json) + 1 > maxBytes)
    throw new FrameError("FRAME_TOO_LARGE", "JSON frame exceeds the byte limit");
  return Buffer.from(json + "\n");
}

export class JsonLineReader {
  private buffer: Buffer = Buffer.alloc(0);
  private bytes = 0;
  private complete = false;
  private value: unknown;
  constructor(private readonly maxBytes: number) {}
  push(chunk: Uint8Array): unknown {
    if (this.complete) throw new FrameError("MALFORMED_FRAME", "Expected exactly one JSON line");
    const size = this.bytes + chunk.byteLength;
    if (size > this.maxBytes)
      throw new FrameError("FRAME_TOO_LARGE", "JSON frame exceeds the byte limit");
    const newline = chunk.indexOf(10);
    if (newline >= 0 && newline !== chunk.byteLength - 1)
      throw new FrameError("MALFORMED_FRAME", "Expected exactly one JSON line");
    if (size > this.buffer.length) {
      const next = Buffer.allocUnsafe(
        Math.min(this.maxBytes, Math.max(size, this.buffer.length * 2, 1024)),
      );
      this.buffer.copy(next, 0, 0, this.bytes);
      this.buffer = next;
    }
    this.buffer.set(chunk, this.bytes);
    this.bytes = size;
    if (newline < 0) return undefined;
    try {
      // Decode only a complete frame: multi-byte UTF-8 can cross socket chunks.
      this.value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(this.buffer.subarray(0, size - 1)),
      );
    } catch {
      throw new FrameError("MALFORMED_FRAME", "Invalid UTF-8 or JSON");
    }
    this.complete = true;
    this.buffer = Buffer.alloc(0);
    return this.value;
  }
  finish(): unknown {
    if (!this.complete)
      throw new FrameError("TRUNCATED_FRAME", "Connection ended before the JSON line terminator");
    return this.value;
  }
}
