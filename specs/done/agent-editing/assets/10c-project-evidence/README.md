# Project transcript paging

[The evidence owner](../../../../../packages/core/src/project-evidence.ts) binds an
immutable revision and normalized query to the distinct selected source generations.
Source preparation uses the existing transcript queue before manifest admission;
the manifest never occupies a worker while waiting for its own prerequisite.
A published source generation stays readable during regeneration until its evidence
actually changes. Missing models, failed preparation, no acquired audio and ready
zero-word output remain distinct.

Manifests and immutable merge checkpoints use the existing project cache. A cursor
names those disposable files; it carries no per-clip map. Borrowed file leases stay
held through checkpoint publication. Generations and project lifetime are validated
before synchronous traversal and after awaited publication. Eviction, changed query
or changed evidence explicitly invalidates continuation. No new table, read-session
service, renderer schedule or background cleanup owner is introduced.

Each selected audio track advances through nonoverlapping clips with one retained
head. An exact heap merges heads; later envelope lower bounds delay initialization
until needed. Initialization and source scans can stop with an empty continuation
page. Persisted heads and source cursors prevent repeated prefix reads. Original
word ranges determine whole/partial classification; query intersection only selects
rows, and returned fragments retain their full editorial extent.

Composition owns paired unavailable fragments. Raw native gap rows are projected
through available support, while composition complements cover excluded support;
these are disjoint without another gap-union algorithm. This also preserves native
segments that are narrower than requested support.

A bounded in-memory revision context reuses validation and exact indexes across
pages. Every hit checks live project ownership. A cold owner or evicted context
rebuilds once; this cache is not persistent read-session state.

## Provisional bounds and remaining scale work

Inspection permits 1024 distinct sources, 10000 selected occurrences and 8 MiB per
manifest/checkpoint; the revision-context LRU holds four entries. Each page permits
128 source scans/clip advances and at most 1000 emitted rows. These are explicit
first-pass limits for slice 24, not release scale acceptance. Source fetches scale
with the requested page size, preserving the shared recording/source traversal.
Checkpoint serialization and I/O are still proportional to retained track state
per page; near-linear source-row reads do not claim near-linear total I/O.

An omitted range on a zero-duration project returns ready empty evidence. An
explicit empty range remains invalid. Track filters are canonicalized; changing
page size does not change query identity. Manifest retry does not retry failed
source transcription or prepare models: the dependency's source operation owns it.

## Verification

- 55 focused core tests pass, including the existing 306-word native raw parity and
  source/recording/package readers. Thirteen project paging cases use real catalog,
  asset, project, transcript, queue and cache owners with a native transcription
  boundary fixture. They cover repeated/reordered/rationally retimed clips, tied
  tracks, limit-one parity, original partiality, acquired/native gaps, historical
  reads, query/generation invalidation, cache loss and deletion.
- A 140-track tie produces a bounded empty initialization page, then all 420 words
  at limit one with near-linear raw row reads. Future tracks remain unexpanded;
  late-window reads never prepare or expand an unrelated transcript.
- 300 limit-one words reuse the warmed revision without another revision load;
  a cold execution owner rebuilds once. The first measurement included the initial
  queue target pin; `initial-context-boundary-red.txt` preserves that test-boundary
  correction. Continuation measurement now begins after initial admission.
- All 119 composition tests pass. Three actual native package publication/reopen
  journeys preserve transcript behavior using the frozen native binary from the
  preceding ownership pass. Speech output in that package harness is a fixture;
  this does not claim fresh native ASR or a public project inspection journey.
- Falsifications independently catch a missing final generation fence, repeated
  revision rebuilding, dropped narrower-native gaps and 256-row source head reads.
- Composition/core/protocol/service builds, core type checks, formatting, lint and
  diff checks pass. The first independent review found repeated whole-revision
  work per page; the execution context fixes it. The second review found no
  actionable regressions.

Public CLI/MCP routing, track-local phrase search, project events/cursor evidence,
and full live journey acceptance remain in slice 10c.
