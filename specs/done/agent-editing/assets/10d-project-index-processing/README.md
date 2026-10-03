# Project index production and job input lifetime

The existing index coordinator now prepares selected video scene dependencies and
materializes project candidates through the shared frame lane. The retained store
owns the resulting independent PNG copies. Empty projects complete with zero
entries; audio-only projects retain background pictures. Exactly one complete
compiler visibility interval belongs to each delivered picture. Gaps between those
intervals remain unproven, even when source scenes stayed unchanged.

`ProjectIndexReference` pins project, revision, generation, normalized tap and
image size. Continuation, coverage, frame and leased-image reads use the retained
metadata's renderer and scene identities, not whatever is current later. A new
explicit selector must agree with the cursor; omitted optional selectors inherit
its pins. Project deletion fences new reads while already-open readers retain
their lease until release.

Preparation-only resource references use the existing normalized reference owner
and queue lifetime. Source and project indexes pin exact source-owner/generation
keys while queued, active or explicitly retryable. Success and permanent failure
release those inputs, except while an older canceled executor still uses them.
Ordinary job-owned assets and acquisitions remain retained until job retirement.
Owner retirement walks bounded reference pages under the existing deletion fence.
Catalog format 12 refuses old development catalogs whose source-index jobs lack
these semantic references; no migration or parallel dependency table was added.

Identity and candidate records use the retained store's existing byte preflight
before scheduling frame work. Candidate selection retains its independent work,
reason and candidate ceilings. During materialization, the execution plan and the
domain's single immutable validation context can both be resident, along with the
bounded candidate array. There is no project/history cache. Slice 24 still owns
release-scale memory and latency measurements.

## Verification boundary

The real catalogs, queues, frame owner, caches, scene stores, retained stores and
files are exercised by `project-index-processing.test.ts`, the shared source
fixture, and the existing queue tests. Synthetic native receipts and frozen PNGs
prove owner behavior; they do not prove native pixel output or public delivery.
No desktop capture, app launch, playback or user's library was used.

The producer cases cover two selected scene generations, pending analysis,
background output despite unavailable source pictures, cancellation after a
retained image, failed-frame explicit retry, coordinator restart, old-generation
reads after scene/cache reclamation and renderer/revision changes, tap/size/deletion
fences, and ready-empty admission. The overloaded-frame case uses 200 overlapping
retimed occurrences of changing scenes to exceed the record byte budget before
any frame job. It does not weaken the selector's separate reason/work ceilings.

The shared job tests cover canceled executors overlapping a successful retry,
retryable versus permanent failure, interrupted-job reconciliation, ready replay,
single-job retirement and paged owner retirement. Source-index behavior remains
covered by its existing producer suite after moving to normalized scene refs.

Public protocol/service/deletion integration and actual CLI/MCP/native index
journeys are the immediate next gate. The service should drain project jobs and
revoke delivery leases, reclaim the project's retained store with `keep=false`,
then forget job references and delete revision metadata through existing owners.
