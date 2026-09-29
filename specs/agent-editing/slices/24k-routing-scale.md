# 24k — Routed placement and bounded queued reads

Status: verified scoped public checkpoint; independent review resolved. Dependencies: [24i](24i-processing-batches.md), [24h](24h-job-inspection.md).

## Contract and owner

Independent project placements retain the scalar editor's complete receipts,
identities and earliest error even when existing stateless processing is present.
Stateful membership changes remain with the scalar normalization owner. Processing
state owns the classification used by both edit batching and state derivation.

Known-unavailable source evidence cannot force a bounded editorial-cut read to
walk one empty occurrence per scan budget unit. The existing event merge skips
only sources with neither capture nor scene evidence. Coverage and dependency
pins remain authoritative, including when a source later acquires evidence.

## Verification

The planned [scale journey](../../../packages/test-harness/editing/scale.mjs)
uses five-minute/500-occurrence and two-hour/10,000-occurrence projects with deep
routing, wide overlapping tail inputs and a long stateless stack. It measures an
actual cached 250-row read across continuation pages at the unchanged 250 ms p95
budget. It compares complete bounded late PCM to an independent source oracle.

The existing native-response barrier holds one successful worker reply while
public requests fill the heavy queue. Overflow stays retryable, queued cancellation
frees a slot, and cancellation of the held job lets its successor finish. Restart
retains the result and original asset; render staging drains. This is cancellation
at the owner/publication boundary, not a native worker still decoding.

[Evidence](../assets/24k-routing-scale/README.md) retains both original performance
failures, exact timed-out request replay, the CPU profile and final measurements.
This checkpoint does not close the parent24 requirements for 1080p preview,
controlled duration-doubling memory, actual decoder bytes, stateful/wider domains,
large histories or installed-app cutover. No acceptance deadline is increased.
