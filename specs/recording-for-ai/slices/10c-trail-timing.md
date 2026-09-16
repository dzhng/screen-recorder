# Trail timing over sparse video

Status: requested-time visual compatibility is implemented and verified with
encoded sparse sources, including a two-minute gap. The bounded core trail planner now selects geometry/pause resets and cursor runs.
Generated public rendering and independent readability checks now pass through
[public integration](10e-public-trails.md). Real captured gestures remain open.

## Evidence that constrains the policy

The [encoded timing fixture](../../../apps/macos/tests/scene-analysis.test.mjs)
has black, white and black frames at source seconds 0, 2 and 4. Requests through
second 1 select the held frame at 0, including the earlier tie. A request at 1.5
selects the white frame at 2. The shared analyzer correctly reports that comparison
at actual second 2, outside the requested interval. It must not backdate a scene
change to the sampling grid's first selection of that future frame.

This means filtering scene boundaries to the requested trail interval is
insufficient for overlays: the returned image itself may be from a future
transition. Conversely, ending every trail at actual frame time loses cursor
motion over a static held frame. Both failures follow from the same fixture;
neither is solved by changing the existing nearest-frame selection rule.

## Implementation seam

Resolve a trail plan in core after selecting the decoded frame, before native
rendering. It must carry separate requested time, decoded time and cursor evidence
interval. Use the same clean visual comparisons for local requests and global
indexing; do not introduce a second scene threshold or native edit mapper.

Cursor evidence always ends at the requested source time R and fades from R.
Never use max(requested, decoded): a future frame with identical pixels would then
pull in gestures the user had not made when they asked for the image.

For an earlier/held decoded sample, retain eligible evidence through R if its
geometry matches the selected image. For a future decoded sample A, compare it
against P, the last actual sample at or before R inside the original kept span.
If the existing scene policy detects a change, a pause intervenes, or geometry is
incompatible, return an explicitly empty eligible overlay with that reason and
future decoded time. Never borrow a future pointer. If the pair has no detected
change and pause/geometry evidence permits it, retain the requested-time trail.
This is sampled compatibility, not proof that nothing happened between endpoints.

No new native selector is needed: request one existing visual observation at R
with analysis-only kept interval [original.start, min(original.end,R+1)).
Nearest selection inside that prefix yields P. Final image selection keeps the
original kept interval. Missing P, decode failure or missing required analysis is
explicit unavailable/failed trail evidence, not a successful clean fallback.

Keep ordinary scene sampling within the requested trail window (at most ten
seconds). Compare P and A directly even if separated by minutes; do not extend a
sampling grid across that gap. Preserve endpoint observations, actual timestamps
and sampled coverage with policy provenance.

Journal delivery order is not cross-event occurrence order: cursor observations
are buffered and may be written after a pause marker they precede. Sequence remains
a stable cursor tie-breaker, not proof that a point happened after a pause.
Do not carry an ambiguous equal-time point across a pause reset; geometry epochs
identify the placement actually used by each sample. Select evidence in source
time, clip at the kept span and latest reset, and split runs on ineligible
observations. Keep the observation timestamp of a stale pointer; do not invent an age threshold or interpolate a
position without evidence. Reject coordinates whose geometry does not match the
selected image.

## Acceptance

- Static held frame with later circle/wave retains the gesture.
- Nearest future changed frame receives no old path or future pointer.
- Future identical frame retains only the pre-request gesture, excluding later
  motion. Repeat both future cases across a gap longer than ten seconds with
  constant bounded endpoint work.
- Exact earlier tie, next kept span at a cut, pause and resize preserve their
  independent reset semantics.
- The result exposes actual cursor interval, cutoff reasons, selected video
  timing and source evidence generation.
- Local and global analysis give the same boundary for the same pair.
- Decode/evidence failure stays explicit; no clean fallback satisfies a default
  trail request.
- Run rendered fixture comparison and independent visual critique before accepting
  style or public defaults. Encoded flat-color timing proof alone is insufficient.


[Compatibility evidence](../assets/scene-analysis/core-review.md#requested-time-frame-compatibility)
records the shared core/native checks. [Delivered public images](../assets/public-trails/review.md)
add rendered evidence; neither substitutes for real cursor acquisition.


## Core planner checkpoint

[planFrameTrail](../../../packages/core/src/trails.ts) prepares shared scene evidence
and selects a native overlay from the published source generation. Its result
preserves requested/decoded times, selected cursor interval, reset reasons, raw
pointer observation, geometry and sampled scene coverage. The renderer receives
only selected points and fades from requested time.

A placement-only window move resets old runs but does not invalidate a held image
whose raster geometry is unchanged. Current-epoch pixel coordinates can still mark
that image. Changed content placement, scaling or output dimensions cannot borrow
coordinates from a mismatched image. Same-epoch timing confirmations do not invent
new geometry resets. Null-time placements without matching timed confirmation
remain unavailable, with no guessed host-to-source conversion.

A stale pointer has no invented expiry. Indexed pause/geometry reads find known
resets, while a bounded endpoint comparison supplies sampled visual compatibility
outside the ordinary trail window. It preserves observation time and coverage;
matching endpoints never prove intermediate states were unchanged. Missing required
comparison fails explicitly; a detected change omits the pointer with its reason.

The [planner evidence](../assets/trail-evidence/planner.md) records focused tests
and limits. The subsequent public integration supplies the rendered acceptance evidence.
