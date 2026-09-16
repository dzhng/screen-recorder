# Catalog intent and recording-owned job shutdown

This prerequisite for [storage/deletion](../../slices/15b-storage-and-deletion.md)
does not expose a public deletion operation or remove any media.

Deletion intent belongs to the existing catalog. Ordinary discovery, inspection,
edit replay, source publication and allocation replay cannot reopen a marked take.
Deletion retains its identity until its files are removed. A missing ID creates no
marker. Queue admission and publication honor intent independently of cancellation,
so a late executor cannot restore a recording while shutdown is still being requested.
The queue drains only that recording's executors, including already-canceled
executors still closing; other recordings remain usable.

Capture priority is a distinct fact from retained file ownership. After the capture
owner proves native closure, `settleDeletingCapture` records the existing canceled
terminal state while retaining the intent marker, source identity and revisions.
A subsequent file-removal failure therefore cannot keep unrelated heavy jobs paused.
Only the capture owner may call this after its native terminal barrier; merely
requesting cancellation is insufficient. See [capture shutdown evidence](deletion-intent.md) for that native barrier.

## Verification

Core tests: 216 passed before the final settlement assertion; focused catalog/job
coverage rerun afterward. Tests cover restart admission, late publication, an
already-canceled held executor, unrelated work and durable discovery exclusion.
Removing the startup fence makes the marked job run, confirming that regression
assertion fails for the intended reason. The catalog format test compares complete
database bytes after refusal of an older format lacking the new intent table; it
caught schema creation before validation. Format validation now precedes writes.
Core/service types and builds passed for these seams. No native-lifetime acceptance
claim follows from this catalog and scheduler proof.

Independent review found and verified the catalog-preservation correction. A later
review found no further concrete regressions in these seams. Integration must also
preflight unsupported cache formats before creating tables: the cache ownership
pass owns that additional opening-path check.

## Ownership decisions

The slice already chose one intent relation and existing-owner cleanup. No deletion
job, phase journal or migration framework was added. One implementation choice is
worth preserving: after actual capture closure, reuse the existing canceled capture
state rather than leave a marked take apparently recording until disk cleanup
succeeds. For example, if a file cannot yet be removed, other recordings' processing
still resumes while the deleted take remains hidden. The alternative would pause
all heavy processing indefinitely on an unrelated filesystem failure. This is sound
with high confidence; the closure barrier remains a mandatory precondition.
