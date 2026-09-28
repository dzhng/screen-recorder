# 10c — Bounded occurrence evidence and phrase search

Status: accepted for bounded occurrence, phrase, capture and project-cut inspection. Actual CLI/MCP changed-generation gates pass across a simulated recipe release, using real native scenes and separately labeled frozen-ASR ingestion. Dependencies: [10a](./10a-source-range-projection.md), [10b](./10b-source-acquisition.md).

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
records the bounded-read and preservation gates; public occurrence queries are verified below.

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
The [public paging journey](../assets/10c-public-paging/README.md) and independent
full-result oracle are integrated, including exact runtime hash agreement.
Phrase acceptance is recorded below; event/cursor reads are verified below.
## Core phrase checkpoint

[Track-local phrase evidence](../assets/10c-project-phrases/README.md) extends the
same manifest/checkpoint owner with bounded per-track suffixes and exact first-word
match ordering. Clean cuts preserve adjacency; gaps and partial words interrupt it.
Raw search text pins continuation and optional retry text selects that manifest.
Public phrase acceptance is recorded below; project event/cursor inspection is verified below.


## Public phrase checkpoint

[Combined paging/search evidence](../assets/10c-public-phrases/README.md) verifies
actual public routing, independent phrase oracles and historical continuation.
The [fresh-agent skill check](../assets/10c-project-skill/README.md) validates use
without implementation instructions. Capture events/cursor domains are verified below;
[expanded live coverage](../assets/10c-public-bounds/README.md) now verifies acquired
gaps, empty continuation and bounded late reads. Event/cursor acceptance is
recorded in the checkpoints below.

## Core capture checkpoint

[Capture observation evidence](../assets/10c-capture-evidence/README.md) records
source/project clock separation, visual cursor/geometry applicability, pause
occurrences, explicit unavailable categories and acquired-window coverage. Capture
uses the shared query lifecycle and bounded heap with its own source traversal.
Public event/cursor routing, scene and interruption journeys are verified below;
project-cut events are verified in the checkpoint below.

## Public capture checkpoint

[The actual CLI/MCP journey](../assets/10c-public-capture/README.md) verifies
source and project clocks, repeats, rational retimes, coverage, complete rows,
historical restart, checkpoint loss and bounded late reads. The interruption and
scene checkpoints below extend this coverage; project-cut events are verified below.

## Acquisition lifecycle prerequisite

[Retained lifecycle provenance](../assets/10c-acquisition-lifecycle/README.md)
adds bounded optional lifecycle/completion facts without changing normalized
observations or recording/package readers. Only a valid finished payload supplies
the capture/video endpoint; missing or damaged tails do not prove interruption.
Source/project interruption rows and public delivery are verified below.

## Core interruption checkpoint

[Capture-end inspection](../assets/10c-capture-interruption/README.md) preserves
explicit completion authority, exact capture offsets, left-supported endpoints and
existing occurrence ordering through bounded adjacent-head merging. Unknown,
damaged or conflicting termination stays qualified as unavailable. The public
checkpoint below verifies delivery; ordinary frame/sample point semantics remain
half-open.

## Public interruption checkpoint

[Actual CLI/MCP interruption evidence](../assets/10c-public-interruption/README.md)
verifies retained journal qualifications, exact nonzero-origin capture endpoints,
short audio, adjacent occurrence ordering, page-one continuations and historical
restart. The public schema now accepts the reader's interruption continuation head.
Existing capture and frozen transcript journeys pass on matching shared runtime
hashes. Source scenes are verified below; project-cut semantics are verified below.

## Public scene event checkpoint

[Authored live scene evidence](../assets/10d-public-scenes/README.md) verifies
actual native preparation and CLI/MCP source/project scene events, exact physical
clocks, physical gaps, mixed capture ordering, explicit cancellation/retry,
repeated and retimed occurrences, pagination and historical restart. Existing
capture/interruption journeys pass without dropping scene rows. Screenshot-index
acceptance remains open; project-cut semantics are verified below.

## Project-native cut events: verified seam

The [inspection contract](../contracts.md#inspection-exports-and-supported-media)
now defines cuts as track-local editorial mapping transitions. Composition owns
a pure seekable boundary selector over all resolved clip kinds, including holds
and silence, using exact placement/source/rate arithmetic. Core adds a distinct
project-native event union arm and merges its bounded iterator with source events
through existing checkpoints. There is no cut store, job, source generation or
independent lifecycle. Source-event relative ordering remains unchanged.

Public authored gates cover fractional pure-split invariance; A–B–A with protected
audio; overlay entrance/exit and simultaneous audio rows; editorial versus physical
gaps; same-rate continuity versus rate change; hold/silence transitions; seam-start
and seam-end query ownership; tied scene/cut/interruption pages at several limits;
history/restart and independence from later source generations. Compare complete
expected rows, not counts. Raw still-image admission remains its separate gate.


[Project-cut evidence](../assets/10c-project-cuts/README.md) verifies the pure selector,
actual CLI/MCP authored cases, complete capture/scene preservation and historical
restart. The event policy invalidates older manifests; source cursor and transcript
policies retain their existing semantics. A cut uses its after clip for tie ordering,
or its before clip for an exit, with an internal ordinal before source observations
of that same clip. The existing source-event relative order is unchanged.

The [contract audit](../assets/10c-project-cuts/README.md#slice-10c-acceptance-audit)
links every named acceptance claim to its public or owner-level evidence. The
[public generation gate](../assets/10c-public-generations/README.md) verifies both
source-dependency branches: actual native scene publication and frozen-ASR
transcript ingestion, with CLI/MCP event, transcript and phrase consumers.
A recipe-identity change simulates a release; ready-job retry remains a no-op.
Old cursors refuse before and after replacement, fresh queries preserve the pinned
revision and complete results, and editorial cuts remain unchanged. This closes
10c, not umbrella 10, screenshot-index projection in 10d, ASR accuracy or listening
quality. Public checkpoint-file loss remains distinct from core cache-owner eviction.


[Fresh project-cut skill use](../assets/10c-cut-skill/README.md) verifies an agent
can identify complete editorial transitions, distinguish source scenes and
availability, and avoid inventing a cut at a pure split through public CLI reads.
The project remains unchanged; this does not establish rendered/listening acceptance.
