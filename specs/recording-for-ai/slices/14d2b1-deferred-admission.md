# 14d2b1 — Deferred jobs without worker occupancy

Status: queue seam implemented and integrated with the rebuilt service. Export
consumers build on it in [14d2b2](14d2b2-pinned-waiting-video.md) and startup
recovery in [14d2b4](14d2b4-queued-recovery.md). This pass changes no public export
route or menu capability.

## One scheduler, two admission boundaries

[JobQueue](../../../packages/core/src/jobs.ts) owns dependency waiting as well as
execution. A waiting export cannot occupy the heavy worker or fill its runnable
backlog: the source analysis and preview it needs must still be able to enter.
Waiting rows have a separate bounded allowance inside the same jobs table. Promotion
must pass the existing shared library/package capacity check and takes a new runnable
sequence position, behind work already admitted. Capture still pauses heavy execution.
Public artifact readiness reports queued with the dependency reason; waiting is an
internal job state, not a new public readiness vocabulary.

The durable deferred marker survives cancellation, failure and publication so an
explicit retry or regeneration returns through prerequisite admission. The existing
development catalog policy rejects catalogs missing that marker before schema writes;
this pass does not introduce migration or legacy execution behavior.

## Initialization and forward progress

Dependency owners explicitly install the admission callback after construction.
Persisted waiting rows cannot invoke an uninitialized callback. Callback work is
synchronous catalog inspection and ordinary dependency-owner requests, never native
hashing, media work or awaited execution. An unrecognized deferred artifact should
fail explicitly in the consumer callback; there is no default successful admission.

A real submission, settlement, cancellation, retry, regeneration or explicit capture
transition can start one bounded admission scan. Reentrant dependency submissions
are absorbed by that scan; they cannot recursively rescan or claim workers midway
through evaluation. An unchanged wait schedules no continuation. Replaying existing
submissions, inspecting status, retrying already-pending work and stale regeneration
do not trigger another admission scan. There are no polling timers.

A callback failure settles only that job. Capacity exhaustion leaves it waiting for
a future capacity event. Other dependency failures remain visible until an explicit
retry; dependency inspection must not call retry. Recording deletion fences waiting
rows before invoking their callbacks and drains/forgets them through the existing
job owner. The callback may cancel a sibling; the scan rechecks current state before
using its captured row.

## Verification and next consumer

[Queue tests](../../../packages/core/src/jobs.test.ts) drive real catalog rows and
controlled executor completion, including full waiting admission, shared prerequisite
progress, restart, package FIFO/capacity, capture pause, deletion and regeneration.
[Evidence](../assets/export-publication/deferred-admission.md) records terminal checks
and the independent review correction. This is scheduler proof, not native export,
source-generation retention or public readiness acceptance.

The next owner pass must pin revision/history at request, select source evidence once
it first becomes ready, persist that selection before preview admission, and retain
it across cleanup/retry. Release its source-generation retention once a durably
committed export no longer needs regeneration. Prove actual source cleanup interleaved
with retry. Missing cached preview must return to dependency waiting without holding
a worker slot or selecting the latest evidence again. Public startup reconciliation
still requires recovery-only work admitted through this heavy queue; private staging
storage accounting and size-appropriate Publication deadlines remain integration gates.
