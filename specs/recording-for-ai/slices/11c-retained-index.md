# Retained revision index and public delivery

Status: retained storage, core orchestration and public CLI/MCP delivery verified
against generated data, including bundled restart and cache eviction. Contact sheets,
selection usefulness and scale acceptance remain open. See [retained storage](../assets/screenshot-index/retained-store.md),
[orchestration](../assets/screenshot-index/orchestration.md), and
[public delivery evidence](../assets/screenshot-index/public-delivery.md).

IndexProcessing pins revision, source/scene generations and selection/rendering
policies before admission. One producer streams selection into bounded catalog rows
and immutable selected PNGs under recording evidence, outside DerivedCache. Queue
publication occurs only after all rows, coverage and images are complete. Failure,
cancellation and startup cleanup cannot expose partial evidence or remove active/
published generations. Edits rebuild kept-span selection and pointing context.

Use one existing frame lane for serial index materialization, with at most one
active/queued index producer globally; leave the other frame lane for foreground
requests. Resolve dependencies before admission; never occupy a lane while polling
child jobs. Additional index demand reports explicit bounded-admission readiness or
limit failure, not an invented running job. Benchmark foreground latency in the
thirty-minute fixture before accepting this scheduling choice.

Public index pages default to 50/max200 metadata entries with an explicit continuation
bound to recording, revision, generation, filters and ordinal. They return reasons,
coverage, requested/actual times and stable retained-image references. A separate
selected-frame retrieval operation uses existing byte delivery, max-eight batches,
actual MCP image content and CLI files; it must not make listing embed 200 images.
Arbitrary timestamp inspection remains available. The [operation registry](../../../packages/protocol/src/operations.ts) owns the
implemented index operations and schemas. Index generation references resolve through
queue publication; completed but unpublished store rows are never public.

Selected images survive cache eviction and relocation/export planning. Shared frame
materialization supplies the same native receipt validation and trail policy.
Never reuse an r0 annotation across a cut without identical kept bounds and evidence.

Verify restart, cancel/late completion, explicit retry, historical paging during
edits, dependency changes, invalid continuation, retained-byte survival and CLI/MCP
parity. lab:index must produce contact sheets and a machine-readable reason/coverage
ledger for static pointing, long stillness, animation, navigation, rapid clicks and
edited joins. Include actual-time labels on sparse frames. Measure thirty-minute
work, RSS, selected-image count, retained/cache bytes and foreground latency.

Compare selection coverage/density against the independent fixture event ledger,
then run unprimed screenshot-critique last. Show shots with preview-shots for the
non-blocking review window; decide on evidence and keep original physical capture
and speech gates separate. Parent 11 is complete only after these public and visual
checks, not when the pure candidate ledger is green.
