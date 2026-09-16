# 15b — Recording storage and manual deletion

Status: catalog/queue prerequisite verified; capture quiescence remains in
implementation, with native stop/discard/interruption races still open. See
[catalog/queue evidence](../assets/storage/catalog-queue.md). Public deletion and
storage usage remain unimplemented.
This sharpens the existing storage/delete requirements in [12](12-cli-mcp-operations.md),
[15](15-personal-release.md), and [contracts](../contracts.md); it does not close
those parent slices. Implement the passes below in order. Each has its own verdict.
The delivery ownership prerequisite of B is verified; public deletion remains unbuilt.
See [lease isolation evidence](../assets/storage/delivery-ownership.md).

## Contract

An explicit recording ID can be deleted while recording, processing, or being read.
Deletion hides it immediately, stops its producers, revokes its byte deliveries,
removes its owned files and metadata, and survives a service restart. Repeating a
completed delete succeeds. A missing ID never becomes a filesystem path to remove.
No implicit delete-latest operation exists. Other recordings remain usable.

Storage usage counts retained source/evidence and disposable derivatives, including
failed or incomplete work. Explicit exports outside the managed home and downloaded
speech models are not recording storage. No automatic source retention policy is
introduced. The existing derivative LRU remains the only cache-pressure mechanism.

## Existing owners and the next seam

- [RevisionStore](../../../packages/core/src/library.ts) owns recordings, revisions,
  edit replay and undo. `get`, `list`, `latest`, and `unsettled` have no deletion
  intent; discovery only excludes canceled takes. Keep deletion intent here.
- [JobQueue](../../../packages/core/src/jobs.ts) already fences late publication by
  attempt identity and retains canceled executors until they settle. `idle()` is
  global; the active attempt map lacks recording ownership. Extend this owner with
  per-record cancellation and drain, without another queue.
- [CaptureService](../../../apps/service/src/capture.ts) already serializes native
  controls, including pending starts and recovery. `discard()` currently combines
  native cancellation with recursive directory removal and rejects finished takes.
  Split quiescence from file removal here; do not call global `close()` for delete.
- [DerivedCache](../../../packages/core/src/cache.ts) owns reservations, files,
  readers, eviction and reconciliation. `reserve()` lacks recording ownership;
  add it at reservation, including [visual observations](../../../packages/core/src/visual-cache.ts).
  Frame and audio executors already know the recording ID. Carry ownership through
  the shared observation request context instead of parsing source paths or JSON.
- [DerivativeDelivery](../../../apps/service/src/delivery.ts) owns a bounded map of
  live read handles. Give each lease a recording ID and revoke that recording's
  leases through the existing release path. Unlink alone does not revoke open reads.
- Source, scene and screenshot-index stores already own bounded generation cleanup.
  Use their deletion seams for all generations, including unfinished ones; do not
  duplicate their SQL in the service coordinator.
- [Service main](../../../apps/service/src/main.ts) composes these owners. Queue
  construction can start queued work, while recovery and evidence cleanup run at
  startup. Deletion admission fences must therefore apply inside owners, before
  public routes exist, as well as during request dispatch.

**Next implementation seam:** establish one terminal operation per native take
across stop, discard and unsolicited interruption before enabling the pass B
cleanup coordinator. A native idle status alone does not prove that old async
finalization/reporting tasks have finished.
Do not begin with a route that calls `rm`: that cannot prove producer quiescence.

## A — Durable intent and per-record producer lifetime

**Question:** Once intent is committed, can any ordinary operation or late producer
make the recording usable again?

RevisionStore owns a small durable `recording_deletions(recordingId PRIMARY KEY)`
relation. Mark an existing recording synchronously before the first asynchronous
step; repeat marking is a no-op. Retain its source identity until cleanup succeeds.
This is one intent marker, not a second recording state machine or phase journal.
Public reads/edits, discovery, new capture mutations and artifact submission/retry
reject or omit marked recordings. Use `NOT_FOUND` for their ordinary public access.
Deletion alone can inspect the marked row through a narrowly named internal seam.
Late native reports cannot restore discoverability or finalize new usable evidence.

Extend JobQueue's existing active map with recording ID. A per-record drain cancels
queued/running attempts and waits for those executors' promises, including attempts
already canceled but still closing. Claim, admission and publication all honor
intent. Other recordings' jobs can continue; global `idle()` is insufficient.

Extract capture quiescence into the existing control order. It must wait behind an
unanswered start for the same take, end native writers, and settle any recovery
worker before permitting file removal. A transport timeout or `INVALID_STATE`
response alone is not proof that a writer stopped. If native lifetime cannot be
proved, retain intent/files and return an explicit retryable failure. Never invent
success from an observation timeout. Finished recordings need no native cancel.
Retain existing capture.cancel behavior through the shared quiescence seam; keep
file removal in its existing caller until pass B provides the library coordinator.

**Verification:** held start, delayed native report, held executor after abort,
late executor resolution, queued retry, edit/inspection racing intent, and a second
recording progressing normally. Reopen a catalog with intent plus queued work and
prove that queue construction cannot launch that work. Existing capture lifetime,
job cancellation, revision replay and index publication checks stay green.

## B — Owned cleanup and public delete

**Question:** Does success mean every owned byte producer, lease, file and catalog
row is gone, including after a crash halfway through cleanup?

