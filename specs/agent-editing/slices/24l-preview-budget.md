# 24l — Warm ten-second 1080p preview budget

Status: verified scoped optimized-build gate; independent review resolved. Dependency: [24k](24k-routing-scale.md).

## Contract and ownership

A distinct uncached ten-second preview at 1920×1080 must publish within the
existing fifteen-second warm budget and four-GiB non-model worker RSS budget.
Cache lookup and first movie rendering are reported separately. The native movie
owner reports the existing process high-water mark after video, audio, mux and
publication complete; an earlier audio report cannot measure the whole movie.

## Verification

The [scale journey](../../../packages/test-harness/editing/scale.mjs) retains all
24k gates, then adds twenty video occurrences near the end of its existing
two-hour, 10,000-audio-occurrence routed project. One ten-second window primes the
movie path; the next, distinct window must invoke native rendering and publication.
Repeating that second window proves the cache hit separately.

The [preview helper](../../../packages/test-harness/editing/preview-scale.mjs)
checks encoded dimensions, exact duration/sample count, presentation-frame timing
and counter-frame membership against independently decoded corpus frames. The
small corpus is scaled to 1080p output; this does not claim 1080p source decode or
visual-style acceptance. No full two-hour output is rendered.

[Evidence](../assets/24l-preview-budget/README.md) records the release configuration,
worker hash, unmodified budgets, timing and final native RSS. Hardware/load-specific
measurements do not close decoder-byte, duration-doubling memory, history/storage,
physical-capture or installed-app acceptance gates.
