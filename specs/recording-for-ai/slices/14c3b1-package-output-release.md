# 14c3b1 — Reusable package outputs and delivery ownership

Status: implemented and reviewed. This pass supplies reusable output capacity and
isolated delivery leases before package registry/storage admission in 14c3b2.
No public package operations or independent inspection engine are introduced.

## Output ownership and continued progress

[RetainedPackage](../../../apps/service/src/package-archive.ts) remains the single
owner of derived output reservations, files and reads. `releaseOutput` stops new
reads, joins existing read leases and removes the exact admitted output through
its locked directory descriptor. Existing readers keep the original opened file.
Only successful removal returns capacity and forgets the local file identity.
Repeated release joins one per-output promise; automatic failed-output cleanup uses
that same promise rather than racing an explicit release.

The output-count and byte limits apply to live reservations and retained outputs,
not the number of requests ever made. Confirmed failed writes are disposed after
their native worker and write descriptor close. Unconfirmed creation or cleanup
keeps its charge and reports an explicit error; full context cleanup can recover it.
`outputUsage` reports last confirmed output sizes and the additional reserved bytes,
not a fresh filesystem scan or whole-package usage. ZIP snapshot and extraction
accounting belong to the registry pass.

Media creation, decoding and output cleanup share one serial native-call lifetime
inside this existing owner. At most the bounded output set plus one admitted media
request can wait there. Read leases do not occupy native workers. This is file-owner
serialization, not another job admission scheduler. Context close aborts/drains media,
revokes reads, drains started cleanup, then removes the workspace. Waiting release
callers join full close rather than forming a cleanup cycle.

Output names remain private immutable per-write identities. Removal verifies the
opened leaf against its admitted identity beneath the retained root FD. Replaced
symlinks/regular files fail before unlink. As with existing managed cleanup, the
exclusive private-tree ownership model does not claim an atomic stat-and-unlink
primitive against arbitrary same-user mutation between every syscall.

## Delivery isolation

[DerivativeDelivery](../../../apps/service/src/delivery.ts) identifies an owner by
`{ kind: "recording" | "package", id }`, snapshots it, and matches both fields when
revoking. A package's provenance recording UUID is never its delivery ownership.
Two package handles and a same-ID library recording therefore have independent
lifetimes. Existing token limits, renewal and expiry remain the same owner; no
second delivery table/cache is added.

[Verification evidence](../assets/portable-inspection/output-release.md) records the
actual retained ZIP, mutation and delivery integration checks.

## Verification and next owner

Extend the actual retained ZIP harness with over 32 successful requests and failed
decodes in one open context, held reads during release, concurrent releases/media,
close racing release, unconfirmed creation and a real replaced-output cleanup
failure. Preserve the archive/frame/audio/index/parent-death checks. The release
join, premature-credit and worker-serialization guards must fail when removed.
Delivery tests exercise same-ID namespace isolation, independent package revocation,
renewal and caller mutation using actual file leases.

The next registry must use the same inspection operations with an explicit package
handle, own storage reservations through full cleanup, and retain failed-cleanup
charges. This pass neither publishes handles nor adds startup recovery or exports.

**Concrete recovery seam for 14c3b2:** full extraction/context close currently
caches a rejected cleanup promise. A registry must preserve the locked descriptor
and storage reservation on that failure; it cannot promise that calling the same
close again retries cleanup. Add an explicit retryable cleanup phase through the
same owner, or retain the failed context for recovery, before exposing that promise
publicly. Per-output release retries do not solve full-context recovery.
