# Presentation point inspection

The [reader](../../../../packages/core/src/presentation-evidence.ts) proves that a
requested source moment belongs to the native presentation interval, using exact
integer arithmetic for fractional clocks. A selected picture stamped before a cut
can therefore support retained time. Public still inspection continues enforcing
its own sample-timestamp membership rule.

The [point adapter](../../../../packages/core/src/presentation-pointer.ts) feeds the
same [cursor policy](../../../../packages/core/src/trails.ts) used by still frames.
Geometry compatibility, pause/cut resets, outside/unknown observations and stale
pointer scene comparison retain one owner. Empty presentation is an explicit
no-picture/no-pointer state; it does not substitute black pixels for scene analysis
or conceal a geometry error.

## Evidence

- The focused reader tests cover the cut starting at 0.75 seconds with held PTS
  zero, exact half-open/fractional boundaries, large clock numerators, coverage
  gaps/overlaps, malformed rasters, truncated and oversized records, mutation,
  independent forward cursors, cancellation and close.
- Pointer tests use the real source evidence store for cut, scene, pause,
  geometry and cursor eligibility. When presentation and nearest still selection
  choose the same picture, the complete serialized policy result is identical.
- Core type checking, all 274 core tests and focused lint pass. The initial full
  run lacked the locally compiled library module needed by a child-process test;
  rebuilding core locally resolved that verification prerequisite.
- An independent Codex review reported no actionable defects and independently
  passed type checking and all 274 tests.
- The locally built reader consumed the actual native streams from 13d1, including
  the 47.32 MB / 5,000-record stream. Admission plus independent first/last cursors
  retained about 1.1 MB extra heap after collection. This measurement includes
  the retained plan/reader metadata, and is not a universal memory ceiling.
  [Machine results](results.json) preserve the observed values.

## Next event-planning seam

Point inspection intentionally retains the existing endpoint scene comparison.
This is scoped shared-policy verification, not acceptance of final human-video
reset semantics. A concrete next regression is **A → B → A, with no new cursor
observation**: after the transition to B hides an old pointer, returning to A must
not revive it merely because the endpoint pictures match.

The sequential movie planner must visit intervening presentation/boundary events
and carry the latest reset floor, including its equality rule. Pass that floor
into the shared cursor policy; the existing eligibility decision applies it.
Do not add a movie-specific copy of cursor eligibility. Exact presentation clocks
must also retain the before/after ordering of a cursor at a fractional boundary.
Event scheduling, persistent reset memory, native pointer composition and public
preview/export remain parent 13 gates.

On the merged tree, [all 277 core tests](merged-core-tests.txt) and core types pass.
A rebuilt app also passes all [eight public CLI/MCP trail checks](merged-public-trails.txt),
including held gestures, cuts, geometry changes, duplicate observations and retry.
The native receipt/file is a caller-owned output from the pinned source attempt;
matching header dimensions and durations alone does not authenticate a source.
