# 24x — Bounded project evidence continuation work

Status: planned after measured public phrase-search budget failure. Dependencies: [24k](24k-routing-scale.md), [24m](24m-query-duration-memory.md).

## Contract and measured failure

A continuation visits the clips needed for its bounded page rather than rebuilding
all occurrences in the immutable query window. Fresh source-generation checks
remain mandatory before reading rows and after asynchronous checkpoint publication.
The current public250-match search over10,000 placements takes29 pages and fails
the existing250ms cached-query target. Measured profiling records300,000 full-window
projections and590,000 occurrence visits for dependency deduplication per query.
The [retained baseline](../assets/24x-evidence-continuations/README.md) separates
overlapping timings and brackets instrumentation with disabled controls.
The transcript duration-memory read checkpoint remains valid; it measured get, not
phrase search. No quality or recognition claim follows from frozen word rows.

## Seam and ownership

ProjectEvidenceInspection owns revision/query validation, immutable manifest
publication, live dependency pins and leased checkpoints. SourceRangeProjection
already owns exact named inverse projection. Separate canonical query validation
from initial full-window enumeration. Request/execution still enumerate and enforce
occurrence/source caps; page reads use the manifest's unique source selections for
fresh dependency status and existing inverse projection for named visited clips.
Transcript and event mergers share the named page lookup from the read owner,
including adjacent-clip inspection needed to clear phrase suffixes at gaps. Any
memoization is local to one page and bounded by visited clips; no new persistent
cache, schema, migration, endpoint or performance limit is authorized.

## Work and review surface

One coherent implementation pass changes the existing query owner and both merge
consumers. Keep query digests, generation/source/engine pins, acquisition identity,
exact fragments, tie ordering, checkpoint state and leased-file security unchanged.
Keep128 scan work,10,000 occurrences,1,024 sources and8MiB bounds unchanged.
The harness extends the existing matched duration runner with explicit phrase-search
measurement, preserving default timeline/transcript/waveform probes. Real public
MCP pages must return all250 independently authored matches and clocks; CLI agrees.
No models, inference, capture, playback or installed app replacement is needed.

## Acceptance

- Existing evidence tests preserve sparse support, repeated/reordered phrases,
  retiming, tie ordering, changed query/generation refusal, deletion, cache eviction
  and restart. Add focused race and work regression only where existing tests do
  not pin the contract. Invalidate a dependency during checkpoint publication and
  refuse the page; never shortcut live pins because the revision is immutable.
- Same10k retained-home query before/after: all values identical; unchanged250ms
  warm p95 target. New repeated two-/four-hour trials retain memory ratio below2x
  and complete pages. Cold costs remain separately reported.
- Instrument actual visited clip projections and source statuses; continuation work
  no longer scales with untouched occurrences. Retain original red/profile evidence
  and a wrong-clock control, without counting inclusive timers twice.
- Run focused tests, build, typecheck/lint, independent review and root public replay.
  Recheck affected transcript/event consumers; broader post-cutover24 remains open.

## Failure boundary and discretion

If the unchanged public budget stays red, profile the remaining cost before widening
scope. Do not inflate scan limits, introduce unbounded cache or reinterpret the
budget. Internal naming and page-local lookup shape are delegated. The exact named
projection, live pin checks and initial admission limits are fixed by this plan.
Numerical review is nonblocking; it cannot close separate audible or physical gates.
