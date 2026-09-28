# Shared export intent ownership

[MediaExports](../../../../apps/service/src/exports.ts) owns recording/package and
project-video intents in one table. The neutral dependencies are the catalog,
queue, derived cache, external destination resolver and publication worker. Optional
recording/project bindings supply their own revision and rendering authority; a
service does not instantiate the other domain's stores merely to export its media.
Absent domains refuse requests explicitly.

Every intent stores its typed owner, selected revision, requested destination and
replay identity before entering the shared queue. Omitted revision means the first
admission's revision, including after edits or restart. A project intent pins the
preview's authored canvas/profile/range and executor implementation. Changing the
executor cannot silently change regenerated output. Previously selected ready bytes
remain publishable under a retained cache descriptor even when their renderer is
no longer deployed; missing bytes require the pinned implementation.

Implementation absence is recoverable both before preview admission and when an
already queued preview starts under a different renderer. Restoration alone never
retries failed work. Explicit export retry can repair this specific failed preview
through the existing preview/queue retry owner, but the current preview failure is
authoritative: an old export availability error cannot authorize retrying a newer
decode failure. Other dependency failures retain their existing refusal policy.

The existing publication mechanism still owns exclusive staging, atomic destination
commit, acknowledgement and reconciliation. The exporter binds dependencies and
passes an open cache descriptor; it never implements another copy/publication or
retry algorithm. Cache eviction returns the job to dependency admission. Per-export
abandonment retires only that intent, while owner deletion fences new work and drains
publication before revision references can be retired. Observed external commits
survive cancellation and project deletion; cleanup removes private state only.

The table's typed owner columns replace the recording-only foreign key. Catalog
format4 deliberately refuses earlier unshipped catalogs, following the existing
format policy; no migration or installed-library mutation is included. The neutral
cursor carries both nullable domain filters and rejects filter changes on continuation.

[Project tests](../../../../apps/service/tests/project-export.mjs) use actual Catalog,
ProjectStore, AssetStore, JobQueue, DerivedCache, ManagedFiles and native Publication
operations. The renderer emits a structured fixture payload, so assertions can inspect
which immutable plan was copied. Native worker wrappers control copy/commit response
gaps; no internal job/cache/publication owner is mocked. These checks establish
ownership and byte preservation, not decoded project media or public CLI/MCP behavior.
Those remain the public journey's acceptance seam in slice09.

[Verification and review](review.md) distinguish owner/publication evidence from the
separate native rendered-media journey.
