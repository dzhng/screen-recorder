# 14c3b2 — Admitted archive input and recoverable workspace primitives

Status: implemented and reviewed. This supplies the storage/lifetime
primitives for the package registry; it does not publish handles or public routes.

## Admit an object, then copy a snapshot

[Archive admission](../../../apps/service/src/archive-input.ts) opens a bounded
regular file without following links through its path. The caller owns this read
handle through extraction. Native copying borrows it as FD4 beside the retained
workspace FD3; the native worker never reopens the external pathname.

Admission pins device/inode, byte size and modification time. Renaming the path
still permits the held original object. Its metadata-change time is deliberately
not part of that admission check, because rename changes it. The native copy checks
a full before/after stamp, including metadata-change time, and exact copied bytes.
Positioned reads let independent opens borrow one admitted input concurrently
without sharing a read offset. Each open gets its own snapshot and lifetime.

The existing parser and manifest/history validators verify the copied snapshot.
`copiedBytes` reports its actual size separately from expanded inventory bytes;
it must equal admission. The retained context exposes the immutable copied/expanded
pair as `archiveUsage`. These are the future registry's storage charges, not
estimates from ZIP declarations. This does not claim to defeat an arbitrary
same-user process rewriting an external file in place while restoring its stamps.
Hostile ZIP contents, link/path replacement and ordinary in-copy changes are
covered; the service exclusively owns the resulting private tree.

## Directory ownership and cleanup

[Package workspace provisioning](../../../apps/service/src/package-workspace.ts)
borrows an admitted parent directory and returns an independently locked child.
Creation and removal resolve names relative to that descriptor. A pathname is
only a locator used to open the returned child, which must match the native receipt.
Controlled ancestor replacement cannot redirect cleanup to an external tree.

Creation drains to a bounded native receipt before honoring cancellation so a
known child can be removed by exact identity. A lost creation reply keeps the
name and an explicit failure; it does not invent cleanup authority. A failed
cleanup after a known receipt preserves name/identity for recovery. The registry
must keep its reservation on either failure until confirmed removal.

Close the retained context before removing its workspace. Workspace removal
permanently closes the admission descriptor, then independently opens and locks
the same child beneath its retained parent. A surviving worker's inherited lock
keeps removal busy until that child terminates. Failed removal is explicitly
retryable through the same owner. An absent named directory is already removed
under the exclusively owned private parent; an existing different identity is
ownership loss. This makes a lost successful removal reply retryable. Arbitrary
external child renaming is outside that ownership model; replacing a parent
locator remains supported through the retained parent descriptor. The contract
does not claim an atomic stat-and-unlink primitive against arbitrary same-user syscall-by-syscall mutation.

[RetainedPackage](../../../apps/service/src/package-archive.ts) owns the shared
full-close attempt. First close permanently stops new work and reads, drains
native activity and leases, then cleans the workspace contents. Concurrent closes
join; an explicit close after failure retries cleanup through the same descriptor.
Output charge remains until successful cleanup. A retry cannot readmit the context.
The extraction helper has no second independently cached failed-close promise.

## Verification and next pass

Actual native tests cover admitted-path replacement, before/during-copy change,
independent same-input opens, exact copied bytes, cleanup failure and retry with
retained charge, ancestor/child replacement and inherited-worker lock ownership.
The existing hostile ZIP and relocated frame/audio/index matrix stays required.
[Evidence](../assets/portable-inspection/workspace-primitives.md) records results.

[14c3b3](14c3b3-package-registry.md) composes these primitives with the existing
transient JobQueue into internal admission, reservation and startup recovery.
Public package selectors remain a later adapter pass; independent opens are never
deduplicated by content.
