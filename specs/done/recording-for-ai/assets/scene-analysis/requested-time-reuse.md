# Requested-time observation reuse

## Finding and decision

P2: whole-request cache identities made neighboring trail requests decode already
observed source-grid points again. The production path is frame materialization →
trail planning → shared frame-scene analysis → VisualObservationCache. Root's
controlled-stop thirty-minute run recorded 18,777 requested RGB slots but only
9,751 distinct source/bounds/time keys, after 504,941 ms and 756 selected images.
That run was incomplete; it does not establish full-run throughput.

The existing owner now indexes each requested time into a bounded cached JSON batch.
Identity still includes immutable source path, scene policy and exact retained
bounds. Native selection continues to own actual PTS; two requested times choosing
the same frame are not interchangeable cache keys. Each lookup reads only the
requested keys, groups hits by file, and asks native for the missing ordered times.
No source-wide in-memory index, new cache budget or second decoder owner is added.

Canonicalizing whole requests was rejected: local endpoint and past-only requests
are legitimate subsets with different selection bounds, so normalization would
introduce extra requests or change evidence. Per-image JSON files were also rejected:
existing batch files provide bounded storage without multiplying file count per
canonical sample. Concurrent misses retain first publications for shared points;
a file is removed if it contributes no new lookup. Partially overlapping concurrent
batches can retain duplicate payload slots, bounded by the native batch limit.

The obsolete exact-batch lookup is dropped, with no compatibility read path. Its
raw files remain accounted by DerivedCache and leave through normal LRU eviction;
old batches incur cache misses. This replaces a disposable index, not source or
retained evidence. The replacement uses a compound requested-time primary key, a
cache-file lookup index, and cascading references to the same derived-cache rows.

## Bounded work and recovery

One call accepts at most 52 ordered requested times across 10.2 seconds, unchanged.
A lookup returns at most 52 rows and reads each referenced batch once per lookup;
each batch was admitted with at most 52 observations. Temporary maps are scoped to
that call. New misses are persisted as one batch, not one file per sample. Validation
checks the assembled source dimensions and temporal/pixel consistency before
publication. It also checks the result after resolving concurrent winners.

Releasing a hit's read lease does not discard its bounded in-memory samples, so a
small-budget eviction during publication cannot make the current result partial.
Eviction cascades lookup removal, and the next request decodes only what was lost.
Cancellation does not publish a missing suffix or destroy prior reusable samples.

## Verification

Run on 2026-09-16, macOS arm64, Node 24.14.0 / Vitest 5.0.0, based on `48977d5`.
`visual-cache.test.ts` is the reproducible core proof using real SQLite and cache
files, with native sampling as the external seam.

The first regression failed before the fix: canonical `[0,2,4,6,8]`, overlapping
`[2,4,5,6]`, then subset `[4,5]` decoded eleven slots across three calls. The new
owner decodes six slots across two calls and returns identical requested/actual
metadata and pixels. Fourteen focused cache tests now pass, including restart,
exact kept-bound/source isolation, partial eviction, concurrent overlap,
cancellation, malformed native data, changed dimensions, small-budget eviction
while filling a partial hit, and removal of the obsolete disposable lookup.

Core build/types/lint/format pass. The broader core run passed 205 tests across
17 files before the final two cache regressions were added; focused checks passed
afterward. Independent `codex review --uncommitted` found no actionable regression.
Its first broader run lacked built `dist/library.js`; building core resolved that
setup failure, with no change to the existing process-level test.

[Native results](requested-time-native.json) compare cached assembly against direct
calls to the existing bundled native worker on root's preserved thirty-minute
input. Exact JSON/RGB equality passed for overlapping requests, a past-only prefix,
and a cut-bounded interval, plus restart and partial eviction. In particular,
599,999 µs selected 600,000 µs with full bounds but 566,667 µs with the prefix ending
at 600,000 µs; the cache preserves both answers. The probe ran after the other native
fixture owner released the heavy-work window and did not rebuild or replace the
bundle. Its temporary command was `node /tmp/screenrec-visual-cache-native-proof.mjs`.

The full same-input thirty-minute rerun, delivered PNG comparison and foreground
latency gate remain with the integrating pass. Reduced native work is proven here;
full-run speed and visual selection acceptance are not claimed.
