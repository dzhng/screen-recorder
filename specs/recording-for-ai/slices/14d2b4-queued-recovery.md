# 14d2b4 — Queue-admitted publication recovery and byte budgets

Status: internal recovery/deadline owner verified. Public service composition and
package writing are delivered by [14d](14d-export-publication.md) and
[14d3b](14d3b-package-assembly.md); native menu composition remains.

## Recovery is work in the existing queue

[RecordingExports](../../../apps/service/src/exports.ts) admits recovery-only jobs
through the same heavy lane as rendering, video export and transient package work.
Startup and status do not open or hash publication files. The service calls the
metadata-only admission pass after binding all owners and again on existing queue
capacity events, reporting its per-row errors. Each pass has a finite candidate
limit and absorbs reentrant calls; queue saturation waits for a capacity event.
There is no recurring timer, automatic failed-job retry or second pending-work table.

A recovery identity contains the validated export UUID and publication attempt UUID.
Each actual publication attempt gets its own deduplicated observation job. Recovery
can reconcile existing evidence, record a discovered commit, and clear private bytes;
it cannot prepare a new payload or publish a destination. Missing, replaced and
modified observations describe that moment, not whether an external commit happened
in the past. Failed dependencies do not prevent observation of an existing publication.

Automatic admission leaves failed, canceled and completed observations alone. An
explicit recovery request retries failure or refreshes a completed observation if
truth is still unresolved. For example, moving a crash-committed file away produces
missing; restoring that same inode permits a fresh explicit observation to recognize
its commit. A known committed/cleared receipt is historical truth and needs no refresh.

## Cancellation, retirement and shutdown

Explicit cancel includes this intent's active recovery jobs. The queue keeps each
lane occupied until its native child and publication descriptors close. If a canceled
recovery actually observed a commit, its catalog receipt survives the discarded job
result. Unfinished private cleanup remains eligible for explicit recovery.

Abandonment and recording deletion fence all recovery identities before draining and
forgetting them. Their validated prefix range cannot include a neighboring export.
The metadata retirement cursor yields between entries; private retirement still has
one owner. Service shutdown stops/drains JobQueue before closing the export cleanup
owner and catalog. Admission is synchronous bounded metadata work and has no deferred
scan callback that can access a closed catalog.

## Historical completion versus private directory retirement

Once committed bytes have been acknowledged clear, status and retry do not require
the destination volume to be present. The retained staging identity still describes
an empty private directory, not a directory-removal receipt. Abandonment/deletion
continues to verify that identity before retiring it. A moved or unavailable parent
can therefore block private directory retirement while the historical export remains
successful; restoring access lets explicit cleanup finish. This pass does not silently
forget unverified directory ownership or invent a detached cleanup registry.

## One existing deadline mechanism

The publication owner receives its budget through the existing MediaWorker timeout.
Known receipt bytes, otherwise pinned preview bytes, determine the allowance: two
full byte passes at a conservative four MiB per second, plus startup overhead, capped
at the existing worker maximum. Preparation reads and writes bytes; commit may verify
both payload and destination. The allowance is per native call, not a throughput
promise or a total export-duration estimate. Unknown/unprepared empty staging retains
the short startup allowance. No additional deadline timer is introduced.

A timeout preserves uncertainty and private evidence for explicit recovery. Repeating
an unchanged request on an insufficiently responsive destination is not guaranteed to
make progress; there is no automatic timeout retry loop.

[Verification evidence](../assets/export-publication/queued-recovery.md) includes
actual killed-owner recovery behind shared capacity, bounded backlog admission,
failed dependencies, refreshed observations, cancellation, neighboring abandonment,
moved destinations and the actual native deadline override.
