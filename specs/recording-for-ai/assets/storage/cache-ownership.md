# Recording-owned disposable cache

Derivative ownership is explicit at reservation and follows visual observation
requests through shared frame/scene processing. The native decoder receives media
fields only; recording ownership is an internal catalog concern. Reads, admissions
and new reservations consult the catalog, so the deletion marker can fence them.

`purgeRecording` shares the existing serialized publication order, uses normal
pin-aware removal and yields between bounded row batches. A late publication cannot
recreate a reservation already removed. Other recordings remain readable; their new
publications wait behind the current purge. This is a prerequisite, not a public
delete operation: the coordinator must still stop producers and revoke leases.

## Verification

The integrated tree passes 218 core tests, ten delivery tests and workspace types.
Real-file regressions cover selective ownership, unfinished files, live reader pins,
restart, late publication and yielding. Mutations that delete another recording,
ignore pins or stop yielding each fail their corresponding test. Existing requested-
time cache reuse and scene/selection tests remain green.

Independent review found ownership leaking into the strict native request shape;
adapters now project only source, kept bounds and requested times. Native integration
will run after the catalog-open compatibility follow-up. That follow-up must reject
an old ownership-less cache before any sibling schema writer changes its catalog;
a cache-constructor-only check is insufficient.

Structural cost: one required ownership column, foreign key and lookup index on
the existing cache table; no new queue or table. Source and retained-image ownership
remain separate and are never purged through this disposable-cache method.

The merged catalog/cache regression marks a recording for deletion, then verifies
new reservations, reads and pending publication are refused. An existing reader
still protects its file until released; cleanup then removes only the target cache
files while retaining the deletion marker and a readable sibling. Disabling the
cache-read admission check makes this integration regression fail.
