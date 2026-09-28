# Animated scale with one curve clock

Scale x/y uses the existing curve evaluator and retained clip evaluation range.
Both axes share the step clock but keep independent scalar programs. The existing
numeric geometry compiler remains the matrix owner; the native worker receives
only compiled matrices and routing metadata. Negative scale mirrors and zero scale
collapses, matching static geometry. Full cubic extrema must be finite, and every
emitted matrix still satisfies the existing finite/safe-number constraints.

The public `keyframes.mjs --case moved-split-zoom` journey delivers 39 PNGs over CLI
and MCP. Eight cubic zoom samples match independent analytic constant controls
byte for byte; moving and splitting preserves all eight, trimming preserves four,
and three activation-window checks match their active or dry controls. Full movie
preview and export are byte-identical. These outputs use the pinned image-only
worker recorded in the report; they make no audio claim.

**Encoded movie color/edge parity is unresolved: the maximum direct-PNG versus
movie channel difference is 240.** Mean RGB differences are 0.528–4.658, within the
inherited membership/layout gate of 12. Full/ranged means are 0.396–1.331 with a
maximum channel difference of 37. That gate only supports frame membership and
layout, not strict encoded-color acceptance. No cause has been established and no
threshold was relaxed. `details.png` shows complete enlarged PNG/movie frame pairs;
`edge-metrics.json` retains differing-pixel extents. The complete contact sheet and
all individual captures are retained for fresh, unprimed visual review, which is
pending. This evidence does not close a strict movie parity gate or full slice 16.

Composition has 166 passing tests, including independent axes, lifecycle preservation,
output-target timing, window boundaries, mirror/zero crossings and invalid extrema.
A deliberate shared-axis-cache mutation fails two of eight focused tests. Restored
types and targeted service/CLI builds pass. Independent code review found no
actionable defect. Existing opacity's 24 PNGs and static layers' 124 PNGs remain
byte-exact against their prior runs. `verification.json` records artifact hashes and
uncompressed report/log hashes; compressed public reports retain requests and checks.
