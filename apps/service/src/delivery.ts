import { randomUUID } from "node:crypto";
import type { CacheRead, DerivedCache } from "@screenrec/core/cache";
import { CatalogError } from "@screenrec/core/library";

type Lease = { handle: CacheRead; expiresAt: number; timer: ReturnType<typeof setTimeout> };
const lifetimeMs = 30_000;
const maximumLeases = 32;
const maximumChunkBytes = 512 * 1024;

/** Local metadata transport carries bounded chunks; the service retains the cache read pin.
 * EOF does not close a lease: the last chunk must remain retryable after a lost response. */
export class DerivativeDelivery {
  private readonly leases = new Map<string, Lease>();
  private disposed = false;
  constructor(private readonly cache: DerivedCache) {}

  open(cacheId: string): { token: string; bytes: number; expiresAt: number } {
    if (this.disposed) throw new CatalogError("SERVICE_STOPPED", "Derivative delivery is closed");
    this.expire();
    if (this.leases.size >= maximumLeases)
      throw new CatalogError("LIMIT_EXCEEDED", "Too many derivative deliveries are open", {}, true);
    const handle = this.cache.acquire(cacheId);
    if (!handle)
      throw new CatalogError(
        "ARTIFACT_EXPIRED",
        "Cached derivative is no longer available",
        {},
        true,
      );
    try {
      const token = randomUUID();
      const expiresAt = Date.now() + lifetimeMs;
      const timer = setTimeout(() => this.close(token), lifetimeMs);
      timer.unref();
      this.leases.set(token, { handle, expiresAt, timer });
      return { token, bytes: handle.bytes, expiresAt };
    } catch (error) {
      handle.release();
      throw error;
    }
  }

  read(
    token: string,
    offset: number,
    maxBytes: number,
  ): {
    data: string;
    offset: number;
    nextOffset: number;
    eof: boolean;
  } {
    const lease = this.leases.get(token);
    if (!lease || Date.now() >= lease.expiresAt) {
      this.close(token);
      throw new CatalogError(
        "ARTIFACT_EXPIRED",
        "Derivative delivery has expired or closed",
        {},
        true,
      );
    }
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > lease.handle.bytes ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      maxBytes > maximumChunkBytes
    )
      throw new CatalogError(
        "INVALID_RANGE",
        "Expected an in-file offset and a chunk of 1 to 524288 bytes",
      );
    const size = Math.min(maxBytes, lease.handle.bytes - offset);
    const buffer = Buffer.alloc(size);
    try {
      let received = 0;
      while (received < size) {
        const count = lease.handle.read(buffer.subarray(received), offset + received);
        if (count === 0)
          throw new CatalogError(
            "ARTIFACT_EXPIRED",
            "Cached derivative ended before its published size",
            {},
            true,
          );
        received += count;
      }
      const nextOffset = offset + received;
      return {
        data: buffer.toString("base64"),
        offset,
        nextOffset,
        eof: nextOffset === lease.handle.bytes,
      };
    } catch (error) {
      this.close(token);
      throw error;
    }
  }

  close(token: string): void {
    const lease = this.leases.get(token);
    if (!lease) return;
    this.leases.delete(token);
    clearTimeout(lease.timer);
    lease.handle.release();
  }
  dispose(): void {
    this.disposed = true;
    for (const token of this.leases.keys()) this.close(token);
  }
  private expire(): void {
    const now = Date.now();
    for (const [token, lease] of this.leases) if (now >= lease.expiresAt) this.close(token);
  }
}
