# Incremental screenshot selection ledger

Status: next. One core selection policy, no storage, renderer or transport owner.
Feeds retained index production in 11c. Three independent drafts agreed on proving
selection before adding publication; this slice resolves their policy gaps.

## Stream and output

Consume ordered source events incrementally over one pinned revision's kept spans:
clean comparison/coverage, observed cursor, pause/geometry reset and span boundaries.
An adapter can merge bounded scene/cursor pages with one next event per stream.
Stored scene comparisons have a strictly increasing actual-time frontier, so no
second boundary index or whole-recording sort is necessary. Chunk positions are
not scene times. Use existing timeline mappings for source/edited coordinates.

Emit ordered candidates with requested source/playback time, retained span, reason
set, supporting source/scene identity and explicit source/playback coverage. Multiple
coverage windows can point at one candidate; never merge coverage across a cut.
Equal request times coalesce reasons. Event time stays distinct from image request
time when a boundary is at the end of a half-open interval.

## Selection rules

- Keep first/last valid instants of retained spans. At a pause, cut or detected
  scene transition, retain both valid sides: preceding boundary minus one microsecond
  and following boundary. Skip sides outside the kept span; never request duration.
- Five seconds is a coverage obligation, not necessarily another image. Ordinary
  coverage requests obey one-second spacing. Mandatory boundary and cursor-emphasis
  endpoints bypass spacing so short actions are not silently lost.
- Accumulate cursor path distance, not start-to-end distance: a circle returning
  to its origin must survive. Close after 300 ms without qualifying movement at the
  last moving observation, or emit after two seconds of continuous motion. Reset
  at pause/cut/scene/geometry and outside/unknown evidence. Flush at source end.
- Preserve button-down observations as explicit cursor evidence. Duplicate times
  use the last normalized observation, consistent with trail planning. Idle requires
  observed stillness; a gap in acquisition is not proof of a stationary cursor.
- Initial motion tolerance is max(one source pixel, 0.001 times source long edge),
  measured from the last accepted anchor so slow movement accumulates. A motion
  burst needs cumulative displacement of 0.01 times long edge; button-down evidence
  does not need that distance. These heuristic values are delegated to fixture
  outcomes and live centrally in selection policy, never in adapters.
- Collapse only ordinary static coverage after a contiguous chain of zero measured
  pixel difference and equivalent visible cursor evidence with no new burst. A
  below-threshold scene comparison alone is insufficient. Mandatory reasons survive
  even when images appear identical. Label equality as sampled, not full-resolution
  or semantic equivalence. Missing evidence cannot establish equality.

Dense continuous animation can legitimately produce many detected boundaries. The
fixture must expose that density; do not silently discard mandatory boundaries to
make the contact sheet smaller. Any change to scene-event policy needs its own
measured outcome and a shared producer update.

## Verification

Pin exact reasons, times and coverage for stationary pointer, jitter, slow movement,
circle/wave returning to origin, 299/300 ms idle, continuous motion, page splits,
duplicate times, rapid clicks, acquisition gaps, pauses, cuts through bursts, short
scenes and sparse future video. Page sizes must not change the ledger. Thirty-minute
input is streamed; no whole-source cursor/candidate array in production.

The runnable ledger feeds lab:index in 11c. Tests alone close this pure policy seam,
not visual usefulness. Final contact sheets compare retained delivered images with
the independently labeled event ledger and run screenshot-critique last. Keep real
captured gesture and real UI threshold gates open.
