# 09c — Disposable derivative ownership

Status: core owner implemented and tested; service/frame integration remains in 09.

The [cache owner](../../../packages/core/src/cache.ts) keeps disposable files in a
separate cache root and records their admission in the library catalog. Producers
reserve an absent output path for an explicit recording, finish writing, then publish; they must stop writing
before publication. Publication may evict older unheld derivatives to fit the
budget. Native output limits still bound pending files: a reservation is not a
promise that arbitrarily large work will be retained.

Consumers acquire a read handle and release it in `finally`. The open file
reference and eviction pin last together; a returned path alone has no such
protection. When readers hold the entire budget, publication reports retryable
pressure instead of growing the cache or breaking a read. This owner does not
change job state: an inspection owner must regenerate a published job whose cache
file was evicted.

Startup reconciliation is explicit, cancellable and yields between bounded
batches. Producers and consumers remain unavailable until it completes. It
preserves persisted access ordering, forgets missing/changed files, removes
interrupted reservations and discards untracked files only in its own filename
namespace. The service must await reconciliation and outstanding publishers before
closing the catalog. No source, retained evidence or model directory is scanned.

Every reservation stores its recording owner independently of source paths or
artifact JSON. Ordinary reservation, reading and publication honor catalog admission.
Recording cleanup uses the existing publication order and pin-aware file removal,
yielding between bounded batches. Its caller must first fence new work and stop
producers/readers. See [deletion prerequisites](../assets/storage/cache-ownership.md).

## Evidence

[Real-file/catalog tests](../../../packages/core/src/cache.test.ts) cover access
ordering, independent readers under pressure, publication races, persisted reopen,
missing files, interrupted startup, oversized output and source aliases. A
review found an eviction cursor reset that could repeatedly inspect the first
batch of held files. Traversal now preserves progress across yields and excludes
accesses newer than its initial cutoff; tests cover both exhaustion and a later
evictable entry beyond a full held batch.

This is a storage prerequisite, not proof of production frame delivery, installed
client behavior, global deletion or an editing UI.
