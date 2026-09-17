# 14c3b3 — Internal package registry and resource lifetime

Status: implemented and reviewed. Internal admission/lifetime only; public selectors and adapters
remain a later pass. The existing inspection operations will receive package handles.

## Authority and accounting

A service-owned registry borrows one exclusively owned private package-cache root,
the existing JobQueue and typed DerivativeDelivery. `open(path)` admits the input FD,
reserves resources and returns an admission ID. Its queue-issued context owns heavy
workspace provisioning/extraction. Archive constraints, every inventory hash/size, manifest and history are verified
before minting a process-local package handle. Normalized evidence rows are checked
lazily by the existing shared readers; a correctly hashed malformed page fails on
read rather than being labeled semantically valid. Separate opens always have independent workspace/context/handle
lifetimes, even with identical content and embedded recording IDs.

The registry exposes status, handle lookup, context submit/forget, close, recovery
and bounded usage. Caller strings only look up issued authority; unknown/expired
IDs never create entries. At most four resource owners remain, including opening,
closing and cleanup_failed entries. Thirty-two terminal admission receipts may be
retained; eviction is explicit expiration, not resurrection. No package rows or
handles persist in the library catalog.

Before extraction reserve admitted ZIP bytes + configured expansion ceiling +
128 MiB derivative allowance. After validation replace peak reservation with actual
copied ZIP + expanded inventory + that same allowance. The default pool is 64 GiB.
Two maximum-size admissions exceed it; four owners do not promise four maximum
archives fit. The allowance matches the existing output owner, whose release/read
leases permit continued request progress. Budget ownership stays until confirmed
cleanup; confirmed byte reporting is distinct from pending worst-case reservations.

## Close and failure

Close fences handle lookup first, then closes/drains its queue context, revokes only
that package's delivery owner, closes retained reads/media, removes the workspace,
closes input admission and releases its reservation. Concurrent closes join; failed
cleanup remains a counted owner and explicit close retries it without readmission.
Canceled queued admission never creates a workspace. Failed/canceled extraction
uses the same cleanup path and preserves charge whenever cleanup is unconfirmed.

A lost creation reply has no admitted identity and cannot have a payload writer.
Its explicit recovery may remove only an empty private UUID directory beneath the
owned parent, or confirm absence. Nonempty substitutes remain untouched. Known
workspace identities always use exact-identity removal.

## Restart and recovery

New registries start unavailable for package admission until explicit startup
recovery succeeds. It pins at most four immediate UUID private directories and
fresh locks before mutation; an inherited native child keeps its tree busy. Retry
is explicit, with no poller. Library work can continue through the same queue.
Startup reclamation may remove nonempty orphan workspaces under established root
ownership; it does not restore old process handles or adopt package catalog rows.

## Verification

Use actual input sizes to check both numeric reservation boundaries and the four
owner limit. Exercise peak-to-steady charge, independent same-content opens, queue
capacity/capture admission, canceled queued/partial extraction, failed close retry,
terminal receipt eviction, stale handles and same-ID library deletion isolation.
Actual native recovery must preserve a killed parent's still-live worker tree,
then succeed only after the inherited child closes. Preserve the archive/retention
and reusable output checks; no fabricated narration readiness.


[Verification evidence](../assets/portable-inspection/package-registry.md) records
actual native cancellation/recovery/drain, budget boundaries and isolation.
Next: wire explicit package selectors through the existing shared public inspection
operations. Registry startup, public status/results and service shutdown still need
adapter integration; no public package-open/close route is claimed by this pass.
