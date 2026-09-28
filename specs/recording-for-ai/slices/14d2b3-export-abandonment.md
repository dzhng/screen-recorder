# 14d2b3 — Abandon one export without deleting its recording

Status: abandonment owner and public operations verified; native controls remain
in progress. [Queued startup recovery](14d2b4-queued-recovery.md) is implemented.

## Durable fence, shared retirement

[MediaExports](../../../apps/service/src/exports.ts) marks an intent as abandoning
before awaiting anything. If destination validation is still running before an
intent exists, the same retirement owner fences and drains those matching
admissions before reporting absence. See the [admission race proof](../assets/export-publication/admission-abandon.md).
Replayed creation, retry, execution, admission and recovery
cannot restart it. Status still exposes a historical committed receipt while also
reporting the abandonment marker. A failed cleanup keeps that marker and its original
staging identity for explicit retry; it does not become another export attempt.

The existing JobQueue cancels and drains every attempt of that one job, including
older canceled attempts still closing. Only then may the publication owner retire
its verified private staging. Neither an unrelated destination nor an exported file
is a cleanup target, and unreadable external files need not be classified first.
Unsafe or replaced private staging blocks retirement.

Recording deletion joins the same per-intent cleanup promise, even if abandonment
started before the recording deletion marker. There is one retirement sequence, not
two filesystem removers. Cleanup close fences new abandonment calls and awaits active
sequences; the service must drain recording deletion before closing this owner and
close it before the catalog. No autonomous recovery loop is introduced here.

## Forget only after confirmation

After private retirement, JobQueue forgets the export's artifact result and job
identity in one transaction. The fenced intent row is removed afterward. A crash in
that metadata gap is harmless: explicit abandonment finds the remaining marker,
confirms owned staging is absent, and removes the intent. A crash after filesystem
retirement but before its response likewise retries through the retained parent and
staging identities. The recording, source media, preview cache and shared dependency
jobs remain available.

Pending admission capacity includes abandoning intents until cleanup is confirmed,
even if a late worker result records a successful commit. Source evidence follows its
separate invariant: a durable committed receipt releases generation protection because
that intent cannot regenerate. Abandoning an already committed export does not restore
source pins that were previously released. Failed uncommitted cleanup retains its pins.

Completed abandonment removes status rather than retaining a permanent tombstone.
An absent intent is therefore idempotent success, and a later creation using that UUID
is a new request. Clients requiring historical status must retain their own completed
response; this owner does not keep abandoned recording context indefinitely.

## Proof and next gates

[Evidence](../assets/export-publication/export-abandonment.md) covers actual native
publication/retirement, commit-race draining, recording-deletion coalescing, process
kill after private retirement, substituted staging, explicit retry and capacity reuse.
The queue proof also includes a retried job whose older canceled attempt is still
running, and removal of a ready artifact together with its identity.

This closes the per-export abandonment prerequisite at the internal owner boundary.
Queued startup reconciliation, outside-home staging accounting, size-appropriate
Publication deadlines and public operations have scoped evidence in their owning
slices. Native menu integration remains required.
The two public export choices and processed-package/narrated prerequisites are unchanged.
