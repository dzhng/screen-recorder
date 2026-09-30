# 24 — Verify bounded work and long projects

Status: in progress; compiled-plan delivery, active audio scheduling, independent
edit batching and compact public delivery pass their prerequisites. The
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
pass. Other query families and final post-cutover budgets stay open. The retained300-second audio streaming gate now passes unchanged in
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
