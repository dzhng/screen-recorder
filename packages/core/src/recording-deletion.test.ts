import { test, expect } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "./library.js";
import { DerivedCache } from "./cache.js";

test("deletion intent fences derivative access before selective cleanup", async () => {
  const home = mkdtempSync(join(tmpdir(), "recording-deletion-"));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "",
    newId: randomUUID,
  });
  const cache = new DerivedCache(store, home);
  await cache.reconcile();
  const target = store.allocate().recording.recordingId;
  const sibling = store.allocate().recording.recordingId;
  const ready = cache.reserve(target);
  const pending = cache.reserve(target);
  const other = cache.reserve(sibling);
  writeFileSync(ready.path, "target");
  writeFileSync(pending.path, "unfinished");
  writeFileSync(other.path, "sibling");
  await cache.publish(ready.id);
  await cache.publish(other.id);
  const held = cache.acquire(ready.id)!;
  try {
    store.markDeleting(target);
    expect(() => cache.reserve(target)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(() => cache.acquire(ready.id)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    await expect(cache.publish(pending.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(existsSync(pending.path)).toBe(false);
    await expect(cache.purgeRecording(target)).rejects.toMatchObject({ code: "CACHE_BUSY" });
    expect(existsSync(ready.path)).toBe(true);
    held.release();
    await cache.purgeRecording(target);
    expect(existsSync(ready.path)).toBe(false);
    expect(store.deleting(target)?.recordingId).toBe(target);
    const read = cache.acquire(other.id)!;
    try {
      const bytes = Buffer.alloc(read.bytes);
      read.read(bytes, 0);
      expect(bytes.toString()).toBe("sibling");
    } finally {
      read.release();
    }
  } finally {
    held.release();
    store.close();
    rmSync(home, { recursive: true, force: true });
  }
});
