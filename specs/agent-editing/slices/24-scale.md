# 24 — Verify bounded work and long projects

Status: in progress; compiled-plan delivery, active audio scheduling, independent
edit batching and compact public delivery pass their prerequisites. The
[current selected streaming bank](../assets/23-owner-fixture-ports/current-streaming-scale-verification.json)
also passes the original10/300s frame-count, sampled accuracy and memory gates.
The [current long-frame cache bank](../assets/23-owner-fixture-ports/current-long-frame-cache-verification.json)
passes the unchanged30-minute late-source seek, eviction and restart companion,
with exact historical input and PNG digests. The
[complete raw-source index bank](../assets/23-owner-fixture-ports/current-complete-source-index-verification.json)
passes publication/paging/storage and foreground demand on its frozen source
candidate; sampled RSS and one foreground timing are not general p95 or peak budgets.
The [current movie-scale bank](../assets/23-owner-fixture-ports/current-movie-scale-verification.json)
passes exact support and original short/long phase/frame/memory gates. Remaining
integrated dimensions and installed production acceptance stay separate. The
[current reorder query](../assets/23-owner-fixture-ports/current-reorder-query-verification.json)
combines a two-hour/deep/wide 10k project with independently authored placement
changes, pinned old queries and undo through default MCP. Its warm query budget
passes; this is metadata inspection, not integrated media, contention or installed proof.
The
[two-hour learned checkpoint](24f-successful-learned-scale.md) passes complete
PCM comparison; [complete prepared-package transfer](24j-prepared-package-scale.md)
passes full-file ownership and new receiver edit/undo without repeated DSP.
[routed500/10,000 occurrence reads](24k-routing-scale.md) now pass their scoped
placement, cached inspection and queue gates. [Warm1080p preview](24l-preview-budget.md) and [fixed-cardinality timeline query
memory](24m-query-duration-memory.md) also pass. [Actual decoder/read accounting](24n-decoder-work.md) and the
[metadata prefix correction](24o-descriptor-metadata.md) pass their scoped gates.
[Fixed-size managed-history pages](24r-history-query-scale.md) also pass cursor
pinning and cardinality gates. [Finite decoder demand](24q-finite-decoder-demand.md)
resolves the sparse read-ahead failure; [container identification](24p-audio-format-admission.md)
preserves descriptor-backed audio admission. [Combined document/history transfer](24u-package-history-scale.md)
and [short deep/wide learned routing](24v-learned-routing-scale.md) pass their scoped
gates. [Waveform duration memory](24w-waveform-duration-memory.md) now passes
after removing redundant ownership-only document reads. The matched
[spectrogram duration-memory check](../assets/24-spectrogram-duration/README.md)
also passes, retaining identical PCM/densities/plot pixels and the disclosed
edit-module runtime difference. Its setup exposed and fixed repeated whole-project
work in ordered clip moves; root composition checks and archived-output verification
pass. [Transcript duration memory](../assets/24-transcript-duration/README.md) and cached
250-word reads also pass. The retained phrase-search diagnostic failed the cached-query target;
[24x](24x-evidence-continuations.md) now passes unchanged latency/memory budgets
while preserving exact results and fresh generation checks. Populated event/cursor
queries pass their [24y matched duration checkpoint](24y-source-event-duration.md)
with an explicitly configured bounded SDK receiver. Its default-client limitation
is historical: [complete-result delivery](24z11-operation-result-delivery.md) and
[MCP media admission](24z12-mcp-media-admission.md) now pass their scoped default
consumer checks without increasing transport bounds. [24z](24z-source-cardinality.md) now passes its declared source-selection
cardinality query gate through the existing query/admission owners, with complete
results and default clients; [its retained measurement](../assets/24z-current-preparation/manifest-reference.json)
owns the exact scope and response-format difference. These isolated query-family checks do not establish
final post-cutover budgets, arbitrary source/routing/history cardinality or all
external client capacities. The retained300-second audio streaming gate now passes unchanged in
[24s](24s-audio-stream-budget.md), including its original debug deadline, sampled
accuracy and memory assertions. The earlier87.209s diagnostic remains retained;
no causal speedup or concurrent-load immunity is inferred. The inherited storage
inventory deadline also failed during concurrent build/native tests but passes
unchanged in isolation; retain this load-sensitive case in final scale verification.
The later [bounded storage diagnostic](../assets/24-storage-phases/README.md)
passes unchanged baseline/two-process tests, without reproducing or explaining
the earlier native-build contention. See [integration evidence](../assets/integration/README.md). The [cache-owner control](../assets/08a-derived-cache/README.md) also reproduces the large-history and storage setup deadlines before the cache change; processing checks pass in isolation. Revalidate these without relaxing their functional/bounded-work assertions. Dependencies: [23](./23-cutover.md).

