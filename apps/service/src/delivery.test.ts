import { afterEach, expect, test, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  truncateSync,
  openSync,
  closeSync,
  readSync,
  fstatSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DerivedCache } from "@screenrec/core/cache";
import { RevisionStore } from "@screenrec/core/library";
import { DerivativeDelivery } from "./delivery.js";
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((run) => run());
  vi.useRealTimers();
});
async function fixture(data = Buffer.from("screen evidence")) {
  const home = mkdtempSync(join(tmpdir(), "derivative-delivery-"));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "",
    newId: () => "unused",
  });
  const cache = new DerivedCache(store, home);
  await cache.reconcile();
  const reservation = cache.reserve();
  writeFileSync(reservation.path, data);
  const file = await cache.publish(reservation.id);
  const delivery = new DerivativeDelivery();
  cleanups.push(
    () => rmSync(home, { recursive: true, force: true }),
    () => store.close(),
    () => delivery.dispose(),
  );
  return { home, cache, file, delivery, data };
}
test("chunks round-trip binary bytes and any position can be retried including EOF", async () => {
  const f = await fixture(Buffer.from([0, 255, 1, 254, 2, 253, 3]));
  const lease = f.delivery.open(() => f.cache.acquire(f.file.id));
  const first = f.delivery.read(lease.token, 0, 3);
  expect(Buffer.from(first.data, "base64")).toEqual(f.data.subarray(0, 3));
  expect(first).toMatchObject({ offset: 0, nextOffset: 3, eof: false });
  const last = f.delivery.read(lease.token, 3, 30);
  expect(Buffer.from(last.data, "base64")).toEqual(f.data.subarray(3));
  expect(last).toMatchObject({ offset: 3, nextOffset: 7, eof: true });
  expect(f.delivery.read(lease.token, 0, 3)).toEqual(first);
  expect(f.delivery.read(lease.token, 7, 30)).toEqual({
    data: "",
    offset: 7,
    nextOffset: 7,
    eof: true,
  });
  expect(() => f.cache.remove(f.file.id)).toThrow("being read");
  f.delivery.close(lease.token);
  f.delivery.close(lease.token);
  f.cache.remove(f.file.id);
  expect(f.cache.acquire(f.file.id)).toBeNull();
});

test("a fixed expiry releases the cache without another delivery call", async () => {
  const f = await fixture();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const lease = f.delivery.open(() => f.cache.acquire(f.file.id));
  expect(lease.expiresAt).toBe(31_000);
  await vi.advanceTimersByTimeAsync(29_000);
  expect(f.delivery.read(lease.token, 0, 1).data).toBe(f.data.subarray(0, 1).toString("base64"));
  await vi.advanceTimersByTimeAsync(1000);
  // Only a cache operation follows the timer; expiry cannot rely on read/open polling.
  expect(() => f.cache.remove(f.file.id)).not.toThrow();
  expect(() => f.delivery.read(lease.token, 0, 1)).toThrow(
    expect.objectContaining({ code: "ARTIFACT_EXPIRED", retryable: true }),
  );
});

test("lease limit is explicit and dispose releases every reader and refuses reopening", async () => {
  const f = await fixture();
  const leases = Array.from({ length: 32 }, () =>
    f.delivery.open(() => f.cache.acquire(f.file.id)),
  );
  expect(new Set(leases.map((lease) => lease.token)).size).toBe(32);
  const forbiddenAcquire = () => {
    throw new Error("Acquisition ran before admission");
  };
  expect(() => f.delivery.open(forbiddenAcquire)).toThrow(
    expect.objectContaining({ code: "LIMIT_EXCEEDED" }),
  );
  f.delivery.close(leases[0]!.token);
  f.delivery.open(() => f.cache.acquire(f.file.id));
  f.delivery.dispose();
  f.delivery.dispose();
  expect(() => f.cache.remove(f.file.id)).not.toThrow();
  expect(() => f.delivery.open(forbiddenAcquire)).toThrow(
    expect.objectContaining({ code: "SERVICE_STOPPED" }),
  );
});

