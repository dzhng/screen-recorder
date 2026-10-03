# Retained pictures at processing boundaries

A short opacity window can change the visible result without changing the source
picture. Retained screenshot selection now consumes the compiler's exact processing
boundaries for the requested tap. It selects the same neighboring pictures used
for other boundaries, with the existing candidate/work budgets and cancellation.
The selection policy identity advances so an earlier incomplete index is not reused.
No second keyframe, anchor or frame-clock calculation is introduced.

The regression first failed because all four neighboring pictures were absent.
The fixed selector passes 28 focused core index tests; the integrated model passes
158 composition tests and type checks. The public CLI/MCP journey proves a brief
window yields the black middle picture, preserves surrounding output, and retains
five candidates whose delivered PNGs exactly equal direct requests. A dry clip tap
retains only the first/last candidates, excluding the processing it bypasses.
`public.gz` retains all requests/results; `index-red.gz` pins the pre-fix failure.

An initial test incorrectly compared final output with an intermediate dry clip
picture. Those scopes differ in alpha and compositing; the rejected assertion is
retained in `incorrect-tap-control.gz`. The corrected control compares the same
final-output scope with unity opacity. Neither production behavior nor the equality
gate was weakened. The original 24 curve/constant/split PNGs remain byte-identical
to the prior [opacity cohort](../16-opacity/README.md).

The combined frozen worker includes the converter offset fix and new native
processing projection. Physical-segment/window/split audio tests and the full
19-check mixer regression pass (`audio-segments.gz`, `audio-mix.gz`). Independent
review found no actionable regressions and ran 20 focused index tests; it did not
run native integration. Root owns the public and audio runtime evidence.

## Visual review

Fresh critique inspected all 24 original pictures and all 14 new window/index PNGs,
including enlarged contact/detail views. Geometry, edges and corresponding rows
are consistent, with no unintended artifact identified. The initial curve picture
is intentionally black at opacity zero; the three black window/index pictures
are the authored 250 ms hidden state. The reference curve intentionally rises steeply
by 125 ms, explaining the mostly stable later brightness. Root inspection agrees.
Eight curve stills and these 40×64 fixtures do not establish arbitrary animation
smoothness or strict encoded-color quality. The existing analytic values and exact
PNG comparisons own timing/equality, not the critic's visual impression.

Shape/diff/docs review keeps timing in the compiler and selection in its existing
owner. Choice audit adds no new product policy; it implements the required boundary
consumer and existing frame-neighbor rule. Animated geometry, gain, transitions and
full slice 16 acceptance remain open.
