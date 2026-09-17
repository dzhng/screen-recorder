# External publication ownership

The internal [service lifetime](../../../../apps/service/src/publication.ts) and
[native commit owner](../../../../helpers/mac/Sources/ScreenRecorderWire/PublicationOperation.swift)
now establish process-crash reconciliation for one generated completed file. This
is a reusable filesystem boundary, not an export product, persistent catalog
intent, job integration, or a power-loss guarantee.

## Commit truth

The caller supplies an empty private staging directory on the destination's
filesystem and retains its location for recovery. Its exclusive inherited lock
prevents another owner from cleaning or reconciling while a surviving publisher
can still change the outcome. The selected output directory has a separate held
descriptor and may have ordinary user-directory permissions.

Preparation copies a pinned source descriptor with bounded reads, synchronizes
completed bytes, then synchronizes a small prepared receipt. The receipt binds
the staging directory, destination directory, completed file identity and content
digest. Only exclusive hard-link creation commits the destination. Existing files
and symlinks remain untouched. A prepared hard link remains until acknowledgement
so the file's identity cannot be reused during ambiguous recovery.

Recovery observes the destination through a matching retained parent. Different
identity, changed bytes and absence remain distinct outcomes. A late worker error
is not proof of absence: after actual child close the service independently
reconciles without propagating the canceled signal. Each hashing operation uses
the caller's selected per-call timeout budget; this is not a single absolute
deadline for the whole publication. A renamed/replaced output parent on reopen
is an explicit failure, never an automatic search or rebinding.

The caller must durably record an observed commit before acknowledgement removes
private evidence. Cleanup removes only the owner's known leaves, payload before
receipt; an interrupted acknowledgement can be repeated. Closing a service owner
only drains work and releases descriptors. It never guesses that evidence is safe
to remove. A destination inside disposable staging is rejected. Private staging
must remain exclusively controlled by its owner; this does not protect against
an uncooperative same-user process modifying that private directory mid-syscall.

## Verification

[Native tests](../../../../helpers/mac/Tests/publication.test.mjs) and
[service process tests](../../../../apps/service/tests/publication.mjs) exercise
actual worker execution, not a replacement publication implementation. Build the
native worker and service first, then run those two files with Node's test runner.
The committed test receipts accompany this document.

The owner process is held alive by its IPC channel, killed with SIGKILL, and its
actual terminal signal asserted. A SIGSTOPped native child retains the inherited
lock after parent death; recovery stays busy until the child dies and releases
it. The normal native parent-exit monitor remains the sole owner-death mechanism.
The cancellation boundary is deterministic: a pre-observed abort prevents entry,
and an injected lost/canceled response after a real successful native commit still
returns the externally observed commit. This is not a timing claim about one
particular cancellation winning an executing kernel syscall.

The write-failure case uses a kernel file-size limit: a real partial payload is
observed, the external destination remains absent, and explicit abandonment cleans
only private owned leaves. It is not a full-volume ENOSPC or power-loss simulation.
The library-deletion claim here is limited to deleting the generated source after
acknowledgement; actual JobQueue deletion integration remains in 14d2.

Removing the inode comparison made the identical-bytes/different-file regression
return `committed` instead of `replaced`. Restoring it returned green. Independent
Codex review found that a longer commit timeout did not extend its mandatory
reconciliation; the owner now applies the same per-call timeout budget to prepare, commit, recovery and
acknowledgement, with a real short-default-worker regression. Own review also
found concurrent close callers could return before draining; their shared close
promise now has a red-to-green lifetime regression. The reviewer independently
ran the publication suites; unrelated service socket tests were blocked by its
sandbox and are not evidence against these filesystem checks.

## Next integration

[The durable video-intent slice](../../slices/14d2a-video-intent.md) binds this owner
to pinned previews, catalog acknowledgement and actual queue/deletion lifetimes.
That slice distinguishes verified internal recovery from the remaining dependency,
startup, storage and public-export integration. The full-package consumer remains
separate; this filesystem owner makes no claim about package completeness.

The earlier filesystem-owner integration passed its 15-test scope; see [host receipt](merged-tests.txt).