Require `recordingId` on DerivedCache reservations and derivative leases. Add an
indexed recording ownership column to cache rows, and wire every reserving/acquiring
consumer in this pass. Purge only that recording's rows/files in bounded batches
through DerivedCache after writers and readers settle. Existing visual lookup rows
cascade when cache rows are removed. Preserve current cache pin/release semantics.
Schema changes follow the development hard-cutover policy; unsupported existing
homes fail explicitly and remain untouched. No compatibility migration or automatic
home reset is authorized by this slice.

Add one service-level recording deletion coordinator, composed from existing owners:

1. Commit intent and coalesce simultaneous deletes of the same ID in memory.
2. Revoke existing leases immediately and refuse new ones for that ID. Request job
   cancellation while capture quiescence runs; await both owners' completion.
3. Await any same-record evidence cleanup already holding file ownership. Reclaim
   cache files, all evidence generations and the allocated recording directory.
   Validate owned directory ancestry; never follow a symlink into another home.
4. Remove remaining job/artifact, undo/replay/revision, recording and intent rows in
   dependency order, with final catalog removal transactional. Do not remove the
   recording row before file cleanup succeeds.

A single marker is enough: repeat the same idempotent sequence after interruption.
Partial errors leave intent and remaining ownership records recoverable. Already
removed files/rows are success on retry. An absent recording returns success without
scanning or deleting a path derived from user input. No deletion job belongs in the
recording's artifact queue: that queue is being canceled and removed.

Startup attempts marked deletions before normal recovery/admission for those IDs.
Failure of one deletion leaves it fenced and reported; it must not prevent other
recordings from recovering. Coordinate with existing startup cleanup, not a polling
janitor or a second global startup/recovery framework.

Register `recording.delete({recordingId})` in the shared operation registry and
route CLI/MCP/native consumers to this coordinator. Success returns
`{recordingId, deleted: true}` only after cleanup. Failure is retryable with the same
explicit ID; no request ID is needed for this idempotent operation. A public call
may outlive a transport response; replay joins the live deletion or resumes intent.

**Verification:** delete with held frame/audio/index delivery leases and assert old
tokens cannot read, while other recording tokens still work. Exercise capture and
worker barriers from A through the public operation. Fault after intent, after file
removal, and before catalog commit; reopen and complete. Assert all generations,
unpublished reservations and replay/history rows disappear. Hash sibling recording
and external symlink-target sentinels before/after. Repeat missing/completed IDs.
A native fixture must prove owned worker processes terminate before directory removal;
fake abort signals alone do not satisfy the native lifetime gate.

## C — Storage usage and consumer checkpoint

**Question:** Can a caller see the bytes still owned, including partially failed
work and a failed deletion, without blocking recording or hiding shared overhead?

Expose `storage.usage({recordingId?})` through the same operation registry. With an
ID, return that recording's `sourceBytes`, `evidenceBytes`, `cacheBytes` and `totalBytes`.
Without one, return aggregate categories plus `sharedBytes` for managed SQLite/WAL
and unattributed managed files. SQLite-resident source/scene evidence belongs to
shared database bytes, not an invented per-record estimate. Totals are logical
regular-file byte lengths, not
physical allocated blocks or a promise of instantly reclaimed disk space. Include
marked deletions until their bytes are actually removed. An ID that never existed
returns `NOT_FOUND`; deleted completed IDs do too.

Read actual owned files, including partial reservations and unpublished evidence;
published artifact totals alone undercount. Stream directory traversal and catalog
ownership in bounded batches, yielding between batches. Never load a whole recording
library into memory, follow symlinks, count external exports/models, or force SQLite
vacuum/checkpoint just to make totals shrink. Classify each managed file once;
recording/source identity comes from owners, not heuristic filename parsing.

Return `observedAt` and state that usage is a live observation: files may change
during a scan. Disappearing files are ordinary during concurrent cleanup; unexpected
I/O errors must not silently become a complete zero-byte answer. No persistent byte
counter table, quota or new background scanner is needed for this operation.

**Verification:** known-size source/evidence/cache files, unfinished reservation,
no-video failure, canceled take with leftover files, marked failed delete, concurrent
capture/eviction/deletion and symlink sentinel. Compare managed aggregate categories
with the fixture's independent file inventory; classify database/WAL separately.
Use a large generated inventory to show bounded traversal and continued health/read
responses. Exercise usage and delete through CLI and MCP against one scratch service.
Add planned `bun run lab:storage` for this scratch-only checkpoint; the command does
not exist yet. Preserve machine-readable before/after totals and operation receipts.

## Scope, review and delegated choices

These passes unlock the recent-list delete/storage controls; adding those native
controls and their visual review remains [07](07-menu-bar-controls.md). No new UI,
retention policy, source rewrite, export deletion or model deletion belongs here.
No public throughput number is imposed without measurement; publish fixture size,
scan time and worst observed service response latency before acceptance.

Internal method names, batch sizes and fixture construction are delegated. Durable
ownership, explicit IDs, success semantics and ordering above are not. The exact
native quiescence proof must be confirmed against the existing native control
implementation in A; if it lacks a terminal receipt, sharpen that seam before B.

Refactor-clean review: lifecycle intent stays in the catalog; capture owns device
ordering; queue owns executors; cache/evidence stores own their files and rows;
delivery owns leases; the service coordinator owns only ordering. Do not duplicate
these owners with deletion-specific registries or parse artifact JSON for ownership.
Run repository review and independent code review on each substantive pass. Keep
existing frame, audio, trail, index, capture and operation tests green. This slice
produces receipts, not visual artifacts; any later UI screenshots inherit the
[visual gates](../verification.md#visual-gates). Human feedback on byte-category
wording is non-blocking and does not permit weakening deletion lifetime guarantees.
