# Position and rotation on the shared geometry clock

Position animates through the existing rectangle's x/y fields; clockwise rotation
animates through the existing angle. Numeric values remain valid. Scale, position
and rotation share one processing-step clock and retained evaluation range, with
independent scalar programs. There is no second position control or native curve
interpreter. The numeric geometry compiler still owns crop/fit/pivot and matrices.
Rectangle sizes, crop and pivot remain numeric in this checkpoint; gain, transitions
and convenience commands remain unfinished work in slice 16.

The public `keyframes.mjs --case moved-split-pose` journey sends actual CLI/MCP
requests and checks 39 delivered PNGs. Eight animated pictures match independently
calculated static controls exactly; move and fractional split preserve all eight,
trim preserves four, and three window samples match their active/dry controls.
The same runner's original zoom case remains a preservation gate. Production route
pictures differ from the prior scale-only pictures at every sample except the
intentional identity midpoint; `edge-metrics.json` retains these differences.

Encoded color/edges remain unresolved. The movie comparison's mean RGB differences
are 1.587–4.085, maximum channel difference **253**. Full/range means are
0.414–1.516, maximum49. The inherited mean<=12 criterion checks membership/layout;
it is not strict color acceptance. No native encoder change or relaxed threshold
is part of this pass. Full preview/export bytes match. `review/manifest.json`
contains every capture: 39 public PNGs plus eight decoded movie frames, all with
complete-frame 4x nearest-neighbor crops. Fresh unprimed review inspected all 47 originals/crops and four sheets. Geometry
looked consistent across animated/static/moved/split and trim/window groups. It
identified blockier movie contours, dark fringes, colored spill and bright/desaturated
yellow/green patches, especially frames 0–3; these remain actionable encoded-media
limitations. Boundary clipping is present consistently in controls and edited
versions: early yellow at left, multiple edges at midpoint, and yellow/red outside
late frames while blue/green are partial. This agrees with the authored trajectory;
no isolated holes, duplicates or black stacking seams were found. Tiny rectangles
cannot establish real UI/text quality or motion/easing between still samples.

A mutation that incorrectly takes x from y initially escaped animated/static
comparison because both paths shared that error. The retained first mutation log
is an explicitly ineffective test. The added independent landmark test predicts
where the authored top-left pivot and an offset point must land from position and
clockwise angle; the same mutation now fails (x6 instead of x4), and restored code
passes. This separates shared static-control parity from independent correctness.
Full-curve overflow refusal, independent scalar values, boundaries, move/split/trim,
retiming and window exclusion are also tested. Logs retain the original schema
rejection, both mutation attempts and final verification.

Independent code review found no actionable regressions and independently ran all
172 composition tests plus the type check. The original zoom case retains all 39
previous PNG bytes. The complete public static-layer journey also passes: all 62 original tap PNGs
retain their reviewed hashes, and both additional output-mirror cases pass their
independent oracle. Whole/range movies, unchanged PCM, export and lifetime checks
are preserved.

Root integration reproduces all 39 public PNGs byte for byte on the combined worker,
with 172 composition tests and the targeted build passing. `root-integration.json`
pins the worker and output hashes; encoded quality remains open.
