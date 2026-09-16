# Durable shared scene evidence

Status: storage and scan integration verified with real bundled sparse video and
core thirty-minute paging. This closes the persistence seam left by 10b;
screenshot selection remains slice 11. No new visual detector or renderer.

## One evidence owner

SceneEvidenceStore owns durable canonical analysis chunks in the existing catalog.
VisualObservationCache owns disposable native observation reuse through the same
VisualSampler seam; neither owns a second comparison policy. Raw observation batches
are disposable files in DerivedCache. Their catalog lookup references the cache row
with deletion cascading, so eviction cannot accumulate dead lookup metadata.
Each requested-time lookup includes immutable source identity, exact retained
interval and observation policy. Identical timestamps with different selection bounds
are different requests: a past-only reference and a cut can select a different PTS.
Lookup rows point into bounded batch files; native decodes only missing requested
times. Do not introduce one file for each tiny RGB image.

The existing VisualSampler seam consumes this owner for both local trail planning
and canonical source analysis. Native response validation precedes cache admission.
Failure remains explicit. Cancellation cannot publish a newly requested cache entry;
concurrent misses may decode independently within the existing worker lanes, but
one lookup owns the reusable result and losing files are reclaimed.

Durable scene chunks retain coverage and measured comparisons without raw RGB or
duplicated screenshots. They are keyed by recording, immutable source, scene policy
and attempt generation. The queue alone publishes a generation after all canonical
source intervals are present. Partial or canceled work is not a complete artifact.
Durable evidence is outside cache eviction and later package export can include it.

## Canonical analysis

A source-scene job uses the existing heavy lane and original source interval.
Process at most ten seconds per native observation request with the shared 5 Hz
grid and predecessor. Yield between chunks; never hold a whole recording's RGB or
comparisons in memory. The shared analyzer already supplies a predecessor, so do
not append the previous chunk's endpoint a second time.

Persist comparisons by their actual frame times. Local reports clip reset boundaries
to the requested trail window; global analysis must not concatenate that filtered
list. A changed frame at second 100 can first be selected near second 50 in sparse
video. Retain its actual-time comparison even though it lies outside that chunk's
requested window. Paged global reads deduplicate overlapping comparison pairs and
boundaries, preserving request-to-image coverage separately.

Source-scene readiness/retry uses the established queue contract. Local frames do
not wait for a global scan. Background admission remains bounded and foreground
inspection must not wait for an entire historical backlog. Failed work retries only
on explicit request; restart cannot publish incomplete evidence.

## Verification seam

Use the real catalog, cache and queue with a deterministic native sampler boundary:
restart reuse, exact kept-bound isolation, eviction regeneration, cancellation,
concurrent misses, source/policy separation and no stale lookup growth. A multi-chunk
scan must match shared pair measurements, including a sparse future transition and
chunk-edge duplicate coverage. Fail and retry midway without publishing partial
results; page a 30-minute source with bounded batch size and memory evidence.

Then wire the bundled service's existing frame sampler through this owner and
repeat actual public trail/clean/audio gates. No visual style change is intended;
if delivered pixels change, compare actual images and run fresh screenshot-critique
before acceptance. Expose global evidence through the upcoming index-processing
surface rather than inventing an unrelated analysis API.

Internal schema/method names and chunk transaction layout are delegated. Source
identity, selection bounds, publication atomicity, retained evidence versus cache,
and one comparator are fixed contracts. Keep the README pickup and choices ledger
current; parent real captured gesture and real UI threshold gates remain open.

[Observation reuse evidence](../assets/scene-analysis/observation-cache.md) records
restart, exact selection bounds, eviction and unchanged public delivery checks.

[Durable storage](../assets/scene-analysis/durable-store.md) and
[canonical scan evidence](../assets/scene-analysis/canonical-scan.md) document
publication, cleanup and native CLI/MCP checks. Real UI threshold acceptance and
useful screenshot selection remain their owning slices.

[Requested-time reuse](../assets/scene-analysis/requested-time-reuse.md) replaces
whole-batch matching after the long-index workload exposed repeated decoding.