test("chunk bounds reject invalid reads without discarding an otherwise usable lease", async () => {
  const f = await fixture(Buffer.alloc(512 * 1024 + 1, 0xfa));
  const lease = f.delivery.open(() => f.cache.acquire(f.file.id));
  for (const [offset, size] of [
    [-1, 1],
    [0.5, 1],
    [f.data.length + 1, 1],
    [0, 0],
    [0, 512 * 1024 + 1],
    [0, NaN],
  ])
    expect(() => f.delivery.read(lease.token, offset!, size!)).toThrow(
      expect.objectContaining({ code: "INVALID_RANGE" }),
    );
  const first = f.delivery.read(lease.token, 0, 512 * 1024);
  const last = f.delivery.read(lease.token, first.nextOffset, 512 * 1024);
  expect(
    Buffer.concat([Buffer.from(first.data, "base64"), Buffer.from(last.data, "base64")]),
  ).toEqual(f.data);
  expect(last).toMatchObject({ nextOffset: f.data.length, eof: true });
});

test("missing cache and broken reads report expiry and release failed transfer handles", async () => {
  const f = await fixture();
  expect(() => f.delivery.open(() => f.cache.acquire("unknown"))).toThrow(
    expect.objectContaining({ code: "ARTIFACT_EXPIRED", retryable: true }),
  );
  const lease = f.delivery.open(() => f.cache.acquire(f.file.id));
  truncateSync(f.file.path, 0);
  expect(() => f.delivery.read(lease.token, 0, 512)).toThrow(
    expect.objectContaining({ code: "ARTIFACT_EXPIRED" }),
  );
  expect(() => f.cache.remove(f.file.id)).not.toThrow();
  expect(() => f.delivery.read(lease.token, 0, 1)).toThrow(
    expect.objectContaining({ code: "ARTIFACT_EXPIRED" }),
  );
});

test("an empty derivative has a retryable empty EOF response", async () => {
  const f = await fixture(Buffer.alloc(0));
  const lease = f.delivery.open(() => f.cache.acquire(f.file.id));
  expect(f.delivery.read(lease.token, 0, 1)).toEqual({
    data: "",
    offset: 0,
    nextOffset: 0,
    eof: true,
  });
  expect(f.delivery.read(lease.token, 0, 1)).toEqual({
    data: "",
    offset: 0,
    nextOffset: 0,
    eof: true,
  });
});

test("open releases expired pins before attempting to acquire another artifact", async () => {
  const f = await fixture();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const lease = f.delivery.open(() => f.cache.acquire(f.file.id));
  vi.setSystemTime(lease.expiresAt);
  expect(() =>
    f.delivery.open(() => {
      f.cache.remove(f.file.id);
      return null;
    }),
  ).toThrow(expect.objectContaining({ code: "ARTIFACT_EXPIRED", retryable: true }));
  expect(f.cache.acquire(f.file.id)).toBeNull();
});

test("a caller-owned file outside the cache uses the same retryable chunk lease", async () => {
  const f = await fixture();
  const retained = join(f.home, "retained.png");
  const bytes = Buffer.from([12, 0, 250, 44, 255]);
  writeFileSync(retained, bytes);
  let descriptor = -1;
  const lease = f.delivery.open(() => {
    descriptor = openSync(retained, "r");
    return {
      bytes: fstatSync(descriptor).size,
      read: (buffer, position) =>
        readSync(descriptor, buffer, 0, Math.min(buffer.length, 2), position),
      release: () => closeSync(descriptor),
    };
  });
  const chunk = f.delivery.read(lease.token, 0, bytes.length);
  expect(Buffer.from(chunk.data, "base64")).toEqual(bytes);
  expect(chunk).toMatchObject({ offset: 0, nextOffset: bytes.length, eof: true });
  expect(f.delivery.read(lease.token, 0, bytes.length)).toEqual(chunk);
  f.delivery.close(lease.token);
  expect(() => fstatSync(descriptor)).toThrow(expect.objectContaining({ code: "EBADF" }));
});

test("a read exception closes its lease and releases the real backing pin", async () => {
  const f = await fixture();
  const failure = new Error("file read failed");
  const lease = f.delivery.open(() => {
    const handle = f.cache.acquire(f.file.id)!;
    return {
      ...handle,
      read: () => {
        throw failure;
      },
    };
  });
  expect(() => f.delivery.read(lease.token, 0, 1)).toThrow(failure);
  f.cache.remove(f.file.id);
  expect(f.cache.acquire(f.file.id)).toBeNull();
  expect(() => f.delivery.read(lease.token, 0, 1)).toThrow(
    expect.objectContaining({ code: "ARTIFACT_EXPIRED", retryable: true }),
  );
});
