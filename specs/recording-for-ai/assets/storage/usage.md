# Live recording storage usage

`storage.usage` measures regular-file lengths through the shared service operation,
so CLI and MCP expose the same result. It is a live observation, not an atomic
filesystem snapshot or a promise about reclaimed physical blocks. `observedAt`
marks completion; files can grow, disappear or move while the scan runs. Requests
for the same scope join an existing in-flight observation, including retries after
a transport timeout. A completed or failed scan releases that scope, so a later
request starts a fresh observation. Different scopes remain independent. Concurrent
renames can omit directory entries; this observation does not promise snapshot
consistency.

[RecordingStorage](../../../../packages/core/src/storage.ts) owns classification
and bounded traversal. Per-record inspection first resolves the catalog's real
identity, including canceled, no-video and deletion-marked rows. A nonexistent ID
never becomes a path to inspect. Source and evidence include unfinished files;
other owned recording files remain visible as `otherBytes`. SQLite-resident evidence
is not guessed into per-record totals.

Aggregate `sharedBytes` includes SQLite, WAL/shared-memory files and managed files
without authoritative recording attribution. Unreserved cache staging files and
orphaned recording directories therefore remain in the total. DerivedCache alone
maps its reservation files to recording owners, including unpublished reservations.
All categories are disjoint and add to `totalBytes`; per-record `sharedBytes` is zero.

The scan skips symbolic links and the separate managed `models/` tree, and never
counts bytes outside the managed home in external exports. File lengths come from
opened descriptors using Darwin `O_NOFOLLOW_ANY`, which rejects symlinks in every
path component even during replacement races. Node does not expose a named constant
for this [Darwin flag](https://github.com/apple/darwin-xnu/blob/main/bsd/sys/fcntl.h);
unsupported platforms fail explicitly. Observed directory replacement also rejects
the scan. Directory reads and cache
ownership pages are bounded; traversal yields while other requests proceed. A
missing file during cleanup is ordinary. Other I/O failures are explicit errors,
not a successful zero-byte result. Excessive nesting produces an explicit limit
error rather than silently omitting bytes. No counter table, quota, vacuum or
background scanner was added. Service shutdown cancels and drains active scans
before closing the catalog, including closing every opened file and directory.

## Verification

The [generated public receipts](usage.json) come from `bun run lab:storage`, which
launches the actual Node service and invokes the real CLI and MCP transports.
The fixture independently inventories managed regular files, checks both adapter
results, includes a failed deletion's remaining source bytes and keeps an external
symlink target unchanged. The output records the measured scan duration and worst
concurrent health/sibling-read latency; these are observations on this host, not
throughput guarantees.

Core tests additionally cover changed unpublished reservation lengths, no-video
failures, canceled leftovers, unknown managed files, missing IDs, file disappearance,
permission errors and a large reservation/file inventory. Real filesystem replacement
fixtures verify static, persistent and transient symlink containment. Removing the
Darwin all-component flag reproduces external-byte leakage; removing shutdown drain
fails the held-file regression. The latter also verifies the real descriptor closes.
Native capture, public
recording deletion and its restart/lifetime gates remain separate. This checkpoint
creates no new UI and does not close those parent requirements.

The final held-scan regression invokes real LRU eviction by publishing a sibling
file through DerivedCache while inspection is between the target file's metadata
read and open. Inspection finishes with zero remaining target cache bytes, while
the sibling's new bytes remain readable and accounted for. Removing missing-file
handling makes the regression fail with `STORAGE_IO`; restoring it passes all
thirteen focused storage checks. This complements the existing active-capture,
completed-deletion and shutdown-drain cases.
