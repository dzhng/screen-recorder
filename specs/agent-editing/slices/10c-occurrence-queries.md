# 10c — Bounded occurrence evidence and phrase search

Status: not started. Dependencies: [10a](./10a-source-range-projection.md), [10b](./10b-source-acquisition.md).

## Contract

Project transcript, event and cursor reads return every retained occurrence in
project order, including repeats, reorders and rational retimes. Search follows
actual edited speech on each audio track and never constructs a phrase by mixing
simultaneous speakers.

## Seam and ownership

Core owns one revision/query execution context over immutable source readers.
Composition owns exact mapping, availability, track ranks and clip selection.
Use named 10a projection and indexed relevant clips; do not call all-occurrence
projection for each source word or materialize the clips-times-words product.

The continuation references a bounded pinned dependency manifest and last exact
merge/scan position, including the stable ordering in contracts.md. Reuse existing
job/cache/reference lifetime for manifest preparation; no separate read-session
service. Source generation changes invalidate continuation explicitly. A changed
project head does not change an explicitly pinned historical revision.

## Work and review surface

Add the project branch `{projectId, revisionId?}` to the same inspection operations.
Source/project selectors are exclusive and flat. Query identity includes domain,
range, track filters and evidence generation/context/policy pins. Return occurrence
identity, original source row identity and exact retained fragments; query clipping
cannot change editorial whole/partial classification.

Merge seekable source iterators in exact project-start, track-rank, clip-ID and
source-ordinal order. Define equal-time event-kind tie ordering once in this owner.
Bound scans; empty pages may carry continuation. Pin readiness for the distinct
selected sources, distinguishing unavailable evidence from ready zero-word output.

Phrase matching maintains a bounded token suffix separately for each selected
speech-bearing track. Cross contiguous clips in playback order; project gaps,
acquisition gaps and partial words interrupt matching. Source search retains source
adjacency. Keep every contributing clip and generation in the match result.

```sh
node packages/test-harness/editing/evidence.mjs --fixture repeated-speech
```

## Acceptance

Actual CLI/MCP pages/search cover repeated/reordered/retimed takes, tied starts,
multiple speech tracks, whole cross-clip phrases, explicit and acquired gaps,
partial-word interruption, limits 1/2/larger, empty continuation pages, changed
query/generation and historical revisions. Frozen source rows provide exact oracles;
real source acquisition from 10b remains a separate required path.

Measure bounded late-window source reads and prove unrelated transcripts are not
expanded. Keep raw source hashes and existing recording/package reader semantics.
Project events/cursor carry context and occurrence identity; unavailable capture
metadata refuses or reports unavailable instead of returning invented empty evidence.

## Failure boundary and discretion

If resuming needs a full-project word expansion, correct the query/index seam before
adding more endpoints. Do not weaken generation consistency to fit a small cursor.

Delegated: iterator/index representation, bounded scan budgets and manifest storage
within existing owners. Exact ordering, identities, partiality and phrase rules are
fixed. Record any budget limits for 24 and update the slice/handoff after each pass.
