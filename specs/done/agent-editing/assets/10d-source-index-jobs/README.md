# Retained source index jobs

Source index preparation now uses the existing IndexProcessing owner and queue.
It admits a heavy parent only after scene evidence is published; demanded pictures
run in existing frame slots. The [lane mutation](lane-mutation.txt) proves why:
two parents occupying frame slots cannot make progress on their own frame children.
There is no new scheduler, cache, reference table or synthetic recording.

Queued recipes retain their exact source-scene generation while another heavy job
blocks execution. Removing the scene publication and running cleanup does not
remove that pinned evidence. Different stream/context generations do not share
that retention. Completed retained PNGs and coverage stand alone, allowing obsolete
scene data to be reclaimed. Source/acquisition references are admitted atomically
with the parent job.

Frame leases are copied through the same bounded descriptor-copy primitive used
by portable recording indexes. Retained source reads use the canonical index page,
coverage and image reader. A second forward scene walk annotates sampled stillness;
it never scans from the beginning for each candidate. Support exclusion, sampled
similarity and unproven ranges without an image remain distinct.

Terminal children stop their parent. Ordinary reads do not retry failed or canceled
work. Explicit index retry recovers retryable scene prerequisites and frame children,
including the queue's `not_requested` canceled state. Failures include the precise
frame dependency. Cancellation stops index retention while a shared child keeps its
own worker lifetime.

Two partial catalog indexes bound lookup of published source indexes and queued
scene dependencies by owner/generation. The existing catalog format and recording
portable representation remain unchanged.

## Evidence boundary

Full core: 570 passed, one skipped. Ten source lifecycle tests cover queued retention,
restart-independent completed reads, short acquisition support, failure/retry,
parent and child cancellation, zero-image completion and concurrent parents.
Core typecheck/build and service build pass. The descriptor-copy/constructor changes
preserve three [actual native recording-package scenarios](recording-package.txt).
All TypeScript and JavaScript IndexProcessing callers use the current constructor.

[Actual native source jobs](native.json) prepare and retain two raw tracks, a narrow
valid selected interval missed by every scene grid point, and a narrow empty edit
also missed by the grid. Their candidate counts are 3, 3, 2 and 0. The last index
retains two demanded no-picture observations and remains readable after the child
jobs are forgotten. The probe support is deliberately coarse, and the narrower
acquisition bindings are controlled core fixtures, not public capture import claims.
Source bytes remain unchanged. No app was launched, capture made or audio played.

Public source index dispatch, protocol/help, delivery and an actual CLI/MCP journey
remain the service integration gate. Project index projection must separately follow
the compiler's frame phase. This checkpoint claims neither public index readiness
nor a new visual quality judgment.

Independent review found no actionable correctness issues and reran 52 focused
tests. The review covered queue contracts, cancellation/retry, exact scene
retention, uncertainty, canonical readers and recording compatibility. Shape
review keeps admission/publication in IndexProcessing and separates its bounded
materialization loop; shared file copying replaces the portable-only copy loop.
The parent-job reference lookup adds two indexes to existing tables, with no
new lifecycle table or public route in this checkpoint.
