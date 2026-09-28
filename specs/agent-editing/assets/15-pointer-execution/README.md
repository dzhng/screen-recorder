# Prepared pointer execution

Pointer pixels are prepared from immutable source history, independently of the
compiler graph. Source-owned history jobs use the existing exact presentation
writer and cache. Rendering holds cache descriptors while the shared event sampler
writes a bounded attempt-local JSONL stream. Each enabled operation has one ordered
row, including inactive, excluded and physical-empty outcomes. Native execution
checks the stream's digest, source identity, requested clock and actual selected
sample before drawing. It cannot rewrite the compiler graph or invent an overlay.

The existing glyph owner draws in source coordinates. Its pixels replay the
compiler's backward geometric prefix through the same primitive executor used by
video. Prior opacity is excluded from this new overlay; subsequent effects apply
to both. The [executable fixture](../../../../packages/test-harness/editing/pointer-native.mjs)
owns the cases and assertions, including a deliberate skipped-prefix defect that
fails the independent translation check. The source observations and movies are
authored fixtures, not a new capture or a claim about a human gesture inventory.

## Evidence boundary

[Results](./report.json) prove the scoped prepared-execution and sampled-geometry
checkpoint. Integer translation, crop/rotation ordering, opacity order, held-source
raster reuse and inactive clip taps pass. Full/range prepared rows match and their
unencoded PNGs are byte-identical. Independently decoded movie white-core bounds
match with centroids within the existing one-pixel geometry criterion. Stream
mismatch, missing/extra rows, resource limits and cancellation publish no partial
artifact. Cache regeneration restores transient input references transactionally;
ready replay does not unnecessarily retain inputs. Removing the cache after the
failure cases proves attempt leases were released.

Two stricter diagnostics remain **red**, without threshold changes. Matched legacy
PNG bytes differ by at most one code value, inside the established two-code-value
PNG gate; the strong overlay support mask is unchanged. Thin encoded magenta-trail
centroids differ by more than one pixel between full and short-range encoding,
despite exact pre-encode PNGs and prepared rows. These observations support sampled geometry checks but do not identify the cause
of lost colored-trail membership. Standalone PNGs do not exercise the sequential
movie path or prove that actual writer-input pixels match. Colored-trail
preservation remains part of the open [render reproduction contract](../../slices/06-render-reproduction.md).
No whole-movie or full slice15 visual acceptance follows from these measurements.

[Legacy native preservation](./native-preservation.txt),
[core/service regressions](./core-service-tests.txt),
[no-pointer layer preservation](./layers-preservation.txt), and the
[deliberate renderer failure](./prefix-mutant.txt) retain the test evidence.
The [frozen worker identity](./worker.sha256) does not contain the independently
landed anchor-unavailable picture fix; integration must rebuild both changes.
Public CLI/MCP adoption, deferred admission, missing-prerequisite readmission,
combined anchor-gap behavior and broader repeated/retimed/stacked/public taps remain
subsequent gates. Native execution is available only to the prepared internal
request; no service readiness binding is changed here.

## Reviewed choices and remaining capacity risk

The source-history cache recipe includes acquisition generation and support identity:
it avoids decoding again for clip transforms, while distinct capture authorities
can still duplicate equivalent underlying media. This is a deliberate safe identity
boundary, not a measured optimal cache strategy.

Preparation holds bounded source descriptors, shares an aggregate event/occurrence
budget across samplers, and yields between bounded work batches. The source reader
borrows a cache descriptor rather than reopening a path that eviction could remove.
The native retained JSONL reader is shared with legacy schedules, preserving their
format and defaults. Explicit stream rows trade file size for exact correspondence
and bounded memory; long high-frame-rate projects can hit byte/work admission before
media-duration limits. These provisional caps are refusal boundaries, not a claim
of measured release-scale capacity; slice24 still owns that acceptance.

History jobs must be admitted before a heavy render occupies its worker lane.
`PointerPreparation.request` uses the existing queued derivative owner; rendering
only consumes ready histories through `withHistory`. Public integration should use
existing deferred admission and dependency-loss retry rather than queueing heavy
children from inside a heavy render. Cache-ready render results remain readable
without reacquiring source history.

## Review disposition

The [fresh complete-set visual critique](./visual-review.md) corroborates placement
and explicitly retains encoded-trail quality as open. Independent code review
found repeated full-source pointer drawing before the held-frame output cache hit.
The executor now validates every prepared row and computes the complete raster key
before drawing. A native diagnostic counts actual pointer rasterizations; the held
fixture draws once, while a bad second row still fails without publishing a movie.
No pointer raster cache or second geometry owner was added. The no-pointer layer
matrix and all inspected PNG bytes remain unchanged after this correction.

The exact next slice06 experiment is scratch instrumentation of actual writer-input
active pixel rows, color attachments and mapped timestamps at the matched movie
frames. Unequal inputs point back to sequential rendering/cache; equal inputs
localize the difference downstream to writer/encoding/decoding. This is an open
diagnostic, not an assumed codec cause or a new production debug API. Threshold
sensitivity and best-fit translation cannot prove preservation of every trail pixel.
