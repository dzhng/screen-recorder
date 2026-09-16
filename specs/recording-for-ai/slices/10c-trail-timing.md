# Trail timing over sparse video

Status: native/core timing evidence verified; trail policy and public rendering
are not implemented. This bounded pass resolves the remaining overlay anchor
before extending frame requests to default trails.

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

Evaluate the candidate policy of ending cursor evidence at the later of requested
and decoded source time. For a held earlier frame, this preserves pointing up to
the request. For a selected future transition, the future boundary clips away the
old path. This candidate must be tested with real cursor samples, pause/cut and
geometry epochs before adoption; it is not an implemented default.

The analysis window must cover the image actually selected as well as the requested
trail interval. A future selection can be arbitrarily far away in sparse media:
do not stretch bounded scene work across the entire gap. Determine the relevant
comparison from bounded endpoint observations and retain explicit sampled coverage.
Do not fabricate a pointer when no eligible observation exists after a reset, or
treat geometry-mismatched coordinates as current video pixels.

## Acceptance

- Static held frame with later circle/wave retains the gesture.
- Nearest future changed frame receives no old path.
- Exact earlier tie, next kept span at a cut, pause and resize preserve their
  independent reset semantics.
- The result exposes actual cursor interval, cutoff reasons, selected video
  timing and source evidence generation.
- Local and global analysis give the same boundary for the same pair.
- Decode/evidence failure stays explicit; no clean fallback satisfies a default
  trail request.
- Run rendered fixture comparison and independent visual critique before accepting
  style or public defaults. Encoded flat-color timing proof alone is insufficient.
