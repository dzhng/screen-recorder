# Public project transcript paging

This is the passing paging checkpoint of 10c, not acceptance of project phrase
search or capture event/cursor queries. The [live report](report.json) exercises
actual CLI children, MCP stdio, project authoring, preparation jobs, shared
transcript ingestion and retained checkpoints. The [harness](../../../../packages/test-harness/editing/evidence.mjs)
keeps the remaining query domains explicitly pending.

## Frozen source boundary

Only the native ASR response is frozen. The fixture imports actual media using the
native probe, checks the requested source bytes, stream, clock offset, physical
support and model pins, then writes archived raw engine output with a matching
receipt. The existing shared ingester validates and publishes every word. It does
not write catalog rows directly, fabricate a recording owner or bypass ingestion.
[Observed calls](frozen-calls.json) identify that boundary. Real native inference
remains independently verified by [10b](../10b-source-transcript-journey/README.md).

The complete expected occurrence sequence comes from frozen source words and
independently authored placement arithmetic, including exact rational times.
Comparing page sizes with one large page is only a secondary consistency check.
The fixture verifies repeats, reorders, simultaneous track ordering, a track filter,
query selection of whole words, editorial word trimming and a window wholly inside
an unavailable source interval. Explicit generation/identity fields must match the
corresponding public source transcript.

Head advances before restart. The continuation still returns the original revision,
its complete original document and remaining occurrence rows. A changed query
refuses the old continuation. Removing one checkpoint file while the service is
stopped tests actual startup reconciliation and continuation refusal; a fresh query
then succeeds. This is **checkpoint file loss**, not an LRU eviction test. Actual
cache-owner eviction and source-generation invalidation are separate
[core-owner gates](../10c-project-evidence/README.md). Public empty-continuation and
late-window source-read instrumentation remain additional coverage work.

## Review and sensitivity

[Independent review](review.txt) found missing complete-result and trim-fragment
oracles; both were strengthened before the final pass. Its proposed query-clipped
word fragments were rejected against the settled contract: a query selects word
rows while preserving full editorial fragments and original word boundaries.
Synthetic composition-unavailable gaps have no original word row and use window
fragments. Both distinctions are asserted explicitly.

Removing only the isolated service's project transcript dispatch makes the
[actual journey fail](failures/project-dispatch-removed.json); restoring it passes.
The initial [export-map failure](failures/stale-runtime-export-map.json) was fixture
setup: copying built modules without their package export map could not start the
service. No product behavior or acceptance threshold changed to resolve it.

The original [runtime comparison](runtime-verification.json) records the separate
source-audio integration advancing while this harness was being reviewed. The
[final integrated run](integrated/report.json) repeats the complete paging journey
with those final service/protocol modules and package exports. Its
[verification](integrated/runtime-verification.json) matches every recorded runtime
file to the main worktree, including the harness itself. Original evidence remains
available above. Models are copied and hash-verified locally; no downloads,
capture, app installation or audio playback occur. No new native build is required.
