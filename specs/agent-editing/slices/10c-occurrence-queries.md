# 10c — Bounded occurrence evidence and phrase search

Status: in progress. Pure selection, core transcript paging and public routing are verified; live harness integration, phrase search and event/cursor evidence remain open. Dependencies: [10a](./10a-source-range-projection.md), [10b](./10b-source-acquisition.md).

## Contract

Project transcript, event and cursor reads return every retained occurrence in
project order, including repeats, reorders and rational retimes. Search follows
actual edited speech on each audio track and never constructs a phrase by mixing
simultaneous speakers.

## Seam and ownership

Core owns one revision/query execution context over immutable source readers.
Composition owns exact mapping, availability, track ranks and clip selection.
Project-window selection indexes editorial occurrence envelopes, including those
whose selected window has no acquired samples. It returns the clipped project
envelope separately from available inverse source fragments, so missing support
can interrupt phrases instead of erasing the gap. Named inverse windows and
forward source points share composition’s exact clock and availability owners.
Holds, stills and authored silence do not advance source evidence.

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

## Pure selection checkpoint

Exact window, inverse-range and forward-point selection is implemented and verified
in the composition owner. [Evidence](../assets/10c-occurrence-window/README.md)
records the bounded-read and preservation gates; public occurrence queries remain open.

## Core paging checkpoint

[Project evidence paging](../assets/10c-project-evidence/README.md) uses immutable
cached manifests/checkpoints and a bounded per-track heap. Source generations and
project lifetime are rechecked after checkpoint publication. Revision execution
contexts reuse exact indexes without repeated whole-project work on continuation.
The linked evidence records provisional slice-24 limits, empty-project semantics,
source-row scan bounds and the remaining checkpoint I/O cost. This is not public
CLI/MCP acceptance and does not close phrase/event work.


## Public routing checkpoint

[Routing evidence](../assets/10c-public-routing/README.md) records the shared
CLI/MCP schema, project job dispatch and service integration. Project retry
rebuilds only the query manifest; source preparation failures retain explicit
source retries. Retry accepts query selectors, not paging cursors or limits.
The isolated public paging journey has passed; its reviewed harness/evidence is
the next integration step. Phrase search and event/cursor reads remain open.