The [deletion fixture audit](../assets/24-deletion-fixture/README.md) separates
1,500-edit setup cost from bounded retirement. Its corrected setup retains all
real edits, disk-backed deletion and restart assertions at the original deadline;
it does not establish broader scale acceptance.

[Compiled-plan transport](24a-compiled-plan-delivery.md) preserves control-frame limits
for large audio/movie requests. [Active scheduling](24b-active-audio-work.md)
passes five-minute complete-PCM comparison; [batching](24c-edit-batch-work.md) and
[compact receipts](24d-edit-receipts.md) establish public10k project setup. A fresh
two-hour run then exposed oversized public job status. [Digest delivery](24e-job-status.md)
repairs response delivery. [Bounded inspection](24h-job-inspection.md) now avoids
loading recipes, project documents and asset segments during public job polling.
Full execution/admission work, broader history growth and general inspection remain
part of the whole-scale gate.

[Retired source-job history](24t-job-reference-retirement.md) verifies explicit
internal retirement of513 real public jobs with surviving retry identities and
exact asset references across restart. This adds no public retirement API or
physical collection policy.

## Contract

Large projects retain bounded inspection, targeted preview cost, cancellation and storage behavior.

## Seam and ownership

Harness probes drive the actual public CLI/MCP/service paths. Instrument existing schedule/index/worker/job owners rather than introducing another performance abstraction.

## Work and review surface

Separate remaining diagnostic work from final installed acceptance. Do not repeat
passed child cohorts to create activity. Target missing dimensions: broader
source/routing/history cardinality, deep/wide long-project interactions, client
receive capacities and known contention-sensitive deadlines. Use their existing
query/index/decoder/job owners. Isolated diagnosis and fixes may proceed before 23;
one controlled final production measurement follows actual cutover. Preserve
unchanged budgets and report which dimension each result establishes.

Measure deep/wide groups, long stacks, reorder invalidation, retained prepared-output storage and late-window taps. Prove bounded traversal without recursion overflow, cancellation, queue saturation and no disguised full-prefix processing in an ordinary read.

Run the 5-minute and two-hour fixtures with 500/10,000 occurrences, repeated media, overlapping tracks and later-window requests. Measure cold/warm latency, queue wait, RSS, bytes read/decoded and artifact growth. Probe canceled work, missing/corrupt assets, full queues and restart with retained dependencies.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/scale.mjs --case long-project
```

## Acceptance

Meet or explicitly fail the proposed budgets in verification.md. Bounded query memory does not scale with total project duration. Later-window requests do not decode the entire prefix. Cancellation releases leases, failed items don't starve other jobs, no-progress loops terminate, and referenced assets survive cleanup.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

Exercise large histories of retired asset jobs against the
[job-reference lifetime contract in cutover](./23-cutover.md): forgetting drained
jobs must not accumulate stale references, while active/retryable retained work
continues to protect its immutable sources.

## Failure boundary and discretion

Profile a failed budget and reslice the owning index/decoder/job seam. Do not add unbounded caches, endless retries or a second render path. Report hardware-specific measurements rather than universal claims.

Delegated: Instrumentation/report format and optimization choices that preserve contracts. Acceptance budgets cannot be lowered silently.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.


## Selected-source codec context

Audio decoding currently requires a declared fixed packet size of 1–32768 native
frames, allowing at most two packets of lookbehind (65536 frames). Context is
discarded before selected PCM reaches conversion or mixing; actual decoded-frame
counts include it. Unknown/variable packet sizes refuse explicitly. Broader format
support and this provisional packet bound remain scale/format acceptance work.
See [source extraction evidence](../assets/11a-audio-extraction/README.md).
