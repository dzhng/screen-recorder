# Durable library owners

Core owns persistent identity, revisions, source evidence, jobs and publication.
It shares one [catalog transaction boundary](src/catalog.ts). The
[package exports](package.json) identify the modules consumers can use; the
[service composition](../../apps/service/README.md) connects them to native work.
Core consumes [composition](../composition/README.md) for edit meaning instead of
maintaining another timeline interpreter.

## Assets, acquisitions and projects

An asset identifies immutable admitted bytes and their streams. An acquisition
binds those bytes to source provenance and available intervals. A project revision
places occurrences of selected streams; neither byte identity nor a recording
role selects an authored layout. The same asset can appear several times or in
several projects without merging their occurrence identities.

Source evidence retains its source clock. Project evidence projects it through
a revision's exact mapping without rewriting the source observation. Generation
and dependency identity bind pagination, prepared output and caches; freshness
must be rechecked when asynchronous work crosses a publication boundary.

## Transactions, replay and lifetime

Edits commit document changes, dependency references and replay receipts together.
An uncertain answer is recovered with the original request, not a newly inferred
edit. Retained revisions keep dependencies reachable through undo. Incompatible
catalogs are refused rather than silently reconstructing missing semantic inputs;
[persisted reference fixtures](fixtures/README.md) preserve that refusal contract.

Background jobs retain attempt ownership through cancellation and resource drain.
A stale result cannot publish into a replacement attempt. Readiness means admitted
and published output, not merely a completed native call. Models and generated
media share these owners rather than introducing separate queues or stores.

[Model preparation](src/models.ts) binds explicit model/runtime identities and
verified local readiness. Preparation can acquire pinned inputs; execution cannot
silently prepare another implementation. Profiles describe measured work bounds,
not universal quality or capacity claims.

## Publication and storage

Export intent pins revision and destination before execution. Acknowledgement
loss does not change that intent or repeat the content edit. Private staging
stays owned until retirement is confirmed; a committed external file remains
independent of project deletion. Portable adoption owns copied bytes and their
meaning rather than borrowing a donor path indefinitely.

Deletion fences new borrowers, drains existing work and retires durable references
before removing owned files. Cache eviction cannot destroy original or generated
sources. Aggregate [storage observations](src/storage.ts) measure managed files;
shared media does not have an invented per-project byte share. Models and external
donors have separate ownership, and shutdown joins observations before closing
the catalog.
