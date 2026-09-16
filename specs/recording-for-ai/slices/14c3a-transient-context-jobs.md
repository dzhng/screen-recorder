# 14c3a — Transient contexts in the shared job queue

Status: implemented and reviewed. This is the scheduling prerequisite for public
package handles, not a public package reader or extraction registry.

## One execution owner

[JobQueue](../../../packages/core/src/jobs.ts) retains its durable library tables,
revision pinning, retries and restart behavior. Package work has no catalog recording
or revision row. A queue-issued `JobContext` is its lifetime authority; its opaque
identifier is diagnostic, never a token that can recreate ownership. Provenance
from a package manifest does not participate in cancellation or lookup.

Transient context jobs use the same lane limits, admission sequence, capture gate,
attempt map and terminal runner as library jobs. The oldest startable job wins
within a lane. A package context permits only one native operation at once, across
lanes; its blocked requests consume queued admission but no execution slot. A
canceled executor retains its slot until its actual work settles. Heavy extraction
therefore cannot bypass capture or compete with a library heavy job.

The queue capability API creates a context, submits/queries/retries/cancels jobs,
releases terminal job metadata, and closes the context. Context jobs expose an
attempt ID, generation, state and bounded result; they do not fabricate library
recording or revision fields. Public protocols and SQLite schemas do not change.

## Closure and bounded progress

Close synchronously fences admission, cancels queued/running work, joins active
attempts and releases job metadata and the executor closure. Repeated close joins
one promise. A WeakMap associates issued capability objects with their state:
closed callers cannot revive a context by reusing a string, while discarded
capabilities need no permanent tombstone collection. Another queue cannot accept
those objects. Service restart consequently invalidates all package capabilities.

Four open/closing contexts and 32 retained jobs per context bound metadata alongside
the existing global waiting limit. Inputs/results are bounded metadata, not media
payloads. The owner explicitly calls `forgetContextJob` after retaining the result
it needs; active or canceled-but-draining attempts cannot be forgotten. Forgotten
job IDs report `NOT_FOUND`, and the same immutable request can be admitted again.
Thus an open package can make arbitrarily many sequential requests without growing
metadata or requiring close/reopen. No timer or silent active-job eviction is added.

## Verification

The existing [queue tests](../../../packages/core/src/jobs.test.ts) remain the
shared execution proof. Additional cases interleave library work and two package
contexts with identical provenance inputs; assert FIFO, global heavy/frame limits,
capture gating, cancellation drain, deletion isolation and fresh retry identities.
They also cover context-capacity release only after terminal drain, forged/foreign/
closed capabilities, oversized metadata and more than 32 sequential requests with
explicit terminal release. Mutations removing capacity counting, serialization or
closed-capability admission failed these observable assertions, then passed after
restoration. The cancel → retry while draining → cancel retry → forget regression
also failed before tracking all active generations by job identity. Independent
review confirmed the fix and found no remaining actionable defects. All 305 core
tests (35 queue tests), 93 service tests and core/service type checks passed.

The next owner must reserve extraction storage before submitting work, bind its
actual retained context/read deliveries to this capability, and close them after
queue drain. Startup orphan cleanup still requires the inherited directory lock
proved by [14c2](14c2-retained-package-inspection.md). Registry, recovery, public
selectors/adapters and delivery revocation remain later work.


Merged-host verification: all 305 core tests passed. The first full service run
passed 92 of 93 tests; the remaining capture-recovery check timed out on its
existing one-second diagnostic-message assertion. All three focused recovery cases
then passed unchanged, and the full service suite passed 93 of 93 with four test
workers. No timeout or assertion was changed. This records a timing-sensitive
verification result, not a proven product defect or a change to the default gate.
