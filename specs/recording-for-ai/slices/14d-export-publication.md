# 14d — Pinned export intent and atomic publication

Status: 14d1 internal native/service publication and process-crash recovery verified.
[Ownership evidence](../assets/export-publication/native-owner.md) defines the proven
receipt, limits and remaining integration. No public export writer is claimed. Parent [14](14-exports-and-package-reader.md)
retains the two-product scope and narrated-package prerequisites.

## Existing authorities

`RevisionStore.pinPackageSnapshot` pins source, revision and a history upper bound.
`planPackage` in the core package-manifest owner reports dependency readiness;
it does not admit workers or recognize speech. `JobQueue` owns execution, attempt
fencing, cancellation, retry and recording deletion drains. A canceled attempt's
late return cannot publish a job result. That last property alone cannot undo a
file already published outside the library.

The service render owner provides complete pinned MP4s inside a private lifetime.
The archive reader provides an independent way to validate an AI ZIP after writing.
Neither owner currently commits a durable external destination. CLI media delivery
uses exclusive hard-link publication for its completed download, but has no durable
export intent or crash reconciliation. Do not copy its client-local completion
semantics into a claimed recoverable export.

## 14d1 — Destination commit feasibility

One question: can a completed file become the requested destination without
replacing an existing file, while a restarted service can distinguish its own
committed output from somebody else's file?

Use a retained output-directory descriptor and private staging on that same
filesystem. A normal selected output directory need not be mode 0700; retain its
identity separately from the exclusively owned private staging-directory lock. The native publication boundary must act relative to the retained
descriptor; checking an ancestor and later writing by pathname is insufficient.
Probe the platform's exclusive publication primitive before selecting its durable
receipt. Establish exactly which file identity and completed-byte digest must be
recorded before publication, and when staging can safely be removed. Retain the
private staging hard link until acknowledgement or completed reconciliation so the
original inode cannot be reclaimed during the ambiguous interval. The guarantee
being established here is process-crash recovery, not power-loss durability. Order
completed-file synchronization, prepared-receipt persistence, external publication,
acknowledgement, and staging removal explicitly, with faults between each.

The atomic destination creation is the external commit point. A cancellation
observed by the commit owner before entering publication must prevent it. A service
abort racing an already executing publication syscall does not determine the
outcome; reconcile external commit truth after the worker actually exits. Once it succeeds, cleanup or
a late job cancellation must never delete the external export. The durable receipt
must be reconcilable after interruption, including the gap between external commit
and catalog acknowledgement. Do not report a missing or replaced destination as a
successful export merely because an intent row exists.

The next red test uses two real processes and a temporary output directory:
prepare known complete bytes, publish, kill before acknowledgement, reopen the
owner, and observe exactly that committed file without replacing it. Then substitute
a different destination and prove reconciliation refuses to claim or remove it.
Test both identical bytes in a different inode and changed bytes in the original
inode; identity and content are independent evidence. Also kill the service while
its native publisher remains alive. Restart must acquire the inherited private
staging lock before declaring the destination absent, cleaning or retrying; the
old worker may still commit until it actually exits. A renamed/replaced destination
parent after restart is unresolved/unavailable, never silently rebound to the new
object at that pathname. This is an internal publication test, not an export
product or public operation.

Required neighboring faults: destination already exists, source/output directory
replacement, symlink leaf, failure before commit, cancellation racing commit,
no-space/write failure, and successful publication followed by library deletion.
External sentinels and previously published exports remain unchanged. Same-device
atomicity is a precondition; do not add a cross-device copy-as-atomic fallback.

## 14d2 — Intent, readiness and snapshot retention

[14d2a](14d2a-video-intent.md) now materializes the first internal ready-preview
video consumer with a durable intent and actual queue/deletion/restart checks.
[14d2b1](14d2b1-deferred-admission.md) implements bounded waiting admission.
Pinned dependency consumers, queue-admitted uncertain recovery, service wiring
and truthful pending-staging storage accounting remain before public exports.
[Private staging measurement](../assets/export-publication/staging-usage.md) now has
native consumer evidence; intent enumeration and public totals remain integration work.

Only after the commit receipt is proven, add the minimum durable intent under the
existing catalog authority. It records the chosen export kind, revision/history
snapshot and destination identity. It is not another scheduler. Admission/retry
reuses the same intent; a changed destination or snapshot is a different request.

Dependency waiting occupies no worker lane. Resume from existing capacity/startup
hooks and explicit client requests, never an unbounded polling queue. Required
failed artifacts remain actionable failures. Known narration without an accepted
transcript remains blocked; missing model assets never mean no narration.

At execution, retain exact ready generations and source/media readers until copy,
hash and validation finish. Existing deletion drains the real export executor and
its readers. Keep external commit truth distinct from the queue's disposable
artifact result so a late canceled return cannot erase a committed export receipt.
Do not choose a table shape before the 14d1 recovery trace proves what must persist.

### Required before public exposure: abandon one unfinished export

Bounded durable intent admission must have an explicit release path. Failed or
canceled exports can retain their exact inputs for retry, but filling that allowance
must not force the user to delete a recording or an unrelated destination file.
Add per-export abandonment through the existing intent owner: fence new attempts,
cancel and drain the current worker, clean only its identity-validated private
staging, then release source pins and intent metadata. Already published files and
the recording remain untouched. Interrupted cleanup must retain ownership and be
retryable; capacity is returned only after that cleanup is confirmed. Prove a full
allowance of destination-collision failures can recover capacity by abandoning one
intent while every external sentinel and source remains unchanged. This capability
is a required integration pass, not part of the current pinned-consumer checkpoint.

## 14d3 — Shared publication consumers

First exercise the accepted native MP4 renderer through the publication owner,
without waiting for speech. Then write a complete no-narration AI ZIP from actual
source, history, source/scene/index evidence and retained images. Validate it through
the bounded archive reader and shared relocated inspection before exposing success.
This generated no-narration checkpoint does not close narrated export or audition.

Both consumers use one destination commit/recovery owner. CLI, MCP and native menu
adapters expose only human video and complete AI package; no directory export or
partial diagnostic package is an extra choice. Native actions follow real success,
waiting, failure and retry semantics after the machine operations are verified.

## Verification and handoff

Keep source hashes, pinned revisions/history and generation identities observable.
Exercise concurrent edit, explicit retry, service restart and recording deletion
around both preparation and external commit. Retain deterministic fault receipts;
real exported video and relocated images also receive their applicable visual
review. Update the parent handoff with the proven commit point and unresolved
faults before adding public routes. Implementation names and numeric budgets are
delegated; truthful completeness, immutable sources and no-clobber publication are
not discretionary.

## Initial filesystem evidence

A bounded Darwin local-filesystem probe confirms exclusive hard-link publication
preserves an existing destination and that retained inode identity plus a completed
byte digest distinguishes committed, replaced, modified and missing outputs after
a killed publisher. [Receipt](../assets/export-publication/filesystem-probe.json).
This uses Python POSIX calls and prepared JSON only; it does not prove the native
commit owner, catalog acknowledgement, surviving-child fence, full disk or power
loss. Independent review identified those boundaries and the separate private
staging/destination identities above. The [native owner evidence](../assets/export-publication/native-owner.md) now
records the scoped native/process gates and the deferred catalog/product gates.

The first waiting-admission checkpoint is [14d2b1](14d2b1-deferred-admission.md).
It establishes bounded deferred jobs inside JobQueue; wiring pinned export
prerequisites and restart recovery remains subsequent work.
