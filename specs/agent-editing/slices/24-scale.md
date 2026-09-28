# 24 — Verify bounded work and long projects

Status: not started. Carry the unresolved inherited 300-second audio streaming
deadline from [baseline maintenance](../assets/00-baseline/audio-fix/review.md);
neither baseline nor changed diagnostic establishes a pass. The inherited storage
inventory deadline also failed during concurrent build/native tests but passes
unchanged in isolation; retain this load-sensitive case in final scale verification.
See [integration evidence](../assets/integration/README.md). The [cache-owner control](../assets/08a-derived-cache/README.md) also reproduces the large-history and storage setup deadlines before the cache change; processing checks pass in isolation. Revalidate these without relaxing their functional/bounded-work assertions. Dependencies: [23](./23-cutover.md).

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

## Failure boundary and discretion

Profile a failed budget and reslice the owning index/decoder/job seam. Do not add unbounded caches, endless retries or a second render path. Report hardware-specific measurements rather than universal claims.

Delegated: Instrumentation/report format and optimization choices that preserve contracts. Acceptance budgets cannot be lowered silently.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

