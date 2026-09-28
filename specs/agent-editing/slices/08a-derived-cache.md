# 08a — Shared derived-file ownership

Status: planned after inspecting the recording-only cache boundary. Dependencies: [02a](./02a-preparation-jobs.md), [04](./04-projects.md). Independent of native execution.

## Contract

One derived-file cache serves recording, project and asset owners without changing
its publication, read-lease, eviction or restart guarantees. Original assets and
retained generated media never become evictable cache entries.

## Seam and ownership

Generalize the existing core DerivedCache around the shared Catalog and typed
job-owner identities. Inject domain availability validation; the cache does not
look up projects or infer editorial lifetime. Reservations retain owner kind/ID.
Owner-scoped usage and purge cannot touch another owner with the same ID string.
Refactor current consumers to the explicit owner API; do not add parallel caches,
legacy string overloads or renamed wrapper APIs. Keep the recording policy at its
existing integration boundary until cutover removes that consumer.

Changing this unshipped catalog format requires its explicit version rejection;
no migration or user-library reset. Tests use fresh scratch catalogs. The installed
application is not launched or replaced by this pass.

## Acceptance

Preserve the existing cache/derivative/delivery/storage/deletion tests. New tests
use real project/asset metadata owners and prove reservation/publication/read
fences, same-string cross-kind isolation, retained-reader purge refusal, bounded
purge and eviction/restart behavior through the same owner. Falsify cross-owner
purge once. Typecheck affected consumers and retain focused integration evidence.
The public preview route belongs to 09, not this prerequisite.

## Failure boundary

Do not duplicate secure file access, create another cache database or relax
publication/lease checks to accept a new owner. Project deletion must add cache
retirement when 09 starts publishing derivatives; it currently has no project
cache producer. Prepared model outputs needed for portability remain retained
assets under their existing planned lifecycle.
